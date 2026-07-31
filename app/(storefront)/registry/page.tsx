import Link from "next/link";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

export default function RegistryPage() {
  return (
    <StorePage narrow>
      <StoreHeading
        eyebrow="Coming soon"
        title="Registry"
        description="Gift registries are post-V1. Shop groceries and essentials for now."
      />
      <Link
        href="/shop"
        className="inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
      >
        Browse shop
      </Link>
    </StorePage>
  );
}
