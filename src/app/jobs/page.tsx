import { Suspense } from "react";
import type { Metadata } from "next";
import { Authed } from "@/app/jobs/authed";
import { HomeScreen } from "@/components/jobs/home-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = { title: "Jobs" };

export default function Page() {
  return (
    <Suspense fallback={<Screen title="Jobs"><Spinner label="Opening" /></Screen>}>
      <Authed>
        <HomeScreen />
      </Authed>
    </Suspense>
  );
}
