import { NextRequest } from 'next/server';
import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

const VALID_TYPES = ['sailing', 'port', 'car'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const action = request.nextUrl.searchParams.get('action');

    if (action === 'list') {
      const items = await query<{
        id: number; day_number: number; date: string; title: string;
        description: string | null; location_from: string | null;
        location_to: string | null; type: string; sort_order: number;
      }>('SELECT * FROM itinerary ORDER BY sort_order, date, id');

      return apiSuccess({ items });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Itinerary GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { date, title, description, location_from, location_to, type, sort_order } = body;
      if (!title || !date) {
        return apiError('Title and date are required.');
      }

      const validType = (VALID_TYPES as readonly string[]).includes(type) ? type : 'sailing';

      // Auto-increment sort_order if not provided
      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrder = await queryOne<{ max_order: string }>(
          'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM itinerary'
        );
        order = parseInt(maxOrder?.max_order || '0', 10) + 1;
      }

      await execute(
        `INSERT INTO itinerary (day_number, date, title, description, location_from, location_to, type, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [body.day_number || 0, date, title, description || null, location_from || null, location_to || null, validType, order]
      );

      return apiSuccess();
    }

    if (action === 'edit') {
      const { id, date, title, description, location_from, location_to, type, sort_order, day_number } = body;
      if (!id || !title || !date) {
        return apiError('ID, title, and date are required.');
      }

      const validType = (VALID_TYPES as readonly string[]).includes(type) ? type : 'sailing';

      await execute(
        `UPDATE itinerary
         SET day_number = $1, date = $2, title = $3, description = $4,
             location_from = $5, location_to = $6, type = $7, sort_order = $8
         WHERE id = $9`,
        [day_number || 0, date, title, description || null, location_from || null, location_to || null, validType, sort_order || 0, id]
      );

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('Item ID is required.');

      await execute('DELETE FROM itinerary WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action.');
  } catch (err) {
    console.error('Itinerary POST error:', err);
    return apiError('Server error', 500);
  }
}
