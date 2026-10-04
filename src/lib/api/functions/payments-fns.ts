import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, payments, properties, tenants } from "../db/schema";
import { genId } from "../id";
import { getRazorpayClient, verifyRazorpaySignature } from "../razorpay";
import { getSession, getTenantSession } from "../auth";
import { assertRentPayable, assertPaymentOrder } from "../../payment-validation";

async function requireBookingAccess(booking: typeof bookings.$inferSelect) {
  const tenant = getTenantSession();
  if (tenant?.tenantId === booking.tenantId) return;
  const owner = getSession();
  const property = owner && await db.select().from(properties).where(eq(properties.id, booking.propertyId)).get();
  if (!owner || !property || property.ownerId !== owner.ownerId) throw new Error("Booking not found");
}

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
    await requireBookingAccess(booking);
    if (data.type === "rent") {
      if (!data.month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month)) throw new Error("A valid rent month is required");
      const history = await db.select().from(payments).where(eq(payments.bookingId, booking.id)).all();
      assertRentPayable(booking, history.some((p) => p.type === "rent" && p.month === data.month && p.status === "paid"));
      if (Math.round(data.amount * 100) !== Math.round(booking.monthlyRent * 100)) throw new Error("Rent amount does not match the booking");
    }

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
    const payment = await db.select().from(payments).where(eq(payments.id, data.paymentId)).get();
    if (!payment) throw new Error("Payment not found");
    const booking = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).get();
    if (!booking) throw new Error("Booking not found");
    await requireBookingAccess(booking);
    assertPaymentOrder(payment, data.razorpay_order_id);
    const valid = verifyRazorpaySignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature);
    if (!valid) {
      throw new Error("Payment verification failed");
    }
    if (payment.status === "paid") {
      if (payment.razorpayPaymentId !== data.razorpay_payment_id) throw new Error("Payment already verified with another transaction");
      return { ok: true };
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
