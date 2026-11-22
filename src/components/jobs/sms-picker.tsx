"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useClientReady } from "@/components/jobs/client-ready";
import { downloadText } from "@/components/jobs/download";
import { JobsButton } from "@/components/jobs/ui";
import { formatPhone, normalizePhone } from "@/lib/jobs-app/phones";
import { nextVisitBody } from "@/lib/jobs-app/next-visit";
import { messageBody, sharedSms, smsHref, tenantSms, type SmsContact } from "@/lib/jobs-app/sms";
import { browserSmsMemory, rememberSelection, tickedFromMemory } from "@/lib/jobs-app/sms-memory";
import type { Contact } from "@/lib/jobs-app/types";
import { buildVCard, buildVCardFile } from "@/lib/jobs-app/vcf";

export function SmsPicker({
  jobId,
  contacts,
  topSms,
  address,
  jobTitle,
  allowManual,
  verbatim = false,
  nextVisit = null,
}: {
  jobId: string;
  contacts: Contact[];
  topSms: string;
  address: string;
  jobTitle: string;
  allowManual: boolean;
  verbatim?: boolean;
  nextVisit?: {
    brand: string;
    address: string;
    date: string;
    time: string;
    onDate: (value: string) => void;
    onTime: (value: string) => void;
  } | null;
}) {
  const [manual, setManual] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [manualError, setManualError] = useState("");
  const ready = useClientReady();
  const [override, setOverride] = useState<{ key: string; ticked: string[] } | null>(null);
  const recipients = useMemo<SmsContact[]>(() => {
    const listed = contacts.flatMap((contact) => {
      const phone = normalizePhone(contact.phone);
      if (!phone) return [];
      return [{ ...contact, phone }];
    });
    const extras = manual
      .filter((phone) => !listed.some((contact) => contact.phone === phone))
      .map((phone) => ({ name: "", phone, sms: "" }));
    return [...listed, ...extras];
  }, [contacts, manual]);
  const phonesKey = recipients.map((recipient) => recipient.phone).join("\n");
  const selectionKey = `${jobId}\n${phonesKey}`;
  const phones = recipients.map((recipient) => recipient.phone);
  const remembered = ready ? tickedFromMemory(browserSmsMemory() ?? { read: () => ({}), write: () => {} }, jobId, phones) : null;
  const ticked = override?.key === selectionKey ? override.ticked : remembered;

  function persist(next: string[], phones: string[]) {
    const store = browserSmsMemory();
    if (store) rememberSelection(store, jobId, phones, next);
  }

  function toggle(phone: string) {
    const base = ticked ?? phones;
    const next = base.includes(phone) ? base.filter((item) => item !== phone) : [...base, phone];
    persist(next, phones);
    setOverride({ key: selectionKey, ticked: next });
  }

  function addNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = normalizePhone(draft);
    if (!phone) {
      setManualError("Enter an Australian number, for example 0412 345 678");
      return;
    }
    if (recipients.some((recipient) => recipient.phone === phone)) {
      setManualError("That number is already listed");
      return;
    }
    const nextPhones = [...phones, phone];
    const next = [...(ticked ?? []), phone];
    persist(next, nextPhones);
    setManual((current) => [...current, phone]);
    setOverride({ key: `${jobId}\n${nextPhones.join("\n")}`, ticked: next });
    setDraft("");
    setManualError("");
  }

  function saveOne(recipient: SmsContact) {
    downloadText(
      "tenant.vcf",
      "text/vcard;charset=utf-8",
      buildVCard({ name: recipient.name, phone: recipient.phone, address, jobTitle, jobId }),
    );
  }

  function saveAll() {
    downloadText(
      "tenants.vcf",
      "text/vcard;charset=utf-8",
      buildVCardFile(recipients.map((recipient) => ({ name: recipient.name, phone: recipient.phone, address, jobTitle, jobId }))),
    );
  }

  const selected = recipients.filter((recipient) => ticked?.includes(recipient.phone));
  const scheduled = !verbatim && nextVisit ? nextVisitBody(nextVisit) : null;
  const body = !ticked
    ? ""
    : scheduled
      ? messageBody(scheduled, selected.map((recipient) => recipient.name), selected.length)
      : verbatim
        ? tenantSms(topSms, recipients, ticked)
        : sharedSms(topSms, recipients, ticked);
  const link = body ? smsHref(selected.map((recipient) => recipient.phone), body) : null;

  function remember() {
    if (!ticked) return;
    persist(ticked, recipients.map((recipient) => recipient.phone));
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Send to</h2>
      {ticked ? (
        <ul>
          {recipients.map((recipient) => {
            const on = ticked.includes(recipient.phone);
            return (
              <li key={recipient.phone} className="border-b border-neutral-200 py-3">
                <label className="flex min-h-12 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-6 w-6 accent-black"
                    checked={on}
                    onChange={() => toggle(recipient.phone)}
                  />
                  <span className="text-lg font-semibold">{recipient.name || formatPhone(recipient.phone)}</span>
                </label>
                {recipient.name ? <p className="pl-9 text-base">{formatPhone(recipient.phone)}</p> : null}
                <button type="button" className="mt-1 min-h-11 pl-9 text-base font-semibold underline" onClick={() => saveOne(recipient)}>
                  Save to contacts
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Loading numbers</p>
      )}
      {recipients.length > 1 ? (
        <button type="button" className="min-h-11 self-start text-base font-semibold underline" onClick={saveAll}>
          Save all to contacts
        </button>
      ) : null}
      {allowManual && contacts.length === 0 ? (
        <form onSubmit={addNumber} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            aria-label="Phone number"
            placeholder="0412 345 678"
            className="min-h-14 w-full rounded-2xl border border-black px-4 text-lg"
          />
          <button type="submit" className="min-h-14 shrink-0 rounded-2xl border border-black px-4 text-lg font-semibold">
            Add
          </button>
        </form>
      ) : null}
      {manualError ? (
        <p role="alert" className="text-base">
          {manualError}
        </p>
      ) : null}
      {nextVisit ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-base">
            Next visit date
            <input type="date" value={nextVisit.date} onChange={(event) => nextVisit.onDate(event.target.value)} className="min-h-14 w-full rounded-2xl border border-black bg-white px-4 text-lg text-black" />
          </label>
          <label className="flex flex-col gap-2 text-base">
            Next visit time
            <input type="time" value={nextVisit.time} onChange={(event) => nextVisit.onTime(event.target.value)} className="min-h-14 w-full rounded-2xl border border-black bg-white px-4 text-lg text-black" />
          </label>
        </div>
      ) : null}
      {body ? <p className="whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-3 text-base">{body}</p> : null}
      {selected.length > 1 ? <p className="text-base">One message to {selected.length} people, so replies stay in one thread.</p> : null}
      {link ? (
        <a href={link.href} onClick={remember} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-black px-4 text-lg font-semibold text-white">
          Send SMS
        </a>
      ) : (
        <JobsButton type="button" disabled>
          Send SMS
        </JobsButton>
      )}
      <p className="text-center text-sm">This opens Messages so you can review it before sending.</p>
      {link?.fallback ? (
        <a href={link.fallback} onClick={remember} className="text-center text-base font-semibold underline">
          If the group message does not open, use this
        </a>
      ) : null}
    </section>
  );
}
