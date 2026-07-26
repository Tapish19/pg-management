import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { owners } from "../db/schema";
import { genId } from "../id";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
} from "../auth";

export const signup = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        phone: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const existing = await db.select().from(owners).where(eq(owners.email, data.email)).get();
    if (existing) {
      throw new Error("An account with this email already exists");
    }
    const id = genId("owner");
    const passwordHash = await hashPassword(data.password);
    await db.insert(owners).values({ id, name: data.name, email: data.email, passwordHash, phone: data.phone });

    const token = createSessionToken({ ownerId: id, email: data.email, name: data.name });
    setSessionCookie(token);

    return { id, name: data.name, email: data.email };
  });

export const login = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const owner = await db.select().from(owners).where(eq(owners.email, data.email)).get();
    if (!owner) throw new Error("Invalid email or password");

    const valid = await verifyPassword(data.password, owner.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    const token = createSessionToken({ ownerId: owner.id, email: owner.email, name: owner.name });
    setSessionCookie(token);

    return { id: owner.id, name: owner.name, email: owner.email };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  clearSessionCookie();
  return { ok: true };
});

export const getCurrentSession = createServerFn({ method: "GET" }).handler(async () => {
  return getSession();
});
