import { addDaysISO } from '../utils/dates';

export type SuggestionKind = 'ONE_TIME' | 'MONTHLY' | 'SPLIT' | 'NONE';

export type SuggestedPlan =
  | { kind: 'NONE'; reason: string }
  | { kind: 'ONE_TIME'; amount: number; dueDateISO: string; clearsInMonths: number }
  | { kind: 'MONTHLY'; monthlyAmount: number; dueDay: number; startMonthISO: string; clearsInMonths: number }
  | { kind: 'SPLIT'; upfrontAmount: number; upfrontDueISO: string; monthlyAmount: number; dueDay: number; startMonthISO: string; clearsInMonths: number };

export interface SuggestionInput {
  obligationTotal: number;
  priority: 1 | 2 | 3;
  monthlyIncome: number;
  monthlyCap: number;
  existingMonthlyLoad: number;
  salaryDay: number;
  todayISO: string;
}

const ONE_TIME_CAPACITY_RATIO = 0.5;
const ONE_TIME_INCOME_RATIO = 0.4;
const SPLIT_MONTH_THRESHOLD = 6;
const SPLIT_UPFRONT_RATIO = 0.3;
const SPLIT_UPFRONT_CAP_RATIO = 1.5;
const MAX_MONTHLY_CAPACITY_RATIO = 0.4;
const NICE_NUMBER_OVERFLOW = 1.15;
const SMALL_DEBT_THRESHOLD = 30_000_000;
const FAST_TARGET_MONTHS = 4;
const STANDARD_TARGET_MONTHS = 9;

const P1_DUE_OFFSET = 1;
const P2_DUE_OFFSET = 3;
const P3_DUE_OFFSET = 5;

function clampDay(d: number): number {
  return Math.min(28, Math.max(1, d));
}

function roundToNice(raw: number): number {
  const n = Math.max(0, raw);
  if (n >= 10_000_000) return Math.round(n / 5_000_000) * 5_000_000;
  if (n >= 5_000_000) return Math.round(n / 1_000_000) * 1_000_000;
  if (n >= 1_000_000) return Math.round(n / 500_000) * 500_000;
  if (n >= 500_000) return Math.round(n / 100_000) * 100_000;
  return Math.round(n / 50_000) * 50_000;
}

function roundToNiceDown(raw: number): number {
  const n = Math.max(0, raw);
  if (n >= 10_000_000) return Math.floor(n / 5_000_000) * 5_000_000;
  if (n >= 5_000_000) return Math.floor(n / 1_000_000) * 1_000_000;
  if (n >= 1_000_000) return Math.floor(n / 500_000) * 500_000;
  if (n >= 500_000) return Math.floor(n / 100_000) * 100_000;
  return Math.floor(n / 50_000) * 50_000;
}

function suggestDueDay(salaryDay: number, priority: number): number {
  const offset = priority === 1 ? P1_DUE_OFFSET : priority === 2 ? P2_DUE_OFFSET : P3_DUE_OFFSET;
  return clampDay(((salaryDay + offset - 1) % 28) + 1);
}

function startMonthISO(todayISO: string, dueDay: number): string {
  const [y = NaN, m = NaN] = todayISO.split('-').map((x) => Number(x));
  const now = new Date();
  const baseYear = Number.isFinite(y) ? y : now.getUTCFullYear();
  const baseMonth = Number.isFinite(m) ? m : now.getUTCMonth() + 1;
  const base = new Date(Date.UTC(baseYear, baseMonth - 1, 1));
  const due = new Date(Date.UTC(baseYear, baseMonth - 1, clampDay(dueDay)));
  const diffDays = Math.ceil((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  const next = diffDays < 14 ? new Date(Date.UTC(baseYear, baseMonth, 1)) : base;
  const outYear = next.getUTCFullYear();
  const outMonth = String(next.getUTCMonth() + 1).padStart(2, '0');
  return `${outYear}-${outMonth}-01`;
}

function oneTimeDueISO(todayISO: string, dueDay: number): string {
  const [y = NaN, m = NaN, d = NaN] = todayISO.split('-').map((x) => Number(x));
  const now = new Date();
  const baseYear = Number.isFinite(y) ? y : now.getUTCFullYear();
  const baseMonth = Number.isFinite(m) ? m : now.getUTCMonth() + 1;
  const baseDay = Number.isFinite(d) ? d : now.getUTCDate();
  const base = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay));
  const inOneMonth = new Date(Date.UTC(baseYear, baseMonth, baseDay));
  const outYear = inOneMonth.getUTCFullYear();
  const outMonth = String(inOneMonth.getUTCMonth() + 1).padStart(2, '0');
  const due = `${outYear}-${outMonth}-${String(clampDay(dueDay)).padStart(2, '0')}`;
  const diff = Math.ceil((new Date(Date.UTC(outYear, inOneMonth.getUTCMonth(), clampDay(dueDay))).getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 14) return addDaysISO(due, 30);
  return due;
}

function suggestMonthlyAmount(total: number, remainingCapacity: number): { monthly: number; months: number } {
  const maxMonthly = remainingCapacity * MAX_MONTHLY_CAPACITY_RATIO;
  const targetMonths = total < SMALL_DEBT_THRESHOLD ? FAST_TARGET_MONTHS : STANDARD_TARGET_MONTHS;
  const idealMonthly = total / targetMonths;
  const rawMonthly = Math.min(idealMonthly, maxMonthly);
  const rounded = roundToNice(rawMonthly);
  const monthly = rounded <= maxMonthly * NICE_NUMBER_OVERFLOW ? rounded : roundToNiceDown(rawMonthly);
  const safeMonthly = Math.max(50_000, monthly);
  const months = safeMonthly > 0 ? Math.ceil(total / safeMonthly) : targetMonths;
  return { monthly: safeMonthly, months };
}

export function suggestObligationPlan(input: SuggestionInput): SuggestedPlan {
  const availableForObligations = input.monthlyIncome - input.monthlyCap;
  const remainingCapacity = availableForObligations - input.existingMonthlyLoad;

  if (!Number.isFinite(availableForObligations) || availableForObligations <= 0) {
    return { kind: 'NONE', reason: 'Add monthly income and cap to generate a suggestion.' };
  }
  if (remainingCapacity <= 0) {
    return { kind: 'NONE', reason: 'Your scheduled obligations already match your available income.' };
  }

  const dueDay = suggestDueDay(input.salaryDay, input.priority);

  if (input.obligationTotal <= remainingCapacity * ONE_TIME_CAPACITY_RATIO || input.obligationTotal <= input.monthlyIncome * ONE_TIME_INCOME_RATIO) {
    const amount = roundToNice(input.obligationTotal);
    const dueDateISO = oneTimeDueISO(input.todayISO, dueDay);
    return { kind: 'ONE_TIME', amount, dueDateISO, clearsInMonths: 1 };
  }

  const { monthly, months } = suggestMonthlyAmount(input.obligationTotal, remainingCapacity);

  if (input.priority === 1 && input.obligationTotal > monthly * SPLIT_MONTH_THRESHOLD) {
    const rawUpfront = input.obligationTotal * SPLIT_UPFRONT_RATIO;
    const cappedUpfront = Math.min(rawUpfront, input.monthlyIncome * SPLIT_UPFRONT_CAP_RATIO);
    const upfrontAmount = roundToNice(cappedUpfront);
    const upfrontDueISO = oneTimeDueISO(input.todayISO, dueDay);
    const remainder = Math.max(input.obligationTotal - upfrontAmount, 0);
    const rem = suggestMonthlyAmount(remainder, remainingCapacity);
    return {
      kind: 'SPLIT',
      upfrontAmount,
      upfrontDueISO,
      monthlyAmount: rem.monthly,
      dueDay,
      startMonthISO: startMonthISO(input.todayISO, dueDay),
      clearsInMonths: 1 + rem.months,
    };
  }

  return {
    kind: 'MONTHLY',
    monthlyAmount: monthly,
    dueDay,
    startMonthISO: startMonthISO(input.todayISO, dueDay),
    clearsInMonths: months,
  };
}
