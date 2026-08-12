import type {
  CandidateField,
  FieldConfidence,
  ProviderId,
  ProvenanceStatus,
} from "@/lib/product-resolver/types";

export function emptyField<T = string>(): CandidateField<T> {
  return {
    value: null,
    provider: null,
    confidence: "unknown",
    status: "missing",
  };
}

export function fieldFromProvider<T>(
  value: T | null | undefined,
  provider: ProviderId,
  opts?: {
    externalProductId?: string | null;
    confidence?: FieldConfidence;
    originalValue?: unknown;
  },
): CandidateField<T> {
  if (value === null || value === undefined || value === "") {
    return emptyField<T>();
  }
  return {
    value,
    provider,
    externalProductId: opts?.externalProductId ?? null,
    confidence: opts?.confidence ?? "medium",
    status: "imported",
    originalValue: opts?.originalValue ?? value,
  };
}
