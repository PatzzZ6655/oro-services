import { connection } from "next/server";
import { beginGoogleSignIn } from "@/lib/auth/google";

export async function GET(request: Request) {
  await connection();
  return beginGoogleSignIn(request);
}
