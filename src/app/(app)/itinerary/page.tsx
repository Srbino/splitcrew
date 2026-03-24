'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sailboat, Anchor, Car, MapPin, Calendar, Plus, Pencil, Trash2, MoreVertical,
} from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn, formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface ItineraryDay {
  id: number;
  day_number: number;
  date: string;
  title: string;
  description: string | null;
  type: string;
  location_from: string | null;
  location_to: string | null;
  sort_order: number;
}

const TYPE_CONFIG: Record<string, {
  dotColor: string;
  badgeClass: string;
  Icon: typeof Sailboat;
}> = {
  sailing: {
    dotColor: 'bg-info',
    badgeClass: 'bg-info/10 text-info border-info/20',
    Icon: Sailboat,
  },
  port: {
    dotColor: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
    Icon: Anchor,
  },
  car: {
    dotColor: 'bg-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    Icon: Car,
  },
};

const TYPE_OPTIONS = [
  { value: 'sailing' },
  { value: 'port' },
  { value: 'car' },
];

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
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
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

export default function ItineraryPage() {
  const { t } = useI18n();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocationFrom, setFormLocationFrom] = useState('');
  const [formLocationTo, setFormLocationTo] = useState('');
  const [formType, setFormType] = useState('sailing');
  const [formSortOrder, setFormSortOrder] = useState(0);

  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDays = useCallback(async () => {
    const res = await apiCall('/api/itinerary?action=list');
    if (res.success) {
      setDays(res.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  function openAddModal() {
    setEditingDay(null);
    setFormDate('');
    setFormTitle('');
    setFormDescription('');
    setFormLocationFrom('');
    setFormLocationTo('');
    setFormType('sailing');
    // Auto-increment sort order
    const maxSort = days.length > 0 ? Math.max(...days.map(d => d.sort_order)) : 0;
    setFormSortOrder(maxSort + 1);
    setShowModal(true);
  }

  function openEditModal(day: ItineraryDay) {
    setEditingDay(day);
    // Format date for input (YYYY-MM-DD)
    const dateVal = day.date ? day.date.substring(0, 10) : '';
    setFormDate(dateVal);
    setFormTitle(day.title);
    setFormDescription(day.description || '');
    setFormLocationFrom(day.location_from || '');
    setFormLocationTo(day.location_to || '');
    setFormType(day.type);
    setFormSortOrder(day.sort_order);
    setShowModal(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);

    const payload = editingDay
      ? {
          action: 'edit',
          id: editingDay.id,
          date: formDate,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          location_from: formLocationFrom.trim() || null,
          location_to: formLocationTo.trim() || null,
          type: formType,
          sort_order: formSortOrder,
          day_number: editingDay.day_number,
        }
      : {
          action: 'add',
          date: formDate,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          location_from: formLocationFrom.trim() || null,
          location_to: formLocationTo.trim() || null,
          type: formType,
          sort_order: formSortOrder,
        };

    const res = await apiCall('/api/itinerary', 'POST', payload);
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      loadDays();
    } else {
      alert(res.error);
    }
  }

  async function handleDelete() {
    if (!deleteItemId) return;
    setSaving(true);
    const res = await apiCall('/api/itinerary', 'POST', {
      action: 'delete',
      id: deleteItemId,
    });
    setSaving(false);
    if (res.success) {
      setDeleteItemId(null);
      loadDays();
    } else {
      alert(res.error);
    }
  }

  if (loading) {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('itinerary.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('itinerary.title')}</h1>
      </div>

      {days.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('itinerary.noItinerary')}
          </CardContent>
        </Card>
      ) : (
        <div className="relative pl-10">
          {/* Timeline line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 rounded-full bg-border" />

          <motion.div
            className="flex flex-col gap-4"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence initial={false}>
              {days.map((day) => {
                const config = TYPE_CONFIG[day.type] || TYPE_CONFIG.port;
                const TypeIcon = config.Icon;

                return (
                  <motion.div
                    key={day.id}
                    className="relative"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    {/* Timeline icon */}
                    <div className="absolute -left-10 top-3.5 z-[1] h-7 w-7 rounded-full bg-background flex items-center justify-center border-2 border-border shadow-sm">
                      <TypeIcon size={14} className={cn(
                        day.type === 'sailing' ? 'text-info' :
                        day.type === 'port' ? 'text-success' : 'text-muted-foreground'
                      )} />
                    </div>

                    <Card className="py-0">
                      <CardContent className="p-5">
                        {/* Date, type badge, and actions menu */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3.5" />
                            {formatDate(day.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[0.7rem] font-semibold capitalize',
                                config.badgeClass
                              )}
                            >
                              <TypeIcon className="size-3" />
                              {t(`itinerary.types.${day.type}`)}
                            </Badge>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-xs" className="ml-1" aria-label="Actions">
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditModal(day)}>
                                  <Pencil className="size-3.5 mr-2" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteItemId(day.id)}
                                >
                                  <Trash2 className="size-3.5 mr-2" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="mb-1 text-[1.05rem] font-semibold leading-snug">
                          {day.title}
                        </h3>

                        {/* From -> To (clickable Google Maps) */}
                        {(day.location_from || day.location_to) && (
                          <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            {day.location_from && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.location_from)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:text-primary hover:underline transition-colors"
                              >
                                {day.location_from}
                              </a>
                            )}
                            {day.location_from && day.location_to && (
                              <span>&rarr;</span>
                            )}
                            {day.location_to && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.location_to)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:text-primary hover:underline transition-colors"
                              >
                                {day.location_to}
                              </a>
                            )}
                          </div>
                        )}

                        {/* Description */}
                        {day.description && (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {day.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* FAB */}
      <motion.button
        className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer border-none"
        onClick={openAddModal}
        aria-label="Add itinerary day"
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
        title={editingDay ? t('itinerary.editDay') : t('itinerary.addDay')}
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
            <Label htmlFor="day-date">{t('logbook.date')}</Label>
            <Input
              id="day-date"
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-title">{t('itinerary.dayTitle')}</Label>
            <Input
              id="day-title"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder={t('itinerary.dayTitlePlaceholder')}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-type">{t('itinerary.dayType')}</Label>
            <select
              id="day-type"
              value={formType}
              onChange={e => setFormType(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(`itinerary.types.${opt.value}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-location-from">{t('itinerary.locationFrom')}</Label>
            <Input
              id="day-location-from"
              value={formLocationFrom}
              onChange={e => setFormLocationFrom(e.target.value)}
              placeholder={t('itinerary.locationFromPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-location-to">{t('itinerary.locationTo')}</Label>
            <Input
              id="day-location-to"
              value={formLocationTo}
              onChange={e => setFormLocationTo(e.target.value)}
              placeholder={t('itinerary.locationToPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-description">{t('checklist.description')}</Label>
            <Textarea
              id="day-description"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder={t('itinerary.descriptionPlaceholder')}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-sort-order">{t('itinerary.sortOrder')}</Label>
            <Input
              id="day-sort-order"
              type="number"
              value={formSortOrder}
              onChange={e => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
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
          {t('itinerary.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
