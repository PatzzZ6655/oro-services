import { sendCompanyReport } from "@/lib/gmail";
import { companies, companyFor, reportCard, reportMailIdentity, type CompanyId, type ReportValue } from "@/lib/reports/catalog";
import { formatAuDate } from "@/lib/reports/dates";

export function staffInbox(): string {
  const configured = process.env.REPORT_NOTIFY_EMAIL?.trim().toLowerCase() ?? "";
  return configured.includes("@") ? configured : "pat.z@orosvc.com";
}

export async function emailReport(options: {
  report: ReportValue;
  pdf: Uint8Array;
  driveUrl: string;
}): Promise<{ staff: boolean; client: boolean; clientRequested: boolean }> {
  const card = reportCard(options.report.kind);
  const company = companies[companyFor(options.report)];
  const mail = reportMailIdentity(options.report);
  const filename = `${card.title}.pdf`;
  const attachment = {
    filename,
    content: Buffer.from(options.pdf),
    contentType: "application/pdf",
  };
  const address = options.report.address.replace(/[\r\n]+/g, " ");
  const subject = `${card.title} — ${address}`.slice(0, 180);
  const staff = staffInbox();
  const client = options.report.kind === "job-sign-off" ? options.report.clientEmail : undefined;
  const identity = { fromName: mail.fromName, alias: mail.alias };
  let staffSent = false;
  let clientSent = false;
  try {
    staffSent = await sendCompanyReport({
      ...identity,
      to: staff,
      replyTo: mail.replyTo,
      subject,
      text: [
        card.title,
        company.legalName,
        formatAuDate(options.report.date),
        address,
        "",
        "The PDF is attached.",
        options.driveUrl ? `Drive copy: ${options.driveUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      attachments: [attachment],
    });
  } catch {
    staffSent = false;
  }
  if (client && client !== staff) {
    try {
      clientSent = await sendCompanyReport({
        ...identity,
        to: client,
        replyTo: mail.replyTo,
        subject,
        text: [
          card.title,
          formatAuDate(options.report.date),
          address,
          "",
          "A copy of the report is attached.",
          "",
          company.legalName,
        ].join("\n"),
        attachments: [attachment],
      });
    } catch {
      clientSent = false;
    }
  }
  return { staff: staffSent, client: clientSent, clientRequested: Boolean(client && client !== staff) };
}

export async function emailSafetyCopy(options: {
  company: CompanyId;
  title: string;
  date: string;
  address: string;
  pdf: Uint8Array;
  driveUrl: string;
}): Promise<boolean> {
  const company = companies[options.company];
  try {
    return await sendCompanyReport({
      fromName: company.name,
      alias: company.email,
      to: staffInbox(),
      replyTo: company.email,
      subject: `${options.title} — ${options.address.replace(/[\r\n]+/g, " ")}`.slice(0, 180),
      text: [options.title, company.legalName, formatAuDate(options.date), options.address, "", "The PDF is attached.", options.driveUrl ? `Drive copy: ${options.driveUrl}` : ""].filter(Boolean).join("\n"),
      attachments: [{ filename: `${options.title}.pdf`, content: Buffer.from(options.pdf), contentType: "application/pdf" }],
    });
  } catch {
    return false;
  }
}
