import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const boatId = parseInt(searchParams.get('boat_id') || '0', 10);

    if (action === 'list') {
      if (!boatId) return apiError('boat_id is required');

      const meals = await query(
        `SELECT mp.*, u.name AS cook_name
         FROM menu_plan mp
         LEFT JOIN users u ON mp.cook_user_id = u.id
         WHERE mp.boat_id = $1
         ORDER BY mp.date ASC, mp.meal_type ASC`,
        [boatId]
      );

      return apiSuccess({ meals });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Menu GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) return apiError('Unauthorized', 401);

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { boat_id, date, meal_type, cook_user_id, meal_description, note } = body;
      if (!boat_id || !date || !meal_type) {
        return apiError('Boat, date, and meal type are required');
      }

      // Check for duplicate
      const existing = await queryOne(
        'SELECT id FROM menu_plan WHERE boat_id = $1 AND date = $2 AND meal_type = $3',
        [boat_id, date, meal_type]
      );
      if (existing) {
        return apiError('A meal is already planned for this date and type. Edit the existing one instead.');
      }

      const result = await queryOne<{ id: number }>(
        `INSERT INTO menu_plan (boat_id, date, meal_type, cook_user_id, meal_description, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          boat_id,
          date,
          meal_type,
          cook_user_id || null,
          meal_description || null,
          note || null,
          session.userId,
        ]
      );

      return apiSuccess({ id: result?.id });
    }

    if (action === 'edit') {
      const { id, cook_user_id, meal_description, note } = body;
      if (!id) return apiError('ID is required');

      const meal = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM menu_plan WHERE id = $1',
        [id]
      );
      if (!meal) return apiError('Meal not found', 404);

      await execute(
        `UPDATE menu_plan
         SET cook_user_id = $1, meal_description = $2, note = $3
         WHERE id = $4`,
        [cook_user_id || null, meal_description || null, note || null, id]
      );

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('ID is required');

      const meal = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM menu_plan WHERE id = $1',
        [id]
      );
      if (!meal) return apiError('Meal not found', 404);

      await execute('DELETE FROM menu_plan WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Menu POST error:', err);
    return apiError('Server error', 500);
  }
}
