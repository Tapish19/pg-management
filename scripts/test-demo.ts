import assert from "node:assert/strict";
import { computeCompatibility, preferencesInput } from "../src/lib/roommate-compatibility";
import {
  demoCall,
  demoProfile,
  demoPages,
  withDemo,
  DEMO_SESSION_KEY,
} from "../src/lib/demo-store";
const values = new Map<string, string>();
Object.assign(globalThis, {
  window: {},
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
});
const role = (role: string) => values.set(DEMO_SESSION_KEY, JSON.stringify({ role }));
role("admin");
const properties = demoCall("listOwnerProperties") as {
  id: string;
  totalBeds: number;
  occupiedBeds: number;
}[];
assert.equal(properties.length, 4);
assert.ok(properties.every((p) => p.totalBeds > 0 && p.occupiedBeds <= p.totalBeds));
for (const name of [
  "listOwnerRooms",
  "listOwnerBookings",
  "listOwnerTenants",
  "listOwnerStaff",
  "listOwnerComplaints",
  "listOwnerVisitors",
  "listOwnerNotices",
  "listOwnerExpenses",
  "listOwnerPayments",
  "getOwnerRoomMatches",
  "listTenantRiskScores",
  "getOwnerNotifications",
])
  assert.ok((demoCall(name) as unknown[]).length > 0, name);
assert.ok((demoCall("getOwnerReports") as { totalRevenue: number }).totalRevenue > 0);
demoCall("createNotice", {
  propertyId: "p1",
  title: "Cross-role notice",
  body: "Hello residents",
  audience: "All tenants",
});
const menu = demoCall("getFoodMenu", { propertyId: "p1" }) as { id: string; breakfast: string }[];
demoCall("updateFoodMenuDay", {
  id: menu[0].id,
  breakfast: "Demo breakfast",
  lunch: "Dal",
  dinner: "Rice",
});
role("tenant");
const basePreferences = preferencesInput.parse({
  sleepSchedule: "early_bird",
  cleanliness: 4,
  noiseTolerance: 3,
  socialLevel: 3,
  foodHabit: "veg",
  smoking: false,
  guestsFrequency: "rare",
  workSchedule: "office",
});
assert.equal(computeCompatibility(basePreferences, basePreferences).score, 100);
assert.equal(
  computeCompatibility(basePreferences, { ...basePreferences, sleepSchedule: "night_owl" }).score,
  80,
);
assert.equal(
  computeCompatibility(basePreferences, { ...basePreferences, sleepSchedule: "flexible" }).score,
  90,
);
const beforeMatch = demoCall("getMyRoommateMatches") as {
  matches: { score: number; breakdown: unknown[] }[];
};
assert.equal(beforeMatch.matches[0].breakdown.length, 8);
const state = JSON.parse(values.get("pgone.demo.data.v1")!);
const roommatePrefs = state.preferences.t2;
demoCall("saveMyPreferences", roommatePrefs);
assert.equal(
  (demoCall("getMyRoommateMatches") as { matches: { score: number }[] }).matches[0].score,
  100,
);
assert.notEqual(beforeMatch.matches[0].score, 100);
assert.throws(() => demoCall("saveMyPreferences", { ...roommatePrefs, cleanliness: 6 }));
assert.equal(
  (demoCall("getMyPreferences") as { cleanliness: number }).cleanliness,
  roommatePrefs.cleanliness,
);
role("admin");
const fixture = JSON.parse(values.get("pgone.demo.data.v1")!);
const candidateId = fixture.bookings.find(
  (b: { status: string }) => b.status === "pending",
).tenantId;
fixture.preferences[candidateId] = fixture.preferences.t3;
values.set("pgone.demo.data.v1", JSON.stringify(fixture));
const roomMatches = demoCall("getOwnerRoomMatches") as {
  room: { id: string; sharingType: string };
  suggestedCandidates: { tenant: { id: string }; score: number | null }[];
}[];
assert.ok(roomMatches.every((r) => r.room.sharingType !== "single" && r.room.id !== "r-203"));
assert.equal(
  roomMatches
    .find((r) => r.room.id === "r-201")!
    .suggestedCandidates.find((c) => c.tenant.id === candidateId)!.score,
  100,
);
assert.ok(roomMatches.some((r) => r.suggestedCandidates.some((c) => c.score === null)));
for (const match of roomMatches) {
  assert.ok(match.suggestedCandidates.length <= 5);
  assert.ok(
    match.suggestedCandidates.every(
      (c, i, all) => i === 0 || (all[i - 1].score ?? -1) >= (c.score ?? -1),
    ),
  );
}
role("tenant");
for (const name of [
  "getMyComplaints",
  "getMyVisitors",
  "getMyFoodMenu",
  "getMyNotices",
  "getMyPayments",
])
  assert.ok((demoCall(name) as unknown[]).length > 0, name);
assert.ok(
  (demoCall("getMyNotices") as { title: string }[]).some((n) => n.title === "Cross-role notice"),
);
assert.ok(
  (demoCall("getMyFoodMenu") as { breakfast: string }[]).some(
    (m) => m.breakfast === "Demo breakfast",
  ),
);
assert.throws(() => demoCall("listOwnerPayments"), /not available/);
assert.throws(() => demoCall("createProperty"), /not available/);
assert.ok(!demoPages.tenant.includes("/settings"));
const ticket = demoCall("createMyComplaint", {
  title: "Demo tap leak",
  category: "plumbing",
  priority: "high",
}) as { id: string };
const booking = demoCall("getMyBooking") as { booking: { id: string; monthlyRent: number } };
const order = demoCall("createPaymentOrder", {
  bookingId: booking.booking.id,
  type: "rent",
  amount: booking.booking.monthlyRent,
  month: new Date().toISOString().slice(0, 7),
}) as { paymentId: string };
demoCall("verifyPayment", { paymentId: order.paymentId });
assert.ok(
  (demoCall("getMyPayments") as { id: string; status: string }[]).some(
    (p) => p.id === order.paymentId && p.status === "paid",
  ),
);
demoCall("saveProfile", {
  name: "Demo Resident",
  email: "resident@example.invalid",
  phone: "0000000000",
});
assert.equal(demoProfile("tenant").name, "Demo Resident");
assert.ok(
  (
    demoCall("askAssistantFn", { question: "What is my rent?" }) as { answer: string }
  ).answer.includes(String(booking.booking.monthlyRent).replace(/(\d)(?=(\d{3})+$)/g, "$1,")),
);
role("staff");
assert.equal((demoCall("listOwnerProperties") as unknown[]).length, 1);
assert.throws(() => demoCall("getFoodMenu", { propertyId: "p2" }), /not found/);
assert.throws(() => demoCall("createStaff"), /not available/);
assert.ok((demoCall("listOwnerComplaints") as { id: string }[]).some((c) => c.id === ticket.id));
demoCall("updateComplaint", { id: ticket.id, status: "resolved" });
demoCall("addTaskComment", { id: ticket.id, comment: "Tap washer replaced" });
assert.equal((demoCall("getTaskComments", { id: ticket.id }) as string[]).length, 1);
role("tenant");
assert.ok(
  (demoCall("getMyComplaints") as { id: string; status: string }[]).some(
    (c) => c.id === ticket.id && c.status === "resolved",
  ),
);
let realCalls = 0;
const call = withDemo("getMyBooking", async () => {
  realCalls++;
  return null;
});
await call();
assert.equal(realCalls, 0);
values.delete(DEMO_SESSION_KEY);
await call();
assert.equal(realCalls, 1);
console.log(
  "Demo passed: every role populated, local edits persist, cross-role workflows, isolated permissions, simulated rent and no real API calls in demo mode.",
);
