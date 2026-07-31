import { ModuleShell } from "@/components/os/ModuleShell";
import { OsAuthGate } from "@/components/os/OsAuthGate";
import { messages } from "@/messages/en-KE";
import { CurationClient } from "./CurationClient";
import { listApplications, saveApplications } from "@/lib/m1-store";
import { publicId } from "@/lib/ids";
import type { CurationApplication } from "@/lib/curation-policy";

async function seedIfEmpty() {
  const existing = await listApplications();
  if (existing.length) return;
  const seed: CurationApplication[] = [
    {
      id: publicId("ven"),
      businessName: "Soko Studio",
      neighbourhood: "Ngong Road",
      contactEmail: "hello@sokostudio.ke",
      contactPhone: "+254700000001",
      categories: ["Groceries", "Fresh Produce"],
      notes: "Local produce stall applying for click & collect.",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    {
      id: publicId("ven"),
      businessName: "Kawa Collective",
      neighbourhood: "Loresho",
      contactEmail: "hello@kawa.ke",
      contactPhone: "+254700000002",
      categories: ["Pantry", "Beverages"],
      notes: "Specialty tea and pantry staples.",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ];
  await saveApplications(seed);
}

export default async function OsCurationPage() {
  await seedIfEmpty();

  return (
    <ModuleShell
      title={messages.os.curation}
      description="Manual admission against Chapter 01 criteria. Every decision records who, when, and why."
      live
    >
      <OsAuthGate title="Sign in to curate" description="Admit and reject decisions require a Clerk session — same account as admin.">
        <CurationClient />
      </OsAuthGate>
    </ModuleShell>
  );
}
