// Append an event to audit_log. The lab uses this to make every step of the
// flow (and every rejection reason) visible with a simple SQL query.

import type pg from "pg";

export async function audit(
  db: pg.Pool | pg.PoolClient,
  event: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.query("INSERT INTO audit_log (event, details) VALUES ($1, $2)", [
    event,
    JSON.stringify(details),
  ]);
}
