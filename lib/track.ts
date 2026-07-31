/** Client-side day-one event emitter (M1 / FR-9). Fire-and-forget. */
export function track(
  name: string,
  properties?: Record<string, unknown>,
  actorType: "customer" | "vendor" | "admin" | "anonymous" = "anonymous",
) {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, properties, actorType }),
      keepalive: true,
    });
  } catch {
    /* never block UX */
  }
}
