import { getAllUsers } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const users = await getAllUsers();
    const data = users.map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar ? `/api/avatar/${u.id}` : null,
      boat_id: u.boat_id,
      boat_name: u.boat_name,
    }));
    // Crew roster changes rarely; let the browser cache it briefly so it
    // isn't re-downloaded on every screen. `private` = per-browser only.
    return apiSuccess(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return apiError('Failed to load users', 500);
  }
}
