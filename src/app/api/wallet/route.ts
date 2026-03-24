import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute, getSetting, getAllUsers, pool } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { convertToBase } from '@/lib/currencies';
import { getExchangeRate, getExchangeRates } from '@/lib/exchange';

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
    params.push(userId);
    whereClause = `WHERE e.paid_by = $${params.length}`;
  } else if (filter === 'boat1') {
    whereClause = `WHERE e.split_type IN ('both', 'boat1')`;
  } else if (filter === 'boat2') {
    whereClause = `WHERE e.split_type IN ('both', 'boat2')`;
  }

  const expenses = await query<ExpenseRow>(
    `SELECT e.*, u.name AS paid_by_name, u.avatar AS paid_by_avatar, u.boat_id AS paid_by_boat_id
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
    `SELECT COALESCE(SUM(amount_eur), 0) AS total FROM wallet_expenses ${whereClause}`,
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

  return apiSuccess({
    expenses: data,
    total_eur: totalEur,
    base_currency: baseCurrency,
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

  const balances = users.map(u => {
    const paid = paidMap[u.id] || 0;
    const share = shareMap[u.id] || 0;
    const balance = Math.round((paid - share) * 100) / 100;
    return {
      user_id: u.id,
      name: u.name,
      avatar: u.avatar,
      boat_id: u.boat_id,
      boat_name: u.boat_name,
      paid: Math.round(paid * 100) / 100,
      share: Math.round(share * 100) / 100,
      balance,
    };
  });

  return apiSuccess({ balances, base_currency: baseCurrency });
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

  // Build debtors/creditors lists
  const debtors: { userId: number; amount: number }[] = [];
  const creditors: { userId: number; amount: number }[] = [];

  for (const u of users) {
    const paid = paidMap[u.id] || 0;
    const share = shareMap[u.id] || 0;
    const balance = Math.round((paid - share) * 100) / 100;
    if (balance < -0.01) {
      debtors.push({ userId: u.id, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ userId: u.id, amount: balance });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedy settlement algorithm
  const settlements: {
    from_user_id: number;
    to_user_id: number;
    amount: number;
  }[] = [];

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].amount, creditors[ci].amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0) {
      settlements.push({
        from_user_id: debtors[di].userId,
        to_user_id: creditors[ci].userId,
        amount: rounded,
      });
    }

    debtors[di].amount = Math.round((debtors[di].amount - amount) * 100) / 100;
    creditors[ci].amount = Math.round((creditors[ci].amount - amount) * 100) / 100;

    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }

  // Load settled status
  const settledRows = await query<SettledRow>('SELECT * FROM wallet_settled');
  const settledSet = new Set(
    settledRows.map(r => `${r.from_user_id}-${r.to_user_id}`)
  );

  // Get exchange rates for display
  let exchangeRates: Record<string, number> = {};
  try {
    exchangeRates = await getExchangeRates(baseCurrency);
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
  const baseCurrency = await getSetting('base_currency', 'EUR');
  let rates: Record<string, number> = {};
  try {
    rates = await getExchangeRates(baseCurrency);
  } catch {
    // ignore
  }
  return apiSuccess({ base_currency: baseCurrency, rates });
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
    const userId = session.userId || 0;

    switch (action) {
      case 'add':
        return handleAdd(body, userId);
      case 'edit':
        return handleEdit(body, userId);
      case 'delete':
        return handleDelete(body, userId);
      case 'settle':
        return handleSettle(body, userId);
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
  createdBy: number
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

  const baseCurrency = await getSetting('base_currency', 'EUR');
  let amountBase = amount;
  let exchangeRate: number | null = null;

  // Currency conversion
  if (currency !== baseCurrency) {
    const rate = await getExchangeRate(baseCurrency, currency);
    if (rate <= 0) {
      return apiError(`Could not get exchange rate for ${currency}`);
    }
    exchangeRate = rate;
    amountBase = convertToBase(amount, rate);
  }

  // Calculate splits
  const count = split_users.length;
  const perPerson = Math.floor((amountBase / count) * 100) / 100;
  const remainder = Math.round((amountBase - perPerson * count) * 100) / 100;

  // Use a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Parse the date
    const parsedDate = parseExpenseDate(expense_date);

    // Insert expense
    const expenseResult = await client.query(
      `INSERT INTO wallet_expenses
       (paid_by, amount, currency, amount_eur, exchange_rate, description, category, expense_date, split_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
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
        createdBy,
      ]
    );

    const expenseId = expenseResult.rows[0].id;

    // Insert splits
    for (let i = 0; i < split_users.length; i++) {
      const splitAmount = i === 0 ? perPerson + remainder : perPerson;
      await client.query(
        `INSERT INTO wallet_expense_splits (expense_id, user_id, amount_eur)
         VALUES ($1, $2, $3)`,
        [expenseId, split_users[i], splitAmount]
      );
    }

    // Create audit log entry
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
      `INSERT INTO wallet_audit_log (expense_id, changed_by, change_type, new_values)
       VALUES ($1, $2, 'create', $3)`,
      [expenseId, createdBy, JSON.stringify(newValues)]
    );

    await client.query('COMMIT');

    return apiSuccess({ id: expenseId });
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
  changedBy: number
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
    `SELECT e.*, u.name AS paid_by_name, u.avatar AS paid_by_avatar, u.boat_id AS paid_by_boat_id
     FROM wallet_expenses e
     LEFT JOIN users u ON e.paid_by = u.id
     WHERE e.id = $1`,
    [id]
  );
  if (!existing) {
    return apiError('Expense not found', 404);
  }

  const baseCurrency = await getSetting('base_currency', 'EUR');
  let amountBase = amount;
  let exchangeRate: number | null = null;

  // Currency conversion — reuse original rate for same non-base currency
  if (currency !== baseCurrency) {
    if (
      currency === existing.currency &&
      existing.exchange_rate
    ) {
      // Reuse original exchange rate
      exchangeRate = parseFloat(existing.exchange_rate);
    } else {
      const rate = await getExchangeRate(baseCurrency, currency);
      if (rate <= 0) {
        return apiError(`Could not get exchange rate for ${currency}`);
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
  deletedBy: number
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
  settledBy: number
) {
  const { from_user_id, to_user_id, settled } = body;

  if (!from_user_id || !to_user_id) {
    return apiError('Missing user IDs');
  }

  if (settled) {
    // Mark as settled (upsert)
    await execute(
      `INSERT INTO wallet_settled (from_user_id, to_user_id, settled_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
         settled_at = CURRENT_TIMESTAMP, settled_by = EXCLUDED.settled_by`,
      [from_user_id, to_user_id, settledBy]
    );
  } else {
    // Unmark
    await execute(
      'DELETE FROM wallet_settled WHERE from_user_id = $1 AND to_user_id = $2',
      [from_user_id, to_user_id]
    );
  }

  return apiSuccess({ settled });
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
