import { NextRequest } from 'next/server';
import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

const VALID_CATEGORIES = [
  'required', 'clothing', 'gear', 'electronics', 'toiletries',
  'first_aid', 'galley', 'fun', 'recommended',
] as const;

const VALID_SCOPES = ['personal', 'boat', 'trip'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const action = request.nextUrl.searchParams.get('action');
    const scopeFilter = request.nextUrl.searchParams.get('scope') || 'all';

    if (action === 'list') {
      let items;

      if (session.isAdmin || scopeFilter === 'all') {
        // Admin sees everything; 'all' scope shows everything user can see
        if (session.isAdmin) {
          items = await query<{
            id: number; item_name: string; category: string;
            description: string | null; scope: string;
            user_id: number | null; boat_id: number | null; sort_order: number;
          }>('SELECT * FROM checklist ORDER BY scope, sort_order, id');
        } else {
          // Member sees: their personal + their boat + trip-wide
          items = await query<{
            id: number; item_name: string; category: string;
            description: string | null; scope: string;
            user_id: number | null; boat_id: number | null; sort_order: number;
          }>(
            `SELECT * FROM checklist
             WHERE scope = 'trip'
                OR (scope = 'boat' AND boat_id = $1)
                OR (scope = 'personal' AND user_id = $2)
             ORDER BY scope, sort_order, id`,
            [session.boatId || 0, session.userId || 0]
          );
        }
      } else if (scopeFilter === 'personal') {
        items = await query(
          `SELECT * FROM checklist WHERE scope = 'personal' AND user_id = $1 ORDER BY sort_order, id`,
          [session.userId || 0]
        );
      } else if (scopeFilter === 'boat') {
        items = await query(
          `SELECT * FROM checklist WHERE scope = 'boat' AND boat_id = $1 ORDER BY sort_order, id`,
          [session.boatId || 0]
        );
      } else {
        items = await query(
          `SELECT * FROM checklist WHERE scope = 'trip' ORDER BY sort_order, id`
        );
      }

      return apiSuccess({ items });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Checklist GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { item_name, category, description, scope, boat_id } = body;
      if (!item_name || !category) {
        return apiError('Item name and category are required.');
      }

      const validScope = (VALID_SCOPES as readonly string[]).includes(scope) ? scope : 'trip';

      // Determine user_id and boat_id based on scope
      let itemUserId: number | null = null;
      let itemBoatId: number | null = null;

      if (validScope === 'personal') {
        itemUserId = session.userId || null;
      } else if (validScope === 'boat') {
        itemBoatId = boat_id || session.boatId || null;
      }
      // trip scope: both null

      const maxOrder = await queryOne<{ max_order: string }>(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM checklist'
      );
      const nextOrder = parseInt(maxOrder?.max_order || '0', 10) + 1;

      await execute(
        'INSERT INTO checklist (item_name, category, description, scope, user_id, boat_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [item_name, category, description || null, validScope, itemUserId, itemBoatId, nextOrder]
      );

      return apiSuccess();
    }

    if (action === 'edit') {
      const { id, item_name, category, description } = body;
      if (!id || !item_name || !category) {
        return apiError('ID, item name, and category are required.');
      }

      await execute(
        'UPDATE checklist SET item_name = $1, category = $2, description = $3 WHERE id = $4',
        [item_name, category, description || null, id]
      );

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('Item ID is required.');

      await execute('DELETE FROM checklist WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action.');
  } catch (err) {
    console.error('Checklist POST error:', err);
    return apiError('Server error', 500);
  }
}
