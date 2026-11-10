export const siteUrl = "https://www.orosvc.com";

export const siteName = "ORO Services";

export const corporateEmail = "info@orosvc.com";

export const internalLoginHref = "https://stock-dashboard-oro-services.vercel.app/";

export const photoMaxBytes = 2 * 1024 * 1024;

export const photoAccept = "image/jpeg,image/png,image/webp";

export type BrandTone = "blue" | "orange";

export type BrandId = "emoro" | "emporo";

export type EnquiryBrand = BrandId | "general";

export type Service = {
  slug: string;
  name: string;
  summary: string;
};

export type Brand = {
  id: BrandId;
  name: string;
  mark: "®";
  category: string;
  tone: BrandTone;
  logo: string;
  logoWidth: number;
  logoHeight: number;
  description: string;
  email: string;
  schemaType: "GeneralContractor" | "Plumber";
  services: Service[];
};

export const oroLogo = {
  src: "/logos/oro-services.png",
  width: 1000,
  height: 530,
  alt: "ORO Services",
};

export const brands: Brand[] = [
  {
    id: "emoro",
    name: "Emoro Building",
    mark: "®",
    category: "Construction and project management",
    tone: "orange",
    logo: "/logos/emoro-building.png",
    logoWidth: 923,
    logoHeight: 295,
    description:
      "General construction and builds, renovations and commercial fit-outs, and project management. The work is done on site.",
    email: "info.emoro@orosvc.com",
    schemaType: "GeneralContractor",
    services: [
      {
        slug: "general-construction",
        name: "General Construction & Builds",
        summary: "General construction and builds, done on site.",
      },
      {
        slug: "renovations-fit-outs",
        name: "Renovations & Fit-Outs",
        summary: "Renovations and commercial fit-outs.",
      },
      {
        slug: "project-management",
        name: "Subcontracting & Project Management",
        summary:
          "Project management, and subcontracting on larger residential or commercial jobs.",
      },
    ],
  },
  {
    id: "emporo",
    name: "Emporo Plumbing",
    mark: "®",
    category: "Plumbing",
    tone: "blue",
    logo: "/logos/emporo-plumbing.png",
    logoWidth: 734,
    logoHeight: 194,
    description:
      "Commercial and residential plumbing, including installations, leak detection, and drainage and pipe maintenance.",
    email: "info.emporo@orosvc.com",
    schemaType: "Plumber",
    services: [
      {
        slug: "plumbing",
        name: "Commercial & Residential Plumbing",
        summary: "Plumbing installations for homes and commercial sites.",
      },
      {
        slug: "hot-water-gas",
        name: "Water & Gas",
        summary:
          "Hot water system installation and repair, and gas leak detection and repair.",
      },
      {
        slug: "taps-toilets-pipe-relining",
        name: "Taps, Toilets & Pipe Relining",
        summary: "Leaking taps and toilets, and pipe relining.",
      },
      {
        slug: "drainage",
        name: "Drainage & Pipe Maintenance",
        summary: "Drainage and pipe maintenance, including blocked drains.",
      },
    ],
  },
];

export const toneStyles: Record<
  BrandTone,
  {
    iconWrap: string;
    badge: string;
    check: string;
    button: string;
  }
> = {
  blue: {
    iconWrap: "bg-slate-100 text-brand-blue",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    check: "text-brand-blue",
    button: "bg-brand-navy hover:bg-brand-blue",
  },
  orange: {
    iconWrap: "bg-orange-50 text-orange-800",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    check: "text-orange-700",
    button: "bg-orange-700 hover:bg-orange-800",
  },
};

export const aboutPoints = [
  {
    title: "Two brands",
    body: "Emoro Building does the building work. Emporo Plumbing does the plumbing. Contact the one that matches the job.",
  },
  {
    title: "On site",
    body: "Builds, renovations, fit-outs, plumbing, leak detection, and drainage are carried out on site.",
  },
  {
    title: "Subcontracting",
    body: "Either brand can come onto a larger residential or commercial job as a subcontractor.",
  },
];

export const navLinks = [
  { href: "/emoro", label: "Emoro Building" },
  { href: "/emporo", label: "Emporo Plumbing" },
  { href: "/contact", label: "Contact" },
] as const;

export function absoluteUrl(path: string): string {
  if (path === "/") return siteUrl;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getBrand(id: string): Brand | undefined {
  return brands.find((brand) => brand.id === id);
}

export function getService(brand: Brand, slug: string): Service | undefined {
  return brand.services.find((service) => service.slug === slug);
}

export function isEnquiryBrand(value: string): value is EnquiryBrand {
  return value === "emoro" || value === "emporo" || value === "general";
}

export function inboxFor(brand: EnquiryBrand): string {
  if (brand === "general") return corporateEmail;
  return getBrand(brand)?.email ?? corporateEmail;
}

export function brandLabel(brand: EnquiryBrand): string {
  if (brand === "general") return "ORO Services";
  return getBrand(brand)?.name ?? "ORO Services";
}

export function contactHref(brand: EnquiryBrand, service?: string): string {
  const params = new URLSearchParams({ brand });
  if (service && service !== "unsure") params.set("service", service);
  return `/contact?${params.toString()}`;
}

export function indexablePaths(): { path: string; priority: number }[] {
  const paths: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/emoro", priority: 0.9 },
    { path: "/emporo", priority: 0.9 },
  ];

  for (const brand of brands) {
    for (const service of brand.services) {
      paths.push({ path: `/${brand.id}/${service.slug}`, priority: 0.7 });
    }
  }

  paths.push({ path: "/contact", priority: 0.8 }, { path: "/privacy", priority: 0.3 });
  return paths;
}
