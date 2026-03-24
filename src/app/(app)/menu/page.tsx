'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, UtensilsCrossed } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { useI18n } from '@/lib/i18n/context';

interface MealPlan {
  id: number;
  boat_id: number;
  date: string;
  meal_type: string;
  cook_user_id: number | null;
  cook_name: string | null;
  meal_description: string | null;
  note: string | null;
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

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

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

export default function MenuPage() {
  const { t } = useI18n();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [activeBoat, setActiveBoat] = useState<number>(0);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripDates, setTripDates] = useState<string[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formMealType, setFormMealType] = useState('lunch');
  const [formCook, setFormCook] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');
  const [formNote, setFormNote] = useState('');

  // Load boats and trip dates
  useEffect(() => {
    async function init() {
      // Load users/boats
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

  // Generate trip date range from settings
  // We'll fetch settings through a lightweight approach - use the meals response dates
  // or generate a reasonable default range
  useEffect(() => {
    // Build trip dates from the meals we have, plus fill gaps
    // For now, generate next 14 days if no trip dates exist
    if (meals.length > 0) {
      const dates = new Set<string>();
      for (const m of meals) {
        dates.add(m.date.substring(0, 10));
      }
      // Find min/max and fill range
      const sorted = Array.from(dates).sort();
      const start = new Date(sorted[0] + 'T00:00:00');
      const end = new Date(sorted[sorted.length - 1] + 'T00:00:00');
      // Extend range 2 days before and after
      start.setDate(start.getDate() - 2);
      end.setDate(end.getDate() + 2);

      const range: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        range.push(current.toISOString().substring(0, 10));
        current.setDate(current.getDate() + 1);
      }
      setTripDates(range);
    } else if (!loading) {
      // Default: next 14 days
      const range: string[] = [];
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        range.push(d.toISOString().substring(0, 10));
      }
      setTripDates(range);
    }
  }, [meals, loading]);

  const loadMeals = useCallback(async () => {
    if (!activeBoat) return;
    setLoading(true);
    const res = await apiCall(`/api/menu?action=list&boat_id=${activeBoat}`);
    if (res.success) {
      setMeals(res.data.meals);
    }
    setLoading(false);
  }, [activeBoat]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  function openAddModal(date?: string) {
    setEditingMeal(null);
    setFormDate(date || tripDates[0] || new Date().toISOString().substring(0, 10));
    setFormMealType('lunch');
    setFormCook('');
    setFormDescription('');
    setFormNote('');
    setModalOpen(true);
  }

  function openEditModal(meal: MealPlan) {
    setEditingMeal(meal);
    setFormDate(meal.date.substring(0, 10));
    setFormMealType(meal.meal_type);
    setFormCook(meal.cook_user_id ? String(meal.cook_user_id) : '');
    setFormDescription(meal.meal_description || '');
    setFormNote(meal.note || '');
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);

    if (editingMeal) {
      const res = await apiCall('/api/menu', 'POST', {
        action: 'edit',
        id: editingMeal.id,
        cook_user_id: formCook ? parseInt(formCook) : null,
        meal_description: formDescription || null,
        note: formNote || null,
      });
      if (res.success) {
        setModalOpen(false);
        loadMeals();
      }
    } else {
      const res = await apiCall('/api/menu', 'POST', {
        action: 'add',
        boat_id: activeBoat,
        date: formDate,
        meal_type: formMealType,
        cook_user_id: formCook ? parseInt(formCook) : null,
        meal_description: formDescription || null,
        note: formNote || null,
      });
      if (res.success) {
        setModalOpen(false);
        loadMeals();
      }
    }

    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiCall('/api/menu', 'POST', { action: 'delete', id });
    setDeleteConfirm(null);
    loadMeals();
  }

  // Group meals by date
  const mealsByDate = meals.reduce<Record<string, MealPlan[]>>((acc, m) => {
    const dateKey = m.date.substring(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(m);
    return acc;
  }, {});

  const boatUsers = users.filter(u => u.boat_id === activeBoat);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <UtensilsCrossed size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Menu Plan
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

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          Loading...
        </div>
      )}

      {/* Calendar grid */}
      {!loading && tripDates.map(date => {
        const dayMeals = mealsByDate[date] || [];
        const isToday = date === new Date().toISOString().substring(0, 10);

        return (
          <div
            key={date}
            className="card"
            style={{
              marginBottom: 8,
              borderLeft: isToday ? '3px solid var(--color-brand)' : undefined,
            }}
          >
            <div className="card-body" style={{ padding: '12px 16px' }}>
              {/* Day header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: dayMeals.length > 0 ? 10 : 0,
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {formatDateDisplay(date)}
                  {isToday && (
                    <span className="badge" style={{
                      marginLeft: 8,
                      background: 'var(--color-brand)',
                      color: 'white',
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      Today
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openAddModal(date)}
                  aria-label="Add meal"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Meals for this day */}
              {dayMeals.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                  No meal planned
                </div>
              )}

              {dayMeals.map(meal => (
                <div
                  key={meal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0',
                    borderTop: '1px solid var(--color-border-light, var(--color-border))',
                  }}
                >
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      minWidth: 60,
                      textAlign: 'center',
                      background: 'var(--color-surface-secondary, var(--color-bg-secondary))',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {meal.meal_description && (
                      <div style={{ fontSize: '0.85rem' }}>{meal.meal_description}</div>
                    )}
                    {meal.cook_name && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Avatar name={meal.cook_name} size="sm" userId={meal.cook_user_id || 1} />
                        {meal.cook_name}
                      </div>
                    )}
                    {meal.note && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {meal.note}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(meal)}
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteConfirm(meal.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* FAB */}
      {!loading && activeBoat > 0 && (
        <button className="fab" onClick={() => openAddModal()} aria-label="Add meal">
          <Plus size={24} />
        </button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMeal ? 'Edit Meal' : 'Add Meal'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (editingMeal ? 'Update' : 'Add')}
            </button>
          </div>
        }
      >
        {!editingMeal && (
          <>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                className="form-control"
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Meal type *</label>
              <select className="form-control" value={formMealType} onChange={e => setFormMealType(e.target.value)}>
                {MEAL_TYPES.map(mt => (
                  <option key={mt.value} value={mt.value}>{mt.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="form-group">
          <label className="form-label">Cook</label>
          <select className="form-control" value={formCook} onChange={e => setFormCook(e.target.value)}>
            <option value="">-- No cook assigned --</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Meal description</label>
          <input
            className="form-control"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="e.g. Pasta with pesto"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <input
            className="form-control"
            value={formNote}
            onChange={e => setFormNote(e.target.value)}
            placeholder="Optional note"
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Meal"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</button>
          </div>
        }
      >
        <p>Are you sure you want to delete this meal? This cannot be undone.</p>
      </Modal>
    </>
  );
}
