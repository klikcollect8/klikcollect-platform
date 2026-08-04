import crypto from "crypto";

const BASE = "https://api.paystack.co";

export function paystackSecretKey(): string {
  const live = process.env.PAYSTACK_LIVE_ENABLED === "true";
  const key =
    (live ? process.env.PAYSTACK_SECRET_KEY : null) ||
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY ||
    "";
  if (!key) {
    throw new Error("Missing PAYSTACK_SECRET_KEY / PAYSTACK_TEST_SECRET_KEY");
  }
  if (live && key.startsWith("sk_test_")) {
    // allow test even if flag set in local
  }
  return key;
}

export function paystackPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || null;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json()) as {
    status: boolean;
    message: string;
    data: T;
  };
  if (!res.ok || !body.status) {
    throw new Error(body.message || `Paystack error ${res.status}`);
  }
  return body.data;
}

export type InitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaymentChannel = "card" | "mobile_money" | "bank" | "ussd";

export async function initializeTransaction(input: {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  /** Paystack channels - use mobile_money for M-Pesa STK via Paystack */
  channels?: PaymentChannel[];
  /** Kenya M-Pesa phone as 2547… */
  phone?: string;
}): Promise<InitializeResult> {
  const channels = input.channels?.length
    ? input.channels
    : (["card", "mobile_money"] as PaymentChannel[]);

  const payload: Record<string, unknown> = {
    email: input.email,
    amount: input.amountMinor,
    currency: "KES",
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
    channels,
  };

  // Hint mobile money provider when M-Pesa-only (Paystack hosted/inline collects PIN)
  if (channels.includes("mobile_money") && input.phone) {
    payload.mobile_money = {
      phone: input.phone,
      provider: "mpesa",
    };
  }

  return paystackFetch<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type VerifyResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer?: { email?: string };
  metadata?: Record<string, unknown>;
};

export async function verifyTransaction(
  reference: string,
): Promise<VerifyResult> {
  return paystackFetch<VerifyResult>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export async function createRefund(input: {
  transaction: string;
  amountMinor?: number;
}): Promise<unknown> {
  return paystackFetch("/refund", {
    method: "POST",
    body: JSON.stringify({
      transaction: input.transaction,
      amount: input.amountMinor,
      currency: "KES",
    }),
  });
}

export async function initiateTransfer(input: {
  amountMinor: number;
  recipient: string;
  reference: string;
  reason?: string;
}): Promise<{ transfer_code: string; status: string }> {
  return paystackFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountMinor,
      recipient: input.recipient,
      reference: input.reference,
      reason: input.reason,
      currency: "KES",
    }),
  });
}

export async function createTransferRecipient(input: {
  type: "nuban" | "mobile_money" | "basa";
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
}): Promise<{
  recipient_code: string;
  type: string;
  name: string;
  details: unknown;
}> {
  return paystackFetch("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: input.type,
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency || "KES",
    }),
  });
}

export async function listBanks(
  country = "kenya",
): Promise<
  { name: string; code: string; active: boolean; currency: string }[]
> {
  return paystackFetch(`/bank?country=${encodeURIComponent(country)}`);
}

export type PaystackBalanceRow = {
  currency: string;
  balance: number;
};

export async function fetchPaystackBalance(): Promise<PaystackBalanceRow[]> {
  return paystackFetch<PaystackBalanceRow[]>("/balance");
}

export type PaystackTransactionRow = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string | null;
  created_at?: string;
  customer?: { email?: string; customer_code?: string };
  gateway_response?: string;
  metadata?: Record<string, unknown> | null;
};

export async function listTransactions(opts?: {
  perPage?: number;
  page?: number;
  status?: string;
}): Promise<PaystackTransactionRow[]> {
  const params = new URLSearchParams();
  params.set("perPage", String(opts?.perPage ?? 25));
  params.set("page", String(opts?.page ?? 1));
  if (opts?.status) params.set("status", opts.status);
  return paystackFetch<PaystackTransactionRow[]>(
    `/transaction?${params.toString()}`,
  );
}

export type PaystackTransferRow = {
  id: number;
  transfer_code: string;
  amount: number;
  currency: string;
  status: string;
  reference?: string;
  reason?: string;
  createdAt?: string;
  created_at?: string;
  recipient?: { name?: string; recipient_code?: string };
};

export async function listTransfers(opts?: {
  perPage?: number;
  page?: number;
}): Promise<PaystackTransferRow[]> {
  const params = new URLSearchParams();
  params.set("perPage", String(opts?.perPage ?? 20));
  params.set("page", String(opts?.page ?? 1));
  return paystackFetch<PaystackTransferRow[]>(`/transfer?${params.toString()}`);
}

/** Non-throwing env/config snapshot for admin UI (never returns secret values). */
export function paystackConfigStatus() {
  const liveEnabled = process.env.PAYSTACK_LIVE_ENABLED === "true";
  const secret =
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY ||
    "";
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || "";

  const mask = (value: string) =>
    value.length > 12
      ? `${value.slice(0, 10)}…${value.slice(-4)}`
      : value || "(not set)";

  const keyMode = (key: string, prefix: "sk" | "pk") => {
    if (key.startsWith(`${prefix}_live_`)) return "live" as const;
    if (key.startsWith(`${prefix}_test_`)) return "test" as const;
    return key ? ("unknown" as const) : ("missing" as const);
  };

  return {
    configured: Boolean(secret && publicKey),
    liveEnabled,
    secretMode: keyMode(secret, "sk"),
    publicMode: keyMode(publicKey, "pk"),
    publicKeyMasked: mask(publicKey),
    secretConfigured: Boolean(secret),
    webhookSecretConfigured: Boolean(webhookSecret),
    webhookHmacFallback: !webhookSecret && Boolean(secret),
    channels: ["card", "mobile_money"] as const,
  };
}

export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret =
    process.env.PAYSTACK_WEBHOOK_SECRET ||
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY ||
    "";
  if (!secret || !signature) return false;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
