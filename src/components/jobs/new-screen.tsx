"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobs, postJobsForm } from "@/components/jobs/api";
import { KeepPage } from "@/components/jobs/keep-page";
import { PhotoBurst } from "@/components/jobs/photo-burst";
import { SmsPicker } from "@/components/jobs/sms-picker";
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
import { introBody, introCcPayload, introStatusText, introSubject, introTenantLine, type IntroTenant } from "@/lib/jobs-app/intro-email";
import { fillSmsTemplate, smsTemplates } from "@/lib/sms-templates";
import { voucherNote } from "@/lib/jobs-app/voucher";
import { keptCount, NEW_JOB_MAX_EDGE, NEW_JOB_MAX_IMAGES, NEW_JOB_QUALITIES } from "@/lib/jobs-app/photos";
import type { AgencyClient } from "@/lib/jobs-app/client-match";
import { businessLabel, isBusiness, type Business, type Contact, type NewJobResult } from "@/lib/jobs-app/types";

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

function contactingSms(result: NewJobResult, business: Business): string {
  const template = smsTemplates.find((item) => item.id === "first-visit");
  return fillSmsTemplate(template?.english ?? "", {
    name: "",
    pmName: result.pmName,
    brand: businessLabel(business),
    agency: result.pmAgency,
    address: result.address,
    day: "",
    time: "",
    mins: "",
    reason: "",
    issue: "",
  });
}

function contactingContacts(result: NewJobResult): Contact[] {
  const listed = result.tenants
    .filter((row) => row.phone.trim())
    .map((row) => ({ name: row.name, phone: row.phone, sms: "" }));
  if (listed.length > 0) return listed;
  return [
    { name: result.tenant1, phone: result.phone1, sms: "" },
    { name: result.tenant2, phone: result.phone2, sms: "" },
  ].filter((row) => row.phone.trim());
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
  const [clientChoices, setClientChoices] = useState<AgencyClient[]>([]);
  const [clientPick, setClientPick] = useState("");
  const [clientStatus, setClientStatus] = useState<"idle" | "none" | "one" | "several">("idle");
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
  const [introPhase, setIntroPhase] = useState<"preview" | "status" | "sms" | "done">("preview");
  const [introStatus, setIntroStatus] = useState<{ status: string; message: string; error: string } | null>(null);
  const [introBusy, setIntroBusy] = useState<"send" | "skip" | null>(null);
  const [ccPm, setCcPm] = useState(false);
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

  async function matchClients(agency: string, hint: string) {
    if (!isBusiness(business) || !agency.trim()) {
      setClientChoices([]);
      setClientPick("");
      setClientStatus("idle");
      return;
    }
    try {
      const found = await postJobs<{ pick: AgencyClient | null; suggestions: AgencyClient[] }>("/jobs/api/new/clients", {
        business,
        agency,
        hint,
      });
      setClientChoices(found.suggestions);
      setClientPick(found.pick?.id ?? "");
      setClientStatus(found.pick ? "one" : found.suggestions.length > 0 ? "several" : "none");
      if (found.pick) {
        setPmAgency((current) => {
          const typed = current.trim().toLowerCase();
          if (!typed || typed === agency.trim().toLowerCase()) return found.pick?.name ?? current;
          return current;
        });
      }
    } catch {
      setClientChoices([]);
      setClientPick("");
      setClientStatus("idle");
    }
  }

  function chooseClient(client: AgencyClient) {
    setPmAgency(client.name);
    setClientPick(client.id);
    setClientStatus("one");
  }

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
      void matchClients(pmAgency, "");
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
        officeHint?: string;
        tenants?: JobTenant[];
      }>("/jobs/api/new/read", form);
      const recognised = parseReadSnapshot(read);
      setReadSnapshot(recognised);
      setTenants(tenantsFromRead(read, { name: tenantName, phone }));
      const nextAgency = preferTyped(pmAgency, read.pmAgency);
      setAddress(preferTyped(address, read.address));
      setPmAgency(nextAgency);
      void matchClients(nextAgency, read.officeHint ?? "");
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
        ...introCcPayload(ccPm, result.pmEmail),
      });
      clearStoredNewJobDraft();
      clearStoredNewJobIntro();
      setIntroStatus({ status: outcome.status, message: outcome.message, error: "" });
      setIntroPhase(action === "send" ? "sms" : "status");
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
      <KeepPage>
        <Screen title="New job">
          <Spinner label="Opening" />
        </Screen>
      </KeepPage>
    );
  }

  if (result && isBusiness(business) && introPhase === "sms") {
    return (
      <KeepPage>
        <Screen title="Contacting tenant" back={<BackLink href="/jobs" />}>
          {introStatus ? <p className="text-lg font-semibold">{introStatusText(introStatus.status, introStatus.message)}</p> : null}
          <SmsPicker
            jobId={result.jobId}
            contacts={contactingContacts(result)}
            topSms={contactingSms(result, business)}
            address={result.address}
            jobTitle={result.jobTitle}
            allowManual
          />
          {result.jobUrl ? (
            <a href={result.jobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">
              Open in Notion
            </a>
          ) : null}
        </Screen>
      </KeepPage>
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
    const pmInbox = result.pmEmail.trim();
    const canCcPm = pmInbox.includes("@") && !/\s/.test(pmInbox);
    if (introPhase === "status" && introStatus) {
      return (
        <KeepPage>
          <Screen title="Intro email" back={<BackLink href="/jobs" />}>
            <p className="text-lg font-semibold">{introStatusText(introStatus.status, introStatus.message)}</p>
            <JobsButton type="button" variant="outline" onClick={() => setIntroPhase("done")}>
              Done
            </JobsButton>
          </Screen>
        </KeepPage>
      );
    }
    return (
      <KeepPage>
      <Screen title="Intro email" back={<BackLink href="/jobs" />}>
        <p className="text-lg font-semibold">{introSubject(preview.address, preview.brand)}</p>
        <ul className="space-y-2 text-base">
          {people.map((row, index) => (
            <li key={`${row.email}-${index}`}>{introTenantLine(row)}</li>
          ))}
        </ul>
        <pre className="whitespace-pre-wrap rounded-2xl border border-black p-4 text-base">{introBody(preview, named)}</pre>
        <label className={`flex min-h-14 items-center gap-3 text-base ${canCcPm ? "" : "text-neutral-500"}`}>
          <input
            type="checkbox"
            className="h-6 w-6 accent-black"
            checked={canCcPm && ccPm}
            disabled={!canCcPm || introBusy !== null}
            onChange={(event) => setCcPm(event.target.checked)}
          />
          {canCcPm ? `CC property manager (${pmInbox})` : "CC property manager"}
        </label>
        <JobsButton type="button" onClick={() => finishIntro("send")} disabled={introBusy !== null}>
          {introBusy === "send" ? "Sending" : "Send"}
        </JobsButton>
        <JobsButton type="button" variant="outline" onClick={() => finishIntro("skip")} disabled={introBusy !== null}>
          {introBusy === "skip" ? "Skipping" : "Skip"}
        </JobsButton>
      </Screen>
      </KeepPage>
    );
  }

  if (result) {
    const tenant = [result.tenant1, result.phone1, result.email1].filter(Boolean).join(" ");
    const tenant2 = [result.tenant2, result.phone2].filter(Boolean).join(" ");
    const pm = [result.pmName, result.pmAgency, result.pmEmail, result.pmPhone].filter(Boolean).join(" / ");
    return (
      <KeepPage>
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
      </KeepPage>
    );
  }

  if (step === "check" && isBusiness(business)) {
    return (
      <KeepPage>
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
            clientChoices={clientChoices}
            clientPick={clientPick}
            clientStatus={clientStatus}
            onChooseClient={chooseClient}
            onAgencyBlur={() => void matchClients(pmAgency, "")}
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
      </KeepPage>
    );
  }

  return (
    <KeepPage>
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
          <PhotoBurst
            files={files}
            max={NEW_JOB_MAX_IMAGES}
            doneLabel="Done"
            disabled={busy !== null}
            onChange={(next) => {
              setFiles(next);
              setReadyFiles([]);
              setScreenshotCount(next.length);
              if (next.length > 0) setScreenshotsCleared(false);
            }}
            onDone={files.length > 0 ? continueToCheck : undefined}
          />
          {files.length === 0 && screenshotsCleared ? <p className="text-base">{screenshotsClearedOnCapture}</p> : null}
          <DetailFields
            tenantName={tenantName}
            setTenantName={setTenantName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
            pmAgency={pmAgency}
            setPmAgency={setPmAgency}
            clientChoices={clientChoices}
            clientPick={clientPick}
            clientStatus={clientStatus}
            onChooseClient={chooseClient}
            onAgencyBlur={() => void matchClients(pmAgency, "")}
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
      {files.length === 0 ? (
        <JobsButton type="button" onClick={continueToCheck} disabled={busy !== null}>
          Continue
        </JobsButton>
      ) : null}
    </Screen>
    </KeepPage>
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
  clientChoices = [],
  clientPick = "",
  clientStatus = "idle",
  onChooseClient,
  onAgencyBlur,
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
  clientChoices?: AgencyClient[];
  clientPick?: string;
  clientStatus?: "idle" | "none" | "one" | "several";
  onChooseClient?: (client: AgencyClient) => void;
  onAgencyBlur?: () => void;
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
        <input value={pmAgency} onChange={(event) => setPmAgency(event.target.value)} onBlur={onAgencyBlur} maxLength={80} className={fieldClass} />
      </label>
      {clientStatus === "one" && clientPick ? (
        <p className="text-sm text-neutral-700">Existing client: {clientChoices.find((client) => client.id === clientPick)?.name ?? pmAgency}</p>
      ) : null}
      {clientStatus === "several" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-700">Choose an existing client</p>
          {clientChoices.map((client) => (
            <button key={client.id} type="button" onClick={() => onChooseClient?.(client)} className="min-h-11 rounded-2xl border border-black px-3 text-left text-base">
              {client.name}
              {client.company ? ` · ${client.company}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      {clientStatus === "none" ? <p className="text-sm text-neutral-700">No existing client. A new client will not be created.</p> : null}
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
