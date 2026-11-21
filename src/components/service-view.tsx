import Link from "next/link";
import { InteriorHero } from "@/components/interior-hero";
import { JsonLd } from "@/components/json-ld";
import { SiteFrame } from "@/components/site-frame";
import { contactHref, toneStyles, type Brand, type Service } from "@/lib/content";
import { serviceJsonLd } from "@/lib/structured-data";

export function ServiceView({ brand, service }: { brand: Brand; service: Service }) {
  const tone = toneStyles[brand.tone];
  const others = brand.services.filter((item) => item.slug !== service.slug);

  return (
    <SiteFrame>
      <JsonLd data={serviceJsonLd(brand, service)} />
      <InteriorHero
        eyebrow={brand.name}
        title={service.name}
        crumbs={[
          { href: "/", label: "Home" },
          { href: `/${brand.id}`, label: brand.name },
          { label: service.name },
        ]}
      >
        {service.summary}
      </InteriorHero>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-lg leading-relaxed text-slate-700">
          This work is carried out by{" "}
          <Link href={`/${brand.id}`} className="font-semibold text-brand-navy underline-offset-2 hover:underline">
            {brand.name}
          </Link>
          .
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          <Link
            href={contactHref(brand.id, service.slug)}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy ${tone.button}`}
          >
            Contact us
          </Link>
          <a
            href={`mailto:${brand.email}`}
            className="text-sm font-semibold text-slate-700 underline-offset-2 hover:underline"
          >
            {brand.email}
          </a>
        </div>
        {others.length > 0 ? (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-slate-900">Other {brand.name} services</h2>
            <ul className="mt-6 space-y-4">
              {others.map((item) => (
                <li key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <Link
                    href={`/${brand.id}/${item.slug}`}
                    className="text-lg font-semibold text-brand-navy hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-2 text-slate-600">{item.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SiteFrame>
  );
}
