"use server";

import { requireUser } from "@/lib/auth/current";
import { looksLikeImage, readText, safePhotoName } from "@/lib/enquiry";
import { saveReportPackage, driveConfigured } from "@/lib/reports/drive";
import { emailReport } from "@/lib/reports/notify";
import { buildReportPdf, type ReportPhoto } from "@/lib/reports/pdf";
import { type SubmitState } from "@/lib/reports/state";
import { itemPhotoField, itemPhotoMax, type ReportValue } from "@/lib/reports/catalog";
import { parseSignature, reportAddress, reportDate, validatePhotoBudget, validatePhotoFiles, validateReport } from "@/lib/reports/validate";

function itemSlots(report: ReportValue): { key: string; index: number; label: string }[] {
  if (report.kind === "site-job-sheet") {
    return report.safety.map((item, index) => ({
      key: `safety.${report.company}.${item.id}`,
      index: index + 1,
      label: item.label,
    }));
  }
  if (report.kind === "gas-safety") {
    return report.checks.map((item, index) => ({ key: `check.${item.id}`, index: index + 1, label: item.label }));
  }
  if (report.kind === "electrical-safety") {
    const lists = [
      ["visual", report.visual],
      ["polarity", report.polarity],
      ["earth", report.earth],
    ] as const;
    return lists.flatMap(([group, items]) =>
      items.map((item, index) => ({ key: `${group}.${item.id}`, index: index + 1, label: item.label })),
    );
  }
  return [];
}

function itemFileName(index: number, label: string, number: number, type: string): string {
  const safe = label.replace(/[^a-zA-Z0-9]+/g, " ").trim().slice(0, 40) || "item";
  const extension = type === "image/png" ? "png" : "jpg";
  return `Item ${index} ${safe}-${number}.${extension}`;
}

async function readItemPhotos(formData: FormData, report: ReportValue): Promise<{ files: ReportPhoto[]; error?: string }> {
  const files: ReportPhoto[] = [];
  for (const slot of itemSlots(report)) {
    const uploaded = formData.getAll(itemPhotoField(slot.key)).filter((item): item is File => item instanceof File && item.size > 0);
    if (uploaded.length > itemPhotoMax) return { files: [], error: "Use up to 4 photos on each item." };
    let number = 1;
    for (const file of uploaded) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if ((file.type !== "image/jpeg" && file.type !== "image/png") || !looksLikeImage(bytes, file.type)) {
        return { files: [], error: "Use a JPEG or PNG photo." };
      }
      files.push({
        name: itemFileName(slot.index, slot.label, number, file.type),
        bytes,
        mime: file.type,
        itemKey: slot.key,
        caption: `Item ${slot.index}: ${slot.label}`,
      });
      number += 1;
    }
  }
  return { files };
}

async function readPhotos(formData: FormData): Promise<{ files: ReportPhoto[]; error?: string }> {
  const files = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  const problem = validatePhotoFiles(files.map((file) => ({ size: file.size, type: file.type })));
  if (problem) return { files: [], error: problem };
  const photos: ReportPhoto[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      return { files: [], error: "Use a JPEG or PNG photo." };
    }
    if (!looksLikeImage(bytes, file.type)) {
      return { files: [], error: "That file doesn't look like a JPEG or PNG photo." };
    }
    photos.push({
      name: safePhotoName(file.name, file.type),
      bytes,
      mime: file.type,
    });
  }
  return { files: photos };
}

export async function submitReport(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const parsed = validateReport(readText(formData, "kind"), formData);
  const signature = parseSignature(readText(formData, "signature"));
  const photos = await readPhotos(formData);
  const itemPhotos = parsed.ok ? await readItemPhotos(formData, parsed.value) : { files: [] as ReportPhoto[] };
  const budgetFiles = [...(photos.files ?? []), ...(itemPhotos.files ?? [])].map((file) => ({
    size: file.bytes.byteLength,
    type: file.mime,
  }));
  const budgetError = validatePhotoBudget(budgetFiles);
  if (!parsed.ok || !signature.ok || photos.error || itemPhotos.error || budgetError) {
    return {
      status: "invalid",
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(signature.ok ? {} : { signature: signature.error }),
        ...(photos.error ? { photos: photos.error } : {}),
        ...(itemPhotos.error ? { photos: itemPhotos.error } : {}),
        ...(budgetError ? { photos: budgetError } : {}),
      },
    };
  }
  if (!driveConfigured()) {
    return { status: "error", message: "Google Drive isn't connected, so this report can't be filed." };
  }

  try {
    const pdf = await buildReportPdf({
      report: parsed.value,
      signature: signature.bytes,
      photos: photos.files,
      itemPhotos: itemPhotos.files,
      submittedBy: user.email,
    });
    const saved = await saveReportPackage({
      kind: parsed.value.kind,
      date: reportDate(parsed.value),
      address: reportAddress(parsed.value),
      pdf,
      photos: [...photos.files, ...itemPhotos.files],
    });
    const mailed = await emailReport({
      report: parsed.value,
      pdf,
      driveUrl: saved.url,
    });
    return {
      status: "sent",
      driveUrl: saved.url,
      emailed: mailed.staff,
      clientEmailed: mailed.client,
      clientRequested: mailed.clientRequested,
    };
  } catch {
    console.error("report filing failed");
    return { status: "error", message: "The report could not be saved to Google Drive. Try again." };
  }
}
