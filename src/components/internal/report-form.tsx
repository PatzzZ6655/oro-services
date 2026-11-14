"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { submitReport } from "@/app/internal/actions";
import { reportPhotoMax, reportPhotoTotalBytes, type FieldErrors, type ReportKind } from "@/lib/reports/catalog";
import { initialSubmitState } from "@/lib/reports/state";
import { parseSignature, validatePhotoFiles, validateReport } from "@/lib/reports/validate";

async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.72;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > 350_000 && quality > 0.42) {
    quality -= 0.12;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("photo");
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export function ReportForm({ kind, children }: { kind: ReportKind; children: (errors: FieldErrors) => ReactNode }) {
  const [state, action, pending] = useActionState(submitReport, initialSubmitState);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLElement>(null);
  const errors = { ...(state.status === "invalid" ? state.errors : {}), ...clientErrors };
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (state.status === "idle" && errorCount === 0) return;
    (formRef.current ?? successRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state, errorCount]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const originals = data.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
    data.delete("photos");
    if (originals.length > reportPhotoMax) {
      setClientErrors({ photos: "Add up to 8 photos." });
      return;
    }
    try {
      for (const file of originals) data.append("photos", await compressPhoto(file));
    } catch {
      setClientErrors({ photos: "Use a JPEG or PNG photo." });
      return;
    }
    const photos = data.getAll("photos").filter((item): item is File => item instanceof File);
    const photoError = validatePhotoFiles(photos.map((file) => ({ size: file.size, type: file.type })));
    if (photos.reduce((total, file) => total + file.size, 0) > reportPhotoTotalBytes && !photoError) {
      setClientErrors({ photos: "Photos are too large together. Use fewer photos." });
      return;
    }
    const parsed = validateReport(kind, data);
    const signature = parseSignature(String(data.get("signature") ?? ""));
    if (!parsed.ok || !signature.ok || photoError) {
      setClientErrors({
        ...(parsed.ok ? {} : parsed.errors),
        ...(signature.ok ? {} : { signature: signature.error }),
        ...(photoError ? { photos: photoError } : {}),
      });
      return;
    }
    setClientErrors({});
    startTransition(() => {
      action(data);
    });
  }

  if (state.status === "sent") {
    return (
      <section ref={successRef} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-brand-navy">Report filed</h1>
        <p className="mt-2 text-sm text-slate-700">
          {state.emailed ? "A copy was emailed to the office." : "The office email was not sent. The Drive file is the record."}
        </p>
        {state.clientEmailed ? <p className="mt-1 text-sm text-slate-700">A copy was emailed to the client.</p> : null}
        {state.clientRequested && !state.clientEmailed ? (
          <p className="mt-1 text-sm text-slate-700">The client copy was not emailed.</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          <a
            href={state.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
          >
            Open the PDF
          </a>
          <Link href="/internal" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800">
            Back to reports
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="kind" value={kind} />
      {state.status === "error" ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      ) : null}
      {errorCount > 0 ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Some answers need a look.
        </p>
      ) : null}
      {children(errors)}
      <div>
        <label htmlFor="photos" className="block text-sm font-medium text-slate-800">
          Photos (optional)
        </label>
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold file:text-slate-800"
        />
        {errors.photos ? <p className="mt-1 text-sm text-red-800">{errors.photos}</p> : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-brand-navy px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Filing report…" : "File report"}
      </button>
    </form>
  );
}
