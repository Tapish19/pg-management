import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { properties, rooms, foodMenu } from "../db/schema";
import { publicListing } from "../../public-listings";
import { readOwnerSettings } from "./settings-fns";

function safeRoom(room: typeof rooms.$inferSelect) {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    sharingType: room.sharingType,
    totalBeds: room.totalBeds,
    occupiedBeds: room.occupiedBeds,
    rentPerBed: room.rentPerBed,
    depositAmount: room.depositAmount,
    status: room.status,
    amenities: room.amenities,
  };
}
export const listPublicProperties = createServerFn({ method: "GET" }).handler(async () => {
  const [allProperties, allRooms] = await Promise.all([
    db.select().from(properties).all(),
    db.select().from(rooms).all(),
  ]);
  return allProperties.map((property) =>
    publicListing(
      property,
      allRooms.filter((room) => room.propertyId === property.id).map(safeRoom),
    ),
  );
});
export const getPublicProperty = createServerFn({ method: "GET" })
  .validator((input: unknown): { id: string } => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const property = await db.select().from(properties).where(eq(properties.id, data.id)).get();
    if (!property) return null;
    const [propertyRooms, menu, settings] = await Promise.all([
      db.select().from(rooms).where(eq(rooms.propertyId, data.id)).all(),
      db.select().from(foodMenu).where(eq(foodMenu.propertyId, data.id)).all(),
      readOwnerSettings(property.ownerId),
    ]);
    return {
      property: publicListing(property, propertyRooms.map(safeRoom)),
      menu: menu.map(({ day, breakfast, lunch, dinner }) => ({ day, breakfast, lunch, dinner })),
      contactEmail: settings.contactEmail,
      noticePeriodDays: settings.noticePeriodDays,
    };
  });
