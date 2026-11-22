"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs } from "@/components/jobs/api";
import { useClientReady } from "@/components/jobs/client-ready";
import { KeepPage } from "@/components/jobs/keep-page";
import { SmsPicker } from "@/components/jobs/sms-picker";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner } from "@/components/jobs/ui";
import { mapsHref } from "@/lib/jobs-app/address";
import { businessLabel, type DepartResult, type TodayJob } from "@/lib/jobs-app/types";
import { loadVisit, saveVisit } from "@/lib/jobs-app/visit";

type TodayResponse = { ok: true; date: string; jobs: TodayJob[] };

export function DepartScreen() {
  const [jobs, setJobs] = useState<TodayJob[] | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const ready = useClientReady();
  const visit = ready ? loadVisit() : null;
  const [done, setDone] = useState<{ job: TodayJob; result: DepartResult } | null>(null);

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
        setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
      });
    return () => {
      cancel = true;
    };
  }, [attempt, router]);

  async function depart(job: TodayJob) {
    setPendingId(job.jobId);
    setError("");
    try {
      const result = await postJobs<DepartResult>("/jobs/api/depart", { business: job.business, jobId: job.jobId });
      const next = {
        business: result.business,
        jobId: job.jobId,
        title: result.jobTitle || job.title,
        address: result.address || job.address,
        departedAt: result.departedAt,
      };
      saveVisit(next);
      setDone({ job, result });
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "The server did not reply. Try again.");
    } finally {
      setPendingId("");
    }
  }

  if (done) {
    const address = done.result.address || done.job.address;
    const title = done.result.jobTitle || done.job.title;
    return (
      <KeepPage>
      <Screen title="Depart" back={<BackLink href="/jobs" />}>
        <div>
          <p className="text-sm">{done.result.brand || businessLabel(done.result.business)}</p>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-lg">{address}</p>
          {done.result.visit ? <p className="mt-2 text-base">Visit {done.result.visit}</p> : null}
        </div>
        <SmsPicker
          jobId={done.job.jobId}
          contacts={done.result.contacts}
          topSms={done.result.sms}
          address={address}
          jobTitle={title}
          allowManual={done.result.contacts.length === 0}
        />
        {done.result.sms ? null : <Alert>The server did not return a message. Navigation still works.</Alert>}
        {address ? (
          <JobsLink href={mapsHref(address)} variant="outline">
            Google Maps
          </JobsLink>
        ) : null}
        <JobsButton type="button" variant="text" onClick={() => setDone(null)}>
          Choose another job
        </JobsButton>
      </Screen>
      </KeepPage>
    );
  }

  return (
    <KeepPage>
    <Screen title="Depart" back={<BackLink href="/jobs" />}>
      {visit ? <p className="text-base">A visit is still open: {visit.title}. Departing again will switch to this job.</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {jobs === null && !error ? <Spinner label="Loading today's jobs" /> : null}
      {jobs && jobs.length === 0 ? <p className="text-lg">No jobs scheduled today</p> : null}
      <div className="flex flex-col gap-3">
        {jobs?.map((job) => (
          <button
            key={`${job.business}:${job.jobId}`}
            type="button"
            disabled={pendingId !== ""}
            onClick={() => depart(job)}
            className="w-full rounded-2xl border border-black px-4 py-4 text-left disabled:opacity-50"
          >
            <span className="block text-sm">{businessLabel(job.business)}</span>
            <span className="mt-1 block text-lg font-semibold">{job.title}</span>
            <span className="mt-1 block text-base">{job.address}</span>
            {pendingId === job.jobId ? <span className="mt-2 block text-sm">Recording departure</span> : null}
          </button>
        ))}
      </div>
      {error && jobs === null ? (
        <JobsButton
          type="button"
          variant="outline"
          onClick={() => {
            setError("");
            setJobs(null);
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </JobsButton>
      ) : null}
    </Screen>
    </KeepPage>
  );
}
