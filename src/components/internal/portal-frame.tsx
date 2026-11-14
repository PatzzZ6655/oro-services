import type { ReactNode } from "react";
import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { oroLogo } from "@/lib/content";

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
  children,
}: {
  email: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-brand-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/internal" className="inline-flex rounded-md bg-white px-2 py-1">
            <LogoImage
              src={oroLogo.src}
              alt={oroLogo.alt}
              width={oroLogo.width}
              height={oroLogo.height}
              sizes="96px"
              className="h-10 w-auto"
            />
          </Link>
          <div className="min-w-0 text-right">
            <p className="text-sm font-semibold">Staff portal</p>
            <p className="truncate text-xs text-slate-300">{name || email}</p>
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
