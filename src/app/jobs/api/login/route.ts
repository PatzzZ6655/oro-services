import { attemptLogin } from "@/lib/jobs-app/login";

export async function POST(request: Request) {
  return attemptLogin(request);
}
