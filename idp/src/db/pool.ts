// A single shared Postgres connection pool for the IdP.

import pg from "pg";
import { config } from "../config.ts";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
