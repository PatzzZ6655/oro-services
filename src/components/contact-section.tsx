import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { brands, corporateEmail } from "@/lib/content";

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-4xl scroll-mt-32 px-6 py-20 text-center md:py-24">
      <span className="text-xs font-bold uppercase tracking-widest text-orange-800">
        Contact
      </span>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
        Tell us the job
      </h2>
      <p className="mx-auto mt-4 max-w-lg font-light leading-relaxed text-slate-600">
        Use the form and it goes to Emoro Building, Emporo Plumbing, or the ORO
        Services inbox. You can also email the team directly.
      </p>
      <Link
        href="/contact"
        className="mt-8 inline-flex rounded-xl bg-brand-navy px-8 py-4 font-semibold text-white transition-colors hover:bg-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Contact us
      </Link>

      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 text-left md:grid-cols-2">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className="min-w-0 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg"
          >
            <LogoImage
              src={brand.logo}
              alt={brand.name}
              width={brand.logoWidth}
              height={brand.logoHeight}
              sizes="192px"
              className="mb-4 h-auto max-h-12 w-auto max-w-full"
            />
            <Link href={`/${brand.id}`} className="font-semibold text-brand-navy hover:underline">
              {brand.name}
            </Link>
            <a
              href={`mailto:${brand.email}`}
              className="mt-1 block break-all text-sm font-semibold text-slate-700 hover:underline"
            >
              {brand.email}
            </a>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-md border-t border-slate-200 pt-8">
        <span className="block text-xs text-slate-600">ORO Services</span>
        <a
          href={`mailto:${corporateEmail}`}
          className="mt-1 inline-block text-sm font-semibold text-slate-700 transition-colors hover:text-brand-navy"
        >
          {corporateEmail}
        </a>
      </div>
    </section>
  );
}
