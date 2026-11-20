"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobsForm } from "@/components/jobs/api";
import { useClientReady } from "@/components/jobs/client-ready";
import { compressFiles } from "@/components/jobs/resize-image";
import { SmsPicker } from "@/components/jobs/sms-picker";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner, fieldClass } from "@/components/jobs/ui";
import { OPTIONAL_ITEMS, REQUIRED_ITEMS, checklistText } from "@/lib/jobs-app/checklist";
import { keptCount, LEAVE_MAX_EDGE, LEAVE_QUALITIES } from "@/lib/jobs-app/photos";
import type { LeaveResult } from "@/lib/jobs-app/types";
import { clearVisit, loadVisit, type ActiveVisit } from "@/lib/jobs-app/visit";

type Step = "checklist" | "outcome" | "details";

export function LeaveScreen() {
  const router = useRouter();
  const ready = useClientReady();
  const visit = ready ? loadVisit() : null;
  const [checked, setChecked] = useState<string[]>([]);
  const [warn, setWarn] = useState(false);
  const [step, setStep] = useState<Step>("checklist");
  const [outcome, setOutcome] = useState<"return" | "complete" | null>(null);
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drop, setDrop] = useState<{ kept: File[]; dropped: number } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<LeaveResult | null>(null);
  const [finished, setFinished] = useState<ActiveVisit | null>(null);
  const current = finished ?? visit;

  if (!ready) return <Screen title="离开"><Spinner label="正在打开" /></Screen>;

  if (result && current) {
    return (
      <Screen title="离开" back={<BackLink href="/jobs" />}>
        <p className="whitespace-pre-wrap text-lg">{result.summary || "已记录离开。"}</p>
        {result.driveLink ? (
          <JobsLink href={result.driveLink} variant="outline">
            打开照片文件夹
          </JobsLink>
        ) : null}
        {result.outcome === "complete" ? (
          <p className="text-base">{result.pmEmailedTo ? `完工邮件已发给：${result.pmEmailedTo}` : "完工邮件没有收件人。"}</p>
        ) : null}
        <SmsPicker
          jobId={current.jobId}
          contacts={result.contacts}
          topSms={result.sms}
          address={result.address || current.address}
          jobTitle={result.jobTitle || current.title}
          allowManual={result.contacts.length === 0}
        />
        <JobsButton
          type="button"
          variant="outline"
          onClick={() => {
            router.push("/jobs");
            router.refresh();
          }}
        >
          完成
        </JobsButton>
      </Screen>
    );
  }

  if (!visit || blocked) {
    return (
      <Screen title="离开" back={<BackLink href="/jobs" />}>
        <Alert>
          {blocked ? "这个工单没有未离开的到访。请先点" : "请先点"}
          <span className="whitespace-nowrap">「出发」</span>。
        </Alert>
        {blocked ? (
          <JobsButton
            type="button"
            onClick={() => {
              clearVisit();
              router.push("/jobs");
              router.refresh();
            }}
          >
            清除出发记录
          </JobsButton>
        ) : (
          <Link href="/jobs/depart" className="flex min-h-14 items-center justify-center rounded-2xl bg-black text-lg font-semibold text-white">
            去出发
          </Link>
        )}
      </Screen>
    );
  }

  const selected = new Set(checked);
  const review = checklistText(selected);

  function toggle(item: string) {
    setChecked((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  }

  async function send(files: File[]) {
    setDrop(null);
    setBusy("正在提交");
    setError("");
    const form = new FormData();
    form.set("business", visit?.business ?? "");
    form.set("jobId", visit?.jobId ?? "");
    form.set("outcome", outcome ?? "");
    form.set("notes", notes);
    form.set("issues", issues);
    form.set("checklist", review.text);
    for (const file of files) form.append("photos", file);
    try {
      const next = await postJobsForm<LeaveResult>("/jobs/api/leave", form);
      if (visit) setFinished(visit);
      clearVisit();
      setResult(next);
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      if (reason instanceof JobsClientError && reason.code === "no_open_visit") {
        setBlocked(true);
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "服务器没有返回内容。请稍后再试。");
    } finally {
      setBusy("");
    }
  }

  async function submit(allowDrop: boolean) {
    setError("");
    setDrop(null);
    if (!outcome) return;
    try {
      setBusy("正在压缩照片");
      const compressed = photos.length > 0 ? await compressFiles(photos, LEAVE_MAX_EDGE, LEAVE_QUALITIES) : [];
      const count = keptCount(compressed.map((file) => file.size));
      if (photos.length > 0 && count === 0) {
        setError("照片太大，请少选几张。");
        setBusy("");
        return;
      }
      if (count < compressed.length && !allowDrop) {
        setDrop({ kept: compressed.slice(0, count), dropped: compressed.length - count });
        setBusy("");
        return;
      }
      await send(compressed.slice(0, count));
    } catch {
      setBusy("");
      setError("这张照片没法压缩，请换一张 JPEG。");
    }
  }

  return (
    <Screen
      title="离开"
      back={
        step === "checklist" ? (
          <BackLink href="/jobs" />
        ) : (
          <button type="button" className="min-h-11 text-base font-semibold underline" onClick={() => setStep(step === "details" ? "outcome" : "checklist")}>
            返回
          </button>
        )
      }
    >
      <p className="text-lg font-semibold">{visit.title}</p>
      <p className="text-base">{visit.address}</p>
      {error ? <Alert>{error}</Alert> : null}
      {busy ? <Spinner label={busy} /> : null}

      {step === "checklist" && !busy ? (
        <div className="flex flex-col gap-3">
          <p>离开前确认。没做到的不要勾。</p>
          <ul className="flex flex-col gap-2">
            {REQUIRED_ITEMS.map((item) => (
              <li key={item}>
                <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-black px-3">
                  <input type="checkbox" className="h-6 w-6 accent-black" checked={selected.has(item)} onChange={() => toggle(item)} />
                  <span className="text-base">{item}</span>
                </label>
              </li>
            ))}
            {OPTIONAL_ITEMS.map((item) => (
              <li key={item}>
                <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-300 px-3">
                  <input type="checkbox" className="h-6 w-6 accent-black" checked={selected.has(item)} onChange={() => toggle(item)} />
                  <span className="text-base">
                    {item}
                    <span className="mt-1 block text-sm text-neutral-600">可选，不勾也不算缺</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <JobsButton
            type="button"
            onClick={() => {
              if (review.missing.length > 0) setWarn(true);
              else setStep("outcome");
            }}
          >
            下一步
          </JobsButton>
        </div>
      ) : null}

      {step === "outcome" && !busy ? (
        <div className="flex flex-col gap-3">
          <p>本次结束</p>
          <JobsButton type="button" onClick={() => { setOutcome("return"); setStep("details"); }}>
            还要再来
          </JobsButton>
          <JobsButton type="button" variant="outline" onClick={() => { setOutcome("complete"); setStep("details"); }}>
            整单完工
          </JobsButton>
          <p className="text-sm">整单完工会给中介发邮件。还要再来不会。</p>
        </div>
      ) : null}

      {step === "details" && !busy ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-base">
            备注（可选，可用键盘听写）
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${fieldClass} py-3`} />
          </label>
          <label className="flex flex-col gap-2 text-base">
            发现的其他问题（可选，只记到 Notion，不会写进短信，也不会发给中介）
            <textarea value={issues} onChange={(event) => setIssues(event.target.value)} rows={3} className={`${fieldClass} py-3`} />
          </label>
          <label className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-black text-lg font-semibold">
            选择照片
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                setPhotos([...(event.target.files ?? [])]);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {photos.length > 0 ? <p>已选 {photos.length} 张</p> : <p>可以不选照片。</p>}
          <JobsButton type="button" onClick={() => submit(false)}>
            提交
          </JobsButton>
        </div>
      ) : null}

      {warn ? (
        <div role="alertdialog" aria-labelledby="missing-title" className="fixed inset-0 z-20 flex items-end bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-white p-4">
            <h2 id="missing-title" className="text-lg font-semibold">这些还没确认</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {review.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3">
              <JobsButton type="button" onClick={() => setWarn(false)}>
                返回补做
              </JobsButton>
              <JobsButton
                type="button"
                variant="outline"
                onClick={() => {
                  setWarn(false);
                  setStep("outcome");
                }}
              >
                仍然继续
              </JobsButton>
            </div>
          </div>
        </div>
      ) : null}

      {drop ? (
        <div role="alertdialog" aria-labelledby="drop-title" className="fixed inset-0 z-20 flex items-end bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-white p-4">
            <h2 id="drop-title" className="text-lg font-semibold">有 {drop.dropped} 张放不下</h2>
            <p className="mt-2 text-base">单次大约 4 MB。可以只上传前面的 {drop.kept.length} 张。</p>
            <div className="mt-4 flex flex-col gap-3">
              <JobsButton type="button" variant="outline" onClick={() => setDrop(null)}>
                返回重选
              </JobsButton>
              <JobsButton type="button" onClick={() => send(drop.kept)}>
                只上传前 {drop.kept.length} 张
              </JobsButton>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
