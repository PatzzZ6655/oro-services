import type { ReactNode } from "react";
import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { oroLogo } from "@/lib/content";

const publicHome = "https://www.orosvc.com/";
const fieldJobs = "https://www.orosvc.com/jobs";

export function showFieldJobs(email: string): boolean {
  return email.trim().toLowerCase() === "pat.z@orosvc.com";
}

export function PortalFallback() {
  return (
    <div className="min-h-screen bg-slate-50">
      <p className="px-4 py-16 text-sm text-slate-600">Loading the staff portal…</p>
    </div>
  );
}

export function PortalFrame({
  email,
  name,
  showLogo = true,
  children,
}: {
  email: string;
  name: string;
  showLogo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className={showLogo ? "bg-brand-navy text-white" : "border-b border-slate-200 bg-white text-brand-navy"}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {showLogo ? (
              <a href={publicHome} className="inline-flex rounded-md bg-white px-2 py-1">
                <LogoImage
                  src={oroLogo.src}
                  alt={oroLogo.alt}
                  width={oroLogo.width}
                  height={oroLogo.height}
                  sizes="96px"
                  className="h-10 w-auto"
                />
              </a>
            ) : (
              <Link href="/internal" className="text-sm font-semibold text-brand-navy">
                All reports
              </Link>
            )}
            <a
              href={publicHome}
              className={`inline-flex min-h-11 items-center text-sm font-semibold underline ${showLogo ? "text-white" : "text-brand-navy"}`}
            >
              Home
            </a>
          </div>
          <div className="min-w-0 text-right">
            {showFieldJobs(email) ? (
              <a
                href={fieldJobs}
                className={`inline-flex min-h-11 items-center text-sm font-semibold underline ${showLogo ? "text-white" : "text-brand-navy"}`}
              >
                Jobs
              </a>
            ) : null}
            <p className="text-sm font-semibold">Staff portal</p>
            <p className={`truncate text-xs ${showLogo ? "text-slate-300" : "text-slate-500"}`}>{name || email}</p>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-3">
        <form action="/internal/auth/sign-out" method="post">
          <button type="submit" className="min-h-11 text-sm font-semibold text-slate-600 underline">
            Sign out
          </button>
        </form>
      </div>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
