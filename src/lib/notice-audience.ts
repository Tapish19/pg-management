export function noticeVisibleToRoom(audience: string, roomNumber: string | undefined): boolean {
  return audience === "All tenants" || (roomNumber !== undefined && audience === `Room ${roomNumber}`);
}
