"use server";

import { requireUser } from "@/lib/auth/current";
import { looksLikeImage } from "@/lib/enquiry";
import { driveConfigured, saveLicenceRecord, saveReportPackage } from "@/lib/reports/drive";
import { emailSafetyCopy } from "@/lib/reports/notify";
import type { ReportPhoto } from "@/lib/reports/pdf";
import { buildSafetyPdf } from "@/lib/reports/safety-pdf";
import { isRealCalendarDate } from "@/lib/appointments";
import { itemPhotoMax, type FieldErrors } from "@/lib/reports/catalog";
import { validateSafety } from "@/lib/reports/safety";
import type { SubmitState } from "@/lib/reports/state";

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function readItemPhotos(formData: FormData): Promise<{ files: ReportPhoto[]; error?: string }> {
  const files: ReportPhoto[] = [];
  const counts = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("itemPhoto.") || !(value instanceof File) || value.size === 0) continue;
    const itemKey = key.slice("itemPhoto.".length);
    const count = (counts.get(itemKey) ?? 0) + 1;
    counts.set(itemKey, count);
    if (count > itemPhotoMax) return { files: [], error: "Use up to 4 photos on each item." };
    const bytes = new Uint8Array(await value.arrayBuffer());
    if ((value.type !== "image/jpeg" && value.type !== "image/png") || !looksLikeImage(bytes, value.type)) {
      return { files: [], error: "Use a JPEG or PNG photo." };
    }
    const extension = value.type === "image/png" ? "png" : "jpg";
    files.push({
      name: `${itemKey.replace(/[^a-zA-Z0-9]+/g, " ").trim()}-${count}.${extension}`,
      bytes,
      mime: value.type,
      itemKey,
    });
  }
  return { files };
}

export async function submitSafety(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  await requireUser();
  const parsed = validateSafety(read(formData, "kind"), formData);
  const photos = await readItemPhotos(formData);
  if (!parsed.ok || photos.error) {
    return { status: "invalid", errors: { ...(parsed.ok ? {} : parsed.errors), ...(photos.error ? { photos: photos.error } : {}) } };
  }
  if (!driveConfigured()) {
    return { status: "error", message: "Google Drive isn't connected, so this report can't be filed." };
  }
  try {
    const pdf = await buildSafetyPdf(parsed.value, photos.files);
    const saved = await saveReportPackage({
      kind: parsed.value.kind,
      date: parsed.value.date,
      address: parsed.value.address,
      pdf,
      photos: photos.files,
    });
    const emailed = parsed.value.kind === "incident" ? false : await emailSafetyCopy({
      company: parsed.value.company,
      title: parsed.value.title,
      date: parsed.value.date,
      address: parsed.value.address,
      pdf,
      driveUrl: saved.url,
    });
    return { status: "sent", driveUrl: saved.url, emailed, clientEmailed: false, clientRequested: false };
  } catch {
    console.error("safety filing failed");
    return { status: "error", message: "The report could not be saved to Google Drive. Try again." };
  }
}

export async function submitLicence(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  await requireUser();
  const errors: FieldErrors = {};
  const name = read(formData, "name").replace(/\s+/g, " ").trim();
  const company = read(formData, "company");
  const whiteCard = read(formData, "whiteCard").replace(/\s+/g, " ").trim();
  const licence = read(formData, "licence").replace(/\s+/g, " ").trim();
  const expiry = read(formData, "expiry").trim();
  if (name.length < 2) errors.name = "Enter the worker's name.";
  if (company !== "emoro" && company !== "emporo") errors.company = "Choose Emoro Building or Emporo Plumbing.";
  if (licence.length < 2) errors.licence = "Enter the licence.";
  if (!isRealCalendarDate(expiry) || expiry < "2020-01-01" || expiry > "2046-12-31") errors.expiry = "Enter the expiry date.";
  if (Object.keys(errors).length > 0 || (company !== "emoro" && company !== "emporo")) return { status: "invalid", errors };
  if (!driveConfigured()) return { status: "error", message: "Google Drive isn't connected, so this record can't be filed." };
  try {
    await saveLicenceRecord({ name, company, whiteCard, licence, expiry });
    return { status: "sent", driveUrl: "", emailed: false, clientEmailed: false, clientRequested: false };
  } catch {
    console.error("licence filing failed");
    return { status: "error", message: "The record could not be saved to Google Drive. Try again." };
  }
}
