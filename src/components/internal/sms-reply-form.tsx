"use client";

import { useRef, useState } from "react";
import { smsJobSearchAfter } from "@/lib/sms-job-statuses";
import { resizeToJpeg } from "@/components/jobs/resize-image";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { smsHref } from "@/lib/jobs-app/sms";
import { smsBodyHref, smsReplyBrands, type SmsReplyBrand } from "@/lib/sms-reply-client";
import type { SmsJobContact, SmsOpenJob } from "@/lib/sms-reply-jobs";
import {
  dateFromChip,
  defaultVariant,
  fillSmsTemplate,
  highlightSchedule,
  matchSmsTemplate,
  scheduleConflict,
  scheduleFromJob,
  smsDateChips,
  smsMinuteChips,
  smsTemplateById,
  smsTemplateGroups,
  smsTemplates,
  smsTimeChips,
  suggestTemplates,
  templateEnglish,
} from "@/lib/sms-templates";

const fieldClass =
  "mt-1 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const brandClass = (on: boolean) =>
  `flex min-h-12 items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold ${
    on ? "border-brand-navy bg-slate-50 text-brand-navy" : "border-slate-300 bg-white text-slate-700"
  }`;

type Shot = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";
  data: string;
  preview: string;
};

function fileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

async function readShot(file: File): Promise<Shot> {
  try {
    const jpeg = await resizeToJpeg(file, 1600, 0.75, 0);
    return { mimeType: "image/jpeg", data: await fileBase64(jpeg), preview: URL.createObjectURL(jpeg) };
  } catch {
    const mime = file.type.toLowerCase();
    const allowed = mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/heic" || mime === "image/heif";
    if (!allowed || file.size > 1_200_000) throw new Error("read");
    return { mimeType: mime as Shot["mimeType"], data: await fileBase64(file), preview: URL.createObjectURL(file) };
  }
}

export function SmsReplyForm() {
  const [customerMessage, setCustomerMessage] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [intent, setIntent] = useState("");
  const [brand, setBrand] = useState<SmsReplyBrand | "">("");
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pasteNote, setPasteNote] = useState("");
  const [phoneNote, setPhoneNote] = useState("");
  const [pending, setPending] = useState<"write" | "rewrite" | "">("");
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<SmsOpenJob[] | null>(null);
  const [jobsNote, setJobsNote] = useState("");
  const [jobKey, setJobKey] = useState("");
  const [contacts, setContacts] = useState<SmsJobContact[]>([]);
  const [contactPhone, setContactPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variant, setVariant] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [mins, setMins] = useState("");
  const [agency, setAgency] = useState("");
  const [pmName, setPmName] = useState("");
  const [reason, setReason] = useState("");
  const [issue, setIssue] = useState("");
  const [pickedNote, setPickedNote] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [jobOpen, setJobOpen] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [matchNote, setMatchNote] = useState("");
  const [phoneWarning, setPhoneWarning] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [shotPhone, setShotPhone] = useState("");
  const [draftEdited, setDraftEdited] = useState(false);
  const jobKeyRef = useRef("");
  const shotPhoneRef = useRef("");
  const fields = useRef({
    name: "",
    pmName: "",
    address: "",
    day: "",
    time: "",
    mins: "",
    reason: "",
    issue: "",
    agency: "",
    brand: "" as SmsReplyBrand | "",
    templateId: "",
    variant: "",
  });

  const phone = normalizePhone(mobile);
  const sendHref = phone && draft.trim() ? smsHref([phone], draft.trim())?.href ?? "" : "";
  const messagesHref = draft.trim() ? smsBodyHref(draft.trim()) : "";

  function paintTemplate(next: Partial<typeof fields.current>) {
    Object.assign(fields.current, next);
    const template = smsTemplateById(fields.current.templateId);
    if (!template) return;
    const current = fields.current;
    setDraft(
      fillSmsTemplate(templateEnglish(template, current.variant), {
        name: current.name,
        pmName: current.pmName,
        brand: current.brand ? smsReplyBrands[current.brand] : "",
        agency: current.agency,
        address: current.address,
        day: current.day,
        time: current.time,
        mins: current.mins,
        reason: current.reason,
        issue: current.issue,
      }),
    );
    setReady(true);
  }

  function applyContact(contact: SmsJobContact, business: SmsReplyBrand) {
    setBrand(business);
    setMobile(contact.phone);
    setCustomerName(contact.name);
    fields.current.name = contact.name;
    fields.current.brand = business;
    setContactPhone(contact.phone);
    if (fields.current.templateId && !draftEdited) paintTemplate({ name: contact.name, brand: business });
  }

  async function loadJobs() {
    setJobsNote("");
    setError("");
    try {
      const response = await fetch("/internal/api/sms-reply/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; jobs?: SmsOpenJob[]; message?: string } | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
        setJobsNote(payload?.message || "Active jobs could not be loaded.");
        setJobs([]);
        return;
      }
      setJobs(payload.jobs);
      if (payload.jobs.length === 0) setJobsNote("No active jobs.");
    } catch {
      setJobs([]);
      setJobsNote("Active jobs could not be loaded.");
    }
  }

  function clearJob() {
    jobKeyRef.current = "";
    setJobKey("");
    setJobStatus("");
    setContacts([]);
    setContactPhone("");
    setPhoneWarning(false);
    setSaveConfirm(false);
    setMatchNote("");
    setJobOpen(false);
  }

  async function chooseJob(job: SmsOpenJob, fromShot = "") {
    const key = `${job.business}:${job.jobId}`;
    jobKeyRef.current = key;
    setJobKey(key);
    setContacts([]);
    setContactPhone("");
    setBrand(job.business);
    setJobStatus(job.status);
    setMobile("");
    setCustomerName("");
    setError("");
    setPhoneWarning(false);
    setSaveConfirm(false);
    setSaveNote("");
    setJobOpen(false);
    const slot = scheduleFromJob(job.scheduled);
    if (slot) {
      setDateKey(slot.dateKey);
      setDateLabel(slot.dateLabel);
      setVisitTime(slot.time);
    }
    if (fields.current.templateId && !draftEdited) {
      paintTemplate({
        address: job.address,
        brand: job.business,
        name: "",
        day: slot?.dateLabel ?? fields.current.day,
        time: slot?.time ?? fields.current.time,
      });
    } else if (slot) {
      fields.current.address = job.address;
      fields.current.brand = job.business;
      fields.current.day = slot.dateLabel;
      fields.current.time = slot.time;
    } else {
      fields.current.address = job.address;
      fields.current.brand = job.business;
    }
    try {
      const response = await fetch("/internal/api/sms-reply/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ business: job.business, jobId: job.jobId }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; contacts?: SmsJobContact[]; message?: string } | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.contacts)) {
        setJobsNote(payload?.message || "The tenant number could not be read. Type it below.");
        return;
      }
      setContacts(payload.contacts);
      const wanted = normalizePhone(fromShot || shotPhoneRef.current);
      const hit = wanted ? payload.contacts.find((contact) => contact.phone === wanted) : undefined;
      if (hit) {
        applyContact(hit, job.business);
        setPhoneWarning(false);
        setJobsNote(payload.contacts.length > 1 ? "Choose the tenant." : "");
        return;
      }
      if (wanted) {
        setMobile(wanted);
        setPhoneWarning(true);
        const named = payload.contacts.find((contact) => contact.name);
        if (payload.contacts.length === 1 && named) {
          setCustomerName(named.name);
          fields.current.name = named.name;
          if (fields.current.templateId && !draftEdited) paintTemplate({ name: named.name, brand: job.business });
        }
        setJobsNote(payload.contacts.length > 1 ? "Choose the tenant." : "");
        return;
      }
      if (payload.contacts.length === 1) {
        const only = payload.contacts[0];
        if (only) applyContact(only, job.business);
        setJobsNote("");
        return;
      }
      if (payload.contacts.length === 0) {
        setCustomerName("");
        setJobsNote("No tenant mobile on this job. Type the number below.");
        return;
      }
      setJobsNote("Choose the tenant.");
    } catch {
      setJobsNote("The tenant number could not be read. Type it below.");
    }
  }

  async function pasteInto(target: "message" | "phone") {
    if (target === "message") setPasteNote("");
    else setPhoneNote("");
    try {
      const text = (await navigator.clipboard.readText()).slice(0, target === "phone" ? 40 : 2000);
      if (target === "message") setCustomerMessage(text);
      else setMobile(text.trim());
    } catch {
      const note = "Couldn't read the clipboard. Paste into the box instead.";
      if (target === "message") setPasteNote(note);
      else setPhoneNote(note);
    }
  }

  async function matchShot(next: Shot) {
    if (jobKeyRef.current) return;
    setMatchNote("");
    setPhoneWarning(false);
    try {
      const response = await fetch("/internal/api/sms-reply/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: { mimeType: next.mimeType, data: next.data } }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        address?: string;
        phone?: string;
        matchedBy?: string;
        matches?: SmsOpenJob[];
        jobs?: SmsOpenJob[];
      } | null;
      if (jobKeyRef.current) return;
      if (!response.ok || !payload?.ok) {
        setMatchNote(payload?.message || "The screenshot could not be read.");
        return;
      }
      if (Array.isArray(payload.jobs)) setJobs(payload.jobs);
      const seen = normalizePhone(payload.phone || "");
      if (seen) {
        shotPhoneRef.current = seen;
        setShotPhone(seen);
      }
      const matches = Array.isArray(payload.matches) ? payload.matches : [];
      if (matches.length === 1 && matches[0]) {
        const job = matches[0];
        setMatchNote(`Matched from screenshot: ${job.address || job.title} – ${job.status}`);
        await chooseJob(job, seen || "");
        return;
      }
      if (matches.length > 1) {
        setMatchNote(payload.matchedBy === "phone" ? "Several active jobs use this number. Pick one." : "Several active jobs match this address. Pick one.");
        setJobOpen(true);
        return;
      }
      if (seen && !payload.address) {
        setMobile(seen);
        return;
      }
      if (seen) setMobile(seen);
      setMatchNote("No active job found");
    } catch {
      setMatchNote("The screenshot could not be read.");
    }
  }

  async function confirmSave() {
    const job = jobs?.find((item) => `${item.business}:${item.jobId}` === jobKey);
    const number = normalizePhone(shotPhone || mobile);
    if (!job || !number) return;
    setSaveNote("");
    setError("");
    try {
      const response = await fetch("/internal/api/sms-reply/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ save: true, business: job.business, jobId: job.jobId, phone: number, name: customerName }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; action?: string; phone?: string } | null;
      if (!response.ok || !payload?.ok) {
        setSaveNote(payload?.message || "The tenant contact could not be saved.");
        return;
      }
      setPhoneWarning(false);
      setSaveConfirm(false);
      setSaveNote(payload.action === "created" ? "Saved a new tenant contact on this job." : "Saved the number on this job's tenant.");
      if (payload.phone && !contacts.some((contact) => contact.phone === payload.phone)) {
        setContacts((current) => [...current, { name: customerName, phone: payload.phone || number }]);
      }
    } catch {
      setSaveNote("The tenant contact could not be saved.");
    }
  }

  async function choosePhoto(file: File | undefined) {
    setError("");
    if (!file) return;
    try {
      const next = await readShot(file);
      setShot((current) => {
        if (current) URL.revokeObjectURL(current.preview);
        return next;
      });
      if (!jobKeyRef.current) void matchShot(next);
    } catch {
      setError("Couldn't read that photo. Paste the text instead.");
    }
  }

  function clearPhoto() {
    setShot((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
  }

  function chooseBrand(next: SmsReplyBrand) {
    const chosen = brand === next ? "" : next;
    setBrand(chosen);
    fields.current.brand = chosen;
    if (fields.current.templateId && !draftEdited) paintTemplate({ brand: chosen });
  }

  function chooseTemplate(id: string, nextVariant = "") {
    setPickedNote("");
    setTemplateId(id);
    setDraftEdited(false);
    const template = smsTemplateById(id);
    if (!template) {
      paintTemplate({ templateId: "" });
      return;
    }
    const chosen = nextVariant || defaultVariant(template);
    setVariant(chosen);
    setIntent(template.intent);
    paintTemplate({ templateId: id, variant: chosen });
  }

  async function ask(nextRevision: string) {
    setError("");
    setCopied(false);
    if (!intent.trim()) {
      setError("Say what you want to reply, in Chinese.");
      return;
    }
    if (nextRevision && !draft.trim()) {
      setError("There is no draft to revise.");
      return;
    }
    let base = "";
    if (!nextRevision && !fields.current.templateId) {
      const picked = matchSmsTemplate(intent);
      if (picked) {
        const template = smsTemplateById(picked.id);
        const chosen = picked.variant || (template ? defaultVariant(template) : "");
        setTemplateId(picked.id);
        setVariant(chosen);
        setPickedNote(template ? `Picked from what you said: ${template.label}` : "");
        setDraftEdited(false);
        paintTemplate({ templateId: picked.id, variant: chosen });
        base = template ? fillSmsTemplate(templateEnglish(template, chosen), {
          name: fields.current.name,
          pmName: fields.current.pmName,
          brand: fields.current.brand ? smsReplyBrands[fields.current.brand] : "",
          agency: fields.current.agency,
          address: fields.current.address,
          day: fields.current.day,
          time: fields.current.time,
          mins: fields.current.mins,
          reason: fields.current.reason,
          issue: fields.current.issue,
        }) : "";
      }
    } else if (fields.current.templateId && !draftEdited) {
      const template = smsTemplateById(fields.current.templateId);
      base = template ? fillSmsTemplate(templateEnglish(template, fields.current.variant), {
        name: fields.current.name,
        pmName: fields.current.pmName,
        brand: fields.current.brand ? smsReplyBrands[fields.current.brand] : "",
        agency: fields.current.agency,
        address: fields.current.address,
        day: fields.current.day,
        time: fields.current.time,
        mins: fields.current.mins,
        reason: fields.current.reason,
        issue: fields.current.issue,
      }) : "";
    } else if (draftEdited) {
      base = draft;
    }
    if (!nextRevision && !customerMessage.trim() && !shot && !base) {
      setError("Paste the customer's text or add a screenshot.");
      return;
    }
    setPending(nextRevision ? "rewrite" : "write");
    try {
      const response = await fetch("/internal/api/sms-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerMessage,
          intent,
          brand,
          customerName,
          image: shot ? { mimeType: shot.mimeType, data: shot.data } : null,
          draft: nextRevision ? draft : "",
          revision: nextRevision,
          base: nextRevision ? "" : base,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; sms?: string; message?: string } | null;
      if (!response.ok || !payload?.ok || typeof payload.sms !== "string") {
        setError(payload?.message || "The English text couldn't be written. Try again.");
        return;
      }
      setDraft(payload.sms);
      setDraftEdited(true);
      setReady(true);
      if (nextRevision) setRevision("");
    } catch {
      setError("The English text couldn't be written. Try again.");
    } finally {
      setPending("");
    }
  }

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the text and copy it.");
    }
  }

  const selectedJob = jobs?.find((job) => `${job.business}:${job.jobId}` === jobKey) ?? null;
  const jobText = jobQuery.trim().toLowerCase();
  const visibleJobs = (jobs ?? []).filter((job) => {
    if (!jobText) return true;
    return `${smsReplyBrands[job.business]} ${job.address} ${job.title} ${job.status}`.toLowerCase().includes(jobText);
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <label id="sms-job-label" className="text-sm font-medium text-slate-800">
            Job (optional)
          </label>
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-brand-navy"
          >
            {jobs === null ? "Show jobs" : "Refresh"}
          </button>
        </div>
        <button
          type="button"
          aria-labelledby="sms-job-label"
          aria-expanded={jobOpen}
          aria-haspopup="listbox"
          onClick={() => {
            setJobOpen((open) => !open);
            if (jobs === null) void loadJobs();
          }}
          className="mt-1 flex min-h-12 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left"
        >
          {selectedJob ? (
            <>
              <span className={`size-2.5 shrink-0 rounded-full ${selectedJob.business === "emoro" ? "bg-brand-orange" : "bg-brand-blue"}`} aria-hidden />
              <span className="sr-only">{smsReplyBrands[selectedJob.business]}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{selectedJob.address || selectedJob.title}</span>
              <span className="shrink-0 text-xs text-slate-500">{selectedJob.status}</span>
            </>
          ) : (
            <span className="text-base text-slate-500">Choose a job</span>
          )}
        </button>
        {jobOpen ? (
          <div className="mt-2 rounded-xl border border-slate-300 bg-white p-2">
            {jobs && jobs.length > smsJobSearchAfter ? (
              <input
                type="search"
                value={jobQuery}
                onChange={(event) => setJobQuery(event.target.value)}
                placeholder="Search address or status"
                aria-label="Filter jobs"
                className="mb-2 w-full min-h-11 rounded-lg border border-slate-300 px-3 text-base"
              />
            ) : null}
            <div role="listbox" aria-labelledby="sms-job-label" className="max-h-64 space-y-1 overflow-y-auto">
              <button type="button" onClick={clearJob} className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-600">
                No job
              </button>
              {visibleJobs.map((job) => {
                const key = `${job.business}:${job.jobId}`;
                const on = jobKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => void chooseJob(job)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${on ? "bg-slate-100" : ""}`}
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${job.business === "emoro" ? "bg-brand-orange" : "bg-brand-blue"}`} aria-hidden />
                    <span className="sr-only">{smsReplyBrands[job.business]}</span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{job.address || job.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{job.status}</span>
                  </button>
                );
              })}
              {jobs && visibleJobs.length === 0 ? <p className="px-2 py-2 text-sm text-slate-600">No matching job.</p> : null}
            </div>
          </div>
        ) : null}
        {matchNote ? <p className="mt-1 text-sm text-slate-700">{matchNote}</p> : null}
        {jobsNote ? <p className="mt-1 text-sm text-slate-600">{jobsNote}</p> : null}
        {phoneWarning && selectedJob ? (
          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-slate-900">{"This number isn't in Notion for this job"}</p>
            {saveConfirm ? (
              <div className="mt-2">
                <p className="text-sm text-slate-700">
                  {`Add ${shotPhone || phone} to this job's tenant contact? This does not change the property, and it will not replace a number that is already there.`}
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void confirmSave()} className="min-h-11 rounded-xl bg-brand-navy px-3 text-sm font-semibold text-white">
                    Confirm save
                  </button>
                  <button type="button" onClick={() => setSaveConfirm(false)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setSaveConfirm(true)} className="mt-2 min-h-11 rounded-xl border border-brand-navy bg-white px-3 text-sm font-semibold text-brand-navy">
                {"Save to this job's tenant"}
              </button>
            )}
            {saveNote ? <p className="mt-2 text-sm text-slate-700">{saveNote}</p> : null}
          </div>
        ) : null}
        {saveNote && !phoneWarning ? <p className="mt-1 text-sm text-slate-700">{saveNote}</p> : null}
        {contacts.length > 1 ? (
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-slate-800">Tenant contact</legend>
            <div className="mt-1 space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.phone}
                  type="button"
                  aria-pressed={contactPhone === contact.phone}
                  onClick={() => applyContact(contact, jobKey.startsWith("emporo:") ? "emporo" : "emoro")}
                  className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 text-left text-sm ${contactPhone === contact.phone ? "border-brand-navy bg-slate-50" : "border-slate-300 bg-white"}`}
                >
                  <span className="font-semibold text-slate-900">{contact.name || "Tenant"}</span>
                  <span className="text-slate-600">{contact.phone}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="customer-message" className="text-sm font-medium text-slate-800">
            Customer message
          </label>
          <button
            type="button"
            onClick={() => void pasteInto("message")}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-brand-navy"
          >
            Paste
          </button>
        </div>
        <textarea
          id="customer-message"
          value={customerMessage}
          onChange={(event) => setCustomerMessage(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Paste the text, or add a screenshot below"
          className={fieldClass}
        />
        {pasteNote ? (
          <p role="status" className="mt-1 text-sm text-slate-600">
            {pasteNote}
          </p>
        ) : null}
        <div className="mt-3">
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-brand-navy">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void choosePhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {shot ? "Change screenshot" : "Add screenshot"}
          </label>
          {shot ? (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.preview} alt="The text conversation" className="max-h-56 w-full rounded-xl border border-slate-200 object-contain" />
              <button type="button" onClick={clearPhoto} className="mt-1 min-h-11 text-sm font-semibold text-slate-600 underline">
                Remove screenshot
              </button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">From the camera roll. The photo is read for context and is not saved.</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="sms-template" className="block text-sm font-medium text-slate-800">
          Template (optional)
        </label>
        {jobStatus || jobKey ? (
          <div className="mt-2">
            <p className="text-sm text-slate-600">Suggested for this job</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {suggestTemplates(jobStatus).map((item) => {
                const template = smsTemplateById(item.id);
                const variantLabel = template?.variants?.find((option) => option.id === item.variant)?.label;
                return (
                  <button
                    key={`${item.id}:${item.variant}`}
                    type="button"
                    onClick={() => chooseTemplate(item.id, item.variant)}
                    className="min-h-11 rounded-full border border-brand-navy bg-white px-3 text-sm font-semibold text-brand-navy"
                  >
                    {template?.label}
                    {variantLabel ? ` · ${variantLabel}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <select id="sms-template" value={templateId} onChange={(event) => chooseTemplate(event.target.value)} className={fieldClass}>
          <option value="">None</option>
          {smsTemplateGroups.map((group) => (
            <optgroup key={group} label={group}>
              {smsTemplates
                .filter((template) => template.group === group)
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {pickedNote ? <p className="mt-1 text-sm text-slate-600">{pickedNote}</p> : null}
        {smsTemplateById(templateId)?.variants ? (
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Template option">
            {smsTemplateById(templateId)?.variants?.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={variant === option.id}
                onClick={() => {
                  setVariant(option.id);
                  setDraftEdited(false);
                  paintTemplate({ variant: option.id });
                }}
                className={brandClass(variant === option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-slate-800">Date</p>
          {dateLabel ? <p className="text-base font-semibold text-brand-navy">{dateLabel}</p> : null}
          <div className="flex flex-wrap gap-2">
            {smsDateChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={dateKey === chip.key}
                onClick={() => {
                  const label = dateFromChip(chip.key);
                  setDateKey(chip.key);
                  setDateLabel(label);
                  if (fields.current.templateId && !draftEdited) paintTemplate({ day: label });
                  else fields.current.day = label;
                }}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${dateKey === chip.key ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white text-slate-800"}`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-slate-800">Time</p>
          <div className="flex flex-wrap gap-2">
            {smsTimeChips.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-pressed={visitTime === chip}
                onClick={() => {
                  setVisitTime(chip);
                  if (fields.current.templateId && !draftEdited) paintTemplate({ time: chip });
                  else fields.current.time = chip;
                }}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${visitTime === chip ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white text-slate-800"}`}
              >
                {chip}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-slate-800">About</p>
          <div className="flex flex-wrap gap-2">
            {smsMinuteChips.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-pressed={mins === chip}
                onClick={() => {
                  setMins(chip);
                  if (fields.current.templateId && !draftEdited) paintTemplate({ mins: chip });
                  else fields.current.mins = chip;
                }}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${mins === chip ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white text-slate-800"}`}
              >
                {chip} mins
              </button>
            ))}
          </div>
          {scheduleConflict(intent, { dateKey, time: visitTime }) ? (
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-800">
              {scheduleConflict(intent, { dateKey, time: visitTime })}
            </p>
          ) : null}
        </div>
        {templateId === "first-visit" ? (
          <label className="mt-3 block text-sm font-medium text-slate-800">
            Agency
            <input value={agency} onChange={(event) => { setAgency(event.target.value); if (!draftEdited) paintTemplate({ agency: event.target.value }); }} className={fieldClass} />
          </label>
        ) : null}
        {smsTemplateById(templateId)?.audience === "pm" ? (
          <label className="mt-3 block text-sm font-medium text-slate-800">
            PM name
            <input value={pmName} onChange={(event) => { setPmName(event.target.value); if (!draftEdited) paintTemplate({ pmName: event.target.value }); }} className={fieldClass} />
          </label>
        ) : null}
        {templateId === "reschedule" ? (
          <label className="mt-3 block text-sm font-medium text-slate-800">
            Reason
            <input value={reason} onChange={(event) => { setReason(event.target.value); if (!draftEdited) paintTemplate({ reason: event.target.value }); }} className={fieldClass} />
          </label>
        ) : null}
        {templateId === "emergency" ? (
          <div className="mt-3 flex gap-2">
            {["water", "gas"].map((kind) => (
              <button key={kind} type="button" aria-pressed={issue === kind} onClick={() => { setIssue(kind); if (!draftEdited) paintTemplate({ issue: kind }); }} className={brandClass(issue === kind)}>
                {kind}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="reply-intent" className="block text-sm font-medium text-slate-800">
          What you want to say
        </label>
        <textarea
          id="reply-intent"
          lang="zh-Hans"
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Dictate in Chinese"
          className={fieldClass}
        />
        <p className="mt-1 text-sm text-slate-600">Use the keyboard microphone and dictate in Chinese.</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Brand (optional)</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(Object.keys(smsReplyBrands) as SmsReplyBrand[]).map((id) => (
            <button key={id} type="button" aria-pressed={brand === id} onClick={() => chooseBrand(id)} className={brandClass(brand === id)}>
              {smsReplyBrands[id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="customer-name" className="block text-sm font-medium text-slate-800">
          Customer name (optional)
        </label>
        <input
          id="customer-name"
          value={customerName}
          onChange={(event) => {
            const value = event.target.value;
            setCustomerName(value);
            fields.current.name = value;
            if (fields.current.templateId && !draftEdited) paintTemplate({ name: value });
          }}
          maxLength={80}
          autoComplete="off"
          placeholder="Leave blank to say Hi tenant"
          className={fieldClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="customer-mobile" className="text-sm font-medium text-slate-800">
            Customer mobile (optional)
          </label>
          <button
            type="button"
            onClick={() => void pasteInto("phone")}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-brand-navy"
          >
            Paste
          </button>
        </div>
        <input
          id="customer-mobile"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0412 345 678"
          className={fieldClass}
        />
        {phone ? <p className="mt-1 text-sm text-slate-600">{phone}</p> : null}
        {phoneNote ? (
          <p role="status" className="mt-1 text-sm text-slate-600">
            {phoneNote}
          </p>
        ) : null}
        {mobile.trim() && !phone ? <p className="mt-1 text-sm text-slate-600">Use an Australian mobile, for example 0412 345 678.</p> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void ask("")}
        disabled={pending !== ""}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending === "write" ? "Writing…" : "Write English"}
      </button>

      {ready ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="English draft">
          <label htmlFor="english-draft" className="block text-sm font-medium text-slate-800">
            English SMS
          </label>
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-base leading-relaxed text-slate-900">
            {highlightSchedule(draft).map((part, index) =>
              part.mark ? (
                <mark key={index} className="rounded bg-amber-200 px-0.5 text-slate-900">
                  {part.text}
                </mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
          <textarea
            id="english-draft"
            lang="en-AU"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftEdited(true);
              setCopied(false);
            }}
            rows={5}
            className={fieldClass}
          />
          <label htmlFor="reply-revision" className="block text-sm font-medium text-slate-800">
            Revise
          </label>
          <textarea
            id="reply-revision"
            lang="zh-Hans"
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Dictate a change, for example shorter, or mention Tuesday"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => void ask(revision.trim())}
            disabled={pending !== ""}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            {pending === "rewrite" ? "Rewriting…" : "Rewrite"}
          </button>
          {sendHref ? (
            <a href={sendHref} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy px-4 text-base font-semibold text-white">
              Send
            </a>
          ) : (
            <button type="button" disabled className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-200 px-4 text-base font-semibold text-slate-500">
              Send
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="flex min-h-12 items-center justify-center rounded-xl border border-brand-navy bg-white px-3 text-sm font-semibold text-brand-navy"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {messagesHref ? (
              <a href={messagesHref} className="flex min-h-12 items-center justify-center rounded-xl border border-brand-navy bg-white px-3 text-center text-sm font-semibold text-brand-navy">
                Open in Messages
              </a>
            ) : (
              <span className="flex min-h-12 items-center justify-center rounded-xl bg-slate-200 px-3 text-center text-sm font-semibold text-slate-500">
                Open in Messages
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">Nothing is sent from here. Send opens Messages with the number and the text, and you confirm it there.</p>
        </section>
      ) : null}
    </div>
  );
}
