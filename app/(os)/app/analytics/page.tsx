import { redirect } from "next/navigation";
import { OS_PLATFORM_REDIRECTS } from "@/components/os/nav";

export default function AnalyticsPage() {
  redirect(OS_PLATFORM_REDIRECTS["/app/analytics"] || "/admin/analytics");
}
