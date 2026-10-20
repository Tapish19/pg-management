import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { visitors, properties, tenants, bookings } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";
import {
  visitorReviewChanges,
  visitorReviewInput,
  compareVisitorRequests,
} from "../../visitor-approval";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all visitors (with tenant name) across their properties
export const listOwnerVisitors = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, session.ownerId))
    .all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const all = await db.select().from(visitors).all();
  const relevant = all.filter((v) => propertyIds.has(v.propertyId));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  return relevant
    .map((v) => ({ ...v, tenantName: v.tenantId ? tenantMap.get(v.tenantId)?.name : undefined }))
    .sort(compareVisitorRequests);
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
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");
    if (data.tenantId) {
      const booking = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, data.tenantId),
            eq(bookings.propertyId, data.propertyId),
            inArray(bookings.status, ["active", "confirmed"]),
          ),
        )
        .get();
      if (!booking) throw new Error("Tenant does not have an active booking at this property");
    }

    const id = genId("V");
    await db.insert(visitors).values({ id, ...data, approvalStatus: "approved" });
    return { id };
  });

export const checkOutVisitor = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string(), checkOut: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const visitor = await db.select().from(visitors).where(eq(visitors.id, data.id)).get();
    if (!visitor) throw new Error("Not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, visitor.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");
    if (visitor.approvalStatus !== "approved" || !visitor.checkIn)
      throw new Error("Only checked-in approved visitors can check out");
    if (visitor.checkOut) return { ok: true };

    await db.update(visitors).set({ checkOut: data.checkOut }).where(eq(visitors.id, data.id));
    return { ok: true };
  });

export const reviewVisitorRequest = createServerFn({ method: "POST" })
  .validator((input: unknown) => visitorReviewInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const visitor = await db.select().from(visitors).where(eq(visitors.id, data.id)).get();
    if (!visitor) throw new Error("Visitor not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, visitor.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Visitor not found");
    if (!visitorReviewChanges(visitor.approvalStatus, data.decision)) return { ok: true };
    const changed = await db
      .update(visitors)
      .set({ approvalStatus: data.decision })
      .where(and(eq(visitors.id, data.id), eq(visitors.approvalStatus, "pending")))
      .returning({ id: visitors.id });
    if (!changed.length)
      throw new Error("This visitor request has already been decided. Refresh the logbook.");
    return { ok: true };
  });

export const checkInVisitor = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ id: z.string().min(1) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const visitor = await db.select().from(visitors).where(eq(visitors.id, data.id)).get();
    if (!visitor) throw new Error("Visitor not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, visitor.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Visitor not found");
    if (visitor.approvalStatus !== "approved" || visitor.checkOut)
      throw new Error("Only approved visitors can check in");
    if (!visitor.checkIn)
      await db
        .update(visitors)
        .set({ checkIn: new Date().toISOString() })
        .where(and(eq(visitors.id, data.id), eq(visitors.checkIn, "")));
    return { ok: true };
  });
