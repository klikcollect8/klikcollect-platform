import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { actorVendorIds } from "@/lib/authz/actor";
import { listApplicationsForUser } from "@/lib/m1-store";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { softOpenDemoVendor } from "@/lib/authz/rbac-env";

/**
 * Server gate for /app: require an active staff membership on an admitted vendor.
 * Unapproved applicants see review / verification messaging.
 */
export async function VendorAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) {
    return (
      <GateShell
        title="Sign in required"
        body="Sign in with the account that owns or was invited to a vendor business."
        ctaHref="/sign-in?redirect=/app&redirect_url=/app"
        ctaLabel="Sign in"
      />
    );
  }

  const actor = await resolveActor(user);
  const vendorIds = actorVendorIds(actor);

  if (vendorIds.length) {
    // Soft-open / demo tenant may not exist as an admitted vendors row.
    if (
      vendorIds.includes(DEMO_VENDOR_ID) &&
      (softOpenDemoVendor() || process.env.NODE_ENV !== "production")
    ) {
      return <>{children}</>;
    }

    try {
      const sb = getServiceSupabase();
      const { data } = await sb
        .from("vendors")
        .select("public_id, status, name")
        .in("public_id", vendorIds)
        .eq("status", "admitted")
        .limit(1);
      if (data?.length) {
        return <>{children}</>;
      }

      // Local/dev: membership exists but vendor row missing — allow shell; APIs enforce.
      if (process.env.NODE_ENV !== "production") {
        return <>{children}</>;
      }

      return (
        <GateShell
          title="Business suspended"
          body="Your vendor account is not active. Contact KlikCollect support if you believe this is an error."
          ctaHref="/help"
          ctaLabel="Get help"
        />
      );
    } catch {
      // If DB check fails, allow shell (APIs still enforce)
      return <>{children}</>;
    }
  }

  if (actor.isPlatformStaff) {
    return (
      <GateShell
        title="Platform operators use Admin"
        body="Vendor workspace requires a staff membership on an approved vendor. Use the platform admin console for marketplace operations."
        ctaHref="/admin"
        ctaLabel="Open Admin"
      />
    );
  }

  let pending = false;
  try {
    const apps = await listApplicationsForUser(user.id);
    pending = apps.some((a) => a.status === "pending");
  } catch {
    /* ignore */
  }

  if (pending) {
    return (
      <GateShell
        title="Application under review"
        body="Thanks for applying to sell on KlikCollect. We’ll email you when your business is approved. You can track your application from your account."
        ctaHref="/account"
        ctaLabel="View account"
      />
    );
  }

  return (
    <GateShell
      title="Complete your business verification"
      body="You don’t have an active vendor workspace yet. Apply to sell, or accept a staff invite from your business owner."
      ctaHref="/sell"
      ctaLabel="Apply to sell"
      secondaryHref="/account"
      secondaryLabel="Account"
    />
  );
}

function GateShell({
  title,
  body,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--kc-canvas,#f7f7f5)] px-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
          Vendor workspace
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-black">
          {title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-black/55">{body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={ctaHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white"
          >
            {ctaLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 items-center justify-center text-[13px] font-medium text-black/55"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
