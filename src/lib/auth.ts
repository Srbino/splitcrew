import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionData {
  userId?: number;
  userName?: string;
  boatId?: number;
  isAdmin?: boolean;
  lastActivity?: number;
  // Rate limiting
  loginAttempts?: number;
  loginLastAttempt?: number;
  // CSRF
  csrfToken?: string;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'dev-secret-must-be-at-least-32-characters-long-for-iron-session',
  cookieName: 'crewsplit_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId && !session.isAdmin) {
    redirect('/');
  }
  return session;
}

export async function requireAdmin(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isAdmin) {
    redirect('/');
  }
  return session;
}

export function isLoggedIn(session: SessionData): boolean {
  return !!session.userId;
}

export function isAdmin(session: SessionData): boolean {
  return !!session.isAdmin;
}

/** Generate or return existing CSRF token */
export async function getCsrfToken(): Promise<string> {
  const session = await getSession();
  if (!session.csrfToken) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    session.csrfToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    await session.save();
  }
  return session.csrfToken;
}

/** Verify CSRF token from request header or body */
export async function verifyCsrf(token: string): Promise<boolean> {
  const session = await getSession();
  if (!session.csrfToken || !token) return false;
  // Constant-time comparison
  const a = new TextEncoder().encode(session.csrfToken);
  const b = new TextEncoder().encode(token);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/** Helper to extract CSRF token from a Request */
export function getCsrfFromRequest(request: Request): string {
  return request.headers.get('x-csrf-token') || '';
}

/** Verify CSRF from Request, return JSON error response if invalid */
export async function requireCsrf(request: Request): Promise<Response | null> {
  const token = getCsrfFromRequest(request);
  const valid = await verifyCsrf(token);
  if (!valid) {
    return Response.json(
      { success: false, error: 'Invalid security token. Please refresh the page.' },
      { status: 403 }
    );
  }
  return null;
}
