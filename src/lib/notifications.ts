/**
 * Lightweight in-app notifications.
 *
 * Three audiences, each with its own read-state model:
 *  - EVERYONE  (`wallet_closed`, `wallet_reopened`): broadcast (user_id NULL).
 *               Per-user read state lives in `notification_reads`.
 *  - ADMIN     (`expense_pending`): broadcast but only surfaced to admins, so the
 *               row's own `read_at` is safe to use as the (single) admin read flag.
 *  - USER      (`expense_approved`, `expense_rejected`): addressed to one user via
 *               `user_id`; read state is the row's `read_at`.
 */
import { query, execute } from './db';

export const EVERYONE_TYPES = ['wallet_closed', 'wallet_reopened'] as const;
export const ADMIN_TYPES = ['expense_pending'] as const;

export interface NotifSession {
  userId?: number | null;
  isAdmin?: boolean;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
}

interface NotifRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  effective_read_at: string | null;
}

/** Send a notification to one specific user. */
export async function notifyUser(
  userId: number,
  type: string,
  title: string,
  body: string | null = null,
  link: string | null = null,
): Promise<void> {
  await execute(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body, link],
  );
}

/** Broadcast a notification (user_id NULL). Audience is decided by `type`. */
export async function notifyBroadcast(
  type: string,
  title: string,
  body: string | null = null,
  link: string | null = null,
): Promise<void> {
  await execute(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES (NULL, $1, $2, $3, $4)`,
    [type, title, body, link],
  );
}

function toItems(rows: NotifRow[]): { items: NotificationItem[]; unread_count: number } {
  const items = rows.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    created_at: r.created_at,
    read: r.effective_read_at != null,
  }));
  return { items, unread_count: items.filter(i => !i.read).length };
}

/** List the most recent notifications visible to this session, with read state. */
export async function listNotificationsFor(
  session: NotifSession,
): Promise<{ items: NotificationItem[]; unread_count: number }> {
  if (session.isAdmin) {
    const rows = await query<NotifRow>(
      `SELECT id, type, title, body, link, created_at, read_at AS effective_read_at
       FROM notifications
       WHERE type = ANY($1)
       ORDER BY created_at DESC LIMIT 50`,
      [ADMIN_TYPES as unknown as string[]],
    );
    return toItems(rows);
  }

  const me = session.userId ?? null;
  if (!me) return { items: [], unread_count: 0 };

  const rows = await query<NotifRow>(
    `SELECT n.id, n.type, n.title, n.body, n.link, n.created_at,
            CASE WHEN n.user_id IS NOT NULL THEN n.read_at ELSE nr.read_at END AS effective_read_at
     FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE n.user_id = $1 OR (n.user_id IS NULL AND n.type = ANY($2))
     ORDER BY n.created_at DESC LIMIT 50`,
    [me, EVERYONE_TYPES as unknown as string[]],
  );
  return toItems(rows);
}

/** Mark a single notification read for this session. */
export async function markRead(session: NotifSession, id: number): Promise<void> {
  if (session.isAdmin) {
    await execute(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND read_at IS NULL`, [id]);
    return;
  }
  const me = session.userId ?? null;
  if (!me) return;
  const row = await query<{ user_id: number | null }>(
    `SELECT user_id FROM notifications WHERE id = $1`,
    [id],
  );
  if (row.length === 0) return;
  if (row[0].user_id === me) {
    await execute(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND read_at IS NULL`, [id]);
  } else if (row[0].user_id === null) {
    await execute(
      `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [id, me],
    );
  }
}

/** Mark every currently-visible notification read for this session. */
export async function markAllRead(session: NotifSession): Promise<void> {
  if (session.isAdmin) {
    await execute(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE type = ANY($1) AND read_at IS NULL`,
      [ADMIN_TYPES as unknown as string[]],
    );
    return;
  }
  const me = session.userId ?? null;
  if (!me) return;
  await execute(
    `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL`,
    [me],
  );
  await execute(
    `INSERT INTO notification_reads (notification_id, user_id)
     SELECT n.id, $1 FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE n.user_id IS NULL AND n.type = ANY($2) AND nr.notification_id IS NULL`,
    [me, EVERYONE_TYPES as unknown as string[]],
  );
}
