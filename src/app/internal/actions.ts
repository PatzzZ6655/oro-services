"use server";

import { requireUser } from "@/lib/auth/current";
import { looksLikeImage, readText, safePhotoName } from "@/lib/enquiry";
import { saveReportPackage, driveConfigured } from "@/lib/reports/drive";
import { emailReport } from "@/lib/reports/notify";
import { buildReportPdf, type ReportPhoto } from "@/lib/reports/pdf";
import { type SubmitState } from "@/lib/reports/state";
import { itemPhotoField, itemPhotoMax, keyPhotoField, reportPhotoMax, type ReportValue } from "@/lib/reports/catalog";
import { keyPhotoSlots, parseSignature, reportAddress, reportDate, validatePhotoBudget, validatePhotoFiles, validateReport } from "@/lib/reports/validate";
import { answersFromForm } from "@/lib/jobs/queries";
import { databaseConfigured, recordJobReport } from "@/lib/jobs/db";

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

async function readKeyPhotos(formData: FormData, report: ReportValue): Promise<{ files: ReportPhoto[]; error?: string; field?: string }> {
  const files: ReportPhoto[] = [];
  for (const slot of keyPhotoSlots(report, formData)) {
    const uploaded = formData.getAll(keyPhotoField(slot.field)).filter((item): item is File => item instanceof File && item.size > 0);
    if (uploaded.length > slot.max) return { files: [], error: "Use fewer photos.", field: keyPhotoField(slot.field) };
    for (const [index, file] of uploaded.entries()) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = file.type === "image/png" ? "image/png" : file.type === "image/jpeg" ? "image/jpeg" : null;
      if (!mime || !looksLikeImage(bytes, mime)) {
        return { files: [], error: "Use a JPEG or PNG photo.", field: keyPhotoField(slot.field) };
      }
      const caption = uploaded.length > 1 ? `${slot.caption} ${index + 1}` : slot.caption;
      const safe = caption.replace(/[^a-zA-Z0-9]+/g, " ").trim().slice(0, 40) || "photo";
      const extension = mime === "image/png" ? "png" : "jpg";
      files.push({
        name: `Key ${files.length + 1} ${safe}.${extension}`,
        bytes,
        mime,
        caption,
      });
    }
  }
  return { files };
}

function morePhotoName(index: number, caption: string): string {
  const extra = caption.replace(/[^a-zA-Z0-9]+/g, " ").trim().slice(0, 40);
  return extra ? `Additional ${index + 1} ${extra}.jpg` : `Additional ${index + 1}.jpg`;
}

async function readMorePhotos(formData: FormData): Promise<{ files: ReportPhoto[]; error?: string }> {
  const uploaded = formData.getAll("morePhotos").filter((item): item is File => item instanceof File && item.size > 0);
  if (uploaded.length > reportPhotoMax) return { files: [], error: "Add up to 8 photos." };
  const files: ReportPhoto[] = [];
  for (const [index, file] of uploaded.entries()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if ((file.type !== "image/jpeg" && file.type !== "image/png") || !looksLikeImage(bytes, file.type)) {
      return { files: [], error: "Use a JPEG or PNG photo." };
    }
    const caption = readText(formData, `moreCaption.${index}`).replace(/\s+/g, " ").trim().slice(0, 80);
    files.push({
      name: morePhotoName(index, caption),
      bytes,
      mime: file.type,
      caption,
    });
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
  const morePhotos = await readMorePhotos(formData);
  const itemPhotos = parsed.ok ? await readItemPhotos(formData, parsed.value) : { files: [] as ReportPhoto[] };
  const keyPhotos = parsed.ok ? await readKeyPhotos(formData, parsed.value) : { files: [] as ReportPhoto[] };
  const budgetFiles = [...(photos.files ?? []), ...(morePhotos.files ?? []), ...(itemPhotos.files ?? []), ...(keyPhotos.files ?? [])].map((file) => ({
    size: file.bytes.byteLength,
    type: file.mime,
  }));
  const budgetError = validatePhotoBudget(budgetFiles);
  if (!parsed.ok || !signature.ok || photos.error || morePhotos.error || itemPhotos.error || keyPhotos.error || budgetError) {
    return {
      status: "invalid",
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(signature.ok ? {} : { signature: signature.error }),
        ...(photos.error ? { photos: photos.error } : {}),
        ...(morePhotos.error ? { photos: morePhotos.error } : {}),
        ...(itemPhotos.error ? { photos: itemPhotos.error } : {}),
        ...(keyPhotos.error ? { [keyPhotos.field ?? "photos"]: keyPhotos.error } : {}),
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
      photos: [...photos.files, ...morePhotos.files],
      itemPhotos: itemPhotos.files,
      keyPhotos: keyPhotos.files,
      submittedBy: user.email,
      jobNumber: readText(formData, "jobNumber"),
    });
    const jobId = readText(formData, "jobId");
    const jobNumber = readText(formData, "jobNumber");
    const saved = await saveReportPackage({
      kind: parsed.value.kind,
      date: reportDate(parsed.value),
      address: reportAddress(parsed.value),
      jobNumber,
      pdf,
      photos: [...keyPhotos.files, ...photos.files, ...morePhotos.files, ...itemPhotos.files],
    });
    if (jobId && databaseConfigured()) {
      try {
        await recordJobReport({
          jobId,
          formType: parsed.value.kind,
          driveFileId: saved.fileId,
          driveUrl: saved.url,
          answers: JSON.stringify(answersFromForm(formData)),
          submittedBy: user.email,
        });
      } catch {
        console.error("job report record failed");
      }
    }
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
