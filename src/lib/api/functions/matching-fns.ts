import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { tenantPreferences, tenants, bookings, rooms, properties } from "../db/schema";
import { genId } from "../id";
import { getSession, getTenantSession } from "../auth";

function requireOwnerSession() {
  const session = getSession();
  if (!session) throw new Error("Please log in first");
  return session;
}

function requireTenantSession() {
  const session = getTenantSession();
  if (!session) throw new Error("Please sign in first");
  return session;
}

export type Preferences = typeof tenantPreferences.$inferSelect;

// ---------------------------------------------------------------------------
// Compatibility engine
//
// This is a content-based similarity model over a lifestyle preference
// vector (not a black-box ML model). Each feature contributes a 0-1 fit
// score; scores are combined with hand-tuned weights reflecting how much
// each dimension tends to matter for shared-room compatibility. This is
// the same class of technique that underlies simple collaborative/content
// filtering recommenders, just transparent enough to explain to a tenant.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  sleepSchedule: 0.2,
  cleanliness: 0.2,
  noiseTolerance: 0.15,
  socialLevel: 0.1,
  foodHabit: 0.15,
  smoking: 0.1,
  guestsFrequency: 0.05,
  workSchedule: 0.05,
} as const;

function numericFit(a: number, b: number, range = 4) {
  // 1 = identical, 0 = maximally far apart on a 1-5 scale (range = 5-1 = 4)
  return 1 - Math.abs(a - b) / range;
}

function categoricalFit(a: string, b: string, partialMatches: Record<string, string[]> = {}) {
  if (a === b) return 1;
  const partners = partialMatches[a] || [];
  if (partners.includes(b)) return 0.5;
  return 0;
}

const SLEEP_PARTIAL: Record<string, string[]> = {
  early_bird: ["flexible"],
  night_owl: ["flexible"],
  flexible: ["early_bird", "night_owl"],
};

const FOOD_PARTIAL: Record<string, string[]> = {
  veg: ["eggetarian", "vegan"],
  vegan: ["veg"],
  eggetarian: ["veg", "nonveg"],
  nonveg: ["eggetarian"],
};

const GUEST_PARTIAL: Record<string, string[]> = {
  rare: ["occasional"],
  occasional: ["rare", "frequent"],
  frequent: ["occasional"],
};

const WORK_PARTIAL: Record<string, string[]> = {
  wfh: ["student"],
  student: ["wfh"],
  office: ["student"],
  night_shift: [],
};

export interface CompatibilityBreakdown {
  feature: string;
  fit: number; // 0-1
  weight: number;
}

export interface CompatibilityResult {
  score: number; // 0-100
  breakdown: CompatibilityBreakdown[];
}

export function computeCompatibility(a: Preferences, b: Preferences): CompatibilityResult {
  const breakdown: CompatibilityBreakdown[] = [
    { feature: "Sleep schedule", fit: categoricalFit(a.sleepSchedule, b.sleepSchedule, SLEEP_PARTIAL), weight: WEIGHTS.sleepSchedule },
    { feature: "Cleanliness", fit: numericFit(a.cleanliness, b.cleanliness), weight: WEIGHTS.cleanliness },
    { feature: "Noise tolerance", fit: numericFit(a.noiseTolerance, b.noiseTolerance), weight: WEIGHTS.noiseTolerance },
    { feature: "Social level", fit: numericFit(a.socialLevel, b.socialLevel), weight: WEIGHTS.socialLevel },
    { feature: "Food habit", fit: categoricalFit(a.foodHabit, b.foodHabit, FOOD_PARTIAL), weight: WEIGHTS.foodHabit },
    { feature: "Smoking", fit: a.smoking === b.smoking ? 1 : 0, weight: WEIGHTS.smoking },
    { feature: "Guests frequency", fit: categoricalFit(a.guestsFrequency, b.guestsFrequency, GUEST_PARTIAL), weight: WEIGHTS.guestsFrequency },
    { feature: "Work schedule", fit: categoricalFit(a.workSchedule, b.workSchedule, WORK_PARTIAL), weight: WEIGHTS.workSchedule },
  ];

  const raw = breakdown.reduce((sum, b) => sum + b.fit * b.weight, 0);
  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  const score = Math.round((raw / totalWeight) * 100);

  return { score, breakdown };
}

// ---------------------------------------------------------------------------
// Tenant-facing: manage my own preferences
// ---------------------------------------------------------------------------

export const getMyPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();
  const row = await db.select().from(tenantPreferences).where(eq(tenantPreferences.tenantId, session.tenantId)).get();
  return row ?? null;
});

const preferencesInput = z.object({
  sleepSchedule: z.enum(["early_bird", "night_owl", "flexible"]),
  cleanliness: z.number().int().min(1).max(5),
  noiseTolerance: z.number().int().min(1).max(5),
  socialLevel: z.number().int().min(1).max(5),
  foodHabit: z.enum(["veg", "nonveg", "vegan", "eggetarian"]),
  smoking: z.boolean(),
  guestsFrequency: z.enum(["rare", "occasional", "frequent"]),
  workSchedule: z.enum(["wfh", "office", "student", "night_shift"]),
});

export const saveMyPreferences = createServerFn({ method: "POST" })
  .validator((input: unknown) => preferencesInput.parse(input))
  .handler(async ({ data }) => {
    const session = requireTenantSession();
    const existing = await db
      .select()
      .from(tenantPreferences)
      .where(eq(tenantPreferences.tenantId, session.tenantId))
      .get();

    if (existing) {
      await db
        .update(tenantPreferences)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(tenantPreferences.tenantId, session.tenantId));
      return { id: existing.id };
    }

    const id = genId("pref");
    await db.insert(tenantPreferences).values({ id, tenantId: session.tenantId, ...data });
    return { id };
  });

// Tenant: compatibility with the roommates I currently share a room with
export const getMyRoommateMatches = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireTenantSession();

  const myPrefs = await db.select().from(tenantPreferences).where(eq(tenantPreferences.tenantId, session.tenantId)).get();
  if (!myPrefs) return { myPrefs: null, matches: [] };

  const myBooking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.tenantId, session.tenantId))
    .all()
    .then((rows) => rows.find((r) => r.status === "active" || r.status === "confirmed"));
  if (!myBooking) return { myPrefs, matches: [] };

  const roommateBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.roomId, myBooking.roomId))
    .all()
    .then((rows) => rows.filter((r) => r.tenantId !== session.tenantId && (r.status === "active" || r.status === "confirmed")));

  if (roommateBookings.length === 0) return { myPrefs, matches: [] };

  const roommateTenantIds = roommateBookings.map((r) => r.tenantId);
  const roommates = await db.select().from(tenants).where(inArray(tenants.id, roommateTenantIds)).all();
  const roommatePrefs = await db
    .select()
    .from(tenantPreferences)
    .where(inArray(tenantPreferences.tenantId, roommateTenantIds))
    .all();

  const prefsByTenant = new Map(roommatePrefs.map((p) => [p.tenantId, p]));

  const matches = roommates.map((t) => {
    const prefs = prefsByTenant.get(t.id);
    if (!prefs) return { tenant: { id: t.id, name: t.name }, score: null, breakdown: [] };
    const result = computeCompatibility(myPrefs, prefs);
    return { tenant: { id: t.id, name: t.name }, score: result.score, breakdown: result.breakdown };
  });

  return { myPrefs, matches };
});

// ---------------------------------------------------------------------------
// Owner-facing: recommend best-fit tenants for vacant beds
// ---------------------------------------------------------------------------

export const getOwnerRoomMatches = createServerFn({ method: "GET" }).handler(async () => {
  const session = requireOwnerSession();

  const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, session.ownerId)).all();
  const propertyIds = ownerProperties.map((p) => p.id);
  if (propertyIds.length === 0) return [];

  const allRooms = await db.select().from(rooms).where(inArray(rooms.propertyId, propertyIds)).all();
  const vacantRooms = allRooms.filter((r) => r.occupiedBeds < r.totalBeds && r.sharingType !== "single");
  if (vacantRooms.length === 0) return [];

  const allBookings = await db.select().from(bookings).where(inArray(bookings.propertyId, propertyIds)).all();
  const activeBookings = allBookings.filter((b) => b.status === "active" || b.status === "confirmed");

  const allTenants = await db.select().from(tenants).all();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t]));

  const allPrefs = await db.select().from(tenantPreferences).all();
  const prefsByTenant = new Map(allPrefs.map((p) => [p.tenantId, p]));

  // Tenants who have a booking but no roommate assignment yet (or are otherwise
  // unassigned) and have filled out preferences are candidates for matching.
  const bookedTenantIds = new Set(activeBookings.map((b) => b.tenantId));
  const unassignedWithPrefs = allPrefs.filter((p) => !bookedTenantIds.has(p.tenantId));

  return vacantRooms.map((room) => {
    const occupantBookings = activeBookings.filter((b) => b.roomId === room.id);
    const occupants = occupantBookings
      .map((b) => {
        const tenant = tenantMap.get(b.tenantId);
        const prefs = prefsByTenant.get(b.tenantId);
        return tenant ? { tenant: { id: tenant.id, name: tenant.name }, prefs } : null;
      })
      .filter((o): o is { tenant: { id: string; name: string }; prefs: Preferences | undefined } => !!o);

    const occupantsWithPrefs = occupants.filter((o) => o.prefs) as { tenant: { id: string; name: string }; prefs: Preferences }[];

    const candidates = unassignedWithPrefs
      .map((candidatePrefs) => {
        const tenant = tenantMap.get(candidatePrefs.tenantId);
        if (!tenant) return null;
        if (occupantsWithPrefs.length === 0) {
          return { tenant: { id: tenant.id, name: tenant.name }, score: null as number | null };
        }
        const scores = occupantsWithPrefs.map((o) => computeCompatibility(candidatePrefs, o.prefs).score);
        const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        return { tenant: { id: tenant.id, name: tenant.name }, score: avgScore };
      })
      .filter((c): c is { tenant: { id: string; name: string }; score: number | null } => !!c)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .slice(0, 5);

    const property = ownerProperties.find((p) => p.id === room.propertyId);

    return {
      room: { id: room.id, roomNumber: room.roomNumber, sharingType: room.sharingType, vacantBeds: room.totalBeds - room.occupiedBeds },
      propertyName: property?.name ?? "",
      occupants: occupants.map((o) => ({ tenant: o.tenant, hasPrefs: !!o.prefs })),
      suggestedCandidates: candidates,
    };
  });
});
