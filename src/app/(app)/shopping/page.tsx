'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, ShoppingCart, Check } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { useI18n } from '@/lib/i18n/context';
import { formatCurrency } from '@/lib/currencies';

interface ShoppingItem {
  id: number;
  boat_id: number;
  category: string;
  item_name: string;
  quantity: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_to_avatar: string | null;
  price: string | null;
  currency: string;
  note: string | null;
  is_bought: boolean;
  bought_by: number | null;
  bought_by_name: string | null;
  bought_by_avatar: string | null;
  created_by: number | null;
  created_by_name: string | null;
}

interface Summary {
  total_items: number;
  bought_items: number;
  totals: Record<string, number>;
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

const CATEGORIES = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Groceries',
  drinks: 'Drinks',
  alcohol: 'Alcohol',
  hygiene: 'Hygiene',
  medicine: 'Medicine',
  other: 'Other',
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

export default function ShoppingPage() {
  const { t } = useI18n();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [activeBoat, setActiveBoat] = useState<number>(0);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_items: 0, bought_items: 0, totals: {} });
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formAssignedTo, setFormAssignedTo] = useState<string>('');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState('EUR');
  const [formNote, setFormNote] = useState('');

  // Load boats
  useEffect(() => {
    async function loadBoats() {
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
        // Build boat list from user data - users endpoint returns boat_name
        // We need boat ids - extract from user data
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
    loadBoats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadItems = useCallback(async () => {
    if (!activeBoat) return;
    setLoading(true);
    const res = await apiCall(`/api/shopping?action=list&boat_id=${activeBoat}`);
    if (res.success) {
      setItems(res.data.items);
      setSummary(res.data.summary);
    }
    setLoading(false);
  }, [activeBoat]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openAddModal() {
    setEditingItem(null);
    setFormName('');
    setFormQuantity('');
    setFormCategory('other');
    setFormAssignedTo('');
    setFormPrice('');
    setFormCurrency('EUR');
    setFormNote('');
    setModalOpen(true);
  }

  function openEditModal(item: ShoppingItem) {
    setEditingItem(item);
    setFormName(item.item_name);
    setFormQuantity(item.quantity || '');
    setFormCategory(item.category);
    setFormAssignedTo(item.assigned_to ? String(item.assigned_to) : '');
    setFormPrice(item.price || '');
    setFormCurrency(item.currency);
    setFormNote(item.note || '');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const payload: any = {
      item_name: formName.trim(),
      quantity: formQuantity || null,
      category: formCategory,
      assigned_to: formAssignedTo ? parseInt(formAssignedTo) : null,
      price: formPrice ? parseFloat(formPrice) : null,
      currency: formCurrency,
      note: formNote || null,
    };

    if (editingItem) {
      payload.action = 'edit';
      payload.id = editingItem.id;
    } else {
      payload.action = 'add';
      payload.boat_id = activeBoat;
    }

    const res = await apiCall('/api/shopping', 'POST', payload);
    if (res.success) {
      setModalOpen(false);
      loadItems();
    }
    setSaving(false);
  }

  async function handleToggleBought(item: ShoppingItem) {
    await apiCall('/api/shopping', 'POST', {
      action: 'toggle_bought',
      id: item.id,
      is_bought: !item.is_bought,
    });
    loadItems();
  }

  async function handleDelete(id: number) {
    await apiCall('/api/shopping', 'POST', { action: 'delete', id });
    setDeleteConfirm(null);
    loadItems();
  }

  // Group items by category
  const grouped = items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const boatUsers = users.filter(u => u.boat_id === activeBoat);

  const summaryParts: string[] = [
    `${summary.total_items} items`,
    `${summary.bought_items} purchased`,
  ];
  for (const [cur, total] of Object.entries(summary.totals)) {
    summaryParts.push(formatCurrency(total, cur));
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <ShoppingCart size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Shopping
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

      {/* Summary bar */}
      {items.length > 0 && (
        <div
          className="card"
          style={{ marginBottom: 16 }}
        >
          <div className="card-body" style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {summaryParts.join(' \u00b7 ')}
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
      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No shopping items yet</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddModal}>
            Add first item
          </button>
        </div>
      )}

      {/* Items grouped by category */}
      {!loading && Object.keys(grouped).map(category => (
        <div key={category} style={{ marginBottom: 20 }}>
          <h3 style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-tertiary)',
            marginBottom: 8,
            paddingLeft: 4,
          }}>
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grouped[category].map(item => (
              <div
                key={item.id}
                className="card"
                style={{
                  opacity: item.is_bought ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="card-body" style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleBought(item)}
                    style={{
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      borderRadius: 8,
                      border: item.is_bought
                        ? '2px solid var(--color-success)'
                        : '2px solid var(--color-border)',
                      background: item.is_bought ? 'var(--color-success)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-label={item.is_bought ? 'Mark as not bought' : 'Mark as bought'}
                  >
                    {item.is_bought && <Check size={16} color="white" />}
                  </button>

                  {/* Item details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      textDecoration: item.is_bought ? 'line-through' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.item_name}
                      {item.quantity && (
                        <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {item.price && (
                        <span>{formatCurrency(parseFloat(item.price), item.currency)}</span>
                      )}
                      {item.assigned_to_name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Avatar name={item.assigned_to_name} avatar={item.assigned_to_avatar} size="sm" userId={item.assigned_to || 1} />
                          {item.assigned_to_name}
                        </span>
                      )}
                      {item.is_bought && item.bought_by_name && (
                        <span style={{ color: 'var(--color-success)' }}>
                          Bought by {item.bought_by_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(item)}
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteConfirm(item.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* FAB */}
      {!loading && activeBoat > 0 && (
        <button className="fab" onClick={openAddModal} aria-label="Add item">
          <Plus size={24} />
        </button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Item' : 'Add Item'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? 'Saving...' : (editingItem ? 'Update' : 'Add')}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Item name *</label>
          <input
            className="form-control"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Sunscreen"
            autoFocus
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              className="form-control"
              value={formQuantity}
              onChange={e => setFormQuantity(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Assigned to</label>
          <select className="form-control" value={formAssignedTo} onChange={e => setFormAssignedTo(e.target.value)}>
            <option value="">-- Anyone --</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Price</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              min="0"
              value={formPrice}
              onChange={e => setFormPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-control" value={formCurrency} onChange={e => setFormCurrency(e.target.value)}>
              <option value="EUR">EUR</option>
              <option value="CZK">CZK</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
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
        title="Delete Item"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</button>
          </div>
        }
      >
        <p>Are you sure you want to delete this item? This cannot be undone.</p>
      </Modal>
    </>
  );
}
