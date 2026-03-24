import { getAllUsers } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const users = await getAllUsers();
    const data = users.map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      boat_id: u.boat_id,
      boat_name: u.boat_name,
    }));
    return apiSuccess(data);
  } catch {
    return apiError('Failed to load users', 500);
  }
}
