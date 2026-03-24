'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Pencil, ShoppingCart, Check, ChevronDown, Package, CheckCircle2, ListTodo } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
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
  { value: 'groceries' },
  { value: 'fresh' },
  { value: 'drinks' },
  { value: 'alcohol' },
  { value: 'snacks' },
  { value: 'bbq' },
  { value: 'ice' },
  { value: 'hygiene' },
  { value: 'medicine' },
  { value: 'cleaning' },
  { value: 'boat_supplies' },
  { value: 'other' },
];

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

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export default function ShoppingPage() {
  const { t } = useI18n();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [activeBoat, setActiveBoat] = useState<number>(0);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_items: 0, bought_items: 0, totals: {} });
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<string>('all');

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

  // Filtered items based on active category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return items;
    return items.filter(item => item.category === activeCategory);
  }, [items, activeCategory]);

  // Group filtered items: unbought first, then bought
  const sortedItems = useMemo(() => {
    const unbought = filteredItems.filter(i => !i.is_bought);
    const bought = filteredItems.filter(i => i.is_bought);
    return [...unbought, ...bought];
  }, [filteredItems]);

  const boatUsers = users.filter(u => u.boat_id === activeBoat);
  const remaining = summary.total_items - summary.bought_items;

  // Unique categories present in the current item list (for filter pills)
  const presentCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category || 'other'));
    return CATEGORIES.filter(c => cats.has(c.value));
  }, [items]);

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart size={24} />
          {t('shopping.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('shopping.subtitle')}
        </p>
      </div>

      {/* Boat tabs */}
      {boats.length > 0 && (
        <div className="flex gap-1 mb-4 rounded-lg border border-border p-1 bg-muted/50">
          {boats.map(boat => (
            <button
              key={boat.id}
              onClick={() => setActiveBoat(boat.id)}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer border-none',
                activeBoat === boat.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground bg-transparent',
              )}
            >
              {boat.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats row */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <div className="text-lg font-bold text-primary">{summary.total_items}</div>
              <div className="text-[0.7rem] text-muted-foreground uppercase">{t('shopping.totalItems')}</div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <div className="text-lg font-bold text-green-600">{summary.bought_items}</div>
              <div className="text-[0.7rem] text-muted-foreground uppercase">{t('shopping.bought')}</div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <div className="text-lg font-bold">{remaining}</div>
              <div className="text-[0.7rem] text-muted-foreground uppercase">{t('common.remaining')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category filter pills */}
      {!loading && items.length > 0 && presentCategories.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer border-none',
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {t('common.all')}
          </button>
          {presentCategories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer border-none',
                activeCategory === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {t(`shopping.categories.${cat.value}`)}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10 text-muted-foreground">
          {t('common.loading')}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t('shopping.noItems')}</p>
          <Button className="mt-3" onClick={openAddModal}>
            {t('shopping.addFirstItem')}
          </Button>
        </div>
      )}

      {/* Item list */}
      {!loading && sortedItems.length > 0 && (
        <motion.div
          className="flex flex-col gap-1.5"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {sortedItems.map(item => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                exit="exit"
                layout
              >
                <Card className={cn(
                  'transition-opacity duration-200 py-0',
                  item.is_bought && 'opacity-60',
                )}>
                  <CardContent className="flex items-center gap-3.5 px-4 py-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleBought(item)}
                      className={cn(
                        'w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                        item.is_bought
                          ? 'border-success bg-success'
                          : 'border-border bg-transparent',
                      )}
                      aria-label={item.is_bought ? 'Mark as not bought' : 'Mark as bought'}
                    >
                      {item.is_bought && <Check size={16} className="text-white" />}
                    </button>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-semibold text-sm truncate',
                          item.is_bought && 'line-through',
                        )}>
                          {item.item_name}
                        </span>
                        {item.quantity && (
                          <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0 shrink-0">
                            x{item.quantity}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0 shrink-0">
                          {t(`shopping.categories.${item.category}`) || item.category}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        {item.price && (
                          <span className="font-medium">
                            {formatCurrency(parseFloat(item.price), item.currency)}
                          </span>
                        )}
                        {item.assigned_to_name && (
                          <span className="inline-flex items-center gap-1">
                            <Avatar className={cn('w-4 h-4 text-[8px]', avatarColorClass(item.assigned_to || 1))}>
                              {item.assigned_to_avatar && (
                                <AvatarImage src={item.assigned_to_avatar} alt={item.assigned_to_name} />
                              )}
                              <AvatarFallback className="text-[8px]">
                                {getInitials(item.assigned_to_name)}
                              </AvatarFallback>
                            </Avatar>
                            {item.assigned_to_name}
                          </span>
                        )}
                        {item.is_bought && item.bought_by_name && (
                          <span className="text-success">
                            {t('shopping.boughtBy', { name: item.bought_by_name })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Actions"
                        >
                          <ChevronDown size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                        >
                          <Pencil size={14} />
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(item.id);
                          }}
                        >
                          <Trash2 size={14} />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Filtered empty state */}
      {!loading && items.length > 0 && sortedItems.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t('shopping.noItemsInCategory')}</p>
        </div>
      )}

      {/* FAB */}
      {!loading && activeBoat > 0 && (
        <button
          onClick={openAddModal}
          aria-label="Add item"
          className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform border-none cursor-pointer"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? t('shopping.editItem') : t('shopping.addItem')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? t('common.saving') : (editingItem ? t('common.update') : t('common.add'))}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 mb-4">
          <Label>{t('shopping.itemName')} *</Label>
          <Input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Sunscreen"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 mb-4">
            <Label>{t('shopping.quantity')}</Label>
            <Input
              value={formQuantity}
              onChange={e => setFormQuantity(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
          <div className="space-y-2 mb-4">
            <Label>{t('wallet.category')}</Label>
            <select
              className={selectClassName}
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{t(`shopping.categories.${c.value}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('shopping.assignTo')}</Label>
          <select
            className={selectClassName}
            value={formAssignedTo}
            onChange={e => setFormAssignedTo(e.target.value)}
          >
            <option value="">{t('shopping.anyone')}</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div className="space-y-2 mb-4">
            <Label>{t('shopping.price')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formPrice}
              onChange={e => setFormPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2 mb-4">
            <Label>{t('wallet.currency')}</Label>
            <select
              className={selectClassName}
              value={formCurrency}
              onChange={e => setFormCurrency(e.target.value)}
            >
              {(() => {
                let codes = ['EUR', 'CZK', 'USD', 'GBP'];
                if (typeof document !== 'undefined') {
                  try {
                    const m = document.querySelector('meta[name="allowed-currencies"]');
                    const a = m ? JSON.parse(m.getAttribute('content') || '[]') : [];
                    if (a.length > 0) codes = a;
                  } catch { /* */ }
                }
                return codes.map((c: string) => <option key={c} value={c}>{c}</option>);
              })()}
            </select>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('shopping.note')}</Label>
          <Input
            value={formNote}
            onChange={e => setFormNote(e.target.value)}
            placeholder={t('menu.optionalNote')}
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={t('shopping.deleteItem')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('shopping.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
