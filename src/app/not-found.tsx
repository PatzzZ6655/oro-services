import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-dark px-6 text-center text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        This page is not on the site.
      </h1>
      <p className="mt-3 max-w-md font-light text-slate-400">
        That address does not match a page. Return to ORO Services to reach
        Emoro Building or Emporo Plumbing.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-brand-navy transition-colors hover:bg-slate-100"
      >
        Back home
      </Link>
    </main>
  );
}
