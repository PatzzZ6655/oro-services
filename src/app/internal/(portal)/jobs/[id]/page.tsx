import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { setJobStatusAction } from "@/app/internal/job-actions";
import { companies, reportCards } from "@/lib/reports/catalog";
import { safetyCards } from "@/lib/reports/safety";
import { databaseConfigured, readJob, readJobReports } from "@/lib/jobs/db";
import { formatAuDate } from "@/lib/reports/dates";

export const metadata = { title: "Job", robots: { index: false, follow: false } };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <JobPage params={params} />
    </Suspense>
  );
}

async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  if (!databaseConfigured()) {
    return (
      <PortalFrame email={user.email} name={user.name} showLogo={false}>
        <p className="px-4 text-sm text-slate-700">Jobs database not connected</p>
      </PortalFrame>
    );
  }
  const job = await readJob(id).catch(() => null);
  if (!job) notFound();
  const reports = await readJobReports(id).catch(() => []);
  const forms = [...reportCards, ...safetyCards];
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      <div className="space-y-4 px-4 pb-10">
        <p className="text-sm text-slate-500">{companies[job.company].name}</p>
        <h1 className="text-xl font-semibold text-brand-navy">
          {job.job_number} · {job.client_name}
        </h1>
        <p className="text-sm text-slate-700">{job.address}</p>
        <p className="text-sm text-slate-600">
          {job.phone ? `${job.phone} · ` : ""}
          {job.email ? `${job.email} · ` : ""}
          {job.status} · {formatAuDate(job.created_at instanceof Date ? job.created_at.toISOString().slice(0, 10) : String(job.created_at).slice(0, 10))}
        </p>
        <form action={setJobStatusAction}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value={job.status === "open" ? "complete" : "open"} />
          <button className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800">
            {job.status === "open" ? "Mark complete" : "Reopen"}
          </button>
        </form>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">Start a form</h2>
          <ul className="grid gap-2">
            {forms.map((form) => (
              <li key={form.kind}>
                <Link href={`/internal/reports/${form.kind}?job=${job.id}`} className="flex min-h-12 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-navy">
                  {form.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-500">Reports</h2>
          {reports.length === 0 ? <p className="mt-2 text-sm text-slate-600">No reports filed on this job yet.</p> : null}
          <ul className="mt-2 divide-y divide-slate-200">
            {reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{report.form_type}</p>
                  <p className="text-sm text-slate-600">{formatAuDate(String(report.submitted_at).slice(0, 10))}</p>
                </div>
                <a href={report.drive_url} className="text-sm font-semibold text-brand-navy underline">
                  PDF
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PortalFrame>
  );
}
