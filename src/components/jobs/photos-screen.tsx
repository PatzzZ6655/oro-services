"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs, postJobsForm } from "@/components/jobs/api";
import { ErrorBanner } from "@/components/jobs/field-error";
import { renderCollage } from "@/components/jobs/photo-collage";
import { GhostCamera } from "@/components/jobs/photos-camera";
import { resizeToJpeg } from "@/components/jobs/resize-image";
import { JobsButton, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import {
  areaGroups,
  areaNeedsDetail,
  collageReady,
  issuePlace,
  maxPhotoAngles,
  photoLevels,
  recentCustomAreas,
  rememberChoice,
  resolveArea,
  unshotAngles,
  type PhotoBook,
  type PhotoIssue,
} from "@/lib/jobs-app/photo-book";
import { businessLabel, type Business } from "@/lib/jobs-app/types";

type ListedJob = { business: Business; jobId: string; title: string; address: string; status: string };
type Mode = "before" | "after";
type Step = "mode" | "job" | "level" | "area" | "before" | "after" | "camera" | "collage";

const recentKey = "oro.photos.areas";
const levelKey = "oro.photos.level";

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fileUrl(id: string): string {
  return id ? `/jobs/api/photos/file?id=${encodeURIComponent(id)}` : "";
}

function logoUrl(business: Business): string {
  return business === "emoro" ? "/logos/emoro-building.png" : "/logos/emporo-plumbing.png";
}

async function prepare(file: File): Promise<File> {
  return resizeToJpeg(file, 1600, 0.7, 0);
}

export function PhotosScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("before");
  const [jobs, setJobs] = useState<ListedJob[] | null>(null);
  const [query, setQuery] = useState("");
  const [job, setJob] = useState<ListedJob | null>(null);
  const [level, setLevel] = useState("");
  const [area, setArea] = useState("");
  const [detail, setDetail] = useState("");
  const [detailFor, setDetailFor] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [lastLevel, setLastLevel] = useState("");
  const [book, setBook] = useState<PhotoBook | null>(null);
  const [issueId, setIssueId] = useState("");
  const [angleId, setAngleId] = useState("");
  const [note, setNote] = useState("");
  const [swap, setSwap] = useState("");
  const [collageUrl, setCollageUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    postJobs<{ jobs: ListedJob[] }>("/jobs/api/photos", { action: "jobs" })
      .then((data) => setJobs(data.jobs))
      .catch((reason: unknown) => {
        if (reason instanceof JobsClientError && reason.status === 401) {
          router.push("/jobs/login");
          return;
        }
        setError(reason instanceof JobsClientError ? reason.message : "The job list could not be loaded.");
        setJobs([]);
      });
  }, [router]);

  function fail(reason: unknown) {
    setError(reason instanceof JobsClientError ? reason.message : reason instanceof Error ? reason.message : "The server did not reply. Try again.");
  }

  async function openJob(next: ListedJob) {
    setBusy("Opening");
    setError("");
    try {
      const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
        action: "load",
        business: next.business,
        jobId: next.jobId,
        title: next.title,
      });
      const stored = localStorage.getItem(`${recentKey}.${next.business}`);
      setRecent(stored ? (JSON.parse(stored) as string[]) : []);
      setLastLevel(localStorage.getItem(levelKey) ?? "");
      setJob(next);
      setBook(data.book);
      setStep("level");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  function chooseLevel(next: string) {
    if (next !== "All levels") {
      setLastLevel(next);
      localStorage.setItem(levelKey, next);
    }
    setLevel(next);
    setDetail("");
    setDetailFor("");
    setIssueId("");
    setSwap("");
    setStep("area");
  }

  function chooseArea(next: string) {
    if (!job) return;
    if (areaNeedsDetail(next)) {
      setDetailFor(next);
      setDetail(next === "Other Bedrooms" ? "Bedroom 2" : "");
      return;
    }
    const resolved = resolveArea(next, "");
    finishArea(typeof resolved === "string" ? resolved : next);
  }

  function finishArea(resolved: string) {
    if (!job) return;
    if (resolved !== "All areas") {
      const remembered = rememberChoice(recent, resolved);
      setRecent(remembered);
      localStorage.setItem(`${recentKey}.${job.business}`, JSON.stringify(remembered));
    }
    setArea(resolved);
    setDetailFor("");
    setIssueId("");
    setSwap("");
    setError("");
    setStep(mode === "before" ? "before" : "after");
  }

  async function createIssue() {
    if (!job) return;
    setBusy("Saving");
    setError("");
    try {
      const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
        action: "issue",
        business: job.business,
        jobId: job.jobId,
        title: job.title,
        level,
        area,
        note,
        id: newId(),
      });
      setBook(data.book);
      setIssueId(data.book.issues[data.book.issues.length - 1]?.id ?? "");
      setNote("");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  async function upload(file: File, side: "before" | "after" | "collage", targetIssue: string, targetAngle: string) {
    if (!job) return;
    const prepared = await prepare(file);
    const form = new FormData();
    form.set("business", job.business);
    form.set("jobId", job.jobId);
    form.set("title", job.title);
    form.set("issueId", targetIssue);
    form.set("angleId", targetAngle);
    form.set("side", side);
    form.set("file", prepared);
    const data = await postJobsForm<{ book: PhotoBook }>("/jobs/api/photos/upload", form);
    setBook(data.book);
  }

  async function addBefore(file: File) {
    if (!issueId) return;
    setBusy("Saving");
    setError("");
    try {
      await upload(file, "before", issueId, newId());
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  async function addAfter(file: File) {
    if (!issueId || !angleId) return;
    setBusy("Saving");
    setError("");
    try {
      await upload(file, "after", issueId, angleId);
      setStep("after");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  async function swapAfter(targetIssue: string, leftId: string, rightId: string) {
    if (!job || !book) return;
    const issue = book.issues.find((item) => item.id === targetIssue);
    if (!issue) return;
    const left = issue.angles.find((angle) => angle.id === leftId);
    const right = issue.angles.find((angle) => angle.id === rightId);
    if (!left || !right) return;
    const next: PhotoBook = {
      ...book,
      issues: book.issues.map((item) => {
        if (item.id !== issue.id) return item;
        return {
          ...item,
          angles: item.angles.map((angle) => {
            if (angle.id === leftId) return { ...angle, afterId: right.afterId };
            if (angle.id === rightId) return { ...angle, afterId: left.afterId };
            return angle;
          }),
        };
      }),
    };
    setBusy("Saving");
    setError("");
    try {
      const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
        action: "save",
        business: job.business,
        jobId: job.jobId,
        title: job.title,
        book: next,
      });
      setBook(data.book);
      setSwap("");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  async function makeCollage(issue: PhotoIssue) {
    if (!job) return;
    setBusy("Making the collage");
    setError("");
    try {
      const rows = [];
      for (const angle of issue.angles) {
        const before = await fetch(fileUrl(angle.beforeId));
        const after = await fetch(fileUrl(angle.afterId));
        if (!before.ok || !after.ok) throw new Error("A photo could not be opened.");
        rows.push({ before: await before.blob(), after: await after.blob() });
      }
      const blob = await renderCollage(rows, logoUrl(job.business));
      const file = new File([blob], "before-after.jpg", { type: "image/jpeg" });
      await upload(file, "collage", issue.id, issue.id);
      const url = URL.createObjectURL(blob);
      setCollageUrl(url);
      setIssueId(issue.id);
      setStep("collage");
      const share = navigator.share?.bind(navigator);
      const canShare = navigator.canShare?.({ files: [file] }) ?? false;
      if (share && canShare) {
        try {
          await share({ files: [file], title: "Before and after" });
        } catch {
          // Pat can still use Download if the share sheet is dismissed.
        }
      }
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  const current = book?.issues.find((item) => item.id === issueId) ?? null;
  const visible = book?.issues.filter((item) => (level === "All levels" || item.level === level) && (area === "All areas" || item.area === area)) ?? [];
  const filtered = (jobs ?? []).filter((item) => {
    const haystack = `${item.title} ${item.address}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (jobs === null && !error) return <Screen title="Photos"><Spinner label="Opening" /></Screen>;

  return (
    <Screen title="Photos" back={<a href="/jobs" className="min-h-11 text-base font-semibold underline">Jobs</a>}>
      {job ? <p className="text-sm">{businessLabel(job.business)} · {job.address || job.title}</p> : null}
      <ErrorBanner message={error} />
      {busy ? <p className="text-base">{busy}</p> : null}
      {step === "mode" ? (
        <div className="flex flex-col gap-3">
          <JobsButton type="button" onClick={() => { setMode("before"); setStep("job"); }}>Before</JobsButton>
          <JobsButton type="button" onClick={() => { setMode("after"); setStep("job"); }}>After</JobsButton>
        </div>
      ) : null}
      {step === "job" ? (
        <div className="flex flex-col gap-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" className={fieldClass} />
          <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {filtered.map((item) => (
              <li key={`${item.business}:${item.jobId}`}>
                <button type="button" onClick={() => void openJob(item)} className="min-h-16 w-full rounded-2xl border border-black px-4 py-3 text-left">
                  <span className="block text-lg font-semibold">{item.address || item.title}</span>
                  <span className="block text-sm">{item.title} · {item.status}</span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? <p className="text-base">No matching job.</p> : null}
        </div>
      ) : null}
      {step === "level" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Level</h2>
          {mode === "after" ? <JobsButton type="button" variant="outline" onClick={() => chooseLevel("All levels")}>All levels</JobsButton> : null}
          {photoLevels.map((item) => (
            <JobsButton key={item} type="button" variant={lastLevel === item ? "solid" : "outline"} onClick={() => chooseLevel(item)}>
              {lastLevel === item ? `${item} · last used` : item}
            </JobsButton>
          ))}
          <JobsButton type="button" variant="text" onClick={() => setStep("job")}>Back</JobsButton>
        </div>
      ) : null}
      {step === "area" && job ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Area{level && level !== "All levels" ? ` · ${level}` : ""}</h2>
          {mode === "after" ? <JobsButton type="button" variant="outline" onClick={() => finishArea("All areas")}>All areas</JobsButton> : null}
          {recentCustomAreas(recent).map((item) => (
            <JobsButton key={item} type="button" onClick={() => chooseArea(item)}>{item} · recent</JobsButton>
          ))}
          {areaGroups(level).map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">{group.title}</h3>
              {group.areas.map((item) => (
                <JobsButton key={item} type="button" variant={recent.includes(item) ? "solid" : "outline"} onClick={() => chooseArea(item)}>
                  {recent.includes(item) ? `${item} · recent` : item}
                </JobsButton>
              ))}
            </section>
          ))}
          <JobsButton type="button" variant="outline" onClick={() => chooseArea("Other")}>Other…</JobsButton>
          {detailFor ? (
            <>
              <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={detailFor === "Other Bedrooms" ? "Bedroom 2" : "Name this area"} className={fieldClass} />
              <JobsButton type="button" onClick={() => {
                const resolved = resolveArea(detailFor, detail);
                if (typeof resolved !== "string") {
                  setError(resolved.error);
                  return;
                }
                finishArea(resolved);
              }}>Use {detailFor === "Other Bedrooms" ? "this bedroom" : "this area"}</JobsButton>
            </>
          ) : null}
          <JobsButton type="button" variant="text" onClick={() => setStep("level")}>Back</JobsButton>
        </div>
      ) : null}
      {step === "before" && book ? (
        <BeforeStep
          issues={book.issues.filter((item) => item.level === level && item.area === area)}
          current={current}
          note={note}
          busy={busy}
          onNote={setNote}
          onCreate={() => void createIssue()}
          onSelect={setIssueId}
          onPhoto={(file) => void addBefore(file)}
          onBack={() => setStep("area")}
        />
      ) : null}
      {step === "after" && book ? (
        <AfterStep
          issues={visible}
          swap={swap}
          busy={busy}
          onShoot={(nextIssue, nextAngle) => { setIssueId(nextIssue); setAngleId(nextAngle); setStep("camera"); }}
          onSwap={(nextIssue, nextAngle) => {
            if (issueId !== nextIssue || !swap || swap === nextAngle) {
              setIssueId(nextIssue);
              setSwap(swap === nextAngle && issueId === nextIssue ? "" : nextAngle);
              return;
            }
            void swapAfter(nextIssue, swap, nextAngle);
          }}
          onCollage={(issue) => void makeCollage(issue)}
          onBack={() => setStep("area")}
        />
      ) : null}
      {step === "camera" && current ? (
        <GhostCamera beforeUrl={fileUrl(current.angles.find((angle) => angle.id === angleId)?.beforeId ?? "")} onCapture={(file) => void addAfter(file)} onClose={() => setStep("after")} />
      ) : null}
      {step === "collage" && collageUrl ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={collageUrl} alt="Before and after collage" className="w-full rounded-2xl border border-black" />
          <a href={collageUrl} download="before-after.jpg" className="flex min-h-14 items-center justify-center rounded-2xl border border-black text-lg font-semibold">Download</a>
          <JobsButton type="button" variant="outline" onClick={() => setStep("after")}>Back to issues</JobsButton>
        </div>
      ) : null}
    </Screen>
  );
}

function BeforeStep({
  issues,
  current,
  note,
  busy,
  onNote,
  onCreate,
  onSelect,
  onPhoto,
  onBack,
}: {
  issues: PhotoIssue[];
  current: PhotoIssue | null;
  note: string;
  busy: string;
  onNote: (value: string) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onPhoto: (file: File) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button type="button" onClick={() => onSelect(issue.id)} className="min-h-14 w-full rounded-2xl border border-black px-4 py-2 text-left">
              <span className="block text-sm font-semibold">{issuePlace(issue)}</span>
              <span className="block text-lg">{issue.note}</span>
            </button>
          </li>
        ))}
      </ul>
      <input value={note} onChange={(event) => onNote(event.target.value)} placeholder="Short note for this issue" className={fieldClass} />
      <JobsButton type="button" onClick={onCreate} disabled={Boolean(busy)}>Add issue</JobsButton>
      {current ? (
        <>
          <p className="text-sm font-semibold">{issuePlace(current)}</p>
          <p className="text-lg font-semibold">{current.note}</p>
          <div className="grid grid-cols-2 gap-2">
            {current.angles.map((angle, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={angle.id} src={fileUrl(angle.beforeId)} alt={`Angle ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
          <label className={`flex min-h-14 items-center justify-center rounded-2xl border border-black text-lg font-semibold ${current.angles.length >= maxPhotoAngles || busy ? "opacity-40" : ""}`}>
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={current.angles.length >= maxPhotoAngles || Boolean(busy)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) onPhoto(file);
              }}
            />
          </label>
          <p className="text-base">{current.angles.length} of {maxPhotoAngles} angles</p>
        </>
      ) : null}
      <JobsButton type="button" variant="outline" onClick={onBack}>Back</JobsButton>
    </div>
  );
}

function AfterStep({
  issues,
  swap,
  busy,
  onShoot,
  onSwap,
  onCollage,
  onBack,
}: {
  issues: PhotoIssue[];
  swap: string;
  busy: string;
  onShoot: (issueId: string, angleId: string) => void;
  onSwap: (issueId: string, angleId: string) => void;
  onCollage: (issue: PhotoIssue) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {swap ? <p className="text-base">Tap another after photo to swap.</p> : null}
      {issues.length === 0 ? <p className="text-base">No before photos in this area yet.</p> : null}
      {issues.map((issue) => (
        <section key={issue.id} className="flex flex-col gap-2 rounded-2xl border border-black p-3">
          <h2 className="text-lg font-semibold">{issuePlace(issue)}</h2>
          <p className="text-base">{issue.note}</p>
          <div className="grid grid-cols-2 gap-2">
            {issue.angles.map((angle, index) => {
              const missing = unshotAngles(issue).some((item) => item.id === angle.id);
              return (
                <div key={angle.id} className={missing ? "rounded-xl border-2 border-red-600 p-1" : ""}>
                  <button type="button" onClick={() => onShoot(issue.id, angle.id)} className="block w-full text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(angle.beforeId)} alt={`Before angle ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  </button>
                  {angle.afterId ? (
                    <button type="button" onClick={() => onSwap(issue.id, angle.id)} className={`mt-1 block w-full ${swap === angle.id ? "rounded-lg ring-2 ring-black" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(angle.afterId)} alt={`After angle ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                    </button>
                  ) : (
                    <p className="mt-1 text-sm text-red-800">Needs an after photo</p>
                  )}
                </div>
              );
            })}
          </div>
          <JobsButton type="button" onClick={() => onCollage(issue)} disabled={!collageReady(issue) || Boolean(busy)}>Make collage</JobsButton>
        </section>
      ))}
      <JobsButton type="button" variant="outline" onClick={onBack}>Back</JobsButton>
    </div>
  );
}
