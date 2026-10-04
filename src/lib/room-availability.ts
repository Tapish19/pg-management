export function hasVacantBed(room: { totalBeds: number; occupiedBeds: number; status: string }) {
  return room.status !== "maintenance" && room.occupiedBeds < room.totalBeds;
}

export function occupancyAfterStatusChange(room: { totalBeds: number; occupiedBeds: number; status: string }, previous: string, next: string) {
  const occupies = (status: string) => status === "confirmed" || status === "active";
  const delta = Number(occupies(next)) - Number(occupies(previous));
  if (delta > 0 && !hasVacantBed(room)) throw new Error("Room has no available beds");
  const occupiedBeds = Math.max(0, room.occupiedBeds + delta);
  return { occupiedBeds, status: room.status === "maintenance" ? "maintenance" : occupiedBeds >= room.totalBeds ? "full" : "available" };
}
