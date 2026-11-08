import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og-card";

export const alt = "ORO Services, parent of Emoro Building and Emporo Plumbing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<OgCard />, { ...size });
}
