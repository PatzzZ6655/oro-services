"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs, postJobsForm } from "@/components/jobs/api";
import { compressFiles } from "@/components/jobs/resize-image";
import { BackLink, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import {
  clearStoredNewJobDraft,
  clearStoredNewJobIntro,
  emptyNewJobDraft,
  newJobDraftDirty,
  parseNewJobDraft,
  parseNewJobIntroHold,
  parseReadSnapshot,
  readNewJobSnapshot,
  writeStoredNewJobDraft,
  writeStoredNewJobIntro,
  type NewJobDraft,
  type NewJobReadSnapshot,
} from "@/lib/jobs-app/new-job-draft";
import {
  blankTenants,
  maxJobTenants,
  newJobNeedDetail,
  newJobTextCoversScreenshots,
  newJobTextLimits,
  preferTyped,
  readNewJobText,
  screenshotReadFallback,
  tenantLimits,
  tenantsFromRead,
  tenantsFromTyped,
  type JobTenant,
} from "@/lib/jobs-app/new-job-text";
import { introBody, introStatusText, introSubject, introTenantLine, introTestNote, type IntroTenant } from "@/lib/jobs-app/intro-email";
import { voucherNote } from "@/lib/jobs-app/voucher";
import { keptCount, NEW_JOB_MAX_EDGE, NEW_JOB_MAX_IMAGES, NEW_JOB_QUALITIES } from "@/lib/jobs-app/photos";
import { businessLabel, isBusiness, type Business, type NewJobResult } from "@/lib/jobs-app/types";

function created(value: boolean | null): string {
  if (value === true) return "New";
  if (value === false) return "Already there";
  return "—";
}

function VoucherLine({
  status,
  code,
  value,
  redeemedDate,
}: {
  status: NewJobResult["voucherStatus"];
  code: string;
  value: string;
  redeemedDate: string;
}) {
  const note = voucherNote(status, code, value, redeemedDate);
  if (!note) return null;
  if (note.tone === "warn") {
    return (
      <p role="alert" className="rounded-2xl border border-black px-4 py-3 text-base">
        {note.text}
      </p>
    );
  }
  return <p className="text-base">{note.text}</p>;
}

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="mt-1 block text-lg">{value}</span>
    </p>
  );
}

function ignoreDraftStore() {
  return () => {};
}

const chooseCompany = "Choose Emoro Building or Emporo Plumbing first";
const screenshotsClearedOnCheck = "The screenshots were cleared when the page reloaded. The recognised details are still here.";
const screenshotsClearedOnCapture = "The screenshots were cleared when the page reloaded. Add them again if you still want them on the job.";

function NewJobShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverscroll: html.style.overscrollBehaviorY,
      bodyOverscroll: body.style.overscrollBehaviorY,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y <= startY + 8) return;
      let node = event.target instanceof Element ? event.target : null;
      while (node) {
        if (node instanceof HTMLElement && node.scrollTop > 0) return;
        node = node.parentElement;
      }
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      html.style.overscrollBehaviorY = previous.htmlOverscroll;
      body.style.overscrollBehaviorY = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div data-new-job-scroll className="fixed inset-0 overflow-y-auto overscroll-y-none bg-white text-black">
      {children}
    </div>
  );
}

function ActionNotice({ message, busyLabel }: { message: string; busyLabel: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!message && !busyLabel) return;
    ref.current?.scrollIntoView({ block: "center" });
  }, [message, busyLabel]);
  if (!message && !busyLabel) return null;
  return (
    <p ref={ref} role={message && !busyLabel ? "alert" : "status"} className="rounded-2xl border border-black px-4 py-3 text-base">
      {busyLabel || message}
    </p>
  );
}

function typedDraft(values: {
  tenantName: string;
  phone: string;
  address: string;
  description: string;
  workOrderNumber: string;
  notes: string;
}) {
  const draft = new FormData();
  draft.set("tenantName", values.tenantName);
  draft.set("phone", values.phone);
  draft.set("address", values.address);
  draft.set("description", values.description);
  draft.set("workOrderNumber", values.workOrderNumber);
  draft.set("notes", values.notes);
  return readNewJobText(draft);
}

export function NewJobScreen() {
  const [step, setStep] = useState<"capture" | "check">("capture");
  const [business, setBusiness] = useState<Business | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [readyFiles, setReadyFiles] = useState<File[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [phone, setPhone] = useState("");
  const [tenants, setTenants] = useState<JobTenant[]>(blankTenants());
  const [address, setAddress] = useState("");
  const [pmAgency, setPmAgency] = useState("");
  const [description, setDescription] = useState("");
  const [workOrderNumber, setWorkOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [voucher, setVoucher] = useState("");
  const [readSnapshot, setReadSnapshot] = useState<NewJobReadSnapshot | null>(null);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [screenshotsCleared, setScreenshotsCleared] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"read" | "create" | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NewJobResult | null>(null);
  const [introPhase, setIntroPhase] = useState<"preview" | "status" | "done">("preview");
  const [introStatus, setIntroStatus] = useState<{ status: string; message: string; error: string } | null>(null);
  const [introBusy, setIntroBusy] = useState<"send" | "skip" | null>(null);
  const router = useRouter();
  const draftCache = useRef<string | null>(null);
  const stored = useSyncExternalStore(
    ignoreDraftStore,
    () => {
      if (draftCache.current === null) draftCache.current = readNewJobSnapshot();
      return draftCache.current;
    },
    () => "",
  );
  if (!hydrated && stored !== "") {
    setHydrated(true);
    if (stored.startsWith("intro\n")) {
      const held = parseNewJobIntroHold(stored.slice(6));
      if (held) {
        setBusiness(held.business);
        setTenants(held.tenants);
        setResult(held.result);
        setIntroPhase("preview");
      }
    } else if (stored.startsWith("draft\n")) {
      const draft = parseNewJobDraft(stored.slice(6));
      if (draft) {
        setStep(draft.step);
        setBusiness(draft.business || null);
        setTenantName(draft.tenantName);
        setPhone(draft.phone);
        setTenants(draft.tenants);
        setAddress(draft.address);
        setPmAgency(draft.pmAgency);
        setDescription(draft.description);
        setNotes(draft.notes);
        setWorkOrderNumber(draft.workOrderNumber);
        setVoucher(draft.voucher);
        setReadSnapshot(draft.read);
        setScreenshotCount(draft.screenshotCount);
        setScreenshotsCleared(draft.screenshotCount > 0);
      }
    }
  }

  const currentDraft = useCallback((): NewJobDraft => {
    return {
      ...emptyNewJobDraft(),
      step,
      business: business ?? "",
      tenantName,
      phone,
      tenants,
      address,
      pmAgency,
      description,
      notes,
      workOrderNumber,
      voucher,
      read: readSnapshot,
      screenshotCount,
    };
  }, [step, business, tenantName, phone, tenants, address, pmAgency, description, notes, workOrderNumber, voucher, readSnapshot, screenshotCount]);

  useEffect(() => {
    if (!hydrated || result) return;
    writeStoredNewJobDraft(currentDraft());
  }, [hydrated, result, currentDraft]);

  useEffect(() => {
    if (!hydrated || result) return;
    const dirty = newJobDraftDirty(currentDraft()) || files.length > 0;
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hydrated, result, currentDraft, files.length]);

  async function continueToCheck() {
    if (pending.current) return;
    if (!isBusiness(business)) {
      setError(chooseCompany);
      return;
    }
    if (files.length === 0) {
      setReadyFiles([]);
      setTenants(tenantsFromTyped(tenantName, phone));
      setError("");
      setStep("check");
      return;
    }
    pending.current = true;
    setError("");
    setBusy("read");
    let compressed: File[] = [];
    try {
      compressed = await compressFiles(files.slice(0, NEW_JOB_MAX_IMAGES), NEW_JOB_MAX_EDGE, NEW_JOB_QUALITIES);
      const count = keptCount(compressed.map((file) => file.size));
      if (count === 0 || count < compressed.length) {
        setError("The photos are too large. Choose fewer.");
        return;
      }
      const form = new FormData();
      form.set("business", business);
      const code = voucher.trim().toUpperCase().replace(/\s+/g, "");
      if (code) form.set("voucher", code);
      for (const file of compressed) form.append("images", file);
      const read = await postJobsForm<{
        tenantName: string;
        phone: string;
        email: string;
        address: string;
        description: string;
        workOrderNumber: string;
        voucher: string;
        tenant2Name: string;
        phone2: string;
        email2: string;
        pmName: string;
        pmAgency: string;
        pmEmail: string;
        pmPhone: string;
        tenants?: JobTenant[];
      }>("/jobs/api/new/read", form);
      const recognised = parseReadSnapshot(read);
      setReadSnapshot(recognised);
      setTenants(tenantsFromRead(read, { name: tenantName, phone }));
      setAddress(preferTyped(address, read.address));
      setPmAgency(preferTyped(pmAgency, read.pmAgency));
      setDescription(preferTyped(description, read.description));
      setWorkOrderNumber(preferTyped(workOrderNumber, read.workOrderNumber));
      setVoucher(preferTyped(voucher, read.voucher.toUpperCase()));
      setReadyFiles(compressed);
      setScreenshotCount(compressed.length);
      setScreenshotsCleared(false);
      setStep("check");
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      if (reason instanceof JobsClientError && reason.code === "unreadable") {
        setReadyFiles(compressed);
        setTenants(tenantsFromTyped(tenantName, phone));
        setError(screenshotReadFallback);
        setStep("check");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "This screenshot could not be compressed. Use a JPEG.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function submit() {
    if (pending.current) return;
    if (!isBusiness(business)) {
      setError(chooseCompany);
      return;
    }
    const typed = typedDraft({
      tenantName: tenants.find((row) => row.name.trim())?.name ?? "",
      phone: "",
      address,
      description,
      workOrderNumber,
      notes,
    });
    if (readyFiles.length === 0 && !newJobTextCoversScreenshots(typed)) {
      setError(newJobNeedDetail);
      return;
    }
    pending.current = true;
    setError("");
    setBusy("create");
    try {
      const form = new FormData();
      form.set("business", business);
      form.set("tenants", JSON.stringify(tenants));
      for (const [key, value] of Object.entries(typed)) {
        if (key === "tenantName" || key === "phone" || !value) continue;
        form.set(key, value);
      }
      const code = voucher.trim().toUpperCase().replace(/\s+/g, "");
      if (code) form.set("voucher", code);
      for (const file of readyFiles) form.append("images", file);
      const created = await postJobsForm<NewJobResult>("/jobs/api/new", form);
      clearStoredNewJobDraft();
      if (isBusiness(business)) writeStoredNewJobIntro({ business, tenants, result: created });
      setResult(created);
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "The job could not be created.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function finishIntro(action: "send" | "skip") {
    if (!result || !isBusiness(business) || pending.current) return;
    pending.current = true;
    setIntroBusy(action);
    setError("");
    const people: IntroTenant[] = (result.tenants.length > 0 ? result.tenants : tenants).map((row) => ({
      name: row.name,
      email: row.email,
    }));
    try {
      const outcome = await postJobs<{ status: string; message: string; error: string }>("/jobs/api/new/intro", {
        action,
        jobId: result.jobId,
        business,
        desc: result.desc,
        address: result.address,
        pmAgency: result.pmAgency,
        tenants: people,
      });
      clearStoredNewJobDraft();
      clearStoredNewJobIntro();
      setIntroStatus({ status: outcome.status, message: outcome.message, error: "" });
      setIntroPhase("status");
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      const message = reason instanceof JobsClientError ? reason.message : "The intro email was not sent.";
      const code = reason instanceof JobsClientError ? reason.code : "upstream";
      clearStoredNewJobDraft();
      clearStoredNewJobIntro();
      setIntroStatus({ status: code === "upstream" ? "failed" : code, message, error: code });
      setIntroPhase("status");
    } finally {
      pending.current = false;
      setIntroBusy(null);
    }
  }

  if (!hydrated) {
    return (
      <NewJobShell>
        <Screen title="New job">
          <Spinner label="Opening" />
        </Screen>
      </NewJobShell>
    );
  }

  if (result && isBusiness(business) && introPhase !== "done") {
    const people: IntroTenant[] = (result.tenants.length > 0 ? result.tenants : tenants).map((row) => ({
      name: row.name,
      email: row.email,
    }));
    const preview = {
      business,
      brand: businessLabel(business),
      address: result.address,
      pmAgency: result.pmAgency,
      desc: result.desc,
      tenants: people,
    };
    const named = people.find((row) => row.name.trim())?.name ?? "";
    if (introPhase === "status" && introStatus) {
      return (
        <NewJobShell>
          <Screen title="Intro email" back={<BackLink href="/jobs" />}>
            <p className="text-lg font-semibold">{introStatusText(introStatus.status, introStatus.message)}</p>
            <p className="text-base text-neutral-700">{introTestNote}</p>
            <JobsButton type="button" variant="outline" onClick={() => setIntroPhase("done")}>
              Done
            </JobsButton>
          </Screen>
        </NewJobShell>
      );
    }
    return (
      <NewJobShell>
      <Screen title="Intro email" back={<BackLink href="/jobs" />}>
        <p className="text-base text-neutral-700">{introTestNote}</p>
        <p className="text-lg font-semibold">{introSubject(preview.address, preview.brand)}</p>
        <ul className="space-y-2 text-base">
          {people.map((row, index) => (
            <li key={`${row.email}-${index}`}>{introTenantLine(row)}</li>
          ))}
        </ul>
        <pre className="whitespace-pre-wrap rounded-2xl border border-black p-4 text-base">{introBody(preview, named)}</pre>
        <JobsButton type="button" onClick={() => finishIntro("send")} disabled={introBusy !== null}>
          {introBusy === "send" ? "Sending" : "Send"}
        </JobsButton>
        <JobsButton type="button" variant="outline" onClick={() => finishIntro("skip")} disabled={introBusy !== null}>
          {introBusy === "skip" ? "Skipping" : "Skip"}
        </JobsButton>
      </Screen>
      </NewJobShell>
    );
  }

  if (result) {
    const tenant = [result.tenant1, result.phone1, result.email1].filter(Boolean).join(" ");
    const tenant2 = [result.tenant2, result.phone2].filter(Boolean).join(" ");
    const pm = [result.pmName, result.pmAgency, result.pmEmail, result.pmPhone].filter(Boolean).join(" / ");
    return (
      <NewJobShell>
      <Screen title="New job" back={<BackLink href="/jobs" />}>
        <p className="text-lg font-semibold">Work order created</p>
        <Line label="Title" value={result.jobTitle} />
        <Line label="Company" value={result.brand} />
        <Line label="Address" value={result.address} />
        <Line label="Tenant" value={tenant} />
        <Line label="Second tenant" value={tenant2} />
        <Line label="PM" value={pm} />
        <Line label="PM work order number" value={result.workOrderNumber} />
        <Line label="Problem" value={result.description} />
        <p className="text-base">
          Created: property {created(result.propertyCreated)} · customer {created(result.customerCreated)} · contact {created(result.contact1Created)}
        </p>
        <VoucherLine
          status={result.voucherStatus}
          code={result.voucherCode}
          value={result.voucherValue}
          redeemedDate={result.voucherRedeemedDate}
        />
        {result.jobUrl ? (
          <JobsLink href={result.jobUrl} variant="outline">
            Open in Notion
          </JobsLink>
        ) : null}
      </Screen>
      </NewJobShell>
    );
  }

  if (step === "check" && isBusiness(business)) {
    return (
      <NewJobShell>
      <Screen
        title="Check job"
        back={
          <button type="button" onClick={() => { setError(""); setStep("capture"); }} className="min-h-11 text-base font-semibold underline">
            Back
          </button>
        }
      >
        <div className="contents">
          <p className="text-base text-neutral-700">{businessLabel(business)}</p>
          <p className="text-base text-neutral-700">
            {readyFiles.length > 0
              ? `${readyFiles.length} screenshot${readyFiles.length === 1 ? "" : "s"} will be sent with the job.`
              : screenshotsCleared
                ? screenshotsClearedOnCheck
                : "No screenshot. Check the details, then create the job."}
          </p>
          <TenantList tenants={tenants} setTenants={setTenants} />
          <DetailFields
            showContact={false}
            tenantName={tenantName}
            setTenantName={setTenantName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
            pmAgency={pmAgency}
            setPmAgency={setPmAgency}
            description={description}
            setDescription={setDescription}
            workOrderNumber={workOrderNumber}
            setWorkOrderNumber={setWorkOrderNumber}
            notes={notes}
            setNotes={setNotes}
            voucher={voucher}
            setVoucher={setVoucher}
          />
        </div>
        <ActionNotice message={error} busyLabel={busy === "create" ? "Creating the job" : ""} />
        <JobsButton type="button" onClick={submit} disabled={busy !== null}>
          {busy === "create" ? "Creating" : "Create job"}
        </JobsButton>
      </Screen>
      </NewJobShell>
    );
  }

  return (
    <NewJobShell>
    <Screen title="New job" back={<BackLink href="/jobs" />}>
      <div className="contents">
          <div className="grid grid-cols-1 gap-3">
            {(["emoro", "emporo"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setBusiness(id)}
                className={`min-h-14 rounded-2xl border border-black text-lg font-semibold ${business === id ? "bg-black text-white" : "bg-white text-black"}`}
              >
                {businessLabel(id)}
              </button>
            ))}
          </div>
          <label className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-black text-lg font-semibold">
            Choose screenshots
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                const picked = [...(event.target.files ?? [])].slice(0, NEW_JOB_MAX_IMAGES);
                setFiles(picked);
                setReadyFiles([]);
                setScreenshotCount(picked.length);
                if (picked.length > 0) setScreenshotsCleared(false);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <p className="text-base">{files.length > 0 ? `${files.length} selected, ${NEW_JOB_MAX_IMAGES} at most` : screenshotsCleared ? screenshotsClearedOnCapture : `Up to ${NEW_JOB_MAX_IMAGES} screenshots`}</p>
          <DetailFields
            tenantName={tenantName}
            setTenantName={setTenantName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
            pmAgency={pmAgency}
            setPmAgency={setPmAgency}
            description={description}
            setDescription={setDescription}
            workOrderNumber={workOrderNumber}
            setWorkOrderNumber={setWorkOrderNumber}
            notes={notes}
            setNotes={setNotes}
            voucher={voucher}
            setVoucher={setVoucher}
          />
      </div>
      <ActionNotice message={error} busyLabel={busy === "read" ? "Reading the screenshot, about 10 seconds" : ""} />
      <JobsButton type="button" onClick={continueToCheck} disabled={busy !== null}>
        {busy === "read" ? "Reading" : files.length > 0 ? "Read screenshots" : "Continue"}
      </JobsButton>
    </Screen>
    </NewJobShell>
  );
}

function DetailFields({
  showContact = true,
  tenantName,
  setTenantName,
  phone,
  setPhone,
  address,
  setAddress,
  pmAgency,
  setPmAgency,
  description,
  setDescription,
  workOrderNumber,
  setWorkOrderNumber,
  notes,
  setNotes,
  voucher,
  setVoucher,
}: {
  showContact?: boolean;
  tenantName: string;
  setTenantName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  pmAgency: string;
  setPmAgency: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  workOrderNumber: string;
  setWorkOrderNumber: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  voucher: string;
  setVoucher: (value: string) => void;
}) {
  return (
    <>
      {showContact ? (
        <>
          <label className="flex flex-col gap-2 text-base">
            Tenant / contact name
            <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} maxLength={newJobTextLimits.tenantName} autoComplete="name" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2 text-base">
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={newJobTextLimits.phone} inputMode="tel" autoComplete="tel" className={fieldClass} />
          </label>
        </>
      ) : null}
      <label className="flex flex-col gap-2 text-base">
        Property address
        <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={newJobTextLimits.address} autoComplete="street-address" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        PM agency
        <input value={pmAgency} onChange={(event) => setPmAgency(event.target.value)} maxLength={80} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        Job description
        <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={newJobTextLimits.description} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        PM work order number
        <input value={workOrderNumber} onChange={(event) => setWorkOrderNumber(event.target.value)} maxLength={newJobTextLimits.workOrderNumber} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        Voucher code (optional)
        <input
          value={voucher}
          onChange={(event) => setVoucher(event.target.value.toUpperCase())}
          placeholder="EMB-XXXXXX / EMP-XXXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-2 text-base">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={newJobTextLimits.notes} rows={4} className={`${fieldClass} min-h-32 py-3`} />
      </label>
    </>
  );
}

function TenantList({ tenants, setTenants }: { tenants: JobTenant[]; setTenants: (next: JobTenant[]) => void }) {
  function update(index: number, patch: Partial<JobTenant>) {
    setTenants(tenants.map((row, item) => (item === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    if (tenants.length === 1) {
      setTenants(blankTenants());
      return;
    }
    setTenants(tenants.filter((_, item) => item !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Tenants</h2>
      {tenants.map((row, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-2xl border border-black p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold">Tenant {index + 1}</p>
            <button type="button" onClick={() => remove(index)} className="min-h-11 px-1 text-base font-semibold underline">
              Remove
            </button>
          </div>
          <label className="flex flex-col gap-2 text-base">
            Name
            <input value={row.name} onChange={(event) => update(index, { name: event.target.value })} maxLength={tenantLimits.name} autoComplete="name" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2 text-base">
            Phone
            <input value={row.phone} onChange={(event) => update(index, { phone: event.target.value })} maxLength={tenantLimits.phone} inputMode="tel" autoComplete="tel" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2 text-base">
            Email
            <input value={row.email} onChange={(event) => update(index, { email: event.target.value })} maxLength={tenantLimits.email} inputMode="email" autoComplete="email" className={fieldClass} />
          </label>
        </div>
      ))}
      {tenants.length < maxJobTenants ? (
        <button type="button" onClick={() => setTenants([...tenants, { name: "", phone: "", email: "" }])} className="min-h-14 rounded-2xl border border-black text-lg font-semibold">
          Add tenant
        </button>
      ) : null}
    </div>
  );
}
