import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const boatId = parseInt(searchParams.get('boat_id') || '0', 10);

    if (action === 'list') {
      if (!boatId) return apiError('boat_id is required');

      const items = await query(
        `SELECT si.*,
                ua.name AS assigned_to_name, ua.avatar AS assigned_to_avatar,
                ub.name AS bought_by_name, ub.avatar AS bought_by_avatar,
                uc.name AS created_by_name
         FROM shopping_items si
         LEFT JOIN users ua ON si.assigned_to = ua.id
         LEFT JOIN users ub ON si.bought_by = ub.id
         LEFT JOIN users uc ON si.created_by = uc.id
         WHERE si.boat_id = $1
         ORDER BY si.is_bought ASC, si.category ASC, si.created_at DESC`,
        [boatId]
      );

      const totalItems = items.length;
      const boughtItems = items.filter((i: any) => i.is_bought).length;

      // Calculate totals per currency for bought items
      const totals: Record<string, number> = {};
      for (const item of items) {
        const it = item as any;
        if (it.is_bought && it.price) {
          const cur = it.currency || 'EUR';
          totals[cur] = (totals[cur] || 0) + parseFloat(it.price);
        }
      }

      return apiSuccess({
        items,
        summary: {
          total_items: totalItems,
          bought_items: boughtItems,
          totals,
        },
      });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Shopping GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) return apiError('Unauthorized', 401);

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { boat_id, item_name, quantity, category, assigned_to, price, currency, note } = body;
      if (!boat_id || !item_name?.trim()) {
        return apiError('Boat and item name are required');
      }

      const result = await queryOne<{ id: number }>(
        `INSERT INTO shopping_items (boat_id, item_name, quantity, category, assigned_to, price, currency, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          boat_id,
          item_name.trim(),
          quantity || null,
          category || 'other',
          assigned_to || null,
          price || null,
          currency || 'EUR',
          note || null,
          session.userId,
        ]
      );

      return apiSuccess({ id: result?.id });
    }

    if (action === 'edit') {
      const { id, item_name, quantity, category, assigned_to, price, currency, note } = body;
      if (!id || !item_name?.trim()) {
        return apiError('ID and item name are required');
      }

      // Verify item exists and belongs to user's boat
      const item = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM shopping_items WHERE id = $1',
        [id]
      );
      if (!item) return apiError('Item not found', 404);

      await execute(
        `UPDATE shopping_items
         SET item_name = $1, quantity = $2, category = $3, assigned_to = $4,
             price = $5, currency = $6, note = $7
         WHERE id = $8`,
        [
          item_name.trim(),
          quantity || null,
          category || 'other',
          assigned_to || null,
          price || null,
          currency || 'EUR',
          note || null,
          id,
        ]
      );

      return apiSuccess();
    }

    if (action === 'toggle_bought') {
      const { id, is_bought, price } = body;
      if (!id) return apiError('ID is required');

      const item = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM shopping_items WHERE id = $1',
        [id]
      );
      if (!item) return apiError('Item not found', 404);

      if (is_bought) {
        await execute(
          `UPDATE shopping_items SET is_bought = true, bought_by = $1, price = COALESCE($2, price) WHERE id = $3`,
          [session.userId, price || null, id]
        );
      } else {
        await execute(
          `UPDATE shopping_items SET is_bought = false, bought_by = NULL WHERE id = $1`,
          [id]
        );
      }

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('ID is required');

      const item = await queryOne<{ created_by: number }>(
        'SELECT created_by FROM shopping_items WHERE id = $1',
        [id]
      );
      if (!item) return apiError('Item not found', 404);

      await execute('DELETE FROM shopping_items WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Shopping POST error:', err);
    return apiError('Server error', 500);
  }
}
