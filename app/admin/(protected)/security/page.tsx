"use client";

import { useEffect, useState } from "react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";

export default function AdminSecurityPage() {
  const [keys, setKeys] = useState<
    {
      id: string;
      name: string;
      key_prefix: string;
      revoked_at: string | null;
    }[]
  >([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const load = () =>
    void fetch("/api/admin/api-keys")
      .then((r) => r.json())
      .then((j) => setKeys(j.data || []));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (j.data?.secret) setCreated(j.data.secret);
    load();
  };

  return (
    <AccessControl
      allowedRoles={["super_admin", "platform_admin"]}
      requiredPermission="security:center"
    >
      <PageContainer>
        <PageHeader
          title="Security Center"
          description="API keys, access posture, and integration secrets (shown once)."
        />
        <div className="mt-8 flex gap-3 border border-black/10 bg-white p-6">
          <input
            className="flex-1 border-b border-black/15 py-2 outline-none"
            placeholder="Key name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void create()}
            className="bg-black px-4 py-2 text-[12px] uppercase tracking-wider text-white"
          >
            Create key
          </button>
        </div>
        {created ? (
          <p className="mt-4 border border-black/10 bg-white px-4 py-3 text-[13px]">
            Copy secret now: <code className="break-all">{created}</code>
          </p>
        ) : null}
        <div className="mt-6 border border-black/10 bg-white divide-y divide-black/[0.06]">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
            >
              <span>{k.name}</span>
              <span className="font-mono text-black/50">{k.key_prefix}…</span>
              <span className="text-black/40">
                {k.revoked_at ? "revoked" : "active"}
              </span>
              {!k.revoked_at ? (
                <button
                  type="button"
                  className="text-[11px] uppercase tracking-wider underline text-black/50"
                  onClick={() =>
                    void fetch("/api/admin/api-keys", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: k.id }),
                    }).then(load)
                  }
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </PageContainer>
    </AccessControl>
  );
}
