"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Same red treatment as the SMS reply helper. */
export const errorBannerClass = "rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800";
export const errorReasonClass = "text-sm text-red-800";

export function ErrorBanner({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!message) return;
    ref.current?.scrollIntoView({ block: "center" });
  }, [message]);
  if (!message) return null;
  return (
    <p ref={ref} role="alert" className={errorBannerClass}>
      {message}
    </p>
  );
}

export function FieldReason({ message }: { message: string }) {
  if (!message) return null;
  return <p className={errorReasonClass}>{message}</p>;
}

/** Scrolls and focuses the first invalid section. A red border is applied by the caller. */
export function Marked({
  active,
  className = "",
  children,
}: {
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    ref.current?.scrollIntoView({ block: "center" });
    const focusable = ref.current?.querySelector<HTMLElement>("input, textarea, select, button");
    (focusable ?? ref.current)?.focus({ preventScroll: true });
  }, [active]);
  return (
    <div ref={ref} tabIndex={-1} className={`outline-none ${className}`}>
      {children}
    </div>
  );
}

export function redBorder(className: string, on: boolean): string {
  return on ? className.replaceAll("border-black", "border-red-600") : className;
}
