import { createHash } from 'crypto';

/**
 * Verify a password against a bcrypt hash.
 *
 * We use a child process to call Node's built-in bcrypt-compatible
 * verification. For simplicity in the initial version, we shell out
 * to a tiny script. In production, install the 'bcryptjs' package.
 *
 * For now: install bcryptjs as a dependency.
 */

let bcryptjs: typeof import('bcryptjs') | null = null;

async function getBcrypt() {
  if (!bcryptjs) {
    bcryptjs = await import('bcryptjs');
  }
  return bcryptjs;
}

export async function compare(password: string, hash: string): Promise<boolean> {
  const bc = await getBcrypt();
  return bc.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  const bc = await getBcrypt();
  return bc.hash(password, 12);
}
