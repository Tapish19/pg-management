import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as s from "./schema";

// Fictional residents and transactions. Never import personal data from the web.
export async function seedSampleData(
  db: LibSQLDatabase<typeof s>,
  ownerId: string,
  now = new Date(),
) {
  return db.transaction(
    async (tx) => {
      if (!(await tx.select().from(s.owners).where(eq(s.owners.id, ownerId)).get()))
        throw new Error("Owner account not found");
      if (await tx.select().from(s.properties).where(eq(s.properties.ownerId, ownerId)).get())
        throw new Error(
          "Sample data is available for empty accounts only. Your existing records have been kept.",
        );
      const id = () => `sample_${randomUUID()}`;
      const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
      const monthDate = (offset: number, day = 3) =>
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, day)).toISOString();
      const photos = [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
      ];
      const locations = [
        {
          name: "Sample · Maple House",
          city: "Bengaluru",
          locality: "HSR Layout",
          address: "Fictional address: 24 Maple Lane, Sector 2, HSR Layout",
          genderType: "co-ed",
          baseRent: 9500,
        },
        {
          name: "Sample · The Urban Nest",
          city: "Pune",
          locality: "Hinjewadi",
          address: "Fictional address: 18 Garden Avenue, Hinjewadi Phase 1",
          genderType: "male",
          baseRent: 8000,
        },
        {
          name: "Sample · Bloom Residency",
          city: "Hyderabad",
          locality: "Gachibowli",
          address: "Fictional address: 7 Bloom Street, Gachibowli",
          genderType: "female",
          baseRent: 9000,
        },
      ];
      const residentNames = [
        "Aarav Sharma",
        "Ishita Mehta",
        "Rohan Kapoor",
        "Ananya Rao",
        "Kabir Shah",
        "Meera Iyer",
        "Vivaan Joshi",
        "Diya Nair",
        "Arjun Verma",
        "Sana Khan",
        "Aditya Desai",
        "Priya Menon",
        "Dev Patel",
        "Riya Sen",
        "Kunal Sethi",
        "Nisha Reddy",
        "Siddharth Jain",
        "Tara Gupta",
      ];
      const staffNames = [
        "Neha Kulkarni",
        "Suresh Kumar",
        "Lata Devi",
        "Vikram Singh",
        "Pooja Das",
        "Mahesh Patil",
        "Kavita Yadav",
        "Ramesh Naik",
        "Asha Bhat",
        "Mohan Reddy",
        "Lakshmi Rao",
        "Prakash Singh",
      ];
      const menus = [
        [
          "Monday",
          "Poha, fruit & tea",
          "Dal tadka, rice, roti & salad",
          "Paneer curry, roti & jeera rice",
        ],
        [
          "Tuesday",
          "Idli, sambar & chutney",
          "Rajma rice & cucumber salad",
          "Mixed vegetable curry & chapati",
        ],
        ["Wednesday", "Aloo paratha & curd", "Chole, rice & roti", "Vegetable pulao & raita"],
        [
          "Thursday",
          "Upma, banana & coffee",
          "Sambar rice, poriyal & curd",
          "Dal makhani & chapati",
        ],
        ["Friday", "Dosa & coconut chutney", "Kadhi rice & salad", "Palak paneer & roti"],
        ["Saturday", "Puri bhaji & tea", "Vegetable biryani & raita", "Chole bhature & salad"],
        [
          "Sunday",
          "Sandwiches, fruit & juice",
          "Special thali with dessert",
          "Khichdi, papad & curd",
        ],
      ];
      let residentIndex = 0;
      for (const [p, location] of locations.entries()) {
        const propertyId = id();
        await tx.insert(s.properties).values({
          id: propertyId,
          ownerId,
          name: location.name,
          city: location.city,
          locality: location.locality,
          address: location.address,
          genderType: location.genderType,
          description:
            "Fictional sample listing for exploring the app. Bright furnished rooms, home-style meals, a shared lounge and convenient access to the local office district. This property is not available for real bookings.",
          amenities: JSON.stringify([
            "Wi-Fi",
            "Meals",
            "Laundry",
            "Housekeeping",
            "CCTV",
            "Power Backup",
          ]),
          images: JSON.stringify([photos[p], photos[(p + 1) % photos.length]]),
          createdAt: daysAgo(190),
        });
        const staffIds: string[] = [];
        for (const [j, role] of ["manager", "cook", "housekeeping", "security"].entries()) {
          const staffId = id();
          staffIds.push(staffId);
          await tx
            .insert(s.staff)
            .values({
              id: staffId,
              propertyId,
              name: staffNames[p * 4 + j],
              role,
              phone: `00000001${String(p * 4 + j).padStart(2, "0")}`,
              shift: j === 3 ? "night" : "morning",
              salary: [28000, 22000, 16000, 19000][j],
              status: "active",
              attendance: 100,
              createdAt: daysAgo(150),
            });
          for (let day = 1; day <= now.getUTCDate(); day++) {
            await tx
              .insert(s.staffAttendance)
              .values({
                staffId,
                date: monthDate(0, day).slice(0, 10),
                status: j === 2 && day === 2 ? "on-leave" : "present",
              });
          }
        }
        const propertyTenants: string[] = [];
        for (let r = 0; r < 6; r++) {
          const roomId = id();
          const beds = r === 0 ? 1 : r === 5 ? 3 : 2;
          const occupiedBeds = r < 4 ? (r === 1 || r === 2 ? 2 : 1) : 0;
          const rent = location.baseRent + (r === 0 ? 4500 : r === 5 ? -1500 : 0);
          await tx
            .insert(s.rooms)
            .values({
              id: roomId,
              propertyId,
              roomNumber: String(101 + r),
              sharingType: beds === 1 ? "single" : beds === 2 ? "double" : "triple",
              totalBeds: beds,
              occupiedBeds,
              rentPerBed: rent,
              depositAmount: rent * 2,
              amenities: JSON.stringify(["Bed", "Wardrobe", "Study Desk", "Attached Bathroom"]),
              images: JSON.stringify([photos[1]]),
              status: r === 5 ? "maintenance" : occupiedBeds === beds ? "full" : "available",
            });
          for (let t = 0; t < occupiedBeds; t++) {
            const tenantId = id(),
              bookingId = id();
            const n = residentIndex++;
            propertyTenants.push(tenantId);
            await tx
              .insert(s.tenants)
              .values({
                id: tenantId,
                name: residentNames[n],
                email: `resident${n + 1}@example.invalid`,
                phone: `00000000${String(n + 1).padStart(2, "0")}`,
                kycStatus: n % 5 === 0 ? "pending" : "verified",
                createdAt: daysAgo(185 - n),
              });
            await tx
              .insert(s.tenantPreferences)
              .values({
                id: id(),
                tenantId,
                sleepSchedule: n % 2 ? "night_owl" : "early_bird",
                cleanliness: 3 + (n % 3),
                noiseTolerance: 2 + (n % 3),
                socialLevel: 2 + (n % 4),
                foodHabit: n % 3 ? "veg" : "eggetarian",
                workSchedule: n % 3 ? "office" : "wfh",
              });
            await tx
              .insert(s.bookings)
              .values({
                id: bookingId,
                roomId,
                propertyId,
                tenantId,
                checkInDate: monthDate(-6, 1).slice(0, 10),
                monthlyRent: rent,
                depositAmount: rent * 2,
                status: "active",
                createdAt: monthDate(-6, 1),
              });
            for (let m = -5; m <= 0; m++) {
              const paid = m < 0 || n % 4 !== 0;
              const timestamp =
                m === 0 ? monthDate(0, Math.min(3, now.getUTCDate())) : monthDate(m);
              await tx
                .insert(s.payments)
                .values({
                  id: id(),
                  bookingId,
                  amount: rent,
                  type: "rent",
                  month: timestamp.slice(0, 7),
                  status: paid ? "paid" : "pending",
                  paidAt: paid ? timestamp : null,
                  createdAt: timestamp,
                });
            }
          }
        }
        for (const [j, category] of ["plumbing", "wifi", "cleaning", "electrical"].entries()) {
          await tx
            .insert(s.complaints)
            .values({
              id: id(),
              propertyId,
              tenantId: propertyTenants[j],
              roomNumber: String([101, 102, 102, 103][j]),
              category,
              title: [
                "Bathroom tap needs a new washer",
                "Wi-Fi signal weak near study desk",
                "Request for an extra room cleaning",
                "Replace corridor light bulb",
              ][j],
              priority: j === 0 ? "high" : "medium",
              status: ["open", "in-progress", "resolved", "closed"][j],
              assignedTo: staffIds[j === 2 ? 2 : 0],
              createdAt: daysAgo(j + 1),
            });
        }
        for (let m = -5; m <= 0; m++) {
          for (const [j, category] of ["food", "utilities", "salary"].entries()) {
            await tx
              .insert(s.expenses)
              .values({
                id: id(),
                propertyId,
                category,
                vendor: ["Sample Fresh Basket", "Sample Utility Services", "Sample Staff Payroll"][
                  j
                ],
                date: monthDate(m, m === 0 ? Math.min(2, now.getUTCDate()) : 2).slice(0, 10),
                amount: [18500, 8200, 85000][j] + p * 500,
                status: "approved",
              });
          }
        }
        for (const [day, breakfast, lunch, dinner] of menus)
          await tx
            .insert(s.foodMenu)
            .values({ id: id(), propertyId, day, breakfast, lunch, dinner });
        for (const [name, price] of [
          ["Monthly meal plan", 2500],
          ["Laundry subscription", 600],
          ["Extra room cleaning", 250],
        ] as const)
          await tx
            .insert(s.services)
            .values({
              id: id(),
              propertyId,
              name,
              price,
              billingCycle: name === "Extra room cleaning" ? "one_time" : "monthly",
            });
        for (let j = 0; j < 3; j++)
          await tx
            .insert(s.visitors)
            .values({
              id: id(),
              propertyId,
              tenantId: propertyTenants[j],
              name: ["Sample Guest · Rahul", "Sample Guest · Anita", "Sample Guest · Sameer"][j],
              purpose: ["Family visit", "Study group", "Parcel delivery"][j],
              checkIn: daysAgo(j),
              checkOut: j === 0 ? null : daysAgo(j - 0.08),
              idVerified: true,
            });
        for (const [j, title] of [
          "Welcome to your new home",
          "Sunday community dinner",
          "Scheduled water tank cleaning",
        ].entries())
          await tx
            .insert(s.notices)
            .values({
              id: id(),
              propertyId,
              title,
              body: [
                "Please check the weekly menu and reach out to your property manager if you need help settling in.",
                "Join your neighbours in the dining area this Sunday at 7:30 PM. Board games and dessert included!",
                "Water supply will pause for routine tank cleaning on Saturday from 11 AM to 1 PM. Please plan ahead.",
              ][j],
              audience: "All tenants",
              postedBy: "Sample Property Team",
              createdAt: daysAgo(j + 1),
            });
      }
      return { properties: 3, rooms: 18, tenants: residentIndex, staff: 12 };
    },
    { behavior: "immediate" },
  );
}
