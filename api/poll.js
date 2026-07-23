import { sql, param, ok, fail, auth, clean, MAX_POLL } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const me = await auth(req, res);
    if (!me) return;

    const withName = param(req, 'with');
    const since    = parseInt(param(req, 'since'), 10) || 0;

    const other = await sql`SELECT id FROM users WHERE LOWER(name) = LOWER(${withName})`;
    if (!other.length) return fail(res, 'Nutzer unbekannt');
    const peer = other[0].id;

    const msgs = await sql`
      SELECT m.id, u.name AS sender_name, m.ts, m.text
      FROM messages m JOIN users u ON u.id = m.sender
      WHERE m.id > ${since}
        AND ((m.sender = ${me.id} AND m.recipient = ${peer})
          OR (m.sender = ${peer}  AND m.recipient = ${me.id}))
      ORDER BY m.id ASC
      LIMIT ${MAX_POLL}`;

    const body = msgs
      .map(m => `MSG|${m.id}|${clean(m.sender_name)}|${m.ts}|${clean(m.text)}`)
      .join('\n');

    // Chat als gelesen markieren
    const maxRow = await sql`
      SELECT COALESCE(MAX(id), 0) AS max_id FROM messages
      WHERE (sender = ${me.id} AND recipient = ${peer})
         OR (sender = ${peer}  AND recipient = ${me.id})`;
    const maxId = maxRow[0].max_id;

    await sql`
      INSERT INTO reads (user_id, peer_id, last_id)
      VALUES (${me.id}, ${peer}, ${maxId})
      ON CONFLICT (user_id, peer_id)
      DO UPDATE SET last_id = GREATEST(reads.last_id, ${maxId})`;

    ok(res, body ? body + '\n' : '');
  } catch (e) {
    fail(res, 'Serverfehler: ' + e.message);
  }
}
