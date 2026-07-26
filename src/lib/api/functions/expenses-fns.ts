import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { expenses, properties } from "../db/schema";
import { genId } from "../id";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: list all expenses across their properties
export const listOwnerExpenses = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));
  const all = await db.select().from(expenses).all();
  return all
    .filter((e) => propertyIds.has(e.propertyId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
});

const expenseInput = z.object({
  propertyId: z.string(),
  category: z.enum(["utilities", "salary", "food", "maintenance", "supplies", "misc"]).default("misc"),
  vendor: z.string().min(1),
  date: z.string(),
  amount: z.number().positive(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const createExpense = createServerFn({ method: "POST" })
  .validator((input: unknown) => expenseInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireSession();
    const property = await db.select().from(properties).where(eq(properties.id, data.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Property not found");

    const id = genId("EXP");
    await db.insert(expenses).values({ id, ...data });
    return { id };
  });

export const updateExpenseStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), status: z.enum(["pending", "approved", "rejected"]) }).parse(input)
  )
  .handler(async ({ data }) => {
    const session = requireSession();
    const expense = await db.select().from(expenses).where(eq(expenses.id, data.id)).get();
    if (!expense) throw new Error("Not found");
    const property = await db.select().from(properties).where(eq(properties.id, expense.propertyId)).get();
    if (!property || property.ownerId !== session.ownerId) throw new Error("Not found");

    await db.update(expenses).set({ status: data.status }).where(eq(expenses.id, data.id));
    return { ok: true };
  });
