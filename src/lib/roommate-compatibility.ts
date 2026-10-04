import { z } from "zod";

export const preferencesInput = z.object({
  sleepSchedule: z.enum(["early_bird", "night_owl", "flexible"]),
  cleanliness: z.number().int().min(1).max(5),
  noiseTolerance: z.number().int().min(1).max(5),
  socialLevel: z.number().int().min(1).max(5),
  foodHabit: z.enum(["veg", "nonveg", "vegan", "eggetarian"]),
  smoking: z.boolean(),
  guestsFrequency: z.enum(["rare", "occasional", "frequent"]),
  workSchedule: z.enum(["wfh", "office", "student", "night_shift"]),
});

export type LifestylePreferences = z.infer<typeof preferencesInput>;
type CompatibilityPreferences = {
  [K in keyof LifestylePreferences]: LifestylePreferences[K] extends string
    ? string
    : LifestylePreferences[K];
};

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

export function computeCompatibility(
  a: CompatibilityPreferences,
  b: CompatibilityPreferences,
): CompatibilityResult {
  a = preferencesInput.parse(a);
  b = preferencesInput.parse(b);
  const breakdown: CompatibilityBreakdown[] = [
    {
      feature: "Sleep schedule",
      fit: categoricalFit(a.sleepSchedule, b.sleepSchedule, SLEEP_PARTIAL),
      weight: WEIGHTS.sleepSchedule,
    },
    {
      feature: "Cleanliness",
      fit: numericFit(a.cleanliness, b.cleanliness),
      weight: WEIGHTS.cleanliness,
    },
    {
      feature: "Noise tolerance",
      fit: numericFit(a.noiseTolerance, b.noiseTolerance),
      weight: WEIGHTS.noiseTolerance,
    },
    {
      feature: "Social level",
      fit: numericFit(a.socialLevel, b.socialLevel),
      weight: WEIGHTS.socialLevel,
    },
    {
      feature: "Food habit",
      fit: categoricalFit(a.foodHabit, b.foodHabit, FOOD_PARTIAL),
      weight: WEIGHTS.foodHabit,
    },
    { feature: "Smoking", fit: a.smoking === b.smoking ? 1 : 0, weight: WEIGHTS.smoking },
    {
      feature: "Guests frequency",
      fit: categoricalFit(a.guestsFrequency, b.guestsFrequency, GUEST_PARTIAL),
      weight: WEIGHTS.guestsFrequency,
    },
    {
      feature: "Work schedule",
      fit: categoricalFit(a.workSchedule, b.workSchedule, WORK_PARTIAL),
      weight: WEIGHTS.workSchedule,
    },
  ];

  const raw = breakdown.reduce((sum, b) => sum + b.fit * b.weight, 0);
  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  const score = Math.round((raw / totalWeight) * 100);

  return { score, breakdown };
}
