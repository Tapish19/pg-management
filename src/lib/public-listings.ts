import { hasVacantBed } from "./room-availability.ts";

export function parseStringArray(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
type PublicRoom = {
  id: string;
  roomNumber: string;
  sharingType: string;
  totalBeds: number;
  occupiedBeds: number;
  rentPerBed: number;
  depositAmount: number;
  status: string;
  amenities: string[];
};
export type PublicListing = {
  id: string;
  name: string;
  city: string;
  area: string;
  address: string;
  description: string;
  gender: string;
  amenities: string[];
  images: string[];
  image?: string;
  rentFrom: number | null;
  food: boolean;
  ac: boolean;
  wifi: boolean;
  availableBeds: number;
  rooms: PublicRoom[];
};
export function publicListing(
  property: {
    id: string;
    name: string;
    city: string;
    locality: string;
    address: string;
    description: string | null;
    genderType: string;
    amenities: string | null;
    images: string | null;
  },
  rooms: (Omit<PublicRoom, "amenities"> & { amenities: string | null })[],
): PublicListing {
  const publicRooms = rooms.map((room) => ({
    ...room,
    amenities: parseStringArray(room.amenities),
  }));
  const amenities = parseStringArray(property.amenities);
  const allAmenities = [...amenities, ...publicRooms.flatMap((room) => room.amenities)].map(
    (value) => value.toLowerCase().trim(),
  );
  const images = parseStringArray(property.images);
  const availableRooms = publicRooms.filter(hasVacantBed);
  const pricedRooms = availableRooms.length ? availableRooms : publicRooms;
  return {
    id: property.id,
    name: property.name,
    city: property.city,
    area: property.locality,
    address: property.address,
    description: property.description ?? "",
    gender: property.genderType,
    amenities,
    images,
    image: images[0],
    rooms: publicRooms,
    rentFrom: pricedRooms.length ? Math.min(...pricedRooms.map((room) => room.rentPerBed)) : null,
    food: allAmenities.some((value) => /^(food|meals?|food included|meals included)$/.test(value)),
    ac: allAmenities.some((value) => /^(ac|air conditioning|air-conditioned)$/.test(value)),
    wifi: allAmenities.some((value) => /^(wi-?fi|wireless internet)$/.test(value)),
    availableBeds: availableRooms.reduce(
      (sum, room) => sum + room.totalBeds - room.occupiedBeds,
      0,
    ),
  };
}
export function filterPublicListings(
  listings: PublicListing[],
  filters: {
    q: string;
    gender: string;
    food: boolean;
    ac: boolean;
    budget: number;
    sharing?: number;
  },
) {
  const sharingTypes: Record<number, string> = {
    1: "single",
    2: "double",
    3: "triple",
    4: "dormitory",
  };
  return listings.filter((property) => {
    if (
      filters.q &&
      !`${property.name} ${property.area} ${property.city}`
        .toLowerCase()
        .includes(filters.q.trim().toLowerCase())
    )
      return false;
    if (filters.gender !== "any" && property.gender !== filters.gender) return false;
    if ((filters.food && !property.food) || (filters.ac && !property.ac)) return false;
    return property.rooms.some(
      (room) =>
        hasVacantBed(room) &&
        room.rentPerBed <= filters.budget &&
        (!filters.sharing || room.sharingType === sharingTypes[filters.sharing]),
    );
  });
}
