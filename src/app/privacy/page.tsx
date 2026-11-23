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
        This page explains what ORO Services does with personal information, including details you send us through this website and the records we keep when we arrange and carry out jobs. It is written for an Australian small business and follows the idea of the Australian Privacy Principles: collect only what the form asks for, use it for the enquiry, and let you ask about it.
      </InteriorHero>
      <article className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-slate-700">
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Who we are</h2>
          <p>
            ORO Services runs this website, www.orosvc.com. The two brands are Emoro Building (Emoro Building Pty Ltd) and Emporo Plumbing (Emporo Plumbing Pty Ltd). For privacy questions, email{" "}
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
            <li>The preferred appointment days and times you choose, for an Emporo Plumbing enquiry</li>
            <li>The brand and service you pick</li>
            <li>Your description of the job</li>
            <li>A photo, if you attach one</li>
            <li>A voucher code, if you choose to give one. On an Emoro Building or Emporo Plumbing enquiry the form accepts a code starting with EMB- or EMP-. A blank or unusable code is not kept with the enquiry.</li>
          </ul>
          <p>If you email us yourself, we receive whatever you put in that email.</p>
          <p>
            The suburb field can suggest places as you type. Those suggestions use Google Maps Places autocomplete. The text you type in that field is sent to Google so it can return suggestions. Google explains what it does with that information in its{" "}
            <a className="font-semibold text-brand-navy underline" href="https://policies.google.com/privacy">
              privacy policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Why we collect it</h2>
          <p>
            We use these details to read your enquiry and reply about that job. We email the message to the inbox for the brand you pick. If you gave a usable voucher code, that code is included in the same email so it can be seen with the enquiry. Sending the form does not apply the voucher to a job.
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
            The people who handle enquiries for that brand can read the message. If the form sends the enquiry, it goes by email through Google Workspace (Gmail) to that inbox. The form does not send the enquiry into a job database. Google handles the delivery and may process the message outside Australia. If you email us from your own email app, your email provider handles the message.
          </p>
          <p>We do not sell personal information.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">How long we keep it</h2>
          <p>
            We keep an enquiry for as long as we need it to deal with the job and any follow-up about that job. The form sends it by email, through Google Workspace, to the inbox for the brand you pick, and it stays in that inbox.
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
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900">Job records, tenants and messages</h2>
          <p>When we arrange or carry out a job, we also collect the details we need for that job. They may come from the customer, the property manager, the owner or the tenant. They can include:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>names, phone numbers and email addresses of the customer, property manager, owner and tenant</li>
            <li>the job address and access details, such as key, code or tenant-notice arrangements</li>
            <li>photos of the work area</li>
            <li>quotes, invoices and payment status</li>
            <li>text messages, emails and notes about the job</li>
          </ul>
          <p>If a website enquiry becomes a job, we copy the details we need into our job records.</p>
          <p>
            We use these details only to arrange, carry out, invoice and follow up the job, including any workmanship or complaint issue. We do not use tenant details for marketing and we do not sell them.
          </p>
          <p>
            Our job records and messages are kept in systems run by service providers, such as Google Workspace and Notion, which may store or process data outside Australia. Only people who work on our jobs can see them.
          </p>
          <p>
            We keep job records for as long as we need them for the job, any workmanship or complaint issue, and our tax and legal record-keeping obligations (tax records are generally kept for 5 years).
          </p>
          <p>
            Tenants and other people named in a job can ask for a copy or correction of their details by emailing {corporateEmail}, as set out under Access and correction.
          </p>
        </section>

        <p className="mt-16 text-xs text-slate-500">Last updated: 24 November 2026</p>
      </article>
    </SiteFrame>
  );
}
