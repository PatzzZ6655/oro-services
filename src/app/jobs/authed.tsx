import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { JOBS_COOKIE, readJobsSession } from "@/lib/jobs-app/session";

export async function Authed({ children }: { children: ReactNode }) {
  await connection();
  const token = (await cookies()).get(JOBS_COOKIE)?.value;
  if (!(await readJobsSession(token))) redirect("/jobs/login");
  return children;
}
