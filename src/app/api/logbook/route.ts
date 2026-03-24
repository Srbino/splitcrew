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

      const entries = await query(
        `SELECT l.*, u.name AS skipper_name
         FROM logbook l
         LEFT JOIN users u ON l.skipper_user_id = u.id
         WHERE l.boat_id = $1
         ORDER BY l.date DESC`,
        [boatId]
      );

      // Calculate stats
      let totalNm = 0;
      let maxNm = 0;
      for (const entry of entries) {
        const nm = parseFloat((entry as any).nautical_miles) || 0;
        totalNm += nm;
        if (nm > maxNm) maxNm = nm;
      }
      const totalDays = entries.length;
      const avgNm = totalDays > 0 ? Math.round((totalNm / totalDays) * 10) / 10 : 0;

      return apiSuccess({
        entries,
        stats: {
          total_nm: Math.round(totalNm * 10) / 10,
          total_days: totalDays,
          max_nm: maxNm,
          avg_nm: avgNm,
        },
      });
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Logbook GET error:', err);
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
      const { boat_id, date, location_from, location_to, nautical_miles, departure_time, arrival_time, skipper_user_id, note } = body;
      if (!boat_id || !date) {
        return apiError('Boat and date are required');
      }

      const result = await queryOne<{ id: number }>(
        `INSERT INTO logbook (boat_id, date, location_from, location_to, nautical_miles, departure_time, arrival_time, skipper_user_id, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          boat_id,
          date,
          location_from || '',
          location_to || '',
          nautical_miles || 0,
          departure_time || null,
          arrival_time || null,
          skipper_user_id || null,
          note || null,
          session.userId,
        ]
      );

      return apiSuccess({ id: result?.id });
    }

    if (action === 'edit') {
      const { id, date, location_from, location_to, nautical_miles, departure_time, arrival_time, skipper_user_id, note } = body;
      if (!id) return apiError('ID is required');

      const entry = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM logbook WHERE id = $1',
        [id]
      );
      if (!entry) return apiError('Entry not found', 404);

      await execute(
        `UPDATE logbook
         SET date = $1, location_from = $2, location_to = $3, nautical_miles = $4,
             departure_time = $5, arrival_time = $6, skipper_user_id = $7, note = $8
         WHERE id = $9`,
        [
          date,
          location_from || '',
          location_to || '',
          nautical_miles || 0,
          departure_time || null,
          arrival_time || null,
          skipper_user_id || null,
          note || null,
          id,
        ]
      );

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('ID is required');

      const entry = await queryOne<{ boat_id: number }>(
        'SELECT boat_id FROM logbook WHERE id = $1',
        [id]
      );
      if (!entry) return apiError('Entry not found', 404);

      await execute('DELETE FROM logbook WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action');
  } catch (err) {
    console.error('Logbook POST error:', err);
    return apiError('Server error', 500);
  }
}
