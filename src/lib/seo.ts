import type { Metadata } from "next";
import { siteName, siteUrl } from "@/lib/content";

const shareImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "ORO Services, parent of Emoro Building and Emporo Plumbing",
};

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
};

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${siteName}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: path,
      siteName,
      title: fullTitle,
      description,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [shareImage],
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ORO Services | Building and plumbing",
    template: `%s | ${siteName}`,
  },
  description:
    "ORO Services is the parent of Emoro Building and Emporo Plumbing. Construction, renovations, fit-outs, plumbing, water and gas, taps and toilets, pipe relining, and drainage.",
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName,
    url: siteUrl,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [shareImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};
