import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { JobCreate } from "@/components/internal/job-create";
import { companies } from "@/lib/reports/catalog";
import { databaseConfigured, findJobs } from "@/lib/jobs/db";

export const metadata = { title: "Jobs", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <JobsPage searchParams={searchParams} />
    </Suspense>
  );
}

async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const term = query.q?.trim() ?? "";
  const connected = databaseConfigured();
  const jobs = connected ? await findJobs(term).catch(() => []) : [];
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      <div className="space-y-4 px-4 pb-10">
        <h1 className="text-xl font-semibold text-brand-navy">Jobs</h1>
        {connected ? null : <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">Jobs database not connected</p>}
        {connected ? (
          <>
            <form className="flex gap-2">
              <input name="q" defaultValue={term} placeholder="Address or client" className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3" />
              <button className="min-h-12 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">Search</button>
            </form>
            {jobs.length === 0 ? <p className="text-sm text-slate-600">No jobs yet.</p> : null}
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/internal/jobs/${job.id}`} className="block px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {job.job_number} · {job.client_name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {companies[job.company].name} · {job.address} · {job.status}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <JobCreate />
          </>
        ) : null}
      </div>
    </PortalFrame>
  );
}
