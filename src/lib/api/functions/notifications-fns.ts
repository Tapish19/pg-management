import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { bookings, complaints, payments, properties, visitors } from "../db/schema";
import { getSession } from "../auth";
import { readOwnerSettings } from "./settings-fns";
import { buildOwnerNotifications } from "../../owner-notifications";

export const getOwnerNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  const ownedProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, session.ownerId))
    .all();
  if (!ownedProperties.length) return [];
  const propertyIds = ownedProperties.map((property) => property.id);
  const [ownedBookings, ownedComplaints, ownedVisitors, settings] = await Promise.all([
    db.select().from(bookings).where(inArray(bookings.propertyId, propertyIds)).all(),
    db.select().from(complaints).where(inArray(complaints.propertyId, propertyIds)).all(),
    db.select().from(visitors).where(inArray(visitors.propertyId, propertyIds)).all(),
    readOwnerSettings(session.ownerId),
  ]);
  const ownedPayments = ownedBookings.length
    ? await db
        .select()
        .from(payments)
        .where(
          inArray(
            payments.bookingId,
            ownedBookings.map((booking) => booking.id),
          ),
        )
        .all()
    : [];
  return buildOwnerNotifications(
    {
      propertyNames: Object.fromEntries(
        ownedProperties.map((property) => [property.id, property.name]),
      ),
      bookings: ownedBookings,
      payments: ownedPayments,
      complaints: ownedComplaints,
      visitors: ownedVisitors,
    },
    settings.notifications,
    settings.dueDay,
  );
});
