import { digitsOnly } from './input';

export function formatNumberWithCommas(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(0) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'K';
  return String(Math.round(amount));
}

export function formatMillions(amount: number): string {
  const n = amount / 1_000_000;
  if (!Number.isFinite(n)) return '0.0M';
  return `${n.toFixed(1)}M`;
}

export function parseVndRaw(raw: string): number {
  const cleaned = digitsOnly(raw);
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function formatVndInput(raw: string, allowZero = false): string {
  const cleaned = digitsOnly(raw);
  if (!cleaned) return '';
  if (cleaned === '0' && !allowZero) return '';
  return formatNumberWithCommas(Number(cleaned));
}
