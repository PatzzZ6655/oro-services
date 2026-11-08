import { AboutSection } from "@/components/about-section";
import { BrandsSection } from "@/components/brands-section";
import { ContactSection } from "@/components/contact-section";
import { Hero } from "@/components/hero";
import { JsonLd } from "@/components/json-ld";
import { SiteFrame } from "@/components/site-frame";
import { pageMetadata } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/structured-data";

export const metadata = pageMetadata({
  title: "ORO Services | Building and plumbing",
  description:
    "ORO Services is the parent of Emoro Building and Emporo Plumbing. Construction, renovations, fit-outs, plumbing, leak detection, and drainage.",
  path: "/",
  absoluteTitle: true,
});

export default function Home() {
  return (
    <SiteFrame>
      <JsonLd data={organizationJsonLd()} />
      <Hero />
      <BrandsSection />
      <AboutSection />
      <ContactSection />
    </SiteFrame>
  );
}
