'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Check, X, ArrowRight,
  Receipt, BarChart3, Handshake, RefreshCw, ChevronDown,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
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

// ── Main Page Component ──

type TabId = 'expenses' | 'balances' | 'settlements';
type FilterId = 'all' | 'mine' | 'boat1' | 'boat2';

export default function WalletPage() {
  const { t } = useI18n();
  const { showToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('expenses');

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalEur, setTotalEur] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [filter, setFilter] = useState<FilterId>('all');
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
      // The users endpoint returns the array directly in data
      const userList = Array.isArray(res.data) ? res.data : [];
      setUsers(userList);
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
    }>(`/api/wallet?action=list&filter=${filter}`);
    if (res.success && res.data) {
      setExpenses(res.data.expenses);
      setTotalEur(res.data.total_eur);
      setBaseCurrency(res.data.base_currency);
    }
    setLoadingExpenses(false);
  }, [filter]);

  const loadBalances = useCallback(async () => {
    setLoadingBalances(true);
    const res = await apiCall<{
      balances: UserBalance[];
      base_currency: string;
    }>('/api/wallet?action=balances');
    if (res.success && res.data) {
      setBalances(res.data.balances);
      setBaseCurrency(res.data.base_currency);
    }
    setLoadingBalances(false);
  }, []);

  const loadSettlements = useCallback(async () => {
    setLoadingSettlements(true);
    const res = await apiCall<{
      settlements: Settlement[];
      base_currency: string;
      exchange_rates: Record<string, number>;
    }>('/api/wallet?action=settlements');
    if (res.success && res.data) {
      setSettlements(res.data.settlements);
      setBaseCurrency(res.data.base_currency);
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
    // Auto-select all users for split
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
      // Format date for datetime-local input
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
    if (formSplitType === 'boat1') return users.filter(u => u.boat_id === 1);
    if (formSplitType === 'boat2') return users.filter(u => u.boat_id === 2);
    return users;
  }, [users, formSplitType]);

  // Auto-update split users when split type changes
  useEffect(() => {
    const validIds = new Set(usersForSplitType.map(u => u.id));
    setFormSplitUsers(prev => {
      const filtered = prev.filter(id => validIds.has(id));
      // If none selected after filtering, select all from this group
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
    if (formCurrency === baseCurrency) return null;
    const rate = currentRates[formCurrency];
    if (!rate || rate <= 0) return null;
    const amt = parseFloat(formAmount) || 0;
    if (amt <= 0) return null;
    const converted = Math.round((amt / rate) * 100) / 100;
    return `${formatCurrency(amt, formCurrency)} = ~${formatCurrency(converted, baseCurrency)} (1 ${baseCurrency} = ${rate} ${formCurrency})`;
  }, [formAmount, formCurrency, baseCurrency, currentRates]);

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
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">{t('wallet.title')}</h1>
          {totalEur > 0 && activeTab === 'expenses' && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {t('wallet.totalSpent')}: {formatCurrency(totalEur, baseCurrency)}
            </p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-nav" role="tablist">
        <button
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
          role="tab"
          aria-selected={activeTab === 'expenses'}
        >
          <Receipt size={16} />
          <span>{t('wallet.expenses')}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
          role="tab"
          aria-selected={activeTab === 'balances'}
        >
          <BarChart3 size={16} />
          <span>{t('wallet.balances')}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'settlements' ? 'active' : ''}`}
          onClick={() => setActiveTab('settlements')}
          role="tab"
          aria-selected={activeTab === 'settlements'}
        >
          <Handshake size={16} />
          <span>{t('wallet.settlements')}</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'expenses' && (
          <ExpensesTab
            expenses={expenses}
            baseCurrency={baseCurrency}
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
            loading={loadingBalances}
            t={t}
          />
        )}

        {activeTab === 'settlements' && (
          <SettlementsTab
            settlements={settlements}
            baseCurrency={baseCurrency}
            exchangeRates={exchangeRates}
            loading={loadingSettlements}
            onToggleSettle={handleToggleSettle}
            t={t}
          />
        )}
      </div>

      {/* FAB: Add expense */}
      {activeTab === 'expenses' && (
        <button
          className="fab"
          onClick={openAddModal}
          aria-label={t('wallet.addExpense')}
          title={t('wallet.addExpense')}
        >
          <Plus size={24} />
        </button>
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowExpenseModal(false);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmitExpense}
              disabled={formSubmitting}
            >
              {formSubmitting ? t('common.loading') : t('common.save')}
            </button>
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingExpenseId(null);
              }}
            >
              {t('common.cancel')}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteExpense}>
              {t('common.delete')}
            </button>
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
  filter: FilterId;
  setFilter: (f: FilterId) => void;
  loading: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (id: number) => void;
  onAudit: (id: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: t('wallet.filterAll') },
    { id: 'mine', label: t('wallet.filterMine') },
    { id: 'boat1', label: 'Boat 1' },
    { id: 'boat2', label: 'Boat 2' },
  ];

  return (
    <div>
      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.id}
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          <RefreshCw size={24} className="spin" />
          <p>{t('common.loading')}</p>
        </div>
      ) : expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          <Receipt size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>{t('wallet.noExpenses')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {expenses.map(expense => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              baseCurrency={baseCurrency}
              onEdit={() => onEdit(expense)}
              onDelete={() => onDelete(expense.id)}
              onAudit={() => onAudit(expense.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expense Card ──

function ExpenseCard({
  expense,
  baseCurrency,
  onEdit,
  onDelete,
  onAudit,
  t,
}: {
  expense: Expense;
  baseCurrency: string;
  onEdit: () => void;
  onDelete: () => void;
  onAudit: () => void;
  t: (key: string) => string;
}) {
  const [showActions, setShowActions] = useState(false);
  const isConverted = expense.currency !== baseCurrency;

  return (
    <div className="card expense-card" style={{ cursor: 'pointer' }} onClick={onEdit}>
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
        {/* Avatar */}
        <Avatar
          name={expense.paid_by_name}
          avatar={expense.paid_by_avatar}
          size="sm"
          userId={expense.paid_by}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {expense.description}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {expense.paid_by_name} &middot; {formatDate(expense.expense_date)}
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {isConverted ? (
            <>
              <span className="amount-pill-czk" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>
                {formatCurrency(expense.amount, expense.currency)}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {formatCurrency(expense.amount_eur, baseCurrency)}
              </span>
            </>
          ) : (
            <span className="amount-pill-eur" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {formatCurrency(expense.amount_eur, baseCurrency)}
            </span>
          )}
        </div>

        {/* Actions toggle */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-outline"
            style={{ padding: '4px 6px', lineHeight: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            aria-label={t('common.actions')}
          >
            <ChevronDown size={14} />
          </button>
          {showActions && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 10,
                minWidth: 140,
                overflow: 'hidden',
              }}
            >
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onEdit();
                }}
              >
                <Pencil size={14} /> {t('common.edit')}
              </button>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onAudit();
                }}
              >
                <Receipt size={14} /> {t('wallet.auditLog')}
              </button>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-danger)',
                  fontFamily: 'inherit',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onDelete();
                }}
              >
                <Trash2 size={14} /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Balances Tab ──

function BalancesTab({
  balances,
  baseCurrency,
  loading,
  t,
}: {
  balances: UserBalance[];
  baseCurrency: string;
  loading: boolean;
  t: (key: string) => string;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={24} className="spin" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  // Filter out users with 0 paid and 0 share
  const activeBalances = balances.filter(b => b.paid !== 0 || b.share !== 0);

  if (activeBalances.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
        <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p>{t('wallet.noExpenses')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header row */}
      <div
        className="balance-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 90px 90px',
          gap: 16,
          padding: '10px 20px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span>Name</span>
        <span style={{ textAlign: 'right' }}>{t('dashboard.paid')}</span>
        <span style={{ textAlign: 'right' }}>Share</span>
        <span style={{ textAlign: 'right' }}>Balance</span>
      </div>

      {activeBalances.map(b => {
        const isPositive = b.balance > 0.01;
        const isNegative = b.balance < -0.01;

        return (
          <div
            key={b.user_id}
            className="card balance-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 90px 90px',
              gap: 16,
              alignItems: 'center',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Avatar name={b.name} avatar={b.avatar} size="sm" userId={b.user_id} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                  {b.boat_name}
                </div>
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(b.paid, baseCurrency)}
            </span>
            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(b.share, baseCurrency)}
            </span>
            <span
              style={{
                textAlign: 'right',
                fontWeight: 700,
                fontSize: '0.88rem',
                fontVariantNumeric: 'tabular-nums',
                color: isPositive
                  ? 'var(--color-success)'
                  : isNegative
                  ? 'var(--color-danger)'
                  : 'var(--color-text)',
              }}
            >
              {b.balance > 0 ? '+' : ''}{formatCurrency(b.balance, baseCurrency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Settlements Tab ──

function SettlementsTab({
  settlements,
  baseCurrency,
  exchangeRates,
  loading,
  onToggleSettle,
  t,
}: {
  settlements: Settlement[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  loading: boolean;
  onToggleSettle: (s: Settlement) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={24} className="spin" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
        <Handshake size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p>All settled up!</p>
      </div>
    );
  }

  // Show conversion for common currencies
  const showCurrencies = ['CZK', 'USD', 'GBP'].filter(
    c => c !== baseCurrency && exchangeRates[c]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {settlements.map((s, idx) => (
        <div
          key={`${s.from_user_id}-${s.to_user_id}`}
          className={`card settlement-item-v2 ${s.is_settled ? 'settled' : ''}`}
          style={{
            opacity: s.is_settled ? 0.6 : 1,
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* From user */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Avatar name={s.from_name} avatar={s.from_avatar} size="sm" userId={s.from_user_id} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                {s.from_name}
              </span>
            </div>

            <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />

            {/* To user */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Avatar name={s.to_name} avatar={s.to_avatar} size="sm" userId={s.to_user_id} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                {s.to_name}
              </span>
            </div>

            {/* Amount */}
            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-danger)' }}>
                {formatCurrency(s.amount, baseCurrency)}
              </div>
              {showCurrencies.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                  {showCurrencies.map(c => {
                    const converted = Math.round(s.amount * exchangeRates[c] * 100) / 100;
                    return (
                      <span key={c} style={{ marginRight: 8 }}>
                        ~{formatCurrency(converted, c)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Settle button */}
            <button
              className={`btn btn-sm ${s.is_settled ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => onToggleSettle(s)}
              style={{ flexShrink: 0, minWidth: 44 }}
            >
              {s.is_settled ? (
                <>
                  <X size={14} />
                  <span style={{ marginLeft: 4 }}>{t('wallet.unmarkSettled')}</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span style={{ marginLeft: 4 }}>{t('wallet.markSettled')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
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
  conversionHint: string | null;
  baseCurrency: string;
  categories: { value: string; label: string }[];
  t: (key: string) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Paid by */}
      <div className="form-group">
        <label className="form-label">{t('wallet.paidBy')}</label>
        <select
          className="form-control"
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">{t('wallet.amount')}</label>
          <input
            type="number"
            className="form-control"
            value={formAmount}
            onChange={e => setFormAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            inputMode="decimal"
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('wallet.currency')}</label>
          <select
            className="form-control"
            value={formCurrency}
            onChange={e => setFormCurrency(e.target.value)}
          >
            {CURRENCY_CODES.map(code => {
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
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--color-bg-secondary)',
            borderRadius: 8,
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)',
            marginTop: -8,
          }}
        >
          {conversionHint}
        </div>
      )}

      {/* Description */}
      <div className="form-group">
        <label className="form-label">{t('wallet.description')}</label>
        <input
          type="text"
          className="form-control"
          value={formDescription}
          onChange={e => setFormDescription(e.target.value)}
          placeholder={t('wallet.description')}
          maxLength={200}
        />
      </div>

      {/* Category + Date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">{t('wallet.category')}</label>
          <select
            className="form-control"
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
        <div className="form-group">
          <label className="form-label">{t('wallet.date')}</label>
          <input
            type="datetime-local"
            className="form-control"
            value={formDate}
            onChange={e => setFormDate(e.target.value)}
          />
        </div>
      </div>

      {/* Split type */}
      <div className="form-group">
        <label className="form-label">{t('wallet.splitType')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { value: 'both', label: t('wallet.bothBoats') },
            { value: 'boat1', label: t('wallet.boat1Only') },
            { value: 'boat2', label: t('wallet.boat2Only') },
          ].map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: `2px solid ${formSplitType === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: formSplitType === opt.value ? 'var(--color-primary-bg)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: formSplitType === opt.value ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="split_type"
                value={opt.value}
                checked={formSplitType === opt.value}
                onChange={() => setFormSplitType(opt.value)}
                style={{ display: 'none' }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Split users */}
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>
            {t('wallet.splitBetween')} ({formSplitUsers.length}/{usersForSplitType.length})
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={selectAllSplitUsers}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              {t('common.all')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={deselectAllSplitUsers}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              None
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {usersForSplitType.map(u => {
            const selected = formSplitUsers.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleSplitUser(u.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: selected ? 'var(--color-primary-bg)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: selected ? 600 : 400,
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                <Avatar name={u.name} avatar={u.avatar} size="sm" userId={u.id} />
                {u.name}
                {selected && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
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
      <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>
        No audit history found.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {logs.map(log => (
        <div
          key={log.id}
          style={{
            padding: '12px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span
              className={`badge ${
                log.change_type === 'create'
                  ? 'badge-success'
                  : log.change_type === 'edit'
                  ? 'badge-warning'
                  : 'badge-danger'
              }`}
              style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}
            >
              {log.change_type}
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
              {formatDateTime(log.changed_at)}
            </span>
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            by {log.changed_by_name || 'Unknown'}
          </div>
          {log.change_type === 'edit' && log.old_values && log.new_values && (
            <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
              {Object.keys(log.new_values).map(key => {
                const oldVal = log.old_values?.[key];
                const newVal = log.new_values?.[key];
                if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                if (key === 'split_users') return null;
                return (
                  <div key={key} style={{ marginBottom: 2 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{key}:</span>{' '}
                    <span style={{ textDecoration: 'line-through', color: 'var(--color-danger)', opacity: 0.7 }}>
                      {String(oldVal ?? '')}
                    </span>{' '}
                    <ArrowRight size={10} style={{ display: 'inline' }} />{' '}
                    <span style={{ color: 'var(--color-success)' }}>
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
