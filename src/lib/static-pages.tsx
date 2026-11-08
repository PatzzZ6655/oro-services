import { BrandView } from "@/components/brand-view";
import { ServiceView } from "@/components/service-view";
import { getBrand, getService, type BrandId } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export function brandPage(id: BrandId) {
  const brand = getBrand(id);
  if (!brand) throw new Error(`Unknown brand ${id}`);

  return {
    metadata: pageMetadata({
      title: brand.name,
      description: brand.description,
      path: `/${brand.id}`,
    }),
    Page() {
      return <BrandView brand={brand} />;
    },
  };
}

export function servicePage(id: BrandId, slug: string) {
  const brand = getBrand(id);
  const service = brand ? getService(brand, slug) : undefined;
  if (!brand || !service) throw new Error(`Unknown service ${id}/${slug}`);

  return {
    metadata: pageMetadata({
      title: `${service.name} — ${brand.name}`,
      description: `${service.summary} ${brand.name} is part of ORO Services.`,
      path: `/${brand.id}/${service.slug}`,
    }),
    Page() {
      return <ServiceView brand={brand} service={service} />;
    },
  };
}
