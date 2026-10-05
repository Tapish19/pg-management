import assert from "node:assert/strict";
import type { DemoWhatsappInbox } from "../src/lib/demo-whatsapp";
import { readDemoPaymentMethods, saveDemoPaymentMethods } from "../src/lib/demo-payment-settings";
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
saveDemoPaymentMethods({ cash: false, upi: false, razorpay: false, stripe: false });
assert.equal(readDemoPaymentMethods().cash, false);
assert.throws(
  () => demoCall("verifyPayment", { paymentId: order.paymentId, method: "cash" }),
  /disabled/,
);
assert.ok(
  (demoCall("getMyPayments") as { id: string; status: string }[]).some(
    (p) => p.id === order.paymentId && p.status === "pending",
  ),
);
saveDemoPaymentMethods({ cash: true, upi: false, razorpay: false, stripe: false });
demoCall("verifyPayment", { paymentId: order.paymentId });
const tenantWhatsapp = demoCall("getDemoWhatsapp") as DemoWhatsappInbox;
demoCall("undoDemoPayment", { paymentId: order.paymentId });
assert.ok(
  (demoCall("getMyPayments") as { id: string; status: string; paidAt: string | null }[]).some(
    (p) => p.id === order.paymentId && p.status === "pending" && p.paidAt === null,
  ),
);
assert.ok(
  !(demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.some(
    (m) => m.event === `payment:${order.paymentId}`,
  ),
);
assert.throws(
  () => demoCall("undoDemoPayment", { paymentId: "another-persons-payment" }),
  /Only your/,
);
role("admin");
assert.throws(() => demoCall("undoDemoPayment", { paymentId: order.paymentId }), /not available/);
role("tenant");
demoCall("verifyPayment", { paymentId: order.paymentId });
assert.equal(
  tenantWhatsapp.messages.filter((m) => m.event === `payment:${order.paymentId}`).length,
  1,
);
demoCall("verifyPayment", { paymentId: order.paymentId });
assert.equal(
  (demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.filter(
    (m) => m.event === `payment:${order.paymentId}`,
  ).length,
  1,
);
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
demoCall("uploadMyKycDocument", {
  proofType: "passport",
  name: "demo-id.pdf",
  mime: "application/pdf",
  base64: btoa("%PDF-1.4\nTest\n%%EOF"),
});
assert.equal((demoCall("getMyKyc") as { status: string }).status, "pending");
assert.equal(
  (demoCall("getKycDocument", { tenantId: "u-tenant" }) as { name: string }).name,
  "demo-id.pdf",
);
assert.throws(() => demoCall("getKycDocument", { tenantId: "another-tenant" }), /Access denied/);
assert.throws(
  () =>
    demoCall("uploadMyKycDocument", {
      proofType: "passport",
      name: "bad.pdf",
      mime: "application/pdf",
      base64: btoa("invalid"),
    }),
  /content/,
);
role("admin");
const ownerWhatsapp = demoCall("getDemoWhatsapp") as DemoWhatsappInbox;
demoCall("updateBookingStatus", { id: booking.booking.id, status: "confirmed" });
role("tenant");
assert.ok(
  (demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.some(
    (message) => message.event === `booking:${booking.booking.id}:confirmed`,
  ),
);
role("admin");
assert.equal(
  ownerWhatsapp.messages.filter((m) => m.event === `payment:${order.paymentId}`).length,
  1,
);
assert.ok(ownerWhatsapp.messages.every((m) => m.recipientRole === "admin"));
assert.ok((demoCall("sendDemoRentReminders") as { count: number }).count > 0);
assert.equal((demoCall("sendDemoRentReminders") as { count: number }).count, 0);
demoCall("setDemoWhatsapp", { enabled: false });
const beforePreview = (demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.length;
demoCall("previewDemoWhatsapp");
assert.equal((demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.length, beforePreview);
demoCall("setDemoWhatsapp", { enabled: true });
demoCall("previewDemoWhatsapp");
assert.equal((demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.length, beforePreview + 1);
demoCall("readDemoWhatsapp");
assert.ok((demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.every((m) => m.read));
role("tenant");
assert.throws(() => demoCall("sendDemoRentReminders"), /not available/);
assert.ok((demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.some((m) => !m.read));
assert.ok(
  !(demoCall("getDemoWhatsapp") as DemoWhatsappInbox).messages.some((m) =>
    m.event.startsWith("rent:"),
  ),
  "Paid tenant must not get rent reminders",
);
role("admin");
demoCall("saveDemoConfig", {
  key: "pgone.demo.roles.v1",
  value: {
    staff: demoPages.staff,
    tenant: demoPages.tenant.filter((path) => path !== "/my-assistant"),
  },
});
role("tenant");
assert.throws(() => demoCall("askAssistantFn", { question: "rent" }), /disabled access/);
assert.throws(
  () => demoCall("saveDemoConfig", { key: "pgone.demo.roles.v1", value: {} }),
  /not available/,
);
role("admin");
assert.throws(
  () =>
    demoCall("saveDemoConfig", {
      key: "pgone.demo.roles.v1",
      value: { staff: ["/payments"], tenant: demoPages.tenant },
    }),
  /supported pages/,
);
role("tenant");
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
