// A single shared Postgres connection pool for the SP.

import pg from "pg";
import { config } from "../config.ts";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
