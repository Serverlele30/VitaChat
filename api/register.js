import { sql, param, ok, fail, hashPassword } from '../lib/db.js';

export default async function handler(req, res) {
  const name = param(req, 'user');
  const pass = param(req, 'pass');

  if (!/^[A-Za-z0-9_-]{2,20}$/.test(name))
    return fail(res, 'Name: 2-20 Zeichen, a-z 0-9 _ -');
  if (pass.length < 4)
    return fail(res, 'Passwort zu kurz (min. 4)');

  try {
    const exists = await sql`SELECT id FROM users WHERE LOWER(name) = LOWER(${name})`;
    if (exists.length) return fail(res, 'Name bereits vergeben');

    await sql`INSERT INTO users (name, pass_hash) VALUES (${name}, ${hashPassword(pass)})`;
    ok(res, 'OK|registriert\n');
  } catch (e) {
    fail(res, 'Serverfehler: ' + e.message);
  }
}
