import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoImage } from "@/components/logo-image";
import { oroLogo } from "@/lib/content";
import { currentUser } from "@/lib/auth/current";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const messages: Record<string, string> = {
  denied: "This Google account isn't on the staff list.",
  state: "The sign-in didn't finish. Try again.",
  signin: "Google didn't confirm the sign-in. Try again.",
  unavailable: "Staff sign-in isn't set up yet.",
};

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-sm text-slate-600">Loading sign-in…</p>}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/internal");
  const params = await searchParams;
  const message = params.error ? messages[params.error] : undefined;

  return (
    <main id="main" className="min-h-screen bg-slate-50 px-4 py-16 text-slate-800">
      <div className="mx-auto max-w-md">
        <Link href="/" className="inline-flex rounded-md bg-white px-2 py-1">
          <LogoImage
            src={oroLogo.src}
            alt={oroLogo.alt}
            width={oroLogo.width}
            height={oroLogo.height}
            sizes="120px"
            className="h-12 w-auto"
          />
        </Link>
        <h1 className="mt-8 text-2xl font-semibold text-brand-navy">Staff sign-in</h1>
        <p className="mt-2 text-sm text-slate-600">Use the Google account your supervisor added to the staff list.</p>
        {message ? (
          <p role="alert" className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
            {message}
          </p>
        ) : null}
        <a
          href="/internal/auth/google"
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
        >
          <GoogleMark />
          Sign in with Google
        </a>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
