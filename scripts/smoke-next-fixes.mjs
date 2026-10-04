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
    [fileURLToPath(import.meta.url), "--fixture-root", directory],
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
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const secret = "isolated-smoke-test-secret";
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: process.cwd(),
  windowsHide: true,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    TURSO_DATABASE_URL: `file:${databaseFile}`,
    TURSO_AUTH_TOKEN: "",
    JWT_SECRET: secret,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
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
  const response = await fetch(`${base}/_serverFn/${match[1]}`, {
    method,
    body,
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
      const response = await fetch(base);
      if (response.status === 200) {
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
  client = createClient({ url: `file:${databaseFile}` });
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations")).rows[0].count,
    2,
  );
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
  console.log(
    "Production smoke passed: startup migrations, settings persistence, owner isolation, property/room/staff edits, resident KYC, rent policies and live notifications.",
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
