"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs, postJobsForm } from "@/components/jobs/api";
import { ErrorBanner } from "@/components/jobs/field-error";
import { KeepPage } from "@/components/jobs/keep-page";
import { renderCollage } from "@/components/jobs/photo-collage";
import { GhostCamera } from "@/components/jobs/photos-camera";
import { resizeToJpeg } from "@/components/jobs/resize-image";
import { JobsButton, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import {
  areaGroups,
  areaNeedsDetail,
  collageReady,
  completePairs,
  initialAreaSection,
  issuePlace,
  maxPhotoAngles,
  photoLevels,
  photoTakenStamp,
  recentCustomAreas,
  rememberChoice,
  resolveArea,
  type PhotoBook,
  type PhotoIssue,
} from "@/lib/jobs-app/photo-book";
import { businessLabel, type Business } from "@/lib/jobs-app/types";

type ListedJob = { business: Business; jobId: string; title: string; address: string; status: string };
type Mode = "before" | "after";
type Step = "mode" | "job" | "level" | "area" | "before" | "after" | "camera" | "collage";

const recentKey = "oro.photos.areas";
const levelKey = "oro.photos.level";
const progressKey = "oro.photos.progress";

type AreaSection = "Interior" | "Exterior" | "Other" | "";

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

async function takenStamp(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, 256_000).arrayBuffer());
  return photoTakenStamp(bytes, file.lastModified);
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
  const [swap, setSwap] = useState("");
  const [collageUrl, setCollageUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState<AreaSection>("");
  const restored = useRef(false);

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

  useEffect(() => {
    if (!job) return;
    const savedStep = step === "camera" || step === "collage" ? "after" : step;
    localStorage.setItem(progressKey, JSON.stringify({ mode, step: savedStep, job, level, area, issueId }));
  }, [job, mode, step, level, area, issueId]);

  useEffect(() => {
    if (!jobs || restored.current) return;
    restored.current = true;
    const raw = localStorage.getItem(progressKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { mode?: Mode; step?: Step; job?: ListedJob; level?: string; area?: string; issueId?: string };
      const match = jobs.find((item) => item.jobId === saved.job?.jobId && item.business === saved.job?.business);
      if (!match || !saved.step || saved.step === "mode" || saved.step === "job") return;
      void resume(match, saved.mode === "after" ? "after" : "before", saved.step, saved.level ?? "", saved.area ?? "", saved.issueId ?? "");
    } catch {
      localStorage.removeItem(progressKey);
    }
  }, [jobs]);

  function fail(reason: unknown) {
    setError(reason instanceof JobsClientError ? reason.message : reason instanceof Error ? reason.message : "The server did not reply. Try again.");
  }

  async function resume(next: ListedJob, nextMode: Mode, nextStep: Step, nextLevel: string, nextArea: string, nextIssue: string) {
    setBusy("Opening");
    setError("");
    try {
      const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
        action: "load",
        business: next.business,
        jobId: next.jobId,
        title: next.title,
      });
      setJob(next);
      setBook(data.book);
      setMode(nextMode);
      setLevel(nextLevel);
      setArea(nextArea);
      setIssueId(nextIssue);
      setStep(nextStep === "camera" || nextStep === "collage" ? "after" : nextStep);
      setOpenSection(initialAreaSection(nextLevel));
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
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
    setOpenSection(initialAreaSection(next));
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
    form.set("taken", await takenStamp(file));
    form.set("file", prepared);
    const data = await postJobsForm<{ book: PhotoBook }>("/jobs/api/photos/upload", form);
    setBook(data.book);
    return data.book;
  }

  async function ensureIssue(): Promise<string> {
    if (issueId) return issueId;
    if (!job) throw new Error("Choose a job.");
    const id = newId();
    const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
      action: "issue",
      business: job.business,
      jobId: job.jobId,
      title: job.title,
      level,
      area,
      note: "",
      id,
    });
    setBook(data.book);
    setIssueId(id);
    return id;
  }

  async function saveNote(id: string, text: string) {
    if (!job || !book) return;
    const next: PhotoBook = {
      ...book,
      issues: book.issues.map((item) => (item.id === id ? { ...item, note: text.replace(/\s+/g, " ").trim().slice(0, 140) } : item)),
    };
    const data = await postJobs<{ book: PhotoBook }>("/jobs/api/photos", {
      action: "save",
      business: job.business,
      jobId: job.jobId,
      title: job.title,
      book: next,
    });
    setBook(data.book);
  }

  async function addBefore(file: File, existingAngle = "") {
    setBusy("Saving");
    setError("");
    try {
      const id = await ensureIssue();
      const angle = existingAngle || newId();
      const previous = book?.issues.find((item) => item.id === id)?.angles.find((item) => item.id === angle);
      const next = await upload(file, "before", id, angle);
      const issue = next?.issues.find((item) => item.id === id);
      if (previous?.beforeId && issue && collageReady(issue)) await makeCollage(issue);
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy("");
    }
  }

  async function saveShot(nextIssue: string, nextAngle: string, side: "before" | "after", file: File) {
    setIssueId(nextIssue);
    setBusy("Saving");
    setError("");
    try {
      const previous = book?.issues.find((item) => item.id === nextIssue)?.angles.find((item) => item.id === nextAngle);
      const replaced = side === "before" ? Boolean(previous?.beforeId) : Boolean(previous?.afterId);
      const next = await upload(file, side, nextIssue, nextAngle || newId());
      const issue = next?.issues.find((item) => item.id === nextIssue);
      if (replaced && issue && collageReady(issue)) await makeCollage(issue);
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
      for (const angle of completePairs(issue)) {
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

  if (jobs === null && !error) return <KeepPage><Screen title="Photos"><Spinner label="Opening" /></Screen></KeepPage>;

  return (
    <KeepPage>
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
          {areaGroups(level).map((group) => (
            <AreaFold key={group.title} title={group.title} open={openSection === group.title} onToggle={() => setOpenSection(openSection === group.title ? "" : group.title)}>
              {group.areas.map((item) => (
                <JobsButton key={item} type="button" variant={recent.includes(item) ? "solid" : "outline"} onClick={() => chooseArea(item)}>
                  {recent.includes(item) ? `${item} · recent` : item}
                </JobsButton>
              ))}
            </AreaFold>
          ))}
          <AreaFold title="Other" open={openSection === "Other"} onToggle={() => setOpenSection(openSection === "Other" ? "" : "Other")}>
            {recentCustomAreas(recent).map((item) => (
              <JobsButton key={item} type="button" onClick={() => chooseArea(item)}>{item} · recent</JobsButton>
            ))}
            <JobsButton type="button" variant="outline" onClick={() => chooseArea("Other")}>Other…</JobsButton>
          </AreaFold>
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
          busy={busy}
          onSelect={(id) => { setIssueId(id); setStep("after"); }}
          onPhoto={(file, angleId) => void addBefore(file, angleId)}
          onDone={() => setStep("after")}
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
          onPhoto={(nextIssue, nextAngle, side, file) => void saveShot(nextIssue, nextAngle, side, file)}
          onNote={(id, text) => void saveNote(id, text)}
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
          <JobsButton type="button" onClick={() => { setIssueId(""); setArea(""); setDetailFor(""); setMode("before"); setOpenSection(initialAreaSection(level)); setStep("area"); }}>Next issue</JobsButton>
          <JobsButton type="button" variant="outline" onClick={() => setStep("after")}>Back to issues</JobsButton>
          <a href="/jobs" className="flex min-h-14 items-center justify-center text-lg font-semibold underline">Back to jobs</a>
        </div>
      ) : null}
    </Screen>
    </KeepPage>
  );
}

function AreaFold({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-14 w-full items-center justify-between px-4 text-left text-lg font-semibold">
        {title}
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="flex flex-col gap-3 px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function BeforeStep({
  issues,
  current,
  busy,
  onSelect,
  onPhoto,
  onDone,
  onBack,
}: {
  issues: PhotoIssue[];
  current: PhotoIssue | null;
  busy: string;
  onSelect: (id: string) => void;
  onPhoto: (file: File, angleId?: string) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const count = current?.angles.length ?? 0;
  const full = count >= maxPhotoAngles;
  return (
    <div className="flex flex-col gap-3">
      {issues.length > 0 ? <p className="text-base">Open an issue to add a missing photo, or take a new one.</p> : null}
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button type="button" onClick={() => onSelect(issue.id)} className="min-h-14 w-full rounded-2xl border border-black px-4 py-2 text-left">
              <span className="block text-sm font-semibold">{issuePlace(issue)}</span>
              <span className="block text-base">{issue.angles.length} photo{issue.angles.length === 1 ? "" : "s"}</span>
            </button>
          </li>
        ))}
      </ul>
      {current ? <p className="text-sm font-semibold">{issuePlace(current)}</p> : null}
      {current && count > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {current.angles.map((angle, index) => (
            angle.beforeId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={angle.id} src={fileUrl(angle.beforeId)} alt={`Angle ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
            ) : (
              <p key={angle.id} className="flex aspect-square items-center justify-center rounded-xl border-2 border-red-600 text-sm text-red-800">Before missing</p>
            )
          ))}
        </div>
      ) : null}
      <FilePick label={count > 0 ? "Add another angle" : "Take photo"} library="Choose from library" disabled={full || Boolean(busy)} onFile={(file) => onPhoto(file)} />
      <JobsButton type="button" onClick={onDone} disabled={count < 1 || Boolean(busy)}>Done</JobsButton>
      <p className="text-base">{count === 0 ? "One photo is enough. More angles are optional." : `${count} of ${maxPhotoAngles} angles`}</p>
      <JobsButton type="button" variant="outline" onClick={onBack}>Back</JobsButton>
    </div>
  );
}

function FilePick({ label, library, disabled, camera = true, onFile }: { label: string; library: string; disabled: boolean; camera?: boolean; onFile: (file: File) => void }) {
  return (
    <>
      {camera ? (
        <label className={`flex min-h-14 items-center justify-center rounded-2xl bg-black px-4 text-center text-lg font-semibold text-white ${disabled ? "opacity-40" : ""}`}>
          {label}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) onFile(file);
          }} />
        </label>
      ) : null}
      <label className={`flex min-h-14 items-center justify-center rounded-2xl border border-black px-4 text-lg font-semibold ${disabled ? "opacity-40" : ""}`}>
        {library}
        <input type="file" accept="image/*" className="sr-only" disabled={disabled} onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) onFile(file);
        }} />
      </label>
    </>
  );
}

function AfterStep({
  issues,
  swap,
  busy,
  onShoot,
  onSwap,
  onCollage,
  onPhoto,
  onNote,
  onBack,
}: {
  issues: PhotoIssue[];
  swap: string;
  busy: string;
  onShoot: (issueId: string, angleId: string) => void;
  onSwap: (issueId: string, angleId: string) => void;
  onCollage: (issue: PhotoIssue) => void;
  onPhoto: (issueId: string, angleId: string, side: "before" | "after", file: File) => void;
  onNote: (issueId: string, note: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {swap ? <p className="text-base">Tap another after photo to swap.</p> : null}
      {issues.length === 0 ? <p className="text-base">No photos for this area yet.</p> : null}
      {issues.map((issue) => (
        <section key={issue.id} className="flex flex-col gap-2 rounded-2xl border border-black p-3">
          <h2 className="text-lg font-semibold">{issuePlace(issue)}</h2>
          <label className="text-base">
            Note
            <input defaultValue={issue.note} onBlur={(event) => onNote(issue.id, event.target.value)} className={`${fieldClass} mt-2`} placeholder="Optional note" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {issue.angles.map((angle, index) => (
              <div key={angle.id} className={!angle.beforeId || !angle.afterId ? "rounded-xl border-2 border-red-600 p-1" : ""}>
                {angle.beforeId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(angle.beforeId)} alt={`Before angle ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                ) : <p className="text-sm text-red-800">Before missing</p>}
                <FilePick label={angle.beforeId ? "Replace before" : "Add Before"} library="Choose from library" disabled={Boolean(busy)} onFile={(file) => onPhoto(issue.id, angle.id, "before", file)} />
                {angle.afterId ? (
                  <button type="button" onClick={() => onSwap(issue.id, angle.id)} className={`mt-1 block w-full ${swap === angle.id ? "rounded-lg ring-2 ring-black" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(angle.afterId)} alt={`After angle ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  </button>
                ) : <p className="mt-1 text-sm text-red-800">After missing</p>}
                {!angle.afterId && angle.beforeId ? <JobsButton type="button" variant="outline" onClick={() => onShoot(issue.id, angle.id)}>Add After</JobsButton> : null}
                <FilePick label={angle.afterId ? "Replace after" : "Add After"} library="Choose from library" camera={!angle.beforeId || Boolean(angle.afterId)} disabled={Boolean(busy)} onFile={(file) => onPhoto(issue.id, angle.id, "after", file)} />
              </div>
            ))}
          </div>
          {issue.angles.length < maxPhotoAngles ? (
            <FilePick label="Add another angle" library="Choose from library" disabled={Boolean(busy)} onFile={(file) => onPhoto(issue.id, "", "before", file)} />
          ) : null}
          <JobsButton type="button" onClick={() => onCollage(issue)} disabled={!collageReady(issue) || Boolean(busy)}>{issue.collageId ? "Update collage" : "Make collage"}</JobsButton>
        </section>
      ))}
      <JobsButton type="button" variant="outline" onClick={onBack}>Back</JobsButton>
    </div>
  );
}
