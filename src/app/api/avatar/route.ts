import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType] || 'jpg';
}

// POST — Upload avatar
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return apiError('Unauthorized', 401);
  }

  const userId = session.userId;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return apiError('No file uploaded');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
  }

  if (file.size > MAX_SIZE) {
    return apiError('File too large. Maximum size is 3MB');
  }

  // Generate unique filename
  const randomHex = randomBytes(6).toString('hex');
  const ext = getExtension(file.type);
  const filename = `user_${userId}_${randomHex}.${ext}`;
  const avatarPath = `avatars/${filename}`;

  // Save file to public/avatars/
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicDir = join(process.cwd(), 'public', 'avatars');
  await writeFile(join(publicDir, filename), buffer);

  // Delete old avatar file if exists
  const currentUser = await queryOne<{ avatar: string | null }>(
    'SELECT avatar FROM users WHERE id = $1',
    [userId]
  );

  if (currentUser?.avatar) {
    const oldPath = join(process.cwd(), 'public', currentUser.avatar);
    try {
      await unlink(oldPath);
    } catch {
      // Old file may not exist, ignore
    }
  }

  // Update DB
  await execute('UPDATE users SET avatar = $1 WHERE id = $2', [avatarPath, userId]);

  return apiSuccess({ avatar: avatarPath });
}

// DELETE — Remove avatar
export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return apiError('Unauthorized', 401);
  }

  const userId = session.userId;

  // Get current avatar path
  const currentUser = await queryOne<{ avatar: string | null }>(
    'SELECT avatar FROM users WHERE id = $1',
    [userId]
  );

  if (currentUser?.avatar) {
    const filePath = join(process.cwd(), 'public', currentUser.avatar);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  }

  // Set avatar to NULL
  await execute('UPDATE users SET avatar = NULL WHERE id = $1', [userId]);

  return apiSuccess();
}
