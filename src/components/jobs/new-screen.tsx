"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobsClientError, postJobsForm } from "@/components/jobs/api";
import { compressFiles } from "@/components/jobs/resize-image";
import { Alert, BackLink, JobsButton, JobsLink, Screen, Spinner } from "@/components/jobs/ui";
import { keptCount, NEW_JOB_MAX_EDGE, NEW_JOB_MAX_IMAGES, NEW_JOB_QUALITIES } from "@/lib/jobs-app/photos";
import { businessLabel, isBusiness, type Business, type NewJobResult } from "@/lib/jobs-app/types";

function created(value: boolean | null): string {
  if (value === true) return "新建";
  if (value === false) return "已有";
  return "—";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NewJobResult | null>(null);
  const router = useRouter();

  async function submit() {
    if (!isBusiness(business)) {
      setError("请选择 Emoro 还是 Emporo。");
      return;
    }
    if (files.length === 0) {
      setError("请选择截图。");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const compressed = await compressFiles(files.slice(0, NEW_JOB_MAX_IMAGES), NEW_JOB_MAX_EDGE, NEW_JOB_QUALITIES);
      const count = keptCount(compressed.map((file) => file.size));
      if (count === 0 || count < compressed.length) {
        setError("照片太大，请少选几张。");
        setBusy(false);
        return;
      }
      const form = new FormData();
      form.set("business", business);
      for (const file of compressed) form.append("images", file);
      setResult(await postJobsForm<NewJobResult>("/jobs/api/new", form));
    } catch (reason) {
      if (reason instanceof JobsClientError && reason.status === 401) {
        router.push("/jobs/login");
        return;
      }
      setError(reason instanceof JobsClientError ? reason.message : "这张截图没法压缩，请换一张 JPEG。");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const tenant = [result.tenant1, result.phone1, result.email1].filter(Boolean).join(" ");
    const tenant2 = [result.tenant2, result.phone2].filter(Boolean).join(" ");
    const pm = [result.pmName, result.pmAgency, result.pmEmail, result.pmPhone].filter(Boolean).join(" / ");
    return (
      <Screen title="新工单" back={<BackLink href="/jobs" />}>
        <p className="text-lg font-semibold">新工单已建</p>
        <Line label="标题" value={result.jobTitle} />
        <Line label="公司" value={result.brand} />
        <Line label="地址" value={result.address} />
        <Line label="租客" value={tenant} />
        <Line label="第二租客" value={tenant2} />
        <Line label="PM" value={pm} />
        <Line label="PM 工单号" value={result.workOrderNumber} />
        <Line label="问题" value={result.description} />
        <p className="text-base">
          新建了：房产 {created(result.propertyCreated)} · 客户 {created(result.customerCreated)} · 联系人 {created(result.contact1Created)}
        </p>
        {result.jobUrl ? (
          <JobsLink href={result.jobUrl} variant="outline">
            在 Notion 中打开
          </JobsLink>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen title="新工单" back={<BackLink href="/jobs" />}>
      {error ? <Alert>{error}</Alert> : null}
      {busy ? <Spinner label="正在读取截图，大约 10 秒" /> : null}
      {busy ? null : (
        <>
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
            选择截图
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
          <p className="text-base">{files.length > 0 ? `已选 ${files.length} 张，最多 ${NEW_JOB_MAX_IMAGES} 张` : `最多 ${NEW_JOB_MAX_IMAGES} 张截图`}</p>
          <JobsButton type="button" onClick={submit}>
            建立工单
          </JobsButton>
        </>
      )}
    </Screen>
  );
}
