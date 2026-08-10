/** Local-only road reports (Waze-style). Not a crowdsourced backend. */

export type NavReportKind =
  | "hazard"
  | "police"
  | "accident"
  | "closure"
  | "traffic";

export type NavReport = {
  id: string;
  kind: NavReportKind;
  lng: number;
  lat: number;
  note?: string;
  createdAt: number;
};

const STORAGE_KEY = "klikcollect:nav-reports";
const TTL_MS = 1000 * 60 * 90; // 90 minutes

export const NAV_REPORT_LABELS: Record<NavReportKind, string> = {
  hazard: "Hazard",
  police: "Police",
  accident: "Accident",
  closure: "Road closed",
  traffic: "Heavy traffic",
};

function readAll(): NavReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NavReport[];
    const now = Date.now();
    return (Array.isArray(parsed) ? parsed : []).filter(
      (r) => r && now - r.createdAt < TTL_MS,
    );
  } catch {
    return [];
  }
}

function writeAll(rows: NavReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function listNavReports(): NavReport[] {
  return readAll();
}

export function addNavReport(
  kind: NavReportKind,
  at: { lng: number; lat: number },
  note?: string,
): NavReport {
  const report: NavReport = {
    id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind,
    lng: at.lng,
    lat: at.lat,
    note,
    createdAt: Date.now(),
  };
  const next = [report, ...readAll()].slice(0, 40);
  writeAll(next);
  return report;
}

export function clearNavReports() {
  writeAll([]);
}
