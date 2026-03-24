import { requireAuth } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { formatMoney } from '@/lib/utils';

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.userId!;

  // Get trip info
  const tripName = await getSetting('trip_name', 'Voyage');
  const tripFrom = await getSetting('trip_date_from', '');
  const tripTo = await getSetting('trip_date_to', '');

  // Get user balance
  const paidResult = await query<{ total: string }>(
    'SELECT COALESCE(SUM(amount_eur), 0) as total FROM wallet_expenses WHERE paid_by = $1',
    [userId]
  );
  const owedResult = await query<{ total: string }>(
    'SELECT COALESCE(SUM(amount_eur), 0) as total FROM wallet_expense_splits WHERE user_id = $1',
    [userId]
  );
  const paid = parseFloat(paidResult[0]?.total || '0');
  const owed = parseFloat(owedResult[0]?.total || '0');
  const balance = paid - owed;

  // Get expense count
  const expenseCount = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM wallet_expenses'
  );

  // Get crew counts per boat
  const boatCounts = await query<{ boat_id: number; name: string; count: string }>(
    `SELECT u.boat_id, b.name, COUNT(*) as count
     FROM users u LEFT JOIN boats b ON u.boat_id = b.id
     GROUP BY u.boat_id, b.name ORDER BY u.boat_id`
  );

  // Trip countdown
  let daysText = '';
  if (tripFrom) {
    const start = new Date(tripFrom);
    const now = new Date();
    const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) daysText = `${diff} days to go`;
    else if (diff === 0) daysText = 'Trip starts today!';
    else daysText = 'Trip is underway!';
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{tripName}</h1>
        {daysText && (
          <p style={{ color: 'var(--color-brand)', fontWeight: 600, marginTop: 4 }}>
            {daysText}
          </p>
        )}
        {tripFrom && tripTo && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
            {tripFrom} — {tripTo}
          </p>
        )}
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Balance card */}
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Your Balance
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {balance >= 0 ? '+' : ''}{formatMoney(balance)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: 8 }}>
              Paid: {formatMoney(paid)} · Owes: {formatMoney(owed)}
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Trip Stats
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total expenses</span>
                <strong>{expenseCount[0]?.count || 0}</strong>
              </div>
              {boatCounts.map(bc => (
                <div key={bc.boat_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{bc.name}</span>
                  <strong>{bc.count} crew</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
