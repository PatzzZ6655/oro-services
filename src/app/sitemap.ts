import type { MetadataRoute } from "next";
import { absoluteUrl, indexablePaths } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  // Staff pages under /internal are not public. The stock dashboard is a different host.
  return indexablePaths().map((entry) => ({
    url: absoluteUrl(entry.path),
    priority: entry.priority,
  }));
}
