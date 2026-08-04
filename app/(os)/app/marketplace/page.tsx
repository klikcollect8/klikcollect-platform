import { redirect } from "next/navigation";
import { OS_PLATFORM_REDIRECTS } from "@/components/os/nav";

export default function OsMarketplacePage() {
  redirect(OS_PLATFORM_REDIRECTS["/app/marketplace"] || "/admin/vendors");
}
