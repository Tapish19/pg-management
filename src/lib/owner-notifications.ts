import { rentDueDate, type NotificationPreferences } from "./owner-settings.ts";

export type OwnerNotification = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  read: boolean;
};
type Booking = {
  id: string;
  tenantId: string;
  propertyId: string;
  status: string;
  checkInDate: string;
  checkOutDate: string | null;
  createdAt: string | null;
};
type Payment = {
  id: string;
  bookingId: string;
  type: string;
  month: string | null;
  status: string;
  amount: number;
  paidAt: string | null;
  createdAt: string | null;
};
type Complaint = {
  id: string;
  propertyId: string;
  title: string;
  status: string;
  createdAt: string | null;
};
type Visitor = { id: string; propertyId: string; name: string; checkIn: string };
export function buildOwnerNotifications(
  activity: {
    propertyNames: Record<string, string>;
    bookings: Booking[];
    payments: Payment[];
    complaints: Complaint[];
    visitors: Visitor[];
  },
  preferences: NotificationPreferences,
  dueDay: number,
  now = new Date(),
): OwnerNotification[] {
  const items: OwnerNotification[] = [];
  const properties = new Set(Object.keys(activity.propertyNames));
  const bookings = activity.bookings.filter((booking) => properties.has(booking.propertyId));
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const add = (id: string, title: string, body: string, category: string, date: string | null) =>
    items.push({ id, title, body, category, createdAt: date ?? "", read: false });
  if (preferences.bookings)
    for (const booking of bookings)
      add(
        `booking:${booking.id}`,
        "Booking received",
        `${activity.propertyNames[booking.propertyId]} · ${booking.status}`,
        "booking",
        booking.createdAt,
      );
  if (preferences.payments)
    for (const payment of activity.payments) {
      const booking = bookingMap.get(payment.bookingId);
      if (booking && payment.status === "paid")
        add(
          `payment:${payment.id}`,
          "Payment received",
          `₹${payment.amount.toLocaleString("en-IN")} · ${activity.propertyNames[booking.propertyId]}`,
          "payment",
          payment.paidAt ?? payment.createdAt,
        );
    }
  if (preferences.complaints)
    for (const complaint of activity.complaints.filter((complaint) =>
      properties.has(complaint.propertyId),
    ))
      add(
        `complaint:${complaint.id}:${complaint.status}`,
        "Complaint update",
        `${complaint.title} · ${complaint.status}`,
        "complaint",
        complaint.createdAt,
      );
  if (preferences.visitors)
    for (const visitor of activity.visitors.filter((visitor) => properties.has(visitor.propertyId)))
      add(
        `visitor:${visitor.id}`,
        "Visitor check-in",
        `${visitor.name} · ${activity.propertyNames[visitor.propertyId]}`,
        "visitor",
        visitor.checkIn,
      );
  if (preferences.rent && today >= rentDueDate(month, dueDay))
    for (const booking of bookings) {
      if (
        !["active", "confirmed"].includes(booking.status) ||
        booking.checkInDate > today ||
        (booking.checkOutDate && booking.checkOutDate < today)
      )
        continue;
      if (
        activity.payments.some(
          (payment) =>
            payment.bookingId === booking.id &&
            payment.type === "rent" &&
            payment.month === month &&
            payment.status === "paid",
        )
      )
        continue;
      add(
        `rent:${booking.id}:${month}`,
        "Rent due",
        `${activity.propertyNames[booking.propertyId]} · booking ${booking.id} · ${month}`,
        "rent",
        rentDueDate(month, dueDay),
      );
    }
  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, 100);
}
