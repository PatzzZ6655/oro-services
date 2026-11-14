"use client";

import { useSyncExternalStore } from "react";

export type FormDefaults = {
  name: string;
  date: string;
  time: string;
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("oro-prefill", onStoreChange);
  return () => window.removeEventListener("oro-prefill", onStoreChange);
}

export function useStored(key: string, initial = ""): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(key) ?? initial,
    () => initial,
  );
  return [
    value,
    (next) => {
      window.sessionStorage.setItem(key, next);
      window.dispatchEvent(new Event("oro-prefill"));
    },
  ];
}
