import {
  absoluteUrl,
  brands,
  corporateEmail,
  siteName,
  siteUrl,
  type Brand,
  type Service,
} from "@/lib/content";

function serviceOffer(brand: Brand, service: Service) {
  return {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: service.name,
      description: service.summary,
      url: absoluteUrl(`/${brand.id}/${service.slug}`),
    },
  };
}

export function brandJsonLd(brand: Brand) {
  return {
    "@context": "https://schema.org",
    "@type": brand.schemaType,
    name: brand.name,
    url: absoluteUrl(`/${brand.id}`),
    email: brand.email,
    image: absoluteUrl(brand.logo),
    description: brand.description,
    parentOrganization: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    makesOffer: brand.services.map((service) => serviceOffer(brand, service)),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    email: corporateEmail,
    logo: absoluteUrl("/logos/oro-services.png"),
    description:
      "ORO Services is the parent of Emoro Building and Emporo Plumbing.",
    subOrganization: brands.map((brand) => ({
      "@type": brand.schemaType,
      name: brand.name,
      url: absoluteUrl(`/${brand.id}`),
      email: brand.email,
    })),
  };
}

export function serviceJsonLd(brand: Brand, service: Service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.summary,
    url: absoluteUrl(`/${brand.id}/${service.slug}`),
    provider: {
      "@type": brand.schemaType,
      name: brand.name,
      url: absoluteUrl(`/${brand.id}`),
      email: brand.email,
    },
  };
}
