"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Alert, JobsButton, fieldClass } from "@/components/jobs/ui";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/jobs/api/login", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "密码不对");
        setPending(false);
        return;
      }
      router.push("/jobs");
      router.refresh();
    } catch {
      setError("网络不行，请再试一次。");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Image src="/jobs/icons/apple-touch-icon.png" alt="" width={48} height={48} preload className="h-12 w-12" />
        <h1 className="text-2xl font-semibold">ORO 工单</h1>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-base">
          密码
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
        </label>
        <JobsButton type="submit" disabled={pending}>
          {pending ? "正在进入" : "进入"}
        </JobsButton>
      </form>
    </main>
  );
}
