"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import {
  MVP_VENDOR_INVITE_LABELS,
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
  const [role, setRole] = useState<StaffMembershipRole | "">("");
  const [vendorId, setVendorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [roles, setRoles] = useState<StaffMembershipRole[]>([]);

  const applyInviteable = (inviteable: unknown) => {
    if (!Array.isArray(inviteable)) {
      setRoles([]);
      setRole("");
      setRolesLoaded(true);
      return;
    }
    const next = inviteable as StaffMembershipRole[];
    setRoles(next);
    setRole(next[0] || "");
    setRolesLoaded(true);
  };

  const load = async (vid?: string) => {
    const q = vid ? `?vendorId=${encodeURIComponent(vid)}` : "";
    const res = await fetch(`/api/os/staff${q}`);
    const json = await res.json();
    if (res.ok) {
      setMembers(json.data || []);
      if (Array.isArray(json.inviteableRoles)) {
        applyInviteable(json.inviteableRoles);
      }
    } else setError(json.error?.message || "Failed to load staff");
  };

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((body) => {
        const id = body?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        applyInviteable(body?.data?.inviteableRoles);
        void load(id);
      })
      .catch(() => {
        setRolesLoaded(true);
        setError("Could not load your account");
      });
  }, []);

  const invite = async () => {
    if (!role) {
      setError("Select a role you are allowed to invite");
      return;
    }
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
      description="Invite people inside your organisation only. They can never get platform admin powers."
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
              disabled={!rolesLoaded}
            />
            <select
              className={osUi.input}
              value={role}
              disabled={!rolesLoaded || !roles.length}
              onChange={(e) => setRole(e.target.value as StaffMembershipRole)}
            >
              {!rolesLoaded ? (
                <option value="">Loading roles…</option>
              ) : !roles.length ? (
                <option value="">No inviteable roles</option>
              ) : (
                roles.map((r) => (
                  <option key={r} value={r}>
                    {r in MVP_VENDOR_INVITE_LABELS
                      ? MVP_VENDOR_INVITE_LABELS[
                          r as keyof typeof MVP_VENDOR_INVITE_LABELS
                        ]
                      : r.replace(/_/g, " ")}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={
                busy || !email || !vendorId || !role || !rolesLoaded
              }
              onClick={() => void invite()}
              className={cn(osUi.btnPrimary, "disabled:opacity-40")}
            >
              Invite
            </button>
          </div>
          {rolesLoaded && !roles.length ? (
            <p className="mt-3 text-[13px] text-[var(--kc-mute)]">
              Your role cannot invite staff. Ask a store owner or manager.
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-[13px] text-[#8e1b0d]">{error}</p>
          ) : null}
        </OsPanel>

        <OsPanel padded={false}>
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-black/10 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
              <tr>
                <th className="px-3 py-3 font-medium sm:px-4">Email</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-black/[0.06]">
                  <td className="px-3 py-3.5 font-medium text-black sm:px-4">
                    {m.email || m.clerk_user_id}
                  </td>
                  <td className="py-3.5 capitalize text-black/55">
                    {m.role.replace(/_/g, " ")}
                  </td>
                  <td className="py-3.5 text-[12px] uppercase tracking-[0.1em] text-black/40">
                    {m.status}
                  </td>
                  <td className="py-3.5 pr-3 text-right sm:pr-4">
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
