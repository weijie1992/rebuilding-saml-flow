// Seed the IdP with two lab users. Idempotent: safe to run on every start.
//
// LAB ONLY: both users share the password "password123".

import argon2 from "argon2";
import type pg from "pg";
import { audit } from "./audit.ts";

const LAB_PASSWORD = "password123";

const seedUsers = [
  {
    email: "alice@corp.test",
    displayName: "Alice Anderson",
    groups: ["Finance", "Employees"],
  },
  {
    email: "bob@corp.test",
    displayName: "Bob Brown",
    groups: ["Engineering", "Employees"],
  },
];

export async function seed(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const user of seedUsers) {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        [user.email],
      );
      if (existing.rowCount !== 0) continue;

      // argon2id is the argon2 library's default variant.
      const passwordHash = await argon2.hash(LAB_PASSWORD, { type: argon2.argon2id });
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        [user.email, user.displayName, passwordHash],
      );
      const userId = inserted.rows[0]!.id;

      for (const groupName of user.groups) {
        const group = await client.query<{ id: string }>(
          `INSERT INTO groups (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [groupName],
        );
        await client.query(
          "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [userId, group.rows[0]!.id],
        );
      }

      await audit(client, "seed.user_created", { email: user.email, groups: user.groups });
      console.log(`seed: created ${user.email}`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
