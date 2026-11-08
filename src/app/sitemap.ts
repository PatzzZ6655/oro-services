import type { MetadataRoute } from "next";
import { absoluteUrl, indexablePaths } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  // The internal dashboard is a different host and is intentionally omitted.
  return indexablePaths().map((entry) => ({
    url: absoluteUrl(entry.path),
    priority: entry.priority,
  }));
}
