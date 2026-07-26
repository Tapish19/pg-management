import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { foodMenu, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Get (or lazily seed) the weekly menu for a property
export const getFoodMenu = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ propertyId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const existing = await db.select().from(foodMenu).where(eq(foodMenu.propertyId, data.propertyId)).all();
    if (existing.length > 0) {
      return DAYS.map((day) => existing.find((m) => m.day === day)).filter(Boolean);
    }
    // Seed empty rows so the page has something to edit
    const seeded = [];
    for (const day of DAYS) {
      const id = genId("menu");
      await db.insert(foodMenu).values({ id, propertyId: data.propertyId, day, breakfast: "", lunch: "", dinner: "" });
      seeded.push({ id, propertyId: data.propertyId, day, breakfast: "", lunch: "", dinner: "" });
    }
    return seeded;
  });

export const updateFoodMenuDay = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string(),
        breakfast: z.string(),
        lunch: z.string(),
        dinner: z.string(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const row = await db.select().from(foodMenu).where(eq(foodMenu.id, data.id)).get();
    if (!row) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, row.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db
      .update(foodMenu)
      .set({ breakfast: data.breakfast, lunch: data.lunch, dinner: data.dinner })
      .where(eq(foodMenu.id, data.id));
    return { ok: true };
  });
