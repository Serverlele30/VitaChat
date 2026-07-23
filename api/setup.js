// Einmalig aufrufen: https://<projekt>.vercel.app/api/setup
// Legt die Tabellen an. Mehrfaches Aufrufen ist unschädlich.
import { sql, ok, fail } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      token     TEXT,
      last_seen BIGINT DEFAULT 0
    )`;
    // Namen ohne Rücksicht auf Groß-/Kleinschreibung eindeutig halten
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users (LOWER(name))`;

    await sql`CREATE TABLE IF NOT EXISTS messages (
      id        SERIAL PRIMARY KEY,
      sender    INTEGER NOT NULL,
      recipient INTEGER NOT NULL,
      ts        BIGINT  NOT NULL,
      text      TEXT    NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_msg ON messages (recipient, sender, id)`;

    await sql`CREATE TABLE IF NOT EXISTS reads (
      user_id INTEGER NOT NULL,
      peer_id INTEGER NOT NULL,
      last_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, peer_id)
    )`;

    ok(res, 'OK|Datenbank bereit\n');
  } catch (e) {
    fail(res, 'Setup fehlgeschlagen: ' + e.message);
  }
}
