"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobsForm } from "@/components/jobs/api";
import { useClientReady } from "@/components/jobs/client-ready";
import { KeepPage } from "@/components/jobs/keep-page";
import { compressFiles } from "@/components/jobs/resize-image";
import { SmsPicker } from "@/components/jobs/sms-picker";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import { OPTIONAL_ITEMS, REQUIRED_ITEMS, checklistText } from "@/lib/jobs-app/checklist";
import {
  clearStoredLeaveDraft,
  leaveDraftDirty,
  parseLeaveDraft,
  readLeaveSnapshot,
  writeStoredLeaveDraft,
  type LeaveDraft,
} from "@/lib/jobs-app/leave-draft";
import { keptCount, LEAVE_MAX_EDGE, LEAVE_QUALITIES } from "@/lib/jobs-app/photos";
import type { LeaveResult } from "@/lib/jobs-app/types";
import { clearVisit, loadVisit, type ActiveVisit } from "@/lib/jobs-app/visit";

type Step = "checklist" | "outcome" | "details";

export function LeaveScreen() {
  const router = useRouter();
  const ready = useClientReady();
  const visit = ready ? loadVisit() : null;
  const [checked, setChecked] = useState<string[]>([]);
  const [warn, setWarn] = useState(false);
  const [step, setStep] = useState<Step>("checklist");
  const [outcome, setOutcome] = useState<"return" | "complete" | null>(null);
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [photosCleared, setPhotosCleared] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drop, setDrop] = useState<{ kept: File[]; dropped: number } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<LeaveResult | null>(null);
  const [finished, setFinished] = useState<ActiveVisit | null>(null);
  const current = finished ?? visit;
  const draftCache = useRef<string | null>(null);
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      if (draftCache.current === null) draftCache.current = readLeaveSnapshot();
      return draftCache.current;
    },
    () => "",
  );
  if (ready && !hydrated && stored !== "") {
    setHydrated(true);
    if (stored !== "\0" && visit) {
      const draft = parseLeaveDraft(stored);
      if (draft && draft.jobId === visit.jobId) {
        setChecked(draft.checked);
        setStep(draft.step);
        setOutcome(draft.outcome || null);
        setNotes(draft.notes);
        setIssues(draft.issues);
        setPhotoCount(draft.photoCount);
        setPhotosCleared(draft.photoCount > 0);
      }
    }
  }

  const currentDraft = useCallback((): LeaveDraft => {
    return {
      jobId: visit?.jobId ?? "",
      step,
      checked,
      outcome: outcome ?? "",
      notes,
      issues,
      photoCount,
    };
  }, [visit?.jobId, step, checked, outcome, notes, issues, photoCount]);

  useEffect(() => {
    if (!ready || !hydrated || result || !visit) return;
    writeStoredLeaveDraft(currentDraft());
  }, [ready, hydrated, result, visit, currentDraft]);

  useEffect(() => {
    if (!ready || !hydrated || result || !visit) return;
    if (!leaveDraftDirty(currentDraft())) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [ready, hydrated, result, visit, currentDraft]);

  if (!ready || !hydrated) {
    return (
      <KeepPage>
        <Screen title="Leave">
          <Spinner label="Opening" />
        </Screen>
      </KeepPage>
    );
  }

  if (result && current) {
    return (
      <KeepPage>
      <Screen title="Leave" back={<BackLink href="/jobs" />}>
        <p className="whitespace-pre-wrap text-lg">{result.summary || "Visit recorded."}</p>
        {result.driveLink ? (
          <JobsLink href={result.driveLink} variant="outline">
            Open photo folder
          </JobsLink>
        ) : null}
        {result.pmEmailedTo ? <p className="text-base">Completion email sent to: {result.pmEmailedTo}</p> : null}
        {result.outcome === "complete" && result.voucherCode ? (
          <section className="rounded-2xl border border-black px-4 py-4">
            <p className="text-sm">$60 thank-you voucher</p>
            <p className="mt-1 break-all text-2xl font-semibold tracking-wide">{result.voucherCode}</p>
            {result.voucherExpiry ? <p className="mt-2 text-base">Valid until {result.voucherExpiry}</p> : null}
          </section>
        ) : null}
        <SmsPicker
          jobId={current.jobId}
          contacts={result.contacts}
          topSms={result.sms}
          address={result.address || current.address}
          jobTitle={result.jobTitle || current.title}
          allowManual={result.contacts.length === 0}
          verbatim={result.outcome === "complete"}
        />
        <JobsButton
          type="button"
          variant="outline"
          onClick={() => {
            router.push("/jobs");
            router.refresh();
          }}
        >
          Done
        </JobsButton>
      </Screen>
      </KeepPage>
    );
  }

  if (!visit || blocked) {
    return (
      <KeepPage>
      <Screen title="Leave" back={<BackLink href="/jobs" />}>
        <Alert>
          {blocked ? "No open visit for this job. Tap " : "Tap "}
          <span className="whitespace-nowrap">Depart</span> first.
        </Alert>
        {blocked ? (
          <JobsButton
            type="button"
            onClick={() => {
              clearVisit();
              router.push("/jobs");
              router.refresh();
            }}
          >
            Clear this departure
          </JobsButton>
        ) : (
          <Link href="/jobs/depart" className="flex min-h-14 items-center justify-center rounded-2xl bg-black text-lg font-semibold text-white">
            Go to Depart
          </Link>
        )}
      </Screen>
      </KeepPage>
    );
  }

  const selected = new Set(checked);
  const review = checklistText(selected);

  function toggle(item: string) {
    setChecked((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  }

  async function send(files: File[]) {
    setDrop(null);
    setBusy("Sending");
    setError("");
    const form = new FormData();
    form.set("business", visit?.business ?? "");
    form.set("jobId", visit?.jobId ?? "");
    form.set("outcome", outcome ?? "");
    form.set("notes", notes);
    form.set("issues", issues);
    form.set("checklist", review.text);
    for (const file of files) form.append("photos", file);
    try {
      const next = await postJobsForm<LeaveResult>("/jobs/api/leave", form);
      if (visit) setFinished(visit);
      clearVisit();
      clearStoredLeaveDraft();
      setResult(next);
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      if (reason instanceof JobsClientError && reason.code === "no_open_visit") {
        setBlocked(true);
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function submit(allowDrop: boolean) {
    setError("");
    setDrop(null);
    if (!outcome) return;
    try {
      setBusy("Compressing photos");
      const compressed = photos.length > 0 ? await compressFiles(photos, LEAVE_MAX_EDGE, LEAVE_QUALITIES) : [];
      const count = keptCount(compressed.map((file) => file.size));
      if (photos.length > 0 && count === 0) {
        setError("The photos are too large. Choose fewer.");
        setBusy("");
        return;
      }
      if (count < compressed.length && !allowDrop) {
        setDrop({ kept: compressed.slice(0, count), dropped: compressed.length - count });
        setBusy("");
        return;
      }
      await send(compressed.slice(0, count));
    } catch {
      setBusy("");
      setError("This photo could not be compressed. Use a JPEG.");
    }
  }

  return (
    <KeepPage>
    <Screen
      title="Leave"
      back={
        step === "checklist" ? (
          <BackLink href="/jobs" />
        ) : (
          <button type="button" className="min-h-11 text-base font-semibold underline" onClick={() => setStep(step === "details" ? "outcome" : "checklist")}>
            Back
          </button>
        )
      }
    >
      <p className="text-lg font-semibold">{visit.title}</p>
      <p className="text-base">{visit.address}</p>
      {error ? <Alert>{error}</Alert> : null}
      {busy ? <Spinner label={busy} /> : null}

      {step === "checklist" && !busy ? (
        <div className="flex flex-col gap-3">
          <p>Check what you finished. Leave unticked anything you did not do.</p>
          <ul className="flex flex-col gap-2">
            {REQUIRED_ITEMS.map((item) => (
              <li key={item}>
                <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-black px-3">
                  <input type="checkbox" className="h-6 w-6 accent-black" checked={selected.has(item)} onChange={() => toggle(item)} />
                  <span className="text-base">{item}</span>
                </label>
              </li>
            ))}
            {OPTIONAL_ITEMS.map((item) => (
              <li key={item}>
                <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-300 px-3">
                  <input type="checkbox" className="h-6 w-6 accent-black" checked={selected.has(item)} onChange={() => toggle(item)} />
                  <span className="text-base">
                    {item}
                    <span className="mt-1 block text-sm text-neutral-600">Optional. Leaving this unticked is fine.</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <JobsButton
            type="button"
            onClick={() => {
              if (review.missing.length > 0) setWarn(true);
              else setStep("outcome");
            }}
          >
            Next
          </JobsButton>
        </div>
      ) : null}

      {step === "outcome" && !busy ? (
        <div className="flex flex-col gap-3">
          <p>How does this visit end?</p>
          <JobsButton type="button" onClick={() => { setOutcome("return"); setStep("details"); }}>
            Coming back
          </JobsButton>
          <JobsButton type="button" variant="outline" onClick={() => { setOutcome("complete"); setStep("details"); }}>
            Job complete
          </JobsButton>
          <p className="text-sm">Job complete closes this work order. Coming back leaves it open for another visit.</p>
        </div>
      ) : null}

      {step === "details" && !busy ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-base">
            Notes (optional, dictation works)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${fieldClass} py-3`} />
          </label>
          <label className="flex flex-col gap-2 text-base">
            Other issues found (optional, saved to Notion only, not in the SMS or the property-manager email)
            <textarea value={issues} onChange={(event) => setIssues(event.target.value)} rows={3} className={`${fieldClass} py-3`} />
          </label>
          <label className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-black text-lg font-semibold">
            Choose photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                const picked = [...(event.target.files ?? [])];
                setPhotos(picked);
                setPhotoCount(picked.length);
                if (picked.length > 0) setPhotosCleared(false);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {photos.length > 0 ? (
            <p>{photos.length} selected</p>
          ) : photosCleared ? (
            <p>The photos were cleared when the page reloaded. Add them again if you still want them with this visit.</p>
          ) : (
            <p>Photos are optional.</p>
          )}
          <JobsButton type="button" onClick={() => submit(false)}>
            Submit
          </JobsButton>
        </div>
      ) : null}

      {warn ? (
        <div role="alertdialog" aria-labelledby="missing-title" className="fixed inset-0 z-20 flex items-end bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-white p-4">
            <h2 id="missing-title" className="text-lg font-semibold">These are not confirmed</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {review.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3">
              <JobsButton type="button" onClick={() => setWarn(false)}>
                Go back and finish
              </JobsButton>
              <JobsButton
                type="button"
                variant="outline"
                onClick={() => {
                  setWarn(false);
                  setStep("outcome");
                }}
              >
                Continue anyway
              </JobsButton>
            </div>
          </div>
        </div>
      ) : null}

      {drop ? (
        <div role="alertdialog" aria-labelledby="drop-title" className="fixed inset-0 z-20 flex items-end bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-white p-4">
            <h2 id="drop-title" className="text-lg font-semibold">{drop.dropped} photos do not fit</h2>
            <p className="mt-2 text-base">One upload is about 4 MB. You can send the first {drop.kept.length}.</p>
            <div className="mt-4 flex flex-col gap-3">
              <JobsButton type="button" variant="outline" onClick={() => setDrop(null)}>
                Choose again
              </JobsButton>
              <JobsButton type="button" onClick={() => send(drop.kept)}>
                Upload the first {drop.kept.length}
              </JobsButton>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
    </KeepPage>
  );
}
