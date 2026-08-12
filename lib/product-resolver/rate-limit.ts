type Bucket = {
  tokens: number;
  lastRefill: number;
  failures: number;
  openUntil: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_RPM = 30;
const CIRCUIT_FAILURES = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;

function bucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: DEFAULT_RPM, lastRefill: Date.now(), failures: 0, openUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function refill(b: Bucket, rpm: number) {
  const now = Date.now();
  const elapsed = now - b.lastRefill;
  if (elapsed <= 0) return;
  const add = (elapsed / 60_000) * rpm;
  b.tokens = Math.min(rpm, b.tokens + add);
  b.lastRefill = now;
}

export function canCallProvider(
  provider: string,
  opts?: { rpm?: number },
): { ok: boolean; reason?: string } {
  const rpm = opts?.rpm ?? DEFAULT_RPM;
  const b = bucket(provider);
  if (Date.now() < b.openUntil) {
    return { ok: false, reason: "circuit_open" };
  }
  refill(b, rpm);
  if (b.tokens < 1) {
    return { ok: false, reason: "rate_limited" };
  }
  b.tokens -= 1;
  return { ok: true };
}

export function recordProviderSuccess(provider: string) {
  const b = bucket(provider);
  b.failures = 0;
}

export function recordProviderFailure(provider: string) {
  const b = bucket(provider);
  b.failures += 1;
  if (b.failures >= CIRCUIT_FAILURES) {
    b.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    b.failures = 0;
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "timeout",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 8_000;
  const retries = opts?.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(fetch(url, init), timeoutMs, "timeout");
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
