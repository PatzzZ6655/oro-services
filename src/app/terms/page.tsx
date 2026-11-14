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
      "These terms are governed by the laws of Victoria, Australia. If any part of these terms cannot be enforced, the rest still applies.",
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteFrame>
      <article className="terms-page mx-auto max-w-3xl px-6 pb-20 pt-32 text-base leading-relaxed text-slate-800 md:pt-36 print:pb-0 print:pt-0 print:text-brand-navy">
        <h1 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">
          Terms and Conditions (ORO Services: Emoro Building and Emporo Plumbing)
        </h1>
        <p className="mt-4 text-sm text-slate-600 print:text-brand-navy">Last updated: 15 November 2026</p>
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
