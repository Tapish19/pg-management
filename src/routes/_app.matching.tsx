import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui-ext/stat";
import { Users, BedDouble } from "lucide-react";
import { getOwnerRoomMatches } from "@/lib/api/functions/matching-fns";

export const Route = createFileRoute("/_app/matching")({ component: MatchingPage });

function scoreTone(score: number | null): "success" | "warning" | "destructive" | "muted" {
  if (score === null) return "muted";
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "destructive";
}

function MatchingPage() {
  const { data, isLoading } = useQuery({ queryKey: ["owner-room-matches"], queryFn: () => getOwnerRoomMatches() });

  return (
    <>
      <PageHeader
        title="Roommate Matching"
        description="Vacant beds ranked by lifestyle compatibility, based on each tenant's preference survey."
      />
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : !data || data.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No vacant shared rooms right now. This page ranks candidate tenants for shared rooms as beds open up.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((room) => (
            <Card key={room.room.id} className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4" />
                  <div className="font-semibold">
                    Room {room.room.roomNumber} · {room.propertyName}
                  </div>
                </div>
                <StatusPill tone="warning">{room.room.vacantBeds} vacant</StatusPill>
              </div>
              <div className="text-xs text-muted-foreground capitalize mb-3">{room.room.sharingType} sharing</div>

              {room.occupants.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Current occupants
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {room.occupants.map((o) => (
                      <span key={o.tenant.id} className="text-xs rounded-full border px-2 py-0.5">
                        {o.tenant.name}
                        {!o.hasPrefs && <span className="text-muted-foreground"> (no survey)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs font-medium text-muted-foreground mb-1">Best-fit candidates</div>
              {room.suggestedCandidates.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No unassigned tenants with a completed preference survey yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {room.suggestedCandidates.map((c, i) => (
                    <div key={c.tenant.id} className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                        <span className="text-sm">{c.tenant.name}</span>
                      </div>
                      {c.score === null ? (
                        <span className="text-xs text-muted-foreground">No occupants to compare yet</span>
                      ) : (
                        <StatusPill tone={scoreTone(c.score)}>{c.score}% match</StatusPill>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
