import { Check, Droplet, HardHat, Mail, Phone, type LucideIcon } from "lucide-react";
import { brands, toneStyles } from "@/lib/content";

const brandIcons: Record<string, LucideIcon> = {
  emoro: HardHat,
  emporo: Droplet,
};

export function BrandsSection() {
  return (
    <section id="brands" className="mx-auto max-w-6xl scroll-mt-32 px-6 py-20 md:py-28">
      <div className="mb-16 text-center md:mb-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Our Brands
        </h2>
        <p className="mx-auto mt-4 max-w-lg font-light text-slate-500">
          Providing licensed, trade-compliant construction and plumbing services.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
        {brands.map((brand) => {
          const tone = toneStyles[brand.tone];
          const Icon = brandIcons[brand.id];

          return (
            <article
              key={brand.id}
              className="group flex min-w-0 flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-slate-200/80 hover:shadow-xl sm:p-8 md:p-10"
            >
              <div>
                <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}
                  >
                    <Icon className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <span
                    className={`max-w-full rounded-full border px-3 py-1 text-right text-xs font-bold uppercase leading-snug tracking-wider sm:max-w-[11rem] ${tone.badge}`}
                  >
                    {brand.category}
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight text-brand-navy md:text-3xl">
                  {brand.legalName}
                  <span className="align-super text-xs font-normal text-slate-400">
                    {brand.mark}
                  </span>
                </h3>
                <p className="mt-4 font-light leading-relaxed text-slate-500">
                  {brand.description}
                </p>
                <ul className="mt-8 space-y-3.5 text-sm font-medium text-slate-600">
                  {brand.services.map((service) => (
                    <li key={service} className="flex items-start gap-2.5">
                      <Check className={`mt-0.5 h-5 w-5 shrink-0 ${tone.check}`} aria-hidden="true" />
                      <span>{service}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 space-y-3">
                <a
                  href={brand.phoneHref}
                  className={`group/call inline-flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy ${tone.call}`}
                >
                  Call {brand.phoneDisplay}
                  <Phone className="h-4 w-4 transition-transform group-hover/call:scale-110" aria-hidden="true" />
                </a>
                <a
                  href={`mailto:${brand.email}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                >
                  <span className="truncate">Email {brand.email}</span>
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
