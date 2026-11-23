import { SiteFrame } from "@/components/site-frame";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description:
    "These terms apply to work carried out under the Emoro Building and Emporo Plumbing brands.",
  path: "/terms",
});

type TermsBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

const sections: { heading: string; blocks: TermsBlock[] }[] = [
  {
    heading: "About these terms",
    blocks: [
      {
        type: "p",
        text: "These terms apply to work carried out under the Emoro Building brand by Emoro Building Pty Ltd, and under the Emporo Plumbing brand by Emporo Plumbing Pty Ltd. ORO Services is the trading name we use for both brands. They apply when the customer accepts a quote, confirms a booking, or allows us to start work.",
      },
      {
        type: "p",
        text: 'In these terms, "we", "us" and "our" mean the company named on the quote or tax invoice for the job (Emoro Building Pty Ltd or Emporo Plumbing Pty Ltd). "You" and "the customer" mean the person, business, or property manager or agent who requests or accepts the work, as named on the quote or invoice.',
      },
      {
        type: "p",
        text: "Our company name and business details are shown on each quote and tax invoice. These terms apply to each job together with the quote for that job (or, if there is no written quote, the booking details we confirmed). If a job-specific note on the quote conflicts with these general terms, the note on the quote applies. The version of these terms in effect on the date the customer accepts the quote (or, if there is no quote, the date the booking is confirmed) applies to that job.",
      },
    ],
  },
  {
    heading: "Quotes and acceptance",
    blocks: [
      {
        type: "p",
        text: "Quotes are valid for 14 days from the date issued, unless a shorter period is stated on the quote. A quote covers only the work and materials listed. Our quote is based on a visual inspection and the photos and information provided. If the work reveals hidden or different conditions, any extra work or cost needs approval under Variations before we continue, except urgent make-safe work and incidental repairs.",
      },
      {
        type: "p",
        text: "The customer can accept a quote in writing, including by email or text, or by allowing work to start.",
      },
    ],
  },
  {
    heading: "Prices and GST",
    blocks: [
      {
        type: "p",
        text: "Prices include GST unless stated otherwise. Tax invoices will include the information required by the Australian Taxation Office, including the customer's name or ABN on jobs of $1,000 or more.",
      },
    ],
  },
  {
    heading: "Call-outs, access and after-hours",
    blocks: [
      {
        type: "p",
        text: "The customer or their property manager should give at least 24 hours' notice to cancel or reschedule. If the customer cancels or reschedules a booking with less than 24 hours' notice, we may charge a call-out fee to cover our reasonable time and travel already committed, up to a maximum of $176 (including GST). The same call-out fee may apply if we attend at the booked time and cannot get safe access, unless we were told at least 24 hours beforehand.",
      },
      {
        type: "p",
        text: "After-hours or weekend rates will be confirmed before we attend. The customer or their property manager is responsible for arranging safe access, including keys, codes and tenant notice.",
      },
    ],
  },
  {
    heading: "Appointment times",
    blocks: [
      {
        type: "p",
        text: "Appointment times are our best estimate and are not guaranteed. We may need to delay, shorten or reschedule a visit because of emergency work (such as a gas leak or burst pipe), earlier jobs running over, traffic, accidents, vehicle breakdown, weather, illness or other events outside our reasonable control. If this happens, we'll let the customer or their property manager know as soon as we reasonably can and arrange a new time at no extra charge. To the extent permitted by law (including the Australian Consumer Law), we are not liable for any loss, cost or time off work caused by a delayed or rescheduled appointment where the delay or rescheduling is caused by one of the reasons listed above.",
      },
    ],
  },
  {
    heading: "Payment",
    blocks: [
      {
        type: "p",
        text: "Payment is due within 30 days of the invoice date, or within 45 days if agreed in writing for an approved account.",
      },
      {
        type: "p",
        text: "The person or agency named on the quote or invoice is the customer. The customer confirms that they are the owner, or have the authority of the owner or the owners corporation, to approve the work, and is responsible for payment, unless a named owner has accepted the quote in writing.",
      },
    ],
  },
  {
    heading: "Late payment",
    blocks: [
      {
        type: "p",
        text: "Overdue amounts may incur interest at the rate prescribed under the Penalty Interest Rates Act 1983 (Vic), plus reasonable costs of recovery. We may pause further work until the account is up to date.",
      },
    ],
  },
  {
    heading: "Cancellation after acceptance",
    blocks: [
      {
        type: "p",
        text: "The customer can cancel a job after accepting the quote by telling us in writing. We will not charge for work not yet done. We may charge for work already done and, for materials already ordered for the job, 25% of the cost of those materials plus any delivery or transport costs already incurred. We will list these costs on the invoice. The call-out fee for late cancellation is not charged on top of these costs for the same attendance.",
      },
    ],
  },
  {
    heading: "Materials",
    blocks: [
      {
        type: "p",
        text: "Materials we supply remain our property until paid in full. Risk in those materials passes on delivery or installation.",
      },
    ],
  },
  {
    heading: "Workmanship and consumer rights",
    blocks: [
      {
        type: "p",
        text: "If you notice a problem with our workmanship, tell us promptly. We will inspect it and, where it is our responsibility, fix it at no cost to you. Parts and fixtures we supply may also come with a manufacturer's warranty. Any manufacturer's warranty is in addition to, and does not limit, your rights under the Australian Consumer Law, and we can give you the manufacturer's warranty details on request.",
      },
      {
        type: "p",
        text: "Workmanship promise – details. The promise above is given by the company named on the quote and tax invoice for the job (Emoro Building Pty Ltd or Emporo Plumbing Pty Ltd). Contact: info@orosvc.com · www.orosvc.com. It covers problems with our workmanship that appear within 6 months of the date we complete the work. To claim, email info@orosvc.com with the job address, the invoice number, a short description of the problem and photos. We will contact you to arrange an inspection and, where the problem is our responsibility, fix it at no cost to you. We bear the cost of inspecting and fixing problems that are our responsibility. Your own costs of making a claim (for example, phone calls or postage) are borne by you. The benefits given by this promise are in addition to other rights and remedies you have under a law in relation to the goods and services we supply.",
      },
      {
        type: "p",
        text: "Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. For major failures with the service, you are entitled:",
      },
      {
        type: "ul",
        items: [
          "to cancel your service contract with us; and",
          "to a refund for the unused portion, or to compensation for its reduced value.",
        ],
      },
      {
        type: "p",
        text: "You are also entitled to choose a refund or replacement for major failures with goods. If a failure with the goods or a service does not amount to a major failure, you are entitled to have the failure rectified in a reasonable time. If this is not done you are entitled to a refund for the goods and to cancel the contract for the service and obtain a refund of any unused portion. You are also entitled to be compensated for any other reasonably foreseeable loss or damage from a failure in the goods or service.",
      },
      {
        type: "p",
        text: "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot legally be excluded under the Australian Consumer Law or other applicable law.",
      },
    ],
  },
  {
    heading: "Matching finishes",
    blocks: [
      {
        type: "p",
        text: "We will take reasonable care, but an exact match to existing colours, tiles, render, paint, timber or other finishes is not guaranteed, including because of ageing, light, wear or batch differences.",
      },
    ],
  },
  {
    heading: "Customer-supplied materials",
    blocks: [
      {
        type: "p",
        text: "If the customer supplies materials or fixtures, we will install them with reasonable care, but we do not warrant their quality, suitability, colour or performance. If items are missing, incorrect or unsuitable, any extra labour needs approval under Variations before we charge it.",
      },
      {
        type: "p",
        text: "We may decline to install items that are not WaterMark-certified or otherwise not compliant with the relevant standards, or that we reasonably consider unsafe.",
      },
    ],
  },
  {
    heading: "Product supply and substitutions",
    blocks: [
      {
        type: "p",
        text: "Where we supply products, the final brand or model may depend on supplier availability and compatibility with existing services and site conditions. If a listed item is unavailable or not compatible, we will tell the customer, and any substitute or change in cost needs approval under Variations before we proceed.",
      },
    ],
  },
  {
    heading: "Pre-existing conditions",
    blocks: [
      {
        type: "p",
        text: "We are not responsible for pre-existing defects, settlement or other movement, moisture, or work done by others before we started, except to the extent our work causes new damage.",
      },
    ],
  },
  {
    heading: "Investigative and diagnostic repairs",
    blocks: [
      {
        type: "p",
        text: "Some faults, such as leaks, intermittent defects and concealed issues, require a process of elimination, as the cause may not be visible or may be in more than one location. Where we repair or treat an area identified during an attendance, no warranty can be provided that this will completely resolve the issue until it has been monitored under normal conditions (for roof leaks, after suitable rainfall). If the issue continues, further investigation and/or repair may be required. Any extra cost needs approval under Variations before that work goes ahead. A continuing issue after an investigative repair is not, of itself, a defect in our workmanship.",
      },
    ],
  },
  {
    heading: "Variations",
    blocks: [
      {
        type: "p",
        text: 'Changes to the quoted scope, including customer-requested changes, are variations. Before we do any extra work or charge any extra cost, we will explain the work and its cost and get the customer\'s approval, which can be given in writing (including by email or text) or verbally and confirmed in writing ("approval under Variations"). The only exceptions are urgent make-safe work and incidental repairs, as described below. Approved variations are charged at the agreed price.',
      },
      {
        type: "p",
        text: "Urgent make-safe work means the minimum work needed to stop an immediate risk to people or immediate damage to property, such as isolating water, gas or power, capping a burst pipe, or putting up a temporary cover. We will try to contact the customer or their property manager first. If we cannot reach them straight away, we may do the urgent make-safe work without prior approval. It is charged at our normal rates (or the after-hours rates confirmed for that attendance), and we will explain what we did, why, and the cost as soon as practicable. Any further repair after the site is made safe needs approval under Variations.",
      },
      {
        type: "p",
        text: "Incidental repairs: During the works we may find a defect in an existing component that is directly connected to, or affected by, the quoted works, that was not apparent when we quoted, and that needs to be fixed for the quoted work to be completed and work properly (for example, a failed non-return valve or a leaking pressure/temperature relief valve on the hot water system being serviced). Such components are often already worn, scaled or near the end of their service life, and the defect may only become apparent once they are handled; it is a pre-existing condition unless caused by our work. Where the extra cost of all such repairs (parts and labour) is $176 (including GST) or less in total for the job, we may carry them out without the customer's prior approval. We will tell the customer or their property manager what we found and what we did, no later than when we send the invoice, and itemise each repair and its cost separately on the invoice, with photos where practical. If the customer believes an incidental repair was not reasonably necessary to complete the quoted work, they can tell us within 14 days of the invoice date; we will review it in good faith and, if we agree, remove or credit that charge. The customer can also tell us, when booking or accepting the quote, that they want to be asked before any incidental repair is done. This clause does not apply to materials or fixtures supplied by the customer, and a change of brand or model still needs the customer's agreement under Product supply and substitutions. Any other defect, or any repair that would take the total above $176 (including GST), needs approval under Variations, except urgent make-safe work.",
      },
    ],
  },
  {
    heading: "Asbestos and hazardous materials",
    blocks: [
      {
        type: "p",
        text: "If we suspect asbestos or other hazardous material, we will stop work in the affected area. Testing and removal by appropriately licensed specialists is an extra cost and needs approval under Variations before that work goes ahead.",
      },
    ],
  },
  {
    heading: "Work at heights",
    blocks: [
      {
        type: "p",
        text: "Work at heights is carried out only with appropriate safe access, such as scaffolding, an elevating work platform or edge protection, as required by Victorian occupational health and safety law. If the required access equipment is not included in the quote, the extra cost needs approval under Variations before we proceed. We may decline or pause work that cannot be done safely.",
      },
    ],
  },
  {
    heading: "Confined spaces",
    blocks: [
      {
        type: "p",
        text: "Work in a confined space is carried out only with the permits and controls required by Victorian occupational health and safety law. Examples include a pit, a tank, or a subfloor or roof void that is a confined space under the Occupational Health and Safety Regulations 2017 (Vic). If we identify a confined space that was not in the quote, we will stop that work until those controls are arranged. Any extra cost needs approval under Variations before we proceed.",
      },
    ],
  },
  {
    heading: "Thank-you vouchers",
    blocks: [
      {
        type: "p",
        text: "After a completed job we may send a thank-you voucher worth $60 off a future job of $150 or more, including GST, before the voucher is applied. A voucher can be used for work with either Emoro Building or Emporo Plumbing. Emoro codes start with EMB- and Emporo codes start with EMP-.",
      },
      {
        type: "p",
        text: "A voucher is valid for 3 months from the issue date shown on it. The job must be booked within that time. The customer must quote the voucher code when booking, and before the invoice is issued. A voucher cannot be applied after an invoice has been issued.",
      },
      {
        type: "p",
        text: "Once a voucher is applied to a job, it is redeemed. It is not reused or reissued if the customer cancels the job or the job does not go ahead for a reason within the customer's control. If we cancel the job, the voucher is not treated as redeemed and stays valid until its original expiry date.",
      },
      {
        type: "p",
        text: "A voucher cannot be combined with any other discount or price reduction on the same job. If we agree to another discount or price reduction on a job, a voucher already applied to that job is treated as redeemed and is not reinstated.",
      },
      {
        type: "p",
        text: "One voucher per job. It cannot be exchanged for cash or split.",
      },
      {
        type: "p",
        text: "The voucher is a thank-you and is not conditional on leaving a review.",
      },
      {
        type: "p",
        text: "If a situation is not covered by these voucher terms, we will deal with it reasonably and consistently with these terms, and will explain our decision to the customer on request.",
      },
    ],
  },
  {
    heading: "Complaints",
    blocks: [
      {
        type: "p",
        text: "If the customer is unhappy with our work, an invoice or how we dealt with them, they can contact us in writing at info@orosvc.com with the job address, what the problem is and any photos. We will contact them within 14 days to discuss it and try to resolve it. This does not affect the customer's right to contact Consumer Affairs Victoria or take any other action available to them.",
      },
    ],
  },
  {
    heading: "Privacy",
    blocks: [
      {
        type: "p",
        text: "To arrange and carry out jobs, we collect and keep contact and job details for customers, property managers, owners and tenants, including names, phone numbers, email addresses, access details, photos, and text message and email records about the job. We use them only to arrange, carry out, invoice and follow up the job, and keep them securely. Our Privacy Policy at www.orosvc.com/privacy explains more.",
      },
    ],
  },
  {
    heading: "Governing law",
    blocks: [
      {
        type: "p",
        text: "These terms are governed by the laws of Victoria, Australia. We and the customer submit to the non-exclusive jurisdiction of the courts of Victoria.",
      },
    ],
  },
  {
    heading: "Severability",
    blocks: [
      {
        type: "p",
        text: "If any part of these terms cannot be enforced, the rest still applies.",
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteFrame>
      <article className="terms-page mx-auto max-w-3xl px-6 pb-20 pt-32 text-base leading-relaxed text-slate-800 md:pt-36 print:pb-0 print:pt-0 print:text-brand-navy">
        <h1 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">Terms and Conditions</h1>
        <p className="mt-4 text-sm text-slate-600 print:text-brand-navy">ORO Services · Emoro Building and Emporo Plumbing</p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-2xl font-bold text-brand-navy">{section.heading}</h2>
              {section.blocks.map((block) => {
                if (block.type === "ul") {
                  return (
                    <ul key={block.items.join("|")} className="list-disc space-y-1 pl-5">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                const leadIn = "Incidental repairs:";
                if (block.text.startsWith(`${leadIn} `)) {
                  return (
                    <p key={block.text}>
                      <strong>{leadIn}</strong>
                      {block.text.slice(leadIn.length)}
                    </p>
                  );
                }
                return <p key={block.text}>{block.text}</p>;
              })}
            </section>
          ))}
        </div>
        <p className="mt-16 text-xs text-slate-500 print:text-brand-navy">Last updated: 24 November 2026</p>
      </article>
    </SiteFrame>
  );
}
