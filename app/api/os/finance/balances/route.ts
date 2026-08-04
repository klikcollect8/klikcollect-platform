import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import {
  getVendorPayableBalance,
  listAccountBalances,
} from "@/lib/ledger/balances";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("ledger:view", {
    vendorId: vendorId || undefined,
  });
  if (!gate.ok) return gate.response;

  const scope = vendorId || gate.actor.vendorIds[0];
  if (!scope) {
    return NextResponse.json({ data: { availableMinor: 0, accounts: [] } });
  }

  const [availableMinor, accounts] = await Promise.all([
    getVendorPayableBalance(scope),
    listAccountBalances({ vendorPublicId: scope }),
  ]);

  return NextResponse.json({
    data: {
      vendorId: scope,
      availableMinor,
      accounts,
    },
  });
}
