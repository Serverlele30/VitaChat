import { sql, param, ok, fail, auth, MAX_TEXT_LEN } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const me = await auth(req, res);
    if (!me) return;

    const to   = param(req, 'to');
    const text = param(req, 'text').slice(0, MAX_TEXT_LEN);
    if (!text) return fail(res, 'Leere Nachricht');

    const rcpt = await sql`SELECT id FROM users WHERE LOWER(name) = LOWER(${to})`;
    if (!rcpt.length) return fail(res, 'Empfaenger unbekannt');

    const now = Math.floor(Date.now() / 1000);
    const ins = await sql`
      INSERT INTO messages (sender, recipient, ts, text)
      VALUES (${me.id}, ${rcpt[0].id}, ${now}, ${text})
      RETURNING id`;

    ok(res, `OK|${ins[0].id}\n`);
  } catch (e) {
    fail(res, 'Serverfehler: ' + e.message);
  }
}
