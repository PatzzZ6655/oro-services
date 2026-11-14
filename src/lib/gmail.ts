import nodemailer from "nodemailer";

export type GmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export function gmailCredentials(): { user: string; pass: string } | undefined {
  const user = process.env.GMAIL_USER?.trim() ?? "";
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") ?? "";
  if (!user.includes("@") || pass.length < 16) return undefined;
  return { user, pass };
}

export async function sendGmailMessage(message: {
  to: string | string[];
  replyTo?: string;
  subject: string;
  text: string;
  attachments?: GmailAttachment[];
}): Promise<boolean> {
  const auth = gmailCredentials();
  if (!auth) return false;

  const fromName = process.env.MAIL_FROM_NAME?.replace(/[\r\n]+/g, " ").trim() || "ORO Services";
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.sendMail({
      from: { name: fromName, address: auth.user },
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject.replace(/[\r\n]+/g, " ").slice(0, 180),
      text: message.text,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });
    return true;
  } finally {
    transporter.close();
  }
}
