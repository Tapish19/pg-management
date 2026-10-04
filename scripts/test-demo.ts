import assert from "node:assert/strict";
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
