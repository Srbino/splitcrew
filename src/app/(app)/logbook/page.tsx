'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pencil, Navigation, Anchor, ArrowRight,
  BookOpen, BarChart3, Trophy, MoreVertical,
} from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

// ── Types ──

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
  skipper_avatar: string | null;
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

// ── Helpers ──

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
  return time.substring(0, 5);
}

// ── Animations ──

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

// ── Component ──

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
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Navigation size={24} />
          {t('logbook.title')}
        </h1>
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
      {!loading && entries.length > 0 && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Navigation size={14} className="text-primary" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('logbook.totalMiles')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.total_nm}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-success-subtle flex items-center justify-center">
                    <BookOpen size={14} className="text-success" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('logbook.entries')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.total_days}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-warning-subtle flex items-center justify-center">
                    <Trophy size={14} className="text-warning" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('logbook.maxNm')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.max_nm}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={statsVariants}>
            <Card className="py-0">
              <CardContent className="px-3 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <BarChart3 size={14} className="text-purple-500" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase">{t('logbook.avgNm')}</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.avg_nm}</div>
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
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Anchor size={32} className="text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold mb-1">{t('logbook.noEntries')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('logbook.startTracking')}
          </p>
          <Button onClick={openAddModal}>
            <Plus size={16} />
            {t('logbook.addFirstEntry')}
          </Button>
        </div>
      )}

      {/* Entries list */}
      {!loading && entries.length > 0 && (
        <motion.div
          className="space-y-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {entries.map(entry => {
              const nm = parseFloat(entry.nautical_miles) || 0;
              return (
                <motion.div
                  key={entry.id}
                  variants={itemVariants}
                  layout
                  exit="exit"
                >
                  <Card className="py-0">
                    <CardContent className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* NM badge */}
                        <div className="shrink-0 mt-0.5">
                          <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1">
                            <span className="text-sm font-bold text-primary tabular-nums">{nm}</span>
                            <span className="text-[10px] font-semibold text-primary/70 uppercase">{t('logbook.nm')}</span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">
                            {formatDateDisplay(entry.date.substring(0, 10))}
                          </div>

                          {(entry.location_from || entry.location_to) && (
                            <div className="text-sm flex items-center gap-1 flex-wrap mt-0.5">
                              {entry.location_from && (
                                <span>{entry.location_from}</span>
                              )}
                              {entry.location_from && entry.location_to && (
                                <ArrowRight size={14} className="text-muted-foreground" />
                              )}
                              {entry.location_to && (
                                <span>{entry.location_to}</span>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                            {(entry.departure_time || entry.arrival_time) && (
                              <span>
                                {formatTime(entry.departure_time)}
                                {entry.departure_time && entry.arrival_time ? ' - ' : ''}
                                {formatTime(entry.arrival_time)}
                              </span>
                            )}
                            {entry.skipper_name && (
                              <span className="inline-flex items-center gap-1">
                                <Avatar size="sm">
                                  {entry.skipper_avatar && (
                                    <AvatarImage src={entry.skipper_avatar} alt={entry.skipper_name} />
                                  )}
                                  <AvatarFallback className={avatarColorClass(entry.skipper_user_id || 1)}>
                                    {getInitials(entry.skipper_name)}
                                  </AvatarFallback>
                                </Avatar>
                                {entry.skipper_name}
                              </span>
                            )}
                          </div>

                          {entry.note && (
                            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                              {entry.note}
                            </p>
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
                            <DropdownMenuItem onClick={() => openEditModal(entry)}>
                              <Pencil size={14} />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirm(entry.id)}
                            >
                              <Trash2 size={14} />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
          onClick={openAddModal}
          aria-label="Add entry"
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
        title={editingEntry ? t('logbook.editEntry') : t('logbook.addEntry')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !formDate}>
              {saving ? t('common.saving') : (editingEntry ? t('common.update') : t('common.add'))}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 mb-4">
          <Label>{t('logbook.date')} *</Label>
          <Input
            type="date"
            value={formDate}
            onChange={e => setFormDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 mb-4">
            <Label>{t('logbook.from')}</Label>
            <Input
              value={formFrom}
              onChange={e => setFormFrom(e.target.value)}
              placeholder="e.g. Split"
            />
          </div>
          <div className="space-y-2 mb-4">
            <Label>{t('logbook.to')}</Label>
            <Input
              value={formTo}
              onChange={e => setFormTo(e.target.value)}
              placeholder="e.g. Hvar"
            />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('logbook.nauticalMiles')}</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formNm}
            onChange={e => setFormNm(e.target.value)}
            placeholder="0.0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 mb-4">
            <Label>{t('logbook.departure')}</Label>
            <Input
              type="time"
              value={formDeparture}
              onChange={e => setFormDeparture(e.target.value)}
            />
          </div>
          <div className="space-y-2 mb-4">
            <Label>{t('logbook.arrival')}</Label>
            <Input
              type="time"
              value={formArrival}
              onChange={e => setFormArrival(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('logbook.skipper')}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formSkipper}
            onChange={e => setFormSkipper(e.target.value)}
          >
            <option value="">{t('logbook.noSkipper')}</option>
            {boatUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('logbook.notes')}</Label>
          <Input
            value={formNote}
            onChange={e => setFormNote(e.target.value)}
            placeholder={t('logbook.notePlaceholder')}
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={t('logbook.deleteEntry')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t('common.delete')}</Button>
          </div>
        }
      >
        <p>{t('logbook.confirmDelete')}</p>
      </Modal>
    </>
  );
}
