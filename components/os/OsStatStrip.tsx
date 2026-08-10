import { cn } from "@/lib/utils";
import { OsStat } from "@/components/os/OsPanel";

export type OsStatItem = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "good";
};

/**
 * Stats with breathing room: 2-up on mobile, expands on larger screens.
 * Prefer 2–3 items on phone; pass more only when needed on desktop.
 */
export function OsStatStrip({
  items,
  className,
}: {
  items: OsStatItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-x-10",
        items.length >= 3 && "lg:grid-cols-3",
        items.length >= 4 && "xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <OsStat
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
