"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration - safe for portals / localStorage without setState-in-effect. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
