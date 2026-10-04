import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { migrateEmbedded } from "../src/lib/api/db/migrate-embedded.ts";
import { currentRentCollection } from "../src/lib/collection-rate.ts";
import { cosineSimilarity, rankRelevantDocuments } from "../src/lib/rag/relevance.ts";
import {
  publicListing,
  filterPublicListings,
  parseStringArray,
} from "../src/lib/public-listings.ts";
import { attendanceSummary, isCalendarDate } from "../src/lib/staff-attendance.ts";

test("assistant relevance ranks matching text above unrelated and opposite vectors", () => {
  const result = rankRelevantDocuments(
    [1, 0],
    ["opposite", "relevant", "unrelated"],
    [
      [-1, 0],
      [20, 0],
      [0, 1],
    ],
    0.45,
  );
  assert.deepEqual(result, { topScore: 1, documents: ["relevant"] });
  assert.equal(cosineSimilarity([3, 4], [30, 40]), 1);
});
test("malformed and missing assistant vectors cannot pass the confidence gate", () => {
  for (const vector of [[], [0, 0], [NaN, 1], [Infinity, 1], [1]])
    assert.equal(cosineSimilarity([1, 0], vector), 0);
  assert.deepEqual(rankRelevantDocuments([1, 0], ["unknown"], [], 0.45), {
    topScore: 0,
    documents: [],
  });
});
test("attendance counts only this month's recorded days and handles no records", () => {
  assert.deepEqual(attendanceSummary([], "2026-10"), { percentage: null, days: 0 });
  assert.deepEqual(
    attendanceSummary(
      [
        { date: "2026-10-01", status: "present" },
        { date: "2026-10-02", status: "absent" },
        { date: "2026-10-03", status: "on-leave" },
        { date: "2026-09-30", status: "present" },
      ],
      "2026-10",
    ),
    { percentage: 33, days: 3 },
  );
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("2026-04-31"), false);
});
const listingProperty = {
  id: "live",
  name: "Live PG",
  city: "Bengaluru",
  locality: "HSR",
  address: "Real address",
  description: null,
  genderType: "co-ed",
  amenities: '["WiFi"]',
  images: null,
};
const availableRoom = {
  id: "room",
  roomNumber: "101",
  sharingType: "double",
  totalBeds: 2,
  occupiedBeds: 1,
  rentPerBed: 9000,
  depositAmount: 5000,
  status: "available",
  amenities: '["AC"]',
};
test("public availability excludes maintenance rooms and derives actual amenities", () => {
  const property = publicListing(listingProperty, [
    availableRoom,
    {
      ...availableRoom,
      id: "maintenance",
      status: "maintenance",
      rentPerBed: 1000,
      occupiedBeds: 0,
    },
  ]);
  assert.equal(property.availableBeds, 1);
  assert.equal(property.rentFrom, 9000);
  assert.equal(property.ac, true);
  assert.equal(property.wifi, true);
  assert.equal(property.food, false);
  assert.equal(property.image, undefined);
  assert.deepEqual(parseStringArray("invalid"), []);
  assert.deepEqual(parseStringArray('["WiFi",1,null]'), ["WiFi"]);
});
test("browse matches sharing and budget against the same available room", () => {
  const property = publicListing(listingProperty, [
    availableRoom,
    { ...availableRoom, id: "single", sharingType: "single", rentPerBed: 5000, occupiedBeds: 2 },
  ]);
  const filters = { q: " hSr ", gender: "co-ed", food: false, ac: true, budget: 10000, sharing: 2 };
  assert.deepEqual(
    filterPublicListings([property], filters).map((row) => row.id),
    ["live"],
  );
  assert.equal(filterPublicListings([property], { ...filters, sharing: 1 }).length, 0);
  assert.equal(filterPublicListings([property], { ...filters, budget: 8000 }).length, 0);
  assert.equal(filterPublicListings([property], { ...filters, food: true }).length, 0);
});
import { buildOwnerNotifications } from "../src/lib/owner-notifications.ts";
import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
  rentDueDate,
  organizationSchema,
  rentRulesSchema,
} from "../src/lib/owner-settings.ts";

const journal = JSON.parse(
  fs.readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
);
const snapshot = JSON.parse(
  fs.readFileSync(new URL("../drizzle/meta/0000_snapshot.json", import.meta.url), "utf8"),
);
const migrations = journal.entries.map((entry) => ({
  sql: fs.readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8"),
  when: entry.when,
  snapshot: JSON.parse(
    fs.readFileSync(
      new URL(
        `../drizzle/meta/${String(entry.idx).padStart(4, "0")}_snapshot.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ),
}));
// libSQL's native Windows transaction handles close at process exit. Run the tests
// in a child process, then remove their temporary databases after all handles close.
let fixtureRoot = process.argv[process.argv.indexOf("--fixture-root") + 1];
if (!process.argv.includes("--fixture-root")) {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pg-next-fixes-"));
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", fileURLToPath(import.meta.url), "--fixture-root", fixtureRoot],
    { stdio: "inherit" },
  );
  for (const name of fs.readdirSync(fixtureRoot)) {
    const directory = path.resolve(fixtureRoot, name);
    assert.equal(path.dirname(directory), fixtureRoot);
    for (const file of fs.readdirSync(directory)) {
      const target = path.resolve(directory, file);
      assert.equal(path.dirname(target), directory);
      fs.unlinkSync(target);
    }
    fs.rmdirSync(directory);
  }
  fs.rmdirSync(fixtureRoot);
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
function temporaryClient(t) {
  const directory = fs.mkdtempSync(path.join(fixtureRoot, "migration-"));
  const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  t.after(() => client.close());
  return client;
}

test("fresh database applies every bundled migration once", async (t) => {
  const client = temporaryClient(t);
  try {
    await migrateEmbedded(client, migrations, snapshot);
    await migrateEmbedded(client, migrations, snapshot);
    assert.equal(
      (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
      migrations.length,
    );
    assert.ok(
      (await client.execute("PRAGMA table_info(owner_settings)")).rows.some(
        (row) => row.name === "notification_preferences",
      ),
    );
  } finally {
    client.close();
  }
});

test("startup adopts an unmanaged database without losing its existing owner", async (t) => {
  const client = temporaryClient(t);
  try {
    for (const sql of migrations[0].sql
      .split("--> statement-breakpoint")
      .filter((sql) => sql.trim()))
      await client.execute(sql);
    await client.execute(
      "INSERT INTO owners (id, name, email, password_hash) VALUES ('existing', 'Existing owner', 'existing@example.com', 'hash')",
    );
    await migrateEmbedded(client, migrations, snapshot);
    assert.equal(
      (await client.execute("SELECT name FROM owners WHERE id = 'existing'")).rows[0].name,
      "Existing owner",
    );
    assert.equal(
      (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
      migrations.length,
    );
  } finally {
    client.close();
  }
});

test("startup recovers an existing settings table whose migration was not recorded", async (t) => {
  const client = temporaryClient(t);
  await migrateEmbedded(client, migrations.slice(0, 1), snapshot);
  await client.execute(migrations[1].sql);
  await client.execute(
    "INSERT INTO owners (id,name,email,password_hash) VALUES ('saved-owner','Owner','owner@example.com','hash')",
  );
  await client.execute(
    "INSERT INTO owner_settings (owner_id,organization_name,contact_email,due_day) VALUES ('saved-owner','Keep this organization','contact@example.com',12)",
  );
  await migrateEmbedded(client, migrations, snapshot);
  await migrateEmbedded(client, migrations, snapshot);
  assert.equal(
    (await client.execute("SELECT organization_name FROM owner_settings")).rows[0]
      .organization_name,
    "Keep this organization",
  );
  assert.equal((await client.execute("SELECT due_day FROM owner_settings")).rows[0].due_day, 12);
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    migrations.length,
  );
  assert.equal(
    (await client.execute("SELECT name FROM sqlite_master WHERE name = 'staff_attendance'")).rows
      .length,
    1,
  );
});

test("startup adopts all existing tables without a migration journal", async (t) => {
  const client = temporaryClient(t);
  for (const migration of migrations)
    for (const statement of migration.sql
      .split("--> statement-breakpoint")
      .filter((statement) => statement.trim()))
      await client.execute(statement);
  await migrateEmbedded(client, migrations, snapshot);
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    migrations.length,
  );
});

test("an incompatible existing settings table is preserved and not marked migrated", async (t) => {
  const client = temporaryClient(t);
  await migrateEmbedded(client, migrations.slice(0, 1), snapshot);
  await client.execute(
    "CREATE TABLE owner_settings (owner_id text PRIMARY KEY, organization_name text)",
  );
  await client.execute("INSERT INTO owner_settings VALUES ('owner','Keep me')");
  await assert.rejects(
    migrateEmbedded(client, migrations, snapshot),
    /schema differs at owner_settings/,
  );
  assert.equal(
    (await client.execute("SELECT organization_name FROM owner_settings")).rows[0]
      .organization_name,
    "Keep me",
  );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    1,
  );
});

test("existing attendance requires its compound primary key before adoption", async (t) => {
  const client = temporaryClient(t);
  await migrateEmbedded(client, migrations.slice(0, 2), snapshot);
  await client.execute(
    "CREATE TABLE staff_attendance (staff_id text NOT NULL, date text NOT NULL, status text NOT NULL)",
  );
  await assert.rejects(
    migrateEmbedded(client, migrations, snapshot),
    /staff_attendance primary key/,
  );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    2,
  );
});

test("startup refuses incompatible old tables and leaves them untouched", async (t) => {
  const client = temporaryClient(t);
  try {
    await client.execute("CREATE TABLE owners (id text PRIMARY KEY, name text)");
    await client.execute("INSERT INTO owners VALUES ('saved', 'Keep me')");
    await assert.rejects(
      migrateEmbedded(client, migrations, snapshot),
      /Existing database schema differs/,
    );
    assert.equal((await client.execute("SELECT name FROM owners")).rows[0].name, "Keep me");
  } finally {
    client.close();
  }
});

test("failed migration rolls back and can be retried", async (t) => {
  const client = temporaryClient(t);
  try {
    await assert.rejects(
      migrateEmbedded(
        client,
        [...migrations, { sql: "INVALID SQL", when: migrations.at(-1).when + 1 }],
        snapshot,
      ),
    );
    assert.equal(
      (await client.execute("SELECT name FROM sqlite_master WHERE name = 'owner_settings'")).rows
        .length,
      0,
    );
    await migrateEmbedded(client, migrations, snapshot);
    assert.equal(
      (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
      migrations.length,
    );
  } finally {
    client.close();
  }
});

const bookings = [
  {
    id: "a",
    tenantId: "t",
    propertyId: "mine",
    status: "active",
    monthlyRent: 10000,
    checkInDate: "2026-09-01",
    checkOutDate: null,
    createdAt: "2026-09-01",
  },
  {
    id: "b",
    tenantId: "u",
    propertyId: "mine",
    status: "active",
    monthlyRent: 10000,
    checkInDate: "2026-09-01",
    checkOutDate: null,
    createdAt: "2026-09-01",
  },
];
const paid = {
  id: "p",
  bookingId: "a",
  type: "rent",
  month: "2026-10",
  status: "paid",
  amount: 10000,
  paidAt: "2026-10-03",
  createdAt: "2026-10-03",
};
test("rent collection includes unpaid tenants without counting failed attempts or deposits", () => {
  assert.deepEqual(
    currentRentCollection(
      bookings,
      [
        paid,
        { ...paid, id: "failed", status: "failed" },
        { ...paid, id: "deposit", type: "deposit" },
      ],
      "2026-10",
    ),
    { invoiced: 20000, collected: 10000, rate: 50 },
  );
  assert.equal(
    currentRentCollection(bookings, [paid, { ...paid, id: "duplicate" }], "2026-10").rate,
    50,
  );
});
test("rent collection excludes cancelled, future and finished stays", () => {
  const excluded = [
    { ...bookings[0], status: "cancelled" },
    { ...bookings[0], status: "pending" },
    { ...bookings[0], checkInDate: "2026-11-01" },
    { ...bookings[0], status: "checked_out", checkOutDate: "2026-09-30" },
  ];
  assert.deepEqual(currentRentCollection(excluded, [paid], "2026-10"), {
    invoiced: 0,
    collected: 0,
    rate: 0,
  });
});
const activity = {
  propertyNames: { mine: "My PG" },
  bookings,
  payments: [paid],
  complaints: [],
  visitors: [],
};
test("owner notifications respect preferences and suppress paid rent reminders", () => {
  const items = buildOwnerNotifications(
    activity,
    defaultNotificationPreferences,
    5,
    new Date("2026-10-10"),
  );
  assert.ok(items.some((item) => item.id === "rent:b:2026-10"));
  assert.ok(!items.some((item) => item.id === "rent:a:2026-10"));
  assert.equal(
    buildOwnerNotifications(
      activity,
      { rent: false, payments: false, bookings: false, complaints: false, visitors: false },
      5,
      new Date("2026-10-10"),
    ).length,
    0,
  );
  assert.ok(
    !buildOwnerNotifications(
      activity,
      defaultNotificationPreferences,
      15,
      new Date("2026-10-10"),
    ).some((item) => item.category === "rent"),
  );
});
test("owner feed excludes foreign property activities and keeps read identifiers stable", () => {
  const foreign = { ...bookings[0], id: "foreign", propertyId: "other" };
  const mixed = {
    ...activity,
    bookings: [...bookings, foreign],
    payments: [...activity.payments, { ...paid, id: "secret", bookingId: foreign.id }],
    complaints: [
      {
        id: "secret-ticket",
        propertyId: "other",
        title: "Private",
        status: "open",
        createdAt: "2026-10-10",
      },
    ],
    visitors: [
      { id: "secret-visitor", propertyId: "other", name: "Private", checkIn: "2026-10-10" },
    ],
  };
  const result = buildOwnerNotifications(
    mixed,
    defaultNotificationPreferences,
    5,
    new Date("2026-10-10"),
  );
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!result.some((item) => item.id.includes("foreign")));
  assert.deepEqual(
    result.map((item) => item.id),
    buildOwnerNotifications(mixed, defaultNotificationPreferences, 5, new Date("2026-10-11")).map(
      (item) => item.id,
    ),
  );
});
test("settings reject invalid rent policies and recover malformed preferences", () => {
  assert.equal(
    rentRulesSchema.safeParse({ dueDay: 32, lateFeePerDay: 0, noticePeriodDays: 30 }).success,
    false,
  );
  assert.equal(
    rentRulesSchema.safeParse({ dueDay: 5, lateFeePerDay: -1, noticePeriodDays: 30 }).success,
    false,
  );
  assert.equal(
    organizationSchema.safeParse({
      organizationName: "My PG",
      contactEmail: "invalid",
      gstNumber: "",
    }).success,
    false,
  );
  assert.deepEqual(parseNotificationPreferences("not-json"), defaultNotificationPreferences);
  assert.equal(parseNotificationPreferences('{"payments":false}').payments, false);
  assert.equal(rentDueDate("2026-02", 31), "2026-02-28");
  assert.equal(rentDueDate("2028-02", 31), "2028-02-29");
});
