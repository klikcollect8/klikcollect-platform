import { randomBytes } from "crypto";

/** Opaque public IDs - never sequential (CONVENTIONS / Ch 22). */
export function publicId(prefix: string): string {
  const body = randomBytes(9)
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 12);
  return `${prefix}_${body || randomBytes(6).toString("hex")}`;
}
