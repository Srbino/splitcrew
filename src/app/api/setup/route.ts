import { getSetting, setSetting, execute, query } from '@/lib/db';
import { hashPassword } from '@/lib/bcrypt';
import { apiSuccess, apiError } from '@/lib/utils';
import { pool } from '@/lib/db';

/**
 * First-run setup endpoint.
 * Creates admin password, trip settings, boats, and initial users.
 * Only works when `installed` setting doesn't exist.
 */

export async function GET() {
  // Check if app is already installed
  const installed = await getSetting('installed', '');
  return apiSuccess({ installed: !!installed });
}

export async function POST(request: Request) {
  try {
    // Prevent re-setup
    const installed = await getSetting('installed', '');
    if (installed) {
      return apiError('App is already set up. Use admin panel to change settings.');
    }

    const body = await request.json();
    const {
      admin_password,
      language = 'en',
      trip_name = '',
      trip_date_from = '',
      trip_date_to = '',
      base_currency = 'EUR',
      app_icon = '⛵',
      boats = [],
      users = [],
    } = body;

    // Validation
    if (!admin_password || admin_password.length < 4) {
      return apiError('Admin password is required (min 4 characters).');
    }
    if (boats.length === 0) {
      return apiError('At least one boat is required.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Settings
      const adminHash = await hashPassword(admin_password);
      const settings = [
        ['installed', '1'],
        ['admin_password', adminHash],
        ['language', language],
        ['trip_name', trip_name],
        ['trip_date_from', trip_date_from],
        ['trip_date_to', trip_date_to],
        ['base_currency', base_currency],
        ['app_icon', app_icon],
        ['allowed_currencies', JSON.stringify([base_currency])],
        ['export_currency', base_currency],
      ];

      for (const [key, value] of settings) {
        await client.query(
          `INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2)
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
          [key, value]
        );
      }

      // 2. Boats
      const boatIdMap: Record<number, number> = {}; // temp index → real DB id
      for (let i = 0; i < boats.length; i++) {
        const b = boats[i];
        const result = await client.query(
          'INSERT INTO boats (name, emoji, color) VALUES ($1, $2, $3) RETURNING id',
          [b.name || `Boat ${i + 1}`, b.emoji || '⛵', b.color || 'blue']
        );
        boatIdMap[i] = result.rows[0].id;
      }

      // 3. Users
      for (const u of users) {
        if (!u.name || !u.password) continue;
        const userHash = await hashPassword(u.password);
        const boatId = boatIdMap[u.boat_index ?? 0] || boatIdMap[0];
        await client.query(
          'INSERT INTO users (name, phone, email, boat_id, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
          [u.name, u.phone || null, u.email || null, boatId, userHash, u.role || 'crew']
        );
      }

      await client.query('COMMIT');
      return apiSuccess({ message: 'Setup complete!' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Setup error:', err);
    return apiError('Setup failed. Please try again.');
  }
}
