import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/os/StatusBadge";

/** Tap-friendly list row for mobile-first OS screens. */
export function OsListRow({
  href,
  title,
  meta,
  status,
  statusLabel,
  leading,
  onClick,
  className,
}: {
  href?: string;
  title: string;
  meta?: string;
  status?: string;
  statusLabel?: string;
  leading?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight text-black sm:text-[16px]">
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-[13px] text-black/40">{meta}</p>
        ) : null}
      </div>
      {status ? (
        <StatusBadge status={status} label={statusLabel || status} />
      ) : null}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-black/20"
        strokeWidth={1.5}
        aria-hidden
      />
    </>
  );

  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 border-b border-black/10 py-3.5 text-left transition-opacity hover:opacity-70",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}
