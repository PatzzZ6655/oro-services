import { connection, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/auth/google";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  await connection();
  const origin = publicOrigin(request);
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new Response("Bad origin", { status: 403 });
  }
  const response = NextResponse.redirect(new URL("/internal/login", origin), 303);
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
