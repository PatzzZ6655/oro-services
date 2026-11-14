import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { ElectricalSafetyForm, GasSafetyForm, JobSignOffForm, SiteJobSheetForm } from "@/components/internal/report-forms";
import { isReportKind, reportCard, type ReportKind } from "@/lib/reports/catalog";

const forms: Record<ReportKind, typeof SiteJobSheetForm> = {
  "site-job-sheet": SiteJobSheetForm,
  "job-sign-off": JobSignOffForm,
  "gas-safety": GasSafetyForm,
  "electrical-safety": ElectricalSafetyForm,
};

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
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
  if (!isReportKind(kind)) notFound();
  const Form = forms[kind];
  return (
    <PortalFrame email={user.email} name={user.name}>
      <Form />
    </PortalFrame>
  );
}
