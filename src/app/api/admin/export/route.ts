import { getSession } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { apiError } from '@/lib/utils';
import { computeBalances, computeSettlements, aggregateByCategory, aggregateByPayer, aggregateByPayerCategory, aggregateByBoat, summarize, donutSegments, barScale } from '@/lib/wallet-calc';

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
      paid_by: number; paid_by_name: string; category: string; split_type: string;
    }>(
      `SELECT e.id, e.expense_date, e.description, e.amount, e.currency,
              e.amount_eur, e.exchange_rate, e.paid_by, u.name as paid_by_name,
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

    // ── Per-person itemised breakdown (what everyone paid for each person) ──
    const splitDetail = await query<{
      user_id: number; user_name: string; expense_date: string; description: string;
      category: string; paid_by_name: string; share: string;
    }>(
      `SELECT s.user_id, su.name AS user_name, e.expense_date, e.description,
              e.category, pu.name AS paid_by_name, s.amount_eur AS share
       FROM wallet_expense_splits s
       JOIN users su ON s.user_id = su.id
       JOIN wallet_expenses e ON s.expense_id = e.id
       JOIN users pu ON e.paid_by = pu.id
       ORDER BY su.name, e.expense_date, e.id`
    );

    // ── Balances Summary ──
    const balances = await query<{
      id: number; name: string; boat_id: number; boat_name: string; paid: string; share: string;
    }>(
      `SELECT u.id, u.name, u.boat_id, b.name as boat_name,
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

    // ── Overview (charts + full who-owes-whom), computed in EUR ──
    const expForCalc = expenses.map(e => ({
      amount_eur: parseFloat(e.amount_eur), category: e.category, paid_by: e.paid_by,
    }));
    const nameById = new Map(balances.map(b => [b.id, b.name]));
    const paidMap: Record<number, number> = {};
    const shareMap: Record<number, number> = {};
    for (const b of balances) { paidMap[b.id] = parseFloat(b.paid); shareMap[b.id] = parseFloat(b.share); }
    const calcBalances = computeBalances(balances.map(b => b.id), paidMap, shareMap);
    const matrixRaw = aggregateByPayerCategory(expForCalc);
    const overview = {
      summary: summarize(expForCalc),
      byCategory: aggregateByCategory(expForCalc),
      byPayer: aggregateByPayer(expForCalc).map(p => ({ ...p, name: nameById.get(p.paid_by) || 'Unknown' })),
      matrix: {
        ...matrixRaw,
        rows: matrixRaw.rows.map(r => ({ ...r, name: nameById.get(r.paid_by) || 'Unknown' })),
      },
      byBoat: aggregateByBoat(balances.map(b => ({
        boat_id: b.boat_id, boat_name: b.boat_name,
        paid: parseFloat(b.paid), share: parseFloat(b.share),
      }))),
      settlements: computeSettlements(calcBalances).map(s => ({
        from_user_id: s.from_user_id,
        to_user_id: s.to_user_id,
        from_name: nameById.get(s.from_user_id) || 'Unknown',
        to_name: nameById.get(s.to_user_id) || 'Unknown',
        amount: s.amount,
      })),
    };

    // Group the split detail per person (item-by-item, who paid)
    const perPersonMap = new Map<number, { user_id: number; name: string; total: number; items: { date: string; description: string; paid_by_name: string; category: string; share: number }[] }>();
    for (const d of splitDetail) {
      const entry = perPersonMap.get(d.user_id) ?? { user_id: d.user_id, name: d.user_name, total: 0, items: [] };
      const share = parseFloat(d.share);
      entry.total += share;
      entry.items.push({ date: d.expense_date, description: d.description, paid_by_name: d.paid_by_name, category: d.category, share });
      perPersonMap.set(d.user_id, entry);
    }
    const perPerson = [...perPersonMap.values()]
      .map(p => ({ ...p, total: Math.round(p.total * 100) / 100 }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // ── HTML Report ──
    const htmlReport = generateHtmlReport({
      tripName, tripFrom, tripTo, storageCurrency,
      users, expenses, balances, settled, shopping, logbook, meals,
      totalExpenses, totalNm, overview, perPerson,
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
  overview: {
    summary: { total: number; count: number; avgPerExpense: number; topCategory: string | null };
    byCategory: { category: string; total: number; count: number }[];
    byPayer: { paid_by: number; total: number; count: number; name: string }[];
    byBoat: { boat_id: number; boat_name: string; members: number; paid: number; cost: number }[];
    matrix: {
      categories: string[];
      rows: { paid_by: number; name: string; byCat: Record<string, number>; total: number }[];
      columnTotals: Record<string, number>;
      grandTotal: number;
    };
    settlements: { from_user_id: number; to_user_id: number; from_name: string; to_name: string; amount: number }[];
  };
  perPerson: { user_id: number; name: string; total: number; items: { date: string; description: string; paid_by_name: string; category: string; share: number }[] }[];
}): string {
  const { tripName, tripFrom, tripTo, storageCurrency, users, expenses, balances, settled, shopping, logbook, meals, totalExpenses, totalNm, overview, perPerson } = data;

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };
  const fmtMoney = (n: string | number) => Number(n).toFixed(2);

  const tableStyle = 'width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px';
  const thStyle = 'text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;font-weight:600;background:#f8f8f8';
  const tdStyle = 'padding:6px 12px;border-bottom:1px solid #eee';
  const tdRight = `${tdStyle};text-align:right;font-variant-numeric:tabular-nums`;

  // ── Overview section (charts + who-owes-whom) ──
  const CAT_COLORS: Record<string, string> = {
    food: '#f59e0b', transport: '#3b82f6', marina: '#06b6d4', fuel: '#ef4444',
    entertainment: '#a855f7', shopping: '#ec4899', accommodation: '#14b8a6', other: '#94a3b8',
  };
  const fallback = ['#6366f1', '#22c55e', '#eab308', '#f97316', '#0ea5e9'];
  const catColor = (c: string, i: number) => CAT_COLORS[c] ?? fallback[i % fallback.length];

  const R = 60, STROKE = 26, CIRC = 2 * Math.PI * R;
  const catTotal = overview.byCategory.reduce((s, c) => s + c.total, 0);
  const segs = donutSegments(overview.byCategory.map(c => c.total), { circumference: CIRC });
  const donutSvg = `<svg width="150" height="150" viewBox="0 0 160 160" style="transform:rotate(-90deg)">
<circle cx="80" cy="80" r="${R}" fill="none" stroke="#eee" stroke-width="${STROKE}"/>
${segs.map((seg, i) => `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${catColor(overview.byCategory[i].category, i)}" stroke-width="${STROKE}" stroke-dasharray="${seg.dash.toFixed(2)} ${(CIRC - seg.dash).toFixed(2)}" stroke-dashoffset="${(-seg.offset * CIRC).toFixed(2)}"/>`).join('\n')}
</svg>`;
  const donutLegend = overview.byCategory.map((c, i) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin:3px 0"><span style="width:11px;height:11px;border-radius:50%;background:${catColor(c.category, i)};display:inline-block"></span><span style="flex:1">${c.category}</span><span style="color:#666">${catTotal > 0 ? Math.round((c.total / catTotal) * 100) : 0}%</span><strong style="min-width:90px;text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(c.total)} ${storageCurrency}</strong></div>`).join('\n');

  const payerWidths = barScale(overview.byPayer.map(p => p.total));
  const payerBars = overview.byPayer.map((p, i) => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${p.name}</span><span style="font-variant-numeric:tabular-nums">${fmtMoney(p.total)} ${storageCurrency}</span></div><div style="height:8px;border-radius:4px;background:#eee;overflow:hidden"><div style="height:100%;width:${payerWidths[i]}%;background:#0A2540;border-radius:4px"></div></div></div>`).join('\n');

  // Per-person itemised breakdown — "what everyone paid for me, item by item" + settlement
  const personBlock = (p: typeof perPerson[number]) => {
    const pays = overview.settlements.filter(s => s.from_user_id === p.user_id);
    const gets = overview.settlements.filter(s => s.to_user_id === p.user_id);
    const settleLine =
      (pays.length ? `<div style="font-size:13px;margin:2px 0"><span style="color:#dc2626">Pays:</span> ${pays.map(s => `${s.to_name} (${fmtMoney(s.amount)} ${storageCurrency})`).join(', ')}</div>` : '') +
      (gets.length ? `<div style="font-size:13px;margin:2px 0"><span style="color:#0d9668">Gets paid by:</span> ${gets.map(s => `${s.from_name} (${fmtMoney(s.amount)} ${storageCurrency})`).join(', ')}</div>` : '');
    const rows = p.items.map(it => `<tr><td style="${tdStyle}">${fmtDate(it.date)}</td><td style="${tdStyle}">${it.description}</td><td style="${tdStyle}">${it.paid_by_name}</td><td style="${tdStyle}"><span class="badge">${it.category}</span></td><td style="${tdRight}">${fmtMoney(it.share)} ${storageCurrency}</td></tr>`).join('\n');
    return `<h3 style="font-size:15px;margin:20px 0 6px;color:#0A2540">${p.name} — <span style="color:#0d9668">${fmtMoney(p.total)} ${storageCurrency}</span></h3>
${settleLine}
<table style="${tableStyle}">
<tr><th style="${thStyle}">Date</th><th style="${thStyle}">Item</th><th style="${thStyle}">Paid by</th><th style="${thStyle}">Category</th><th style="${thStyle};text-align:right">Your share</th></tr>
${rows}
</table>`;
  };
  const perPersonHtml = perPerson.length === 0 ? '' : `
<h2>🧑‍🤝‍🧑 Per-person breakdown</h2>
<p class="subtitle">For each person: who they settle with, plus every item they share in.</p>
${perPerson.map(personBlock).join('\n')}
`;

  const overviewHtml = `
<h2>📊 Overview</h2>
<div class="stats">
  <div class="stat"><div class="stat-value">${fmtMoney(overview.summary.total)} ${storageCurrency}</div><div class="stat-label">Total Spent</div></div>
  <div class="stat"><div class="stat-value">${fmtMoney(overview.summary.avgPerExpense)} ${storageCurrency}</div><div class="stat-label">Avg / Expense</div></div>
  <div class="stat"><div class="stat-value">${overview.summary.count}</div><div class="stat-label">Expenses</div></div>
  <div class="stat"><div class="stat-value">${overview.summary.topCategory ?? '—'}</div><div class="stat-label">Top Category</div></div>
</div>
<h3 style="font-size:14px;margin:24px 0 8px;color:#0A2540">By category</h3>
<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
  <div>${donutSvg}</div>
  <div style="flex:1;min-width:240px">${donutLegend}</div>
</div>
<h3 style="font-size:14px;margin:24px 0 8px;color:#0A2540">Cost per boat</h3>
<div class="stats">
${overview.byBoat.map(b => `  <div class="stat"><div class="stat-value">${fmtMoney(b.cost)} ${storageCurrency}</div><div class="stat-label">${b.boat_name} · ${b.members} ppl · ${fmtMoney(b.members > 0 ? b.cost / b.members : 0)}/ppl</div></div>`).join('\n')}
</div>
<h3 style="font-size:14px;margin:24px 0 8px;color:#0A2540">By person (paid)</h3>
${payerBars}
${overview.matrix.rows.length === 0 ? '' : `<h3 style="font-size:14px;margin:24px 0 8px;color:#0A2540">Spend per person by category</h3>
<div style="overflow-x:auto"><table style="${tableStyle}">
<tr><th style="${thStyle}">Name</th>${overview.matrix.categories.map(c => `<th style="${thStyle};text-align:right">${c}</th>`).join('')}<th style="${thStyle};text-align:right">Total</th></tr>
${overview.matrix.rows.map(r => `<tr><td style="${tdStyle}">${r.name}</td>${overview.matrix.categories.map(c => `<td style="${tdRight}">${r.byCat[c] > 0 ? fmtMoney(r.byCat[c]) : '—'}</td>`).join('')}<td style="${tdRight}"><strong>${fmtMoney(r.total)}</strong></td></tr>`).join('\n')}
<tr style="border-top:2px solid #ddd"><td style="${tdStyle};font-weight:600">Total</td>${overview.matrix.categories.map(c => `<td style="${tdRight};font-weight:600">${fmtMoney(overview.matrix.columnTotals[c])}</td>`).join('')}<td style="${tdRight};font-weight:700">${fmtMoney(overview.matrix.grandTotal)}</td></tr>
</table></div>`}

<h3 style="font-size:14px;margin:24px 0 8px;color:#0A2540">Who owes whom</h3>
${overview.settlements.length === 0 ? '<p style="color:#666;font-size:13px">All settled up.</p>' : `<p style="color:#666;font-size:12px;margin:0 0 8px">${overview.settlements.length} payment(s) settle everyone — the minimum needed.</p><table style="${tableStyle}">
<tr><th style="${thStyle}">From</th><th style="${thStyle}">To</th><th style="${thStyle};text-align:right">Amount</th></tr>
${overview.settlements.map(s => `<tr><td style="${tdStyle}">${s.from_name}</td><td style="${tdStyle}">${s.to_name}</td><td style="${tdRight}"><strong>${fmtMoney(s.amount)} ${storageCurrency}</strong></td></tr>`).join('\n')}
</table>`}
`;

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
${overviewHtml}
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
${perPersonHtml}

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
