import * as D from "./demo-data";
import type * as S from "./api/db/schema";
import { occupancyAfterStatusChange, hasVacantBed } from "./room-availability";
import { currentRentCollection } from "./collection-rate";
import { noticeVisibleToRoom } from "./notice-audience";
import { attendanceSummary } from "./staff-attendance";
import { z } from "zod";
import { buildOwnerNotifications } from "./owner-notifications";
import { defaultNotificationPreferences, parseNotificationPreferences } from "./owner-settings";

export const DEMO_SESSION_KEY = "pgone.session.v1";
const DATA_KEY = "pgone.demo.data.v1";
type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];
type State = {
  properties: Row<typeof S.properties>[];
  rooms: Row<typeof S.rooms>[];
  tenants: Row<typeof S.tenants>[];
  bookings: Row<typeof S.bookings>[];
  staff: Row<typeof S.staff>[];
  complaints: Row<typeof S.complaints>[];
  visitors: Row<typeof S.visitors>[];
  notices: Row<typeof S.notices>[];
  expenses: Row<typeof S.expenses>[];
  menu: Row<typeof S.foodMenu>[];
  payments: Row<typeof S.payments>[];
  attendance: Row<typeof S.staffAttendance>[];
  profiles: Record<string, D.DemoUser>;
  preferences: Record<string, Record<string, unknown>>;
  comments: Record<string, string[]>;
};
const timestamp = () => new Date().toISOString();
const id = () => `demo-${crypto.randomUUID()}`;
export function demoRole(): D.Role | null {
  if (typeof window === "undefined") return null;
  try {
    const role = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) ?? "null")?.role;
    return ["admin", "staff", "tenant"].includes(role) ? role : null;
  } catch {
    return null;
  }
}
function freshState(): State {
  const createdAt = timestamp();
  const properties = D.PROPERTIES.map((p) => ({
    id: p.id,
    ownerId: "u-admin",
    name: p.name,
    city: p.city,
    locality: p.area,
    address: p.address,
    description: "Furnished PG with weekly meals and a welcoming community.",
    genderType: p.gender,
    amenities: JSON.stringify(p.amenities),
    images: JSON.stringify([p.image]),
    createdAt,
  }));
  const rooms = D.ROOMS.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    roomNumber: r.number,
    sharingType: ["", "single", "double", "triple", "dormitory"][r.sharing],
    totalBeds: r.bedsTotal,
    occupiedBeds: 0,
    rentPerBed: r.rent,
    depositAmount: r.deposit,
    amenities: JSON.stringify(["Wi-Fi", "Wardrobe", ...(r.ac ? ["AC"] : [])]),
    images: "[]",
    status: r.status === "maintenance" ? "maintenance" : "available",
    createdAt,
  }));
  // The other properties also need usable rooms, not just marketing cards.
  for (const p of properties.slice(1))
    for (const r of D.ROOMS.slice(0, 4))
      rooms.push({ ...rooms.find((x) => x.id === r.id)!, id: `${p.id}-${r.id}`, propertyId: p.id });
  const tenants = D.TENANTS.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone,
    kycStatus: t.kyc,
    emergencyContact: t.guardian,
    idProofType: t.kyc === "verified" ? "sample ID" : null,
    idProofNumber: t.kyc === "verified" ? "DEMO-ONLY" : null,
    createdAt,
  }));
  const bookings = D.TENANTS.map((t) => ({
    id: `stay-${t.id}`,
    propertyId: t.propertyId,
    roomId: t.roomId,
    tenantId: t.id,
    checkInDate: t.moveIn,
    checkOutDate: null,
    monthlyRent: t.rent,
    depositAmount: t.deposit,
    status: "active",
    createdAt,
  }));
  for (const b of D.BOOKINGS) {
    const room = rooms.find(
      (r) =>
        r.propertyId === b.propertyId &&
        r.roomNumber === D.ROOMS.find((x) => x.id === b.roomId)?.number,
    )!;
    const tenantId = `applicant-${b.id}`;
    tenants.push({
      id: tenantId,
      name: b.tenantName,
      email: `${tenantId}@example.invalid`,
      phone: "0000000000",
      kycStatus: "pending",
      emergencyContact: "",
      idProofType: null,
      idProofNumber: null,
      createdAt,
    });
    bookings.push({
      id: b.id,
      propertyId: b.propertyId,
      roomId: room.id,
      tenantId,
      checkInDate: b.moveIn,
      checkOutDate: null,
      monthlyRent: room.rentPerBed,
      depositAmount: room.depositAmount,
      status:
        (
          {
            approved: "confirmed",
            "checked-in": "active",
            "checked-out": "checked_out",
            rejected: "cancelled",
          } as Record<string, string>
        )[b.status] ?? b.status,
      createdAt,
    });
  }
  for (const room of rooms) {
    room.occupiedBeds = bookings.filter(
      (b) => b.roomId === room.id && ["active", "confirmed"].includes(b.status),
    ).length;
    if (room.status !== "maintenance")
      room.status = room.occupiedBeds >= room.totalBeds ? "full" : "available";
  }
  const payments: State["payments"] = [];
  for (const booking of bookings.filter((b) => b.status === "active"))
    for (let offset = -5; offset <= 0; offset++) {
      const date = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + offset, 1),
      ).toISOString();
      const paid = offset < 0 || booking.tenantId !== "u-tenant";
      payments.push({
        id: `rent-${booking.id}-${date.slice(0, 7)}`,
        bookingId: booking.id,
        amount: booking.monthlyRent,
        type: "rent",
        month: date.slice(0, 7),
        status: paid ? "paid" : "pending",
        paidAt: paid ? date : null,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        createdAt: date,
      });
    }
  const staff = D.STAFF.map((t) => ({ ...t, createdAt }));
  const complaints = D.COMPLAINTS.map((c) => ({
    id: c.id,
    propertyId: c.propertyId,
    tenantId: tenants.find((t) => t.name === c.tenantName)?.id ?? null,
    roomNumber: c.roomNumber,
    title: c.title,
    category: c.category,
    priority: c.priority,
    status: c.status,
    assignedTo: staff.find((t) => t.name === c.assignedTo)?.id ?? "u-staff",
    createdAt,
  }));
  return {
    properties,
    rooms,
    tenants,
    bookings,
    staff,
    complaints,
    payments,
    visitors: D.VISITORS.map((v) => ({
      id: v.id,
      name: v.name,
      propertyId: "p1",
      tenantId: tenants.find((t) => t.name === v.tenantName)?.id ?? null,
      purpose: v.purpose,
      checkIn: createdAt,
      checkOut: v.checkOut ? createdAt : null,
      idVerified: v.idVerified,
      createdAt,
    })),
    notices: D.NOTICES.map((n) => ({
      id: n.id,
      propertyId: "p1",
      title: n.title,
      body: n.body,
      audience: "All tenants",
      postedBy: n.postedBy,
      createdAt,
    })),
    expenses: D.EXPENSES.map((e) => ({ ...e, date: createdAt.slice(0, 10), createdAt })),
    menu: properties.flatMap((p) =>
      D.FOOD_MENU.map((m) => ({ ...m, propertyId: p.id, id: `menu-${p.id}-${m.day}` })),
    ),
    attendance: staff.map((member) => ({
      staffId: member.id,
      date: createdAt.slice(0, 10),
      status: "present",
    })),
    profiles: structuredClone(D.DEMO_USERS),
    preferences: {},
    comments: {},
  };
}
function read(): State {
  const raw = localStorage.getItem(DATA_KEY);
  if (raw) return JSON.parse(raw) as State;
  const state = freshState();
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
  return state;
}
export function demoProfile(role: D.Role): D.DemoUser {
  return read().profiles[role];
}
export function demoCall(name: string, input: unknown = {}): unknown {
  const role = demoRole();
  if (!role) throw new Error("Choose a demo role first");
  const s = read(),
    data = (input ?? {}) as Record<string, unknown>;
  const text = (key: string) => String(data[key] ?? "");
  const number = (key: string) => Number(data[key] ?? 0);
  const user = s.profiles[role];
  const tenantOnly = [
    "getMyBooking",
    "getMyComplaints",
    "getMyVisitors",
    "getMyFoodMenu",
    "getMyNotices",
    "getMyPayments",
    "getMyPreferences",
    "saveMyPreferences",
    "getMyRoommateMatches",
    "getMyKyc",
    "createMyComplaint",
    "createMyVisitor",
    "askAssistantFn",
    "createPaymentOrder",
    "verifyPayment",
  ];
  const ownerOnly =
    /^(createProperty|updateProperty|deleteProperty|createRoom|updateRoom|deleteRoom|onboardTenant|updateTenantKyc|createStaff|updateStaff|updateStaffStatus|deleteStaff|recordStaffAttendance|listStaffAttendance|createExpense|updateExpenseStatus|deleteNotice|listOwnerPayments|getOwnerReports|getOwnerRoomMatches|listTenantRiskScores|getTenantRiskScore)$/;
  if (
    (tenantOnly.includes(name) && role !== "tenant") ||
    (ownerOnly.test(name) && role !== "admin") ||
    (role === "tenant" && !tenantOnly.includes(name) && name !== "saveProfile")
  )
    throw new Error("This action is not available for your demo role");
  const visible = (propertyId: string) => role === "admin" || propertyId === user.propertyId;
  const property = (propertyId: string) => {
    const p = s.properties.find((p) => p.id === propertyId && visible(p.id));
    if (!p) throw new Error("Property not found");
    return p;
  };
  const room = (roomId: string) => {
    const r = s.rooms.find((r) => r.id === roomId);
    if (!r) throw new Error("Room not found");
    property(r.propertyId);
    return r;
  };
  const myBooking = () =>
    s.bookings.find((b) => b.tenantId === user.id && ["active", "confirmed"].includes(b.status))!;
  const joined = (b: State["bookings"][number]) => ({
    ...b,
    tenant: s.tenants.find((t) => t.id === b.tenantId),
    property: s.properties.find((p) => p.id === b.propertyId),
    room: s.rooms.find((r) => r.id === b.roomId),
  });
  const save = (result: unknown = { ok: true }) => {
    localStorage.setItem(DATA_KEY, JSON.stringify(s));
    return result;
  };
  const preferences = {
    sleepSchedule: "early_bird",
    cleanliness: 4,
    noiseTolerance: 3,
    socialLevel: 3,
    foodHabit: "veg",
    smoking: false,
    guestsFrequency: "occasional",
    workSchedule: "office",
    ...(s.preferences[user.id] ?? {}),
  };
  switch (name) {
    case "getTaskComments":
      return s.comments[text("id")] ?? [];
    case "addTaskComment": {
      const c = s.complaints.find((c) => c.id === text("id"));
      if (!c) throw new Error("Task not found");
      property(c.propertyId);
      s.comments[c.id] = [...(s.comments[c.id] ?? []), `${user.name}: ${text("comment")}`];
      return save();
    }
    case "getOwnerNotifications": {
      let settings = { notifications: defaultNotificationPreferences, dueDay: 5 };
      try {
        settings = {
          ...settings,
          ...JSON.parse(localStorage.getItem("pgone.demo.settings.v1.u-admin") ?? "{}"),
        };
      } catch {}
      return buildOwnerNotifications(
        {
          propertyNames: Object.fromEntries(
            s.properties.filter((p) => visible(p.id)).map((p) => [p.id, p.name]),
          ),
          bookings: s.bookings,
          payments: s.payments,
          complaints: s.complaints,
          visitors: s.visitors,
        },
        parseNotificationPreferences(JSON.stringify(settings.notifications)),
        settings.dueDay,
      );
    }
    case "listOwnerProperties":
    case "listProperties":
      return s.properties
        .filter((p) => visible(p.id))
        .map((p) => {
          const rs = s.rooms.filter((r) => r.propertyId === p.id);
          return {
            ...p,
            amenities: JSON.parse(p.amenities ?? "[]"),
            roomCount: rs.length,
            totalBeds: rs.reduce((n, r) => n + r.totalBeds, 0),
            occupiedBeds: rs.reduce((n, r) => n + r.occupiedBeds, 0),
            availableBeds: rs.reduce(
              (n, r) => n + (hasVacantBed(r) ? r.totalBeds - r.occupiedBeds : 0),
              0,
            ),
            minRent: rs.length ? Math.min(...rs.map((r) => r.rentPerBed)) : null,
          };
        });
    case "listOwnerRooms":
      return s.rooms.filter((r) => visible(r.propertyId));
    case "listRooms":
      property(text("propertyId"));
      return s.rooms
        .filter((r) => r.propertyId === text("propertyId"))
        .map((r) => ({ ...r, amenities: JSON.parse(r.amenities ?? "[]") }));
    case "getProperty":
      return {
        ...property(text("id")),
        amenities: JSON.parse(property(text("id")).amenities ?? "[]"),
        rooms: s.rooms.filter((r) => r.propertyId === text("id")),
      };
    case "listOwnerBookings":
      return s.bookings.filter((b) => visible(b.propertyId)).map(joined);
    case "listOwnerTenants":
      return s.bookings
        .filter((b) => visible(b.propertyId))
        .map((b) => ({
          booking: b,
          tenant: joined(b).tenant,
          property: joined(b).property,
          room: joined(b).room,
        }));
    case "listOwnerComplaints":
      return s.complaints
        .filter((c) => visible(c.propertyId))
        .map((c) => ({
          ...c,
          tenantName: s.tenants.find((t) => t.id === c.tenantId)?.name,
          assignedToName: s.staff.find((t) => t.id === c.assignedTo)?.name,
          propertyName: property(c.propertyId).name,
        }));
    case "listOwnerVisitors":
      return s.visitors
        .filter((v) => visible(v.propertyId))
        .map((v) => ({ ...v, tenantName: s.tenants.find((t) => t.id === v.tenantId)?.name }));
    case "listOwnerStaff":
      return s.staff
        .filter((t) => visible(t.propertyId))
        .map((t) => ({
          ...t,
          propertyName: property(t.propertyId).name,
          attendance: attendanceSummary(
            s.attendance.filter((a) => a.staffId === t.id),
            timestamp().slice(0, 7),
          ).percentage,
          attendanceDays: s.attendance.filter((a) => a.staffId === t.id).length,
        }));
    case "listOwnerNotices":
      return s.notices
        .filter((n) => visible(n.propertyId))
        .map((n) => ({ ...n, propertyName: property(n.propertyId).name }));
    case "listOwnerExpenses":
      return s.expenses
        .filter((e) => visible(e.propertyId))
        .map((e) => ({ ...e, propertyName: property(e.propertyId).name }));
    case "listOwnerPayments":
      return s.payments.map((p) => ({
        ...p,
        tenant: s.tenants.find(
          (t) => t.id === s.bookings.find((b) => b.id === p.bookingId)?.tenantId,
        ),
      }));
    case "getFoodMenu":
      property(text("propertyId"));
      return s.menu.filter((m) => m.propertyId === text("propertyId"));
    case "getMyBooking": {
      const b = myBooking();
      const detail = joined(b);
      let policy = {
        organizationName: "PG One Demo",
        contactEmail: "admin@pgone.demo",
        dueDay: 5,
        lateFeePerDay: 0,
        noticePeriodDays: 30,
      };
      try {
        policy = {
          ...policy,
          ...JSON.parse(localStorage.getItem("pgone.demo.settings.v1.u-admin") ?? "{}"),
        };
      } catch {}
      return {
        booking: b,
        room: detail.room,
        tenant: detail.tenant,
        property: detail.property,
        policy,
      };
    }
    case "getMyComplaints":
      return s.complaints.filter((c) => c.tenantId === user.id);
    case "getMyVisitors":
      return s.visitors.filter((v) => v.tenantId === user.id);
    case "getMyFoodMenu":
      return s.menu.filter((m) => m.propertyId === myBooking().propertyId);
    case "getMyNotices":
      return s.notices.filter(
        (n) =>
          n.propertyId === myBooking().propertyId &&
          noticeVisibleToRoom(n.audience, room(myBooking().roomId).roomNumber),
      );
    case "getMyPayments":
      return s.payments
        .filter((p) => s.bookings.some((b) => b.id === p.bookingId && b.tenantId === user.id))
        .map((p) => ({ ...p, booking: s.bookings.find((b) => b.id === p.bookingId) }));
    case "getMyKyc":
      return {
        status: s.tenants.find((t) => t.id === user.id)?.kycStatus ?? "pending",
        proofType: "Sample ID",
        hasProofDetails: true,
      };
    case "getMyPreferences":
      return { ...preferences, id: `prefs-${user.id}`, tenantId: user.id, updatedAt: timestamp() };
    case "saveMyPreferences":
      s.preferences[user.id] = data;
      return save({ id: `prefs-${user.id}` });
    case "getMyRoommateMatches":
      return {
        myPrefs: preferences,
        matches: s.bookings
          .filter(
            (b) =>
              b.roomId === myBooking().roomId && b.tenantId !== user.id && b.status === "active",
          )
          .map((b) => ({
            tenant: s.tenants.find((t) => t.id === b.tenantId),
            score: 82,
            breakdown: [{ label: "Demo lifestyle match", score: 82, weight: 1 }],
          })),
      };
    case "getOwnerRoomMatches":
      return s.rooms
        .filter(hasVacantBed)
        .map((r) => ({
          room: {
            id: r.id,
            roomNumber: r.roomNumber,
            sharingType: r.sharingType,
            vacantBeds: r.totalBeds - r.occupiedBeds,
          },
          propertyName: property(r.propertyId).name,
          occupants: s.bookings
            .filter((b) => b.roomId === r.id && ["active", "confirmed"].includes(b.status))
            .map((b) => ({ tenant: s.tenants.find((t) => t.id === b.tenantId), hasPrefs: true })),
          suggestedCandidates: s.bookings
            .filter((b) => b.status === "pending")
            .map((b) => ({ tenant: s.tenants.find((t) => t.id === b.tenantId), score: 82 })),
        }));
    case "listTenantRiskScores":
      return s.bookings.map((b, i) => ({
        tenantId: b.tenantId,
        tenantName: s.tenants.find((t) => t.id === b.tenantId)?.name,
        bookingId: b.id,
        riskProbability: ((i % 3) + 1) / 10,
        riskBand: i % 3 === 2 ? "medium" : "low",
      }));
    case "getOwnerReports": {
      const collection = currentRentCollection(s.bookings, s.payments, timestamp().slice(0, 7));
      const months = [...new Set(s.payments.map((p) => p.month!))].sort();
      return {
        totalRevenue: s.payments
          .filter((p) => p.status === "paid")
          .reduce((n, p) => n + p.amount, 0),
        totalInvoiced: collection.invoiced,
        collectionRate: collection.rate,
        avgOccupancyPct: Math.round(
          (100 * s.rooms.reduce((n, r) => n + r.occupiedBeds, 0)) /
            s.rooms.reduce((n, r) => n + r.totalBeds, 0),
        ),
        resolvedComplaints: s.complaints.filter((c) => ["resolved", "closed"].includes(c.status))
          .length,
        openComplaints: s.complaints.filter((c) => !["resolved", "closed"].includes(c.status))
          .length,
        occupancyByProperty: s.properties.map((p) => ({
          name: p.name,
          total: s.rooms.filter((r) => r.propertyId === p.id).reduce((n, r) => n + r.totalBeds, 0),
          occupied: s.rooms
            .filter((r) => r.propertyId === p.id)
            .reduce((n, r) => n + r.occupiedBeds, 0),
        })),
        bookingFunnel: ["pending", "confirmed", "active", "checked_out", "cancelled"].map(
          (stage) => ({ stage, count: s.bookings.filter((b) => b.status === stage).length }),
        ),
        revenueTrend: months.map((month) => ({
          month,
          revenue: s.payments
            .filter((p) => p.month === month && p.status === "paid")
            .reduce((n, p) => n + p.amount, 0),
          expense: s.expenses
            .filter((e) => e.date.startsWith(month) && e.status === "approved")
            .reduce((n, e) => n + e.amount, 0),
        })),
      };
    }
    case "saveProfile": {
      const details = z
        .object({
          name: z.string().trim().min(2),
          email: z.string().email(),
          phone: z.string().min(6),
        })
        .parse(data);
      s.profiles[role] = { ...user, ...details };
      const tenant = s.tenants.find((t) => t.id === user.id);
      if (tenant) Object.assign(tenant, details);
      const member = s.staff.find((t) => t.id === user.id);
      if (member) Object.assign(member, details);
      return save(details);
    }
    case "createMyComplaint":
    case "createComplaint": {
      const propertyId = name === "createMyComplaint" ? myBooking().propertyId : text("propertyId");
      property(propertyId);
      const complaintId = id();
      s.complaints.push({
        id: complaintId,
        propertyId,
        tenantId: name === "createMyComplaint" ? user.id : text("tenantId") || null,
        roomNumber:
          name === "createMyComplaint" ? room(myBooking().roomId).roomNumber : text("roomNumber"),
        title: text("title"),
        category: text("category") || "other",
        priority: text("priority") || "medium",
        status: "open",
        assignedTo: "u-staff",
        createdAt: timestamp(),
      });
      return save({ id: complaintId });
    }
    case "updateComplaint": {
      const c = s.complaints.find((c) => c.id === text("id"));
      if (!c) throw new Error("Complaint not found");
      property(c.propertyId);
      if (data.status) c.status = text("status");
      if (data.assignedTo) c.assignedTo = text("assignedTo");
      return save();
    }
    case "createMyVisitor":
    case "createVisitor": {
      const propertyId = name === "createMyVisitor" ? myBooking().propertyId : text("propertyId");
      property(propertyId);
      const visitorId = id();
      s.visitors.push({
        id: visitorId,
        propertyId,
        tenantId: name === "createMyVisitor" ? user.id : text("tenantId") || null,
        name: text("name"),
        purpose: text("purpose"),
        checkIn: text("checkIn") || timestamp(),
        checkOut: null,
        idVerified: data.idVerified === true,
        createdAt: timestamp(),
      });
      return save({ id: visitorId });
    }
    case "checkOutVisitor": {
      const v = s.visitors.find((v) => v.id === text("id"));
      if (!v) throw new Error("Visitor not found");
      property(v.propertyId);
      v.checkOut = text("checkOut") || timestamp();
      return save();
    }
    case "createNotice": {
      const propertyId = text("propertyId");
      property(propertyId);
      const noticeId = id();
      s.notices.push({
        id: noticeId,
        propertyId,
        title: text("title"),
        body: text("body"),
        audience: text("audience") || "All tenants",
        postedBy: user.name,
        createdAt: timestamp(),
      });
      return save({ id: noticeId });
    }
    case "deleteNotice":
      s.notices = s.notices.filter((n) => n.id !== text("id"));
      return save();
    case "updateFoodMenuDay": {
      const m = s.menu.find((m) => m.id === text("id"));
      if (!m) throw new Error("Menu not found");
      property(m.propertyId);
      Object.assign(m, {
        breakfast: text("breakfast"),
        lunch: text("lunch"),
        dinner: text("dinner"),
      });
      return save();
    }
    case "updateBookingStatus": {
      const b = s.bookings.find((b) => b.id === text("id"));
      if (!b) throw new Error("Booking not found");
      const r = room(b.roomId);
      const change = occupancyAfterStatusChange(r, b.status, text("status"));
      Object.assign(r, change);
      b.status = text("status");
      return save();
    }
    case "updateTenantKyc": {
      const t = s.tenants.find((t) => t.id === text("id"));
      if (!t) throw new Error("Tenant not found");
      t.kycStatus = text("kycStatus");
      return save();
    }
    case "createProperty": {
      const propertyId = id();
      s.properties.push({
        id: propertyId,
        ownerId: "u-admin",
        name: text("name"),
        city: text("city"),
        locality: text("locality"),
        address: text("address"),
        description: text("description"),
        genderType: text("genderType"),
        amenities: JSON.stringify(data.amenities ?? []),
        images: "[]",
        createdAt: timestamp(),
      });
      return save({ id: propertyId });
    }
    case "updateProperty": {
      const p = property(text("id"));
      Object.assign(p, data, {
        amenities: JSON.stringify(data.amenities ?? JSON.parse(p.amenities ?? "[]")),
      });
      return save();
    }
    case "createRoom": {
      property(text("propertyId"));
      const roomId = id();
      s.rooms.push({
        id: roomId,
        propertyId: text("propertyId"),
        roomNumber: text("roomNumber"),
        sharingType: text("sharingType"),
        totalBeds: number("totalBeds"),
        occupiedBeds: 0,
        rentPerBed: number("rentPerBed"),
        depositAmount: number("depositAmount"),
        status: "available",
        amenities: "[]",
        images: "[]",
        createdAt: timestamp(),
      });
      return save({ id: roomId });
    }
    case "updateRoom": {
      const r = room(text("id"));
      if (data.totalBeds !== undefined && number("totalBeds") < r.occupiedBeds)
        throw new Error("Capacity cannot be less than occupied beds");
      Object.assign(r, data);
      if (data.amenities) r.amenities = JSON.stringify(data.amenities);
      if (data.images) r.images = JSON.stringify(data.images);
      if (r.status !== "maintenance")
        r.status = r.occupiedBeds >= r.totalBeds ? "full" : "available";
      return save();
    }
    case "deleteRoom": {
      const r = room(text("id"));
      if (s.bookings.some((b) => b.roomId === r.id))
        throw new Error("This room has booking history");
      s.rooms = s.rooms.filter((x) => x.id !== r.id);
      return save();
    }
    case "deleteProperty": {
      property(text("id"));
      if (s.rooms.some((r) => r.propertyId === text("id")))
        throw new Error("Remove empty rooms before deleting this property");
      s.properties = s.properties.filter((p) => p.id !== text("id"));
      return save();
    }
    case "onboardTenant": {
      const r = room(text("roomId"));
      if (!hasVacantBed(r)) throw new Error("No vacant beds");
      const tenantId = id(),
        bookingId = id();
      s.tenants.push({
        id: tenantId,
        name: text("name"),
        email: text("email"),
        phone: text("phone"),
        idProofType: text("idProofType"),
        idProofNumber: text("idProofNumber"),
        emergencyContact: text("emergencyContact"),
        kycStatus: "pending",
        createdAt: timestamp(),
      });
      s.bookings.push({
        id: bookingId,
        propertyId: r.propertyId,
        roomId: r.id,
        tenantId,
        checkInDate: text("moveIn"),
        checkOutDate: null,
        monthlyRent: r.rentPerBed,
        depositAmount: r.depositAmount,
        status: "active",
        createdAt: timestamp(),
      });
      s.tenants[s.tenants.length - 1].kycStatus = text("kycStatus") || "pending";
      r.occupiedBeds++;
      r.status = r.occupiedBeds >= r.totalBeds ? "full" : "available";
      return save({ id: tenantId, bookingId });
    }
    case "createStaff": {
      property(text("propertyId"));
      const staffId = id();
      s.staff.push({
        id: staffId,
        propertyId: text("propertyId"),
        name: text("name"),
        role: text("role"),
        phone: text("phone"),
        salary: number("salary"),
        shift: text("shift") || "morning",
        status: "active",
        attendance: 100,
        createdAt: timestamp(),
      });
      return save({ id: staffId });
    }
    case "updateStaff":
    case "updateStaffStatus": {
      const member = s.staff.find((t) => t.id === text("id"));
      if (!member) throw new Error("Staff not found");
      Object.assign(member, data);
      return save();
    }
    case "deleteStaff":
      s.staff = s.staff.filter((t) => t.id !== text("id"));
      s.attendance = s.attendance.filter((a) => a.staffId !== text("id"));
      return save();
    case "listStaffAttendance":
      return s.attendance.filter((a) => a.staffId === text("staffId"));
    case "recordStaffAttendance":
      s.attendance = s.attendance.filter(
        (a) => !(a.staffId === text("staffId") && a.date === text("date")),
      );
      s.attendance.push({ staffId: text("staffId"), date: text("date"), status: text("status") });
      return save();
    case "createExpense": {
      property(text("propertyId"));
      const expenseId = id();
      s.expenses.push({
        id: expenseId,
        propertyId: text("propertyId"),
        vendor: text("vendor"),
        date: text("date"),
        category: text("category"),
        amount: number("amount"),
        status: "pending",
        createdAt: timestamp(),
      });
      return save({ id: expenseId });
    }
    case "updateExpenseStatus": {
      const e = s.expenses.find((e) => e.id === text("id"));
      if (!e) throw new Error("Expense not found");
      e.status = text("status");
      return save();
    }
    case "createPaymentOrder": {
      const b = myBooking();
      if (b.id !== text("bookingId")) throw new Error("Booking not found");
      const p = s.payments.find((p) => p.bookingId === b.id && p.month === text("month"));
      if (!p || p.status === "paid") throw new Error("No outstanding rent");
      return {
        orderId: `demo-order-${p.id}`,
        paymentId: p.id,
        amount: p.amount * 100,
        currency: "INR",
        keyId: "demo",
      };
    }
    case "verifyPayment": {
      const p = s.payments.find(
        (p) => p.id === text("paymentId") && p.bookingId === myBooking().id,
      );
      if (!p) throw new Error("Payment not found");
      p.status = "paid";
      p.paidAt = timestamp();
      return save();
    }
    case "askAssistantFn": {
      const q = text("question").toLowerCase();
      const b = myBooking();
      const menu = s.menu.find(
        (m) =>
          m.propertyId === b.propertyId &&
          m.day === new Date().toLocaleDateString("en-US", { weekday: "long" }),
      );
      const answer = /food|menu|breakfast|dinner|lunch/.test(q)
        ? `Today's menu: ${menu?.breakfast}; ${menu?.lunch}; ${menu?.dinner}.`
        : /rent|fee|deposit/.test(q)
          ? `Your monthly rent is ₹${b.monthlyRent.toLocaleString("en-IN")} and deposit is ₹${b.depositAmount.toLocaleString("en-IN")}. Pay Rent offers a simulated payment in demo mode.`
          : /wifi|amenit|room/.test(q)
            ? `Your room ${room(b.roomId).roomNumber} includes ${JSON.parse(room(b.roomId).amenities ?? "[]").join(", ")}.`
            : "I can help with your demo room, rent and food menu. For another question, send a ticket to staff.";
      return {
        answer,
        resolved: /food|menu|breakfast|dinner|lunch|rent|fee|deposit|wifi|amenit|room/.test(q),
        sources: ["Demo property records"],
      };
    }
    default:
      throw new Error(`Demo action ${name} is not supported`);
  }
}

export function withDemo<T extends (...args: never[]) => unknown>(name: string, real: T): T {
  return ((...args: unknown[]) => {
    if (!demoRole()) return (real as unknown as (...args: unknown[]) => unknown)(...args);
    try {
      return Promise.resolve(demoCall(name, (args[0] as { data?: unknown } | undefined)?.data));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as unknown as T;
}

export const demoPages: Record<D.Role, string[]> = {
  admin: [
    "/dashboard",
    "/properties",
    "/rooms",
    "/bookings",
    "/tenants",
    "/matching",
    "/payments",
    "/staff",
    "/food",
    "/expenses",
    "/complaints",
    "/visitors",
    "/notices",
    "/reports",
    "/settings",
    "/profile",
    "/notifications",
  ],
  staff: [
    "/dashboard",
    "/tasks",
    "/complaints",
    "/visitors",
    "/bookings",
    "/food",
    "/notices",
    "/profile",
    "/notifications",
  ],
  tenant: [
    "/dashboard",
    "/my-room",
    "/my-assistant",
    "/pay-rent",
    "/my-food",
    "/my-complaints",
    "/my-visitors",
    "/notifications",
    "/profile",
  ],
};
