import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { staff, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all staff across their properties
export const listOwnerStaff = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));
  const all = await db.select().from(staff).all();
  return all.filter((s) => propertyIds.has(s.propertyId));
});

const staffInput = z.object({
  propertyId: z.string(),
  name: z.string().min(2),
  role: z.enum(["manager", "cook", "housekeeping", "security", "maintenance"]),
  phone: z.string().min(8),
  shift: z.enum(["morning", "evening", "night"]).default("morning"),
  salary: z.number().min(0).default(0),
});

export const createStaff = createServerFn({ method: "POST" })
  .validator((input: unknown) => staffInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("staff");
    await db.insert(staff).values({ id, ...data });
    return { id };
  });

export const updateStaffStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), status: z.enum(["active", "on-leave"]) }).parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const member = await db.select().from(staff).where(eq(staff.id, data.id)).get();
    if (!member) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, member.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(staff).set({ status: data.status }).where(eq(staff.id, data.id));
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const member = await db.select().from(staff).where(eq(staff.id, data.id)).get();
    if (!member) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, member.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.delete(staff).where(eq(staff.id, data.id));
    return { ok: true };
  });
