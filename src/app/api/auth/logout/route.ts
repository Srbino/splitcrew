import { getSession } from '@/lib/auth';
import { apiSuccess } from '@/lib/utils';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return apiSuccess({ redirect: '/' });
}
