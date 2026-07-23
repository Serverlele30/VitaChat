// Gemeinsame Helfer für alle vitaAPI-Endpunkte (Vercel Serverless + Neon Postgres)
import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);

export const ONLINE_SECS  = 60;
export const MAX_TEXT_LEN = 500;
export const MAX_POLL     = 50;
export const PREVIEW_LEN  = 38;

/* ---------------- Antwort-Protokoll (zeilenbasiert, Pipe-getrennt) ---------------- */

export function textHead(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}

export function ok(res, body = '') {
  textHead(res);
  res.status(200).send(body);
}

export function fail(res, msg) {
  textHead(res);
  res.status(200).send(`ERR|${msg}\n`);   // 200, damit der Vita-Client die Zeile sicher liest
}

/** Pipes und Zeilenumbrüche aus Nutzdaten entfernen, damit das Protokoll heil bleibt. */
export function clean(s) {
  return String(s).replace(/\|/g, '¦').replace(/[\r\n]+/g, ' ');
}

/* ---------------- Parameter (GET-Query oder POST-Formulardaten) ---------------- */

export function param(req, key) {
  let v = req.query?.[key];
  if (v === undefined && req.body) {
    if (typeof req.body === 'string') {
      // Fallback, falls Vercel den Body nicht geparst hat
      v = new URLSearchParams(req.body).get(key);
    } else {
      v = req.body[key];
    }
  }
  return (v ?? '').toString().trim();
}

/* ---------------- Passwörter (scrypt aus Node, keine Extra-Abhängigkeit) ---------------- */

export function hashPassword(pass) {
  const salt = randomBytes(16);
  const hash = scryptSync(pass, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(pass, stored) {
  try {
    const [saltHex, hashHex] = String(stored).split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual   = scryptSync(pass, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function newToken() {
  return randomBytes(16).toString('hex');
}

/* ---------------- Authentifizierung ---------------- */

/** Gibt den Nutzer zurück oder null (dann hat der Aufrufer bereits geantwortet). */
export async function auth(req, res) {
  const token = param(req, 'token');
  if (!token) { fail(res, 'Kein Token'); return null; }

  const rows = await sql`SELECT id, name FROM users WHERE token = ${token}`;
  if (!rows.length) { fail(res, 'Ungueltiges Token'); return null; }

  const now = Math.floor(Date.now() / 1000);
  await sql`UPDATE users SET last_seen = ${now} WHERE id = ${rows[0].id}`;
  return rows[0];
}
