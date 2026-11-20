"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useClientReady } from "@/components/jobs/client-ready";
import { downloadText } from "@/components/jobs/download";
import { JobsButton } from "@/components/jobs/ui";
import { formatPhone, normalizePhone } from "@/lib/jobs-app/phones";
import { sharedSms, smsHref, tenantSms, type SmsContact } from "@/lib/jobs-app/sms";
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
}: {
  jobId: string;
  contacts: Contact[];
  topSms: string;
  address: string;
  jobTitle: string;
  allowManual: boolean;
  verbatim?: boolean;
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
      setManualError("请输入澳大利亚号码，例如 0412 345 678");
      return;
    }
    if (recipients.some((recipient) => recipient.phone === phone)) {
      setManualError("这个号码已经在列表里");
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
  const body = ticked ? (verbatim ? tenantSms(topSms, recipients, ticked) : sharedSms(topSms, recipients, ticked)) : "";
  const link = body ? smsHref(selected.map((recipient) => recipient.phone), body) : null;

  function remember() {
    if (!ticked) return;
    persist(ticked, recipients.map((recipient) => recipient.phone));
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">发给谁</h2>
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
                  保存到通讯录
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>正在读取号码</p>
      )}
      {recipients.length > 1 ? (
        <button type="button" className="min-h-11 self-start text-base font-semibold underline" onClick={saveAll}>
          全部保存到通讯录
        </button>
      ) : null}
      {allowManual && contacts.length === 0 ? (
        <form onSubmit={addNumber} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            aria-label="电话号码"
            placeholder="0412 345 678"
            className="min-h-14 w-full rounded-2xl border border-black px-4 text-lg"
          />
          <button type="submit" className="min-h-14 shrink-0 rounded-2xl border border-black px-4 text-lg font-semibold">
            添加
          </button>
        </form>
      ) : null}
      {manualError ? (
        <p role="alert" className="text-base">
          {manualError}
        </p>
      ) : null}
      {body ? <p className="whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-3 text-base">{body}</p> : null}
      {selected.length > 1 ? <p className="text-base">一条短信发给 {selected.length} 人，回复在同一个对话里。</p> : null}
      {link ? (
        <a href={link.href} onClick={remember} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-black px-4 text-lg font-semibold text-white">
          发送短信
        </a>
      ) : (
        <JobsButton type="button" disabled>
          发送短信
        </JobsButton>
      )}
      <p className="text-center text-sm">会打开「信息」，你看过再发送。</p>
      {link?.fallback ? (
        <a href={link.fallback} onClick={remember} className="text-center text-base font-semibold underline">
          打不开群发时用这个
        </a>
      ) : null}
    </section>
  );
}
