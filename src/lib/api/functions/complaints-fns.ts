import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { complaints, properties, tenants, staff } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all complaints (with tenant + assignee names) across their properties
export const listOwnerComplaints = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const all = await db.select().from(complaints).all();
  const relevant = all.filter((c) => propertyIds.has(c.propertyId));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const allStaff = await db.select().from(staff).all();
  const staffMap = new Map(allStaff.map((s) => [s.id, s]));

  return relevant.map((c) => ({
    ...c,
    tenantName: c.tenantId ? tenantMap.get(c.tenantId)?.name : undefined,
    assignedToName: c.assignedTo ? staffMap.get(c.assignedTo)?.name : undefined,
  }));
});

const complaintInput = z.object({
  propertyId: z.string(),
  tenantId: z.string().optional(),
  roomNumber: z.string().optional(),
  category: z.enum(["plumbing", "electrical", "wifi", "cleaning", "food", "other"]).default("other"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  title: z.string().min(2),
});

export const createComplaint = createServerFn({ method: "POST" })
  .validator((input: unknown) => complaintInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("TCK");
    await db.insert(complaints).values({ id, ...data });
    return { id };
  });

export const updateComplaint = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["open", "in-progress", "resolved", "closed"]).optional(),
        assignedTo: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const { id, ...rest } = data;
    const complaint = await db.select().from(complaints).where(eq(complaints.id, id)).get();
    if (!complaint) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, complaint.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(complaints).set(rest).where(eq(complaints.id, id));
    return { ok: true };
  });
