'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pencil, UtensilsCrossed, MoreVertical,
  Calendar, ChefHat, Sun, Moon, Apple, Coffee,
} from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

// -- Types --

interface MealPlan {
  id: number;
  boat_id: number;
  date: string;
  meal_type: string;
  cook_user_id: number | null;
  cook_name: string | null;
  cook_avatar: string | null;
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

// -- Constants --

const MEAL_TYPES = [
  { value: 'breakfast' },
  { value: 'lunch' },
  { value: 'dinner' },
  { value: 'snack' },
];

const MEAL_TYPE_STYLES: Record<string, { bg: string; text: string; icon: typeof Sun }> = {
  breakfast: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: Sun },
  lunch: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: Coffee },
  dinner: { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: Moon },
  snack: { bg: 'bg-green-500/10', text: 'text-green-600', icon: Apple },
};

// -- Helpers --

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

function formatDateDisplay(dateStr: string): { day: string; monthYear: string; weekday: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
  const monthYear = d.toLocaleDateString('en-GB', { month: 'short' });
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  return { day, monthYear, weekday };
}

// -- Animations --

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

const statsVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
  },
};

// -- Component --

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
  useEffect(() => {
    if (meals.length > 0) {
      const dates = new Set<string>();
      for (const m of meals) {
        dates.add(m.date.substring(0, 10));
      }
      const sorted = Array.from(dates).sort();
      const start = new Date(sorted[0] + 'T00:00:00');
      const end = new Date(sorted[sorted.length - 1] + 'T00:00:00');
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

  // Stats
  const stats = useMemo(() => {
    const uniqueCooks = new Set(meals.filter(m => m.cook_user_id).map(m => m.cook_user_id));
    const uniqueDays = new Set(meals.map(m => m.date.substring(0, 10)));
    return {
      totalMeals: meals.length,
      cooks: uniqueCooks.size,
      days: uniqueDays.size,
    };
  }, [meals]);

  const boatUsers = users.filter(u => u.boat_id === activeBoat);

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UtensilsCrossed size={24} />
          {t('menu.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('menu.subtitle')}
        </p>
      </div>

      {/* Boat tabs */}
      {boats.length > 0 && (
        <div className="flex gap-1 mb-4 rounded-lg border border-border p-1 bg-muted/50">
          {boats.map(boat => (
            <Button
              key={boat.id}
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 rounded-md transition-all',
                activeBoat === boat.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              )}
              onClick={() => setActiveBoat(boat.id)}
            >
              {boat.name}
            </Button>
          ))}
        </div>
      )}

      {/* Stats cards */}
      {!loading && meals.length > 0 && (
        <motion.div
          className="grid grid-cols-3 gap-2 mb-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UtensilsCrossed size={14} className="text-primary" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('menu.meals')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.totalMeals}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <ChefHat size={14} className="text-amber-600" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('menu.cooks')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.cooks}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Calendar size={14} className="text-purple-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('menu.days')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.days}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      )}

      {/* Empty state */}
      {!loading && meals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <UtensilsCrossed size={32} className="text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold mb-1">{t('menu.noMealsYet')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('menu.startPlanning')}
          </p>
          <Button onClick={() => openAddModal()}>
            <Plus size={16} />
            {t('menu.addFirstMeal')}
          </Button>
        </div>
      )}

      {/* Calendar grid */}
      {!loading && meals.length > 0 && (
        <motion.div
          className="space-y-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {tripDates.map(date => {
              const dayMeals = mealsByDate[date] || [];
              const isToday = date === new Date().toISOString().substring(0, 10);
              const { day, monthYear, weekday } = formatDateDisplay(date);

              if (dayMeals.length === 0 && !isToday) return null;

              return (
                <motion.div
                  key={date}
                  variants={itemVariants}
                  layout
                  exit="exit"
                >
                  <Card
                    className={cn(
                      'py-0 overflow-hidden',
                      isToday && 'ring-1 ring-primary/30'
                    )}
                  >
                    <CardContent className="px-0 py-0">
                      {/* Day header */}
                      <div className={cn(
                        'flex items-center justify-between px-4 py-3',
                        dayMeals.length > 0 && 'border-b border-border'
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0',
                            isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}>
                            <span className="text-sm font-bold leading-none">{day}</span>
                            <span className="text-[9px] font-medium leading-none mt-0.5 uppercase">{monthYear}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{weekday}</div>
                            {isToday && (
                              <Badge variant="default" className="text-[0.6rem] px-1.5 py-0 mt-0.5">
                                {t('common.today')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => openAddModal(date)}
                          aria-label="Add meal"
                        >
                          <Plus size={14} />
                        </Button>
                      </div>

                      {/* Meals for this day */}
                      {dayMeals.length === 0 && (
                        <div className="px-4 py-3 text-xs text-muted-foreground italic">
                          {t('menu.noMealPlanned')}
                        </div>
                      )}

                      {dayMeals.map((meal, idx) => {
                        const style = MEAL_TYPE_STYLES[meal.meal_type] || MEAL_TYPE_STYLES.lunch;
                        const MealIcon = style.icon;

                        return (
                          <div
                            key={meal.id}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5',
                              idx < dayMeals.length - 1 && 'border-b border-border/50'
                            )}
                          >
                            {/* Meal type badge */}
                            <div className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 shrink-0',
                              style.bg
                            )}>
                              <MealIcon size={12} className={style.text} />
                              <span className={cn('text-[0.7rem] font-semibold', style.text)}>
                                {t(`menu.mealTypes.${meal.meal_type}`) || meal.meal_type}
                              </span>
                            </div>

                            {/* Meal details */}
                            <div className="flex-1 min-w-0">
                              {meal.meal_description && (
                                <div className="text-sm font-medium truncate">{meal.meal_description}</div>
                              )}
                              {meal.cook_name && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Avatar size="sm">
                                    {meal.cook_avatar && (
                                      <AvatarImage src={meal.cook_avatar} alt={meal.cook_name} />
                                    )}
                                    <AvatarFallback className={avatarColorClass(meal.cook_user_id || 1)}>
                                      {getInitials(meal.cook_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {meal.cook_name}
                                </div>
                              )}
                              {meal.note && (
                                <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                                  {meal.note}
                                </div>
                              )}
                            </div>

                            {/* Actions dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Actions"
                                >
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditModal(meal)}>
                                  <Pencil size={14} />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteConfirm(meal.id)}
                                >
                                  <Trash2 size={14} />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* FAB */}
      {!loading && activeBoat > 0 && (
        <motion.button
          className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform border-none cursor-pointer"
          onClick={() => openAddModal()}
          aria-label="Add meal"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', damping: 15, stiffness: 400 }}
        >
          <Plus size={24} />
        </motion.button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMeal ? t('menu.editMeal') : t('menu.addMeal')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : (editingMeal ? t('common.update') : t('common.add'))}
            </Button>
          </div>
        }
      >
        {!editingMeal && (
          <>
            <div className="space-y-2 mb-4">
              <Label>{t('menu.date')} *</Label>
              <Input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 mb-4">
              <Label>{t('menu.mealType')} *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formMealType}
                onChange={e => setFormMealType(e.target.value)}
              >
                {MEAL_TYPES.map(mt => (
                  <option key={mt.value} value={mt.value}>{t(`menu.mealTypes.${mt.value}`)}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="space-y-2 mb-4">
          <Label>{t('menu.cook')}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formCook}
            onChange={e => setFormCook(e.target.value)}
          >
            <option value="">{t('menu.noCookAssigned')}</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('menu.mealDescription')}</Label>
          <Input
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="e.g. Pasta with pesto"
          />
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('logbook.notes')}</Label>
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
        title={t('menu.deleteMeal')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t('common.delete')}</Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('menu.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
