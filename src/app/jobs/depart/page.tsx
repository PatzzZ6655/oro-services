import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { DepartScreen } from "@/components/jobs/depart-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "Depart" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="Depart"><Spinner label="Opening" /></Screen>}>
      <Authed>
        <DepartScreen />
      </Authed>
    </Suspense>
  );
}
