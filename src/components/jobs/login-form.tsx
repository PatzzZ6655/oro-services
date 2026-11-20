import Image from "next/image";
import { JobsLink, Alert } from "@/components/jobs/ui";

const messages: Record<string, string> = {
  denied: "Not authorised. 这个 Google 账号没有权限。",
  state: "登录没有完成，请再试一次。",
  signin: "Google 没有完成登录，请再试一次。",
  unavailable: "登录还没配好。",
};

export function LoginScreen({ error, configured }: { error?: string; configured: boolean }) {
  const denied = error === "denied";
  const message = error ? messages[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Image src="/jobs/icons/apple-touch-icon.png" alt="" width={48} height={48} preload className="h-12 w-12" />
        <h1 className="text-2xl font-semibold">ORO 工单</h1>
      </div>
      {denied ? (
        <div role="alert">
          <h2 className="text-xl font-semibold">Not authorised</h2>
          <p className="mt-2 text-base">这个 Google 账号没有权限。</p>
        </div>
      ) : message ? (
        <Alert>{message}</Alert>
      ) : null}
      {configured ? (
        <JobsLink href="/jobs/auth/google">Sign in with Google</JobsLink>
      ) : (
        <p>登录还没配好。</p>
      )}
    </main>
  );
}
