import Link from "next/link";
import { OsEmpty } from "@/components/os/OsPanel";
import { osUi } from "@/components/os/os-ui";

/** Empty state with a single clear primary CTA. */
export function OsEmptyState({
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const action =
    actionLabel && actionHref ? (
      <Link href={actionHref} className={osUi.btnPrimary}>
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <button type="button" onClick={onAction} className={osUi.btnPrimary}>
        {actionLabel}
      </button>
    ) : undefined;

  return <OsEmpty title={title} body={body} action={action} />;
}
