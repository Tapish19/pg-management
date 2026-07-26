import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { notices, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all notices across their properties, newest first
export const listOwnerNotices = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const all = await db.select().from(notices).all();
  return all
    .filter((n) => propertyIds.has(n.propertyId))
    .sort((a, b) => ((a.createdAt || "") < (b.createdAt || "") ? 1 : -1));
});

const noticeInput = z.object({
  propertyId: z.string(),
  title: z.string().min(2),
  body: z.string().min(2),
  audience: z.string().default("All tenants"),
  postedBy: z.string(),
});

export const createNotice = createServerFn({ method: "POST" })
  .validator((input: unknown) => noticeInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("N");
    await db.insert(notices).values({ id, ...data });
    return { id };
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const notice = await db.select().from(notices).where(eq(notices.id, data.id)).get();
    if (!notice) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, notice.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.delete(notices).where(eq(notices.id, data.id));
    return { ok: true };
  });
