import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyPreferences, saveMyPreferences, getMyRoommateMatches } from "@/lib/demo-api";
import { preferencesInput, type LifestylePreferences } from "@/lib/roommate-compatibility";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const defaults: LifestylePreferences = {
  sleepSchedule: "flexible",
  cleanliness: 3,
  noiseTolerance: 3,
  socialLevel: 3,
  foodHabit: "veg",
  smoking: false,
  guestsFrequency: "occasional",
  workSchedule: "office",
};
export function RoommatePreferences() {
  const query = useQuery({ queryKey: ["my-preferences"], queryFn: () => getMyPreferences() });
  const matches = useQuery({
    queryKey: ["my-roommate-matches"],
    queryFn: () => getMyRoommateMatches(),
  });
  return (
    <Card className="p-6 mt-6 space-y-4">
      <h2 className="font-semibold text-lg">Roommate preferences</h2>
      <p className="text-sm text-muted-foreground">
        Your lifestyle preferences help compare compatibility with roommates. Scores are calculated
        from eight preferences and are a guide for discussing how you share a room.
      </p>
      {query.isLoading ? (
        <p>Loading preferences…</p>
      ) : query.isError ? (
        <p role="alert">
          Could not load preferences. <Button onClick={() => query.refetch()}>Retry</Button>
        </p>
      ) : (
        <PreferenceForm initial={preferencesInput.safeParse(query.data).data ?? defaults} />
      )}
      <h3 className="font-semibold">Your current roommates</h3>
      {matches.isLoading ? (
        <p>Calculating matches…</p>
      ) : matches.isError ? (
        <p role="alert">
          Could not calculate matches. <Button onClick={() => matches.refetch()}>Retry</Button>
        </p>
      ) : !matches.data?.matches.length ? (
        <p className="text-sm text-muted-foreground">
          No roommates to compare yet. Save your preferences to be ready for matching.
        </p>
      ) : (
        matches.data.matches.map((match) => (
          <div key={match.tenant.id} className="rounded border p-4">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{match.tenant.name}</span>
              <span>{match.score === null ? "Survey needed" : `${match.score}% compatible`}</span>
            </div>
            {match.breakdown.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">Why this score?</summary>
                <ul className="mt-2 space-y-1">
                  {match.breakdown.map((item) => (
                    <li key={item.feature}>
                      {item.feature}: {Math.round(item.fit * 100)}% fit ·{" "}
                      {Math.round(item.weight * 100)}% weight
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))
      )}
    </Card>
  );
}

function PreferenceForm({ initial }: { initial: LifestylePreferences }) {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const data = preferencesInput.parse({
        sleepSchedule: form.get("sleepSchedule"),
        cleanliness: Number(form.get("cleanliness")),
        noiseTolerance: Number(form.get("noiseTolerance")),
        socialLevel: Number(form.get("socialLevel")),
        foodHabit: form.get("foodHabit"),
        smoking: form.get("smoking") === "yes",
        guestsFrequency: form.get("guestsFrequency"),
        workSchedule: form.get("workSchedule"),
      });
      await saveMyPreferences({ data });
      for (const key of ["my-preferences", "my-roommate-matches", "owner-room-matches"])
        await queryClient.invalidateQueries({ queryKey: [key] });
      toast.success("Preferences saved and matches recalculated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }
  const selects = [
    {
      name: "sleepSchedule",
      label: "Sleep schedule",
      options: [
        ["early_bird", "Early bird"],
        ["night_owl", "Night owl"],
        ["flexible", "Flexible"],
      ],
    },
    {
      name: "foodHabit",
      label: "Food habits",
      options: [
        ["veg", "Vegetarian"],
        ["nonveg", "Non-vegetarian"],
        ["vegan", "Vegan"],
        ["eggetarian", "Eggetarian"],
      ],
    },
    {
      name: "guestsFrequency",
      label: "Visitor frequency",
      options: [
        ["rare", "Rarely"],
        ["occasional", "Occasionally"],
        ["frequent", "Frequently"],
      ],
    },
    {
      name: "workSchedule",
      label: "Work schedule",
      options: [
        ["office", "Office"],
        ["wfh", "Work from home"],
        ["student", "Student"],
        ["night_shift", "Night shift"],
      ],
    },
  ] as const;
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {selects.map((field) => (
          <div key={field.name}>
            <Label htmlFor={`prefs-${field.name}`} className="block mb-1">
              {field.label}
            </Label>
            <select
              id={`prefs-${field.name}`}
              name={field.name}
              defaultValue={initial[field.name]}
              className="w-full rounded-md border bg-background p-2"
            >
              {field.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {(
          [
            ["cleanliness", "Cleanliness", "1 = relaxed, 5 = very tidy"],
            ["noiseTolerance", "Noise tolerance", "1 = needs quiet, 5 = comfortable with noise"],
            ["socialLevel", "Social habits", "1 = private, 5 = very social"],
          ] as const
        ).map(([name, label, hint]) => (
          <div key={name}>
            <Label htmlFor={`prefs-${name}`} className="block mb-1">
              {label}
            </Label>
            <select
              id={`prefs-${name}`}
              name={name}
              defaultValue={initial[name]}
              className="w-full rounded-md border bg-background p-2"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
          </div>
        ))}
        <div>
          <Label htmlFor="prefs-smoking" className="block mb-1">
            Smoking
          </Label>
          <select
            id="prefs-smoking"
            name="smoking"
            defaultValue={initial.smoking ? "yes" : "no"}
            className="w-full rounded-md border bg-background p-2"
          >
            <option value="no">Non-smoker</option>
            <option value="yes">Smoker</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
