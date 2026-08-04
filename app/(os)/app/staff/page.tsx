"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import {
  ENABLED_STAFF_ROLES,
  STAFF_ROLE_LABELS,
  type StaffMembershipRole,
} from "@/lib/authz/role-ids";
import { osUi } from "@/components/os/os-ui";
import { OsPanel } from "@/components/os/OsPanel";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  email: string | null;
  clerk_user_id: string;
  vendor_id: string;
  store_id: string | null;
  role: string;
  status: string;
};

export default function VendorStaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffMembershipRole>("vendor_staff");
  const [vendorId, setVendorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roles = ENABLED_STAFF_ROLES;

  const load = async (vid?: string) => {
    const q = vid ? `?vendorId=${encodeURIComponent(vid)}` : "";
    const res = await fetch(`/api/os/staff${q}`);
    const json = await res.json();
    if (res.ok) setMembers(json.data || []);
    else setError(json.error?.message || "Failed to load staff");
  };

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((body) => {
        const id = body?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        void load(id);
      });
  }, []);

  const invite = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/os/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", email, role, vendorId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error?.message || "Invite failed");
      return;
    }
    setEmail("");
    void load(vendorId);
  };

  const revoke = async (clerkUserId: string) => {
    setBusy(true);
    await fetch("/api/os/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", clerkUserId, vendorId }),
    });
    setBusy(false);
    void load(vendorId);
  };

  return (
    <ModuleShell
      title="Staff"
      description="Invite people to help run this store only. Platform staff are managed in Admin."
      live
    >
      <div className="space-y-5">
        <OsPanel>
          <p className={osUi.sectionLabel}>Invite</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              className={cn(osUi.input, "flex-1")}
              placeholder="email@vendor.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className={osUi.input}
              value={role}
              onChange={(e) => setRole(e.target.value as StaffMembershipRole)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !email || !vendorId}
              onClick={() => void invite()}
              className={osUi.btnPrimary}
            >
              Invite
            </button>
          </div>
          {error ? (
            <p className="mt-3 text-[13px] text-[#8e1b0d]">{error}</p>
          ) : null}
        </OsPanel>

        <OsPanel padded={false}>
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-black/10 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
              <tr>
                <th className="py-3 font-medium">Email</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-black/[0.06]">
                  <td className="py-3.5 font-medium text-black">
                    {m.email || m.clerk_user_id}
                  </td>
                  <td className="py-3.5 capitalize text-black/55">
                    {m.role.replace(/_/g, " ")}
                  </td>
                  <td className="py-3.5 text-[12px] uppercase tracking-[0.1em] text-black/40">
                    {m.status}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void revoke(m.clerk_user_id)}
                      className="text-[12px] font-medium uppercase tracking-[0.12em] text-black/40 hover:text-black"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {!members.length ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-black/40">
                    No staff yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </OsPanel>
      </div>
    </ModuleShell>
  );
}
