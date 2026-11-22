"use client";

import { useEffect, type ReactNode } from "react";

export function KeepPage({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverscroll: html.style.overscrollBehaviorY,
      bodyOverscroll: body.style.overscrollBehaviorY,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y <= startY + 8) return;
      let node = event.target instanceof Element ? event.target : null;
      while (node) {
        if (node instanceof HTMLElement && node.scrollTop > 0) return;
        node = node.parentElement;
      }
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      html.style.overscrollBehaviorY = previous.htmlOverscroll;
      body.style.overscrollBehaviorY = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div data-jobs-scroll className="fixed inset-0 overflow-y-auto overscroll-y-none bg-white text-black">
      {children}
    </div>
  );
}
