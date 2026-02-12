import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { createTransfer } from '../services/transactions';
import type { Zone } from '../types';

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

function formatNumberWithCommas(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function TransferModal({
  onClose,
  zones,
  fromZoneId,
}: {
  onClose: () => void;
  zones: Zone[];
  fromZoneId?: string;
}) {
  const assetZones = useMemo(() => zones.filter((zone) => zone.kind === 'asset'), [zones]);
  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [fromId, setFromId] = useState(fromZoneId ?? assetZones[0]?.id ?? '');
  const [toId, setToId] = useState(() => {
    const firstOther = assetZones.find((zone) => zone.id !== (fromZoneId ?? assetZones[0]?.id));
    return firstOther?.id ?? '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = useMemo(() => {
    const n = Number(amountRaw);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [amountRaw]);

  const displayAmount = amountRaw ? formatNumberWithCommas(Number(amountRaw)) : '';

  async function submit() {
    if (!fromId || !toId || fromId === toId) {
      setError('Choose two different zones.');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createTransfer({ amount, fromZoneId: fromId, toZoneId: toId, note });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create transfer.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title="Transfer"
      description="Move money between your zones."
      onClose={onClose}
      cardClassName="transaction-card"
      titleClassName="onboarding-title"
      descriptionClassName="onboarding-subtitle"
    >
      <div className="transaction-body">
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

        <div className="transfer-grid">
          <div className="transfer-field">
            <label className="transaction-label" htmlFor="transfer-from">From</label>
            <select
              id="transfer-from"
              className="transaction-select"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {assetZones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
          <div className="transfer-field">
            <label className="transaction-label" htmlFor="transfer-to">To</label>
            <select
              id="transfer-to"
              className="transaction-select"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {assetZones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="transaction-section">
          <label className="transaction-label" htmlFor="transfer-note">Note</label>
          <input
            id="transfer-note"
            className="transaction-note"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
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
