import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { properties, rooms } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Public: list all properties, optionally filtered by city or owner
export const listProperties = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ city: z.string().optional(), ownerId: z.string().optional() }).optional().parse(input ?? {})
  )
  .handler(async ({ data }) => {
    let list = data?.ownerId
      ? await db.select().from(properties).where(eq(properties.ownerId, data.ownerId)).all()
      : await db.select().from(properties).all();

    if (data?.city) {
      list = list.filter((p) => p.city.toLowerCase().includes(data.city!.toLowerCase()));
    }

    const allRooms = await db.select().from(rooms).all();
    return list.map((p) => {
      const propertyRooms = allRooms.filter((r) => r.propertyId === p.id);
      const availableBeds = propertyRooms.reduce((sum, r) => sum + (r.totalBeds - r.occupiedBeds), 0);
      const totalBeds = propertyRooms.reduce((sum, r) => sum + r.totalBeds, 0);
      const minRent = propertyRooms.length ? Math.min(...propertyRooms.map((r) => r.rentPerBed)) : null;
      return {
        ...p,
        amenities: JSON.parse(p.amenities || "[]") as string[],
        availableBeds,
        totalBeds,
        roomCount: propertyRooms.length,
        minRent,
      };
    });
  });

// Public: get one property with its rooms
export const getProperty = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const property = await db.select().from(properties).where(eq(properties.id, data.id)).get();
    if (!property) throw new Error("Property not found");
    const propertyRooms = await db.select().from(rooms).where(eq(rooms.propertyId, data.id)).all();
    return {
      ...property,
      amenities: JSON.parse(property.amenities || "[]") as string[],
      rooms: propertyRooms.map((r) => ({ ...r, amenities: JSON.parse(r.amenities || "[]") as string[] })),
    };
  });

const propertyInput = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  locality: z.string().min(2),
  address: z.string().min(5),
  description: z.string().optional(),
  genderType: z.enum(["male", "female", "co-ed"]),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export const createProperty = createServerFn({ method: "POST" })
  .validator((input: unknown) => propertyInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const id = genId("prop");
    const { amenities, images, ...rest } = data;
    await db.insert(properties).values({
      id,
      ownerId: session.ownerId,
      ...rest,
      amenities: JSON.stringify(amenities || []),
      images: JSON.stringify(images || []),
    });
    return { id };
  });

export const updateProperty = createServerFn({ method: "POST" })
  .validator((input: unknown) => propertyInput.partial().extend({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const { id, amenities, images, ...rest } = data;
    const property = await db.select().from(properties).where(eq(properties.id, id)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    const update: Record<string, unknown> = { ...rest };
    if (amenities) update.amenities = JSON.stringify(amenities);
    if (images) update.images = JSON.stringify(images);

    await db.update(properties).set(update).where(eq(properties.id, id));
    return { ok: true };
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.id)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");
    await db.delete(properties).where(eq(properties.id, data.id));
    return { ok: true };
  });
