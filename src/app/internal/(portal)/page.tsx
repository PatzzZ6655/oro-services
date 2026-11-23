import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame, showFieldJobs } from "@/components/internal/portal-frame";
import { reportCards } from "@/lib/reports/catalog";
import { safetyCards } from "@/lib/reports/safety";
import { formatAuDate } from "@/lib/reports/dates";
import { driveConfigured, listCachedRecentReports, type StoredReport } from "@/lib/reports/drive";

export default function Page() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <Hub />
    </Suspense>
  );
}

async function Hub() {
  const user = await requireUser();

  return (
    <PortalFrame email={user.email} name={user.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-navy">Staff portal</h1>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/internal/sms-reply" className="text-sm font-semibold text-brand-navy underline">
            SMS reply
          </Link>
          <Link href="/internal/jobs" className="text-sm font-semibold text-brand-navy underline">
            Jobs
          </Link>
        </div>
      </div>
      {showFieldJobs(user.email) ? <FieldJobTiles /> : null}
      <ReportsPanel />
    </PortalFrame>
  );
}

const fieldJobTiles = [
  { href: "https://www.orosvc.com/jobs/new", title: "New Job", summary: "Create a job" },
  { href: "https://www.orosvc.com/jobs/depart", title: "Depart", summary: "Record departure for today's job" },
  { href: "https://www.orosvc.com/jobs/leave", title: "Leave", summary: "Record leaving the site" },
] as const;

function FieldJobTiles() {
  return (
    <section className="mt-4">
      <ul className="grid grid-cols-3 gap-2">
        {fieldJobTiles.map((item) => (
          <li key={item.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-brand-navy">{item.title}</h2>
            <p className="mt-1 flex-1 text-xs leading-snug text-slate-600">{item.summary}</p>
            <a
              href={item.href}
              className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-brand-navy px-2 text-sm font-semibold text-white"
            >
              Open
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function recentReports(): Promise<{ status: "unconfigured" } | { status: "error" } | { status: "ready"; rows: StoredReport[] }> {
  if (!driveConfigured()) return { status: "unconfigured" };
  try {
    return { status: "ready", rows: await listCachedRecentReports() };
  } catch {
    return { status: "error" };
  }
}

function ReportsPanel() {
  return (
    <div className="mt-4 space-y-4">
      {(
        [
          ["Inspections", reportCards.filter((card) => card.kind === "gas-safety" || card.kind === "electrical-safety")],
          ["Job records", reportCards.filter((card) => card.kind === "site-job-sheet" || card.kind === "job-sign-off")],
          ["Safety", [...safetyCards, { kind: "training", title: "Training and licences", summary: "Licences and expiry dates." }]],
        ] as const
      ).map(([heading, cards]) => (
        <section key={heading} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500">{heading}</h2>
          <ul className="grid gap-3">
            {cards.map((card) => (
              <li key={card.kind} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-base font-semibold text-brand-navy">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{card.summary}</p>
                <Link
                  href={card.kind === "training" ? "/internal/training" : `/internal/reports/${card.kind}`}
                  className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
                >
                  {card.kind === "training" ? "Open" : "Start"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-brand-navy">Recent reports</h2>
        <Suspense fallback={<RecentReportsPlaceholder />}>
          <RecentReports />
        </Suspense>
      </section>
    </div>
  );
}

function RecentReportsPlaceholder() {
  return <p className="mt-2 text-sm text-slate-600">Loading recent reports…</p>;
}

async function RecentReports() {
  await connection();
  const recent = await recentReports();
  return (
    <>
      {recent.status === "unconfigured" ? (
        <p className="mt-2 text-sm text-slate-600">Recent reports appear here once Google Drive is connected.</p>
      ) : null}
      {recent.status === "error" ? <p className="mt-2 text-sm text-slate-600">The report list could not be loaded.</p> : null}
      {recent.status === "ready" && recent.rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No reports filed yet.</p>
      ) : null}
      {recent.status === "ready" && recent.rows.length > 0 ? (
        <ul className="mt-2 divide-y divide-slate-200">
          {recent.rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                <p className="truncate text-sm text-slate-600">
                  {row.date ? formatAuDate(row.date) : "Date not recorded"}
                  {row.address ? ` · ${row.address}` : ""}
                </p>
              </div>
              <a href={row.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-brand-navy underline">
                PDF
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
