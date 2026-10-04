type Booking = {
  id: string;
  status: string;
  monthlyRent: number;
  checkInDate: string;
  checkOutDate: string | null;
};
type Payment = {
  bookingId: string;
  type: string;
  month: string | null;
  status: string;
  amount: number;
};

// Current-month rent due comes from bookings, not checkout attempts.
export function currentRentCollection(bookings: Booking[], payments: Payment[], month: string) {
  const due = bookings.filter(
    (booking) =>
      ["confirmed", "active", "checked_out"].includes(booking.status) &&
      booking.checkInDate.slice(0, 7) <= month &&
      (!booking.checkOutDate || booking.checkOutDate.slice(0, 7) >= month),
  );
  let invoiced = 0;
  let collected = 0;
  for (const booking of due) {
    invoiced += booking.monthlyRent;
    const paid = payments
      .filter(
        (payment) =>
          payment.bookingId === booking.id &&
          payment.type === "rent" &&
          payment.month === month &&
          payment.status === "paid",
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    collected += Math.min(booking.monthlyRent, paid);
  }
  return { invoiced, collected, rate: invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0 };
}
