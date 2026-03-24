import { Pool, type QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/** Run a parameterized query and return all rows */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** Run a parameterized query and return the first row (or null) */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/** Run a parameterized query and return the count of affected rows */
export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

// ── Settings helpers ──

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await queryOne<{ setting_value: string }>(
    'SELECT setting_value FROM settings WHERE setting_key = $1',
    [key]
  );
  return row?.setting_value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO settings (setting_key, setting_value)
     VALUES ($1, $2)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, value]
  );
}

// ── User helpers ──

export interface User {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  boat_id: number;
}

export interface UserWithBoat extends User {
  boat_name: string;
}

export async function getAllUsers(): Promise<UserWithBoat[]> {
  return query<UserWithBoat>(
    `SELECT u.*, b.name AS boat_name
     FROM users u LEFT JOIN boats b ON u.boat_id = b.id
     ORDER BY u.boat_id, u.name`
  );
}

export async function getUserById(id: number): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getUsersByBoat(boatId: number): Promise<User[]> {
  return query<User>(
    'SELECT * FROM users WHERE boat_id = $1 ORDER BY name',
    [boatId]
  );
}

export { pool };
