import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { ApplyVoucherScreen } from "@/components/jobs/apply-voucher-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "Apply voucher" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="Apply voucher"><Spinner label="Opening" /></Screen>}>
      <Authed>
        <ApplyVoucherScreen />
      </Authed>
    </Suspense>
  );
}
