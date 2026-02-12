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
