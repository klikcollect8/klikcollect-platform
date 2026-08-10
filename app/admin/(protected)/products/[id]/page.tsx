"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import ProductCreateWizard from "@/components/admin/catalogue/ProductCreateWizard";
import { adminUi } from "@/components/admin/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

const TABS = [
  "Overview",
  "Content",
  "Media",
  "Variants",
  "Offers",
  "Inventory",
  "SEO",
  "Merchandising",
  "Audit",
] as const;

type Tab = (typeof TABS)[number];

export default function AdminProductDetailPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <Suspense fallback={<div className="p-10 text-black/40">Loading…</div>}>
        <ProductDetail />
      </Suspense>
    </AccessControl>
  );
}

function ProductDetail() {
  const params = useParams();
  const id = String(params.id || "");
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("Overview");
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/catalogue/products/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setProduct(data.product);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <PageContainer>
        <AdminPageHeader title="Product" />
        <p className="text-black/40">Loading…</p>
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer>
        <AdminPageHeader title="Product" />
        <p className="text-black/40">Product not found.</p>
        <Link href="/admin/products" className={cn(adminUi.btnSecondary, "mt-4")}>
          Back to catalogue
        </Link>
      </PageContainer>
    );
  }

  const media = (product.media as Array<{ url: string; role: string }>) || [];
  const variants =
    (product.variants as Array<{
      id: string;
      title: string;
      sku?: string;
      barcode?: string;
      status?: string;
    }>) || [];
  const offers =
    (product.offers as Array<{
      id: string;
      vendorName?: string;
      priceMinor: number;
      stock: number;
      status: string;
    }>) || [];
  const audit =
    (product.audit as Array<{
      id: string;
      action: string;
      actorEmail?: string;
      createdAt: string;
      reason?: string;
    }>) || [];

  return (
    <PageContainer>
      <AdminPageHeader
        title={String(product.name || "Product")}
        description={`${product.sku || "No SKU"} · ${String(product.status || "").replace("_", " ")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/products" className={adminUi.btnGhost}>
              Catalogue
            </Link>
            <button
              type="button"
              className={adminUi.btnSecondary}
              onClick={() => setEditOpen(true)}
            >
              Continue editing
            </button>
            <Link
              href={`/products/${product.slug || product.id}`}
              className={adminUi.btnPrimary}
            >
              Preview storefront
            </Link>
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap gap-1 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-3 text-[12px] font-medium uppercase tracking-[0.14em]",
              tab === t ? "text-black" : "text-black/35 hover:text-black",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid gap-8 lg:grid-cols-[160px_1fr]">
          <div className="relative h-40 w-40 bg-black/[0.04]">
            {product.image ? (
              <Image
                src={String(product.image)}
                alt=""
                fill
                className="object-cover"
                sizes="160px"
              />
            ) : null}
          </div>
          <dl className="space-y-3 text-[14px]">
            <Info
              label="Type"
              value={String(product.productKind || "branded").replace(/_/g, " ")}
            />
            <Info label="Sale unit" value={String(product.saleUnit || "each")} />
            <Info label="Brand" value={String(product.brandName || "—")} />
            <Info label="Category" value={String(product.categoryName || "—")} />
            <Info label="Barcode" value={String(product.barcode || "—")} />
            <Info
              label="Guide start"
              value={
                product.guidePriceMinMinor != null
                  ? `KSh ${Math.round(Number(product.guidePriceMinMinor) / 100).toLocaleString()}`
                  : "—"
              }
            />
            <Info
              label="Guide average"
              value={
                product.guidePriceAvgMinor != null
                  ? `KSh ${Math.round(Number(product.guidePriceAvgMinor) / 100).toLocaleString()}`
                  : "—"
              }
            />
            <Info
              label="Guide end"
              value={
                product.guidePriceMaxMinor != null
                  ? `KSh ${Math.round(Number(product.guidePriceMaxMinor) / 100).toLocaleString()}`
                  : "—"
              }
            />
            <Info label="Version" value={String(product.version || 1)} />
            <Info
              label="Offers"
              value={`${offers.length} vendor offer${offers.length === 1 ? "" : "s"}`}
            />
          </dl>
        </div>
      ) : null}

      {tab === "Content" ? (
        <div className="space-y-6 max-w-2xl">
          <Block title="Short description">{String(product.description || "")}</Block>
          <Block title="Long description">
            <div
              className="prose prose-sm max-w-none text-black/70"
              dangerouslySetInnerHTML={{
                __html: String(product.longDescription || "<p>—</p>"),
              }}
            />
          </Block>
          <Block title="Specifications">
            <pre className="whitespace-pre-wrap text-[13px] text-black/60">
              {JSON.stringify(product.specs || [], null, 2)}
            </pre>
          </Block>
        </div>
      ) : null}

      {tab === "Media" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m, i) => (
            <div key={i} className="border border-black/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="aspect-square w-full object-cover" />
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-black/40">
                {m.role}
              </p>
            </div>
          ))}
          {!media.length ? <p className="text-black/40">No media yet.</p> : null}
        </div>
      ) : null}

      {tab === "Variants" ? (
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/10 text-[11px] uppercase tracking-[0.14em] text-black/35">
              <th className="py-2">Variant</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Barcode</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-b border-black/[0.06]">
                <td className="py-2">{v.title}</td>
                <td className="py-2 text-black/55">{v.sku || "—"}</td>
                <td className="py-2 text-black/55">{v.barcode || "—"}</td>
                <td className="py-2 text-black/55">{v.status || "active"}</td>
              </tr>
            ))}
            {!variants.length ? (
              <tr>
                <td colSpan={4} className="py-8 text-black/40">
                  No variants yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}

      {tab === "Offers" ? (
        <div className="space-y-3">
          {offers.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] py-3"
            >
              <div>
                <p className="font-medium text-black">{o.vendorName || "Vendor"}</p>
                <p className="text-[12px] text-black/40">{o.status}</p>
              </div>
              <div className="text-right text-[14px]">
                <p>KSh {Math.round(o.priceMinor / 100).toLocaleString()}</p>
                <p className="text-black/45">Stock {o.stock}</p>
              </div>
            </div>
          ))}
          {!offers.length ? (
            <p className="text-black/40">No vendor offers yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "Inventory" ? (
        <p className="text-[14px] text-black/50">
          Stock is tracked per vendor offer. Movements are recorded when offers are
          adjusted, sold, or corrected. Open Offers to inspect current on-hand levels.
        </p>
      ) : null}

      {tab === "SEO" ? (
        <dl className="max-w-xl space-y-3 text-[14px]">
          <Info label="Slug" value={`/products/${String(product.slug || "")}`} />
          <Info label="SEO title" value={String(product.seoTitle || "—")} />
          <Info
            label="Meta description"
            value={String(product.seoDescription || "—")}
          />
        </dl>
      ) : null}

      {tab === "Merchandising" ? (
        <dl className="max-w-xl space-y-3 text-[14px]">
          <Info label="Featured" value={product.featured ? "Yes" : "No"} />
          <Info
            label="Search visible"
            value={product.searchVisible === false ? "No" : "Yes"}
          />
        </dl>
      ) : null}

      {tab === "Audit" ? (
        <ul className="space-y-3">
          {audit.map((a) => (
            <li key={a.id} className="border-b border-black/[0.06] py-3 text-[13px]">
              <p className="font-medium text-black">{a.action}</p>
              <p className="mt-1 text-black/40">
                {a.actorEmail || "system"} · {new Date(a.createdAt).toLocaleString()}
              </p>
              {a.reason ? (
                <p className="mt-1 text-black/50">Reason: {a.reason}</p>
              ) : null}
            </li>
          ))}
          {!audit.length ? (
            <p className="text-black/40">No audit events yet.</p>
          ) : null}
        </ul>
      ) : null}

      <ProductCreateWizard
        open={editOpen}
        initialProductId={id}
        onClose={() => {
          setEditOpen(false);
          void load();
        }}
      />
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-black/[0.06] py-2">
      <dt className="text-black/40">{label}</dt>
      <dd className="text-right text-black">{value}</dd>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={adminUi.sectionLabel}>{title}</p>
      <div className="mt-2 text-[14px] text-black/70">{children}</div>
    </div>
  );
}
