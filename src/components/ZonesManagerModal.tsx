import { useMemo, useState } from 'react';
import { db } from '../db/database';
import type { Zone } from '../types';
import { makeId } from '../utils/id';
import { Modal } from './Modal';

type ZonesManagerModalProps = {
  zones: Zone[];
  zoneBalances: Record<string, number>;
  onClose: () => void;
};

const SYSTEM_ZONE_IDS = new Set(['zone_hq']);

function formatNumberWithCommas(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function ZonesManagerModal({ zones, zoneBalances, onClose }: ZonesManagerModalProps) {
  const [newZoneName, setNewZoneName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const systemZones = useMemo(() => zones.filter((zone) => SYSTEM_ZONE_IDS.has(zone.id)), [zones]);
  const customZones = useMemo(() => zones.filter((zone) => !SYSTEM_ZONE_IDS.has(zone.id)), [zones]);

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setEditName(zone.name);
    setError(null);
  }

  async function saveEdit(zoneId: string) {
    const name = editName.trim();
    if (!name) {
      setError('Enter a zone name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await db.zones.update(zoneId, { name });
      setEditingId(null);
      setEditName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update zone.');
    } finally {
      setIsSaving(false);
    }
  }

  async function addZone() {
    const name = newZoneName.trim();
    if (!name) {
      setError('Enter a zone name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const zone: Zone = { id: makeId('zone'), name, kind: 'asset', createdAt: Date.now() };
      await db.zones.add(zone);
      setNewZoneName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add zone.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteZone(zone: Zone) {
    const balance = zoneBalances[zone.id] ?? 0;
    if (Math.round(balance) !== 0) {
      setError('Move funds out of this zone before deleting it.');
      return;
    }
    const txs = await db.transactions.toArray();
    const usedInTransfer = txs.some((tx) => {
      if (!tx.tags?.includes('internal_transfer')) return false;
      return tx.meta?.fromZoneId === zone.id || tx.meta?.toZoneId === zone.id;
    });
    if (usedInTransfer) {
      setError('This zone has transfer history and can’t be deleted.');
      return;
    }
    if (!window.confirm(`Delete zone "${zone.name}"?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      await db.zones.delete(zone.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete zone.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="Manage Zones" description="Add zones to track where your money lives." onClose={onClose}>
      <div className="card soft" style={{ marginBottom: 12 }}>
        <div className="small muted">System zones</div>
        <div className="zone-manager-list">
          {systemZones.map((zone) => (
            <div key={zone.id} className="zone-manager-row">
              <div>
                <div className="zone-manager-name">{zone.name}</div>
                <div className="small muted">System default</div>
              </div>
              <div className="zone-manager-meta">{formatNumberWithCommas(zoneBalances[zone.id] ?? 0)} VND</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card soft" style={{ marginBottom: 12 }}>
        <div className="small muted">Custom zones</div>
        <div className="zone-manager-list">
          {customZones.length ? (
            customZones.map((zone) => (
              <div key={zone.id} className="zone-manager-row">
                <div style={{ flex: 1 }}>
                  {editingId === zone.id ? (
                    <input
                      className="zone-manager-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                    <div className="zone-manager-name">{zone.name}</div>
                  )}
                  <div className="small muted">Balance: {formatNumberWithCommas(zoneBalances[zone.id] ?? 0)} VND</div>
                </div>
                <div className="zone-manager-actions">
                  {editingId === zone.id ? (
                    <button className="action-link" onClick={() => void saveEdit(zone.id)} disabled={isSaving}>Save</button>
                  ) : (
                    <button className="action-link" onClick={() => startEdit(zone)} disabled={isSaving}>Rename</button>
                  )}
                  <button
                    className="action-link"
                    style={{ color: '#ef4444' }}
                    onClick={() => void deleteZone(zone)}
                    disabled={isSaving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="small muted">No custom zones yet.</div>
          )}
        </div>
      </div>

      <div className="card soft">
        <div className="small muted">Add a zone (Bank, Cash, Savings)</div>
        <div className="zone-manager-add">
          <input
            className="zone-manager-input"
            placeholder="e.g., Bank Savings"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
          />
          <button className="pill primary" onClick={() => void addZone()} disabled={isSaving}>Add</button>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Transfers move money between zones without affecting your quest or cap.</div>
      </div>

      {error ? <div className="small" style={{ color: '#ef4444', marginTop: 10 }}>{error}</div> : null}
    </Modal>
  );
}
