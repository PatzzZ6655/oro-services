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
        {service.summary} This is part of {brand.name}. {brand.description}
      </InteriorHero>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={contactHref(brand.id, service.slug)}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy ${tone.button}`}
          >
            Enquire about {service.name}
          </Link>
          <a
            href={`mailto:${brand.email}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-white"
          >
            {brand.email}
          </a>
        </div>
        {others.length > 0 ? (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-slate-900">Other {brand.name} services</h2>
            <ul className="mt-4 space-y-2">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link href={`/${brand.id}/${item.slug}`} className="font-medium text-brand-navy hover:underline">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SiteFrame>
  );
}
