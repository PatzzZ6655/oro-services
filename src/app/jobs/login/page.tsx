import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginScreen } from "@/components/jobs/login-form";
import { Spinner } from "@/components/jobs/ui";
import { jobsGoogleConfigured } from "@/lib/jobs-app/google";
import { JOBS_COOKIE, readJobsSession } from "@/lib/jobs-app/session";

export const metadata: Metadata = { title: "Sign in" };

export default function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<Spinner label="Opening" />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const token = (await cookies()).get(JOBS_COOKIE)?.value;
  if (await readJobsSession(token)) redirect("/jobs");
  const params = await searchParams;
  const error = params.error && params.error in { denied: 1, state: 1, signin: 1, unavailable: 1 } ? params.error : undefined;
  return <LoginScreen error={error} configured={jobsGoogleConfigured()} />;
}
