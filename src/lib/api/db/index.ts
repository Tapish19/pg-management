import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import path from "path";

// On Render (and most PaaS providers) the local filesystem is ephemeral —
// it gets wiped on every deploy/restart, which silently drops all data
// (see: tenants table showing 0 rows after a restart even right after a
// successful booking). If TURSO_DATABASE_URL is set, connect to a real
// hosted libSQL database (e.g. Turso, https://turso.tech — free tier,
// same @libsql/client driver, no code changes needed beyond this file).
// Falls back to a local file for local development when unset.
const client = process.env.TURSO_DATABASE_URL
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : createClient({
      url: `file:${path.join(process.cwd(), "pg-one.db")}`,
    });

export const db = drizzle(client, { schema });

// Auto-apply schema migrations on boot instead of requiring a manual
// `npm run db:push` from a local machine — there's no local git/CLI setup
// in this deployment flow, and this makes a fresh Turso database (or a
// fresh local file) work automatically on first request. Safe to run every
// startup: drizzle tracks applied migrations and only runs new ones.
let migrationsReady: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (!migrationsReady) {
    migrationsReady = migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch(
      (err) => {
        migrationsReady = null; // allow retry on next request instead of caching a failure forever
        throw err;
      }
    );
  }
  return migrationsReady;
}
