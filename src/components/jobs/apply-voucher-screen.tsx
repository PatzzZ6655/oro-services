"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { BackLink, JobsButton, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import { canApplyVoucher, notionPageId } from "@/lib/jobs-app/voucher";
import { businessLabel, type ApplyVoucherResult, type Business, type TodayJob } from "@/lib/jobs-app/types";

type TodayResponse = { ok: true; date: string; jobs: TodayJob[] };

function issuerLine(voucherBusiness: string, business: Business): string | null {
  const raw = voucherBusiness.trim().toLowerCase();
  if (!raw) return null;
  const issued: Business | null = raw.includes("emporo") ? "emporo" : raw.includes("emoro") ? "emoro" : null;
  if (!issued || issued === business) return null;
  return `Voucher issued by ${businessLabel(issued)}`;
}

export function ApplyVoucherScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<TodayJob[] | null>(null);
  const [listError, setListError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState<TodayJob | null>(null);
  const [pasted, setPasted] = useState("");
  const [businessPick, setBusinessPick] = useState<Business | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplyVoucherResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    postJobs<TodayResponse>("/jobs/api/today", {})
      .then((data) => {
        if (!cancel) setJobs(data.jobs);
      })
      .catch((reason: unknown) => {
        if (cancel) return;
        if (reason instanceof JobsClientError && reason.status === 401) {
          router.push("/jobs/login");
          return;
        }
        setListError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
      });
    return () => {
      cancel = true;
    };
  }, [attempt, router]);

  const pastedId = notionPageId(pasted);
  const matched = pastedId ? jobs?.find((job) => job.jobId.replace(/-/g, "").toLowerCase() === pastedId) ?? null : null;
  const usingPaste = pasted.trim().length > 0;
  const business = usingPaste ? (matched?.business ?? businessPick) : chosen?.business ?? null;
  const jobRef = usingPaste ? pasted.trim() : chosen?.jobId ?? "";
  const hasJob = usingPaste ? Boolean(pastedId && business) : Boolean(chosen);
  const redeemed = result?.voucherStatus === "redeemed";
  const ready = canApplyVoucher({ hasJob, code, pending, redeemed });
  const selected = usingPaste ? (matched?.title ?? (pastedId ? "Pasted job" : "none")) : (chosen?.title ?? "none");
  const green = Boolean(result && result.voucherStatus === "redeemed" && result.noteWritten);
  const issued = result && business ? issuerLine(result.voucherBusiness, result.business) : null;

  async function apply() {
    if (!ready || !business) return;
    const shown = code.trim().toUpperCase();
    const jobName = selected === "none" ? "this job" : selected;
    if (!window.confirm(`Apply ${shown} to ${jobName}? The voucher will be marked as used.`)) return;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const next = await postJobs<ApplyVoucherResult>("/jobs/api/voucher", { jobRef, code: shown, business });
      setResult(next);
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setResult(null);
    setError("");
    setCode("");
    setPending(false);
  }

  return (
    <Screen title="Apply voucher" back={<BackLink href="/jobs" />}>
      {listError ? <p className="rounded-2xl border border-black px-4 py-3 text-base">{listError}</p> : null}
      {jobs === null && !listError ? <Spinner label="Loading today's jobs" /> : null}
      {jobs && jobs.length === 0 ? <p className="text-base">No jobs scheduled today</p> : null}
      <div className="flex flex-col gap-3">
        {jobs?.map((job) => {
          const active = !usingPaste && chosen?.jobId === job.jobId && chosen.business === job.business;
          return (
            <button
              key={`${job.business}:${job.jobId}`}
              type="button"
              onClick={() => {
                setChosen(job);
                setPasted("");
                setResult(null);
              }}
              className={`w-full rounded-2xl border border-black px-4 py-4 text-left ${active ? "bg-black text-white" : "bg-white"}`}
            >
              <span className="block text-sm">{businessLabel(job.business)}</span>
              <span className="mt-1 block text-lg font-semibold">{job.title}</span>
              <span className="mt-1 block text-base">{job.address}</span>
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-2 text-base">
        Or paste the Notion job link
        <input
          value={pasted}
          onChange={(event) => {
            setPasted(event.target.value);
            setResult(null);
          }}
          className={fieldClass}
        />
      </label>
      {usingPaste && !matched ? (
        <div className="grid grid-cols-2 gap-3">
          {(["emoro", "emporo"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setBusinessPick(id)}
              className={`min-h-14 rounded-2xl border border-black text-base font-semibold ${businessPick === id ? "bg-black text-white" : "bg-white"}`}
            >
              {businessLabel(id)}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-base">Selected: {selected}</p>
      <label className="flex flex-col gap-2 text-base">
        Voucher code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="EMB-XXXXXX or EMP-XXXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={fieldClass}
        />
      </label>
      <JobsButton type="button" onClick={apply} disabled={!ready}>
        {pending ? (
          <span className="flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
            Applying…
          </span>
        ) : (
          "Apply voucher"
        )}
      </JobsButton>
      {error ? (
        <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-base text-amber-950">
          {error}
        </p>
      ) : null}
      {result ? (
        <div role="status" className={`rounded-2xl px-4 py-3 text-base ${green ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
          <p>{result.voucherMessage || (green ? "Voucher applied." : "The voucher was not applied.")}</p>
          {issued ? <p className="mt-2">{issued}</p> : null}
          {!result.noteWritten ? <p className="mt-2">The job note was not updated.</p> : null}
          {green && result.jobUrl ? (
            <a href={result.jobUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">
              Open job
            </a>
          ) : null}
        </div>
      ) : null}
      <JobsButton type="button" variant="outline" onClick={startOver}>
        Start over
      </JobsButton>
    </Screen>
  );
}
