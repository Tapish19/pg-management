import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { bookings, complaints, foodMenu, notices, payments, properties, rooms, tenants, visitors } from "../db/schema";
import { genId } from "../id";
import {
  createTenantSessionToken,
  setTenantSessionCookie,
  clearTenantSessionCookie,
  getTenantSession,
} from "../auth";

function requireTenantSession() {
  const session = getTenantSession();
  if (!session) throw new Error("Please sign in first");
  return session;
}

// Resolve the tenant's most relevant booking (active > confirmed > pending, most recent)
async function getPrimaryBooking(tenantId: string) {
  const rows = await db.select().from(bookings).where(eq(bookings.tenantId, tenantId)).all();
  if (rows.length === 0) return null;
  const rank: Record<string, number> = { active: 0, confirmed: 1, pending: 2, checked_out: 3, cancelled: 4 };
  return rows.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))[0];
}

// Tenant sign-in: matches email + phone against an existing tenant record with a booking
export const loginTenant = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ email: z.string().email(), phone: z.string().min(6) }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const allTenants = await db.select().from(tenants).all();

    // TEMP DIAGNOSTIC — remove once the login mismatch is resolved. Logs the
    // normalized value we searched for plus every candidate whose email
    // matches (to isolate an email-vs-phone mismatch) without dumping the
    // full tenants table.
    console.log(`[loginTenant] searching for email=${JSON.stringify(email)} phone=${JSON.stringify(phone)}`);
    console.log(`[loginTenant] total tenants in db: ${allTenants.length}`);
    const emailMatches = allTenants.filter((t) => t.email.trim().toLowerCase() === email);
    if (emailMatches.length === 0) {
      console.log(`[loginTenant] no tenant row has that email at all`);
    } else {
      for (const t of emailMatches) {
        console.log(
          `[loginTenant] email matched tenant id=${t.id} stored phone=${JSON.stringify(t.phone.trim())} — equal? ${t.phone.trim() === phone}`,
        );
      }
    }

    const match = allTenants.find(
      (t) => t.email.trim().toLowerCase() === email && t.phone.trim() === phone,
    );
    if (!match) throw new Error("No resident found with that email and phone number");

    const booking = await getPrimaryBooking(match.id);
    if (!booking) throw new Error("No booking found for this resident yet");

    const token = createTenantSessionToken({ tenantId: match.id, name: match.name, email: match.email });
    setTenantSessionCookie(token);
    return { id: match.id, name: match.name, email: match.email };
  });

export const getCurrentTenantSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = getTenantSession();
  return session ? { id: session.tenantId, name: session.name, email: session.email } : null;
});

export const logoutTenant = createServerFn({ method: "POST" }).handler(async () => {
  clearTenantSessionCookie();
  return { ok: true };
});

// My room / booking summary, with room + property joined
export const getMyBooking = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  const booking = await getPrimaryBooking(session.tenantId);
  if (!booking) return null;
  const room = await db.select().from(rooms).where(eq(rooms.id, booking.roomId)).get();
  const property = await db.select().from(properties).where(eq(properties.id, booking.propertyId)).get();
  const tenant = await db.select().from(tenants).where(eq(tenants.id, session.tenantId)).get();
  return { booking, room, property, tenant };
});

// My complaints
export const getMyComplaints = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  return db.select().from(complaints).where(eq(complaints.tenantId, session.tenantId)).all();
});

export const createMyComplaint = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(2),
        category: z.enum(["plumbing", "electrical", "wifi", "cleaning", "food", "other"]),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireTenantSession();
    const booking = await getPrimaryBooking(session.tenantId);
    if (!booking) throw new Error("No active booking found");
    const room = await db.select().from(rooms).where(eq(rooms.id, booking.roomId)).get();
    const id = genId("complaint");
    await db.insert(complaints).values({
      id,
      propertyId: booking.propertyId,
      tenantId: session.tenantId,
      roomNumber: room?.roomNumber,
      category: data.category,
      priority: data.priority,
      title: data.title,
      status: "open",
    });
    return { id };
  });

// My visitors
export const getMyVisitors = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  return db.select().from(visitors).where(eq(visitors.tenantId, session.tenantId)).all();
});

export const createMyVisitor = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ name: z.string().min(2), purpose: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireTenantSession();
    const booking = await getPrimaryBooking(session.tenantId);
    if (!booking) throw new Error("No active booking found");
    const id = genId("visitor");
    await db.insert(visitors).values({
      id,
      propertyId: booking.propertyId,
      tenantId: session.tenantId,
      name: data.name,
      purpose: data.purpose,
      checkIn: new Date().toISOString(),
      idVerified: false,
    });
    return { id };
  });

// My food menu (this week, for my property)
export const getMyFoodMenu = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  const booking = await getPrimaryBooking(session.tenantId);
  if (!booking) return [];
  return db.select().from(foodMenu).where(eq(foodMenu.propertyId, booking.propertyId)).all();
});

// Notices for my property
export const getMyNotices = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  const booking = await getPrimaryBooking(session.tenantId);
  if (!booking) return [];
  return db.select().from(notices).where(eq(notices.propertyId, booking.propertyId)).all();
});

// My payment / invoice history, across all my bookings
export const getMyPayments = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  const myBookings = await db.select().from(bookings).where(eq(bookings.tenantId, session.tenantId)).all();
  if (myBookings.length === 0) return [];
  const bookingIds = myBookings.map((b) => b.id);
  const rows = await db.select().from(payments).where(inArray(payments.bookingId, bookingIds)).all();
  const bookingMap = new Map(myBookings.map((b) => [b.id, b]));
  return rows.map((p) => ({ ...p, booking: bookingMap.get(p.bookingId) }));
});
