import test from "node:test";
import assert from "node:assert/strict";
import { selectCurrentBooking, newestFirst, distinctTenantBookings } from "../src/lib/booking-selection.ts";
import { parseBrowseSearch, includesSearch } from "../src/lib/search-filters.ts";
import { noticeVisibleToRoom } from "../src/lib/notice-audience.ts";
import { parseNotificationReads, notificationStorageKey } from "../src/lib/notification-state.ts";
import { toCsv } from "../src/lib/csv.ts";
import { hasVacantBed, occupancyAfterStatusChange } from "../src/lib/room-availability.ts";
import { QueryClient } from "@tanstack/react-query";

test("resident booking excludes cancelled and checked-out stays", () => {
  assert.equal(selectCurrentBooking([
    { id: "old", status: "checked_out", createdAt: "2026-01-01" },
    { id: "cancelled", status: "cancelled", createdAt: "2026-10-01" },
  ]), null);
});

test("active stay takes priority over a newer pending booking", () => {
  const active = { id: "active", status: "active", createdAt: "2026-01-01" };
  assert.equal(selectCurrentBooking([
    { id: "pending", status: "pending", createdAt: "2026-10-01" }, active,
  ]), active);
});

test("latest booking wins within a status without mutating the input", () => {
  const rows = [
    { id: "older", status: "confirmed", createdAt: "2026-01-01" },
    { id: "newer", status: "confirmed", createdAt: "2026-10-01" },
  ];
  assert.equal(selectCurrentBooking(rows), rows[1]);
  assert.equal(rows[0].id, "older");
});

test("CSV preserves commas, quotes, line breaks and empty values", () => {
  assert.equal(toCsv([['Alice, "A"', "one\ntwo", null, 1250]]),
    '"Alice, ""A""","one\ntwo","","1250"');
});

test("CSV neutralizes spreadsheet formula injection", () => {
  assert.equal(toCsv([["=1+1", " +cmd", "@SUM(A1)", "-cmd"]]),
    '"\'=1+1","\' +cmd","\'@SUM(A1)","\'-cmd"');
});

test("all booking status transitions preserve the correct occupancy", () => {
  const statuses = ["pending", "confirmed", "active", "checked_out", "cancelled"];
  const occupiedStatuses = new Set(["confirmed", "active"]);
  for (const previous of statuses) {
    for (const next of statuses) {
      const occupiedBeds = occupiedStatuses.has(previous) ? 1 : 0;
      const result = occupancyAfterStatusChange({ totalBeds: 2, occupiedBeds, status: "available" }, previous, next);
      assert.equal(result.occupiedBeds, occupiedStatuses.has(next) ? 1 : 0, `${previous} -> ${next}`);
    }
  }
});

test("booking reactivation rejects a full room and leaves its input unchanged", () => {
  const room = { totalBeds: 1, occupiedBeds: 1, status: "full" };
  assert.throws(() => occupancyAfterStatusChange(room, "cancelled", "active"), /no available beds/);
  assert.deepEqual(room, { totalBeds: 1, occupiedBeds: 1, status: "full" });
});

test("maintenance rooms cannot receive a booking and retain maintenance on checkout", () => {
  const room = { totalBeds: 2, occupiedBeds: 1, status: "maintenance" };
  assert.equal(hasVacantBed(room), false);
  assert.throws(() => occupancyAfterStatusChange(room, "pending", "confirmed"), /no available beds/);
  assert.deepEqual(occupancyAfterStatusChange(room, "active", "checked_out"), { occupiedBeds: 0, status: "maintenance" });
});

test("active to confirmed does not double-count a full bed", () => {
  assert.deepEqual(occupancyAfterStatusChange({ totalBeds: 1, occupiedBeds: 1, status: "full" }, "active", "confirmed"),
    { occupiedBeds: 1, status: "full" });
});

test("account cache cleanup cancels pending work and removes previous account data", async () => {
  const client = new QueryClient();
  client.setQueryData(["properties", "mine"], [{ name: "Previous owner" }]);
  let aborted = false;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const pending = client.fetchQuery({ queryKey: ["my-booking"], queryFn: ({ signal }) => new Promise((resolve) => {
    signal.addEventListener("abort", () => { aborted = true; resolve({ room: "Previous tenant" }); });
    started();
  }) }).catch(() => undefined);
  await ready;
  client.clear();
  await pending;
  assert.equal(aborted, true);
  assert.equal(client.getQueryData(["properties", "mine"]), undefined);
  assert.equal(client.getQueryData(["my-booking"]), undefined);
});

test("homepage search retains valid filters and rejects invalid URL inputs", () => {
  assert.deepEqual(parseBrowseSearch({ q: "  HSR Layout ", sharing: "2", budget: "12000" }), { q: "HSR Layout", sharing: 2, budget: 12000 });
  assert.deepEqual(parseBrowseSearch({ q: [], sharing: "99", budget: "NaN" }), { q: undefined, sharing: undefined, budget: undefined });
  assert.equal(parseBrowseSearch({ budget: "0" }).budget, 0);
  assert.equal(parseBrowseSearch({ budget: "" }).budget, undefined);
});

test("global search ignores case and surrounding whitespace and tolerates missing data", () => {
  assert.equal(includesSearch("  ALICE ", undefined, "Alice Smith", "Room 101"), true);
  assert.equal(includesSearch("101", undefined, "Alice Smith", "Room 101"), true);
  assert.equal(includesSearch("other", null, undefined, "Alice Smith"), false);
});

test("room-specific notices stay private to the addressed room", () => {
  assert.equal(noticeVisibleToRoom("All tenants", undefined), true);
  assert.equal(noticeVisibleToRoom("Room 101", "101"), true);
  assert.equal(noticeVisibleToRoom("Room 101", "10"), false);
  assert.equal(noticeVisibleToRoom("Room 101", undefined), false);
  assert.equal(noticeVisibleToRoom("Staff only", "101"), false);
});

test("tenant list shows one relevant stay per tenant, including former residents", () => {
  const active = { id: "active", tenantId: "alice", status: "active", createdAt: "2026-01-01" };
  const former = { id: "former", tenantId: "bob", status: "checked_out", createdAt: "2026-01-01" };
  assert.deepEqual(distinctTenantBookings([
    active, { id: "new-pending", tenantId: "alice", status: "pending", createdAt: "2026-10-01" }, former,
  ]), [active, former]);
});

test("recent bookings sort by creation time without mutating cached rows", () => {
  const rows = [{ id: "older", createdAt: "2026-01-01" }, { id: "newer", createdAt: "2026-10-01" }];
  assert.equal(newestFirst(rows)[0].id, "newer");
  assert.equal(rows[0].id, "older");
});

test("notification read state rejects malformed storage and is isolated per account", () => {
  assert.deepEqual(parseNotificationReads('{"n1":true,"n2":false,"bad":"true"}'), { n1: true, n2: false });
  for (const raw of ["broken", "null", "[]", "42"]) assert.deepEqual(parseNotificationReads(raw), {});
  assert.notEqual(notificationStorageKey("owner-a"), notificationStorageKey("owner-b"));
});
