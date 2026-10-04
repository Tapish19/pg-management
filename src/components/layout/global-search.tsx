import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { includesSearch } from "@/lib/search-filters";
import { listOwnerBookings } from "@/lib/api/functions/bookings-fns";
import { listOwnerRooms } from "@/lib/api/functions/rooms-fns";
import { getMyBooking } from "@/lib/api/functions/tenant-fns";
import { TENANTS, ROOMS, BOOKINGS } from "@/lib/demo-data";

export function GlobalSearch() {
  const { user, isDemo } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const searching = focused && q.trim().length >= 2;
  const owner = user?.role !== "tenant";
  const bookings = useQuery({ queryKey: ["bookings", "mine"], queryFn: () => listOwnerBookings(), enabled: searching && owner && !isDemo });
  const rooms = useQuery({ queryKey: ["rooms", "mine"], queryFn: () => listOwnerRooms(), enabled: searching && owner && !isDemo });
  const mine = useQuery({ queryKey: ["my-booking"], queryFn: () => getMyBooking(), enabled: searching && !owner && !isDemo });
  const results: { id: string; label: string; open: () => void }[] = [];
  if (owner) {
    const tenants = isDemo ? TENANTS : [...new Map((bookings.data ?? []).flatMap((booking) => booking.tenant ? [[booking.tenant.id, booking.tenant] as const] : [])).values()];
    for (const tenant of tenants) if (includesSearch(q, tenant.name, tenant.email, tenant.phone)) results.push({ id: `tenant-${tenant.id}`, label: `Tenant: ${tenant.name}`, open: () => navigate({ to: "/tenants", search: { q: tenant.email } }) });
    const roomRows = isDemo ? ROOMS.map((room) => ({ id: room.id, roomNumber: room.number, propertyId: room.propertyId })) : rooms.data ?? [];
    for (const room of roomRows) if (includesSearch(q, room.roomNumber, room.id)) results.push({ id: room.id, label: `Room ${room.roomNumber}`, open: () => navigate({ to: "/rooms", search: { propertyId: room.propertyId } }) });
    const bookingRows = isDemo ? BOOKINGS.map((booking) => ({ id: booking.id, name: booking.tenantName })) : (bookings.data ?? []).map((booking) => ({ id: booking.id, name: booking.tenant?.name }));
    for (const booking of bookingRows) if (includesSearch(q, booking.id, booking.name)) results.push({ id: booking.id, label: `Booking ${booking.id}: ${booking.name ?? ""}`, open: () => navigate({ to: "/bookings", search: { q: booking.id } }) });
  } else {
    const booking = mine.data;
    if (booking && includesSearch(q, booking.room?.roomNumber, booking.property?.name, booking.booking.id)) results.push({ id: booking.booking.id, label: `${booking.property?.name}: Room ${booking.room?.roomNumber}`, open: () => navigate({ to: "/my-room" }) });
    if (isDemo) {
      const room = ROOMS.find((item) => item.id === user?.roomId);
      if (room && includesSearch(q, room.number, room.id)) results.push({ id: room.id, label: `My room: ${room.number}`, open: () => navigate({ to: "/my-room" }) });
    }
  }
  const loading = !isDemo && (owner ? bookings.isLoading || rooms.isLoading : mine.isLoading);
  const error = !isDemo && (owner ? bookings.error || rooms.error : mine.error);
  return (
    <div className="relative w-full" onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input aria-label="Search" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Escape") setFocused(false);
        if (event.key === "Enter" && searching && !loading && !error && results[0]) { results[0].open(); setFocused(false); }
      }} placeholder={owner ? "Search tenants, rooms, bookings..." : "Search your room or booking..."} className="pl-9 h-9 bg-muted/40" />
      {searching && <div className="absolute top-full mt-2 w-full rounded-lg border bg-background shadow-lg z-50 max-h-80 overflow-y-auto" aria-live="polite">
        {loading ? <p className="p-3 text-sm">Searching...</p> : error ? <p className="p-3 text-sm" role="alert">Could not load search results.</p>
          : results.length === 0 ? <p className="p-3 text-sm">No matches.</p> : results.slice(0, 12).map((result) => <button key={result.id} className="block w-full text-left text-sm p-3 hover:bg-muted" onClick={() => { result.open(); setFocused(false); setQ(""); }}>{result.label}</button>)}
      </div>}
    </div>
  );
}
