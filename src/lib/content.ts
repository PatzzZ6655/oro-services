export type BrandTone = "blue" | "orange";

export type Brand = {
  id: string;
  name: string;
  legalName: string;
  mark: "®";
  category: string;
  tone: BrandTone;
  logo: string;
  logoWidth: number;
  logoHeight: number;
  description: string;
  services: string[];
  email: string;
};

export const oroLogo = {
  src: "/logos/oro-services.png",
  width: 1000,
  height: 530,
};

export const corporateEmail = "info@orosvc.com";

export const internalLoginHref = "https://stock-dashboard-oro-services.vercel.app/";

export const brands: Brand[] = [
  {
    id: "emoro",
    name: "Emoro Building",
    legalName: "EMORO BUILDING",
    mark: "®",
    category: "Construction & Project Management",
    tone: "blue",
    logo: "/logos/emoro-building.png",
    logoWidth: 923,
    logoHeight: 295,
    description:
      "Offering reliable services in general construction, renovations, commercial fit-outs, and dedicated project management. Focused on quality on-site delivery.",
    services: [
      "General Construction & Builds",
      "Renovations & Fit-Outs",
      "Subcontracting & Project Management",
    ],
    email: "info.emoro@orosvc.com",
  },
  {
    id: "emporo",
    name: "Emporo Plumbing",
    legalName: "EMPORO PLUMBING",
    mark: "®",
    category: "Licensed Plumbing",
    tone: "orange",
    logo: "/logos/emporo-plumbing.png",
    logoWidth: 734,
    logoHeight: 194,
    description:
      "Responsive and qualified services covering standard installations, pipeline and drainage diagnostics, and leakage detections. Here when you need solutions.",
    services: [
      "Commercial & Residential Plumbing",
      "Diagnostics & Leak Detection",
      "Drainage & Pipe Maintenance",
    ],
    email: "info.emporo@orosvc.com",
  },
];

export const toneStyles: Record<
  BrandTone,
  {
    iconWrap: string;
    badge: string;
    check: string;
  }
> = {
  blue: {
    iconWrap: "bg-slate-100 text-brand-blue",
    badge: "border-slate-100 bg-slate-50 text-slate-400",
    check: "text-brand-blue",
  },
  orange: {
    iconWrap: "bg-orange-50 text-brand-orange",
    badge: "border-orange-100 bg-orange-50 text-brand-orange/80",
    check: "text-brand-orange",
  },
};

export const aboutPoints = [
  {
    title: "Licensed & Insured",
    body: "Compliant with industry standards and statutory guidelines.",
  },
  {
    title: "Focused Expertise",
    body: "Executed by qualified personnel on site with no overlapping confusion.",
  },
  {
    title: "Subcontract Ready",
    body: "Ready to cooperate on larger residential or commercial site briefs.",
  },
];
