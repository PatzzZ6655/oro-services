import {
  brandLabel,
  getBrand,
  inboxFor,
  isEnquiryBrand,
  photoMaxBytes,
  type EnquiryBrand,
} from "@/lib/content";

export type FieldName =
  | "name"
  | "email"
  | "phone"
  | "suburb"
  | "brand"
  | "service"
  | "description"
  | "photo";

export type FieldErrors = Partial<Record<FieldName, string>>;

export type EnquiryState =
  | { status: "idle" }
  | { status: "sent"; inbox: string }
  | {
      status: "fallback";
      inbox: string;
      mailto: string;
      message: string;
    }
  | { status: "invalid"; errors: FieldErrors }
  | { status: "limited"; inbox: string; mailto: string; message: string };

export const initialEnquiryState: EnquiryState = { status: "idle" };

export type ParsedEnquiry = {
  name: string;
  email: string;
  phone: string;
  suburb: string;
  brand: EnquiryBrand;
  service: string;
  serviceLabel: string;
  description: string;
  inbox: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+().\-\s]+$/;

function oneLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

export function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseEnquiry(formData: FormData):
  | { ok: true; value: ParsedEnquiry }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = oneLine(readText(formData, "name"));
  const email = oneLine(readText(formData, "email")).toLowerCase();
  const phone = oneLine(readText(formData, "phone"));
  const suburb = oneLine(readText(formData, "suburb"));
  const brandRaw = oneLine(readText(formData, "brand"));
  const serviceRaw = oneLine(readText(formData, "service")) || "unsure";
  const description = readText(formData, "description").replace(/\r\n/g, "\n").trim();

  if (name.length < 2 || name.length > 80) {
    errors.name = "Enter your name.";
  }
  if (!emailPattern.test(email) || email.length > 254) {
    errors.email = "Enter a valid email address.";
  }
  if (phone && (phone.length > 20 || phone.length < 6 || !phonePattern.test(phone))) {
    errors.phone = "Enter a phone number, or leave it blank.";
  }
  if (suburb.length < 2 || suburb.length > 80) {
    errors.suburb = "Enter the suburb or area.";
  }
  if (!isEnquiryBrand(brandRaw)) {
    errors.brand = "Choose Emoro Building, Emporo Plumbing, or a general enquiry.";
  }

  let serviceLabel = "Not sure";
  if (!errors.brand && isEnquiryBrand(brandRaw)) {
    if (brandRaw === "general" || serviceRaw === "unsure") {
      serviceLabel = "Not sure";
    } else {
      const brand = getBrand(brandRaw);
      const service = brand?.services.find((item) => item.slug === serviceRaw);
      if (!service) {
        errors.service = "Choose a service, or select Not sure.";
      } else {
        serviceLabel = service.name;
      }
    }
  }

  if (description.length < 10 || description.length > 2000) {
    errors.description = "Describe the job in a few sentences (10 to 2000 characters).";
  }

  if (Object.keys(errors).length > 0 || !isEnquiryBrand(brandRaw)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      suburb,
      brand: brandRaw,
      service: serviceRaw,
      serviceLabel,
      description,
      inbox: inboxFor(brandRaw),
    },
  };
}

export function enquiryMailto(enquiry: ParsedEnquiry, note?: string): string {
  const subject = `${brandLabel(enquiry.brand)} enquiry — ${enquiry.suburb}`;
  const lines = [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    enquiry.phone ? `Phone: ${enquiry.phone}` : "Phone: not provided",
    `Suburb / area: ${enquiry.suburb}`,
    `Brand: ${brandLabel(enquiry.brand)}`,
    `Service: ${enquiry.serviceLabel}`,
    "",
    enquiry.description.length > 1200
      ? `${enquiry.description.slice(0, 1200)}…`
      : enquiry.description,
    note ? "" : null,
    note ?? null,
  ].filter((line): line is string => line !== null);

  return `mailto:${enquiry.inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function enquiryText(enquiry: ParsedEnquiry, photoName?: string): string {
  return [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone || "not provided"}`,
    `Suburb / area: ${enquiry.suburb}`,
    `Brand: ${brandLabel(enquiry.brand)}`,
    `Service: ${enquiry.serviceLabel}`,
    photoName ? `Photo: ${photoName}` : "Photo: none",
    "",
    enquiry.description,
    "",
    "Sent from the form on https://www.orosvc.com/contact",
  ].join("\n");
}

export function photoError(file: File): string | undefined {
  if (file.size === 0) return undefined;
  if (file.size > photoMaxBytes) return "Photo must be 2 MB or smaller.";
  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
    return "Use a JPEG, PNG, or WebP photo.";
  }
  return undefined;
}

export function looksLikeImage(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (type === "image/webp") {
    return (
      bytes.length > 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

export function safePhotoName(name: string, type: string): string {
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "photo"}.${extension}`;
}

export function deliveryConfigured(): boolean {
  const user = process.env.GMAIL_USER?.trim() ?? "";
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") ?? "";
  return user.includes("@") && pass.length >= 16;
}

export function fallbackMessage(hasPhoto: boolean): string {
  const photo = hasPhoto
    ? " The photo is not included. Attach it in your email app."
    : "";
  return `This didn't send from the website. Use the email link below. Your details will be filled in.${photo}`;
}
