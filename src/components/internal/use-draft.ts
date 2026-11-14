"use client";

import { useEffect, useRef, type RefObject } from "react";
import { applyDraft, clearFormDraft, loadFormDraft, saveFormDraft } from "@/components/internal/draft-store";

export function useFormDraft(key: string, formRef: RefObject<HTMLFormElement | null>, clear: boolean) {
  const restored = useRef(false);

  useEffect(() => {
    if (clear) {
      void clearFormDraft(key).catch(() => undefined);
      return;
    }
    let cancel = false;
    void loadFormDraft(key)
      .then((draft) => {
        if (cancel || !draft || restored.current || !formRef.current) return;
        restored.current = true;
        applyDraft(formRef.current, draft);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [key, clear, formRef]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || clear) return;
    let timer = 0;
    const queue = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (formRef.current) void saveFormDraft(key, formRef.current).catch(() => undefined);
      }, 500);
    };
    form.addEventListener("input", queue);
    form.addEventListener("change", queue);
    return () => {
      form.removeEventListener("input", queue);
      form.removeEventListener("change", queue);
      window.clearTimeout(timer);
    };
  }, [key, clear, formRef]);
}
