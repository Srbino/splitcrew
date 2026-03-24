'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Check, X, ArrowRight,
  Receipt, BarChart3, Handshake, RefreshCw, ChevronDown,
} from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { useToast } from '@/components/shared/toast';
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
import { CURRENCIES, CURRENCY_CODES, formatCurrency, getCurrency } from '@/lib/currencies';
import { formatDate, formatDateTime } from '@/lib/utils';

// ── Types ──

interface Expense {
  id: number;
  paid_by: number;
  paid_by_name: string;
  paid_by_avatar: string | null;
  paid_by_boat_id: number;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate: number | null;
  description: string;
  category: string;
  expense_date: string;
  split_type: string;
  photo: string | null;
  created_by: number | null;
  created_at: string;
  split_user_ids: number[];
  split_amounts: Record<number, number>;
}

interface UserBalance {
  user_id: number;
  name: string;
  avatar: string | null;
  boat_id: number;
  boat_name: string;
  paid: number;
  share: number;
  balance: number;
}

interface Settlement {
  from_user_id: number;
  from_name: string;
  from_avatar: string | null;
  to_user_id: number;
  to_name: string;
  to_avatar: string | null;
  amount: number;
  is_settled: boolean;
}

interface UserInfo {
  id: number;
  name: string;
  avatar: string | null;
  boat_id: number;
  boat_name: string;
}

interface AuditEntry {
  id: number;
  expense_id: number;
  changed_by: number | null;
  changed_by_name: string | null;
  change_type: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_at: string;
}

// ── Helpers ──

function getAllowedCurrencies(): string[] {
  if (typeof document === 'undefined') return [];
  try {
    const meta = document.querySelector('meta[name="allowed-currencies"]');
    return meta ? JSON.parse(meta.getAttribute('content') || '[]') : [];
  } catch { return []; }
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || '';
}

async function apiCall<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

// ── Inline Avatar Helper ──

function UserAvatar({
  name,
  avatar,
  userId,
  size = 'sm',
}: {
  name: string;
  avatar: string | null;
  userId: number;
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <Avatar size={size} className={avatarColorClass(userId)}>
      {avatar ? (
        <AvatarImage src={avatar} alt={name} />
      ) : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

// ── Animation Variants ──

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20, stiffness: 300 } },
};

// ── Main Page Component ──

type TabId = 'expenses' | 'balances' | 'settlements';

interface BoatInfo {
  id: number;
  name: string;
}

export default function WalletPage() {
  const { t } = useI18n();
  const { showToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('expenses');

  // Boats (loaded dynamically)
  const [boats, setBoats] = useState<BoatInfo[]>([]);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalEur, setTotalEur] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [displayRate, setDisplayRate] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // Balances state
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Settlements state
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  // Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditExpenseId, setAuditExpenseId] = useState<number | null>(null);

  // Users for form
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Form state
  const [formPaidBy, setFormPaidBy] = useState(0);
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('EUR');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formDate, setFormDate] = useState('');
  const [formSplitType, setFormSplitType] = useState('both');
  const [formSplitUsers, setFormSplitUsers] = useState<number[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Rates for conversion hint
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});

  // Convert EUR amount to display currency
  const toDisplay = useCallback((eur: number) => Math.round(eur * displayRate * 100) / 100, [displayRate]);

  // ── Load users on mount ──
  useEffect(() => {
    loadUsers();
    loadRates();
  }, []);

  // ── Load data when tab changes ──
  useEffect(() => {
    if (activeTab === 'expenses') {
      loadExpenses();
    } else if (activeTab === 'balances') {
      loadBalances();
    } else if (activeTab === 'settlements') {
      loadSettlements();
    }
  }, [activeTab, filter]);

  const loadUsers = async () => {
    const res = await apiCall<UserInfo[]>('/api/auth/users');
    if (res.success && res.data) {
      const userList = Array.isArray(res.data) ? res.data : [];
      setUsers(userList);
      // Extract unique boats from user data
      const boatMap = new Map<number, string>();
      for (const u of userList) {
        if (u.boat_id && u.boat_name && !boatMap.has(u.boat_id)) {
          boatMap.set(u.boat_id, u.boat_name);
        }
      }
      const boatList: BoatInfo[] = [];
      for (const [id, name] of boatMap) {
        boatList.push({ id, name });
      }
      boatList.sort((a, b) => a.id - b.id);
      setBoats(boatList);
    }
  };

  const loadRates = async () => {
    const res = await apiCall<{ base_currency: string; rates: Record<string, number> }>(
      '/api/wallet?action=rate'
    );
    if (res.success && res.data) {
      setCurrentRates(res.data.rates);
      setBaseCurrency(res.data.base_currency);
      setFormCurrency(res.data.base_currency);
    }
  };

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    const res = await apiCall<{
      expenses: Expense[];
      total_eur: number;
      base_currency: string;
      display_rate: number;
    }>(`/api/wallet?action=list&filter=${filter}`);
    if (res.success && res.data) {
      setExpenses(res.data.expenses);
      setTotalEur(res.data.total_eur);
      setBaseCurrency(res.data.base_currency);
      if (res.data.display_rate) setDisplayRate(res.data.display_rate);
    }
    setLoadingExpenses(false);
  }, [filter]);

  const loadBalances = useCallback(async () => {
    setLoadingBalances(true);
    const res = await apiCall<{
      balances: UserBalance[];
      base_currency: string;
      display_rate: number;
    }>('/api/wallet?action=balances');
    if (res.success && res.data) {
      setBalances(res.data.balances);
      setBaseCurrency(res.data.base_currency);
      if (res.data.display_rate) setDisplayRate(res.data.display_rate);
    }
    setLoadingBalances(false);
  }, []);

  const loadSettlements = useCallback(async () => {
    setLoadingSettlements(true);
    const res = await apiCall<{
      settlements: Settlement[];
      base_currency: string;
      display_rate: number;
      exchange_rates: Record<string, number>;
    }>('/api/wallet?action=settlements');
    if (res.success && res.data) {
      setSettlements(res.data.settlements);
      setBaseCurrency(res.data.base_currency);
      if (res.data.display_rate) setDisplayRate(res.data.display_rate);
      setExchangeRates(res.data.exchange_rates);
    }
    setLoadingSettlements(false);
  }, []);

  // ── Form helpers ──

  const resetForm = useCallback(() => {
    setFormPaidBy(0);
    setFormAmount('');
    setFormCurrency(baseCurrency);
    setFormDescription('');
    setFormCategory('other');
    setFormDate(new Date().toISOString().slice(0, 16));
    setFormSplitType('both');
    setFormSplitUsers([]);
    setEditingExpense(null);
  }, [baseCurrency]);

  const openAddModal = useCallback(() => {
    resetForm();
    setFormSplitUsers(users.map(u => u.id));
    setShowExpenseModal(true);
  }, [resetForm, users]);

  const openEditModal = useCallback(
    (expense: Expense) => {
      setEditingExpense(expense);
      setFormPaidBy(expense.paid_by);
      setFormAmount(String(expense.amount));
      setFormCurrency(expense.currency);
      setFormDescription(expense.description);
      setFormCategory(expense.category);
      const d = new Date(expense.expense_date);
      const dateStr = d.getFullYear() +
        '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0') +
        'T' + String(d.getHours()).padStart(2, '0') +
        ':' + String(d.getMinutes()).padStart(2, '0');
      setFormDate(dateStr);
      setFormSplitType(expense.split_type);
      setFormSplitUsers(expense.split_user_ids);
      setShowExpenseModal(true);
    },
    []
  );

  const handleSubmitExpense = async () => {
    if (!formPaidBy) {
      showToast(t('wallet.paidBy') + ' is required', 'error');
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      showToast(t('wallet.amount') + ' is required', 'error');
      return;
    }
    if (!formDescription.trim()) {
      showToast(t('wallet.description') + ' is required', 'error');
      return;
    }
    if (formSplitUsers.length === 0) {
      showToast(t('wallet.splitBetween') + ' is required', 'error');
      return;
    }

    setFormSubmitting(true);

    const payload = {
      action: editingExpense ? 'edit' : 'add',
      id: editingExpense?.id,
      paid_by: formPaidBy,
      amount: parseFloat(formAmount),
      currency: formCurrency,
      description: formDescription.trim(),
      category: formCategory,
      expense_date: formDate || new Date().toISOString().slice(0, 16),
      split_type: formSplitType,
      split_users: formSplitUsers,
    };

    const res = await apiCall('/api/wallet', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setFormSubmitting(false);

    if (res.success) {
      showToast(
        editingExpense ? t('wallet.expenseUpdated') : t('wallet.expenseAdded'),
        'success'
      );
      setShowExpenseModal(false);
      resetForm();
      loadExpenses();
    } else {
      showToast(res.error || 'Error', 'error');
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;

    const res = await apiCall('/api/wallet', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id: deletingExpenseId }),
    });

    if (res.success) {
      showToast(t('wallet.expenseDeleted'), 'success');
      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);
      loadExpenses();
    } else {
      showToast(res.error || 'Error', 'error');
    }
  };

  const handleToggleSettle = async (settlement: Settlement) => {
    const res = await apiCall('/api/wallet', {
      method: 'POST',
      body: JSON.stringify({
        action: 'settle',
        from_user_id: settlement.from_user_id,
        to_user_id: settlement.to_user_id,
        settled: !settlement.is_settled,
      }),
    });

    if (res.success) {
      loadSettlements();
    } else {
      showToast(res.error || 'Error', 'error');
    }
  };

  const handleShowAudit = async (expenseId: number) => {
    setAuditExpenseId(expenseId);
    const res = await apiCall<{ logs: AuditEntry[] }>(
      `/api/wallet?action=audit&expense_id=${expenseId}`
    );
    if (res.success && res.data) {
      setAuditLogs(res.data.logs);
    }
    setShowAuditModal(true);
  };

  // ── Split user helpers ──

  const usersForSplitType = useMemo(() => {
    if (formSplitType === 'both') return users;
    // Dynamic boat filter: formSplitType is boat ID as string (e.g., "1", "2", "3")
    const boatId = parseInt(formSplitType);
    if (boatId > 0) return users.filter(u => u.boat_id === boatId);
    return users;
  }, [users, formSplitType]);

  useEffect(() => {
    const validIds = new Set(usersForSplitType.map(u => u.id));
    setFormSplitUsers(prev => {
      const filtered = prev.filter(id => validIds.has(id));
      if (filtered.length === 0) {
        return usersForSplitType.map(u => u.id);
      }
      return filtered;
    });
  }, [formSplitType, usersForSplitType]);

  const toggleSplitUser = (userId: number) => {
    setFormSplitUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllSplitUsers = () => {
    setFormSplitUsers(usersForSplitType.map(u => u.id));
  };

  const deselectAllSplitUsers = () => {
    setFormSplitUsers([]);
  };

  // ── Conversion hint ──

  const conversionHint = useMemo(() => {
    if (formCurrency === 'EUR') return null;
    const rate = currentRates[formCurrency];
    if (!rate || rate <= 0) return null;
    const amt = parseFloat(formAmount) || 0;
    if (amt <= 0) return null;
    const convertedEur = Math.round((amt / rate) * 100) / 100;
    const displayAmt = toDisplay(convertedEur);
    // Show EUR conversion, and display currency if different
    if (baseCurrency === 'EUR') {
      return `${formatCurrency(amt, formCurrency)} = ~${formatCurrency(convertedEur, 'EUR')} (1 EUR = ${rate} ${formCurrency})`;
    }
    return `${formatCurrency(amt, formCurrency)} = ~${formatCurrency(displayAmt, baseCurrency)} (1 EUR = ${rate} ${formCurrency})`;
  }, [formAmount, formCurrency, baseCurrency, currentRates, toDisplay]);

  // ── Category options ──
  const categories = [
    { value: 'food', label: 'Food & Drinks' },
    { value: 'transport', label: 'Transport' },
    { value: 'marina', label: 'Marina & Port' },
    { value: 'fuel', label: 'Fuel' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'other', label: 'Other' },
  ];

  // ── Render ──

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('wallet.title')}</h1>
          {totalEur > 0 && activeTab === 'expenses' && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('wallet.totalSpent')}: {formatCurrency(toDisplay(totalEur), baseCurrency)}
            </p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 rounded-lg border border-border p-1 bg-muted/50" role="tablist">
        {([
          { id: 'expenses' as TabId, icon: Receipt, label: t('wallet.expenses') },
          { id: 'balances' as TabId, icon: BarChart3, label: t('wallet.balances') },
          { id: 'settlements' as TabId, icon: Handshake, label: t('wallet.settlements') },
        ] as const).map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all cursor-pointer border-none',
              activeTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground bg-transparent'
            )}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'expenses' && (
          <ExpensesTab
            expenses={expenses}
            baseCurrency={baseCurrency}
            toDisplay={toDisplay}
            boats={boats}
            filter={filter}
            setFilter={setFilter}
            loading={loadingExpenses}
            onEdit={openEditModal}
            onDelete={(id) => {
              setDeletingExpenseId(id);
              setShowDeleteConfirm(true);
            }}
            onAudit={handleShowAudit}
            t={t}
          />
        )}

        {activeTab === 'balances' && (
          <BalancesTab
            balances={balances}
            baseCurrency={baseCurrency}
            toDisplay={toDisplay}
            loading={loadingBalances}
            t={t}
          />
        )}

        {activeTab === 'settlements' && (
          <SettlementsTab
            settlements={settlements}
            baseCurrency={baseCurrency}
            toDisplay={toDisplay}
            exchangeRates={exchangeRates}
            loading={loadingSettlements}
            onToggleSettle={handleToggleSettle}
            t={t}
          />
        )}
      </div>

      {/* FAB: Add expense */}
      {activeTab === 'expenses' && (
        <motion.button
          className="fixed bottom-24 right-5 md:bottom-8 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center border-none cursor-pointer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', damping: 15, stiffness: 400 }}
          onClick={openAddModal}
          aria-label={t('wallet.addExpense')}
          title={t('wallet.addExpense')}
        >
          <Plus size={24} />
        </motion.button>
      )}

      {/* Add/Edit Expense Modal */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          resetForm();
        }}
        title={editingExpense ? t('wallet.editExpense') : t('wallet.addExpense')}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => {
                setShowExpenseModal(false);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitExpense}
              disabled={formSubmitting}
            >
              {formSubmitting ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        }
      >
        <ExpenseForm
          users={users}
          formPaidBy={formPaidBy}
          setFormPaidBy={setFormPaidBy}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formCurrency={formCurrency}
          setFormCurrency={setFormCurrency}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formCategory={formCategory}
          setFormCategory={setFormCategory}
          formDate={formDate}
          setFormDate={setFormDate}
          formSplitType={formSplitType}
          setFormSplitType={setFormSplitType}
          formSplitUsers={formSplitUsers}
          toggleSplitUser={toggleSplitUser}
          selectAllSplitUsers={selectAllSplitUsers}
          deselectAllSplitUsers={deselectAllSplitUsers}
          usersForSplitType={usersForSplitType}
          boats={boats}
          conversionHint={conversionHint}
          baseCurrency={baseCurrency}
          categories={categories}
          t={t}
        />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingExpenseId(null);
        }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingExpenseId(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteExpense}>
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('wallet.confirmDelete')}</p>
      </Modal>

      {/* Audit log modal */}
      <Modal
        isOpen={showAuditModal}
        onClose={() => {
          setShowAuditModal(false);
          setAuditLogs([]);
          setAuditExpenseId(null);
        }}
        title={t('wallet.auditLog')}
        size="lg"
      >
        <AuditLogView logs={auditLogs} t={t} />
      </Modal>
    </div>
  );
}

// ── Expenses Tab ──

function ExpensesTab({
  expenses,
  baseCurrency,
  toDisplay,
  boats,
  filter,
  setFilter,
  loading,
  onEdit,
  onDelete,
  onAudit,
  t,
}: {
  expenses: Expense[];
  baseCurrency: string;
  toDisplay: (eur: number) => number;
  boats: BoatInfo[];
  filter: string;
  setFilter: (f: string) => void;
  loading: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (id: number) => void;
  onAudit: (id: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  // Dynamic filters: All, Mine, + one per boat
  const filters: { id: string; label: string }[] = [
    { id: 'all', label: t('wallet.filterAll') },
    { id: 'mine', label: t('wallet.filterMine') },
    ...boats.map(b => ({ id: `boat_${b.id}`, label: b.name })),
  ];

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.id}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-none',
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin mx-auto" />
          <p className="mt-2">{t('common.loading')}</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Receipt size={48} className="opacity-30 mx-auto mb-3" />
          <p>{t('wallet.noExpenses')}</p>
        </div>
      ) : (
        <motion.div className="flex flex-col gap-3" variants={listVariants} initial="hidden" animate="visible">
          {expenses.map(expense => (
            <motion.div key={expense.id} variants={cardVariants}>
              <ExpenseCard
                expense={expense}
                baseCurrency={baseCurrency}
                toDisplay={toDisplay}
                onEdit={() => onEdit(expense)}
                onDelete={() => onDelete(expense.id)}
                onAudit={() => onAudit(expense.id)}
                t={t}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ── Expense Card ──

function ExpenseCard({
  expense,
  baseCurrency,
  toDisplay,
  onEdit,
  onDelete,
  onAudit,
  t,
}: {
  expense: Expense;
  baseCurrency: string;
  toDisplay: (eur: number) => number;
  onEdit: () => void;
  onDelete: () => void;
  onAudit: () => void;
  t: (key: string) => string;
}) {
  const showOriginal = expense.currency !== baseCurrency;

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors py-0" onClick={onEdit}>
      <CardContent className="flex items-center gap-3.5 px-4 py-3">
        {/* Avatar */}
        <UserAvatar
          name={expense.paid_by_name}
          avatar={expense.paid_by_avatar}
          userId={expense.paid_by}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {expense.description}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {expense.paid_by_name} &middot; {formatDate(expense.expense_date)}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          {showOriginal ? (
            <>
              <span className="block font-semibold text-sm">
                {formatCurrency(expense.amount, expense.currency)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(toDisplay(expense.amount_eur), baseCurrency)}
              </span>
            </>
          ) : (
            <span className="font-semibold text-sm">
              {formatCurrency(toDisplay(expense.amount_eur), baseCurrency)}
            </span>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={(e) => e.stopPropagation()}
              aria-label={t('common.actions')}
            >
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil size={14} />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAudit();
              }}
            >
              <Receipt size={14} />
              {t('wallet.auditLog')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 size={14} />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

// ── Balances Tab ──

function BalancesTab({
  balances,
  baseCurrency,
  toDisplay,
  loading,
  t,
}: {
  balances: UserBalance[];
  baseCurrency: string;
  toDisplay: (eur: number) => number;
  loading: boolean;
  t: (key: string) => string;
}) {
  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <RefreshCw size={24} className="animate-spin mx-auto" />
        <p className="mt-2">{t('common.loading')}</p>
      </div>
    );
  }

  const activeBalances = balances.filter(b => b.paid !== 0 || b.share !== 0);

  if (activeBalances.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <BarChart3 size={48} className="opacity-30 mx-auto mb-3" />
        <p>{t('wallet.noExpenses')}</p>
      </div>
    );
  }

  return (
    <motion.div className="flex flex-col gap-3" variants={listVariants} initial="hidden" animate="visible">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_90px_90px_90px] gap-4 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Name</span>
        <span className="text-right">{t('dashboard.paid')}</span>
        <span className="text-right">Share</span>
        <span className="text-right">Balance</span>
      </div>

      {activeBalances.map(b => {
        const isPositive = b.balance > 0.01;
        const isNegative = b.balance < -0.01;

        return (
          <motion.div key={b.user_id} variants={cardVariants}>
            <Card className="py-0">
              <CardContent className="grid grid-cols-[1fr_90px_90px_90px] gap-4 items-center px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar name={b.name} avatar={b.avatar} userId={b.user_id} />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {b.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.boat_name}
                    </div>
                  </div>
                </div>
                <span className="text-right text-sm tabular-nums">
                  {formatCurrency(toDisplay(b.paid), baseCurrency)}
                </span>
                <span className="text-right text-sm tabular-nums">
                  {formatCurrency(toDisplay(b.share), baseCurrency)}
                </span>
                <span
                  className={cn(
                    'text-right font-bold text-sm tabular-nums',
                    isPositive && 'text-green-600 dark:text-green-400',
                    isNegative && 'text-destructive',
                  )}
                >
                  {b.balance > 0 ? '+' : ''}{formatCurrency(toDisplay(b.balance), baseCurrency)}
                </span>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ── Settlements Tab ──

function SettlementsTab({
  settlements,
  baseCurrency,
  toDisplay,
  exchangeRates,
  loading,
  onToggleSettle,
  t,
}: {
  settlements: Settlement[];
  baseCurrency: string;
  toDisplay: (eur: number) => number;
  exchangeRates: Record<string, number>;
  loading: boolean;
  onToggleSettle: (s: Settlement) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <RefreshCw size={24} className="animate-spin mx-auto" />
        <p className="mt-2">{t('common.loading')}</p>
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Handshake size={48} className="opacity-30 mx-auto mb-3" />
        <p>All settled up!</p>
      </div>
    );
  }

  const showCurrencies = getAllowedCurrencies().filter(
    c => c !== baseCurrency && exchangeRates[c]
  );

  return (
    <motion.div className="flex flex-col gap-3" variants={listVariants} initial="hidden" animate="visible">
      {settlements.map((s) => (
        <motion.div key={`${s.from_user_id}-${s.to_user_id}`} variants={cardVariants}>
          <Card
            className={cn('py-0', s.is_settled && 'opacity-60')}
          >
            <CardContent className="flex items-center gap-3.5 flex-wrap px-5 py-4">
              {/* From user */}
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={s.from_name} avatar={s.from_avatar} userId={s.from_user_id} />
                <span className="font-semibold text-sm whitespace-nowrap">
                  {s.from_name}
                </span>
              </div>

              <ArrowRight size={16} className="text-muted-foreground shrink-0" />

              {/* To user */}
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={s.to_name} avatar={s.to_avatar} userId={s.to_user_id} />
                <span className="font-semibold text-sm whitespace-nowrap">
                  {s.to_name}
                </span>
              </div>

              {/* Amount */}
              <div className="ml-auto text-right shrink-0">
                <div className="font-bold text-base text-destructive">
                  {formatCurrency(toDisplay(s.amount), baseCurrency)}
                </div>
                {showCurrencies.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {showCurrencies.map(c => {
                      const converted = Math.round(s.amount * (exchangeRates[c] ?? 1) * 100) / 100;
                      return (
                        <span key={c} className="mr-2">
                          ~{formatCurrency(converted, c)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Settle button */}
              <Button
                variant={s.is_settled ? 'outline' : 'default'}
                size="sm"
                className="shrink-0"
                onClick={() => onToggleSettle(s)}
              >
                {s.is_settled ? (
                  <>
                    <X size={14} />
                    <span>{t('wallet.unmarkSettled')}</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{t('wallet.markSettled')}</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Expense Form ──

function ExpenseForm({
  users,
  formPaidBy,
  setFormPaidBy,
  formAmount,
  setFormAmount,
  formCurrency,
  setFormCurrency,
  formDescription,
  setFormDescription,
  formCategory,
  setFormCategory,
  formDate,
  setFormDate,
  formSplitType,
  setFormSplitType,
  formSplitUsers,
  toggleSplitUser,
  selectAllSplitUsers,
  deselectAllSplitUsers,
  usersForSplitType,
  boats,
  conversionHint,
  baseCurrency,
  categories,
  t,
}: {
  users: UserInfo[];
  formPaidBy: number;
  setFormPaidBy: (v: number) => void;
  formAmount: string;
  setFormAmount: (v: string) => void;
  formCurrency: string;
  setFormCurrency: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formCategory: string;
  setFormCategory: (v: string) => void;
  formDate: string;
  setFormDate: (v: string) => void;
  formSplitType: string;
  setFormSplitType: (v: string) => void;
  formSplitUsers: number[];
  toggleSplitUser: (id: number) => void;
  selectAllSplitUsers: () => void;
  deselectAllSplitUsers: () => void;
  usersForSplitType: UserInfo[];
  boats: BoatInfo[];
  conversionHint: string | null;
  baseCurrency: string;
  categories: { value: string; label: string }[];
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Paid by */}
      <div className="space-y-2 mb-0">
        <Label>{t('wallet.paidBy')}</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={formPaidBy}
          onChange={e => setFormPaidBy(parseInt(e.target.value))}
        >
          <option value={0}>-- {t('auth.selectPlaceholder')} --</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.boat_name})
            </option>
          ))}
        </select>
      </div>

      {/* Amount + Currency */}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div className="space-y-2">
          <Label>{t('wallet.amount')}</Label>
          <Input
            type="number"
            value={formAmount}
            onChange={e => setFormAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('wallet.currency')}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formCurrency}
            onChange={e => setFormCurrency(e.target.value)}
          >
            {(getAllowedCurrencies().length > 0 ? getAllowedCurrencies() : CURRENCY_CODES).map(code => {
              const info = getCurrency(code);
              return (
                <option key={code} value={code}>
                  {info.flag} {code}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Conversion hint */}
      {conversionHint && (
        <div className="px-3 py-2 bg-muted rounded-lg text-xs text-muted-foreground -mt-2">
          {conversionHint}
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label>{t('wallet.description')}</Label>
        <Input
          type="text"
          value={formDescription}
          onChange={e => setFormDescription(e.target.value)}
          placeholder={t('wallet.description')}
          maxLength={200}
        />
      </div>

      {/* Category + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t('wallet.category')}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formCategory}
            onChange={e => setFormCategory(e.target.value)}
          >
            {categories.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>{t('wallet.date')}</Label>
          <Input
            type="datetime-local"
            value={formDate}
            onChange={e => setFormDate(e.target.value)}
          />
        </div>
      </div>

      {/* Split type */}
      <div className="space-y-2">
        <Label>{t('wallet.splitType')}</Label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'both', label: t('wallet.bothBoats') },
            ...boats.map(b => ({ value: String(b.id), label: `${b.name} only` })),
          ].map(opt => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 cursor-pointer text-sm transition-all',
                formSplitType === opt.value
                  ? 'border-primary bg-primary/10 font-semibold'
                  : 'border-border'
              )}
            >
              <input
                type="radio"
                name="split_type"
                value={opt.value}
                checked={formSplitType === opt.value}
                onChange={() => setFormSplitType(opt.value)}
                className="hidden"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Split users */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="mb-0">
            {t('wallet.splitBetween')} ({formSplitUsers.length}/{usersForSplitType.length})
          </Label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={selectAllSplitUsers}
            >
              {t('common.all')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={deselectAllSplitUsers}
            >
              None
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {usersForSplitType.map(u => {
            const selected = formSplitUsers.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleSplitUser(u.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 cursor-pointer text-sm transition-all',
                  selected
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border'
                )}
              >
                <UserAvatar name={u.name} avatar={u.avatar} userId={u.id} />
                {u.name}
                {selected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Audit Log View ──

function AuditLogView({
  logs,
  t,
}: {
  logs: AuditEntry[];
  t: (key: string) => string;
}) {
  if (logs.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-5">
        No audit history found.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map(log => (
        <div
          key={log.id}
          className="p-3 border border-border rounded-lg text-sm"
        >
          <div className="flex justify-between items-center mb-1.5">
            <Badge
              variant="outline"
              className={cn(
                'uppercase text-[0.65rem] font-bold',
                log.change_type === 'create' && 'border-green-500 text-green-600 dark:text-green-400',
                log.change_type === 'edit' && 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
                log.change_type === 'delete' && 'border-destructive text-destructive',
              )}
            >
              {log.change_type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(log.changed_at)}
            </span>
          </div>
          <div className="text-muted-foreground">
            by {log.changed_by_name || 'Unknown'}
          </div>
          {log.change_type === 'edit' && log.old_values && log.new_values && (
            <div className="mt-2 text-xs">
              {Object.keys(log.new_values).map(key => {
                const oldVal = log.old_values?.[key];
                const newVal = log.new_values?.[key];
                if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                if (key === 'split_users') return null;
                return (
                  <div key={key} className="mb-0.5">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="line-through text-destructive/70">
                      {String(oldVal ?? '')}
                    </span>{' '}
                    <ArrowRight size={10} className="inline" />{' '}
                    <span className="text-green-600 dark:text-green-400">
                      {String(newVal ?? '')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
