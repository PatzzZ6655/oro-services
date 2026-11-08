import Link from "next/link";
import { notFound } from "next/navigation";
import { InteriorHero } from "@/components/interior-hero";
import { JsonLd } from "@/components/json-ld";
import { LogoImage } from "@/components/logo-image";
import { SiteFrame } from "@/components/site-frame";
import { brands, contactHref, getBrand, toneStyles } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { brandJsonLd } from "@/lib/structured-data";

type Props = { params: Promise<{ brand: string }> };

export function generateStaticParams() {
  return brands.map((brand) => ({ brand: brand.id }));
}

export async function generateMetadata({ params }: Props) {
  const { brand: id } = await params;
  const brand = getBrand(id);
  if (!brand) return {};
  return pageMetadata({
    title: brand.name,
    description: brand.description,
    path: `/${brand.id}`,
  });
}

export default async function BrandPage({ params }: Props) {
  const { brand: id } = await params;
  const brand = getBrand(id);
  if (!brand) notFound();
  const tone = toneStyles[brand.tone];

  return (
    <SiteFrame>
      <JsonLd data={brandJsonLd(brand)} />
      <InteriorHero
        eyebrow={brand.category}
        title={`${brand.name}${brand.mark}`}
        crumbs={[
          { href: "/", label: "Home" },
          { label: brand.name },
        ]}
      >
        {brand.description}
      </InteriorHero>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <LogoImage
          src={brand.logo}
          alt={brand.name}
          width={brand.logoWidth}
          height={brand.logoHeight}
          sizes="280px"
          className="mb-10 h-auto max-h-16 w-auto"
        />
        <h2 className="text-2xl font-bold text-slate-900">Services</h2>
        <ul className="mt-6 space-y-4">
          {brand.services.map((service) => (
            <li key={service.slug} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Link href={`/${brand.id}/${service.slug}`} className="text-lg font-semibold text-brand-navy hover:underline">
                {service.name}
              </Link>
              <p className="mt-2 text-slate-600">{service.summary}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={contactHref(brand.id)}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy ${tone.button}`}
          >
            Enquire with {brand.name}
          </Link>
          <a
            href={`mailto:${brand.email}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-white"
          >
            {brand.email}
          </a>
        </div>
      </div>
    </SiteFrame>
  );
}
