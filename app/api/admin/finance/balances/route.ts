import { NextResponse } from "next/server";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  listPlatformBalances,
  listAccountBalances,
} from "@/lib/ledger/balances";

export async function GET() {
  try {
    await requireAdminPermission("ledger:view");
    const [platform, vendorPayables] = await Promise.all([
      listPlatformBalances(),
      listAccountBalances(),
    ]);
    const vendorOnly = vendorPayables.filter(
      (b) =>
        b.code.startsWith("vendor_payable_") ||
        (b.vendorPublicId && b.ownerType === "vendor"),
    );
    return NextResponse.json({
      data: { platform, vendorPayables: vendorOnly },
    });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}
