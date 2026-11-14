import { connection } from "next/server";
import { finishGoogleSignIn } from "@/lib/auth/google";

export async function GET(request: Request) {
  await connection();
  return finishGoogleSignIn(request);
}
