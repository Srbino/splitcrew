import { getSession, requireCsrf } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { toIban } from '@/lib/czech-payment';

/**
 * User self-service bank account (for QR Platba).
 * GET  → return the current user's stored account.
 * POST → set/clear it. Accepts a Czech account number (`[prefix-]number/bankcode`)
 *        or an IBAN; validated via IBAN checksum before saving.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId) return apiError('Unauthorized', 401);

  const user = await queryOne<{ bank_account: string | null }>(
    'SELECT bank_account FROM users WHERE id = $1',
    [session.userId]
  );
  return apiSuccess({ bank_account: user?.bank_account ?? null });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) return apiError('Unauthorized', 401);

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const raw = typeof body.bank_account === 'string' ? body.bank_account.trim() : '';

    // Empty → clear the account.
    if (!raw) {
      await execute('UPDATE users SET bank_account = NULL WHERE id = $1', [session.userId]);
      return apiSuccess({ bank_account: null });
    }

    if (raw.length > 50) {
      return apiError('Account is too long.');
    }
    // Validate it converts to a valid IBAN (Czech account number or IBAN).
    if (!toIban(raw)) {
      return apiError('Neplatné číslo účtu nebo IBAN.');
    }

    await execute('UPDATE users SET bank_account = $1 WHERE id = $2', [raw, session.userId]);
    return apiSuccess({ bank_account: raw });
  } catch (err) {
    console.error('Bank account update error:', err);
    return apiError('Server error', 500);
  }
}
