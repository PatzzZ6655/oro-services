import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";
import { InteriorHero } from "@/components/interior-hero";
import { brands, corporateEmail } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How ORO Services handles name, email, phone, suburb, and job details sent through the enquiry form.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <SiteFrame>
      <InteriorHero
        eyebrow="Privacy"
        title="Privacy Policy"
        crumbs={[
          { href: "/", label: "Home" },
          { label: "Privacy" },
        ]}
      >
        This page explains what ORO Services does with the details you send us. It is written for an Australian small business and follows the idea of the Australian Privacy Principles: collect only what the form asks for, use it for the enquiry, and let you ask about it.
      </InteriorHero>
      <article className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-slate-700">
        <p className="text-sm text-slate-600">Last updated 8 November 2026.</p>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Who we are</h2>
          <p>
            ORO Services runs this website, www.orosvc.com. The two brands are Emoro Building and Emporo Plumbing. For privacy questions, email{" "}
            <a className="font-semibold text-brand-navy underline" href={`mailto:${corporateEmail}`}>
              {corporateEmail}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">What we collect</h2>
          <p>If you use the enquiry form, we collect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name</li>
            <li>Your email address</li>
            <li>Your phone number, if you choose to give one</li>
            <li>The suburb or area you give</li>
            <li>The brand and service you pick</li>
            <li>Your description of the job</li>
            <li>A photo, if you attach one</li>
          </ul>
          <p>If you email us yourself, we receive whatever you put in that email.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Why we collect it</h2>
          <p>
            We use these details to read your enquiry and reply about that job. We send the message to the inbox for the brand you pick:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {brands.map((brand) => (
              <li key={brand.id}>
                {brand.name}: {brand.email}
              </li>
            ))}
            <li>General enquiries: {corporateEmail}</li>
          </ul>
          <p>A photo is only used to understand the job you described. We do not add you to a mailing list.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Who else sees it</h2>
          <p>
            The people who handle enquiries for that brand can read the message. If the form sends the enquiry, it goes through Google Workspace (Gmail) to that inbox. Google handles the delivery and may process the message outside Australia. If you email us from your own email app, your email provider handles the message.
          </p>
          <p>We do not sell personal information.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">How long we keep it</h2>
          <p>
            We keep an enquiry for as long as we need it to deal with the job and any follow-up about that job. It stays in the email inbox it was sent to.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Access and correction</h2>
          <p>
            Email {corporateEmail} if you want a copy of the enquiry details we hold, or if you want them corrected. Tell us the email address you used and enough about the job for us to find the message.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Complaints</h2>
          <p>
            Contact us first at {corporateEmail}. If you are not satisfied, you can complain to the Office of the Australian Information Commissioner (OAIC) at{" "}
            <a className="font-semibold text-brand-navy underline" href="https://www.oaic.gov.au/privacy/privacy-complaints">
              oaic.gov.au
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">This website</h2>
          <p>
            The public pages do not use advertising cookies. The form includes a field that people should leave blank so we can ignore automated submissions.
          </p>
          <p>
            <Link href="/contact" className="font-semibold text-brand-navy underline">
              Go to the enquiry form
            </Link>
            .
          </p>
        </section>
      </article>
    </SiteFrame>
  );
}
