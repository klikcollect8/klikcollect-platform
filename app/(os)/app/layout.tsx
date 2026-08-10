import { AppShell } from "@/components/os/AppShell";
import { VendorAccessGate } from "@/components/os/VendorAccessGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorAccessGate>
      <AppShell>{children}</AppShell>
    </VendorAccessGate>
  );
}
