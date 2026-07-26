import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { visitors, properties, tenants } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all visitors (with tenant name) across their properties
export const listOwnerVisitors = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const all = await db.select().from(visitors).all();
  const relevant = all.filter((v) => propertyIds.has(v.propertyId));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  return relevant
    .map((v) => ({ ...v, tenantName: v.tenantId ? tenantMap.get(v.tenantId)?.name : undefined }))
    .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
});

const visitorInput = z.object({
  propertyId: z.string(),
  tenantId: z.string().optional(),
  name: z.string().min(2),
  purpose: z.string().optional(),
  checkIn: z.string(),
  idVerified: z.boolean().default(false),
});

export const createVisitor = createServerFn({ method: "POST" })
  .validator((input: unknown) => visitorInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("V");
    await db.insert(visitors).values({ id, ...data });
    return { id };
  });

export const checkOutVisitor = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string(), checkOut: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const visitor = await db.select().from(visitors).where(eq(visitors.id, data.id)).get();
    if (!visitor) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, visitor.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(visitors).set({ checkOut: data.checkOut }).where(eq(visitors.id, data.id));
    return { ok: true };
  });
