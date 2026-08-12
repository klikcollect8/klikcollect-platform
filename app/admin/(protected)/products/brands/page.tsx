"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type BrandRow = {
  public_id: string;
  name: string;
  slug: string;
  status: string;
  description?: string | null;
  country?: string | null;
  logo_url?: string | null;
  aliases?: string[] | null;
  manufacturer?: string | null;
};

const emptyForm = {
  publicId: "",
  name: "",
  description: "",
  country: "",
  logoUrl: "",
  manufacturer: "",
  aliasesText: "",
  status: "active" as "active" | "archived",
};

export default function BrandsAdminPage() {
  return (
    <AccessControl requiredPermission="brands:manage">
      <BrandsInner />
    </AccessControl>
  );
}

function BrandsInner() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/catalogue/brands?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load brands");
        return;
      }
      setBrands(data.brands || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: form.publicId || undefined,
          name: form.name,
          description: form.description || null,
          country: form.country || null,
          logoUrl: form.logoUrl || null,
          manufacturer: form.manufacturer || null,
          aliases: form.aliasesText
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const edit = (b: BrandRow) => {
    setForm({
      publicId: b.public_id,
      name: b.name,
      description: b.description || "",
      country: b.country || "",
      logoUrl: b.logo_url || "",
      manufacturer: b.manufacturer || "",
      aliasesText: (b.aliases || []).join(", "),
      status: b.status === "archived" ? "archived" : "active",
    });
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this brand?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/catalogue/brands", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Archive failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Brands"
        description="Canonical brand records and aliases for product matching."
        actions={
          <Link href="/admin/products" className={adminUi.btnGhost}>
            Catalogue
          </Link>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <input
            className={cn(adminUi.input, "mb-4 h-10")}
            placeholder="Search brands…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {error ? <p className="mb-3 text-[12px] text-red-700">{error}</p> : null}
          {loading ? (
            <p className="text-[12px] text-black/40">Loading…</p>
          ) : (
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.12em] text-black/35">
                  <th className="py-2 pr-2 font-medium">Brand</th>
                  <th className="py-2 pr-2 font-medium">Aliases</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.public_id} className="border-b border-black/[0.05]">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-black">{b.name}</p>
                      <p className="text-[11px] text-black/40">
                        {[b.country, b.manufacturer].filter(Boolean).join(" · ") ||
                          b.slug}
                      </p>
                    </td>
                    <td className="max-w-[12rem] truncate py-2 pr-2 text-black/45">
                      {(b.aliases || []).join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-2 uppercase tracking-[0.08em] text-black/40">
                      {b.status}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className={adminUi.btnGhost}
                        onClick={() => edit(b)}
                      >
                        Edit
                      </button>
                      {b.status !== "archived" ? (
                        <button
                          type="button"
                          className={adminUi.btnGhost}
                          disabled={busy}
                          onClick={() => void archive(b.public_id)}
                        >
                          Archive
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="space-y-3 border-t border-black/10 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
            {form.publicId ? "Edit brand" : "New brand"}
          </p>
          {(
            [
              ["name", "Name", form.name],
              ["country", "Country", form.country],
              ["manufacturer", "Manufacturer", form.manufacturer],
              ["logoUrl", "Logo URL", form.logoUrl],
            ] as const
          ).map(([key, label, value]) => (
            <label key={key} className="block space-y-1">
              <span className="text-[10px] uppercase tracking-[0.12em] text-black/40">
                {label}
              </span>
              <input
                className={cn(adminUi.input, "h-10")}
                value={value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-black/40">
              Description
            </span>
            <textarea
              className={cn(adminUi.input, "min-h-[72px] py-2")}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-black/40">
              Aliases (comma-separated)
            </span>
            <textarea
              className={cn(adminUi.input, "min-h-[64px] py-2")}
              placeholder="Coke, Coca Cola"
              value={form.aliasesText}
              onChange={(e) =>
                setForm((f) => ({ ...f, aliasesText: e.target.value }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className={adminUi.btnPrimary}
              disabled={busy || !form.name.trim()}
              onClick={() => void save()}
            >
              {form.publicId ? "Update" : "Create"}
            </button>
            {form.publicId ? (
              <button
                type="button"
                className={adminUi.btnGhost}
                onClick={() => setForm(emptyForm)}
              >
                Clear
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
