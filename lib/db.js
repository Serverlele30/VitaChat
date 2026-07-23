// Gemeinsame Helfer für alle vitaAPI-Endpunkte (Vercel Serverless + Neon Postgres)
import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const ONLINE_SECS  = 60;
export const MAX_TEXT_LEN = 500;
export const MAX_POLL     = 50;
export const PREVIEW_LEN  = 38;

/* ---------------- Datenbank-Verbindung (verzögert aufgebaut) ----------------
 * Wichtig: NICHT beim Import verbinden. Fehlt die Umgebungsvariable, würde
 * neon() sofort werfen und die Function stürzt ab, bevor irgendein try/catch
 * greift (Vercel zeigt dann nur FUNCTION_INVOCATION_FAILED). So bekommen wir
 * stattdessen eine lesbare ERR|-Zeile.
 */
let _sql = null;

function getSql() {
  if (_sql) return _sql;

  // Je nach Integration heißt die Variable unterschiedlich.
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    const found = Object.keys(process.env)
      .filter(k => /POSTGRES|DATABASE|NEON/i.test(k))
      .join(', ') || 'keine';
    throw new Error(
      `Keine Datenbank-URL gefunden. Gefundene passende Variablen: ${found}. ` +
      `Im Vercel-Dashboard unter Storage eine Neon-Datenbank verbinden und neu deployen.`
    );
  }
  _sql = neon(url);
  return _sql;
}

/** Als Tagged Template nutzbar: sql`SELECT ...` */
export function sql(strings, ...values) {
  return getSql()(strings, ...values);
}

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
