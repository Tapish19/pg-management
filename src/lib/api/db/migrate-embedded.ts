import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";

type Snapshot = {
  tables: Record<
    string,
    {
      columns: Record<string, { type: string; notNull: boolean; primaryKey: boolean }>;
      compositePrimaryKeys?: Record<string, { columns: string[] }>;
    }
  >;
};
export type EmbeddedMigration = { sql: string; when: number; snapshot?: Snapshot };

async function validateExistingTable(
  tx: Awaited<ReturnType<Client["transaction"]>>,
  table: string,
  definition: Snapshot["tables"][string],
) {
  const info = await tx.execute(`PRAGMA table_info("${table.replaceAll('"', '""')}")`);
  if (!info.rows.length) return false;
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
  const expectedKey =
    Object.values(definition.compositePrimaryKeys ?? {})[0]?.columns ??
    Object.entries(definition.columns)
      .filter(([, column]) => column.primaryKey)
      .map(([name]) => name);
  const actualKey = info.rows
    .filter((row) => Number(row.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((row) => String(row.name));
  if (JSON.stringify(actualKey) !== JSON.stringify(expectedKey))
    throw new Error(
      `Existing database schema differs at ${table} primary key; migrate this database before starting the app`,
    );
  return true;
}

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
        await validateExistingTable(tx, table, definition);
      }
    }
    for (const [index, migration] of migrations.entries()) {
      if (migration.when <= lastApplied) continue;
      for (let statement of migration.sql
        .split("--> statement-breakpoint")
        .filter((sql) => sql.trim())) {
        const tableMatch = statement.match(/^\s*CREATE TABLE\s+[`"]?(\w+)[`"]?\s*\(/i);
        if (tableMatch) {
          const table = tableMatch[1];
          const definition = (migration.snapshot ?? (index === 0 ? initialSnapshot : undefined))
            ?.tables[table];
          // db:push or a previous deployment may have created this table without
          // recording its migration. Adopt it only after checking its schema.
          if (definition && (await validateExistingTable(tx, table, definition))) {
            statement = statement.replace(/CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
          }
        }
        if (index === 0 && !lastApplied)
          statement = statement.replace(
            /CREATE UNIQUE INDEX /g,
            "CREATE UNIQUE INDEX IF NOT EXISTS ",
          );
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
