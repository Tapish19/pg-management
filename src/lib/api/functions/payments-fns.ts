import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, payments, properties, tenants } from "../db/schema";
import { genId } from "../id";
import { getRazorpayClient, verifyRazorpaySignature } from "../razorpay";
import { getSession } from "../auth";

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

export const createPaymentOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        bookingId: z.string(),
        amount: z.number().positive(),
        type: z.enum(["deposit", "rent", "service"]),
        month: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const booking = await db.select().from(bookings).where(eq(bookings.id, data.bookingId)).get();
    if (!booking) throw new Error("Booking not found");

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(data.amount * 100),
      currency: "INR",
      receipt: genId("rcpt"),
    });

    const paymentId = genId("pay");
    await db.insert(payments).values({
      id: paymentId,
      bookingId: data.bookingId,
      amount: data.amount,
      type: data.type,
      month: data.month,
      status: "pending",
      razorpayOrderId: order.id,
    });

    return {
      paymentId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        paymentId: z.string(),
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const valid = verifyRazorpaySignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature);
    if (!valid) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, data.paymentId));
      throw new Error("Payment verification failed");
    }
    await db
      .update(payments)
      .set({ status: "paid", razorpayPaymentId: data.razorpay_payment_id, paidAt: new Date().toISOString() })
      .where(eq(payments.id, data.paymentId));
    return { ok: true };
  });

// Owner: list all payments across their properties, with tenant info
export const listOwnerPayments = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireSession();
  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = new Set(ownerProperties.map((p) => p.id));

  const allBookings = await db.select().from(bookings).all();
  const ownerBookings = allBookings.filter((b) => propertyIds.has(b.propertyId));
  const bookingMap = new Map(ownerBookings.map((b) => [b.id, b]));

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const allPayments = await db.select().from(payments).all();
  const relevant = allPayments.filter((p) => bookingMap.has(p.bookingId));

  return relevant.map((p) => {
    const booking = bookingMap.get(p.bookingId);
    return { ...p, tenant: booking ? tenantMap.get(booking.tenantId) : undefined };
  });
});
