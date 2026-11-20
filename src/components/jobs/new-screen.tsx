"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobsForm } from "@/components/jobs/api";
import { compressFiles } from "@/components/jobs/resize-image";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
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

export function NewJobScreen() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NewJobResult | null>(null);
  const router = useRouter();

  async function submit() {
    if (pending.current) return;
    if (!isBusiness(business)) {
      setError("Choose Emoro or Emporo.");
      return;
    }
    if (files.length === 0) {
      setError("Choose a screenshot.");
      return;
    }
    pending.current = true;
    setError("");
    setBusy(true);
    try {
      const compressed = await compressFiles(files.slice(0, NEW_JOB_MAX_IMAGES), NEW_JOB_MAX_EDGE, NEW_JOB_QUALITIES);
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
      setResult(await postJobsForm<NewJobResult>("/jobs/api/new", form));
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "This screenshot could not be compressed. Use a JPEG.");
    } finally {
      pending.current = false;
      setBusy(false);
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

  return (
    <Screen title="New job" back={<BackLink href="/jobs" />}>
      {error ? <Alert>{error}</Alert> : null}
      {busy ? <Spinner label="Reading the screenshot, about 10 seconds" /> : null}
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
                event.currentTarget.value = "";
              }}
            />
          </label>
          <p className="text-base">{files.length > 0 ? `${files.length} selected, ${NEW_JOB_MAX_IMAGES} at most` : `Up to ${NEW_JOB_MAX_IMAGES} screenshots`}</p>
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
      </div>
      <JobsButton type="button" onClick={submit} disabled={busy}>
        {busy ? "Creating" : "Create job"}
      </JobsButton>
    </Screen>
  );
}
