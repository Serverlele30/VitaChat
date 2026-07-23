import { sql, ok, fail, auth, clean, ONLINE_SECS, PREVIEW_LEN } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const me = await auth(req, res);
    if (!me) return;

    const now = Math.floor(Date.now() / 1000);

    // Alles in EINER Abfrage – auf Serverless zählt jede Round-Trip-Zeit.
    const rows = await sql`
      SELECT u.name, u.last_seen,
             COALESCE(lm.ts, 0)  AS last_ts,
             lm.text             AS last_text,
             lm.sender           AS last_sender,
             COALESCE(un.cnt, 0) AS unread
      FROM users u
      LEFT JOIN LATERAL (
        SELECT m.ts, m.text, m.sender FROM messages m
        WHERE (m.sender = ${me.id} AND m.recipient = u.id)
           OR (m.sender = u.id     AND m.recipient = ${me.id})
        ORDER BY m.id DESC LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt FROM messages m
        WHERE m.sender = u.id AND m.recipient = ${me.id}
          AND m.id > COALESCE(
            (SELECT last_id FROM reads WHERE user_id = ${me.id} AND peer_id = u.id), 0)
      ) un ON TRUE
      WHERE u.id <> ${me.id}
      ORDER BY last_ts DESC, LOWER(u.name) ASC`;

    const body = rows.map(r => {
      const online = (now - Number(r.last_seen) < ONLINE_SECS) ? 1 : 0;

      let preview = '';
      if (r.last_text) {
        let txt = r.last_text.slice(0, PREVIEW_LEN);
        if (r.last_text.length > PREVIEW_LEN) txt += '…';
        preview = (r.last_sender === me.id ? 'Du: ' : '') + txt;
      }

      return `USER|${clean(r.name)}|${online}|${r.unread}|${r.last_ts}|${clean(preview)}`;
    }).join('\n');

    ok(res, body ? body + '\n' : '');
  } catch (e) {
    fail(res, 'Serverfehler: ' + e.message);
  }
}
