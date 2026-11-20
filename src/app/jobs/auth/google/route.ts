import { beginJobsGoogleSignIn } from "@/lib/jobs-app/google";

export async function GET(request: Request) {
  return beginJobsGoogleSignIn(request);
}
