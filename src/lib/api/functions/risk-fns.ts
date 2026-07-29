import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, payments, complaints, tenants, properties } from "../db/schema";
import { getSession } from "../auth";
import { getRiskModel, featuresToVector, scoreToBand, type RiskFeatures } from "../ml/risk-model";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

function monthsBetween(start: string, end: Date): number {
  const startDate = new Date(start);
  const ms = end.getTime() - startDate.getTime();
  return Math.max(ms / (1000 * 60 * 60 * 24 * 30.4), 0);
}

// Builds the model's feature vector for one tenant from real DB rows —
// no mocked inputs, this pulls the tenant's actual booking/payment/complaint
// history.
async function buildFeaturesForTenant(tenantId: string): Promise<RiskFeatures | null> {
  const booking = await db.select().from(bookings).where(eq(bookings.tenantId, tenantId)).get();
  if (!booking) return null;

  const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
  const allPayments = await db.select().from(payments).where(eq(payments.bookingId, booking.id)).all();
  const allComplaints = await db.select().from(complaints).where(eq(complaints.tenantId, tenantId)).all();

  const rentPayments = allPayments.filter((p) => p.type === "rent");
  const totalRent = rentPayments.length;

  const lateOrPending = rentPayments.filter((p) => {
    if (p.status === "failed") return true;
    if (p.status === "pending" && p.month) {
      const dueDate = new Date(`${p.month}-05`); // rent considered due by the 5th
      return new Date() > dueDate;
    }
    if (p.status === "paid" && p.paidAt && p.month) {
      const dueDate = new Date(`${p.month}-05`);
      return new Date(p.paidAt) > dueDate;
    }
    return false;
  });

  const delays = rentPayments
    .filter((p) => p.status === "paid" && p.paidAt && p.month)
    .map((p) => {
      const dueDate = new Date(`${p.month}-05`);
      const paidDate = new Date(p.paidAt as string);
      return Math.max((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24), 0);
    });

  const avgDelayDays = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  const missedPaymentCount = rentPayments.filter((p) => p.status === "failed").length;

  const unresolved = allComplaints.filter((c) => c.status === "open" || c.status === "in-progress");

  const features: RiskFeatures = {
    latePaymentRatio: totalRent > 0 ? lateOrPending.length / totalRent : 0,
    missedPaymentCount,
    avgDelayDays,
    tenureMonths: monthsBetween(booking.checkInDate, new Date()),
    depositToRentRatio: booking.monthlyRent > 0 ? booking.depositAmount / booking.monthlyRent : 0,
    complaintCount: allComplaints.length,
    unresolvedComplaintRatio: allComplaints.length > 0 ? unresolved.length / allComplaints.length : 0,
    kycVerified: tenant?.kycStatus === "verified" ? 1 : 0,
  };

  return features;
}

export const getTenantRiskScore = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ tenantId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    requireSession();
    const features = await buildFeaturesForTenant(data.tenantId);
    if (!features) return null;

    const model = getRiskModel();
    const probability = model.predictProba(featuresToVector(features));

    return {
      tenantId: data.tenantId,
      riskProbability: Math.round(probability * 1000) / 1000,
      riskBand: scoreToBand(probability),
      features,
    };
  });

// Owner-facing: risk scores for every active/confirmed tenant across their
// properties, so high-risk bookings can be flagged before move-in / renewal.
export const listTenantRiskScores = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const allBookings = await db.select().from(bookings).all();
  const relevantBookings = allBookings.filter(
    (b) => propertyIds.has(b.propertyId) && (b.status === "active" || b.status === "confirmed")
  );

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const model = getRiskModel();

  const results = await Promise.all(
    relevantBookings.map(async (booking) => {
      const features = await buildFeaturesForTenant(booking.tenantId);
      if (!features) return null;
      const probability = model.predictProba(featuresToVector(features));
      return {
        tenantId: booking.tenantId,
        tenantName: tenantMap.get(booking.tenantId)?.name ?? "Unknown",
        bookingId: booking.id,
        riskProbability: Math.round(probability * 1000) / 1000,
        riskBand: scoreToBand(probability),
      };
    })
  );

  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.riskProbability - a.riskProbability);
});
