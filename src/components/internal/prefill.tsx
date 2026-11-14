"use client";

import { useState, useSyncExternalStore } from "react";

export type FormDefaults = {
  name: string;
  date: string;
  time: string;
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("oro-prefill", onStoreChange);
  return () => window.removeEventListener("oro-prefill", onStoreChange);
}

export type JobPrefill = {
  id: string;
  company: "emoro" | "emporo";
  jobNumber: string;
  clientName: string;
  address: string;
};

export function useStored(key: string, initial = "", preferInitial = false): [string, (value: string) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(key) ?? "",
    () => "",
  );
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited !== null ? edited : preferInitial && initial ? initial : stored || initial;
  return [
    value,
    (next) => {
      setEdited(next);
      window.sessionStorage.setItem(key, next);
      window.dispatchEvent(new Event("oro-prefill"));
    },
  ];
}
