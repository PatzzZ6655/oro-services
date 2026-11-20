import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "ORO 工单", template: "%s · ORO 工单" },
  applicationName: "ORO 工单",
  description: "ORO Services field jobs",
  robots: { index: false, follow: false, nocache: true },
  manifest: "/jobs/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ORO 工单",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/jobs/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/jobs/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/jobs/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="zh-Hans" className="min-h-dvh bg-white text-black">
      {children}
    </div>
  );
}
