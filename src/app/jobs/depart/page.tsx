import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { DepartScreen } from "@/components/jobs/depart-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "出发" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="出发"><Spinner label="正在打开" /></Screen>}>
      <Authed>
        <DepartScreen />
      </Authed>
    </Suspense>
  );
}
