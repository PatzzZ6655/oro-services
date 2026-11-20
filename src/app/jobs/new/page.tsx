import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { NewJobScreen } from "@/components/jobs/new-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "New job" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="New job"><Spinner label="Opening" /></Screen>}>
      <Authed>
        <NewJobScreen />
      </Authed>
    </Suspense>
  );
}
