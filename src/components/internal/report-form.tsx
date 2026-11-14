"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { submitReport } from "@/app/internal/actions";
import { copyLastAnswers } from "@/app/internal/job-actions";
import { applyAnswers } from "@/components/internal/draft-store";
import { useFormDraft } from "@/components/internal/use-draft";
import { reportPhotoMax, reportPhotoTotalBytes, type FieldErrors, type ReportKind } from "@/lib/reports/catalog";
import { initialSubmitState } from "@/lib/reports/state";
import { parseSignature, validatePhotoBudget, validateReport } from "@/lib/reports/validate";

export function ReportForm({
  kind,
  jobId = "",
  jobNumber = "",
  hasJobField = false,
  children,
}: {
  kind: ReportKind;
  jobId?: string;
  jobNumber?: string;
  hasJobField?: boolean;
  children: (errors: FieldErrors) => ReactNode;
}) {
  const [state, action, pending] = useActionState(submitReport, initialSubmitState);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [offline, setOffline] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLElement>(null);
  const errors = { ...(state.status === "invalid" ? state.errors : {}), ...clientErrors };
  const errorCount = Object.keys(errors).length;
  const draftKey = `${kind}:${jobId || "loose"}`;
  useFormDraft(draftKey, formRef, state.status === "sent");

  useEffect(() => {
    const retry = () => {
      if (!offline || !formRef.current) return;
      setOffline(false);
      const data = new FormData(formRef.current);
      startTransition(() => {
        void Promise.resolve(action(data)).catch(() => setOffline(true));
      });
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [action, offline]);

  useEffect(() => {
    if (state.status === "idle" && errorCount === 0) return;
    (formRef.current ?? successRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state, errorCount]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const more = data.getAll("morePhotos").filter((item): item is File => item instanceof File && item.size > 0);
    const photoError = more.length > reportPhotoMax ? "Add up to 8 photos." : null;
    const everyFile = [...data.values()].filter((item): item is File => item instanceof File && item.size > 0);
    const budgetError = validatePhotoBudget(everyFile.map((file) => ({ size: file.size, type: file.type })));
    if (photoError || budgetError) {
      setClientErrors({ photos: photoError ?? budgetError ?? "Photos are too large together. Use fewer photos." });
      return;
    }
    if (everyFile.reduce((total, file) => total + file.size, 0) > reportPhotoTotalBytes) {
      setClientErrors({ photos: "Photos are too large together. Use fewer photos." });
      return;
    }
    const parsed = validateReport(kind, data);
    const signature = parseSignature(String(data.get("signature") ?? ""));
    if (!parsed.ok || !signature.ok || photoError) {
      const next: FieldErrors = parsed.ok ? {} : { ...parsed.errors };
      if (!signature.ok) next.signature = signature.error;
      if (photoError) next.photos = photoError;
      setClientErrors(next);
      return;
    }
    setClientErrors({});
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    startTransition(() => {
      void Promise.resolve(action(data)).catch(() => setOffline(true));
    });
  }

  async function copyLast() {
    if (!jobId || !formRef.current) return;
    const answers = await copyLastAnswers(jobId, kind, String(new FormData(formRef.current).get("address") ?? ""));
    if (answers) applyAnswers(formRef.current, answers);
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
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
      {jobNumber && !hasJobField ? <input type="hidden" name="jobNumber" value={jobNumber} /> : null}
      {offline ? <p className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">Saved on this phone. It will file when the connection is back.</p> : null}
      {jobId ? (
        <button type="button" className="min-h-11 text-sm font-semibold text-brand-navy" onClick={() => void copyLast()}>
          Copy last
        </button>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      ) : null}
      {errorCount > 0 ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p>Some answers need a look.</p>
          {[...new Set(Object.entries(errors).filter(([key]) => key.startsWith("keyPhoto.")).map(([, message]) => message))].map((message) => (
            <p key={message} className="mt-1">
              {message}
            </p>
          ))}
        </div>
      ) : null}
      {children(errors)}
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
