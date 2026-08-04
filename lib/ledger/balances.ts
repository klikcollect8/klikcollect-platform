import { getServiceSupabase } from "@/lib/supabase/admin";

export type AccountBalance = {
  accountId: string;
  code: string;
  name: string;
  ownerType: string;
  vendorPublicId: string | null;
  balanceMinor: number;
};

/** Sum of append-only entries per account (no mutable balance column). */
export async function listAccountBalances(opts?: {
  vendorPublicId?: string;
  codes?: string[];
}): Promise<AccountBalance[]> {
  const supabase = getServiceSupabase();

  let acctQ = supabase
    .from("ledger_accounts")
    .select("id, code, name, owner_type, vendor_public_id");

  if (opts?.vendorPublicId) {
    acctQ = acctQ.or(
      `vendor_public_id.eq.${opts.vendorPublicId},code.eq.vendor_payable_${opts.vendorPublicId}`,
    );
  }
  if (opts?.codes?.length) {
    acctQ = acctQ.in("code", opts.codes);
  }

  const { data: accounts } = await acctQ;
  if (!accounts?.length) return [];

  const ids = accounts.map((a) => a.id);
  const { data: entries } = await supabase
    .from("ledger_entries")
    .select("account_id, amount_minor")
    .in("account_id", ids);

  const sums = new Map<string, number>();
  for (const e of entries || []) {
    sums.set(
      e.account_id,
      (sums.get(e.account_id) || 0) + Number(e.amount_minor || 0),
    );
  }

  return accounts.map((a) => ({
    accountId: a.id,
    code: a.code,
    name: a.name,
    ownerType: a.owner_type,
    vendorPublicId: a.vendor_public_id,
    balanceMinor: sums.get(a.id) || 0,
  }));
}

export async function getVendorPayableBalance(
  vendorPublicId: string,
): Promise<number> {
  const code = `vendor_payable_${vendorPublicId}`;
  const balances = await listAccountBalances({
    vendorPublicId,
    codes: [code, "vendor_payable"],
  });
  const specific = balances.find((b) => b.code === code);
  if (specific) return specific.balanceMinor;
  return balances.reduce((s, b) => s + b.balanceMinor, 0);
}

export async function listPlatformBalances(): Promise<AccountBalance[]> {
  return listAccountBalances({
    codes: [
      "cash_paystack",
      "mpesa_clearing",
      "revenue_clearing",
      "vendor_payable",
      "platform_fees",
    ],
  });
}
