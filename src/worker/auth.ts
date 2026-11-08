import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { eq, sql } from 'drizzle-orm';
import * as schema from './db/schema';
import type { AppEnv, Env, Session } from './env';

export const ADMIN_COOKIE = 'admin_session';
const SESSION_DAYS = 7;
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

const toHex = (buffer: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Hashes a password using PBKDF2-HMAC-SHA256 with standard PHC string format:
 * $pbkdf2-sha256$i=<iterations>$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string, iterations = DEFAULT_PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return `$pbkdf2-sha256$i=${iterations}$${toHex(salt)}$${toHex(derived)}`;
}

// Dummy hash for constant-time comparison against non-existent accounts to eliminate timing attacks.
export const DUMMY_HASH =
  '$pbkdf2-sha256$i=600000$e3b0c44298fc1c149afbf4c8996fb924$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Verifies a password against the stored PHC string format.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
    return false;
  }
  const iterMatch = parts[2].match(/^i=(\d+)$/);
  if (!iterMatch) return false;
  const iterations = parseInt(iterMatch[1], 10);
  if (!iterations || iterations < 1000) return false;

  const saltHex = parts[3];
  const expectedHashHex = parts[4];
  if (saltHex.length !== 32) return false;

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return sameString(toHex(derived), expectedHashHex);
}

export function getClientIp(c: Context<AppEnv>): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

/**
 * Checks that initData really comes from Telegram for this bot (the official HMAC check) and is fresh.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyInitData(initData: string, botToken: string, maxAgeSeconds = 24 * 60 * 60) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const expected = toHex(await hmac(secret, dataCheckString));
  if (!sameString(expected, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as TelegramUser;
    return typeof user?.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

export function isAdminId(env: Env, telegramId: string | number): boolean {
  const ids = (env.ADMIN_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  return ids.includes(String(telegramId));
}

export async function createSession(env: Env, session: Session): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  return sign({ ...session, exp }, env.SESSION_SECRET, 'HS256');
}

/** Admin sessions in a normal browser live in an HttpOnly cookie that page scripts can't read. */
export async function setAdminCookie(c: Context<AppEnv>, session: Session) {
  setCookie(c, ADMIN_COOKIE, await createSession(c.env, session), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export const clearAdminCookie = (c: Context<AppEnv>) => deleteCookie(c, ADMIN_COOKIE, { path: '/' });

/** Reads the session from `Authorization: Bearer` (inside Telegram) or the admin cookie (website). */
export async function loadSession(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : getCookie(c, ADMIN_COOKIE);
  let session: Session | null = null;
  if (token) {
    try {
      const payload = (await verify(token, c.env.SESSION_SECRET, 'HS256')) as unknown as Session;
      // An admin removed from ADMIN_IDS loses access right away, even with a valid token.
      const stillAdmin = payload.role !== 'admin' || !payload.tg || isAdminId(c.env, payload.tg);
      if (stillAdmin) {
        if (payload.role === 'admin' && payload.adminId) {
          // Verify that the token version matches the database (session invalidation check)
          const db = c.get('db');
          const [adm] = await db
            .select({ tokenVersion: schema.admins.tokenVersion })
            .from(schema.admins)
            .where(eq(schema.admins.id, payload.adminId));
          if (adm && adm.tokenVersion === payload.tokenVersion) {
            session = {
              role: payload.role,
              tg: payload.tg,
              cid: payload.cid,
              adminId: payload.adminId,
              tokenVersion: payload.tokenVersion,
            };
          }
        } else {
          session = { role: payload.role, tg: payload.tg, cid: payload.cid };
        }
      }
    } catch {
      session = null;
    }
  }
  c.set('session', session);
  await next();
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  if (c.get('session')?.role !== 'admin') return c.json({ error: 'سجّل الدخول كمدير أولاً' }, 401);
  await next();
}
