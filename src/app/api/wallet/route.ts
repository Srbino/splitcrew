import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute, getSetting, setSetting, getAllUsers, pool } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { convertToBase, CANONICAL_CURRENCY } from '@/lib/currencies';
import { getExchangeRate, getExchangeRates, getExchangeRateForDate, syncRatesForRange } from '@/lib/exchange';
import { computeBalances, computeSettlements, aggregateByCategory, aggregateByPayer, aggregateByPayerCategory, summarize } from '@/lib/wallet-calc';
import { notifyBroadcast, notifyUser } from '@/lib/notifications';

// ── Types ──

interface ExpenseRow {
  id: number;
  paid_by: number;
  amount: string;
  currency: string;
  amount_eur: string;
  exchange_rate: string | null;
  description: string;
  category: string;
  expense_date: string;
  split_type: string;
  photo: string | null;
  created_by: number | null;
  created_at: string;
  paid_by_name: string;
  paid_by_avatar: string | null;
  paid_by_boat_id: number;
}

interface SplitRow {
  id: number;
  expense_id: number;
  user_id: number;
  amount_eur: string;
}

interface BalanceRow {
  user_id: number;
  name: string;
  avatar: string | null;
  boat_id: number;
  paid: string | null;
  share: string | null;
}

interface AuditRow {
  id: number;
  expense_id: number;
  changed_by: number | null;
  change_type: string;
  old_values: string | null;
  new_values: string | null;
  changed_at: string;
  changed_by_name: string | null;
}

interface SettledRow {
  id: number;
  from_user_id: number;
  to_user_id: number;
  settled_at: string;
  settled_by: number | null;
}

// ── GET ──

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list':
        return handleList(searchParams, session.userId || 0, session.boatId || 0);
      case 'balances':
        return handleBalances();
      case 'settlements':
        return handleSettlements();
      case 'audit':
        return handleAudit(searchParams);
      case 'rate':
        return handleRate();
      case 'sync_rates':
        return handleSyncRates();
      case 'full_audit':
        return handleFullAudit();
      case 'status':
        return handleStatus();
      case 'summary':
        return handleSummary();
      case 'list_pending':
        return handleListPending(session);
      default:
        return apiError('Unknown action');
    }
  } catch (err) {
    console.error('Wallet GET error:', err);
    return apiError('Server error', 500);
  }
}

async function handleList(
  searchParams: URLSearchParams,
  userId: number,
  userBoatId: number
) {
  const filter = searchParams.get('filter') || 'all';
  const baseCurrency = await getSetting('base_currency', 'EUR');

  let whereClause = '';
  const params: unknown[] = [];

  if (filter === 'mine') {
    params.push(userId, userId);
    whereClause = `WHERE (e.paid_by = $${params.length - 1} OR EXISTS (SELECT 1 FROM wallet_expense_splits wes WHERE wes.expense_id = e.id AND wes.user_id = $${params.length}))`;
  } else if (filter.startsWith('boat_')) {
    // Dynamic boat filter: boat_1, boat_2, boat_3, etc.
    // Handles both new format (split_type='1') and legacy format (split_type='boat1')
    const boatId = filter.replace('boat_', '');
    params.push(boatId, `boat${boatId}`);
    whereClause = `WHERE (e.split_type = 'both' OR e.split_type = $${params.length - 1} OR e.split_type = $${params.length})`;
  }

  const expenses = await query<ExpenseRow>(
    `SELECT e.*, u.name AS paid_by_name, CASE WHEN u.avatar IS NOT NULL THEN '/api/avatar/' || u.id ELSE NULL END AS paid_by_avatar, u.boat_id AS paid_by_boat_id
     FROM wallet_expenses e
     LEFT JOIN users u ON e.paid_by = u.id
     ${whereClause}
     ORDER BY e.expense_date DESC, e.id DESC`,
    params
  );

  // Load splits for each expense
  const expenseIds = expenses.map(e => e.id);
  let splitsByExpense: Record<number, number[]> = {};
  let splitAmountsByExpense: Record<number, Record<number, number>> = {};

  if (expenseIds.length > 0) {
    const placeholders = expenseIds.map((_, i) => `$${i + 1}`).join(',');
    const splits = await query<SplitRow>(
      `SELECT * FROM wallet_expense_splits WHERE expense_id IN (${placeholders})`,
      expenseIds
    );

    for (const s of splits) {
      if (!splitsByExpense[s.expense_id]) {
        splitsByExpense[s.expense_id] = [];
        splitAmountsByExpense[s.expense_id] = {};
      }
      splitsByExpense[s.expense_id].push(s.user_id);
      splitAmountsByExpense[s.expense_id][s.user_id] = parseFloat(s.amount_eur);
    }
  }

  // Calculate total in base currency
  const totalResult = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(e.amount_eur), 0) AS total FROM wallet_expenses e ${whereClause}`,
    params
  );
  const totalEur = parseFloat(totalResult?.total || '0');

  const data = expenses.map(e => ({
    id: e.id,
    paid_by: e.paid_by,
    paid_by_name: e.paid_by_name,
    paid_by_avatar: e.paid_by_avatar,
    paid_by_boat_id: e.paid_by_boat_id,
    amount: parseFloat(e.amount),
    currency: e.currency,
    amount_eur: parseFloat(e.amount_eur),
    exchange_rate: e.exchange_rate ? parseFloat(e.exchange_rate) : null,
    description: e.description,
    category: e.category,
    expense_date: e.expense_date,
    split_type: e.split_type,
    photo: e.photo,
    created_by: e.created_by,
    created_at: e.created_at,
    split_user_ids: splitsByExpense[e.id] || [],
    split_amounts: splitAmountsByExpense[e.id] || {},
  }));

  // Compute display rate for client-side conversion
  const displayCurrency = baseCurrency;
  let displayRate = 1;
  if (displayCurrency !== CANONICAL_CURRENCY) {
    try {
      const rates = await getExchangeRates(CANONICAL_CURRENCY);
      displayRate = rates[displayCurrency] ?? 1;
    } catch { /* fallback to 1 */ }
  }

  return apiSuccess({
    expenses: data,
    total_eur: totalEur,
    base_currency: displayCurrency,
    display_rate: displayRate,
  });
}

async function handleBalances() {
  const baseCurrency = await getSetting('base_currency', 'EUR');
  const users = await getAllUsers();

  // Get paid totals per user
  const paidRows = await query<{ paid_by: number; total: string }>(
    `SELECT paid_by, COALESCE(SUM(amount_eur), 0) AS total
     FROM wallet_expenses GROUP BY paid_by`
  );
  const paidMap: Record<number, number> = {};
  for (const r of paidRows) {
    paidMap[r.paid_by] = parseFloat(r.total);
  }

  // Get share totals per user
  const shareRows = await query<{ user_id: number; total: string }>(
    `SELECT user_id, COALESCE(SUM(amount_eur), 0) AS total
     FROM wallet_expense_splits GROUP BY user_id`
  );
  const shareMap: Record<number, number> = {};
  for (const r of shareRows) {
    shareMap[r.user_id] = parseFloat(r.total);
  }

  const computed = computeBalances(users.map(u => u.id), paidMap, shareMap);
  const computedById = new Map(computed.map(c => [c.userId, c]));
  const balances = users.map(u => {
    const c = computedById.get(u.id)!;
    return {
      user_id: u.id,
      name: u.name,
      avatar: u.avatar ? `/api/avatar/${u.id}` : null,
      boat_id: u.boat_id,
      boat_name: u.boat_name,
      paid: c.paid,
      share: c.share,
      balance: c.balance,
    };
  });

  // Compute display rate for client-side conversion
  let displayRate = 1;
  if (baseCurrency !== CANONICAL_CURRENCY) {
    try {
      const rates = await getExchangeRates(CANONICAL_CURRENCY);
      displayRate = rates[baseCurrency] ?? 1;
    } catch { /* fallback to 1 */ }
  }

  return apiSuccess({ balances, base_currency: baseCurrency, display_rate: displayRate });
}

async function handleSettlements() {
  const baseCurrency = await getSetting('base_currency', 'EUR');
  const users = await getAllUsers();

  // Build balance map
  const paidRows = await query<{ paid_by: number; total: string }>(
    `SELECT paid_by, COALESCE(SUM(amount_eur), 0) AS total
     FROM wallet_expenses GROUP BY paid_by`
  );
  const paidMap: Record<number, number> = {};
  for (const r of paidRows) {
    paidMap[r.paid_by] = parseFloat(r.total);
  }

  const shareRows = await query<{ user_id: number; total: string }>(
    `SELECT user_id, COALESCE(SUM(amount_eur), 0) AS total
     FROM wallet_expense_splits GROUP BY user_id`
  );
  const shareMap: Record<number, number> = {};
  for (const r of shareRows) {
    shareMap[r.user_id] = parseFloat(r.total);
  }

  // Compute balances + greedy settlements via the shared pure helpers
  const balances = computeBalances(users.map(u => u.id), paidMap, shareMap);
  const settlements = computeSettlements(balances);

  // Load settled status
  const settledRows = await query<SettledRow>('SELECT * FROM wallet_settled');
  const settledSet = new Set(
    settledRows.map(r => `${r.from_user_id}-${r.to_user_id}`)
  );

  // Get exchange rates for display (always from EUR since amounts are in EUR)
  let exchangeRates: Record<string, number> = {};
  let displayRate = 1;
  try {
    exchangeRates = await getExchangeRates(CANONICAL_CURRENCY);
    if (baseCurrency !== CANONICAL_CURRENCY) {
      displayRate = exchangeRates[baseCurrency] ?? 1;
    }
  } catch {
    // ignore
  }

  const userMap: Record<number, (typeof users)[number]> = {};
  for (const u of users) {
    userMap[u.id] = u;
  }

  const result = settlements.map(s => ({
    from_user_id: s.from_user_id,
    from_name: userMap[s.from_user_id]?.name || 'Unknown',
    from_avatar: userMap[s.from_user_id]?.avatar || null,
    to_user_id: s.to_user_id,
    to_name: userMap[s.to_user_id]?.name || 'Unknown',
    to_avatar: userMap[s.to_user_id]?.avatar || null,
    amount: s.amount,
    is_settled: settledSet.has(`${s.from_user_id}-${s.to_user_id}`),
  }));

  return apiSuccess({
    settlements: result,
    base_currency: baseCurrency,
    display_rate: displayRate,
    exchange_rates: exchangeRates,
  });
}

async function handleAudit(searchParams: URLSearchParams) {
  const expenseId = parseInt(searchParams.get('expense_id') || '0');
  if (!expenseId) {
    return apiError('Missing expense_id');
  }

  const logs = await query<AuditRow>(
    `SELECT a.*, u.name AS changed_by_name
     FROM wallet_audit_log a
     LEFT JOIN users u ON a.changed_by = u.id
     WHERE a.expense_id = $1
     ORDER BY a.changed_at DESC`,
    [expenseId]
  );

  return apiSuccess({
    logs: logs.map(l => ({
      id: l.id,
      expense_id: l.expense_id,
      changed_by: l.changed_by,
      changed_by_name: l.changed_by_name,
      change_type: l.change_type,
      old_values: l.old_values ? JSON.parse(l.old_values) : null,
      new_values: l.new_values ? JSON.parse(l.new_values) : null,
      changed_at: l.changed_at,
    })),
  });
}

async function handleRate() {
  const displayCurrency = await getSetting('base_currency', 'EUR');
  let rates: Record<string, number> = {};
  try {
    rates = await getExchangeRates(CANONICAL_CURRENCY);
  } catch {
    // ignore
  }
  const displayRate = displayCurrency !== CANONICAL_CURRENCY
    ? (rates[displayCurrency] ?? 1)
    : 1;
  return apiSuccess({ base_currency: displayCurrency, rates, display_rate: displayRate });
}

/**
 * Sync exchange rates for the trip date range (and a buffer around it).
 * Fetches historical rates from Frankfurter API and stores per-day.
 */
async function handleSyncRates() {
  const baseCurrency = CANONICAL_CURRENCY; // Always sync EUR rates
  const tripFrom = await getSetting('trip_date_from', '');
  const tripTo = await getSetting('trip_date_to', '');

  // Determine date range: trip period ± 7 days buffer, or last 30 days if no trip dates
  let fromDate: string;
  let toDate: string;

  if (tripFrom && tripTo) {
    const from = new Date(tripFrom);
    from.setDate(from.getDate() - 7);
    const to = new Date(tripTo);
    to.setDate(to.getDate() + 7);
    // Cap toDate at today (can't fetch future rates)
    const today = new Date();
    if (to > today) to.setTime(today.getTime());
    fromDate = from.toISOString().slice(0, 10);
    toDate = to.toISOString().slice(0, 10);
  } else {
    // No trip dates — sync last 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    fromDate = from.toISOString().slice(0, 10);
    toDate = to.toISOString().slice(0, 10);
  }

  const result = await syncRatesForRange(baseCurrency, fromDate, toDate);

  return apiSuccess({
    base_currency: baseCurrency,
    from_date: fromDate,
    to_date: toDate,
    ...result,
  });
}

// ── POST ──

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    // CSRF check
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const action = body.action;
    // Admin has no userId — use null for FK-safe DB operations
    const userId = session.userId || null;
    const isAdmin = !!session.isAdmin;

    switch (action) {
      case 'add': {
        // When the wallet is closed, non-admins must submit a request instead
        if (!isAdmin && (await getSetting('wallet_status', 'open')) === 'closed') {
          return apiError('Wallet is closed. Submit this expense for admin approval instead.', 409);
        }
        return handleAdd(body, userId);
      }
      case 'edit': {
        if (!isAdmin && (await getSetting('wallet_status', 'open')) === 'closed') {
          return apiError('Wallet is closed. Ask an admin to change this expense.', 409);
        }
        return handleEdit(body, userId);
      }
      case 'delete': {
        if (!isAdmin && (await getSetting('wallet_status', 'open')) === 'closed') {
          return apiError('Wallet is closed. Ask an admin to remove this expense.', 409);
        }
        return handleDelete(body, userId);
      }
      case 'settle': {
        const role = isAdmin ? 'admin' : (session.role || 'crew');
        return handleSettle(body, userId, role);
      }
      case 'close':
        if (!isAdmin) return apiError('Only an admin can close the wallet.', 403);
        return handleClose(userId);
      case 'reopen':
        if (!isAdmin) return apiError('Only an admin can reopen the wallet.', 403);
        return handleReopen();
      case 'submit_pending':
        return handleSubmitPending(body, userId);
      case 'approve_pending':
        if (!isAdmin) return apiError('Only an admin can approve.', 403);
        return handleApprovePending(body, userId);
      case 'reject_pending':
        if (!isAdmin) return apiError('Only an admin can reject.', 403);
        return handleRejectPending(body, userId);
      default:
        return apiError('Unknown action');
    }
  } catch (err) {
    console.error('Wallet POST error:', err);
    return apiError('Server error', 500);
  }
}

async function handleAdd(
  body: {
    paid_by: number;
    amount: number;
    currency: string;
    description: string;
    category?: string;
    expense_date: string;
    split_type: string;
    split_users: number[];
  },
  createdBy: number | null
) {
  const {
    paid_by,
    amount,
    currency,
    description,
    category = 'other',
    expense_date,
    split_type = 'both',
    split_users,
  } = body;

  // Validation
  if (!paid_by || !amount || amount <= 0) {
    return apiError('Amount and payer are required');
  }
  if (!description || !description.trim()) {
    return apiError('Description is required');
  }
  if (!split_users || split_users.length === 0) {
    return apiError('Select at least one person to split with');
  }
  if (!expense_date) {
    return apiError('Date is required');
  }

  try {
    const expenseId = await insertExpenseWithSplits(
      { paid_by, amount, currency, description, category, expense_date, split_type, split_users },
      createdBy,
    );
    return apiSuccess({ id: expenseId });
  } catch (err) {
    if (err instanceof RateError) return apiError(err.message);
    throw err;
  }
}

/** Error thrown when an exchange rate can't be resolved. */
class RateError extends Error {}

interface ExpenseFields {
  paid_by: number;
  amount: number;
  currency: string;
  description: string;
  category: string;
  expense_date: string;
  split_type: string;
  split_users: number[];
}

/**
 * Convert to EUR, insert the expense + per-person splits + a 'create' audit entry,
 * all in one transaction. Shared by handleAdd and pending-expense approval.
 */
async function insertExpenseWithSplits(
  fields: ExpenseFields,
  createdBy: number | null,
): Promise<number> {
  const { paid_by, amount, currency, description, category = 'other', expense_date, split_type = 'both', split_users } = fields;

  const storageCurrency = CANONICAL_CURRENCY; // Always store in EUR
  let amountBase = amount;
  let exchangeRate: number | null = null;

  const parsedDate = parseExpenseDate(expense_date);
  const expenseDateStr = parsedDate.slice(0, 10);

  if (currency !== storageCurrency) {
    const rate = await getExchangeRateForDate(storageCurrency, currency, expenseDateStr);
    if (rate <= 0) {
      throw new RateError(`Could not get exchange rate for ${currency} on ${expenseDateStr}`);
    }
    exchangeRate = rate;
    amountBase = convertToBase(amount, rate);
  }

  const count = split_users.length;
  const perPerson = Math.floor((amountBase / count) * 100) / 100;
  const remainder = Math.round((amountBase - perPerson * count) * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const expenseResult = await client.query(
      `INSERT INTO wallet_expenses
       (paid_by, amount, currency, amount_eur, exchange_rate, description, category, expense_date, split_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [paid_by, amount, currency, amountBase, exchangeRate, description.trim(), category, parsedDate, split_type, createdBy],
    );
    const expenseId = expenseResult.rows[0].id;

    for (let i = 0; i < split_users.length; i++) {
      const splitAmount = i === 0 ? perPerson + remainder : perPerson;
      await client.query(
        `INSERT INTO wallet_expense_splits (expense_id, user_id, amount_eur) VALUES ($1, $2, $3)`,
        [expenseId, split_users[i], splitAmount],
      );
    }

    const newValues = {
      paid_by, amount, currency, amount_eur: amountBase, exchange_rate: exchangeRate,
      description: description.trim(), category, expense_date: parsedDate, split_type, split_users,
    };
    await client.query(
      `INSERT INTO wallet_audit_log (expense_id, changed_by, change_type, new_values) VALUES ($1, $2, 'create', $3)`,
      [expenseId, createdBy, JSON.stringify(newValues)],
    );

    await client.query('COMMIT');
    return expenseId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleEdit(
  body: {
    id: number;
    paid_by: number;
    amount: number;
    currency: string;
    description: string;
    category?: string;
    expense_date: string;
    split_type: string;
    split_users: number[];
  },
  changedBy: number | null
) {
  const {
    id,
    paid_by,
    amount,
    currency,
    description,
    category = 'other',
    expense_date,
    split_type = 'both',
    split_users,
  } = body;

  if (!id) return apiError('Missing expense ID');
  if (!paid_by || !amount || amount <= 0) {
    return apiError('Amount and payer are required');
  }
  if (!description || !description.trim()) {
    return apiError('Description is required');
  }
  if (!split_users || split_users.length === 0) {
    return apiError('Select at least one person to split with');
  }

  // Load existing expense
  const existing = await queryOne<ExpenseRow>(
    `SELECT e.*, u.name AS paid_by_name, CASE WHEN u.avatar IS NOT NULL THEN '/api/avatar/' || u.id ELSE NULL END AS paid_by_avatar, u.boat_id AS paid_by_boat_id
     FROM wallet_expenses e
     LEFT JOIN users u ON e.paid_by = u.id
     WHERE e.id = $1`,
    [id]
  );
  if (!existing) {
    return apiError('Expense not found', 404);
  }

  const storageCurrency = CANONICAL_CURRENCY; // Always store in EUR
  let amountBase = amount;
  let exchangeRate: number | null = null;

  // Parse expense date for rate lookup
  const parsedDate = parseExpenseDate(expense_date);
  const expenseDateStr = parsedDate.slice(0, 10);

  // Currency conversion — always convert to EUR for storage
  // If same currency and same date, reuse original rate for consistency
  if (currency !== storageCurrency) {
    const origDate = existing.expense_date
      ? new Date(existing.expense_date).toISOString().slice(0, 10)
      : '';

    if (
      currency === existing.currency &&
      expenseDateStr === origDate &&
      existing.exchange_rate
    ) {
      // Same currency + same date → reuse original rate for consistency
      exchangeRate = parseFloat(existing.exchange_rate);
    } else {
      // Different currency or different date → fetch the rate for the new date
      const rate = await getExchangeRateForDate(storageCurrency, currency, expenseDateStr);
      if (rate <= 0) {
        return apiError(`Could not get exchange rate for ${currency} on ${expenseDateStr}`);
      }
      exchangeRate = rate;
    }
    amountBase = convertToBase(amount, exchangeRate);
  }

  // Calculate splits
  const count = split_users.length;
  const perPerson = Math.floor((amountBase / count) * 100) / 100;
  const remainder = Math.round((amountBase - perPerson * count) * 100) / 100;

  // Load old splits for audit
  const oldSplits = await query<SplitRow>(
    'SELECT * FROM wallet_expense_splits WHERE expense_id = $1',
    [id]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parsedDate = parseExpenseDate(expense_date);

    // Update expense
    await client.query(
      `UPDATE wallet_expenses SET
         paid_by = $1, amount = $2, currency = $3, amount_eur = $4,
         exchange_rate = $5, description = $6, category = $7,
         expense_date = $8, split_type = $9
       WHERE id = $10`,
      [
        paid_by,
        amount,
        currency,
        amountBase,
        exchangeRate,
        description.trim(),
        category,
        parsedDate,
        split_type,
        id,
      ]
    );

    // Delete old splits, insert new ones
    await client.query(
      'DELETE FROM wallet_expense_splits WHERE expense_id = $1',
      [id]
    );

    for (let i = 0; i < split_users.length; i++) {
      const splitAmount = i === 0 ? perPerson + remainder : perPerson;
      await client.query(
        `INSERT INTO wallet_expense_splits (expense_id, user_id, amount_eur)
         VALUES ($1, $2, $3)`,
        [id, split_users[i], splitAmount]
      );
    }

    // Audit log
    const oldValues = {
      paid_by: existing.paid_by,
      amount: parseFloat(existing.amount),
      currency: existing.currency,
      amount_eur: parseFloat(existing.amount_eur),
      exchange_rate: existing.exchange_rate ? parseFloat(existing.exchange_rate) : null,
      description: existing.description,
      category: existing.category,
      expense_date: existing.expense_date,
      split_type: existing.split_type,
      split_users: oldSplits.map(s => s.user_id),
    };
    const newValues = {
      paid_by,
      amount,
      currency,
      amount_eur: amountBase,
      exchange_rate: exchangeRate,
      description: description.trim(),
      category,
      expense_date: parsedDate,
      split_type,
      split_users,
    };

    await client.query(
      `INSERT INTO wallet_audit_log (expense_id, changed_by, change_type, old_values, new_values)
       VALUES ($1, $2, 'edit', $3, $4)`,
      [id, changedBy, JSON.stringify(oldValues), JSON.stringify(newValues)]
    );

    await client.query('COMMIT');

    return apiSuccess({ id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleDelete(
  body: { id: number },
  deletedBy: number | null
) {
  const { id } = body;
  if (!id) return apiError('Missing expense ID');

  // Verify it exists
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM wallet_expenses WHERE id = $1',
    [id]
  );
  if (!existing) {
    return apiError('Expense not found', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete audit logs
    await client.query(
      'DELETE FROM wallet_audit_log WHERE expense_id = $1',
      [id]
    );

    // Delete splits
    await client.query(
      'DELETE FROM wallet_expense_splits WHERE expense_id = $1',
      [id]
    );

    // Delete expense
    await client.query('DELETE FROM wallet_expenses WHERE id = $1', [id]);

    await client.query('COMMIT');

    return apiSuccess({ deleted: id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleSettle(
  body: { from_user_id: number; to_user_id: number; settled: boolean },
  settledBy: number | null,
  performerRole?: string
) {
  const { from_user_id, to_user_id, settled } = body;

  if (!from_user_id || !to_user_id) {
    return apiError('Missing user IDs');
  }

  // Permission check: admin can settle anything; captain can settle for their boat;
  // crew member can only settle if they are one of the two parties
  if (performerRole !== 'admin') {
    const isParty = settledBy === from_user_id || settledBy === to_user_id;
    if (!isParty && performerRole !== 'captain') {
      return apiError('You can only settle your own debts.');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (settled) {
      await client.query(
        `INSERT INTO wallet_settled (from_user_id, to_user_id, settled_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
           settled_at = CURRENT_TIMESTAMP, settled_by = EXCLUDED.settled_by`,
        [from_user_id, to_user_id, settledBy]
      );
    } else {
      await client.query(
        'DELETE FROM wallet_settled WHERE from_user_id = $1 AND to_user_id = $2',
        [from_user_id, to_user_id]
      );
    }

    // Audit trail
    await client.query(
      `INSERT INTO settlement_audit_log (from_user_id, to_user_id, action, performed_by, performer_role)
       VALUES ($1, $2, $3, $4, $5)`,
      [from_user_id, to_user_id, settled ? 'settled' : 'unsettled', settledBy, performerRole || null]
    );

    await client.query('COMMIT');
    return apiSuccess({ settled });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Full audit log — expenses + settlements (for admin) */
async function handleFullAudit() {
  const expenseAudits = await query<{
    id: number; expense_id: number; changed_by_name: string | null;
    change_type: string; changed_at: string; description: string | null;
  }>(
    `SELECT wal.id, wal.expense_id, u.name as changed_by_name,
            wal.change_type, wal.changed_at,
            we.description
     FROM wallet_audit_log wal
     LEFT JOIN users u ON wal.changed_by = u.id
     LEFT JOIN wallet_expenses we ON wal.expense_id = we.id
     ORDER BY wal.changed_at DESC LIMIT 50`
  );

  const settlementAudits = await query<{
    id: number; from_name: string; to_name: string;
    action: string; performer_name: string | null;
    performer_role: string | null; created_at: string;
  }>(
    `SELECT sal.id, uf.name as from_name, ut.name as to_name,
            sal.action, up.name as performer_name,
            sal.performer_role, sal.created_at
     FROM settlement_audit_log sal
     LEFT JOIN users uf ON sal.from_user_id = uf.id
     LEFT JOIN users ut ON sal.to_user_id = ut.id
     LEFT JOIN users up ON sal.performed_by = up.id
     ORDER BY sal.created_at DESC LIMIT 50`
  );

  return apiSuccess({ expense_audits: expenseAudits, settlement_audits: settlementAudits });
}

// ── Wallet close / overview / approval ──

async function getDisplayRate(baseCurrency: string): Promise<number> {
  if (baseCurrency === CANONICAL_CURRENCY) return 1;
  try {
    const rates = await getExchangeRates(CANONICAL_CURRENCY);
    return rates[baseCurrency] ?? 1;
  } catch {
    return 1;
  }
}

async function handleStatus() {
  const status = await getSetting('wallet_status', 'open');
  const closedAt = await getSetting('wallet_closed_at', '');
  const closedBy = await getSetting('wallet_closed_by', '');
  const pendingRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM wallet_pending_expenses WHERE status = 'pending'`,
  );
  return apiSuccess({
    status,
    closed_at: closedAt || null,
    closed_by: closedBy || null,
    pending_count: parseInt(pendingRow?.count || '0'),
  });
}

/** Aggregated data for the overview tab + charts + full who-owes-whom. */
async function handleSummary() {
  const baseCurrency = await getSetting('base_currency', 'EUR');
  const users = await getAllUsers();
  const userMap = new Map(users.map(u => [u.id, u]));

  const rawExpenses = await query<{ amount_eur: string; category: string; paid_by: number }>(
    `SELECT amount_eur, category, paid_by FROM wallet_expenses`,
  );
  const expenses = rawExpenses.map(e => ({
    amount_eur: parseFloat(e.amount_eur),
    category: e.category,
    paid_by: e.paid_by,
  }));

  const summary = summarize(expenses);
  const byCategory = aggregateByCategory(expenses);
  const byPayer = aggregateByPayer(expenses).map(p => ({
    ...p,
    name: userMap.get(p.paid_by)?.name || 'Unknown',
    avatar: userMap.get(p.paid_by)?.avatar ? `/api/avatar/${p.paid_by}` : null,
    boat_id: userMap.get(p.paid_by)?.boat_id ?? 0,
  }));

  // Full who-owes-whom (every outstanding transfer, not just the marked ones)
  const paidRows = await query<{ paid_by: number; total: string }>(
    `SELECT paid_by, COALESCE(SUM(amount_eur), 0) AS total FROM wallet_expenses GROUP BY paid_by`,
  );
  const paidMap: Record<number, number> = {};
  for (const r of paidRows) paidMap[r.paid_by] = parseFloat(r.total);
  const shareRows = await query<{ user_id: number; total: string }>(
    `SELECT user_id, COALESCE(SUM(amount_eur), 0) AS total FROM wallet_expense_splits GROUP BY user_id`,
  );
  const shareMap: Record<number, number> = {};
  for (const r of shareRows) shareMap[r.user_id] = parseFloat(r.total);

  const balances = computeBalances(users.map(u => u.id), paidMap, shareMap);
  const settledRows = await query<SettledRow>('SELECT * FROM wallet_settled');
  const settledSet = new Set(settledRows.map(r => `${r.from_user_id}-${r.to_user_id}`));
  const settlements = computeSettlements(balances).map(s => ({
    from_user_id: s.from_user_id,
    from_name: userMap.get(s.from_user_id)?.name || 'Unknown',
    from_avatar: userMap.get(s.from_user_id)?.avatar ? `/api/avatar/${s.from_user_id}` : null,
    to_user_id: s.to_user_id,
    to_name: userMap.get(s.to_user_id)?.name || 'Unknown',
    to_avatar: userMap.get(s.to_user_id)?.avatar ? `/api/avatar/${s.to_user_id}` : null,
    amount: s.amount,
    is_settled: settledSet.has(`${s.from_user_id}-${s.to_user_id}`),
  }));

  // Person × category matrix (who paid what on fuel / food / …)
  const matrixRaw = aggregateByPayerCategory(expenses);
  const matrix = {
    categories: matrixRaw.categories,
    columnTotals: matrixRaw.columnTotals,
    grandTotal: matrixRaw.grandTotal,
    rows: matrixRaw.rows.map(r => ({
      ...r,
      name: userMap.get(r.paid_by)?.name || 'Unknown',
      avatar: userMap.get(r.paid_by)?.avatar ? `/api/avatar/${r.paid_by}` : null,
    })),
  };

  return apiSuccess({
    summary,
    by_category: byCategory,
    by_payer: byPayer,
    matrix,
    settlements,
    base_currency: baseCurrency,
    display_rate: await getDisplayRate(baseCurrency),
  });
}

interface PendingRow {
  id: number;
  paid_by: number;
  amount: string;
  currency: string;
  description: string;
  category: string;
  expense_date: string;
  split_type: string;
  split_user_ids: string;
  requested_by: number | null;
  note: string | null;
  status: string;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  paid_by_name: string | null;
  requested_by_name: string | null;
}

async function handleListPending(session: { userId?: number; isAdmin?: boolean }) {
  const isAdmin = !!session.isAdmin;
  const params: unknown[] = [];
  let whereClause = `WHERE p.status = 'pending'`;
  if (!isAdmin) {
    params.push(session.userId || 0);
    whereClause = `WHERE p.requested_by = $1`; // members see all their own requests (any status)
  }
  const rows = await query<PendingRow>(
    `SELECT p.*, pu.name AS paid_by_name, ru.name AS requested_by_name
     FROM wallet_pending_expenses p
     LEFT JOIN users pu ON p.paid_by = pu.id
     LEFT JOIN users ru ON p.requested_by = ru.id
     ${whereClause}
     ORDER BY p.created_at DESC`,
    params,
  );
  const pending = rows.map(r => ({
    id: r.id,
    paid_by: r.paid_by,
    paid_by_name: r.paid_by_name,
    amount: parseFloat(r.amount),
    currency: r.currency,
    description: r.description,
    category: r.category,
    expense_date: r.expense_date,
    split_type: r.split_type,
    split_user_ids: safeParseIds(r.split_user_ids),
    requested_by: r.requested_by,
    requested_by_name: r.requested_by_name,
    note: r.note,
    status: r.status,
    review_note: r.review_note,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
  }));
  return apiSuccess({ pending });
}

async function handleClose(closedBy: number | null) {
  const current = await getSetting('wallet_status', 'open');
  if (current === 'closed') {
    return handleStatus(); // idempotent — keep original closed_at
  }
  const now = new Date().toISOString();
  await setSetting('wallet_status', 'closed');
  await setSetting('wallet_closed_at', now);
  await setSetting('wallet_closed_by', closedBy ? String(closedBy) : 'admin');

  await notifyBroadcast(
    'wallet_closed',
    'Peněženka byla uzavřena',
    'Výlet je vyúčtovaný. Podívej se na přehled a kdo komu dluží. Zapomněl jsi výdaj? Pošli ho ke schválení adminovi.',
    '/wallet',
  );
  return handleStatus();
}

async function handleReopen() {
  await setSetting('wallet_status', 'open');
  await setSetting('wallet_closed_at', '');
  await setSetting('wallet_closed_by', '');
  await notifyBroadcast(
    'wallet_reopened',
    'Peněženka je opět otevřená',
    'Admin znovu otevřel peněženku — můžeš normálně přidávat výdaje.',
    '/wallet',
  );
  return handleStatus();
}

async function handleSubmitPending(
  body: {
    paid_by: number; amount: number; currency: string; description: string;
    category?: string; expense_date: string; split_type: string;
    split_users: number[]; note?: string;
  },
  requestedBy: number | null,
) {
  const { paid_by, amount, currency, description, category = 'other', expense_date, split_type = 'both', split_users, note } = body;
  if (!paid_by || !amount || amount <= 0) return apiError('Amount and payer are required');
  if (!description || !description.trim()) return apiError('Description is required');
  if (!split_users || split_users.length === 0) return apiError('Select at least one person to split with');
  if (!expense_date) return apiError('Date is required');

  const parsedDate = parseExpenseDate(expense_date);
  const row = await queryOne<{ id: number }>(
    `INSERT INTO wallet_pending_expenses
     (paid_by, amount, currency, description, category, expense_date, split_type, split_user_ids, requested_by, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [paid_by, amount, currency, description.trim(), category, parsedDate, split_type, JSON.stringify(split_users), requestedBy, note?.trim() || null],
  );

  const requester = requestedBy ? await queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [requestedBy]) : null;
  await notifyBroadcast(
    'expense_pending',
    'Nová žádost o výdaj ke schválení',
    `${requester?.name || 'Někdo'} přidal výdaj „${description.trim()}" (${amount} ${currency}) po uzavření peněženky.`,
    '/wallet',
  );
  return apiSuccess({ id: row?.id });
}

async function handleApprovePending(body: { id: number }, reviewedBy: number | null) {
  const { id } = body;
  if (!id) return apiError('Missing id');
  const pending = await queryOne<PendingRow>(
    `SELECT * FROM wallet_pending_expenses WHERE id = $1`, [id],
  );
  if (!pending) return apiError('Request not found', 404);
  if (pending.status !== 'pending') return apiError('This request was already reviewed.');

  let expenseId: number;
  try {
    expenseId = await insertExpenseWithSplits(
      {
        paid_by: pending.paid_by,
        amount: parseFloat(pending.amount),
        currency: pending.currency,
        description: pending.description,
        category: pending.category,
        expense_date: pending.expense_date,
        split_type: pending.split_type,
        split_users: safeParseIds(pending.split_user_ids),
      },
      reviewedBy,
    );
  } catch (err) {
    if (err instanceof RateError) return apiError(err.message);
    throw err;
  }

  await execute(
    `UPDATE wallet_pending_expenses
     SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, approved_expense_id = $2
     WHERE id = $3`,
    [reviewedBy, expenseId, id],
  );

  if (pending.requested_by) {
    await notifyUser(
      pending.requested_by,
      'expense_approved',
      'Tvůj dodatečný výdaj byl schválen',
      `„${pending.description}" (${pending.amount} ${pending.currency}) byl přidán do peněženky.`,
      '/wallet',
    );
  }
  return apiSuccess({ id, expense_id: expenseId });
}

async function handleRejectPending(body: { id: number; review_note?: string }, reviewedBy: number | null) {
  const { id, review_note } = body;
  if (!id) return apiError('Missing id');
  const pending = await queryOne<PendingRow>(
    `SELECT * FROM wallet_pending_expenses WHERE id = $1`, [id],
  );
  if (!pending) return apiError('Request not found', 404);
  if (pending.status !== 'pending') return apiError('This request was already reviewed.');

  await execute(
    `UPDATE wallet_pending_expenses
     SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, review_note = $2
     WHERE id = $3`,
    [reviewedBy, review_note?.trim() || null, id],
  );

  if (pending.requested_by) {
    await notifyUser(
      pending.requested_by,
      'expense_rejected',
      'Tvůj dodatečný výdaj byl zamítnut',
      `„${pending.description}" (${pending.amount} ${pending.currency})${review_note?.trim() ? ` — ${review_note.trim()}` : ''}.`,
      '/wallet',
    );
  }
  return apiSuccess({ id });
}

function safeParseIds(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
  } catch {
    return [];
  }
}

// ── Helpers ──

function parseExpenseDate(dateStr: string): string {
  // Accept multiple formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    /^\d{4}-\d{2}-\d{2}$/,
  ];

  for (const fmt of formats) {
    if (fmt.test(dateStr)) {
      // For date-only, append midnight
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr + ' 00:00:00';
      }
      // For formats without seconds, append :00
      if (/T\d{2}:\d{2}$/.test(dateStr) || / \d{2}:\d{2}$/.test(dateStr)) {
        return dateStr.replace('T', ' ') + ':00';
      }
      return dateStr.replace('T', ' ');
    }
  }

  // Fallback: try to parse with Date constructor
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
