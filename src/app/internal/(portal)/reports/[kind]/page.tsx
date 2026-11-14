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

const forms: Record<ReportKind, typeof SiteJobSheetForm> = {
  "site-job-sheet": SiteJobSheetForm,
  "job-sign-off": JobSignOffForm,
  "gas-safety": GasSafetyForm,
  "electrical-safety": ElectricalSafetyForm,
};

function ExistingForm({ kind, defaults }: { kind: ReportKind; defaults: { name: string; date: string; time: string } }) {
  const Form = forms[kind];
  return <Form defaults={defaults} />;
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  if (isSafetyKind(kind)) return { title: safetyCard(kind).title, robots: { index: false, follow: false } };
  if (!isReportKind(kind)) return { title: "Report", robots: { index: false, follow: false } };
  return { title: reportCard(kind).title, robots: { index: false, follow: false } };
}

export default function Page({ params }: { params: Promise<{ kind: string }> }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <ReportPage params={params} />
    </Suspense>
  );
}

async function ReportPage({ params }: { params: Promise<{ kind: string }> }) {
  const [{ kind }, user] = await Promise.all([params, requireUser()]);
  if (!isReportKind(kind) && !isSafetyKind(kind)) notFound();
  const defaults = { name: user.name, date: melbourneToday(), time: melbourneClock() };
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      {isReportKind(kind) ? <ExistingForm kind={kind} defaults={defaults} /> : <SafetyForm kind={kind} defaults={defaults} />}
    </PortalFrame>
  );
}
