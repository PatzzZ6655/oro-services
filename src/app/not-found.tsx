import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

export const metadata: Metadata = {
  title: { absolute: "Page not found | ORO Services" },
  description: "That page is not on the ORO Services site.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <SiteFrame>
      <section className="bg-brand-dark px-6 pb-24 pt-40 text-white md:pt-52">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-200">404</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">This page is not on the site.</h1>
          <p className="mt-4 text-lg font-light text-slate-200">
            That address does not match a page. Go back to ORO Services, or send an enquiry to Emoro Building or Emporo Plumbing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-brand-navy transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Back home
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
