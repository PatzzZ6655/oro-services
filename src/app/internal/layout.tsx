import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Staff portal",
  applicationName: "ORO Staff",
  robots: { index: false, follow: false },
  manifest: "/internal/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ORO Staff",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/internal/icons/apple-touch-startup.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/internal/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/internal/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/internal/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  colorScheme: "light",
};

export default function InternalLayout({ children }: { children: ReactNode }) {
  return children;
}
