import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { staff, properties, staffAttendance } from "../db/schema";
import { attendanceSummary, isCalendarDate } from "../../staff-attendance";
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
  const ownerProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, session.ownerId))
    .all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));
  const all = await db.select().from(staff).all();
  const records = await db.select().from(staffAttendance).all();
  const month = new Date().toISOString().slice(0, 7);
  return all
    .filter((s) => propertyIds.has(s.propertyId))
    .map((member) => {
      const summary = attendanceSummary(
        records.filter((record) => record.staffId === member.id),
        month,
      );
      return { ...member, attendance: summary.percentage, attendanceDays: summary.days };
    });
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
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("staff");
    await db.insert(staff).values({ id, ...data });
    return { id };
  });

export const updateStaffStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), status: z.enum(["active", "on-leave"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const member = await db.select().from(staff).where(eq(staff.id, data.id)).get();
    if (!member) throw new Error("Not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, member.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(staff).set({ status: data.status }).where(eq(staff.id, data.id));
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    staffInput.omit({ propertyId: true }).extend({ id: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const { id, ...details } = data;
    const member = await db.select().from(staff).where(eq(staff.id, id)).get();
    if (!member) throw new Error("Staff member not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, member.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId)
      throw new Error("Staff member not found");
    await db.update(staff).set(details).where(eq(staff.id, id));
    return { ok: true };
  });

async function requireOwnedStaff(id: string) {
  const session = requireSession();
  const member = await db.select().from(staff).where(eq(staff.id, id)).get();
  if (!member) throw new Error("Staff member not found");
  const property = await db
    .select()
    .from(properties)
    .where(eq(properties.id, member.propertyId))
    .get();
  if (!property || property.ownerId !== session.ownerId) throw new Error("Staff member not found");
  return member;
}

export const listStaffAttendance = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ staffId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await requireOwnedStaff(data.staffId);
    return (
      await db.select().from(staffAttendance).where(eq(staffAttendance.staffId, data.staffId)).all()
    ).sort((a, b) => b.date.localeCompare(a.date));
  });

export const recordStaffAttendance = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        staffId: z.string(),
        date: z.string().refine(isCalendarDate, "Choose a valid date"),
        status: z.enum(["present", "absent", "on-leave"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireOwnedStaff(data.staffId);
    if (data.date > new Date().toISOString().slice(0, 10))
      throw new Error("Attendance cannot be recorded for a future date");
    await db
      .insert(staffAttendance)
      .values(data)
      .onConflictDoUpdate({
        target: [staffAttendance.staffId, staffAttendance.date],
        set: { status: data.status },
      });
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const member = await db.select().from(staff).where(eq(staff.id, data.id)).get();
    if (!member) throw new Error("Not found");
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, member.propertyId))
      .get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.delete(staff).where(eq(staff.id, data.id));
    return { ok: true };
  });
