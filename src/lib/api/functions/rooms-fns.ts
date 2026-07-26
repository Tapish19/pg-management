import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { rooms, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

export const listRooms = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ propertyId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const list = await db.select().from(rooms).where(eq(rooms.propertyId, data.propertyId)).all();
    return list.map((r) => ({ ...r, amenities: JSON.parse(r.amenities || "[]") as string[] }));
  });

// Owner: list all rooms across all their properties (for tenants/bookings pages)
export const listOwnerRooms = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));
  const allRooms = await db.select().from(rooms).all();
  return allRooms.filter((r) => propertyIds.has(r.propertyId));
});

const roomInput = z.object({
  propertyId: z.string(),
  roomNumber: z.string().min(1),
  sharingType: z.enum(["single", "double", "triple", "dormitory"]),
  totalBeds: z.number().int().min(1),
  rentPerBed: z.number().positive(),
  depositAmount: z.number().min(0).default(0),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export const createRoom = createServerFn({ method: "POST" })
  .validator((input: unknown) => roomInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("room");
    const { amenities, images, ...rest } = data;
    await db.insert(rooms).values({
      id,
      ...rest,
      amenities: JSON.stringify(amenities || []),
      images: JSON.stringify(images || []),
    });
    return { id };
  });

export const updateRoom = createServerFn({ method: "POST" })
  .validator((input: unknown) => roomInput.partial().extend({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const { id, amenities, images, ...rest } = data;
    const room = await db.select().from(rooms).where(eq(rooms.id, id)).get();
    if (!room) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, room.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    const update: Record<string, unknown> = { ...rest };
    if (amenities) update.amenities = JSON.stringify(amenities);
    if (images) update.images = JSON.stringify(images);

    await db.update(rooms).set(update).where(eq(rooms.id, id));
    return { ok: true };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const room = await db.select().from(rooms).where(eq(rooms.id, data.id)).get();
    if (!room) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, room.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");
    await db.delete(rooms).where(eq(rooms.id, data.id));
    return { ok: true };
  });
