"use client";

import { useSyncExternalStore } from "react";

export function useClientReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
