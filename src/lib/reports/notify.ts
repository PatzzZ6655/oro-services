import { sendGmailMessage } from "@/lib/gmail";
import { reportCard, type ReportValue } from "@/lib/reports/catalog";
import { formatAuDate } from "@/lib/reports/dates";

export function staffInbox(): string {
  const configured = process.env.REPORT_NOTIFY_EMAIL?.trim().toLowerCase() ?? "";
  return configured.includes("@") ? configured : "pat.z@orosvc.com";
}

export async function emailReport(options: {
  report: ReportValue;
  pdf: Uint8Array;
  driveUrl: string;
  replyTo: string;
}): Promise<{ staff: boolean; client: boolean; clientRequested: boolean }> {
  const card = reportCard(options.report.kind);
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
  let staffSent = false;
  let clientSent = false;
  try {
    staffSent = await sendGmailMessage({
      to: staff,
      replyTo: options.replyTo,
      subject,
      text: [
        card.title,
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
      clientSent = await sendGmailMessage({
        to: client,
        replyTo: options.replyTo,
        subject,
        text: [card.title, formatAuDate(options.report.date), address, "", "A copy of the sign-off is attached."].join("\n"),
        attachments: [attachment],
      });
    } catch {
      clientSent = false;
    }
  }
  return { staff: staffSent, client: clientSent, clientRequested: Boolean(client && client !== staff) };
}
