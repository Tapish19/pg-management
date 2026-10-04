import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, rooms, tenants, properties } from "../db/schema";
import { genId } from "../id";
import { hasVacantBed, occupancyAfterStatusChange } from "../../room-availability";
import { getSession } from "../auth";
import { newestFirst, distinctTenantBookings } from "../../booking-selection";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list bookings (+ tenant, property, room) across their properties
export const listOwnerBookings = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, session.ownerId))
    .all();
  const propertyMap = new Map(ownerProperties.map((p) => [p.id, p]));

  const allBookings = await db.select().from(bookings).all();
  const relevant = newestFirst(allBookings.filter((b) => propertyMap.has(b.propertyId)));

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
  const ownerProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, session.ownerId))
    .all();
  const propertyMap = new Map(ownerProperties.map((p) => [p.id, p]));

  const allBookings = await db.select().from(bookings).all();
  const relevant = distinctTenantBookings(allBookings.filter((b) => propertyMap.has(b.propertyId)));

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
      .parse(input),
  )
  .handler(async ({ data }) => {
    return db.transaction(async (tx) => {
      const room = await tx.select().from(rooms).where(eq(rooms.id, data.roomId)).get();
      if (!room) throw new Error("Room not found");
      if (!hasVacantBed(room)) throw new Error("Room has no available beds");

      const tenantId = genId("tenant");
      await tx.insert(tenants).values({ id: tenantId, ...data.tenant });

      const bookingId = genId("booking");
      await tx.insert(bookings).values({
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
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    return db.transaction(async (tx) => {
      const room = await tx.select().from(rooms).where(eq(rooms.id, data.roomId)).get();
      if (!room) throw new Error("Room not found");
      const property = await tx
        .select()
        .from(properties)
        .where(eq(properties.id, room.propertyId))
        .get();
      if (!property || property.ownerId !== session.ownerId) throw new Error("Room not found");
      if (!hasVacantBed(room)) throw new Error("Room has no available beds");

      const tenantId = genId("tenant");
      await tx.insert(tenants).values({
        id: tenantId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        kycStatus: data.kycStatus,
      });

      const bookingId = genId("booking");
      await tx.insert(bookings).values({
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
      await tx
        .update(rooms)
        .set({ occupiedBeds: occupied, status: occupied >= room.totalBeds ? "full" : "available" })
        .where(eq(rooms.id, room.id));

      return { id: tenantId, bookingId };
    });
  });

// Owner: update a tenant's KYC status
export const updateTenantKyc = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ id: z.string(), kycStatus: z.enum(["verified", "pending", "missing"]) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const ownedProperties = await db
      .select()
      .from(properties)
      .where(eq(properties.ownerId, session.ownerId))
      .all();
    const ownedIds = new Set(ownedProperties.map((p) => p.id));
    const tenantBookings = await db
      .select()
      .from(bookings)
      .where(eq(bookings.tenantId, data.id))
      .all();
    if (!tenantBookings.some((b) => ownedIds.has(b.propertyId)))
      throw new Error("Tenant not found");
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
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    return db.transaction(async (tx) => {
      const booking = await tx.select().from(bookings).where(eq(bookings.id, data.id)).get();
      if (!booking) throw new Error("Not found");
      const property = await tx
        .select()
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .get();
      if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

      const room = await tx.select().from(rooms).where(eq(rooms.id, booking.roomId)).get();
      if (!room) throw new Error("Room not found");
      const occupancy = occupancyAfterStatusChange(room, booking.status, data.status);
      await tx.update(rooms).set(occupancy).where(eq(rooms.id, room.id));
      await tx.update(bookings).set({ status: data.status }).where(eq(bookings.id, data.id));
      return { ok: true };
    });
  });
