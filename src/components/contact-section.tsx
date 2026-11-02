import { LogoImage } from "@/components/logo-image";
import { brands, corporateEmail, toneStyles } from "@/lib/content";

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-4xl scroll-mt-32 px-6 py-20 text-center md:py-24">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">
        Initiate Contact
      </span>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
        Let&apos;s Discuss Your Project
      </h2>
      <p className="mx-auto mt-4 max-w-lg font-light leading-relaxed text-slate-500">
        Reach out to the appropriate team below. We respond as soon as we review
        your request.
      </p>

      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 text-left md:grid-cols-2">
        {brands.map((brand) => {
          const tone = toneStyles[brand.tone];

          return (
            <div
              key={brand.id}
              className="min-w-0 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg"
            >
              <LogoImage
                src={brand.logo}
                alt={brand.name}
                width={brand.logoWidth}
                height={brand.logoHeight}
                className="mb-4 h-auto max-h-12 w-auto max-w-full"
              />
              <div className="min-w-0">
                <a
                  href={brand.phoneHref}
                  className={`mt-1 block text-lg font-bold text-brand-navy transition-colors ${tone.phoneHover}`}
                >
                  {brand.phoneDisplay}
                </a>
                <a
                  href={`mailto:${brand.email}`}
                  className="mt-1 block truncate text-sm text-slate-500 hover:underline"
                >
                  {brand.email}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-md border-t border-slate-200/60 pt-8">
        <span className="block text-xs text-slate-400">Corporate / Admin Inquiry</span>
        <a
          href={`mailto:${corporateEmail}`}
          className="mt-1 inline-block text-sm font-semibold text-slate-600 transition-colors hover:text-brand-navy"
        >
          {corporateEmail}
        </a>
      </div>
    </section>
  );
}
