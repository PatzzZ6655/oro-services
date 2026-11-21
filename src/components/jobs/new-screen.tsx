"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobsForm } from "@/components/jobs/api";
import { compressFiles } from "@/components/jobs/resize-image";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import {
  newJobNeedDetail,
  newJobTextCoversScreenshots,
  newJobTextLimits,
  preferTyped,
  readNewJobText,
  screenshotReadFallback,
} from "@/lib/jobs-app/new-job-text";
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
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [workOrderNumber, setWorkOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState<"read" | "create" | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NewJobResult | null>(null);
  const router = useRouter();

  async function continueToCheck() {
    if (pending.current) return;
    if (!isBusiness(business)) {
      setError("Choose Emoro or Emporo.");
      return;
    }
    if (files.length === 0) {
      setReadyFiles([]);
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
        address: string;
        description: string;
        workOrderNumber: string;
        voucher: string;
      }>("/jobs/api/new/read", form);
      setTenantName(preferTyped(tenantName, read.tenantName));
      setPhone(preferTyped(phone, read.phone));
      setAddress(preferTyped(address, read.address));
      setDescription(preferTyped(description, read.description));
      setWorkOrderNumber(preferTyped(workOrderNumber, read.workOrderNumber));
      setVoucher(preferTyped(voucher, read.voucher.toUpperCase()));
      setReadyFiles(compressed);
      setStep("check");
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      if (reason instanceof JobsClientError && reason.code === "unreadable") {
        setReadyFiles(compressed);
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
      setError("Choose Emoro or Emporo.");
      return;
    }
    const typed = typedDraft({ tenantName, phone, address, description, workOrderNumber, notes });
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
      for (const [key, value] of Object.entries(typed)) {
        if (value) form.set(key, value);
      }
      const code = voucher.trim().toUpperCase().replace(/\s+/g, "");
      if (code) form.set("voucher", code);
      for (const file of readyFiles) form.append("images", file);
      setResult(await postJobsForm<NewJobResult>("/jobs/api/new", form));
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

  if (result) {
    const tenant = [result.tenant1, result.phone1, result.email1].filter(Boolean).join(" ");
    const tenant2 = [result.tenant2, result.phone2].filter(Boolean).join(" ");
    const pm = [result.pmName, result.pmAgency, result.pmEmail, result.pmPhone].filter(Boolean).join(" / ");
    return (
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
    );
  }

  if (step === "check" && isBusiness(business)) {
    return (
      <Screen
        title="Check job"
        back={
          <button type="button" onClick={() => { setError(""); setStep("capture"); }} className="min-h-11 text-base font-semibold underline">
            Back
          </button>
        }
      >
        {error ? <Alert>{error}</Alert> : null}
        {busy === "create" ? <Spinner label="Creating the job" /> : null}
        <div className={busy ? "hidden" : "contents"}>
          <p className="text-base text-neutral-700">{businessLabel(business)}</p>
          <p className="text-base text-neutral-700">
            {readyFiles.length > 0
              ? `${readyFiles.length} screenshot${readyFiles.length === 1 ? "" : "s"} will be sent with the job.`
              : "No screenshot. Check the details, then create the job."}
          </p>
          <DetailFields
            tenantName={tenantName}
            setTenantName={setTenantName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
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
        <JobsButton type="button" onClick={submit} disabled={busy !== null}>
          {busy === "create" ? "Creating" : "Create job"}
        </JobsButton>
      </Screen>
    );
  }

  return (
    <Screen title="New job" back={<BackLink href="/jobs" />}>
      {error ? <Alert>{error}</Alert> : null}
        {busy === "read" ? <Spinner label="Reading the screenshot, about 10 seconds" /> : null}
      <div className={busy ? "hidden" : "contents"}>
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
                event.currentTarget.value = "";
              }}
            />
          </label>
          <p className="text-base">{files.length > 0 ? `${files.length} selected, ${NEW_JOB_MAX_IMAGES} at most` : `Up to ${NEW_JOB_MAX_IMAGES} screenshots`}</p>
          <DetailFields
            tenantName={tenantName}
            setTenantName={setTenantName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
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
      <JobsButton type="button" onClick={continueToCheck} disabled={busy !== null}>
        {files.length > 0 ? "Read screenshots" : "Continue"}
      </JobsButton>
    </Screen>
  );
}

function DetailFields({
  tenantName,
  setTenantName,
  phone,
  setPhone,
  address,
  setAddress,
  description,
  setDescription,
  workOrderNumber,
  setWorkOrderNumber,
  notes,
  setNotes,
  voucher,
  setVoucher,
}: {
  tenantName: string;
  setTenantName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
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
      <label className="flex flex-col gap-2 text-base">
        Tenant / contact name
        <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} maxLength={newJobTextLimits.tenantName} autoComplete="name" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={newJobTextLimits.phone} inputMode="tel" autoComplete="tel" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-2 text-base">
        Property address
        <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={newJobTextLimits.address} autoComplete="street-address" className={fieldClass} />
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
