import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";

type Snapshot = {
  tables: Record<
    string,
    { columns: Record<string, { type: string; notNull: boolean; primaryKey: boolean }> }
  >;
};
export type EmbeddedMigration = { sql: string; when: number };

// Keep SQL inside the server bundle so a deployed server does not depend on its working directory.
export async function migrateEmbedded(
  client: Client,
  migrations: EmbeddedMigration[],
  initialSnapshot: Snapshot,
) {
  const tx = await client.transaction("write");
  try {
    await tx.execute(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    const latest = await tx.execute(
      "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    const lastApplied = Number(latest.rows[0]?.created_at ?? 0);
    if (!lastApplied) {
      // Older installations used db:push. Validate their existing tables before adopting the baseline.
      for (const [table, definition] of Object.entries(initialSnapshot.tables)) {
        const info = await tx.execute(`PRAGMA table_info("${table.replaceAll('"', '""')}")`);
        if (!info.rows.length) continue;
        for (const [name, column] of Object.entries(definition.columns)) {
          const actual = info.rows.find((row) => row.name === name);
          if (
            !actual ||
            String(actual.type).toLowerCase() !== column.type.toLowerCase() ||
            (column.notNull && !Number(actual.notnull) && !Number(actual.pk)) ||
            (column.primaryKey && !Number(actual.pk))
          ) {
            throw new Error(
              `Existing database schema differs at ${table}.${name}; migrate this database before starting the app`,
            );
          }
        }
      }
    }
    for (const [index, migration] of migrations.entries()) {
      if (migration.when <= lastApplied) continue;
      for (let statement of migration.sql
        .split("--> statement-breakpoint")
        .filter((sql) => sql.trim())) {
        if (index === 0 && !lastApplied)
          statement = statement
            .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
            .replace(/CREATE UNIQUE INDEX /g, "CREATE UNIQUE INDEX IF NOT EXISTS ");
        await tx.execute(statement);
      }
      await tx.execute({
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        args: [createHash("sha256").update(migration.sql).digest("hex"), migration.when],
      });
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
