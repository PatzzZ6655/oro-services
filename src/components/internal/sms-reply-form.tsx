"use client";

import { useState } from "react";
import { smsBodyHref, smsReplyBrands, type SmsReplyBrand } from "@/lib/sms-reply-client";

const fieldClass =
  "mt-1 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const brandClass = (on: boolean) =>
  `flex min-h-12 items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold ${
    on ? "border-brand-navy bg-slate-50 text-brand-navy" : "border-slate-300 bg-white text-slate-700"
  }`;

export function SmsReplyForm() {
  const [customerMessage, setCustomerMessage] = useState("");
  const [intent, setIntent] = useState("");
  const [brand, setBrand] = useState<SmsReplyBrand | "">("");
  const [customerName, setCustomerName] = useState("");
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pasteNote, setPasteNote] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function paste() {
    setPasteNote("");
    try {
      const text = await navigator.clipboard.readText();
      setCustomerMessage(text.slice(0, 2000));
    } catch {
      setPasteNote("Couldn't read the clipboard. Paste into the box instead.");
    }
  }

  function chooseBrand(next: SmsReplyBrand) {
    setBrand((current) => (current === next ? "" : next));
  }

  async function write() {
    setError("");
    setCopied(false);
    if (!intent.trim()) {
      setError("Say what you want to reply, in Chinese.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/internal/api/sms-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerMessage,
          intent,
          brand,
          customerName,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; sms?: string; message?: string } | null;
      if (!response.ok || !payload?.ok || typeof payload.sms !== "string") {
        setError(payload?.message || "The English text couldn't be written. Try again.");
        return;
      }
      setDraft(payload.sms);
      setReady(true);
    } catch {
      setError("The English text couldn't be written. Try again.");
    } finally {
      setPending(false);
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

  const messagesHref = draft.trim() ? smsBodyHref(draft.trim()) : "";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="customer-message" className="text-sm font-medium text-slate-800">
            Customer message
          </label>
          <button
            type="button"
            onClick={() => void paste()}
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
          className={fieldClass}
        />
        {pasteNote ? (
          <p role="status" className="mt-1 text-sm text-slate-600">
            {pasteNote}
          </p>
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
            <button
              key={id}
              type="button"
              aria-pressed={brand === id}
              onClick={() => chooseBrand(id)}
              className={brandClass(brand === id)}
            >
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
          className={fieldClass}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void write()}
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-navy px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Writing…" : "Write English"}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="flex min-h-12 items-center justify-center rounded-xl border border-brand-navy bg-white px-3 text-sm font-semibold text-brand-navy"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {messagesHref ? (
              <a
                href={messagesHref}
                className="flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-3 text-center text-sm font-semibold text-white"
              >
                Open in Messages
              </a>
            ) : (
              <span className="flex min-h-12 items-center justify-center rounded-xl bg-slate-200 px-3 text-center text-sm font-semibold text-slate-500">
                Open in Messages
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void write()}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Regenerate
          </button>
          <p className="text-sm text-slate-600">Nothing is sent. Copy it or open Messages, then send it yourself.</p>
        </section>
      ) : null}
    </div>
  );
}
