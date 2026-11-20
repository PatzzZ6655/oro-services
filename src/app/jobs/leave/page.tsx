import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { LeaveScreen } from "@/components/jobs/leave-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "离开" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="离开"><Spinner label="正在打开" /></Screen>}>
      <Authed>
        <LeaveScreen />
      </Authed>
    </Suspense>
  );
}
