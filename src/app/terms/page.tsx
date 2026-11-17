import { SiteFrame } from "@/components/site-frame";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description:
    "These terms apply to work carried out by ORO Services through Emoro Building and Emporo Plumbing.",
  path: "/terms",
});

const sections: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "About these terms",
    paragraphs: [
      "These terms apply to work carried out by ORO Services through Emoro Building and Emporo Plumbing. They apply when the customer accepts a quote, confirms a booking, or allows us to start work.",
      "Our business details, including ABN and any licence or registration numbers, are as shown on each quote and tax invoice. The terms on the quote or invoice the customer accepted apply to that job.",
    ],
  },
  {
    heading: "Quotes and acceptance",
    paragraphs: [
      "Quotes are valid for 14 days from the date issued, unless a shorter period is stated on the quote. A quote covers only the work and materials listed. Our quote is based on a visual inspection and the photos and information provided. If the work reveals hidden or different conditions, we will explain any extra cost and get your approval before continuing, except urgent make-safe work.",
      "The customer can accept a quote in writing, including by email or text, or by allowing work to start.",
    ],
  },
  {
    heading: "Prices and GST",
    paragraphs: [
      "Prices include GST unless stated otherwise. Tax invoices will include the information required by the Australian Taxation Office, including the customer's name or ABN on jobs of $1,000 or more.",
    ],
  },
  {
    heading: "Call-outs, access and after-hours",
    paragraphs: [
      "The customer or their property manager should give at least 24 hours' notice to cancel or reschedule. If a booking is cancelled, or we cannot get safe access, with less than 24 hours' notice, we may charge a call-out fee limited to our reasonable time and travel already committed.",
      "After-hours or weekend rates will be confirmed before we attend. The customer or their property manager is responsible for arranging safe access, including keys, codes and tenant notice.",
    ],
  },
  {
    heading: "Payment",
    paragraphs: [
      "Payment is due within 30 days of the invoice date, or within 45 days if agreed in writing for an approved account.",
      "The person or agency named on the quote or invoice is the customer, warrants they have the owner's or owners corporation's authority to approve the work, and is responsible for payment, unless a named owner has accepted the quote in writing.",
    ],
  },
  {
    heading: "Late payment",
    paragraphs: [
      "Overdue amounts may incur interest at the rate prescribed under the Penalty Interest Rates Act 1983 (Vic), plus reasonable costs of recovery. We may pause further work until the account is up to date.",
    ],
  },
  {
    heading: "Materials",
    paragraphs: [
      "Materials we supply remain our property until paid in full. Risk in those materials passes on delivery or installation.",
    ],
  },
  {
    heading: "Workmanship and consumer rights",
    paragraphs: [
      "We stand behind our workmanship. Parts and fixtures follow the manufacturer's warranty.",
      "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of Victoria, Australia. We and the customer submit to the non-exclusive jurisdiction of the courts of Victoria.",
    ],
  },
  {
    heading: "Severability",
    paragraphs: [
      "If any part of these terms cannot be enforced, the rest still applies.",
    ],
  },
  {
    heading: "Matching finishes",
    paragraphs: [
      "We will take reasonable care, but an exact match to existing colours, tiles, render, paint, timber or other finishes is not guaranteed, including because of ageing, light, wear or batch differences.",
    ],
  },
  {
    heading: "Customer-supplied materials",
    paragraphs: [
      "If the customer supplies materials or fixtures, we will install them with reasonable care, but we do not warrant their quality, suitability, colour or performance. If items are missing, incorrect or unsuitable, we will explain any extra labour and get your approval before charging it.",
      "We may decline to install items that are not WaterMark-certified or otherwise not compliant with the relevant standards, or that we reasonably consider unsafe.",
    ],
  },
  {
    heading: "Product supply and substitutions",
    paragraphs: [
      "Where we supply products, the final brand or model may depend on supplier availability and compatibility with existing services and site conditions. If a listed item is unavailable or not compatible, we will tell you and agree any substitute or change in cost before we proceed.",
    ],
  },
  {
    heading: "Pre-existing conditions",
    paragraphs: [
      "We are not responsible for pre-existing defects, settlement or other movement, moisture, or work done by others before we started, except to the extent our work causes new damage.",
    ],
  },
  {
    heading: "Variations",
    paragraphs: [
      "Changes to the quoted scope, including customer-requested changes, are variations. We will explain any extra cost and get your approval before doing that work, except urgent make-safe work. Approved variations are charged at the agreed price.",
    ],
  },
  {
    heading: "Asbestos and hazardous materials",
    paragraphs: [
      "If we suspect asbestos or other hazardous material, we will stop work in the affected area. Testing and removal by appropriately licensed specialists is an extra cost. We will explain that cost and get your approval before that work goes ahead.",
    ],
  },
  {
    heading: "Work at heights",
    paragraphs: [
      "Work at heights is carried out only with appropriate safe access, such as scaffolding, an elevating work platform or edge protection, as required by Victorian occupational health and safety law. If the required access equipment is not included in the quote, we will explain the extra cost and get your approval before proceeding. We may decline or pause work that cannot be done safely.",
    ],
  },
  {
    heading: "Confined spaces",
    paragraphs: [
      "Work in a confined space is carried out only with the permits and controls required by Victorian occupational health and safety law. Examples include a pit, a tank, or a subfloor or roof void that is a confined space under the Occupational Health and Safety Regulations 2017 (Vic). If we identify a confined space that was not in the quote, we will stop that work until those controls are arranged. We will explain any extra cost and get your approval before we proceed.",
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteFrame>
      <article className="terms-page mx-auto max-w-3xl px-6 pb-20 pt-32 text-base leading-relaxed text-slate-800 md:pt-36 print:pb-0 print:pt-0 print:text-brand-navy">
        <h1 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">Terms and Conditions</h1>
        <p className="mt-4 text-sm text-slate-600 print:text-brand-navy">ORO Services · Emoro Building and Emporo Plumbing</p>
        <p className="mt-1 text-sm text-slate-600 print:text-brand-navy">Last updated: 15 November 2026</p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-2xl font-bold text-brand-navy">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </SiteFrame>
  );
}
