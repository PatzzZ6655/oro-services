import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Authed } from "@/app/jobs/authed";
import { JobRecordScreen } from "@/components/jobs/job-record-screen";
import { Screen, Spinner } from "@/components/jobs/ui";
import { isBusiness } from "@/lib/jobs-app/types";

export const metadata: Metadata = { title: "Job" };

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ business?: string }>;
}) {
  return (
    <Suspense fallback={<Screen title="Job"><Spinner label="Opening" /></Screen>}>
      <JobPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ business?: string }>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const business = isBusiness(query.business) ? query.business : "emoro";
  return (
    <Authed>
      <JobRecordScreen id={id} business={business} />
    </Authed>
  );
}
