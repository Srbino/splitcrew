import { createHash } from 'node:crypto';
import { queryOne } from '@/lib/db';

// GET — Serve a user's avatar as a cacheable image.
// Avatars are stored in the DB as a `data:image/webp;base64,...` string;
// here we decode them to raw bytes so the browser can cache the image
// instead of re-downloading the base64 blob inside every JSON payload.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return new Response('Not found', { status: 404 });
  }

  const row = await queryOne<{ avatar: string | null }>(
    'SELECT avatar FROM users WHERE id = $1',
    [userId]
  );

  const dataUrl = row?.avatar;
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return new Response('Not found', { status: 404 });
  }

  const commaIdx = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, commaIdx); // e.g. "image/webp;base64"
  const contentType = meta.split(';')[0] || 'image/webp';
  const bytes = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64');

  const etag = `"${createHash('sha1').update(bytes).digest('hex')}"`;

  return new Response(bytes, {
    headers: {
      'Content-Type': contentType,
      ETag: etag,
      // Avatars are not secret and are keyed by user id; cache hard.
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
