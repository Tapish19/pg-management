export function assertRentPayable(booking: { status: string }, alreadyPaid: boolean) {
  if (!["active", "confirmed"].includes(booking.status)) throw new Error("Rent can only be paid for a confirmed or active booking");
  if (alreadyPaid) throw new Error("Rent for this month has already been paid");
}

export function assertPaymentOrder(payment: { razorpayOrderId: string | null }, orderId: string) {
  if (!payment.razorpayOrderId || payment.razorpayOrderId !== orderId) throw new Error("Payment order does not match");
}
