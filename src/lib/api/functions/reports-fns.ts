import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, payments, properties, rooms, complaints, expenses } from "../db/schema";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

// Owner: aggregate real operational + financial stats for the reports page
export const getOwnerReports = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const ownerRooms = (await db.select().from(rooms).all()).filter((r) => propertyIds.has(r.propertyId));
  const totalBeds = ownerRooms.reduce((s, r) => s + r.totalBeds, 0);
  const occupiedBeds = ownerRooms.reduce((s, r) => s + r.occupiedBeds, 0);
  const occupancyByProperty = ownerProperties.map((p) => {
    const propRooms = ownerRooms.filter((r) => r.propertyId === p.id);
    return {
      name: p.name,
      total: propRooms.reduce((s, r) => s + r.totalBeds, 0),
      occupied: propRooms.reduce((s, r) => s + r.occupiedBeds, 0),
    };
  });

  const ownerBookings = (await db.select().from(bookings).all()).filter((b) => propertyIds.has(b.propertyId));
  const bookingIds = new Set(ownerBookings.map((b) => b.id));
  const funnelOrder = ["pending", "confirmed", "active", "checked_out", "cancelled"] as const;
  const bookingFunnel = funnelOrder.map((stage) => ({
    stage,
    count: ownerBookings.filter((b) => b.status === stage).length,
  }));

  const ownerPayments = (await db.select().from(payments).all()).filter((p) => bookingIds.has(p.bookingId));
  const paidPayments = ownerPayments.filter((p) => p.status === "paid");
  const totalRevenue = paidPayments.reduce((s, p) => s + p.amount, 0);
  const totalInvoiced = ownerPayments.reduce((s, p) => s + p.amount, 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;

  // Group revenue + expense by month (yyyy-mm)
  const ownerExpenses = (await db.select().from(expenses).all()).filter((e) => propertyIds.has(e.propertyId));
  const monthKey = (d: string | null | undefined) => (d ? d.slice(0, 7) : "unknown");
  const monthMap = new Map<string, { month: string; revenue: number; expense: number }>();
  for (const p of paidPayments) {
    const key = monthKey(p.month || p.paidAt || p.createdAt);
    const row = monthMap.get(key) || { month: key, revenue: 0, expense: 0 };
    row.revenue += p.amount;
    monthMap.set(key, row);
  }
  for (const e of ownerExpenses) {
    const key = monthKey(e.date);
    const row = monthMap.get(key) || { month: key, revenue: 0, expense: 0 };
    row.expense += e.amount;
    monthMap.set(key, row);
  }
  const revenueTrend = Array.from(monthMap.values())
    .filter((r) => r.month !== "unknown")
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  const ownerComplaints = (await db.select().from(complaints).all()).filter((c) => propertyIds.has(c.propertyId));
  const resolvedComplaints = ownerComplaints.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const openComplaints = ownerComplaints.length - resolvedComplaints;

  return {
    totalRevenue,
    totalInvoiced,
    collectionRate,
    avgOccupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    resolvedComplaints,
    openComplaints,
    occupancyByProperty,
    bookingFunnel,
    revenueTrend,
  };
});
