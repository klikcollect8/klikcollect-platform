import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";

/** Append-only double-entry post. Never updates/deletes entries. */
export async function postLedgerTransaction(input: {
  type: string;
  referenceType?: string;
  referenceId?: string | null;
  idempotencyKey: string;
  legs: {
    accountCode: string;
    amountMinor: number;
    vendorPublicId?: string | null;
    ownerType?: string;
  }[];
}): Promise<
  { ok: true; transactionId: string } | { ok: false; error: string }
> {
  const supabase = getServiceSupabase();

  const { data: existing } = await supabase
    .from("ledger_transactions")
    .select("id")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, transactionId: existing.id };
  }

  const sum = input.legs.reduce((a, l) => a + l.amountMinor, 0);
  if (sum !== 0) {
    return { ok: false, error: "Ledger legs must balance to zero" };
  }

  const txPublic = publicId("ltx");
  const { data: tx, error: txErr } = await supabase
    .from("ledger_transactions")
    .insert({
      public_id: txPublic,
      idempotency_key: input.idempotencyKey,
      transaction_type: input.type,
      reference_type: input.referenceType || null,
      // Column is uuid - only pass when caller supplies a valid uuid
      reference_id:
        input.referenceId && /^[0-9a-f-]{36}$/i.test(input.referenceId)
          ? input.referenceId
          : null,
    })
    .select("id")
    .single();

  if (txErr || !tx) {
    // Concurrent capture: unique idempotency_key → treat as success
    if (txErr?.code === "23505") {
      const { data: again } = await supabase
        .from("ledger_transactions")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (again?.id) {
        return { ok: true, transactionId: again.id };
      }
    }
    return {
      ok: false,
      error: txErr?.message || "Failed to create transaction",
    };
  }

  for (const leg of input.legs) {
    let accountId: string | null = null;
    const { data: acct } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("code", leg.accountCode)
      .maybeSingle();

    if (acct?.id) {
      accountId = acct.id;
    } else {
      const { data: created, error: cErr } = await supabase
        .from("ledger_accounts")
        .insert({
          code: leg.accountCode,
          name: leg.accountCode,
          currency_code: "KES",
          owner_type: leg.ownerType || "platform",
          vendor_public_id: leg.vendorPublicId || null,
        })
        .select("id")
        .single();
      if (cErr || !created) {
        return { ok: false, error: cErr?.message || "Account create failed" };
      }
      accountId = created.id;
    }

    const entryRow: Record<string, unknown> = {
      transaction_id: tx.id,
      account_id: accountId,
      currency_code: "KES",
      amount_minor: leg.amountMinor,
    };
    if (leg.vendorPublicId) {
      entryRow.vendor_public_id = leg.vendorPublicId;
    }
    const { error: eErr } = await supabase
      .from("ledger_entries")
      .insert(entryRow);
    if (eErr) {
      return { ok: false, error: eErr.message };
    }
  }

  return { ok: true, transactionId: tx.id };
}

export async function listLedgerTransactions(limit = 50) {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("ledger_transactions")
    .select(
      "id, public_id, transaction_type, reference_type, created_at, idempotency_key",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

/** Vendor-scoped statement rows via ledger_entries.vendor_public_id. */
export async function listVendorLedgerTransactions(
  vendorPublicId: string,
  limit = 40,
) {
  if (!vendorPublicId) return [];
  const supabase = getServiceSupabase();
  const { data: entries } = await supabase
    .from("ledger_entries")
    .select("transaction_id, amount_minor, created_at")
    .eq("vendor_public_id", vendorPublicId)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, 40));

  if (!entries?.length) return [];

  const amounts = new Map<string, number>();
  const order: string[] = [];
  for (const e of entries) {
    const tid = String(e.transaction_id);
    if (!amounts.has(tid)) order.push(tid);
    amounts.set(tid, (amounts.get(tid) || 0) + Number(e.amount_minor || 0));
  }
  const txIds = order.slice(0, limit);
  const { data: txs } = await supabase
    .from("ledger_transactions")
    .select(
      "id, public_id, transaction_type, reference_type, created_at, idempotency_key",
    )
    .in("id", txIds);

  const byId = new Map((txs || []).map((t) => [String(t.id), t]));
  return txIds.flatMap((id) => {
    const t = byId.get(id);
    if (!t) return [];
    return [
      {
        ...t,
        amount_minor: amounts.get(id) || 0,
      },
    ];
  });
}

export async function listSettlements(vendorPublicId?: string) {
  const supabase = getServiceSupabase();
  let q = supabase
    .from("settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (vendorPublicId) q = q.eq("vendor_public_id", vendorPublicId);
  const { data } = await q;
  return data || [];
}

export async function listPayouts(vendorPublicId?: string) {
  const supabase = getServiceSupabase();
  let q = supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (vendorPublicId) q = q.eq("vendor_public_id", vendorPublicId);
  const { data } = await q;
  return data || [];
}
