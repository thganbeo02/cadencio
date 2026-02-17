export type TransactionDirection = 'IN' | 'OUT';

export interface Transaction {
  id: string;
  dateISO: string;
  amount: number;
  direction: TransactionDirection;
  categoryId: string;
  note?: string;
  tags?: string[];
  confirmedAt?: number;
  createdAt: number;
  meta?: {
    fromZoneId?: string;
    toZoneId?: string;
    relatedObligationCycleId?: string;
  };
}

export interface Category {
  id: string;
  name: string;
  type: TransactionDirection;
  icon?: string;
  budgetMonthly?: number;
  isFavorite?: boolean;
}

export type ZoneKind = 'asset' | 'flow' | 'liability';

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  createdAt: number;
}

export type ObligationPriority = 1 | 2 | 3;

export interface Obligation {
  id: string;
  name: string;
  totalAmount: number;
  priority: ObligationPriority;
  cycles: ObligationCycle[];
}

export type ObligationCycleStatus = 'PLANNED' | 'PAID' | 'MISSED';
export type ObligationCadence = 'one_time' | 'monthly';

export interface ObligationCycle {
  id: string;
  amount: number;
  dueDateISO: string;
  cadence: ObligationCadence;
  status: ObligationCycleStatus;
  confirmedAt?: number;
  autoCreatedTransactionId?: string;
}

export interface Quest {
  id: string;
  name: string;
  targetAmount: number;
  createdAt: number;
  kind?: 'debt_cut' | 'earned_climb' | 'recovery_map';
  tier?: 1 | 2 | 3;
  baselineAmount?: number;
  shadowDebt?: number;
}

export interface Settings {
  focusMode: boolean;
  frictionEnabled: boolean;
  monthlyIncome?: number;
  hoursPerWeek: number;
  monthlyCap: number;
  salaryDay: number;
  timezone: string;
  selfReportedDebt?: number;
  activeQuestId?: string;
  onboardingCompletedAt?: number;
}

export interface SettingsRecord extends Settings {
  id: 'settings';
}

export type ActivityType = 'transaction_added' | 'transfer_created' | 'obligation_planned' | 'confirmed_paid';

export type ActivityUndo =
  | { kind: 'transaction'; txId: string }
  | { kind: 'transfer'; txIds: string[] }
  | { kind: 'obligation_planned'; obligationId: string; prevCycles: ObligationCycle[]; prevTotalAmount: number }
  | { kind: 'confirmed_paid'; obligationId: string; cycleId: string; prevCycle: ObligationCycle; prevTotalAmount: number; txId: string };

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  createdAt: number;
  amount?: number;
  direction?: TransactionDirection;
  meta?: {
    note?: string;
    categoryId?: string;
    obligationName?: string;
    planType?: 'one_time' | 'monthly' | 'split';
    fromZoneId?: string;
    toZoneId?: string;
  };
  undo?: ActivityUndo;
}
