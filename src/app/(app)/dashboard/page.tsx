import { requireAuth } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { formatMoney } from '@/lib/utils';
import { Wallet, Users, Ship, Calendar } from 'lucide-react';

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.userId || null;
  const isAdmin = session.isAdmin;

  // Get trip info
  const tripName = await getSetting('trip_name', 'Voyage');
  const tripFrom = await getSetting('trip_date_from', '');
  const tripTo = await getSetting('trip_date_to', '');

  // Get user balance (only for members, not admin)
  let paid = 0;
  let owed = 0;
  let balance = 0;
  if (userId) {
    const paidResult = await query<{ total: string }>(
      'SELECT COALESCE(SUM(amount_eur), 0) as total FROM wallet_expenses WHERE paid_by = $1',
      [userId]
    );
    const owedResult = await query<{ total: string }>(
      'SELECT COALESCE(SUM(amount_eur), 0) as total FROM wallet_expense_splits WHERE user_id = $1',
      [userId]
    );
    paid = parseFloat(paidResult[0]?.total || '0');
    owed = parseFloat(owedResult[0]?.total || '0');
    balance = paid - owed;
  }

  // Get total spent
  const totalResult = await query<{ total: string }>(
    'SELECT COALESCE(SUM(amount_eur), 0) as total FROM wallet_expenses'
  );
  const totalSpent = parseFloat(totalResult[0]?.total || '0');

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

  const totalCrew = boatCounts.reduce((sum, bc) => sum + parseInt(bc.count), 0);

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
          <p style={{ color: 'var(--color-brand)', fontWeight: 600, marginTop: 4, fontSize: '0.95rem' }}>
            {daysText}
          </p>
        )}
        {tripFrom && tripTo && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
            <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {tripFrom} — {tripTo}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Balance card — only for members */}
        {userId && (
          <div className="card">
            <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: balance >= 0 ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Wallet size={18} style={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Your Balance
                </span>
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  letterSpacing: '-0.02em',
                }}
              >
                {balance >= 0 ? '+' : ''}{formatMoney(balance)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: 8, display: 'flex', gap: 12 }}>
                <span>Paid: {formatMoney(paid)}</span>
                <span>Owes: {formatMoney(owed)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Admin overview card */}
        {isAdmin && (
          <div className="card">
            <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--color-brand-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Wallet size={18} style={{ color: 'var(--color-brand)' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Total Spent
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {formatMoney(totalSpent)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                {expenseCount[0]?.count || 0} expenses across {totalCrew} crew members
              </div>
            </div>
          </div>
        )}

        {/* Stats card */}
        <div className="card">
          <div className="card-body" style={{ padding: 'var(--card-pad-spacious)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--color-info-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={18} style={{ color: 'var(--color-info)' }} />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Crew
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {boatCounts.map(bc => (
                <div key={bc.boat_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ship size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    {bc.name}
                  </span>
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
