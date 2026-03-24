'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Navigation, Anchor, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { useI18n } from '@/lib/i18n/context';

interface LogbookEntry {
  id: number;
  boat_id: number;
  date: string;
  location_from: string;
  location_to: string;
  nautical_miles: string;
  departure_time: string | null;
  arrival_time: string | null;
  skipper_user_id: number | null;
  skipper_name: string | null;
  note: string | null;
}

interface LogbookStats {
  total_nm: number;
  total_days: number;
  max_nm: number;
  avg_nm: number;
}

interface Boat {
  id: number;
  name: string;
}

interface CrewUser {
  id: number;
  name: string;
  boat_id: number;
}

async function apiCall(url: string, method = 'GET', data?: any) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const options: RequestInit = {
    method,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
  };
  if (data && method !== 'GET') options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  return res.json();
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(time: string | null): string {
  if (!time) return '';
  // time comes as HH:MM:SS or HH:MM
  return time.substring(0, 5);
}

export default function LogbookPage() {
  const { t } = useI18n();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [activeBoat, setActiveBoat] = useState<number>(0);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [stats, setStats] = useState<LogbookStats>({ total_nm: 0, total_days: 0, max_nm: 0, avg_nm: 0 });
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogbookEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formNm, setFormNm] = useState('');
  const [formDeparture, setFormDeparture] = useState('');
  const [formArrival, setFormArrival] = useState('');
  const [formSkipper, setFormSkipper] = useState<string>('');
  const [formNote, setFormNote] = useState('');

  // Load boats
  useEffect(() => {
    async function init() {
      const res = await apiCall('/api/auth/users');
      if (res.success && res.data) {
        const boatMap = new Map<number, string>();
        const userList: CrewUser[] = [];
        for (const u of res.data) {
          if (!boatMap.has(u.boat_id)) {
            boatMap.set(u.boat_id, u.boat_name);
          }
          userList.push({ id: u.id, name: u.name, boat_id: u.boat_id });
        }
        const boatList: Boat[] = [];
        for (const [id, name] of boatMap) {
          boatList.push({ id, name });
        }
        boatList.sort((a, b) => a.id - b.id);
        setBoats(boatList);
        setUsers(userList);
        if (boatList.length > 0 && activeBoat === 0) {
          setActiveBoat(boatList[0].id);
        }
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEntries = useCallback(async () => {
    if (!activeBoat) return;
    setLoading(true);
    const res = await apiCall(`/api/logbook?action=list&boat_id=${activeBoat}`);
    if (res.success) {
      setEntries(res.data.entries);
      setStats(res.data.stats);
    }
    setLoading(false);
  }, [activeBoat]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function openAddModal() {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormFrom('');
    setFormTo('');
    setFormNm('');
    setFormDeparture('');
    setFormArrival('');
    setFormSkipper('');
    setFormNote('');
    setModalOpen(true);
  }

  function openEditModal(entry: LogbookEntry) {
    setEditingEntry(entry);
    setFormDate(entry.date.substring(0, 10));
    setFormFrom(entry.location_from);
    setFormTo(entry.location_to);
    setFormNm(entry.nautical_miles);
    setFormDeparture(formatTime(entry.departure_time));
    setFormArrival(formatTime(entry.arrival_time));
    setFormSkipper(entry.skipper_user_id ? String(entry.skipper_user_id) : '');
    setFormNote(entry.note || '');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formDate) return;
    setSaving(true);

    const payload: any = {
      date: formDate,
      location_from: formFrom,
      location_to: formTo,
      nautical_miles: formNm ? parseFloat(formNm) : 0,
      departure_time: formDeparture || null,
      arrival_time: formArrival || null,
      skipper_user_id: formSkipper ? parseInt(formSkipper) : null,
      note: formNote || null,
    };

    if (editingEntry) {
      payload.action = 'edit';
      payload.id = editingEntry.id;
    } else {
      payload.action = 'add';
      payload.boat_id = activeBoat;
    }

    const res = await apiCall('/api/logbook', 'POST', payload);
    if (res.success) {
      setModalOpen(false);
      loadEntries();
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiCall('/api/logbook', 'POST', { action: 'delete', id });
    setDeleteConfirm(null);
    loadEntries();
  }

  const boatUsers = users.filter(u => u.boat_id === activeBoat);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <Navigation size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Logbook
        </h1>
      </div>

      {/* Boat tabs */}
      {boats.length > 0 && (
        <div className="tab-nav" style={{ marginBottom: 16 }}>
          {boats.map(boat => (
            <button
              key={boat.id}
              className={`tab-btn ${activeBoat === boat.id ? 'active' : ''}`}
              onClick={() => setActiveBoat(boat.id)}
            >
              {boat.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          <div className="card">
            <div className="card-body" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-brand)' }}>
                {stats.total_nm}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                Total NM
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {stats.total_days}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                Entries
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {stats.max_nm}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                Max NM
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {stats.avg_nm}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                Avg NM
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          <Anchor size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No logbook entries yet</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddModal}>
            Add first entry
          </button>
        </div>
      )}

      {/* Entries list */}
      {!loading && entries.map(entry => {
        const nm = parseFloat(entry.nautical_miles) || 0;
        return (
          <div key={entry.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-body" style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* NM badge */}
              <div style={{
                minWidth: 56,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-brand)' }}>
                  {nm}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                  NM
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>
                  {formatDateDisplay(entry.date.substring(0, 10))}
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {entry.location_from && (
                    <span>{entry.location_from}</span>
                  )}
                  {entry.location_from && entry.location_to && (
                    <ArrowRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  {entry.location_to && (
                    <span>{entry.location_to}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {(entry.departure_time || entry.arrival_time) && (
                    <span>
                      {formatTime(entry.departure_time)}
                      {entry.departure_time && entry.arrival_time ? ' - ' : ''}
                      {formatTime(entry.arrival_time)}
                    </span>
                  )}
                  {entry.skipper_name && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Avatar name={entry.skipper_name} size="sm" userId={entry.skipper_user_id || 1} />
                      {entry.skipper_name}
                    </span>
                  )}
                </div>
                {entry.note && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {entry.note}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openEditModal(entry)}
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => setDeleteConfirm(entry.id)}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* FAB */}
      {!loading && activeBoat > 0 && (
        <button className="fab" onClick={openAddModal} aria-label="Add entry">
          <Plus size={24} />
        </button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? 'Edit Entry' : 'Add Entry'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formDate}>
              {saving ? 'Saving...' : (editingEntry ? 'Update' : 'Add')}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input
            className="form-control"
            type="date"
            value={formDate}
            onChange={e => setFormDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input
              className="form-control"
              value={formFrom}
              onChange={e => setFormFrom(e.target.value)}
              placeholder="e.g. Split"
            />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input
              className="form-control"
              value={formTo}
              onChange={e => setFormTo(e.target.value)}
              placeholder="e.g. Hvar"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Nautical miles</label>
          <input
            className="form-control"
            type="number"
            step="0.1"
            min="0"
            value={formNm}
            onChange={e => setFormNm(e.target.value)}
            placeholder="0.0"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Departure time</label>
            <input
              className="form-control"
              type="time"
              value={formDeparture}
              onChange={e => setFormDeparture(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Arrival time</label>
            <input
              className="form-control"
              type="time"
              value={formArrival}
              onChange={e => setFormArrival(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Skipper</label>
          <select className="form-control" value={formSkipper} onChange={e => setFormSkipper(e.target.value)}>
            <option value="">-- No skipper --</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <input
            className="form-control"
            value={formNote}
            onChange={e => setFormNote(e.target.value)}
            placeholder="Weather, conditions, etc."
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Entry"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</button>
          </div>
        }
      >
        <p>Are you sure you want to delete this logbook entry? This cannot be undone.</p>
      </Modal>
    </>
  );
}
