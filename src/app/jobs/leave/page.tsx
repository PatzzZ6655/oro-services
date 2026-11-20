import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { LeaveScreen } from "@/components/jobs/leave-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "Leave" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="Leave"><Spinner label="Opening" /></Screen>}>
      <Authed>
        <LeaveScreen />
      </Authed>
    </Suspense>
  );
}
