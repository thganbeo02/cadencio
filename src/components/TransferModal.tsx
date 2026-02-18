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
  zoneBalances,
  fromZoneId,
}: {
  onClose: () => void;
  zones: Zone[];
  zoneBalances: Record<string, number>;
  fromZoneId?: string;
}) {
  const assetZones = useMemo(() => zones.filter((zone) => zone.kind === 'asset'), [zones]);
  const hasEnoughZones = assetZones.length >= 2;
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
  const rawAvailable = zoneBalances[fromId] ?? 0;
  const available = Math.max(0, Math.round(rawAvailable));
  const overBy = amount > available ? amount - available : 0;

  async function submit() {
    if (!hasEnoughZones) {
      setError('Add at least two zones to make a transfer.');
      return;
    }
    if (!fromId || !toId || fromId === toId) {
      setError('Choose two different zones.');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (amount > available) {
      setError('Not enough funds in this zone.');
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
        {!hasEnoughZones ? (
          <div className="card soft">
            <div className="small muted">Add at least two zones before transferring.</div>
            <div className="small muted" style={{ marginTop: 6 }}>Use the Zones card → Edit to add more zones.</div>
          </div>
        ) : null}
        <div className="transaction-amount">
          <span className="amount-prefix">VND</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={displayAmount}
            autoFocus
            onChange={(e) => setAmountRaw(digitsOnly(e.target.value))}
            disabled={!hasEnoughZones}
          />
        </div>
        {hasEnoughZones ? (
          <div>
            <div className="small muted" style={{ fontSize: 20 }}>
              You have <span className="num">{formatNumberWithCommas(available)}</span> VND to transfer.
            </div>
          </div>
        ) : null}

        <div className="transfer-grid">
          <div className="transfer-field">
            <label className="transaction-label" htmlFor="transfer-from">From</label>
            <select
              id="transfer-from"
              className="transaction-select"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              disabled={!hasEnoughZones}
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
              disabled={!hasEnoughZones}
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
            disabled={!hasEnoughZones}
          />
        </div>

        {hasEnoughZones && overBy > 0 ? (
          <div className="small" style={{ color: '#ef4444', fontSize: 20 }}>
            Not enough funds. Enter a smaller amount!
          </div>
        ) : null}

        {error ? <div className="transaction-error">{error}</div> : null}
      </div>

      <div className="transaction-actions">
        <button className="pill" onClick={onClose} disabled={isSaving}>Cancel</button>
        <button className="pill primary" onClick={() => void submit()} disabled={isSaving || !hasEnoughZones || overBy > 0 || amount <= 0}>
          {isSaving ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
