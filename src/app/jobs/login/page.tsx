import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/jobs/login-form";
import { Spinner } from "@/components/jobs/ui";
import { JOBS_COOKIE, readJobsSession } from "@/lib/jobs-app/session";

export const metadata: Metadata = { title: "登录" };

export default function Page() {
  return (
    <Suspense fallback={<Spinner label="正在打开" />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await connection();
  const token = (await cookies()).get(JOBS_COOKIE)?.value;
  if (await readJobsSession(token)) redirect("/jobs");
  return <LoginForm />;
}
