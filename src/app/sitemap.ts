import type { MetadataRoute } from "next";
import { absoluteUrl, indexablePaths } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  // Staff pages under /internal and the field app under /jobs are not public.
  return indexablePaths().map((entry) => ({
    url: absoluteUrl(entry.path),
    priority: entry.priority,
  }));
}
