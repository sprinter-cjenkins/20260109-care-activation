import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: "mysql://root:dev@127.0.0.1:3306/db_test",
    shadowDatabaseUrl: "mysql://root:dev@127.0.0.1:3306/prisma_migrate_shadow",
  },
});
