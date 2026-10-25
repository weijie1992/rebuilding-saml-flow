// Prisma CLI configuration (Prisma 7+). The connection string lives here,
// not in schema.prisma.

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Set by docker-compose. Offline commands (migrate diff) don't need it.
    url: process.env.DATABASE_URL ?? "",
  },
});
