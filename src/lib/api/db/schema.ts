import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// PG Owners / Admins (multi-tenant: each owner manages their own PG properties)
export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// PG Properties
export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => owners.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  locality: text("locality").notNull(),
  address: text("address").notNull(),
  description: text("description"),
  genderType: text("gender_type").notNull(), // 'male' | 'female' | 'co-ed'
  amenities: text("amenities"), // JSON stringified array
  images: text("images"), // JSON stringified array of URLs
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Rooms/Beds within a property
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  roomNumber: text("room_number").notNull(),
  sharingType: text("sharing_type").notNull(), // 'single' | 'double' | 'triple' | 'dormitory'
  totalBeds: integer("total_beds").notNull().default(1),
  occupiedBeds: integer("occupied_beds").notNull().default(0),
  rentPerBed: real("rent_per_bed").notNull(),
  depositAmount: real("deposit_amount").notNull().default(0),
  amenities: text("amenities"), // JSON stringified array
  images: text("images"),
  status: text("status").notNull().default("available"), // available | full | maintenance
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Tenants (guests who book/stay)
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  idProofType: text("id_proof_type"), // aadhaar, passport, etc
  idProofNumber: text("id_proof_number"),
  emergencyContact: text("emergency_contact"),
  kycStatus: text("kyc_status").notNull().default("pending"), // verified | pending | missing
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Staff members employed at a property
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  name: text("name").notNull(),
  role: text("role").notNull(), // manager | cook | housekeeping | security | maintenance
  phone: text("phone").notNull(),
  shift: text("shift").notNull().default("morning"), // morning | evening | night
  salary: real("salary").notNull().default(0),
  status: text("status").notNull().default("active"), // active | on-leave
  attendance: integer("attendance").notNull().default(100),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Maintenance / service complaints raised by tenants
export const complaints = sqliteTable("complaints", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  tenantId: text("tenant_id").references(() => tenants.id),
  roomNumber: text("room_number"),
  category: text("category").notNull().default("other"), // plumbing | electrical | wifi | cleaning | food | other
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  title: text("title").notNull(),
  status: text("status").notNull().default("open"), // open | in-progress | resolved | closed
  assignedTo: text("assigned_to"), // staff id
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Visitor log (guests visiting tenants)
export const visitors = sqliteTable("visitors", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  tenantId: text("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  purpose: text("purpose"),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out"),
  idVerified: integer("id_verified", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Notices posted by owner/staff to tenants
export const notices = sqliteTable("notices", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("All tenants"),
  postedBy: text("posted_by").notNull(),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Bookings
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  propertyId: text("property_id").notNull().references(() => properties.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  checkInDate: text("check_in_date").notNull(),
  checkOutDate: text("check_out_date"),
  monthlyRent: real("monthly_rent").notNull(),
  depositAmount: real("deposit_amount").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | confirmed | active | checked_out | cancelled
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Payments (deposit, monthly rent, services)
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // deposit | rent | service | refund
  month: text("month"), // e.g. '2026-07' for rent payments
  status: text("status").notNull().default("pending"), // pending | paid | failed | refunded
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Expenses logged against a property
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  category: text("category").notNull().default("misc"), // utilities | salary | food | maintenance | supplies | misc
  vendor: text("vendor").notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// Weekly food menu per property (one row per day)
export const foodMenu = sqliteTable("food_menu", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  day: text("day").notNull(), // Monday..Sunday
  breakfast: text("breakfast").notNull().default(""),
  lunch: text("lunch").notNull().default(""),
  dinner: text("dinner").notNull().default(""),
});

// Services (food, laundry, cleaning etc offered as add-ons)
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => properties.id),
  name: text("name").notNull(),
  price: real("price").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly | one_time
});
