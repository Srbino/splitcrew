import { getSession } from '@/lib/auth';
import { execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import sharp from 'sharp';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB input limit

// POST — Upload avatar (compressed + stored as base64 in DB)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return apiError('Unauthorized', 401);
  }

  const formData = await request.formData();
  const file = formData.get('file');

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

  // Compress: resize to 256x256, convert to WebP quality 80
  const compressed = await sharp(buffer)
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80 })
    .toBuffer();

  const base64 = `data:image/webp;base64,${compressed.toString('base64')}`;

  await execute('UPDATE users SET avatar = $1 WHERE id = $2', [base64, session.userId]);

  return apiSuccess({ avatar: base64 });
}

// DELETE — Remove avatar
export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return apiError('Unauthorized', 401);
  }

  await execute('UPDATE users SET avatar = NULL WHERE id = $1', [session.userId]);

  return apiSuccess();
}
