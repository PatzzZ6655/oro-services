"use client";

import { useState } from "react";
import { resizeToJpeg } from "@/components/jobs/resize-image";
import { normalizePhone } from "@/lib/jobs-app/phones";
import { smsHref } from "@/lib/jobs-app/sms";
import { smsBodyHref, smsReplyBrands, type SmsReplyBrand } from "@/lib/sms-reply-client";

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

  const phone = normalizePhone(mobile);
  const sendHref = phone && draft.trim() ? smsHref([phone], draft.trim())?.href ?? "" : "";
  const messagesHref = draft.trim() ? smsBodyHref(draft.trim()) : "";

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

  async function choosePhoto(file: File | undefined) {
    setError("");
    if (!file) return;
    try {
      const next = await readShot(file);
      setShot((current) => {
        if (current) URL.revokeObjectURL(current.preview);
        return next;
      });
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
    setBrand((current) => (current === next ? "" : next));
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
    if (!nextRevision && !customerMessage.trim() && !shot) {
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
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; sms?: string; message?: string } | null;
      if (!response.ok || !payload?.ok || typeof payload.sms !== "string") {
        setError(payload?.message || "The English text couldn't be written. Try again.");
        return;
      }
      setDraft(payload.sms);
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

  return (
    <div className="space-y-4">
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
          onChange={(event) => setCustomerName(event.target.value)}
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
          <textarea
            id="english-draft"
            lang="en-AU"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
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
