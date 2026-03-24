'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, ShieldCheck, Shirt, Wrench, Star, Smartphone, Droplets, Heart, UtensilsCrossed, Gamepad2, User, Ship, Users } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface ChecklistItem {
  id: number;
  item_name: string;
  category: string;
  description: string | null;
  sort_order: number;
  scope?: 'personal' | 'boat' | 'trip';
}

type Scope = 'personal' | 'boat' | 'trip';

const SCOPES: { id: Scope; Icon: typeof User }[] = [
  { id: 'personal', Icon: User },
  { id: 'boat',     Icon: Ship },
  { id: 'trip',     Icon: Users },
];

const CATEGORIES = [
  { value: 'required',    color: 'text-destructive',      bg: 'bg-destructive/10',     Icon: ShieldCheck },
  { value: 'clothing',    color: 'text-info',             bg: 'bg-info-subtle',        Icon: Shirt },
  { value: 'gear',        color: 'text-warning',          bg: 'bg-warning-subtle',     Icon: Wrench },
  { value: 'electronics', color: 'text-blue-500',         bg: 'bg-blue-500/10',        Icon: Smartphone },
  { value: 'toiletries',  color: 'text-pink-500',         bg: 'bg-pink-500/10',        Icon: Droplets },
  { value: 'first_aid',   color: 'text-red-500',          bg: 'bg-red-500/10',         Icon: Heart },
  { value: 'galley',      color: 'text-amber-600',        bg: 'bg-amber-500/10',       Icon: UtensilsCrossed },
  { value: 'fun',         color: 'text-emerald-500',      bg: 'bg-emerald-500/10',     Icon: Gamepad2 },
  { value: 'recommended', color: 'text-success',          bg: 'bg-success-subtle',     Icon: Star },
] as const;

function getCategoryConfig(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
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

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

export default function ChecklistPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScope, setActiveScope] = useState<Scope>('trip');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('required');
  const [formDescription, setFormDescription] = useState('');
  const [formScope, setFormScope] = useState<Scope>('trip');

  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await apiCall('/api/checklist?action=list&scope=' + activeScope);
    if (res.success) {
      setItems(res.data.items);
    }
    setLoading(false);
  }, [activeScope]);

  useEffect(() => {
    setLoading(true);
    loadItems();
  }, [loadItems]);

  function openAddModal() {
    setEditingItem(null);
    setFormName('');
    setFormCategory('required');
    setFormDescription('');
    setFormScope(activeScope);
    setShowModal(true);
  }

  function openEditModal(item: ChecklistItem) {
    setEditingItem(item);
    setFormName(item.item_name);
    setFormCategory(item.category);
    setFormDescription(item.description || '');
    setFormScope(item.scope || 'trip');
    setShowModal(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const payload = editingItem
      ? { action: 'edit', id: editingItem.id, item_name: formName.trim(), category: formCategory, description: formDescription.trim() || null, scope: formScope }
      : { action: 'add', item_name: formName.trim(), category: formCategory, description: formDescription.trim() || null, scope: formScope };

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('checklist.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('checklist.title')}</h1>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-1 mb-4 rounded-lg border border-border p-1 bg-muted/50">
        {SCOPES.map(s => {
          const ScopeIcon = s.Icon;
          return (
            <button
              key={s.id}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer',
                activeScope === s.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveScope(s.id)}
            >
              <ScopeIcon size={14} />
              {t(`checklist.scopes.${s.id}`)}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card className="py-0">
          <CardContent className="px-6 py-8 text-center text-muted-foreground/60">
            {t('checklist.noItems')}
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="flex flex-col gap-5"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {grouped.map(group => {
            const GroupIcon = group.Icon;
            return (
              <motion.div key={group.value} variants={itemVariants}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-semibold text-xs flex items-center gap-1 border-transparent',
                      group.bg, group.color,
                    )}
                  >
                    <GroupIcon size={13} />
                    {t(`checklist.categories.${group.value}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground/60">
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Items */}
                <Card className="py-0 overflow-hidden">
                  <CardContent className="p-0">
                    <AnimatePresence initial={false}>
                      {group.items.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          variants={itemVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                        >
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium flex items-center gap-1.5">
                                {item.item_name}
                                {item.scope === 'personal' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">{t('checklist.scopes.personal')}</Badge>
                                )}
                                {item.scope === 'boat' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">{t('checklist.scopes.boat')}</Badge>
                                )}
                              </div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => openEditModal(item)}
                                aria-label={`Edit ${item.item_name}`}
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteItemId(item.id)}
                                aria-label={`Delete ${item.item_name}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          {idx < group.items.length - 1 && <Separator />}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* FAB */}
      <motion.button
        className="fixed bottom-24 right-5 md:bottom-8 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer border-none z-40"
        onClick={openAddModal}
        aria-label="Add item"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', damping: 15, stiffness: 400 }}
      >
        <Plus size={24} />
      </motion.button>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? t('checklist.editItem') : t('checklist.addItem')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-name">{t('checklist.itemName')}</Label>
            <Input
              id="item-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. Passport"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-category">{t('wallet.category')}</Label>
            <select
              id="item-category"
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{t(`checklist.categories.${c.value}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('checklist.scope')}</Label>
            <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/50">
              {SCOPES.map(s => {
                const ScopeIcon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer',
                      formScope === s.id
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setFormScope(s.id)}
                  >
                    <ScopeIcon size={14} />
                    {t(`checklist.scopes.${s.id}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-description">{t('checklist.description')}</Label>
            <Input
              id="item-description"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder={t('checklist.descriptionPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteItemId !== null}
        onClose={() => setDeleteItemId(null)}
        title={t('common.delete')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteItemId(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('checklist.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
