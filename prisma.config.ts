import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct (non-pooled) URL — required for Prisma migrate with Neon/PgBouncer
    url: process.env["DIRECT_URL"],
  },
});
