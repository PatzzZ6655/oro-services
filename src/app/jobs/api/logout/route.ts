import { logoutResponse } from "@/lib/jobs-app/logout";

export async function POST(request: Request) {
  return logoutResponse(request);
}
