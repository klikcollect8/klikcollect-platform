import { cn } from "@/lib/utils";

/** Hompage-aligned status chip - hairline, no pill chrome */
const TONES: Record<string, string> = {
  pending: "text-black/55",
  confirmed: "text-black",
  preparing: "text-black",
  ready: "text-black",
  collected: "text-black/55",
  cancelled: "text-black/40",
  admitted: "text-black",
  rejected: "text-black/45",
  active: "text-black",
  published: "text-black",
  draft: "text-black/45",
  low: "text-black/55",
  out: "text-black/40",
  ok: "text-black",
  invited: "text-black/55",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-black/10 bg-transparent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
        TONES[status.toLowerCase()] || "text-black/45",
        className,
      )}
    >
      {label || status}
    </span>
  );
}
