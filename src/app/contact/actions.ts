"use server";

import { headers } from "next/headers";
import nodemailer from "nodemailer";
import {
  deliveryConfigured,
  enquiryMailto,
  enquiryText,
  fallbackMessage,
  looksLikeImage,
  parseEnquiry,
  photoError,
  readText,
  safePhotoName,
  type EnquiryState,
  type ParsedEnquiry,
} from "@/lib/enquiry";
import { allowEnquiry, clientAddress } from "@/lib/rate-limit";

type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

async function readPhoto(
  formData: FormData,
): Promise<{ error?: string; attachment?: Attachment; attached: boolean }> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { attached: false };
  }

  const error = photoError(photo);
  if (error) return { error, attached: true };

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!looksLikeImage(bytes, photo.type)) {
    return { error: "That file doesn't look like a JPEG, PNG, or WebP photo.", attached: true };
  }

  return {
    attached: true,
    attachment: {
      filename: safePhotoName(photo.name, photo.type),
      content: Buffer.from(bytes),
      contentType: photo.type,
    },
  };
}

function gmailAuth(): { user: string; pass: string } | undefined {
  const user = process.env.GMAIL_USER?.trim() ?? "";
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") ?? "";
  if (!user.includes("@") || pass.length < 16) return undefined;
  return { user, pass };
}

async function sendWithGmail(enquiry: ParsedEnquiry, attachment?: Attachment): Promise<boolean> {
  const auth = gmailAuth();
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
      to: enquiry.inbox,
      replyTo: enquiry.email,
      subject: `${enquiry.serviceLabel} — ${enquiry.suburb}`,
      text: enquiryText(enquiry, attachment?.filename),
      attachments: attachment
        ? [
            {
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType,
            },
          ]
        : undefined,
    });
    return true;
  } finally {
    transporter.close();
  }
}

export async function sendEnquiry(
  _previous: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  if (readText(formData, "oro_fax").trim()) {
    return { status: "sent", inbox: "" };
  }

  const parsed = parseEnquiry(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const photo = await readPhoto(formData);
  if (photo.error) {
    return { status: "invalid", errors: { photo: photo.error } };
  }

  const headerStore = await headers();
  const limited = !allowEnquiry(clientAddress(headerStore));
  if (limited) {
    return {
      status: "limited",
      inbox: parsed.value.inbox,
      mailto: enquiryMailto(parsed.value),
      message: "Too many form submissions from this connection. Email the address below instead.",
    };
  }

  const mailto = enquiryMailto(
    parsed.value,
    photo.attached ? "Photo: attach it in your email app. The website form did not include it." : undefined,
  );

  if (!deliveryConfigured()) {
    return {
      status: "fallback",
      inbox: parsed.value.inbox,
      mailto,
      message: fallbackMessage(photo.attached),
    };
  }

  try {
    const sent = await sendWithGmail(parsed.value, photo.attachment);
    if (!sent) {
      return {
        status: "fallback",
        inbox: parsed.value.inbox,
        mailto,
        message: fallbackMessage(photo.attached),
      };
    }
  } catch {
    return {
      status: "fallback",
      inbox: parsed.value.inbox,
      mailto,
      message: fallbackMessage(photo.attached),
    };
  }

  return { status: "sent", inbox: parsed.value.inbox };
}
