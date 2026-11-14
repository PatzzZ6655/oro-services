import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { melbourneToday } from "@/lib/appointments";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { ElectricalSafetyForm, GasSafetyForm, JobSignOffForm, SiteJobSheetForm } from "@/components/internal/report-forms";
import { SafetyForm } from "@/components/internal/safety-form";
import { isReportKind, reportCard, type ReportKind } from "@/lib/reports/catalog";
import { melbourneClock } from "@/lib/reports/dates";
import { isSafetyKind, safetyCard } from "@/lib/reports/safety";
import { databaseConfigured, readJob } from "@/lib/jobs/db";
import type { JobPrefill } from "@/components/internal/prefill";

const forms: Record<ReportKind, typeof SiteJobSheetForm> = {
  "site-job-sheet": SiteJobSheetForm,
  "job-sign-off": JobSignOffForm,
  "gas-safety": GasSafetyForm,
  "electrical-safety": ElectricalSafetyForm,
};

function ExistingForm({
  kind,
  defaults,
  job,
}: {
  kind: ReportKind;
  defaults: { name: string; date: string; time: string };
  job: JobPrefill | null;
}) {
  const Form = forms[kind];
  return <Form defaults={defaults} job={job} />;
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  if (isSafetyKind(kind)) return { title: safetyCard(kind).title, robots: { index: false, follow: false } };
  if (!isReportKind(kind)) return { title: "Report", robots: { index: false, follow: false } };
  return { title: reportCard(kind).title, robots: { index: false, follow: false } };
}

export default function Page({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ job?: string }> }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <ReportPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function loadJob(id: string | undefined): Promise<JobPrefill | null> {
  if (!id || !databaseConfigured()) return null;
  const row = await readJob(id).catch(() => null);
  if (!row) return null;
  return {
    id: row.id,
    company: row.company,
    jobNumber: String(row.job_number),
    clientName: row.client_name,
    address: row.address,
  };
}

async function ReportPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ job?: string }> }) {
  const [{ kind }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!isReportKind(kind) && !isSafetyKind(kind)) notFound();
  const defaults = { name: user.name, date: melbourneToday(), time: melbourneClock() };
  const job = await loadJob(query.job);
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      {isReportKind(kind) ? <ExistingForm kind={kind} defaults={defaults} job={job} /> : <SafetyForm kind={kind} defaults={defaults} job={job} />}
    </PortalFrame>
  );
}
