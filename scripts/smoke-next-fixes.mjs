import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import { createClient } from "@libsql/client";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";

let directory = process.argv[process.argv.indexOf("--fixture-root") + 1];
if (!process.argv.includes("--fixture-root")) {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "pg-production-smoke-"));
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      "--fixture-root",
      directory,
      ...(process.argv.includes("--preexisting-settings") ? ["--preexisting-settings"] : []),
    ],
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
const databaseFile = path.join(directory, "test.db");
if (process.argv.includes("--preexisting-settings")) {
  const seedClient = createClient({ url: `file:${databaseFile}` });
  const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries.slice(0, 2)) {
    for (const sql of fs
      .readFileSync(`drizzle/${entry.tag}.sql`, "utf8")
      .split("--> statement-breakpoint")
      .filter((sql) => sql.trim()))
      await seedClient.execute(sql);
  }
  await seedClient.execute(
    "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
  );
  await seedClient.execute({
    sql: "INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)",
    args: ["baseline-test", journal.entries[0].when],
  });
  await seedClient.execute(
    "INSERT INTO owners (id,name,email,password_hash) VALUES ('upgrade-owner','Upgrade owner','upgrade@example.com','unused')",
  );
  await seedClient.execute(
    "INSERT INTO owner_settings (owner_id,organization_name,contact_email) VALUES ('upgrade-owner','Preserve these settings','upgrade@example.com')",
  );
  seedClient.close();
}
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const secret = "isolated-smoke-test-secret";
const captureFile = path.join(directory, "whatsapp-requests.jsonl");
const child = spawn(
  process.execPath,
  ["--import", "./scripts/fixtures/mock-whatsapp.mjs", ".output/server/index.mjs"],
  {
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      TURSO_DATABASE_URL: `file:${databaseFile}`,
      TURSO_AUTH_TOKEN: "",
      JWT_SECRET: secret,
      WHATSAPP_DEMO_ENABLED: "true",
      WHATSAPP_PHONE_NUMBER_ID: "123456",
      WHATSAPP_ACCESS_TOKEN: "isolated-fake-token",
      WHATSAPP_TEST_RECIPIENT: "919876543210",
      WHATSAPP_DEMO_PASSCODE: "isolated-private-passcode",
      WHATSAPP_CAPTURE_FILE: captureFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverLog = "";
child.stdout.on("data", (data) => {
  serverLog += data;
});
child.stderr.on("data", (data) => {
  serverLog += data;
});
const outputFiles = fs.readdirSync(".output/server/_ssr").filter((file) => file.endsWith(".mjs"));
const sources = outputFiles
  .map((file) => fs.readFileSync(path.join(".output/server/_ssr", file), "utf8"))
  .join("\n");
function ownerCookie(id) {
  return `pg_session=${jwt.sign({ ownerId: id, name: id, email: `${id}@example.com` }, secret)}`;
}
const residentCookie = `pg_tenant_session=${jwt.sign({ tenantId: "resident", name: "Resident", email: "resident@example.com" }, secret)}`;
async function rpc(name, method, data, cookie = ownerCookie("owner-a")) {
  const match = sources.match(new RegExp(`id: "([a-f0-9]+)",\\s*name: "${name}"`));
  assert.ok(match, `Compiled server function ${name} exists`);
  const body =
    data === undefined
      ? undefined
      : JSON.stringify(await toJSONAsync({ data }, { plugins: defaultSerovalPlugins }));
  const endpoint = new URL(`${base}/_serverFn/${match[1]}`);
  if (method === "GET" && body) endpoint.searchParams.set("payload", body);
  const response = await fetch(endpoint, {
    method,
    body: method === "POST" ? body : undefined,
    headers: {
      cookie,
      origin: base,
      "sec-fetch-site": "same-origin",
      "x-tsr-serverFn": "true",
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(`${name}: HTTP ${response.status} ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  const result = response.headers.get("x-tss-serialized")
    ? fromCrossJSON(payload, { plugins: defaultSerovalPlugins })
    : payload;
  if (result instanceof Error) throw result;
  if (result.error) throw result.error;
  return result.result;
}
let client;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(serverLog);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(15000) });
      if (response.status === 200) {
        assert.ok((await response.text()).includes("</html>"));
        ready = true;
        break;
      }
      throw new Error(`Startup returned ${response.status}: ${serverLog}`);
    } catch (error) {
      if (!String(error).includes("fetch failed")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, `Production server starts: ${serverLog}`);
  assert.deepEqual(await rpc("getWhatsappTestStatus", "GET", undefined, ""), { configured: true });
  await assert.rejects(
    rpc("sendWhatsappTestMessage", "POST", { passcode: "wrong-passcode" }, ""),
    /Incorrect WhatsApp demo passcode/,
  );
  await assert.rejects(
    rpc(
      "sendWhatsappTestMessage",
      "POST",
      { passcode: "wrong-passcode", recipient: "919999999999" },
      "",
    ),
  );
  for (const pathname of ["/", "/browse", "/auth", "/dashboard", "/settings"]) {
    const response = await fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, pathname);
    assert.ok((await response.text()).includes("</html>"), `${pathname} response completes`);
    const head = await fetch(`${base}${pathname}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(head.status, 200, `${pathname} HEAD`);
    assert.equal(await head.text(), "");
  }
  client = createClient({ url: `file:${databaseFile}` });
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM whatsapp_test_attempts")).rows[0].count,
    0,
    "Invalid passcodes do not reserve attempts",
  );
  await client.execute({
    sql: "INSERT INTO whatsapp_test_attempts (sent_at) VALUES (?)",
    args: [Date.now()],
  });
  await assert.rejects(
    rpc("sendWhatsappTestMessage", "POST", { passcode: "isolated-private-passcode" }, ""),
    /60 seconds/,
  );
  await client.execute("DELETE FROM whatsapp_test_attempts");
  for (let i = 0; i < 10; i++)
    await client.execute({
      sql: "INSERT INTO whatsapp_test_attempts (sent_at) VALUES (?)",
      args: [Date.now() - 120_000],
    });
  await assert.rejects(
    rpc("sendWhatsappTestMessage", "POST", { passcode: "isolated-private-passcode" }, ""),
    /10 WhatsApp test/,
  );
  await client.execute("DELETE FROM whatsapp_test_attempts");
  if (process.argv.includes("--preexisting-settings"))
    assert.equal(
      (
        await client.execute(
          "SELECT organization_name FROM owner_settings WHERE owner_id = 'upgrade-owner'",
        )
      ).rows[0].organization_name,
      "Preserve these settings",
    );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8")).entries.length,
  );
  await client.execute(
    "INSERT INTO owners (id,name,email,password_hash) VALUES ('sample-owner','Sample Owner','sample@example.invalid','unused')",
  );
  await assert.rejects(rpc("loadSampleData", "POST", undefined, ""), /sign in/i);
  assert.deepEqual(await rpc("loadSampleData", "POST", undefined, ownerCookie("sample-owner")), {
    properties: 3,
    rooms: 18,
    tenants: 18,
    staff: 12,
  });
  await assert.rejects(
    rpc("loadSampleData", "POST", undefined, ownerCookie("sample-owner")),
    /empty accounts only/,
  );
  assert.equal(
    (await rpc("listOwnerProperties", "GET", undefined, ownerCookie("sample-owner"))).length,
    3,
  );
  const sampleReports = await rpc("getOwnerReports", "GET", undefined, ownerCookie("sample-owner"));
  assert.equal(sampleReports.revenueTrend.length, 6);
  assert.ok(sampleReports.totalRevenue > 0);
  assert.equal((await rpc("listOwnerProperties", "GET")).length, 0);
  // Remove this fixture before the original listing-count assertions below.
  for (const table of [
    "staff_attendance",
    "tenant_preferences",
    "payments",
    "complaints",
    "visitors",
    "notices",
    "expenses",
    "food_menu",
    "services",
    "bookings",
    "staff",
    "rooms",
    "properties",
    "tenants",
  ])
    await client.execute(`DELETE FROM ${table}`);
  for (const id of ["owner-a", "owner-b"])
    await client.execute({
      sql: "INSERT INTO owners (id,name,email,password_hash) VALUES (?,?,?,?)",
      args: [id, id, `${id}@example.com`, "unused"],
    });
  for (const suffix of ["a", "b"]) {
    await client.execute({
      sql: "INSERT INTO properties (id,owner_id,name,city,locality,address,gender_type) VALUES (?,?,?,?,?,?,?)",
      args: [
        `property-${suffix}`,
        `owner-${suffix}`,
        `PG ${suffix}`,
        "City",
        "Locality",
        "Address",
        "co-ed",
      ],
    });
    await client.execute({
      sql: "INSERT INTO rooms (id,property_id,room_number,sharing_type,total_beds,occupied_beds,rent_per_bed) VALUES (?,?,?,?,?,?,?)",
      args: [`room-${suffix}`, `property-${suffix}`, "101", "double", 2, 1, 10000],
    });
    await client.execute({
      sql: "INSERT INTO staff (id,property_id,name,role,phone) VALUES (?,?,?,?,?)",
      args: [`staff-${suffix}`, `property-${suffix}`, `Staff ${suffix}`, "manager", "9999999999"],
    });
  }
  await client.execute(
    "INSERT INTO tenants (id,name,email,phone,kyc_status,id_proof_type,id_proof_number) VALUES ('resident','Resident','resident@example.com','9999999999','pending','aadhaar','private-proof-number')",
  );
  const today = new Date().toISOString().slice(0, 10);
  await client.execute({
    sql: "INSERT INTO bookings (id,room_id,property_id,tenant_id,check_in_date,monthly_rent,status) VALUES (?,?,?,?,?,?,?)",
    args: ["booking-a", "room-a", "property-a", "resident", today, 10000, "active"],
  });
  const settings = await rpc("getOwnerSettings", "GET");
  const lifestyle = {
    sleepSchedule: "early_bird",
    cleanliness: 4,
    noiseTolerance: 3,
    socialLevel: 3,
    foodHabit: "veg",
    smoking: false,
    guestsFrequency: "rare",
    workSchedule: "office",
  };
  await rpc("saveMyPreferences", "POST", lifestyle, residentCookie);
  assert.equal(
    (await rpc("getMyPreferences", "GET", undefined, residentCookie)).sleepSchedule,
    "early_bird",
  );
  assert.equal(
    (await rpc("getMyRoommateMatches", "GET", undefined, residentCookie)).matches.length,
    0,
  );
  assert.ok((await rpc("getOwnerRoomMatches", "GET")).some((item) => item.room.id === "room-a"));
  assert.equal(settings.organizationName, "owner-a");
  await rpc("updateOwnerSettings", "POST", {
    section: "organization",
    values: { organizationName: "Updated PG", contactEmail: "contact@example.com", gstNumber: "" },
  });
  await rpc("updateOwnerSettings", "POST", {
    section: "rent",
    values: { dueDay: 1, lateFeePerDay: 25, noticePeriodDays: 45 },
  });
  assert.equal((await rpc("getOwnerSettings", "GET")).organizationName, "Updated PG");
  assert.equal(
    (await rpc("getOwnerSettings", "GET", undefined, ownerCookie("owner-b"))).organizationName,
    "owner-b",
  );
  await assert.rejects(
    rpc("updateOwnerSettings", "POST", {
      section: "rent",
      values: { dueDay: 40, lateFeePerDay: -1, noticePeriodDays: 45 },
    }),
  );
  await rpc("updateProperty", "POST", {
    id: "property-a",
    name: "Edited property",
    description: "",
  });
  assert.equal(
    (await client.execute("SELECT name FROM properties WHERE id = 'property-a'")).rows[0].name,
    "Edited property",
  );
  await assert.rejects(rpc("updateProperty", "POST", { id: "property-b", name: "Forbidden" }));
  await rpc("updateRoom", "POST", { id: "room-a", totalBeds: 1, rentPerBed: 12000 });
  assert.equal(
    (await client.execute("SELECT status FROM rooms WHERE id = 'room-a'")).rows[0].status,
    "full",
  );
  await assert.rejects(rpc("updateRoom", "POST", { id: "room-b", rentPerBed: 12000 }));
  await rpc("updateStaff", "POST", {
    id: "staff-a",
    name: "Edited staff",
    role: "cook",
    phone: "8888888888",
    shift: "evening",
    salary: 18000,
  });
  assert.equal(
    (await client.execute("SELECT salary FROM staff WHERE id = 'staff-a'")).rows[0].salary,
    18000,
  );
  await assert.rejects(
    rpc("updateStaff", "POST", {
      id: "staff-b",
      name: "Forbidden",
      role: "cook",
      phone: "8888888888",
      shift: "evening",
      salary: 18000,
    }),
  );
  const kyc = await rpc("getMyKyc", "GET", undefined, residentCookie);
  assert.equal(kyc.status, "pending");
  assert.equal(kyc.proofType, "aadhaar");
  assert.ok(!JSON.stringify(kyc).includes("private-proof-number"));
  const identityDocument = {
    proofType: "passport",
    name: "identity.pdf",
    mime: "application/pdf",
    base64: Buffer.from("%PDF-1.4\nTest identity\n%%EOF").toString("base64"),
  };
  await rpc("uploadMyKycDocument", "POST", identityDocument, residentCookie);
  assert.equal(
    (await rpc("getKycDocument", "GET", { tenantId: "resident" }, residentCookie)).name,
    "identity.pdf",
  );
  assert.equal(
    (await rpc("getKycDocument", "GET", { tenantId: "resident" })).base64,
    identityDocument.base64,
  );
  await assert.rejects(
    rpc("getKycDocument", "GET", { tenantId: "resident" }, ownerCookie("owner-b")),
  );
  await assert.rejects(rpc("getKycDocument", "GET", { tenantId: "resident" }, ""));
  await assert.rejects(
    rpc(
      "uploadMyKycDocument",
      "POST",
      { ...identityDocument, base64: Buffer.from("not a PDF").toString("base64") },
      residentCookie,
    ),
  );
  const myBooking = await rpc("getMyBooking", "GET", undefined, residentCookie);
  assert.equal(myBooking.policy.noticePeriodDays, 45);
  assert.equal(myBooking.policy.lateFeePerDay, 25);
  assert.equal(myBooking.policy.organizationName, "Updated PG");
  const notices = await rpc("getOwnerNotifications", "GET");
  assert.ok(notices.some((notice) => notice.id === "booking:booking-a"));
  assert.equal(
    (await rpc("getOwnerNotifications", "GET", undefined, ownerCookie("owner-b"))).length,
    0,
  );
  await rpc("updateOwnerSettings", "POST", {
    section: "notifications",
    values: { rent: false, payments: false, bookings: false, complaints: false, visitors: false },
  });
  assert.equal((await rpc("getOwnerNotifications", "GET")).length, 0);
  await assert.rejects(rpc("getOwnerSettings", "GET", undefined, ""));
  await rpc("recordStaffAttendance", "POST", {
    staffId: "staff-a",
    date: today,
    status: "present",
  });
  await rpc("recordStaffAttendance", "POST", { staffId: "staff-a", date: today, status: "absent" });
  const attendance = await rpc("listStaffAttendance", "GET", { staffId: "staff-a" });
  assert.equal(attendance.length, 1);
  assert.equal(attendance[0].status, "absent");
  const staffList = await rpc("listOwnerStaff", "GET");
  assert.equal(staffList.find((member) => member.id === "staff-a").attendance, 0);
  await assert.rejects(
    rpc("recordStaffAttendance", "POST", { staffId: "staff-b", date: today, status: "present" }),
  );
  await assert.rejects(
    rpc("listStaffAttendance", "GET", { staffId: "staff-a" }, ownerCookie("owner-b")),
  );
  await assert.rejects(
    rpc("recordStaffAttendance", "POST", {
      staffId: "staff-a",
      date: "2999-01-01",
      status: "present",
    }),
  );
  await assert.rejects(
    rpc("recordStaffAttendance", "POST", {
      staffId: "staff-a",
      date: "2026-02-30",
      status: "present",
    }),
  );
  await client.execute(
    "INSERT INTO rooms (id,property_id,room_number,sharing_type,total_beds,occupied_beds,rent_per_bed) VALUES ('onboard-room','property-a','102','single',1,0,8000)",
  );
  const before = (await client.execute("SELECT count(*) AS count FROM tenants")).rows[0].count;
  await client.execute(
    "CREATE TRIGGER reject_onboarding BEFORE UPDATE ON rooms WHEN NEW.id = 'onboard-room' BEGIN SELECT RAISE(ABORT, 'Simulated room update failure'); END",
  );
  const onboarding = {
    roomId: "onboard-room",
    name: "New tenant",
    email: "new@example.com",
    phone: "7777777777",
    moveIn: today,
    kycStatus: "pending",
  };
  await assert.rejects(rpc("onboardTenant", "POST", onboarding));
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM tenants")).rows[0].count,
    before,
  );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM bookings WHERE room_id = 'onboard-room'"))
      .rows[0].count,
    0,
  );
  await client.execute("DROP TRIGGER reject_onboarding");
  const outcomes = await Promise.allSettled([
    rpc("onboardTenant", "POST", onboarding),
    rpc("onboardTenant", "POST", { ...onboarding, email: "second@example.com" }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM tenants")).rows[0].count,
    Number(before) + 1,
  );
  assert.equal(
    (await client.execute("SELECT occupied_beds FROM rooms WHERE id = 'onboard-room'")).rows[0]
      .occupied_beds,
    1,
  );
  await client.execute(
    "CREATE TRIGGER reject_booking BEFORE INSERT ON bookings WHEN NEW.room_id = 'room-b' BEGIN SELECT RAISE(ABORT, 'Simulated booking failure'); END",
  );
  const beforePublic = (await client.execute("SELECT count(*) AS count FROM tenants")).rows[0]
    .count;
  await assert.rejects(
    rpc(
      "createBooking",
      "POST",
      {
        roomId: "room-b",
        checkInDate: today,
        tenant: { name: "Public tenant", email: "public@example.com", phone: "6666666666" },
      },
      "",
    ),
  );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM tenants")).rows[0].count,
    beforePublic,
  );
  await client.execute("DROP TRIGGER reject_booking");
  await client.execute(
    "INSERT INTO food_menu (id,property_id,day,breakfast,lunch,dinner) VALUES ('menu-live','property-a','Monday','Idli','Rice','Dosa')",
  );
  const publicProperties = await rpc("listPublicProperties", "GET", undefined, "");
  assert.equal(publicProperties.length, 2);
  assert.ok(publicProperties.some((property) => property.name === "Edited property"));
  assert.ok(!JSON.stringify(publicProperties).includes("password_hash"));
  const publicDetail = await rpc("getPublicProperty", "GET", { id: "property-a" }, "");
  assert.equal(publicDetail.menu[0].breakfast, "Idli");
  assert.equal(publicDetail.contactEmail, "contact@example.com");
  assert.equal(publicDetail.property.availableBeds, 0);
  assert.equal(await rpc("getPublicProperty", "GET", { id: "missing" }, ""), null);
  const page = await fetch(`${base}/pg/property-a`, { signal: AbortSignal.timeout(15000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Edited property"));
  assert.ok(html.includes("Contact owner"));
  assert.ok(!html.includes("/book/property-a"));
  assert.ok(!html.includes("private-proof-number"));
  const missingPage = await fetch(`${base}/pg/missing`, { signal: AbortSignal.timeout(15000) });
  assert.equal(missingPage.status, 404);
  assert.ok((await missingPage.text()).includes("</html>"));
  assert.ok(!serverLog.includes("SSR stream transform exceeded"));
  const workspace = await rpc("createDemoWorkspace", "POST", { entries: {} }, "");
  const shared = (role, name, input) =>
    rpc("sharedDemoAction", "POST", { id: workspace.id, role, name, input }, "");
  await shared("admin", "listOwnerProperties");
  await Promise.all([
    shared("admin", "createNotice", {
      propertyId: "p1",
      title: "Shared notice one",
      body: "First edit",
      audience: "All tenants",
    }),
    shared("admin", "createNotice", {
      propertyId: "p1",
      title: "Shared notice two",
      body: "Second edit",
      audience: "All tenants",
    }),
  ]);
  const sharedNotices = JSON.parse((await shared("tenant", "getMyNotices")).result);
  assert.ok(sharedNotices.some((notice) => notice.title === "Shared notice one"));
  assert.ok(sharedNotices.some((notice) => notice.title === "Shared notice two"));
  const demoTicket = JSON.parse(
    (
      await shared("tenant", "createMyComplaint", {
        title: "WhatsApp plumbing test",
        category: "plumbing",
        priority: "medium",
      })
    ).result,
  );
  const ownerInbox = JSON.parse((await shared("admin", "getDemoWhatsapp")).result);
  assert.ok(ownerInbox.messages.some((message) => message.body.includes("WhatsApp plumbing test")));
  const staffInbox = JSON.parse((await shared("staff", "getDemoWhatsapp")).result);
  assert.ok(staffInbox.messages.some((message) => message.event === `task:${demoTicket.id}`));
  assert.ok(staffInbox.messages.every((message) => message.recipientRole === "staff"));
  await shared("staff", "updateComplaint", { id: demoTicket.id, status: "resolved" });
  const residentInbox = JSON.parse((await shared("tenant", "getDemoWhatsapp")).result);
  assert.ok(residentInbox.messages.some((message) => message.body.includes("resolved")));
  await shared("staff", "updateComplaint", { id: demoTicket.id, status: "resolved" });
  assert.equal(
    JSON.parse((await shared("tenant", "getDemoWhatsapp")).result).messages.length,
    residentInbox.messages.length,
  );
  await shared("admin", "setDemoWhatsapp", { enabled: false });
  assert.equal(JSON.parse((await shared("admin", "sendDemoRentReminders")).result).count, 0);
  await shared("admin", "setDemoWhatsapp", { enabled: true });
  const currentDemoRent = JSON.parse((await shared("tenant", "getMyPayments")).result).find(
    (payment) => payment.type === "rent" && payment.month === new Date().toISOString().slice(0, 7),
  );
  await shared("tenant", "verifyPayment", { paymentId: currentDemoRent.id });
  assert.ok(
    JSON.parse((await shared("admin", "getDemoWhatsapp")).result).messages.some(
      (message) => message.event === `payment:${currentDemoRent.id}`,
    ),
  );
  await shared("tenant", "undoDemoPayment", { paymentId: currentDemoRent.id });
  assert.equal(
    JSON.parse((await shared("tenant", "getMyPayments")).result).find(
      (payment) => payment.id === currentDemoRent.id,
    ).status,
    "pending",
  );
  assert.ok(
    !JSON.parse((await shared("admin", "getDemoWhatsapp")).result).messages.some(
      (message) => message.event === `payment:${currentDemoRent.id}`,
    ),
  );
  await assert.rejects(
    shared("staff", "undoDemoPayment", { paymentId: currentDemoRent.id }),
    /not available|disabled access/,
  );
  await shared("tenant", "verifyPayment", { paymentId: currentDemoRent.id });
  await assert.rejects(shared("staff", "setDemoWhatsapp", { enabled: true }), /owner/);
  await shared("admin", "setDemoWhatsapp", { enabled: true });
  assert.ok(JSON.parse((await shared("admin", "sendDemoRentReminders")).result).count > 0);
  assert.equal(JSON.parse((await shared("admin", "sendDemoRentReminders")).result).count, 0);
  await shared("admin", "saveDemoConfig", {
    key: "pgone.demo.roles.v1",
    value: { staff: ["/dashboard", "/profile"], tenant: ["/dashboard", "/profile"] },
  });
  await assert.rejects(shared("tenant", "askAssistantFn", { question: "rent" }), /disabled access/);
  await assert.rejects(
    shared("staff", "saveDemoConfig", { key: "pgone.demo.roles.v1", value: {} }),
    /owner/,
  );
  await assert.rejects(shared("tenant", "createProperty", {}), /not available/);
  assert.ok(
    String(
      (
        await client.execute({
          sql: "SELECT payload FROM demo_workspaces WHERE id=?",
          args: [workspace.id],
        })
      ).rows[0].payload,
    ).includes("Shared notice two"),
  );
  // Real event forwarding is exercised against an isolated mock Meta endpoint.
  const autoWorkspace = await rpc("createDemoWorkspace", "POST", { entries: {} }, "");
  const automatic = (role, name, input) =>
    rpc("sharedDemoAction", "POST", { id: autoWorkspace.id, role, name, input }, "");
  const forwarding = (extra = {}) =>
    rpc(
      "setWhatsappForwarding",
      "POST",
      {
        workspaceId: autoWorkspace.id,
        passcode: "isolated-private-passcode",
        enabled: true,
        repliedToSender: true,
        ...extra,
      },
      "",
    );
  const captured = () =>
    fs.existsSync(captureFile)
      ? fs.readFileSync(captureFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [];
  const beforeEnable = JSON.parse(
    (
      await automatic("tenant", "createMyComplaint", {
        title: "Event before opt in",
        category: "plumbing",
        priority: "medium",
      })
    ).result,
  );
  assert.equal(captured().length, 0, "No event sends before explicit opt in");
  await assert.rejects(forwarding({ passcode: "wrong" }), /Incorrect/);
  await assert.rejects(forwarding({ repliedToSender: false }), /Reply/);
  await assert.rejects(
    forwarding({ workspaceId: "00000000-0000-4000-8000-000000000000" }),
    /workspace not found/,
  );
  await forwarding();
  assert.equal(captured().length, 0, "Enabling must not replay old messages");
  await Promise.all([
    automatic("staff", "updateComplaint", { id: beforeEnable.id, status: "resolved" }),
    automatic("staff", "updateComplaint", { id: beforeEnable.id, status: "resolved" }),
  ]);
  assert.equal(captured().length, 1, "Concurrent duplicate updates send one notification");
  assert.ok(captured()[0].text.body.includes("resolved"));
  const payment = JSON.parse((await automatic("tenant", "getMyPayments")).result).find(
    (item) => item.type === "rent" && item.month === new Date().toISOString().slice(0, 7),
  );
  await automatic("tenant", "verifyPayment", { paymentId: payment.id });
  await automatic("tenant", "verifyPayment", { paymentId: payment.id });
  assert.equal(captured().length, 2, "Repeated payment verification sends only one receipt");
  assert.ok(captured()[1].text.body.includes("no money was charged"));
  await automatic("admin", "updateBookingStatus", { id: "B-1042", status: "confirmed" });
  assert.equal(captured().length, 3);
  assert.ok(captured()[2].text.body.includes("confirmed"));
  await automatic("admin", "sendDemoRentReminders");
  await automatic("admin", "sendDemoRentReminders");
  assert.equal(captured().length, 4, "Batch rent reminders send one digest and no duplicate");
  assert.ok(captured()[3].text.body.includes("Rent reminder"));
  const failure = await automatic("tenant", "createMyComplaint", {
    title: "[simulate delivery failure] Leak",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(failure.whatsapp.status, "failed");
  const failedTicketId = JSON.parse(failure.result).id;
  assert.ok(
    JSON.parse((await automatic("admin", "listOwnerComplaints")).result).some(
      (item) => item.id === failedTicketId,
    ),
    "Provider failure never rolls back a complaint",
  );
  const throttled = await automatic("tenant", "createMyComplaint", {
    title: "Rate limited event",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(throttled.whatsapp.status, "skipped");
  assert.equal(captured().length, 5, "Rate limited notifications never call Meta");
  assert.ok(
    captured().every(
      (item) =>
        item.to === "919876543210" && item.type === "text" && item.text.body.includes("DEMO"),
    ),
  );
  const forwardingStatus = await rpc(
    "getWhatsappForwardingStatus",
    "GET",
    { workspaceId: autoWorkspace.id },
    "",
  );
  assert.equal(forwardingStatus.active, true);
  assert.ok(
    forwardingStatus.history.some(
      (item) => item.status === "failed" && item.error.includes("24-hour"),
    ),
  );
  assert.ok(!JSON.stringify(forwardingStatus).includes("isolated-private-passcode"));
  await forwarding({ enabled: false });
  await automatic("tenant", "createMyComplaint", {
    title: "Disabled event",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(captured().length, 5);
  await forwarding();
  await client.execute({
    sql: "UPDATE whatsapp_demo_connections SET expires_at=0 WHERE workspace_id=?",
    args: [autoWorkspace.id],
  });
  await automatic("tenant", "createMyComplaint", {
    title: "Expired event",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(captured().length, 5);
  assert.equal(
    (await rpc("getWhatsappForwardingStatus", "GET", { workspaceId: autoWorkspace.id }, "")).active,
    false,
  );
  await forwarding();
  await client.execute({
    sql: "UPDATE whatsapp_demo_connections SET target_key='different-recipient' WHERE workspace_id=?",
    args: [autoWorkspace.id],
  });
  await automatic("tenant", "createMyComplaint", {
    title: "Changed sender recipient",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(
    captured().length,
    5,
    "A different configured target must be explicitly reauthorized",
  );
  await forwarding();
  await client.execute({
    sql: "UPDATE whatsapp_event_outbox SET created_at=?",
    args: [Date.now() - 120_000],
  });
  for (let i = 0; i < 30; i++)
    await client.execute({
      sql: "INSERT INTO whatsapp_event_outbox(id,workspace_id,action,body,status,created_at) VALUES(?,?,?,?,?,?)",
      args: [
        `daily-limit-${i}`,
        autoWorkspace.id,
        "test",
        "test",
        "accepted",
        Date.now() - 120_000,
      ],
    });
  const dailyLimited = await automatic("tenant", "createMyComplaint", {
    title: "Daily limited event",
    category: "plumbing",
    priority: "medium",
  });
  assert.equal(dailyLimited.whatsapp.status, "skipped");
  assert.equal(captured().length, 5, "Daily limit also prevents provider calls");
  console.log(
    "Automatic WhatsApp events passed: opt in, fixed recipient, complaints, bookings, payments, reminders, concurrency, provider failure, limits, disable and expiry. All provider sends mocked.",
  );
  console.log(
    "Production smoke passed: migrations, owner isolation, saved settings, edits, KYC, notifications, attendance, atomic onboarding and public listing/detail pages.",
  );
} catch (error) {
  console.error(error);
  console.error(serverLog.slice(-6000));
  throw error;
} finally {
  client?.close();
  const exited = once(child, "exit");
  if (child.exitCode === null) {
    child.kill();
    await exited;
  }
}
