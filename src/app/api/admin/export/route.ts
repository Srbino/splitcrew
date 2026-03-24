import { getSession } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { apiError } from '@/lib/utils';

/**
 * Trip data export — generates CSV files for all trip data.
 * Admin only. Returns JSON with named CSV strings for client-side download.
 */

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(v => escape(v ?? '')).join(','));
  }
  return lines.join('\n');
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const tripName = await getSetting('trip_name', 'Trip');
    const tripFrom = await getSetting('trip_date_from', '');
    const tripTo = await getSetting('trip_date_to', '');
    const storageCurrency = 'EUR'; // amount_eur is always in EUR
    const exportCurrency = await getSetting('export_currency', storageCurrency);

    // Get conversion rate from EUR → export currency
    let exportRate = 1;
    let effectiveExportCurrency = storageCurrency;
    if (exportCurrency !== storageCurrency) {
      const { getExchangeRates } = await import('@/lib/exchange');
      const rates = await getExchangeRates(storageCurrency);
      const rate = rates[exportCurrency];
      if (rate && rate > 0) {
        exportRate = rate;
        effectiveExportCurrency = exportCurrency;
      }
      // If rate unavailable: keep exportRate=1 and effectiveExportCurrency=EUR
      // so CSV headers and values are always consistent
    }
    const toExport = (baseAmount: number) => exportRate === 1 ? baseAmount : Math.round(baseAmount * exportRate * 100) / 100;
    const expCur = effectiveExportCurrency; // shorthand for headers

    // ── Crew ──
    const users = await query<{
      name: string; phone: string | null; email: string | null; boat_name: string;
    }>(
      `SELECT u.name, u.phone, u.email, b.name as boat_name
       FROM users u LEFT JOIN boats b ON u.boat_id = b.id ORDER BY u.boat_id, u.name`
    );
    const crewCsv = toCsv(
      ['Name', 'Phone', 'Email', 'Boat'],
      users.map(u => [u.name, u.phone || '', u.email || '', u.boat_name]),
    );

    // ── Expenses ──
    const expenses = await query<{
      id: number; expense_date: string; description: string; amount: string;
      currency: string; amount_eur: string; exchange_rate: string | null;
      paid_by_name: string; category: string; split_type: string;
    }>(
      `SELECT e.id, e.expense_date, e.description, e.amount, e.currency,
              e.amount_eur, e.exchange_rate, u.name as paid_by_name,
              e.category, e.split_type
       FROM wallet_expenses e JOIN users u ON e.paid_by = u.id
       ORDER BY e.expense_date`
    );
    const expensesCsv = toCsv(
      ['ID', 'Date', 'Description', 'Amount', 'Currency', `Amount (${storageCurrency})`, 'Exchange Rate', 'Paid By', 'Category', 'Split Type'],
      expenses.map(e => [
        String(e.id),
        new Date(e.expense_date).toISOString().slice(0, 10),
        e.description,
        e.amount,
        e.currency,
        e.amount_eur,
        e.exchange_rate || '',
        e.paid_by_name,
        e.category,
        e.split_type,
      ]),
    );

    // ── Expense Splits ──
    const splits = await query<{
      expense_id: number; user_name: string; amount_eur: string; description: string;
    }>(
      `SELECT s.expense_id, u.name as user_name, s.amount_eur, e.description
       FROM wallet_expense_splits s
       JOIN users u ON s.user_id = u.id
       JOIN wallet_expenses e ON s.expense_id = e.id
       ORDER BY s.expense_id`
    );
    const splitsCsv = toCsv(
      ['Expense ID', 'Expense Description', 'User', `Share (${storageCurrency})`],
      splits.map(s => [String(s.expense_id), s.description, s.user_name, s.amount_eur]),
    );

    // ── Balances Summary ──
    const balances = await query<{
      name: string; boat_name: string; paid: string; share: string;
    }>(
      `SELECT u.name, b.name as boat_name,
              COALESCE((SELECT SUM(amount_eur) FROM wallet_expenses WHERE paid_by = u.id), 0) as paid,
              COALESCE((SELECT SUM(amount_eur) FROM wallet_expense_splits WHERE user_id = u.id), 0) as share
       FROM users u LEFT JOIN boats b ON u.boat_id = b.id
       ORDER BY u.name`
    );
    const balanceHeaders = ['Name', 'Boat', `Paid (${storageCurrency})`, `Share (${storageCurrency})`, `Balance (${storageCurrency})`];
    if (expCur !== storageCurrency) {
      balanceHeaders.push(`Paid (${expCur})`, `Share (${expCur})`, `Balance (${expCur})`);
    }
    const balancesCsv = toCsv(
      balanceHeaders,
      balances.map(b => {
        const p = parseFloat(b.paid);
        const s = parseFloat(b.share);
        const bal = p - s;
        const row = [b.name, b.boat_name, b.paid, b.share, bal.toFixed(2)];
        if (expCur !== storageCurrency) {
          row.push(toExport(p).toFixed(2), toExport(s).toFixed(2), toExport(bal).toFixed(2));
        }
        return row;
      }),
    );

    // ── Settlements ──
    const settled = await query<{
      from_name: string; to_name: string; settled_at: string;
    }>(
      `SELECT uf.name as from_name, ut.name as to_name, ws.settled_at
       FROM wallet_settled ws
       JOIN users uf ON ws.from_user_id = uf.id
       JOIN users ut ON ws.to_user_id = ut.id
       ORDER BY ws.settled_at`
    );
    const settlementsCsv = toCsv(
      ['From', 'To', 'Settled At'],
      settled.map(s => [s.from_name, s.to_name, new Date(s.settled_at).toISOString()]),
    );

    // ── Shopping ──
    const shopping = await query<{
      item_name: string; category: string; quantity: string | null;
      price: string | null; currency: string; is_bought: boolean;
      assigned_name: string | null; bought_by_name: string | null; boat_name: string;
    }>(
      `SELECT si.item_name, si.category, si.quantity, si.price, si.currency,
              si.is_bought, ua.name as assigned_name, ub.name as bought_by_name,
              b.name as boat_name
       FROM shopping_items si
       LEFT JOIN users ua ON si.assigned_to = ua.id
       LEFT JOIN users ub ON si.bought_by = ub.id
       LEFT JOIN boats b ON si.boat_id = b.id
       ORDER BY si.boat_id, si.category, si.item_name`
    );
    const shoppingCsv = toCsv(
      ['Item', 'Category', 'Quantity', 'Price', 'Currency', 'Boat', 'Assigned To', 'Bought', 'Bought By'],
      shopping.map(s => [
        s.item_name, s.category, s.quantity || '', s.price || '', s.currency,
        s.boat_name, s.assigned_name || '', s.is_bought ? 'Yes' : 'No', s.bought_by_name || '',
      ]),
    );

    // ── Logbook ──
    const logbook = await query<{
      date: string; boat_name: string; location_from: string; location_to: string;
      nautical_miles: string; skipper_name: string | null;
      departure_time: string | null; arrival_time: string | null; note: string | null;
    }>(
      `SELECT l.date, b.name as boat_name, l.location_from, l.location_to,
              l.nautical_miles, u.name as skipper_name,
              l.departure_time, l.arrival_time, l.note
       FROM logbook l
       LEFT JOIN boats b ON l.boat_id = b.id
       LEFT JOIN users u ON l.skipper_user_id = u.id
       ORDER BY l.date, l.boat_id`
    );
    const logbookCsv = toCsv(
      ['Date', 'Boat', 'From', 'To', 'Nautical Miles', 'Skipper', 'Departure', 'Arrival', 'Note'],
      logbook.map(l => [
        new Date(l.date).toISOString().slice(0, 10),
        l.boat_name, l.location_from, l.location_to, l.nautical_miles,
        l.skipper_name || '', l.departure_time || '', l.arrival_time || '', l.note || '',
      ]),
    );

    // ── Meals ──
    const meals = await query<{
      date: string; boat_name: string; meal_type: string;
      cook_name: string | null; meal_description: string | null; note: string | null;
    }>(
      `SELECT mp.date, b.name as boat_name, mp.meal_type,
              u.name as cook_name, mp.meal_description, mp.note
       FROM menu_plan mp
       LEFT JOIN boats b ON mp.boat_id = b.id
       LEFT JOIN users u ON mp.cook_user_id = u.id
       ORDER BY mp.date, mp.boat_id, mp.meal_type`
    );
    const mealsCsv = toCsv(
      ['Date', 'Boat', 'Meal Type', 'Cook', 'Description', 'Note'],
      meals.map(m => [
        new Date(m.date).toISOString().slice(0, 10),
        m.boat_name, m.meal_type, m.cook_name || '', m.meal_description || '', m.note || '',
      ]),
    );

    // ── Settlement Audit ──
    const settlementAudit = await query<{
      from_name: string; to_name: string; action: string;
      performer_name: string | null; performer_role: string | null; created_at: string;
    }>(
      `SELECT uf.name as from_name, ut.name as to_name, sal.action,
              up.name as performer_name, sal.performer_role, sal.created_at
       FROM settlement_audit_log sal
       JOIN users uf ON sal.from_user_id = uf.id
       JOIN users ut ON sal.to_user_id = ut.id
       LEFT JOIN users up ON sal.performed_by = up.id
       ORDER BY sal.created_at DESC`
    );
    const settlementAuditCsv = toCsv(
      ['From', 'To', 'Action', 'Performed By', 'Role', 'Timestamp'],
      settlementAudit.map(s => [
        s.from_name, s.to_name, s.action,
        s.performer_name || '', s.performer_role || '',
        new Date(s.created_at).toISOString(),
      ]),
    );

    // ── Expense Audit ──
    const expenseAudit = await query<{
      expense_desc: string | null; changed_by_name: string | null;
      change_type: string; changed_at: string;
    }>(
      `SELECT we.description as expense_desc, u.name as changed_by_name,
              wal.change_type, wal.changed_at
       FROM wallet_audit_log wal
       LEFT JOIN users u ON wal.changed_by = u.id
       LEFT JOIN wallet_expenses we ON wal.expense_id = we.id
       ORDER BY wal.changed_at DESC`
    );
    const expenseAuditCsv = toCsv(
      ['Expense', 'Changed By', 'Action', 'Timestamp'],
      expenseAudit.map(a => [
        a.expense_desc || 'Deleted', a.changed_by_name || 'Unknown',
        a.change_type, new Date(a.changed_at).toISOString(),
      ]),
    );

    // ── Trip Summary ──
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount_eur), 0);
    const totalNm = logbook.reduce((sum, l) => sum + parseFloat(l.nautical_miles), 0);

    const tripInfo = [
      `Trip: ${tripName}`,
      `Dates: ${tripFrom || 'N/A'} — ${tripTo || 'N/A'}`,
      `Base Currency: ${storageCurrency}`,
      `Crew: ${users.length} members`,
      `Total Expenses: ${totalExpenses.toFixed(2)} ${storageCurrency} (${expenses.length} transactions)`,
      `Total Nautical Miles: ${totalNm.toFixed(1)}`,
      `Logbook Entries: ${logbook.length}`,
      `Shopping Items: ${shopping.length} (${shopping.filter(s => s.is_bought).length} bought)`,
      `Meals Planned: ${meals.length}`,
      `Exported: ${new Date().toISOString()}`,
    ].join('\n');

    // ── HTML Report ──
    const htmlReport = generateHtmlReport({
      tripName, tripFrom, tripTo, storageCurrency,
      users, expenses, balances, settled, shopping, logbook, meals,
      totalExpenses, totalNm,
    });

    return Response.json({
      success: true,
      data: {
        trip_name: tripName,
        files: {
          'trip_report.html': htmlReport,
          'crew.csv': crewCsv,
          'expenses.csv': expensesCsv,
          'expense_splits.csv': splitsCsv,
          'balances.csv': balancesCsv,
          'settlements.csv': settlementsCsv,
          'settlement_audit.csv': settlementAuditCsv,
          'expense_audit.csv': expenseAuditCsv,
          'shopping.csv': shoppingCsv,
          'logbook.csv': logbookCsv,
          'meals.csv': mealsCsv,
          'trip_info.txt': tripInfo,
        },
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return apiError('Server error', 500);
  }
}

// ── HTML Report Generator ──

function generateHtmlReport(data: {
  tripName: string; tripFrom: string; tripTo: string; storageCurrency: string;
  users: { name: string; phone: string | null; email: string | null; boat_name: string }[];
  expenses: { id: number; expense_date: string; description: string; amount: string; currency: string; amount_eur: string; paid_by_name: string; category: string }[];
  balances: { name: string; boat_name: string; paid: string; share: string }[];
  settled: { from_name: string; to_name: string; settled_at: string }[];
  shopping: { item_name: string; category: string; quantity: string | null; is_bought: boolean; boat_name: string }[];
  logbook: { date: string; boat_name: string; location_from: string; location_to: string; nautical_miles: string; skipper_name: string | null }[];
  meals: { date: string; boat_name: string; meal_type: string; cook_name: string | null; meal_description: string | null }[];
  totalExpenses: number; totalNm: number;
}): string {
  const { tripName, tripFrom, tripTo, storageCurrency, users, expenses, balances, settled, shopping, logbook, meals, totalExpenses, totalNm } = data;

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };
  const fmtMoney = (n: string | number) => Number(n).toFixed(2);

  const tableStyle = 'width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px';
  const thStyle = 'text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;font-weight:600;background:#f8f8f8';
  const tdStyle = 'padding:6px 12px;border-bottom:1px solid #eee';
  const tdRight = `${tdStyle};text-align:right;font-variant-numeric:tabular-nums`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${tripName} — Trip Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#222;max-width:900px;margin:0 auto;padding:32px 20px;line-height:1.5}
  h1{font-size:28px;margin:0 0 4px}
  h2{font-size:18px;margin:32px 0 8px;padding-bottom:6px;border-bottom:2px solid #0A2540;color:#0A2540}
  .subtitle{color:#666;font-size:14px;margin:0 0 24px}
  .stats{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0 32px}
  .stat{background:#f4f6f8;border-radius:10px;padding:16px 20px;min-width:140px;flex:1}
  .stat-value{font-size:24px;font-weight:700;color:#0A2540}
  .stat-label{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}
  .positive{color:#0d9668}
  .negative{color:#dc2626}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#e8f0fe;color:#1a56db}
  @media print{body{padding:0;max-width:none}h2{break-before:auto}}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#999;text-align:center}
</style>
</head>
<body>
<h1>⛵ ${tripName}</h1>
<p class="subtitle">${tripFrom ? fmtDate(tripFrom) : '—'} — ${tripTo ? fmtDate(tripTo) : '—'} · ${storageCurrency} · ${users.length} crew</p>

<div class="stats">
  <div class="stat"><div class="stat-value">${fmtMoney(totalExpenses)} ${storageCurrency}</div><div class="stat-label">Total Spent</div></div>
  <div class="stat"><div class="stat-value">${totalNm.toFixed(1)} NM</div><div class="stat-label">Nautical Miles</div></div>
  <div class="stat"><div class="stat-value">${expenses.length}</div><div class="stat-label">Expenses</div></div>
  <div class="stat"><div class="stat-value">${logbook.length}</div><div class="stat-label">Log Entries</div></div>
</div>

<h2>👥 Crew</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Name</th><th style="${thStyle}">Boat</th><th style="${thStyle}">Phone</th><th style="${thStyle}">Email</th></tr>
${users.map(u => `<tr><td style="${tdStyle}">${u.name}</td><td style="${tdStyle}">${u.boat_name}</td><td style="${tdStyle}">${u.phone || '—'}</td><td style="${tdStyle}">${u.email || '—'}</td></tr>`).join('\n')}
</table>

<h2>💰 Balances</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Name</th><th style="${thStyle}">Boat</th><th style="${thStyle};text-align:right">Paid</th><th style="${thStyle};text-align:right">Share</th><th style="${thStyle};text-align:right">Balance</th></tr>
${balances.map(b => {
  const bal = parseFloat(b.paid) - parseFloat(b.share);
  const cls = bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : '';
  return `<tr><td style="${tdStyle}">${b.name}</td><td style="${tdStyle}">${b.boat_name}</td><td style="${tdRight}">${fmtMoney(b.paid)}</td><td style="${tdRight}">${fmtMoney(b.share)}</td><td style="${tdRight}" class="${cls}"><strong>${bal > 0 ? '+' : ''}${fmtMoney(bal)}</strong></td></tr>`;
}).join('\n')}
</table>

<h2>🧾 Expenses</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Date</th><th style="${thStyle}">Description</th><th style="${thStyle}">Paid By</th><th style="${thStyle}">Category</th><th style="${thStyle};text-align:right">Amount</th><th style="${thStyle};text-align:right">${storageCurrency}</th></tr>
${expenses.map(e => `<tr><td style="${tdStyle}">${fmtDate(e.expense_date)}</td><td style="${tdStyle}">${e.description}</td><td style="${tdStyle}">${e.paid_by_name}</td><td style="${tdStyle}"><span class="badge">${e.category}</span></td><td style="${tdRight}">${fmtMoney(e.amount)} ${e.currency}</td><td style="${tdRight}">${fmtMoney(e.amount_eur)}</td></tr>`).join('\n')}
</table>

${settled.length > 0 ? `
<h2>🤝 Settlements</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">From</th><th style="${thStyle}">To</th><th style="${thStyle}">Settled</th></tr>
${settled.map(s => `<tr><td style="${tdStyle}">${s.from_name}</td><td style="${tdStyle}">${s.to_name}</td><td style="${tdStyle}">${fmtDate(s.settled_at)}</td></tr>`).join('\n')}
</table>` : ''}

<h2>🧭 Logbook</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Date</th><th style="${thStyle}">Boat</th><th style="${thStyle}">Route</th><th style="${thStyle};text-align:right">NM</th><th style="${thStyle}">Skipper</th></tr>
${logbook.map(l => `<tr><td style="${tdStyle}">${fmtDate(l.date)}</td><td style="${tdStyle}">${l.boat_name}</td><td style="${tdStyle}">${l.location_from} → ${l.location_to}</td><td style="${tdRight}">${l.nautical_miles}</td><td style="${tdStyle}">${l.skipper_name || '—'}</td></tr>`).join('\n')}
</table>

<h2>🛒 Shopping</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Item</th><th style="${thStyle}">Category</th><th style="${thStyle}">Qty</th><th style="${thStyle}">Boat</th><th style="${thStyle}">Status</th></tr>
${shopping.map(s => `<tr><td style="${tdStyle}">${s.item_name}</td><td style="${tdStyle}">${s.category}</td><td style="${tdStyle}">${s.quantity || '—'}</td><td style="${tdStyle}">${s.boat_name}</td><td style="${tdStyle}">${s.is_bought ? '✅ Bought' : '⬜ Pending'}</td></tr>`).join('\n')}
</table>

${meals.length > 0 ? `
<h2>🍽️ Meals</h2>
<table style="${tableStyle}">
<tr><th style="${thStyle}">Date</th><th style="${thStyle}">Boat</th><th style="${thStyle}">Meal</th><th style="${thStyle}">Cook</th><th style="${thStyle}">Description</th></tr>
${meals.map(m => `<tr><td style="${tdStyle}">${fmtDate(m.date)}</td><td style="${tdStyle}">${m.boat_name}</td><td style="${tdStyle}">${m.meal_type}</td><td style="${tdStyle}">${m.cook_name || '—'}</td><td style="${tdStyle}">${m.meal_description || '—'}</td></tr>`).join('\n')}
</table>` : ''}

<div class="footer">
  Generated by SplitCrew · ${new Date().toISOString().slice(0, 10)}
</div>
</body>
</html>`;
}
