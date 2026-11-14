"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { copyLast, createJob, databaseConfigured, markJob } from "@/lib/jobs/db";

export async function copyLastAnswers(jobId: string, formType: string, address: string): Promise<Record<string, string> | null> {
  await requireUser();
  if (!databaseConfigured() || !jobId) return null;
  return copyLast(jobId, formType, address);
}

export async function createJobAction(_previous: { error: string }, formData: FormData): Promise<{ error: string }> {
  const user = await requireUser();
  if (!databaseConfigured()) return { error: "Jobs database not connected" };
  const company = formData.get("company");
  const clientName = String(formData.get("clientName") ?? "").replace(/\s+/g, " ").trim();
  const address = String(formData.get("address") ?? "").replace(/\s+/g, " ").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (company !== "emoro" && company !== "emporo") return { error: "Choose the company." };
  if (clientName.length < 2) return { error: "Enter the client." };
  if (address.length < 5) return { error: "Enter the address, including the suburb." };
  const job = await createJob({ company, clientName, phone, email, address, createdBy: user.email });
  redirect(`/internal/jobs/${job.id}`);
}

export async function setJobStatusAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "complete" ? "complete" : "open";
  if (id && databaseConfigured()) await markJob(id, status);
  redirect(`/internal/jobs/${id}`);
}
