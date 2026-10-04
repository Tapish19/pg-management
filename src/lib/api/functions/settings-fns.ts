import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { owners, ownerSettings } from "../db/schema";
import { getSession } from "../auth";
import {
  organizationSchema,
  rentRulesSchema,
  notificationPreferencesSchema,
  defaultRentRules,
  parseNotificationPreferences,
} from "../../owner-settings";

export const readOwnerSettings = createServerOnlyFn(async (ownerId: string) => {
  const owner = await db.select().from(owners).where(eq(owners.id, ownerId)).get();
  if (!owner) throw new Error("Account not found");
  const saved = await db
    .select()
    .from(ownerSettings)
    .where(eq(ownerSettings.ownerId, ownerId))
    .get();
  return {
    organizationName: saved?.organizationName ?? owner.name,
    contactEmail: saved?.contactEmail ?? owner.email,
    gstNumber: saved?.gstNumber ?? "",
    dueDay: saved?.dueDay ?? defaultRentRules.dueDay,
    lateFeePerDay: saved?.lateFeePerDay ?? defaultRentRules.lateFeePerDay,
    noticePeriodDays: saved?.noticePeriodDays ?? defaultRentRules.noticePeriodDays,
    notifications: parseNotificationPreferences(saved?.notificationPreferences),
  };
});
function requireOwner() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session.ownerId;
}
export const getOwnerSettings = createServerFn({ method: "GET" }).handler(() =>
  readOwnerSettings(requireOwner()),
);

export const updateOwnerSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .discriminatedUnion("section", [
        z.object({ section: z.literal("organization"), values: organizationSchema }),
        z.object({ section: z.literal("rent"), values: rentRulesSchema }),
        z.object({ section: z.literal("notifications"), values: notificationPreferencesSchema }),
      ])
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ownerId = requireOwner();
    const current = await readOwnerSettings(ownerId);
    const update =
      data.section === "notifications"
        ? { notificationPreferences: JSON.stringify(data.values) }
        : data.values;
    const { notifications, ...base } = current;
    await db
      .insert(ownerSettings)
      .values({
        ownerId,
        ...base,
        notificationPreferences: JSON.stringify(notifications),
        ...update,
      })
      .onConflictDoUpdate({ target: ownerSettings.ownerId, set: update });
    return { ok: true };
  });
