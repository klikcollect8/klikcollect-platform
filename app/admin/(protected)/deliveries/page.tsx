import { redirect } from "next/navigation";
import { format } from "date-fns";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { requireAdminPermission } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

type DeliveryRow = {
  public_id: string;
  order_public_id: string | null;
  vendor_public_id: string;
  driver_clerk_user_id: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
};

export default async function AdminDeliveriesPage() {
  try {
    await requireAdminPermission("delivery:view");
  } catch (e) {
    const status =
      e instanceof Error && "status" in e
        ? (e as Error & { status: number }).status
        : 500;
    if (status === 401 || status === 403) {
      redirect("/admin?error=delivery_view_denied");
    }
    throw e;
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("deliveries")
    .select(
      "public_id, order_public_id, vendor_public_id, driver_clerk_user_id, status, customer_name, customer_phone, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data || []) as DeliveryRow[];

  return (
    <PageContainer>
      <AdminPageHeader
        title="Deliveries"
        description="Recent delivery jobs — status, driver, and linked order."
      />
      <p className="mb-4 text-[13px] text-[var(--kc-mute)]">
        {error
          ? `Failed to load: ${error.message}`
          : `${rows.length} most recent`}
      </p>

      {!error && rows.length === 0 ? (
        <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-10 text-center text-[13px] text-[var(--kc-mute)]">
          No recent deliveries.
        </div>
      ) : !error ? (
        <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Driver</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--kc-line-soft)]">
              {rows.map((d) => (
                <tr key={d.public_id} className="hover:bg-[var(--kc-canvas)]">
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-[var(--kc-line)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--kc-ink)]">
                    {d.order_public_id || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {d.driver_clerk_user_id || "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--kc-ink)]">
                      {d.customer_name || "—"}
                    </div>
                    {d.customer_phone ? (
                      <div className="text-[12px] text-[var(--kc-faint)]">
                        {d.customer_phone}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {d.vendor_public_id}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {format(new Date(d.created_at), "MMM d, h:mm a")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageContainer>
  );
}
