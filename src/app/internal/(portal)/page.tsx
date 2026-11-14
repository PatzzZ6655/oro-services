import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { stockDashboardHref } from "@/lib/content";
import { reportCards } from "@/lib/reports/catalog";
import { safetyCards } from "@/lib/reports/safety";
import { formatAuDate } from "@/lib/reports/dates";
import { driveConfigured, listRecentReports, type StoredReport } from "@/lib/reports/drive";

export default function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <Hub searchParams={searchParams} />
    </Suspense>
  );
}

async function Hub({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = params.tab === "stock" ? "stock" : "reports";
  const recent = tab === "reports" ? await recentReports() : null;

  return (
    <PortalFrame email={user.email} name={user.name}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-navy">Staff portal</h1>
        <Link href="/internal/jobs" className="text-sm font-semibold text-brand-navy underline">
          Jobs
        </Link>
      </div>
      <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="Portal">
        <Tab href="/internal" current={tab === "reports"}>
          Reports
        </Tab>
        <Tab href="/internal?tab=stock" current={tab === "stock"}>
          Stock dashboard
        </Tab>
      </nav>
      {tab === "stock" ? <StockPanel /> : <ReportsPanel recent={recent} />}
    </PortalFrame>
  );
}

function Tab({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
        current ? "border-brand-navy bg-white text-brand-navy" : "border-transparent bg-slate-200/70 text-slate-600"
      }`}
    >
      {children}
    </Link>
  );
}

function StockPanel() {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-navy">Stock dashboard</h2>
      <p className="mt-2 text-sm text-slate-600">
        This opens tape.orosvc.com. That site has its own sign-in. Stock figures stay there.
      </p>
      <a
        href={stockDashboardHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
      >
        Open stock dashboard
      </a>
    </section>
  );
}

async function recentReports(): Promise<{ status: "unconfigured" } | { status: "error" } | { status: "ready"; rows: StoredReport[] }> {
  if (!driveConfigured()) return { status: "unconfigured" };
  try {
    return { status: "ready", rows: await listRecentReports() };
  } catch {
    return { status: "error" };
  }
}

function ReportsPanel({
  recent,
}: {
  recent: { status: "unconfigured" } | { status: "error" } | { status: "ready"; rows: StoredReport[] } | null;
}) {
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
        {recent?.status === "unconfigured" ? (
          <p className="mt-2 text-sm text-slate-600">Recent reports appear here once Google Drive is connected.</p>
        ) : null}
        {recent?.status === "error" ? <p className="mt-2 text-sm text-slate-600">The report list could not be loaded.</p> : null}
        {recent?.status === "ready" && recent.rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No reports filed yet.</p>
        ) : null}
        {recent?.status === "ready" && recent.rows.length > 0 ? (
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
      </section>
    </div>
  );
}
