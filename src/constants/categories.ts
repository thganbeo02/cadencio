import type { Category, TransactionDirection } from '../types';

export type CategoryMap = Record<string, Category>;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food', type: 'OUT', icon: '🍜', isFavorite: true },
  { id: 'cat_transport', name: 'Transport', type: 'OUT', icon: '🚗' },
  { id: 'cat_utilities', name: 'Utilities', type: 'OUT', icon: '💡' },
  { id: 'cat_fun', name: 'Fun', type: 'OUT', icon: '🎉' },
  { id: 'cat_growth', name: 'Growth', type: 'OUT', icon: '📈' },
  { id: 'cat_rent', name: 'Housing', type: 'OUT', icon: '🏠' },
  { id: 'cat_health', name: 'Health', type: 'OUT', icon: '💊' },
  { id: 'cat_obligations', name: 'Obligations', type: 'OUT', icon: '📋' },
  { id: 'cat_transfer', name: 'Transfer', type: 'OUT', icon: '🔁' },
  { id: 'cat_other', name: 'Other', type: 'OUT', icon: '📦' },
  { id: 'cat_salary', name: 'Salary', type: 'IN', icon: '💰', isFavorite: true },
  { id: 'cat_freelance', name: 'Freelance', type: 'IN', icon: '🧑‍💻' },
  { id: 'cat_gift', name: 'Gift', type: 'IN', icon: '🎁' },
  { id: 'cat_refund', name: 'Refund', type: 'IN', icon: '↩️' },
  { id: 'cat_debt', name: 'Borrowed', type: 'IN', icon: '🧾' },
  { id: 'cat_other_in', name: 'Other', type: 'IN', icon: '📦' },
];

export const CATEGORY_BY_ID: CategoryMap = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.id, category])
);

export const SPEND_CATEGORY_ORDER = [
  'cat_food',
  'cat_transport',
  'cat_utilities',
  'cat_fun',
  'cat_other',
] as const;

export const RECEIVE_CATEGORY_ORDER = [
  'cat_salary',
  'cat_freelance',
  'cat_gift',
  'cat_refund',
  'cat_other_in',
] as const;

export function getCategoryName(id: string): string | undefined {
  return CATEGORY_BY_ID[id]?.name;
}

export function getCategoryDirection(id: string): TransactionDirection | undefined {
  return CATEGORY_BY_ID[id]?.type;
}
