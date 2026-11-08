import { Suspense } from "react";
import { EnquiryForm } from "@/components/enquiry-form";
import { InteriorHero } from "@/components/interior-hero";
import { SiteFrame } from "@/components/site-frame";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Send an enquiry to Emoro Building, Emporo Plumbing, or ORO Services. Include your name, email, suburb, and the job.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <SiteFrame>
      <InteriorHero
        eyebrow="Contact"
        title="Send an enquiry"
        crumbs={[
          { href: "/", label: "Home" },
          { label: "Contact" },
        ]}
      >
        Tell us the job and which brand it is for. Emoro Building enquiries go to info.emoro@orosvc.com. Emporo Plumbing enquiries go to info.emporo@orosvc.com. Anything general goes to info@orosvc.com.
      </InteriorHero>
      <div className="mx-auto max-w-xl px-6 py-16">
        <Suspense fallback={<p className="text-slate-600">Loading the form…</p>}>
          <EnquiryForm />
        </Suspense>
      </div>
    </SiteFrame>
  );
}
