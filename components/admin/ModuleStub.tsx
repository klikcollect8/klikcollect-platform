import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import type { PlatformRole } from "@/lib/authz/role-ids";

type Props = {
  title: string;
  description: string;
  permission: string;
  allowedRoles: PlatformRole[];
};

/** Permission-gated placeholder for Phase 2/3 modules (no money rails yet). */
export default function ModuleStub({
  title,
  description,
  permission,
  allowedRoles,
}: Props) {
  return (
    <AccessControl allowedRoles={allowedRoles} requiredPermission={permission}>
      <PageContainer>
        <PageHeader title={title} description={description} />
        <div className="mt-8 max-w-xl border border-black/10 bg-white px-6 py-10">
          <p className="text-[13px] uppercase tracking-[0.14em] text-black/35">
            Coming soon
          </p>
          <p className="mt-3 text-[15px] text-black/70">
            This module is reserved in the RBAC matrix (
            <code className="text-[13px]">{permission}</code>
            ). Product UI ships in a later milestone - M1 has no live tender.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block text-[14px] font-medium text-black underline underline-offset-4"
          >
            Back to overview
          </Link>
        </div>
      </PageContainer>
    </AccessControl>
  );
}
