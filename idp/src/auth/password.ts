// Password check against the IdP's user database.
//
// This is the one place in the whole SSO system where a password is ever
// seen. SPs never receive it — they only receive the signed Assertion the
// IdP issues afterwards. That separation is the point of SAML.

import argon2 from "argon2";
import { pool } from "../db/pool.ts";

export interface IdpUser {
  id: string;
  email: string;
  displayName: string;
}

export type PasswordCheck =
  | { ok: true; user: IdpUser }
  | { ok: false; reason: "unknown_user" | "bad_password" };

// A real argon2id hash of a random string, computed once at startup. When the
// email doesn't exist we still run argon2.verify against it, so a wrong email
// takes as long as a wrong password. Otherwise response time would reveal
// which emails have accounts (user enumeration).
const dummyHash = argon2.hash(crypto.randomUUID(), { type: argon2.argon2id });

export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
  }>(
    "SELECT id, email, display_name, password_hash FROM users WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  const row = result.rows[0];

  if (!row) {
    await argon2.verify(await dummyHash, password);
    return { ok: false, reason: "unknown_user" };
  }

  // argon2.verify reads the algorithm, salt and cost parameters out of the
  // stored hash string itself ("$argon2id$v=19$m=...,t=...,p=...$salt$hash").
  if (!(await argon2.verify(row.password_hash, password))) {
    return { ok: false, reason: "bad_password" };
  }

  return { ok: true, user: { id: row.id, email: row.email, displayName: row.display_name } };
}
