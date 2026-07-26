import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/api/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: "file:./pg-one.db",
  },
});
