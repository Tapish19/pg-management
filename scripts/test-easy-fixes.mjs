import test from "node:test";
import assert from "node:assert/strict";
import { selectCurrentBooking } from "../src/lib/booking-selection.ts";
import { toCsv } from "../src/lib/csv.ts";

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
