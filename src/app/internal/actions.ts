"use server";

import { requireUser } from "@/lib/auth/current";
import { looksLikeImage, readText, safePhotoName } from "@/lib/enquiry";
import { saveReportPackage, driveConfigured } from "@/lib/reports/drive";
import { emailReport } from "@/lib/reports/notify";
import { buildReportPdf, type ReportPhoto } from "@/lib/reports/pdf";
import { type SubmitState } from "@/lib/reports/state";
import { parseSignature, reportAddress, reportDate, validatePhotoFiles, validateReport } from "@/lib/reports/validate";

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
  if (!parsed.ok || !signature.ok || photos.error) {
    return {
      status: "invalid",
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(signature.ok ? {} : { signature: signature.error }),
        ...(photos.error ? { photos: photos.error } : {}),
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
      submittedBy: user.email,
    });
    const saved = await saveReportPackage({
      kind: parsed.value.kind,
      date: reportDate(parsed.value),
      address: reportAddress(parsed.value),
      pdf,
      photos: photos.files,
    });
    const mailed = await emailReport({
      report: parsed.value,
      pdf,
      driveUrl: saved.url,
      replyTo: user.email,
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
