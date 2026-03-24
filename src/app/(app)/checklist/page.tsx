'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Shirt, Wrench, Star } from 'lucide-react';
import { Modal } from '@/components/Modal';

interface ChecklistItem {
  id: number;
  item_name: string;
  category: string;
  description: string | null;
  sort_order: number;
}

const CATEGORIES = [
  { value: 'required', label: 'Required', color: 'var(--color-danger)', bg: 'var(--color-danger-bg, rgba(255,59,48,0.1))', Icon: ShieldCheck },
  { value: 'clothing', label: 'Clothing', color: 'var(--color-info)', bg: 'var(--color-info-bg, rgba(0,122,255,0.1))', Icon: Shirt },
  { value: 'gear', label: 'Gear', color: 'var(--color-warning)', bg: 'var(--color-warning-bg, rgba(255,149,0,0.1))', Icon: Wrench },
  { value: 'recommended', label: 'Recommended', color: 'var(--color-success)', bg: 'var(--color-success-bg, rgba(52,199,89,0.1))', Icon: Star },
] as const;

function getCategoryConfig(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[3];
}

async function apiCall(url: string, method = 'GET', data?: unknown) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const options: RequestInit = {
    method,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
  };
  if (data && method !== 'GET') options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  return res.json();
}

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('required');
  const [formDescription, setFormDescription] = useState('');

  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await apiCall('/api/checklist?action=list');
    if (res.success) {
      setItems(res.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openAddModal() {
    setEditingItem(null);
    setFormName('');
    setFormCategory('required');
    setFormDescription('');
    setShowModal(true);
  }

  function openEditModal(item: ChecklistItem) {
    setEditingItem(item);
    setFormName(item.item_name);
    setFormCategory(item.category);
    setFormDescription(item.description || '');
    setShowModal(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const payload = editingItem
      ? { action: 'edit', id: editingItem.id, item_name: formName.trim(), category: formCategory, description: formDescription.trim() || null }
      : { action: 'add', item_name: formName.trim(), category: formCategory, description: formDescription.trim() || null };

    const res = await apiCall('/api/checklist', 'POST', payload);
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      loadItems();
    } else {
      alert(res.error);
    }
  }

  async function handleDelete() {
    if (!deleteItemId) return;
    setSaving(true);
    const res = await apiCall('/api/checklist', 'POST', {
      action: 'delete',
      id: deleteItemId,
    });
    setSaving(false);
    if (res.success) {
      setDeleteItemId(null);
      loadItems();
    } else {
      alert(res.error);
    }
  }

  // Group items by category
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: items.filter(i => i.category === cat.value),
  })).filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Checklist</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Checklist</h1>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--card-pad-spacious)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            No checklist items yet. Tap + to add one.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(group => {
            const GroupIcon = group.Icon;
            return (
              <div key={group.value}>
                {/* Category header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}>
                  <span
                    className="badge"
                    style={{
                      background: group.bg,
                      color: group.color,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <GroupIcon size={13} />
                    {group.label}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Items */}
                <div className="card">
                  <div className="card-body" style={{ padding: 0 }}>
                    {group.items.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px var(--card-pad, 16px)',
                          borderBottom: idx < group.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                          {item.description && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.item_name}`}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteItemId(item.id)}
                            aria-label={`Delete ${item.item_name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={openAddModal} aria-label="Add item">
        <Plus size={24} />
      </button>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Item' : 'Add Item'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Item Name</label>
          <input
            className="form-control"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Passport"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="form-control"
            value={formCategory}
            onChange={e => setFormCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <input
            className="form-control"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="e.g. Make sure it's valid for 6 months"
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteItemId !== null}
        onClose={() => setDeleteItemId(null)}
        title="Delete Item"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteItemId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <p>Are you sure you want to delete this item?</p>
      </Modal>
    </>
  );
}
