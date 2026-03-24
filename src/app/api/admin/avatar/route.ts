import { getSession, requireCsrf } from '@/lib/auth';
import { execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import sharp from 'sharp';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;

// POST — Admin: upload avatar for any user
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return apiError('Unauthorized', 401);
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const formData = await request.formData();
  const file = formData.get('file');
  const userId = formData.get('userId');

  if (!userId || isNaN(Number(userId))) {
    return apiError('User ID is required');
  }
  if (!file || !(file instanceof File)) {
    return apiError('No file uploaded');
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
  }
  if (file.size > MAX_SIZE) {
    return apiError('File too large. Maximum size is 10MB');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const compressed = await sharp(buffer)
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80 })
    .toBuffer();

  const base64 = `data:image/webp;base64,${compressed.toString('base64')}`;

  await execute('UPDATE users SET avatar = $1 WHERE id = $2', [base64, Number(userId)]);

  return apiSuccess({ avatar: base64 });
}

// DELETE — Admin: remove avatar for any user
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return apiError('Unauthorized', 401);
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId || isNaN(Number(userId))) {
    return apiError('User ID is required');
  }

  await execute('UPDATE users SET avatar = NULL WHERE id = $1', [Number(userId)]);

  return apiSuccess();
}
