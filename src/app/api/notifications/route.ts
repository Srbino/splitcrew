import { getSession, requireCsrf } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { listNotificationsFor, markRead, markAllRead } from '@/lib/notifications';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId && !session.isAdmin) {
      return apiError('Unauthorized', 401);
    }
    const result = await listNotificationsFor(session);
    return apiSuccess(result);
  } catch (err) {
    console.error('Notifications GET error:', err);
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
    switch (body.action) {
      case 'mark_read':
        if (!body.id) return apiError('Missing id');
        await markRead(session, Number(body.id));
        return apiSuccess({ ok: true });
      case 'mark_all_read':
        await markAllRead(session);
        return apiSuccess({ ok: true });
      default:
        return apiError('Unknown action');
    }
  } catch (err) {
    console.error('Notifications POST error:', err);
    return apiError('Server error', 500);
  }
}
