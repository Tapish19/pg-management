import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  rent: z.boolean(),
  payments: z.boolean(),
  bookings: z.boolean(),
  complaints: z.boolean(),
  visitors: z.boolean(),
});
export const organizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  gstNumber: z
    .string()
    .trim()
    .max(15)
    .refine(
      (value) => !value || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(value),
      "Enter a valid GST number",
    ),
});
export const rentRulesSchema = z.object({
  dueDay: z.number().int().min(1).max(31),
  lateFeePerDay: z.number().min(0).max(10000),
  noticePeriodDays: z.number().int().min(0).max(365),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const defaultNotificationPreferences: NotificationPreferences = {
  rent: true,
  payments: true,
  bookings: true,
  complaints: true,
  visitors: true,
};
export const defaultRentRules = { dueDay: 5, lateFeePerDay: 0, noticePeriodDays: 30 };
export function parseNotificationPreferences(
  raw: string | null | undefined,
): NotificationPreferences {
  try {
    return notificationPreferencesSchema.parse({
      ...defaultNotificationPreferences,
      ...JSON.parse(raw ?? "{}"),
    });
  } catch {
    return { ...defaultNotificationPreferences };
  }
}

export function rentDueDate(month: string, dueDay: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}
