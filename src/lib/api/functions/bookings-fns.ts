import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, rooms, tenants, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list bookings (+ tenant, property, room) across their properties
export const listOwnerBookings = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyMap = new Map(ownerProperties.map((p) => [p.id, p]));

  const allBookings = await db.select().from(bookings).all();
  const relevant = allBookings.filter((b) => propertyMap.has(b.propertyId));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const allRooms = await db.select().from(rooms).all();
  const roomMap = new Map(allRooms.map((r) => [r.id, r]));

  return relevant.map((b) => ({
    ...b,
    tenant: tenantMap.get(b.tenantId),
    property: propertyMap.get(b.propertyId),
    room: roomMap.get(b.roomId),
  }));
});

// Owner: list distinct tenants across their properties (derived from bookings)
export const listOwnerTenants = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyMap = new Map(ownerProperties.map((p) => [p.id, p]));

  const allBookings = await db.select().from(bookings).all();
  const relevant = allBookings.filter((b) => propertyMap.has(b.propertyId));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const allRooms = await db.select().from(rooms).all();
  const roomMap = new Map(allRooms.map((r) => [r.id, r]));

  return relevant.map((b) => ({
    booking: b,
    tenant: tenantMap.get(b.tenantId),
    property: propertyMap.get(b.propertyId),
    room: roomMap.get(b.roomId),
  }));
});

// Public: create a booking request (creates the tenant record too)
export const createBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        roomId: z.string(),
        checkInDate: z.string(),
        tenant: z.object({
          name: z.string().min(2),
          email: z.string().email(),
          phone: z.string().min(8),
          idProofType: z.string().optional(),
          idProofNumber: z.string().optional(),
          emergencyContact: z.string().optional(),
        }),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const room = await db.select().from(rooms).where(eq(rooms.id, data.roomId)).get();
    if (!room) throw new Error("Room not found");
    if (room.occupiedBeds >= room.totalBeds) throw new Error("This room is fully occupied");

    const tenantId = genId("tenant");
    await db.insert(tenants).values({ id: tenantId, ...data.tenant });
    // TEMP DIAGNOSTIC — remove once tenant login is confirmed working.
    console.log(`[diag] createBooking inserted tenant id=${tenantId} email="${data.tenant.email}" phone="${data.tenant.phone}"`);

    const bookingId = genId("booking");
    await db.insert(bookings).values({
      id: bookingId,
      roomId: data.roomId,
      propertyId: room.propertyId,
      tenantId,
      checkInDate: data.checkInDate,
      monthlyRent: room.rentPerBed,
      depositAmount: room.depositAmount,
      status: "pending",
    });

    return { id: bookingId, monthlyRent: room.rentPerBed, depositAmount: room.depositAmount };
  });

// Owner: onboard a tenant directly (creates tenant + active booking, occupies a bed)
export const onboardTenant = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        roomId: z.string(),
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(8),
        moveIn: z.string(),
        kycStatus: z.enum(["verified", "pending", "missing"]).default("pending"),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const room = await db.select().from(rooms).where(eq(rooms.id, data.roomId)).get();
    if (!room) throw new Error("Room not found");
    const property = await db.select().from(properties).where(eq(properties.id, room.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Room not found");
    if (room.occupiedBeds >= room.totalBeds) throw new Error("This room is fully occupied");

    const tenantId = genId("tenant");
    await db.insert(tenants).values({
      id: tenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      kycStatus: data.kycStatus,
    });

    const bookingId = genId("booking");
    await db.insert(bookings).values({
      id: bookingId,
      roomId: data.roomId,
      propertyId: room.propertyId,
      tenantId,
      checkInDate: data.moveIn,
      monthlyRent: room.rentPerBed,
      depositAmount: room.depositAmount,
      status: "active",
    });

    const occupied = room.occupiedBeds + 1;
    await db
      .update(rooms)
      .set({ occupiedBeds: occupied, status: occupied >= room.totalBeds ? "full" : "available" })
      .where(eq(rooms.id, room.id));

    return { id: tenantId, bookingId };
  });

// Owner: update a tenant's KYC status
export const updateTenantKyc = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), kycStatus: z.enum(["verified", "pending", "missing"]) }).parse(input)
  )
  .handler(async ({ data }) => {
    requireSession();
    await db.update(tenants).set({ kycStatus: data.kycStatus }).where(eq(tenants.id, data.id));
    return { ok: true };
  });

// Owner: update booking status, keeping room occupancy in sync
export const updateBookingStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["pending", "confirmed", "active", "checked_out", "cancelled"]),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const booking = await db.select().from(bookings).where(eq(bookings.id, data.id)).get();
    if (!booking) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, booking.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(bookings).set({ status: data.status }).where(eq(bookings.id, data.id));

    const room = await db.select().from(rooms).where(eq(rooms.id, booking.roomId)).get();
    if (room) {
      if ((data.status === "confirmed" || data.status === "active") && booking.status === "pending") {
        const occupied = room.occupiedBeds + 1;
        await db
          .update(rooms)
          .set({ occupiedBeds: occupied, status: occupied >= room.totalBeds ? "full" : "available" })
          .where(eq(rooms.id, room.id));
      }
      if (
        (data.status === "checked_out" || data.status === "cancelled") &&
        (booking.status === "confirmed" || booking.status === "active")
      ) {
        const occupied = Math.max(0, room.occupiedBeds - 1);
        await db.update(rooms).set({ occupiedBeds: occupied, status: "available" }).where(eq(rooms.id, room.id));
      }
    }

    return { ok: true };
  });
