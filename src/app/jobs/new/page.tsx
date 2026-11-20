import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { NewJobScreen } from "@/components/jobs/new-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "新工单" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="新工单"><Spinner label="正在打开" /></Screen>}>
      <Authed>
        <NewJobScreen />
      </Authed>
    </Suspense>
  );
}
