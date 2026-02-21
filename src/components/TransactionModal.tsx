import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { createTransaction } from '../services/transactions';
import type { Category } from '../types';
import { CATEGORY_BY_ID, RECEIVE_CATEGORY_ORDER, SPEND_CATEGORY_ORDER } from '../constants/categories';
import { digitsOnly } from '../utils/input';
import { formatNumberWithCommas } from '../utils/money';

type Tab = 'spend' | 'receive';

type CategoryOption = {
  id: string;
  name: string;
};

const CATEGORY_ICONS: Record<string, ReactNode> = {
  cat_food: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3v7a4 4 0 0 0 4 4v7" />
      <path d="M20 3v7a4 4 0 0 1-4 4v7" />
      <path d="M8 3h8" />
    </svg>
  ),
  cat_transport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11h18" />
      <path d="M5 11l1-4a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l1 4" />
      <circle cx="7.5" cy="15.5" r="1.5" />
      <circle cx="16.5" cy="15.5" r="1.5" />
    </svg>
  ),
  cat_utilities: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4" />
      <path d="m6.8 6.8 2.8 2.8" />
      <path d="M2 12h4" />
      <path d="m6.8 17.2 2.8-2.8" />
      <path d="M12 18v4" />
      <path d="m17.2 17.2-2.8-2.8" />
      <path d="M18 12h4" />
      <path d="m17.2 6.8-2.8 2.8" />
    </svg>
  ),
  cat_fun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 15s1.5 2 4 2 4-2 4-2" />
    </svg>
  ),
  cat_other: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </svg>
  ),
  cat_salary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h2" />
      <path d="M11 15h2" />
    </svg>
  ),
  cat_freelance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 3h-8" />
      <path d="M12 3v4" />
    </svg>
  ),
  cat_gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" />
      <path d="M12 8v13" />
      <path d="M19 12v9H5v-9" />
      <path d="M12 8c1.5 0 2.5-1 2.5-2s-1-2-2.5-2-2.5 1-2.5 2 1 2 2.5 2z" />
    </svg>
  ),
  cat_refund: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9" />
      <path d="M3 3v6h6" />
      <path d="M21 12a9 9 0 0 1-9 9" />
      <path d="M21 21v-6h-6" />
    </svg>
  ),
  cat_other_in: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </svg>
  ),
  cat_debt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  ),
  cat_obligations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  ),
};

export function TransactionModal({
  onClose,
  defaultTab = 'spend',
}: {
  onClose: () => void;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = useMemo(() => {
    const n = Number(amountRaw);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [amountRaw]);

  const displayAmount = amountRaw ? formatNumberWithCommas(Number(amountRaw)) : '';

  const categories = useMemo<CategoryOption[]>(() => {
    const order = tab === 'spend' ? SPEND_CATEGORY_ORDER : RECEIVE_CATEGORY_ORDER;
    return order
      .map((id) => CATEGORY_BY_ID[id])
      .filter((category): category is Category => Boolean(category))
      .map((category) => ({ id: category.id, name: category.name }));
  }, [tab]);

  const activeCategoryId = categoryId ?? categories[0]?.id ?? null;
  const activeDirection: TransactionDirection = tab === 'receive' ? 'IN' : 'OUT';

  async function submit() {
    if (!activeCategoryId) return;
    if (!amount || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createTransaction({
        amount,
        direction: activeDirection,
        categoryId: activeCategoryId,
        note: note.trim() ? note.trim() : undefined,
        tags: activeCategoryId === 'cat_debt' ? ['debt_principal'] : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save transaction.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title="Add transaction"
      description="Quickly log spend or income."
      onClose={onClose}
      cardClassName="transaction-card"
      titleClassName="onboarding-title"
      descriptionClassName="onboarding-subtitle"
    >
      <div className="transaction-body">
        <div className="transaction-tabs">
          <button className={`tab-pill ${tab === 'spend' ? 'active' : ''}`} onClick={() => setTab('spend')}>Spend</button>
          <button className={`tab-pill ${tab === 'receive' ? 'active' : ''}`} onClick={() => setTab('receive')}>Receive</button>
        </div>

        <div className="transaction-amount">
          <span className="amount-prefix">VND</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={displayAmount}
            autoFocus
            onChange={(e) => setAmountRaw(digitsOnly(e.target.value))}
          />
        </div>

        <div className="transaction-section">
          <div className="transaction-label">Category</div>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`category-chip ${activeCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => setCategoryId(cat.id)}
              >
                <span className="category-icon">{CATEGORY_ICONS[cat.id]}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="transaction-section">
          <label className="transaction-label" htmlFor="note">Note</label>
          <input
            id="note"
            className="transaction-note"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div
            className="transaction-label"
            style={{ marginTop: 6, color: '#ef4444', textTransform: 'none', letterSpacing: '0', fontSize: 16 }}
          >
            Borrowed money? Toss it into Obligations so your quest log keeps the story straight!
          </div>
        </div>

        {error ? <div className="transaction-error">{error}</div> : null}
      </div>

      <div className="transaction-actions">
        <button className="pill" onClick={onClose} disabled={isSaving}>Cancel</button>
        <button className="pill primary" onClick={() => void submit()} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
