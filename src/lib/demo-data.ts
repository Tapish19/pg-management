// Realistic seed data for the PG One demo app. All in-memory / deterministic.

export type Role = "admin" | "staff" | "tenant";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  avatar?: string;
  propertyId?: string;
  roomId?: string;
};

export const DEMO_USERS: Record<Role, DemoUser> = {
  admin: {
    id: "u-admin",
    name: "Priya Sharma",
    email: "admin@pgone.demo",
    role: "admin",
    phone: "+91 98765 10001",
  },
  staff: {
    id: "u-staff",
    name: "Rakesh Kumar",
    email: "staff@pgone.demo",
    role: "staff",
    phone: "+91 98765 20002",
    propertyId: "p1",
  },
  tenant: {
    id: "u-tenant",
    name: "Aditi Verma",
    email: "tenant@pgone.demo",
    role: "tenant",
    phone: "+91 98765 30003",
    propertyId: "p1",
    roomId: "r-101",
  },
};

export type Property = {
  id: string;
  name: string;
  city: string;
  area: string;
  address: string;
  gender: "male" | "female" | "co-ed";
  rooms: number;
  beds: number;
  occupied: number;
  rentFrom: number;
  amenities: string[];
  food: boolean;
  ac: boolean;
  rating: number;
  reviews: number;
  image: string;
  manager: string;
};

export const PROPERTIES: Property[] = [
  {
    id: "p1",
    name: "Green Nest Residency",
    city: "Bengaluru",
    area: "HSR Layout",
    address: "12, 27th Main, HSR Sector 2, Bengaluru 560102",
    gender: "co-ed",
    rooms: 24,
    beds: 60,
    occupied: 47,
    rentFrom: 8500,
    amenities: ["WiFi", "Laundry", "Housekeeping", "CCTV", "Power Backup", "Hot Water"],
    food: true,
    ac: true,
    rating: 4.6,
    reviews: 128,
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
    manager: "Rakesh Kumar",
  },
  {
    id: "p2",
    name: "Urban Stay Koramangala",
    city: "Bengaluru",
    area: "Koramangala 5th Block",
    address: "88, 80 Ft Road, Koramangala, Bengaluru 560095",
    gender: "male",
    rooms: 18,
    beds: 42,
    occupied: 38,
    rentFrom: 11500,
    amenities: ["WiFi", "Gym", "Housekeeping", "CCTV", "Parking", "Hot Water"],
    food: true,
    ac: true,
    rating: 4.4,
    reviews: 92,
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    manager: "Sanjay Iyer",
  },
  {
    id: "p3",
    name: "Lotus Ladies PG",
    city: "Bengaluru",
    area: "Indiranagar",
    address: "45, 12th Main, Indiranagar Stage 2, Bengaluru 560038",
    gender: "female",
    rooms: 16,
    beds: 32,
    occupied: 21,
    rentFrom: 9800,
    amenities: ["WiFi", "Laundry", "Housekeeping", "CCTV", "Security", "Hot Water"],
    food: true,
    ac: false,
    rating: 4.7,
    reviews: 74,
    image:
      "https://images.unsplash.com/photo-1505692433770-36f19f51681d?auto=format&fit=crop&w=1200&q=80",
    manager: "Meera Nair",
  },
  {
    id: "p4",
    name: "Skyline Executive PG",
    city: "Hyderabad",
    area: "Gachibowli",
    address: "Plot 21, DLF Cyber City, Gachibowli, Hyderabad 500032",
    gender: "co-ed",
    rooms: 30,
    beds: 68,
    occupied: 55,
    rentFrom: 12500,
    amenities: ["WiFi", "Gym", "Cafe", "Housekeeping", "CCTV", "Parking"],
    food: true,
    ac: true,
    rating: 4.5,
    reviews: 156,
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
    manager: "Arjun Reddy",
  },
];

export type Room = {
  id: string;
  propertyId: string;
  floor: number;
  number: string;
  sharing: 1 | 2 | 3 | 4;
  ac: boolean;
  rent: number;
  deposit: number;
  status: "vacant" | "reserved" | "occupied" | "maintenance";
  bedsTotal: number;
  bedsOccupied: number;
};

export const ROOMS: Room[] = [
  {
    id: "r-101",
    propertyId: "p1",
    floor: 1,
    number: "101",
    sharing: 2,
    ac: true,
    rent: 12000,
    deposit: 24000,
    status: "occupied",
    bedsTotal: 2,
    bedsOccupied: 2,
  },
  {
    id: "r-102",
    propertyId: "p1",
    floor: 1,
    number: "102",
    sharing: 3,
    ac: false,
    rent: 8500,
    deposit: 17000,
    status: "occupied",
    bedsTotal: 3,
    bedsOccupied: 2,
  },
  {
    id: "r-103",
    propertyId: "p1",
    floor: 1,
    number: "103",
    sharing: 1,
    ac: true,
    rent: 18000,
    deposit: 36000,
    status: "vacant",
    bedsTotal: 1,
    bedsOccupied: 0,
  },
  {
    id: "r-201",
    propertyId: "p1",
    floor: 2,
    number: "201",
    sharing: 2,
    ac: true,
    rent: 12000,
    deposit: 24000,
    status: "occupied",
    bedsTotal: 2,
    bedsOccupied: 1,
  },
  {
    id: "r-202",
    propertyId: "p1",
    floor: 2,
    number: "202",
    sharing: 4,
    ac: false,
    rent: 7500,
    deposit: 15000,
    status: "occupied",
    bedsTotal: 4,
    bedsOccupied: 3,
  },
  {
    id: "r-203",
    propertyId: "p1",
    floor: 2,
    number: "203",
    sharing: 2,
    ac: true,
    rent: 12000,
    deposit: 24000,
    status: "maintenance",
    bedsTotal: 2,
    bedsOccupied: 0,
  },
  {
    id: "r-301",
    propertyId: "p1",
    floor: 3,
    number: "301",
    sharing: 3,
    ac: true,
    rent: 10500,
    deposit: 21000,
    status: "reserved",
    bedsTotal: 3,
    bedsOccupied: 0,
  },
  {
    id: "r-302",
    propertyId: "p1",
    floor: 3,
    number: "302",
    sharing: 2,
    ac: false,
    rent: 9000,
    deposit: 18000,
    status: "vacant",
    bedsTotal: 2,
    bedsOccupied: 0,
  },
];

export type Tenant = {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId: string;
  roomId: string;
  moveIn: string;
  rent: number;
  deposit: number;
  kyc: "verified" | "pending" | "missing";
  status: "active" | "notice" | "moved-out";
  guardian: string;
};

export const TENANTS: Tenant[] = [
  {
    id: "u-tenant",
    name: "Aditi Verma",
    phone: "+91 98765 30003",
    email: "tenant@pgone.demo",
    propertyId: "p1",
    roomId: "r-101",
    moveIn: "2025-03-15",
    rent: 12000,
    deposit: 24000,
    kyc: "verified",
    status: "active",
    guardian: "Rajesh Verma",
  },
  {
    id: "t2",
    name: "Rohan Mehta",
    phone: "+91 90000 11122",
    email: "rohan@demo.in",
    propertyId: "p1",
    roomId: "r-101",
    moveIn: "2025-04-01",
    rent: 12000,
    deposit: 24000,
    kyc: "verified",
    status: "active",
    guardian: "Anita Mehta",
  },
  {
    id: "t3",
    name: "Sneha Rao",
    phone: "+91 90000 22233",
    email: "sneha@demo.in",
    propertyId: "p1",
    roomId: "r-201",
    moveIn: "2024-11-20",
    rent: 12000,
    deposit: 24000,
    kyc: "verified",
    status: "active",
    guardian: "Suresh Rao",
  },
  {
    id: "t4",
    name: "Karan Singh",
    phone: "+91 90000 33344",
    email: "karan@demo.in",
    propertyId: "p1",
    roomId: "r-202",
    moveIn: "2025-01-10",
    rent: 7500,
    deposit: 15000,
    kyc: "pending",
    status: "active",
    guardian: "Harjeet Singh",
  },
  {
    id: "t5",
    name: "Neha Pillai",
    phone: "+91 90000 44455",
    email: "neha@demo.in",
    propertyId: "p1",
    roomId: "r-202",
    moveIn: "2025-02-05",
    rent: 7500,
    deposit: 15000,
    kyc: "verified",
    status: "notice",
    guardian: "Latha Pillai",
  },
  {
    id: "t6",
    name: "Vikram Joshi",
    phone: "+91 90000 55566",
    email: "vikram@demo.in",
    propertyId: "p1",
    roomId: "r-202",
    moveIn: "2025-05-01",
    rent: 7500,
    deposit: 15000,
    kyc: "verified",
    status: "active",
    guardian: "Ramesh Joshi",
  },
  {
    id: "t7",
    name: "Ishita Bose",
    phone: "+91 90000 66677",
    email: "ishita@demo.in",
    propertyId: "p1",
    roomId: "r-102",
    moveIn: "2025-03-01",
    rent: 8500,
    deposit: 17000,
    kyc: "missing",
    status: "active",
    guardian: "Anil Bose",
  },
  {
    id: "t8",
    name: "Aman Gupta",
    phone: "+91 90000 77788",
    email: "aman@demo.in",
    propertyId: "p1",
    roomId: "r-102",
    moveIn: "2025-04-15",
    rent: 8500,
    deposit: 17000,
    kyc: "verified",
    status: "active",
    guardian: "Deepa Gupta",
  },
];

export type Booking = {
  id: string;
  tenantName: string;
  propertyId: string;
  roomId: string;
  moveIn: string;
  months: number;
  amount: number;
  status: "pending" | "approved" | "rejected" | "checked-in" | "checked-out" | "cancelled";
  createdAt: string;
};

export const BOOKINGS: Booking[] = [
  {
    id: "B-1042",
    tenantName: "Kabir Malhotra",
    propertyId: "p1",
    roomId: "r-301",
    moveIn: "2026-08-01",
    months: 6,
    amount: 84000,
    status: "pending",
    createdAt: "2026-07-15",
  },
  {
    id: "B-1041",
    tenantName: "Diya Kapoor",
    propertyId: "p1",
    roomId: "r-302",
    moveIn: "2026-07-25",
    months: 12,
    amount: 108000,
    status: "approved",
    createdAt: "2026-07-14",
  },
  {
    id: "B-1040",
    tenantName: "Rehan Ali",
    propertyId: "p2",
    roomId: "r-101",
    moveIn: "2026-08-05",
    months: 6,
    amount: 72000,
    status: "pending",
    createdAt: "2026-07-13",
  },
  {
    id: "B-1039",
    tenantName: "Nikita Shah",
    propertyId: "p3",
    roomId: "r-201",
    moveIn: "2026-07-20",
    months: 12,
    amount: 117600,
    status: "checked-in",
    createdAt: "2026-07-10",
  },
  {
    id: "B-1038",
    tenantName: "Sameer Khanna",
    propertyId: "p1",
    roomId: "r-103",
    moveIn: "2026-07-18",
    months: 3,
    amount: 54000,
    status: "rejected",
    createdAt: "2026-07-08",
  },
  {
    id: "B-1037",
    tenantName: "Aarav Nanda",
    propertyId: "p2",
    roomId: "r-102",
    moveIn: "2026-06-20",
    months: 6,
    amount: 69000,
    status: "checked-out",
    createdAt: "2026-06-10",
  },
];

export type Invoice = {
  id: string;
  tenantId: string;
  tenantName: string;
  month: string;
  amount: number;
  paid: number;
  due: string;
  status: "paid" | "partial" | "overdue" | "upcoming";
  method?: "UPI" | "Cash" | "Bank" | "Card";
};

export const INVOICES: Invoice[] = [
  {
    id: "INV-2601",
    tenantId: "u-tenant",
    tenantName: "Aditi Verma",
    month: "Jul 2026",
    amount: 12000,
    paid: 0,
    due: "2026-07-05",
    status: "overdue",
  },
  {
    id: "INV-2602",
    tenantId: "t2",
    tenantName: "Rohan Mehta",
    month: "Jul 2026",
    amount: 12000,
    paid: 12000,
    due: "2026-07-05",
    status: "paid",
    method: "UPI",
  },
  {
    id: "INV-2603",
    tenantId: "t3",
    tenantName: "Sneha Rao",
    month: "Jul 2026",
    amount: 12000,
    paid: 6000,
    due: "2026-07-05",
    status: "partial",
    method: "Cash",
  },
  {
    id: "INV-2604",
    tenantId: "t4",
    tenantName: "Karan Singh",
    month: "Jul 2026",
    amount: 7500,
    paid: 7500,
    due: "2026-07-05",
    status: "paid",
    method: "UPI",
  },
  {
    id: "INV-2605",
    tenantId: "t5",
    tenantName: "Neha Pillai",
    month: "Jul 2026",
    amount: 7500,
    paid: 0,
    due: "2026-07-05",
    status: "overdue",
  },
  {
    id: "INV-2606",
    tenantId: "t6",
    tenantName: "Vikram Joshi",
    month: "Jul 2026",
    amount: 7500,
    paid: 7500,
    due: "2026-07-05",
    status: "paid",
    method: "Card",
  },
  {
    id: "INV-2607",
    tenantId: "t7",
    tenantName: "Ishita Bose",
    month: "Jul 2026",
    amount: 8500,
    paid: 8500,
    due: "2026-07-05",
    status: "paid",
    method: "UPI",
  },
  {
    id: "INV-2608",
    tenantId: "t8",
    tenantName: "Aman Gupta",
    month: "Jul 2026",
    amount: 8500,
    paid: 0,
    due: "2026-08-05",
    status: "upcoming",
  },
  {
    id: "INV-2591",
    tenantId: "u-tenant",
    tenantName: "Aditi Verma",
    month: "Jun 2026",
    amount: 12000,
    paid: 12000,
    due: "2026-06-05",
    status: "paid",
    method: "UPI",
  },
  {
    id: "INV-2581",
    tenantId: "u-tenant",
    tenantName: "Aditi Verma",
    month: "May 2026",
    amount: 12000,
    paid: 12000,
    due: "2026-05-05",
    status: "paid",
    method: "Bank",
  },
];

export type Staff = {
  id: string;
  name: string;
  role: "manager" | "cook" | "housekeeping" | "security" | "maintenance";
  propertyId: string;
  phone: string;
  shift: "morning" | "evening" | "night";
  salary: number;
  status: "active" | "on-leave";
  attendance: number;
};

export const STAFF: Staff[] = [
  {
    id: "u-staff",
    name: "Rakesh Kumar",
    role: "manager",
    propertyId: "p1",
    phone: "+91 98765 20002",
    shift: "morning",
    salary: 32000,
    status: "active",
    attendance: 96,
  },
  {
    id: "s2",
    name: "Lakshmi Devi",
    role: "cook",
    propertyId: "p1",
    phone: "+91 98765 20003",
    shift: "morning",
    salary: 22000,
    status: "active",
    attendance: 98,
  },
  {
    id: "s3",
    name: "Suresh Yadav",
    role: "security",
    propertyId: "p1",
    phone: "+91 98765 20004",
    shift: "night",
    salary: 20000,
    status: "active",
    attendance: 93,
  },
  {
    id: "s4",
    name: "Anita Bai",
    role: "housekeeping",
    propertyId: "p1",
    phone: "+91 98765 20005",
    shift: "morning",
    salary: 15000,
    status: "on-leave",
    attendance: 88,
  },
  {
    id: "s5",
    name: "Mohan Das",
    role: "maintenance",
    propertyId: "p1",
    phone: "+91 98765 20006",
    shift: "evening",
    salary: 18000,
    status: "active",
    attendance: 91,
  },
];

export type Complaint = {
  id: string;
  tenantName: string;
  propertyId: string;
  roomNumber: string;
  category: "plumbing" | "electrical" | "wifi" | "cleaning" | "food" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: string;
};

export const COMPLAINTS: Complaint[] = [
  {
    id: "TCK-501",
    tenantName: "Aditi Verma",
    propertyId: "p1",
    roomNumber: "101",
    category: "plumbing",
    priority: "high",
    title: "Leaking bathroom tap",
    status: "in-progress",
    assignedTo: "Mohan Das",
    createdAt: "2026-07-18",
  },
  {
    id: "TCK-502",
    tenantName: "Rohan Mehta",
    propertyId: "p1",
    roomNumber: "101",
    category: "wifi",
    priority: "medium",
    title: "WiFi keeps disconnecting",
    status: "open",
    createdAt: "2026-07-19",
  },
  {
    id: "TCK-503",
    tenantName: "Karan Singh",
    propertyId: "p1",
    roomNumber: "202",
    category: "electrical",
    priority: "urgent",
    title: "Power outlet not working",
    status: "open",
    createdAt: "2026-07-19",
  },
  {
    id: "TCK-504",
    tenantName: "Sneha Rao",
    propertyId: "p1",
    roomNumber: "201",
    category: "cleaning",
    priority: "low",
    title: "Corridor needs mopping",
    status: "resolved",
    assignedTo: "Anita Bai",
    createdAt: "2026-07-16",
  },
  {
    id: "TCK-505",
    tenantName: "Ishita Bose",
    propertyId: "p1",
    roomNumber: "102",
    category: "food",
    priority: "medium",
    title: "Dinner served cold yesterday",
    status: "resolved",
    assignedTo: "Lakshmi Devi",
    createdAt: "2026-07-15",
  },
];

export type FoodMenu = { day: string; breakfast: string; lunch: string; dinner: string };
export const FOOD_MENU: FoodMenu[] = [
  {
    day: "Monday",
    breakfast: "Idli & Sambar, Filter Coffee",
    lunch: "Jeera Rice, Dal Tadka, Aloo Gobi, Roti, Salad",
    dinner: "Roti, Paneer Butter Masala, Rice, Curd",
  },
  {
    day: "Tuesday",
    breakfast: "Poha, Boiled Egg, Tea",
    lunch: "Curd Rice, Rajma, Bhindi Fry, Roti",
    dinner: "Veg Fried Rice, Manchurian, Soup",
  },
  {
    day: "Wednesday",
    breakfast: "Aloo Paratha, Curd, Pickle",
    lunch: "Rice, Sambar, Cabbage Poriyal, Roti, Papad",
    dinner: "Roti, Chicken Curry / Chana Masala, Rice",
  },
  {
    day: "Thursday",
    breakfast: "Upma, Coconut Chutney, Tea",
    lunch: "Pulao, Mixed Dal, Bhaji, Roti, Salad",
    dinner: "Roti, Egg Bhurji / Mushroom Masala, Rice",
  },
  {
    day: "Friday",
    breakfast: "Dosa, Chutney, Sambar",
    lunch: "Rice, Dal Fry, Aloo Matar, Roti",
    dinner: "Roti, Kadai Paneer, Jeera Rice, Curd",
  },
  {
    day: "Saturday",
    breakfast: "Bread, Omelette, Jam, Tea",
    lunch: "Veg Biryani, Raita, Salan, Papad",
    dinner: "Roti, Dal Makhani, Rice, Kheer",
  },
  {
    day: "Sunday",
    breakfast: "Chole Bhature, Lassi",
    lunch: "Special Thali (7 items)",
    dinner: "Roti, Butter Chicken / Malai Kofta, Rice",
  },
];

export type Expense = {
  id: string;
  category: "utilities" | "salary" | "food" | "maintenance" | "supplies" | "misc";
  vendor: string;
  propertyId: string;
  date: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
};

export const EXPENSES: Expense[] = [
  {
    id: "EXP-901",
    category: "utilities",
    vendor: "BESCOM",
    propertyId: "p1",
    date: "2026-07-10",
    amount: 24500,
    status: "approved",
  },
  {
    id: "EXP-902",
    category: "food",
    vendor: "Sri Krishna Grocers",
    propertyId: "p1",
    date: "2026-07-12",
    amount: 32800,
    status: "approved",
  },
  {
    id: "EXP-903",
    category: "maintenance",
    vendor: "QuickFix Plumbing",
    propertyId: "p1",
    date: "2026-07-14",
    amount: 4800,
    status: "pending",
  },
  {
    id: "EXP-904",
    category: "salary",
    vendor: "Payroll — Jul",
    propertyId: "p1",
    date: "2026-07-01",
    amount: 107000,
    status: "approved",
  },
  {
    id: "EXP-905",
    category: "supplies",
    vendor: "CleanCo",
    propertyId: "p1",
    date: "2026-07-08",
    amount: 6200,
    status: "approved",
  },
];

export type Visitor = {
  id: string;
  name: string;
  tenantName: string;
  purpose: string;
  checkIn: string;
  checkOut?: string;
  idVerified: boolean;
};

export const VISITORS: Visitor[] = [
  {
    id: "V-2201",
    name: "Rajesh Verma",
    tenantName: "Aditi Verma",
    purpose: "Family visit",
    checkIn: "2026-07-19 18:30",
    checkOut: "2026-07-19 21:00",
    idVerified: true,
  },
  {
    id: "V-2202",
    name: "Priya Iyer",
    tenantName: "Sneha Rao",
    purpose: "Friend",
    checkIn: "2026-07-20 11:00",
    idVerified: true,
  },
  {
    id: "V-2203",
    name: "Amazon Delivery",
    tenantName: "Rohan Mehta",
    purpose: "Parcel",
    checkIn: "2026-07-20 14:15",
    checkOut: "2026-07-20 14:20",
    idVerified: false,
  },
];

export type Notice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  postedAt: string;
  postedBy: string;
};

export const NOTICES: Notice[] = [
  {
    id: "N-88",
    title: "Water tank cleaning on Sunday",
    body: "Water supply will be paused from 10 AM to 2 PM on Sunday for tank cleaning. Please store water in advance.",
    audience: "All tenants — Green Nest",
    postedAt: "2026-07-18",
    postedBy: "Priya Sharma",
  },
  {
    id: "N-87",
    title: "Rent due reminder — July",
    body: "Kindly clear July rent by the 5th to avoid late fee of ₹100/day.",
    audience: "All tenants",
    postedAt: "2026-07-01",
    postedBy: "Priya Sharma",
  },
  {
    id: "N-86",
    title: "New menu launched",
    body: "Weekly food menu has been refreshed with 3 new dinner options.",
    audience: "All tenants",
    postedAt: "2026-06-28",
    postedBy: "Lakshmi Devi",
  },
];

export type Notification = {
  id: string;
  title: string;
  body: string;
  category:
    | "payment"
    | "booking"
    | "complaint"
    | "food"
    | "visitor"
    | "notice"
    | "task"
    | "check-in";
  time: string;
  read: boolean;
  role: Role | "all";
};

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Rent overdue",
    body: "Aditi Verma's July rent is 15 days overdue.",
    category: "payment",
    time: "2h ago",
    read: false,
    role: "admin",
  },
  {
    id: "n2",
    title: "New booking request",
    body: "Kabir Malhotra requested Room 301 for 6 months.",
    category: "booking",
    time: "5h ago",
    read: false,
    role: "admin",
  },
  {
    id: "n3",
    title: "Complaint escalated",
    body: "TCK-503 marked urgent — power outage in 202.",
    category: "complaint",
    time: "1d ago",
    read: true,
    role: "admin",
  },
  {
    id: "n4",
    title: "Payment received",
    body: "₹12,000 received from Rohan Mehta via UPI.",
    category: "payment",
    time: "1d ago",
    read: true,
    role: "admin",
  },
  {
    id: "n5",
    title: "Task assigned",
    body: "Fix leaking tap in Room 101 by 6 PM.",
    category: "task",
    time: "1h ago",
    read: false,
    role: "staff",
  },
  {
    id: "n6",
    title: "New visitor",
    body: "Priya Iyer checked in for Sneha Rao.",
    category: "visitor",
    time: "3h ago",
    read: false,
    role: "staff",
  },
  {
    id: "n7",
    title: "Check-in scheduled",
    body: "Diya Kapoor checks in tomorrow at 11 AM.",
    category: "check-in",
    time: "6h ago",
    read: true,
    role: "staff",
  },
  {
    id: "n8",
    title: "Rent due",
    body: "Your July rent of ₹12,000 is overdue. Pay now to avoid late fee.",
    category: "payment",
    time: "2h ago",
    read: false,
    role: "tenant",
  },
  {
    id: "n9",
    title: "Complaint update",
    body: "TCK-501 is now In Progress. Mohan Das is on it.",
    category: "complaint",
    time: "1d ago",
    read: false,
    role: "tenant",
  },
  {
    id: "n10",
    title: "Menu updated",
    body: "Sunday special thali added to this week's menu.",
    category: "food",
    time: "2d ago",
    read: true,
    role: "tenant",
  },
  {
    id: "n11",
    title: "Notice: Water outage",
    body: "Water supply paused Sunday 10 AM–2 PM.",
    category: "notice",
    time: "1d ago",
    read: true,
    role: "all",
  },
];

export const OCCUPANCY_TREND = [
  { month: "Feb", occupied: 38, capacity: 60 },
  { month: "Mar", occupied: 41, capacity: 60 },
  { month: "Apr", occupied: 44, capacity: 60 },
  { month: "May", occupied: 46, capacity: 60 },
  { month: "Jun", occupied: 45, capacity: 60 },
  { month: "Jul", occupied: 47, capacity: 60 },
];

export const REVENUE_TREND = [
  { month: "Feb", revenue: 420000, expense: 260000 },
  { month: "Mar", revenue: 445000, expense: 275000 },
  { month: "Apr", revenue: 468000, expense: 280000 },
  { month: "May", revenue: 482000, expense: 295000 },
  { month: "Jun", revenue: 495000, expense: 310000 },
  { month: "Jul", revenue: 512000, expense: 305000 },
];

export const BOOKING_FUNNEL = [
  { stage: "Enquiries", count: 128 },
  { stage: "Visits", count: 74 },
  { stage: "Bookings", count: 32 },
  { stage: "Checked-in", count: 26 },
];

export const FOOD_PLAN_USAGE = [
  { plan: "All Meals", count: 34 },
  { plan: "Dinner Only", count: 9 },
  { plan: "Breakfast + Dinner", count: 12 },
  { plan: "No Plan", count: 5 },
];

export const REVIEWS = [
  {
    name: "Ananya S.",
    rating: 5,
    text: "Super clean rooms and the food is homely. Manager is very responsive.",
  },
  { name: "Vishal T.", rating: 4, text: "Great location, good WiFi. Only wish gym was on-site." },
  { name: "Meera K.", rating: 5, text: "Safe for women, friendly staff, timely maintenance." },
];

export const FAQS = [
  {
    q: "How do I book a PG?",
    a: "Browse listings, open a property, choose a room, pick your move-in date and complete a quick KYC. Payment is optional at booking — pay on move-in if you prefer.",
  },
  {
    q: "Is a security deposit required?",
    a: "Yes, most PGs collect a refundable deposit equal to 1–2 months' rent, refundable within 15 days of move-out after deductions (if any).",
  },
  {
    q: "Can I change rooms later?",
    a: "Yes. Raise a room-change request from your tenant dashboard. Subject to availability and the property's policy.",
  },
  {
    q: "What if I want to move out early?",
    a: "Give a notice (typically 30 days) from your tenant dashboard. Deposit is refunded after clearance.",
  },
];

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
