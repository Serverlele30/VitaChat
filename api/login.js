import { sql, param, ok, fail, verifyPassword, newToken } from '../lib/db.js';

export default async function handler(req, res) {
  const name = param(req, 'user');
  const pass = param(req, 'pass');

  try {
    const rows = await sql`
      SELECT id, pass_hash FROM users WHERE LOWER(name) = LOWER(${name})`;
    if (!rows.length || !verifyPassword(pass, rows[0].pass_hash))
      return fail(res, 'Login fehlgeschlagen');

    const token = newToken();
    const now   = Math.floor(Date.now() / 1000);
    await sql`UPDATE users SET token = ${token}, last_seen = ${now} WHERE id = ${rows[0].id}`;

    ok(res, `OK|${token}\n`);
  } catch (e) {
    fail(res, 'Serverfehler: ' + e.message);
  }
}
