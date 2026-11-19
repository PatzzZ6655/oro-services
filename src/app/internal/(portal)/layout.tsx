import { Suspense, type ReactNode } from "react";
import { PortalFallback } from "@/components/internal/portal-frame";
import { requireUser } from "@/lib/auth/current";

async function Guard({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}
