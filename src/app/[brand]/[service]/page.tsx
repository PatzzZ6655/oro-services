import Link from "next/link";
import { notFound } from "next/navigation";
import { InteriorHero } from "@/components/interior-hero";
import { JsonLd } from "@/components/json-ld";
import { SiteFrame } from "@/components/site-frame";
import { brands, contactHref, getBrand, getService, toneStyles } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { serviceJsonLd } from "@/lib/structured-data";

type Props = { params: Promise<{ brand: string; service: string }> };

export function generateStaticParams() {
  return brands.flatMap((brand) =>
    brand.services.map((service) => ({ brand: brand.id, service: service.slug })),
  );
}

export async function generateMetadata({ params }: Props) {
  const { brand: brandId, service: serviceSlug } = await params;
  const brand = getBrand(brandId);
  const service = brand ? getService(brand, serviceSlug) : undefined;
  if (!brand || !service) return {};
  return pageMetadata({
    title: `${service.name} — ${brand.name}`,
    description: `${service.summary} ${brand.name} is part of ORO Services.`,
    path: `/${brand.id}/${service.slug}`,
  });
}

export default async function ServicePage({ params }: Props) {
  const { brand: brandId, service: serviceSlug } = await params;
  const brand = getBrand(brandId);
  const service = brand ? getService(brand, serviceSlug) : undefined;
  if (!brand || !service) notFound();
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
