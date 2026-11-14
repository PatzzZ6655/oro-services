import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE, readSession, type StaffSession } from "@/lib/auth/session";

export async function currentUser(): Promise<StaffSession | null> {
  // Session expiry uses the current time. Read it only after the request is live.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSession(token);
}

export async function requireUser(): Promise<StaffSession> {
  const user = await currentUser();
  if (!user) redirect("/internal/login");
  return user;
}
