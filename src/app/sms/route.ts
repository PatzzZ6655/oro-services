import { connection } from "next/server";
import { smsLinkResponse } from "@/lib/sms-link";

export async function GET(request: Request): Promise<Response> {
  await connection();
  return smsLinkResponse(request.url);
}
