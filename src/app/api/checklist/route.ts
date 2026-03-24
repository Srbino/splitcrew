import { NextRequest } from 'next/server';
import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

const VALID_CATEGORIES = ['required', 'clothing', 'gear', 'recommended'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function isValidCategory(value: string): value is Category {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const action = request.nextUrl.searchParams.get('action');

    if (action === 'list') {
      const items = await query<{
        id: number;
        item_name: string;
        category: string;
        description: string | null;
        sort_order: number;
      }>(
        'SELECT * FROM checklist ORDER BY sort_order, id'
      );

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
      const { item_name, category, description } = body;
      if (!item_name || !category) {
        return apiError('Item name and category are required.');
      }
      if (!isValidCategory(category)) {
        return apiError('Invalid category. Must be: required, clothing, gear, or recommended.');
      }

      // Get max sort order
      const maxOrder = await queryOne<{ max_order: string }>(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM checklist'
      );
      const nextOrder = parseInt(maxOrder?.max_order || '0', 10) + 1;

      await execute(
        'INSERT INTO checklist (item_name, category, description, sort_order) VALUES ($1, $2, $3, $4)',
        [item_name, category, description || null, nextOrder]
      );

      return apiSuccess();
    }

    if (action === 'edit') {
      const { id, item_name, category, description } = body;
      if (!id || !item_name || !category) {
        return apiError('ID, item name, and category are required.');
      }
      if (!isValidCategory(category)) {
        return apiError('Invalid category. Must be: required, clothing, gear, or recommended.');
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
