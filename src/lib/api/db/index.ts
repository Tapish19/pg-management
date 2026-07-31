import { drizzle } from "drizzle-orm/libsql";
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
