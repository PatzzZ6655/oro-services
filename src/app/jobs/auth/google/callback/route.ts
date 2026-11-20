import { finishJobsGoogleSignIn } from "@/lib/jobs-app/google";

export async function GET(request: Request) {
  return finishJobsGoogleSignIn(request);
}
