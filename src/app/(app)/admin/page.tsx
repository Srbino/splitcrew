'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Users, Ship, Database,
  Edit2, Trash2, Plus, Lock, KeyRound,
  Download, RefreshCw, BarChart3,
} from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials, avatarColorClass, formatDateTime } from '@/lib/utils';
import { CURRENCY_CODES, CURRENCIES, formatCurrency } from '@/lib/currencies';
import { LOCALES } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/context';

// ── Types ──

interface UserData {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  boat_id: number;
  boat_name: string;
}

interface BoatData {
  id: number;
  name: string;
  emoji: string;
  color: string;
  crew_count?: number;
}

const BOAT_EMOJIS = ['⛵', '🚢', '🛥️', '⚓', '🌊', '🏴‍☠️', '🐬', '🦈', '🌴', '🗺️', '🚤', '🛶'];
const BOAT_COLORS = [
  { value: 'blue', label: 'Blue', tw: 'bg-blue-500' },
  { value: 'teal', label: 'Teal', tw: 'bg-teal-500' },
  { value: 'purple', label: 'Purple', tw: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', tw: 'bg-orange-500' },
  { value: 'rose', label: 'Rose', tw: 'bg-rose-500' },
  { value: 'emerald', label: 'Emerald', tw: 'bg-emerald-500' },
  { value: 'amber', label: 'Amber', tw: 'bg-amber-500' },
  { value: 'slate', label: 'Slate', tw: 'bg-slate-500' },
];
const APP_ICONS = ['⛵', '🚢', '🌊', '⚓', '🏴‍☠️', '🗺️', '🧭', '🐬', '🌴', '☀️', '🏝️', '🎣'];

interface SettingsData {
  trip_name: string;
  trip_date_from: string;
  trip_date_to: string;
  base_currency: string;
  language: string;
  app_icon: string;
}

interface RateData {
  base_currency: string;
  rates: Record<string, number>;
}

interface StatsData {
  totalExpenses: number;
  expenseCount: number;
  totalNm: number;
  logbookEntries: number;
  crewCount: number;
  boatCount: number;
  baseCurrency: string;
  categoryCounts: Record<string, number>;
}

interface AuditEntry {
  id: number;
  expense_id: number;
  changed_by_name: string | null;
  change_type: string;
  changed_at: string;
  description: string | null;
}

interface SettlementAuditEntry {
  id: number;
  from_name: string;
  to_name: string;
  action: string;
  performer_name: string | null;
  performer_role: string | null;
  created_at: string;
}

type TabKey = 'settings' | 'users' | 'boats' | 'data';

// ── API helper ──

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

// ── Constants ──

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const TABS: { key: TabKey; labelKey: string; icon: typeof Settings }[] = [
  { key: 'settings', labelKey: 'admin.settings', icon: Settings },
  { key: 'users', labelKey: 'admin.users', icon: Users },
  { key: 'boats', labelKey: 'admin.boats', icon: Ship },
  { key: 'data', labelKey: 'admin.data', icon: Database },
];

const TOP_CURRENCIES = ['EUR', 'USD', 'CZK', 'GBP', 'CHF'];

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & Drinks',
  transport: 'Transport',
  marina: 'Marina & Mooring',
  fuel: 'Fuel',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  accommodation: 'Accommodation',
  other: 'Other',
};

// ── Download helper ──

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──

export default function AdminPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('settings');

  // ── Settings state ──
  const [settings, setSettings] = useState<SettingsData>({
    trip_name: '',
    trip_date_from: '',
    trip_date_to: '',
    base_currency: 'EUR',
    language: 'en',
    app_icon: '⛵',
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsIsError, setSettingsIsError] = useState(false);

  // ── Users state ──
  const [users, setUsers] = useState<UserData[]>([]);
  const [boats, setBoats] = useState<BoatData[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Add/Edit User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBoatId, setFormBoatId] = useState(0);
  const [formRole, setFormRole] = useState<'crew' | 'captain'>('crew');
  const [formPassword, setFormPassword] = useState('');
  const [userSaving, setUserSaving] = useState(false);

  // Reset Password modal
  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);

  // Delete User modal
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);

  // ── Boats state ──
  const [boatsDetailed, setBoatsDetailed] = useState<BoatData[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(true);
  const [boatEditValues, setBoatEditValues] = useState<Record<number, string>>({});
  const [boatEmojiValues, setBoatEmojiValues] = useState<Record<number, string>>({});
  const [boatColorValues, setBoatColorValues] = useState<Record<number, string>>({});
  const [boatSaving, setBoatSaving] = useState<number | null>(null);
  const [showAddBoat, setShowAddBoat] = useState(false);
  const [newBoatName, setNewBoatName] = useState('');
  const [newBoatEmoji, setNewBoatEmoji] = useState('⛵');
  const [newBoatColor, setNewBoatColor] = useState('blue');
  const [deleteBoatId, setDeleteBoatId] = useState<number | null>(null);

  // ── Data state ──
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [syncingRates, setSyncingRates] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [rateData, setRateData] = useState<RateData | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{ expense_audits: AuditEntry[]; settlement_audits: SettlementAuditEntry[] } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Data loaders ──

  const loadSettings = useCallback(async () => {
    const res = await apiCall('/api/admin/settings');
    if (res.success) {
      setSettings({
        trip_name: res.data.trip_name,
        trip_date_from: res.data.trip_date_from,
        trip_date_to: res.data.trip_date_to,
        base_currency: res.data.base_currency,
        language: res.data.language,
        app_icon: res.data.app_icon || '⛵',
      });
    }
    setSettingsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await apiCall('/api/admin/users');
    if (res.success) {
      setUsers(res.data.users);
      setBoats(res.data.boats);
    }
    setUsersLoading(false);
  }, []);

  const loadBoats = useCallback(async () => {
    const res = await apiCall('/api/admin/boats');
    if (res.success) {
      setBoatsDetailed(res.data.boats);
      const nameMap: Record<number, string> = {};
      const emojiMap: Record<number, string> = {};
      const colorMap: Record<number, string> = {};
      for (const b of res.data.boats) {
        nameMap[b.id] = b.name;
        emojiMap[b.id] = b.emoji || '⛵';
        colorMap[b.id] = b.color || 'blue';
      }
      setBoatEditValues(nameMap);
      setBoatEmojiValues(emojiMap);
      setBoatColorValues(colorMap);
    }
    setBoatsLoading(false);
  }, []);

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    const res = await apiCall('/api/wallet?action=rate');
    if (res.success) {
      setRateData(res.data);
    }
    setRatesLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [expRes, balRes, usersRes] = await Promise.all([
        apiCall('/api/wallet?action=list'),
        apiCall('/api/wallet?action=balances'),
        apiCall('/api/admin/users'),
      ]);

      const expenses = expRes.success ? expRes.data.expenses : [];
      const baseCurrency = expRes.success ? expRes.data.base_currency : 'EUR';
      const balances = balRes.success ? balRes.data.balances : [];
      const allUsers = usersRes.success ? usersRes.data.users : [];
      const allBoats = usersRes.success ? usersRes.data.boats : [];

      // Compute category counts
      const categoryCounts: Record<string, number> = {};
      let totalExpenseAmount = 0;
      for (const exp of expenses) {
        const cat = exp.category || 'other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        totalExpenseAmount += exp.amount_eur;
      }

      // Try to get logbook data for NM
      let totalNm = 0;
      let logbookEntries = 0;
      try {
        const logRes = await apiCall('/api/logbook');
        if (logRes.success && logRes.data.entries) {
          for (const entry of logRes.data.entries) {
            totalNm += parseFloat(entry.nautical_miles || '0');
            logbookEntries++;
          }
        }
      } catch {
        // Logbook API might not return in expected format
      }

      setStats({
        totalExpenses: totalExpenseAmount,
        expenseCount: expenses.length,
        totalNm,
        logbookEntries,
        crewCount: allUsers.length,
        boatCount: allBoats.length,
        baseCurrency,
        categoryCounts,
      });
    } catch {
      // Stats are best-effort
    }
    setStatsLoading(false);
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await apiCall('/api/wallet?action=full_audit');
      if (res.success) {
        setAuditLogs(res.data);
      }
    } catch { /* best-effort */ }
    setAuditLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadSettings();
    loadUsers();
  }, [loadSettings, loadUsers]);

  // Load tab-specific data on tab switch
  useEffect(() => {
    if (activeTab === 'boats' && boatsLoading) {
      loadBoats();
    }
    if (activeTab === 'data') {
      if (!rateData && !ratesLoading) loadRates();
      if (!stats && !statsLoading) loadStats();
      if (!auditLogs && !auditLoading) loadAudit();
    }
  }, [activeTab, boatsLoading, boatsDetailed, rateData, ratesLoading, stats, statsLoading, auditLogs, auditLoading, loadBoats, loadRates, loadStats, loadAudit]);

  // ── Settings handlers ──

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsMessage('');
    const res = await apiCall('/api/admin/settings', 'POST', { settings });
    setSettingsSaving(false);
    if (res.success) {
      setSettingsIsError(false);
      setSettingsMessage(t('admin.settingsSaved'));
      setTimeout(() => setSettingsMessage(''), 3000);
    } else {
      setSettingsIsError(true);
      setSettingsMessage(res.error || t('errors.generic'));
    }
  }

  async function handleChangeAdminPassword() {
    if (!adminPassword || adminPassword.length < 4) {
      setSettingsIsError(true);
      setSettingsMessage(t('admin.passwordMinChars'));
      setTimeout(() => setSettingsMessage(''), 3000);
      return;
    }
    setSettingsSaving(true);
    const res = await apiCall('/api/admin/settings', 'POST', {
      action: 'change_password',
      password: adminPassword,
    });
    setSettingsSaving(false);
    if (res.success) {
      setAdminPassword('');
      setSettingsIsError(false);
      setSettingsMessage(t('admin.passwordUpdated'));
      setTimeout(() => setSettingsMessage(''), 3000);
    } else {
      setSettingsIsError(true);
      setSettingsMessage(res.error || t('errors.generic'));
      setTimeout(() => setSettingsMessage(''), 3000);
    }
  }

  // ── User handlers ──

  function openAddUserModal() {
    setEditingUser(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('');
    setFormBoatId(boats[0]?.id || 0);
    setFormRole('crew');
    setShowUserModal(true);
  }

  function openEditUserModal(user: UserData) {
    setEditingUser(user);
    setFormName(user.name);
    setFormPhone(user.phone || '');
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormBoatId(user.boat_id);
    setFormRole((user as UserData & { role?: string }).role === 'captain' ? 'captain' : 'crew');
    setShowUserModal(true);
  }

  async function handleSaveUser() {
    if (!formName.trim() || !formBoatId) return;

    if (!editingUser) {
      // Adding — password is required
      if (!formPassword || formPassword.length < 4) {
        alert(t('admin.passwordMinChars'));
        return;
      }
    }

    setUserSaving(true);

    const payload = editingUser
      ? {
          action: 'edit',
          id: editingUser.id,
          name: formName.trim(),
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          boat_id: formBoatId,
          role: formRole,
        }
      : {
          action: 'add',
          name: formName.trim(),
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          boat_id: formBoatId,
          role: formRole,
          password: formPassword,
        };

    const res = await apiCall('/api/admin/users', 'POST', payload);
    setUserSaving(false);

    if (res.success) {
      setShowUserModal(false);
      loadUsers();
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordUser) return;
    if (!resetPasswordValue || resetPasswordValue.length < 4) {
      alert(t('admin.passwordMinChars'));
      return;
    }
    setResetPasswordSaving(true);
    const res = await apiCall('/api/admin/users', 'POST', {
      action: 'reset_password',
      id: resetPasswordUser.id,
      password: resetPasswordValue,
    });
    setResetPasswordSaving(false);
    if (res.success) {
      setResetPasswordUser(null);
      setResetPasswordValue('');
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setUserSaving(true);
    const res = await apiCall('/api/admin/users', 'POST', {
      action: 'delete',
      id: deleteUser.id,
    });
    setUserSaving(false);
    if (res.success) {
      setDeleteUser(null);
      loadUsers();
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  // ── Boats handlers ──

  async function handleSaveBoat(boatId: number) {
    const newName = boatEditValues[boatId]?.trim();
    if (!newName) return;
    setBoatSaving(boatId);
    const res = await apiCall('/api/admin/boats', 'POST', {
      action: 'edit',
      id: boatId,
      name: newName,
      emoji: boatEmojiValues[boatId] || '⛵',
      color: boatColorValues[boatId] || 'blue',
    });
    setBoatSaving(null);
    if (res.success) {
      loadBoats();
      loadUsers();
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  async function handleAddBoat() {
    if (!newBoatName.trim()) return;
    setBoatSaving(-1);
    const res = await apiCall('/api/admin/boats', 'POST', {
      action: 'add',
      name: newBoatName.trim(),
      emoji: newBoatEmoji,
      color: newBoatColor,
    });
    setBoatSaving(null);
    if (res.success) {
      setShowAddBoat(false);
      setNewBoatName('');
      setNewBoatEmoji('⛵');
      setNewBoatColor('blue');
      loadBoats();
      loadUsers();
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  async function handleDeleteBoat() {
    if (!deleteBoatId) return;
    setBoatSaving(deleteBoatId);
    const res = await apiCall('/api/admin/boats', 'POST', {
      action: 'delete',
      id: deleteBoatId,
    });
    setBoatSaving(null);
    if (res.success) {
      setDeleteBoatId(null);
      loadBoats();
      loadUsers();
    } else {
      alert(res.error || t('errors.generic'));
    }
  }

  // ── Data handlers ──

  async function handleExport() {
    setExporting(true);
    setExportMessage('');
    try {
      const res = await apiCall('/api/admin/export');
      if (res.success && res.data?.files) {
        const files = res.data.files as Record<string, string>;
        for (const [filename, content] of Object.entries(files)) {
          downloadFile(filename, content);
        }
        setExportMessage(`Exported ${Object.keys(files).length} files.`);
        setTimeout(() => setExportMessage(''), 5000);
      } else {
        setExportMessage(res.error || t('errors.generic'));
      }
    } catch {
      setExportMessage(t('errors.generic'));
    }
    setExporting(false);
  }

  async function handleSyncRates() {
    setSyncingRates(true);
    setSyncMessage('');
    try {
      const res = await apiCall('/api/wallet?action=sync_rates');
      if (res.success) {
        const days = res.data.days_synced ?? 0;
        setSyncMessage(`Synced rates for ${days} days (${res.data.from_date} to ${res.data.to_date}).`);
        loadRates(); // refresh displayed rates
      } else {
        setSyncMessage(res.error || t('errors.generic'));
      }
    } catch {
      setSyncMessage(t('errors.generic'));
    }
    setSyncingRates(false);
    setTimeout(() => setSyncMessage(''), 5000);
  }

  // ── Render ──

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">{t('admin.title')}</h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 rounded-lg border border-border p-1 bg-muted/50">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
                activeTab === tab.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ════════════════════════════════════════════ */}
        {/* Tab 1: Settings                             */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {settingsLoading ? (
              <p className="text-center py-10 text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Trip settings card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('admin.tripSettings')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('admin.tripName')}</Label>
                      <Input
                        value={settings.trip_name}
                        onChange={e => setSettings({ ...settings, trip_name: e.target.value })}
                        placeholder="e.g. Croatia 2026"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t('admin.tripDateFrom')}</Label>
                        <Input
                          type="date"
                          value={settings.trip_date_from}
                          onChange={e => setSettings({ ...settings, trip_date_from: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.tripDateTo')}</Label>
                        <Input
                          type="date"
                          value={settings.trip_date_to}
                          onChange={e => setSettings({ ...settings, trip_date_to: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t('admin.baseCurrency')}</Label>
                        <select
                          className={selectClassName}
                          value={settings.base_currency}
                          onChange={e => setSettings({ ...settings, base_currency: e.target.value })}
                        >
                          {CURRENCY_CODES.map(code => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.language')}</Label>
                        <select
                          className={selectClassName}
                          value={settings.language}
                          onChange={e => setSettings({ ...settings, language: e.target.value })}
                        >
                          {Object.values(LOCALES).map(loc => (
                            <option key={loc.code} value={loc.code}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* App Icon */}
                    <div className="space-y-2">
                      <Label>{t('admin.appIcon')}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {APP_ICONS.map(icon => (
                          <button key={icon} type="button"
                            className={cn(
                              'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-none cursor-pointer',
                              settings.app_icon === icon
                                ? 'bg-primary/15 ring-2 ring-primary'
                                : 'bg-muted/50 hover:bg-muted',
                            )}
                            onClick={() => setSettings(prev => ({ ...prev, app_icon: icon }))}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleSaveSettings} disabled={settingsSaving} className="mt-2">
                      {settingsSaving ? t('common.saving') : t('common.save')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Admin Password card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <Lock size={16} />
                      {t('admin.adminPasswordChange')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('admin.newAdminPassword')}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          placeholder={t('admin.passwordMinChars')}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={handleChangeAdminPassword}
                          disabled={settingsSaving || !adminPassword}
                        >
                          {t('common.update')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Message display */}
                {settingsMessage && (
                  <div
                    className={cn(
                      'px-4 py-3 rounded-lg text-sm',
                      settingsIsError
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-success-subtle text-success',
                    )}
                  >
                    {settingsMessage}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* Tab 2: Users                                */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {usersLoading ? (
              <p className="text-center py-10 text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {users.map(user => (
                    <Card key={user.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className={cn('h-9 w-9 shrink-0', avatarColorClass(user.id))}>
                              {user.avatar ? (
                                <AvatarImage src={user.avatar} alt={user.name} />
                              ) : null}
                              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{user.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {user.boat_name}
                                {user.phone && <> &middot; {user.phone}</>}
                                {user.email && <> &middot; {user.email}</>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditUserModal(user)}
                              aria-label={`Edit ${user.name}`}
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setResetPasswordUser(user);
                                setResetPasswordValue('');
                              }}
                              aria-label={`Reset password for ${user.name}`}
                            >
                              <KeyRound size={14} />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDeleteUser(user)}
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {users.length === 0 && (
                    <p className="text-center py-10 text-muted-foreground">{t('common.noData')}</p>
                  )}
                </div>

                {/* FAB - Add user */}
                <button
                  className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform border-none cursor-pointer"
                  onClick={openAddUserModal}
                  aria-label={t('admin.addUser')}
                >
                  <Plus size={24} />
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* Tab 3: Boats                                */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'boats' && (
          <motion.div
            key="boats"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {boatsLoading ? (
              <p className="text-center py-10 text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {boatsDetailed.map(boat => {
                  const hasChanges =
                    (boatEditValues[boat.id] ?? boat.name) !== boat.name ||
                    (boatEmojiValues[boat.id] ?? boat.emoji) !== boat.emoji ||
                    (boatColorValues[boat.id] ?? boat.color) !== boat.color;
                  const currentColor = BOAT_COLORS.find(c => c.value === (boatColorValues[boat.id] || boat.color));

                  return (
                    <Card key={boat.id}>
                      <CardContent className="p-4">
                        {/* Header: emoji + name + actions */}
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'flex items-center justify-center w-11 h-11 rounded-xl text-xl shrink-0',
                            currentColor?.tw ? `${currentColor.tw}/15` : 'bg-primary/10',
                          )}>
                            {boatEmojiValues[boat.id] || boat.emoji || '⛵'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Input
                                value={boatEditValues[boat.id] ?? boat.name}
                                onChange={e => setBoatEditValues(prev => ({ ...prev, [boat.id]: e.target.value }))}
                                className="flex-1"
                              />
                              <Button variant="outline" size="sm" onClick={() => handleSaveBoat(boat.id)}
                                disabled={boatSaving === boat.id || !hasChanges}>
                                {boatSaving === boat.id ? t('common.saving') : t('common.save')}
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteBoatId(boat.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>

                            {/* Emoji picker */}
                            <div className="mb-2">
                              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t('admin.boatIcon')}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {BOAT_EMOJIS.map(e => (
                                  <button key={e} type="button"
                                    className={cn(
                                      'w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all border-none cursor-pointer',
                                      (boatEmojiValues[boat.id] || boat.emoji) === e
                                        ? 'bg-primary/15 ring-2 ring-primary scale-110'
                                        : 'bg-muted/50 hover:bg-muted',
                                    )}
                                    onClick={() => setBoatEmojiValues(prev => ({ ...prev, [boat.id]: e }))}>
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Color picker */}
                            <div className="mb-2">
                              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t('admin.boatColor')}</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {BOAT_COLORS.map(c => (
                                  <button key={c.value} type="button"
                                    className={cn(
                                      'w-6 h-6 rounded-full transition-all border-none cursor-pointer',
                                      c.tw,
                                      (boatColorValues[boat.id] || boat.color) === c.value
                                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                        : 'opacity-60 hover:opacity-100',
                                    )}
                                    onClick={() => setBoatColorValues(prev => ({ ...prev, [boat.id]: c.value }))}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>

                            <Badge variant="secondary" className="text-xs">
                              {boat.crew_count ?? 0} {t('admin.crewMembers')}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {boatsDetailed.length === 0 && (
                  <p className="text-center py-10 text-muted-foreground">
                    {t('admin.noBoats')}
                  </p>
                )}
              </div>
            )}

            {/* Add Boat FAB */}
            <button className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform border-none cursor-pointer"
              onClick={() => setShowAddBoat(true)} aria-label={t('admin.addBoat')}>
              <Plus size={24} />
            </button>

            {/* Add Boat Modal */}
            <Modal isOpen={showAddBoat} onClose={() => setShowAddBoat(false)} title={t('admin.addBoat')}
              footer={
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddBoat(false)}>{t('common.cancel')}</Button>
                  <Button onClick={handleAddBoat} disabled={boatSaving === -1 || !newBoatName.trim()}>
                    {boatSaving === -1 ? t('common.saving') : t('admin.addBoat')}
                  </Button>
                </div>
              }>
              <div className="space-y-2 mb-4">
                <Label>{t('admin.boatName')}</Label>
                <Input value={newBoatName} onChange={e => setNewBoatName(e.target.value)} placeholder="e.g. Aqua Dream" />
              </div>
              <div className="mb-4">
                <Label className="mb-2 block">{t('admin.boatIcon')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {BOAT_EMOJIS.map(e => (
                    <button key={e} type="button"
                      className={cn('w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border-none cursor-pointer',
                        newBoatEmoji === e ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted')}
                      onClick={() => setNewBoatEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <Label className="mb-2 block">{t('admin.boatColor')}</Label>
                <div className="flex flex-wrap gap-2">
                  {BOAT_COLORS.map(c => (
                    <button key={c.value} type="button"
                      className={cn('w-7 h-7 rounded-full transition-all border-none cursor-pointer', c.tw,
                        newBoatColor === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100')}
                      onClick={() => setNewBoatColor(c.value)} title={c.label} />
                  ))}
                </div>
              </div>
            </Modal>

            {/* Delete Boat Confirmation */}
            <Modal isOpen={deleteBoatId !== null} onClose={() => setDeleteBoatId(null)} title={t('admin.deleteBoat')} size="sm"
              footer={
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDeleteBoatId(null)}>{t('common.cancel')}</Button>
                  <Button variant="destructive" onClick={handleDeleteBoat}
                    disabled={boatSaving === deleteBoatId}>
                    {boatSaving === deleteBoatId ? t('common.deleting') : t('common.delete')}
                  </Button>
                </div>
              }>
              <p>{t('admin.confirmDeleteBoat')}</p>
            </Modal>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* Tab 4: Data                                 */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'data' && (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-4">
              {/* Export Trip */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Download size={16} />
                    {t('admin.exportTrip')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('admin.exportDescription')}
                  </p>
                  <Button onClick={handleExport} disabled={exporting}>
                    {exporting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin mr-1.5" />
                        {t('admin.exporting')}
                      </>
                    ) : (
                      <>
                        <Download size={14} className="mr-1.5" />
                        {t('admin.exportTrip')}
                      </>
                    )}
                  </Button>
                  {exportMessage && (
                    <p className="text-sm mt-2 text-muted-foreground">{exportMessage}</p>
                  )}
                </CardContent>
              </Card>

              {/* Exchange Rates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <RefreshCw size={16} />
                    {t('admin.currentRates')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Button variant="outline" onClick={handleSyncRates} disabled={syncingRates}>
                      {syncingRates ? (
                        <>
                          <RefreshCw size={14} className="animate-spin mr-1.5" />
                          {t('admin.syncingRates')}
                        </>
                      ) : (
                        t('admin.syncRates')
                      )}
                    </Button>
                    {syncMessage && (
                      <span className="text-sm text-muted-foreground">{syncMessage}</span>
                    )}
                  </div>

                  {ratesLoading ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  ) : rateData && Object.keys(rateData.rates).length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('admin.baseCurrency')}: {rateData.base_currency}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {TOP_CURRENCIES.filter(c => c !== rateData.base_currency && rateData.rates[c])
                          .map(code => {
                            const info = CURRENCIES[code];
                            return (
                              <div
                                key={code}
                                className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 border border-border"
                              >
                                <span className="text-sm font-medium">
                                  {info?.flag} {code}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {rateData.rates[code]?.toFixed(4)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.noRatesLoaded')}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Audit Log */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {t('admin.auditLog')}
                    <Button variant="ghost" size="sm" onClick={loadAudit} disabled={auditLoading}>
                      <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLoading && !auditLogs ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('common.loading')}</p>
                  ) : !auditLogs ? (
                    <p className="text-sm text-muted-foreground">{t('admin.noActivityYet')}</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Expense changes */}
                      {auditLogs.expense_audits.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('admin.expenseChanges')}</h4>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {auditLogs.expense_audits.map(a => (
                              <div key={a.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0">
                                <Badge variant="outline" className={cn('text-[10px] min-w-[55px] justify-center',
                                  a.change_type === 'created' ? 'text-success border-success/30' :
                                  a.change_type === 'edited' ? 'text-warning border-warning/30' :
                                  'text-destructive border-destructive/30'
                                )}>
                                  {a.change_type}
                                </Badge>
                                <span className="truncate flex-1 text-[13px]">{a.description || 'Deleted'}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{a.changed_by_name || 'Admin'}</span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(a.changed_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Settlement changes */}
                      {auditLogs.settlement_audits.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('admin.settlementChanges')}</h4>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {auditLogs.settlement_audits.map(s => (
                              <div key={s.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0">
                                <Badge variant="outline" className={cn('text-[10px] min-w-[55px] justify-center',
                                  s.action === 'settled' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                                )}>
                                  {s.action}
                                </Badge>
                                <span className="truncate flex-1 text-[13px]">{s.from_name} → {s.to_name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {s.performer_name || 'Admin'}
                                  {s.performer_role ? ` (${s.performer_role})` : ''}
                                </span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(s.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {auditLogs.expense_audits.length === 0 && auditLogs.settlement_audits.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">{t('admin.noActivityYet')}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trip Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <BarChart3 size={16} />
                    {t('admin.tripStatistics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <p className="text-center py-6 text-muted-foreground">{t('common.loading')}</p>
                  ) : stats ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                          <div className="text-xs text-muted-foreground">{t('admin.totalExpenses')}</div>
                          <div className="text-lg font-semibold">
                            {formatCurrency(stats.totalExpenses, stats.baseCurrency)}
                          </div>
                          <div className="text-xs text-muted-foreground">{stats.expenseCount}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                          <div className="text-xs text-muted-foreground">{t('admin.nauticalMiles')}</div>
                          <div className="text-lg font-semibold">{stats.totalNm.toFixed(1)} NM</div>
                          <div className="text-xs text-muted-foreground">{stats.logbookEntries}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                          <div className="text-xs text-muted-foreground">{t('admin.crewCount')}</div>
                          <div className="text-lg font-semibold">{stats.crewCount}</div>
                          <div className="text-xs text-muted-foreground">{t('admin.crewMembers')}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                          <div className="text-xs text-muted-foreground">{t('admin.boatCount')}</div>
                          <div className="text-lg font-semibold">{stats.boatCount}</div>
                          <div className="text-xs text-muted-foreground">{t('admin.boats')}</div>
                        </div>
                      </div>

                      {Object.keys(stats.categoryCounts).length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="text-sm font-medium mb-2">{t('admin.expensesByCategory')}</h4>
                            <div className="space-y-1.5">
                              {Object.entries(stats.categoryCounts)
                                .sort(([, a], [, b]) => b - a)
                                .map(([category, count]) => (
                                  <div
                                    key={category}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {CATEGORY_LABELS[category] || category}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {count}
                                    </Badge>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════ */}
      {/* Modals                                      */}
      {/* ════════════════════════════════════════════ */}

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? t('admin.editUser') : t('admin.addUser')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowUserModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveUser} disabled={userSaving}>
              {userSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 mb-4">
          <Label>{t('admin.userName')}</Label>
          <Input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder={t('admin.userName')}
          />
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('admin.userBoat')}</Label>
          <select
            className={selectClassName}
            value={formBoatId}
            onChange={e => setFormBoatId(Number(e.target.value))}
          >
            <option value={0}>{t('admin.selectBoat')}</option>
            {boats.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('admin.role')}</Label>
          <select
            className={selectClassName}
            value={formRole}
            onChange={e => setFormRole(e.target.value as 'crew' | 'captain')}
          >
            <option value="crew">{t('admin.roleCrew')}</option>
            <option value="captain">{t('admin.roleCaptain')}</option>
          </select>
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('admin.userPhone')}</Label>
          <Input
            value={formPhone}
            onChange={e => setFormPhone(e.target.value)}
            placeholder="+420 123 456 789"
          />
        </div>
        <div className="space-y-2 mb-4">
          <Label>{t('admin.userEmail')}</Label>
          <Input
            type="email"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        {!editingUser && (
          <div className="space-y-2 mb-4">
            <Label>{t('auth.password')}</Label>
            <Input
              type="password"
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              placeholder={t('admin.passwordMinChars')}
            />
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPasswordUser !== null}
        onClose={() => {
          setResetPasswordUser(null);
          setResetPasswordValue('');
        }}
        title={t('admin.resetPassword')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordUser(null);
                setResetPasswordValue('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordSaving}>
              {resetPasswordSaving ? t('common.saving') : t('admin.resetPassword')}
            </Button>
          </div>
        }
      >
        {resetPasswordUser && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.newPassword')}: <span className="font-semibold text-foreground">{resetPasswordUser.name}</span>
            </p>
            <div className="space-y-2 mb-4">
              <Label>{t('admin.newPassword')}</Label>
              <Input
                type="password"
                value={resetPasswordValue}
                onChange={e => setResetPasswordValue(e.target.value)}
                placeholder={t('admin.passwordMinChars')}
                autoFocus
              />
            </div>
          </>
        )}
      </Modal>

      {/* Delete User Confirmation */}
      <Modal
        isOpen={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        title={t('admin.deleteUser')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={userSaving}>
              {userSaving ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        }
      >
        {deleteUser && (
          <p className="text-sm text-muted-foreground">
            {t('admin.confirmDeleteUser')}
          </p>
        )}
      </Modal>
    </>
  );
}
