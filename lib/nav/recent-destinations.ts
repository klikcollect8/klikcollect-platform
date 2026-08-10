export type RecentDestination = {
  id: string;
  label: string;
  sub?: string;
  lng: number;
  lat: number;
  usedAt: number;
};

const STORAGE_KEY = "klikcollect:nav-recent";
const MAX = 12;

export function listRecentDestinations(): RecentDestination[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDestination[];
    return (Array.isArray(parsed) ? parsed : [])
      .filter((d) => d?.lng != null && d?.lat != null)
      .sort((a, b) => b.usedAt - a.usedAt)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentDestination(
  dest: Omit<RecentDestination, "usedAt" | "id"> & { id?: string },
) {
  if (typeof window === "undefined") return;
  const row: RecentDestination = {
    id: dest.id || `${dest.lng.toFixed(5)},${dest.lat.toFixed(5)}`,
    label: dest.label,
    sub: dest.sub,
    lng: dest.lng,
    lat: dest.lat,
    usedAt: Date.now(),
  };
  const prev = listRecentDestinations().filter((d) => d.id !== row.id);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([row, ...prev].slice(0, MAX)),
    );
  } catch {
    /* ignore */
  }
}
