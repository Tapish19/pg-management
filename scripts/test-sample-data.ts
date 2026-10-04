import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/api/db/schema";
import { seedSampleData } from "../src/lib/api/db/sample-data";

let directory = process.argv[process.argv.indexOf("--fixture-root") + 1];
if (!process.argv.includes("--fixture-root")) {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "pg-sample-test-"));
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(import.meta.url), "--fixture-root", directory],
    { stdio: "inherit", windowsHide: true },
  );
  for (const name of fs.readdirSync(directory)) {
    const target = path.resolve(directory, name);
    assert.equal(path.dirname(target), directory);
    fs.unlinkSync(target);
  }
  fs.rmdirSync(directory);
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
try {
  for (const file of ["0000_violet_manta", "0001_owner_settings", "0002_staff_attendance"])
    for (const sql of fs
      .readFileSync(`drizzle/${file}.sql`, "utf8")
      .split("--> statement-breakpoint"))
      if (sql.trim()) await client.execute(sql);
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  for (const id of ["sample-owner", "other-owner"])
    await db
      .insert(schema.owners)
      .values({ id, name: id, email: `${id}@example.invalid`, passwordHash: "not-a-login" });
  const result = await seedSampleData(db, "sample-owner", new Date("2026-10-04T10:00:00Z"));
  assert.deepEqual(result, { properties: 3, rooms: 18, tenants: 18, staff: 12 });
  const rooms = await db.select().from(schema.rooms);
  const bookings = await db.select().from(schema.bookings);
  for (const room of rooms) {
    assert.equal(
      bookings.filter((b) => b.roomId === room.id && b.status === "active").length,
      room.occupiedBeds,
    );
    assert.ok(room.occupiedBeds <= room.totalBeds);
  }
  assert.equal((await db.select().from(schema.foodMenu)).length, 21);
  assert.equal((await db.select().from(schema.payments)).length, 108);
  assert.equal((await db.select().from(schema.staffAttendance)).length, 48);
  assert.equal(
    (await db.select().from(schema.properties).where(eq(schema.properties.ownerId, "other-owner")))
      .length,
    0,
  );
  await assert.rejects(seedSampleData(db, "sample-owner"), /empty accounts only/);
  assert.equal((await db.select().from(schema.properties)).length, 3);
  await assert.rejects(seedSampleData(db, "missing"), /Owner account not found/);
  // A late failure must roll back every row, including global tenant records.
  await client.execute(
    "CREATE TRIGGER fail_menu BEFORE INSERT ON food_menu BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  await assert.rejects(seedSampleData(db, "other-owner"), (error: unknown) => {
    assert.match(String((error as { cause?: unknown }).cause), /test failure/);
    return true;
  });
  assert.equal((await db.select().from(schema.properties)).length, 3);
  assert.equal((await db.select().from(schema.tenants)).length, 18);
  console.log(
    "Sample data passed: full dataset, occupancy, foreign keys, owner isolation, repeat protection and rollback.",
  );
} finally {
  client.close();
}
