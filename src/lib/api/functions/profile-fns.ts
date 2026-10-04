import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { db } from "../db";
import { owners, tenants } from "../db/schema";
import { getSession, getTenantSession, createSessionToken, createTenantSessionToken, setSessionCookie, setTenantSessionCookie } from "../auth";

export const saveProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, "Enter a valid phone number"),
  }).parse(input))
  .handler(async ({ data }) => {
    const owner = getSession();
    if (owner) {
      const existing = await db.select().from(owners).where(eq(owners.id, owner.ownerId)).get();
      if (!existing) throw new Error("Account not found");
      const duplicate = await db.select().from(owners).where(and(eq(owners.email, data.email), ne(owners.id, owner.ownerId))).get();
      if (duplicate) throw new Error("An account with this email already exists");
      await db.update(owners).set(data).where(eq(owners.id, owner.ownerId));
      setSessionCookie(createSessionToken({ ownerId: owner.ownerId, name: data.name, email: data.email }));
      return data;
    }
    const tenant = getTenantSession();
    if (!tenant) throw new Error("Please log in first");
    if (data.phone.length < 6 || !data.phone.replace(/\D/g, "")) throw new Error("Enter a phone number with at least 6 characters for resident login");
    const existing = await db.select().from(tenants).where(eq(tenants.id, tenant.tenantId)).get();
    if (!existing) throw new Error("Account not found");
    const residents = await db.select().from(tenants).all();
    const duplicate = residents.find((resident) => resident.id !== tenant.tenantId && resident.email.trim().toLowerCase() === data.email.toLowerCase() && resident.phone.trim() === data.phone);
    if (duplicate) throw new Error("Another resident already uses this email and phone");
    await db.update(tenants).set(data).where(eq(tenants.id, tenant.tenantId));
    setTenantSessionCookie(createTenantSessionToken({ tenantId: tenant.tenantId, name: data.name, email: data.email }));
    return data;
  });
