import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Authed } from "@/app/jobs/authed";
import { PhotosScreen } from "@/components/jobs/photos-screen";
import { Screen, Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = {
  title: "Photos",
  applicationName: "ORO Photos",
  robots: { index: false, follow: false },
  manifest: "/jobs/photos/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ORO Photos", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/jobs/photos/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/jobs/photos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/jobs/photos/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Page() {
  return (
    <Suspense fallback={<Screen title="Photos"><Spinner label="Opening" /></Screen>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await connection();
  return (
    <Authed>
      <PhotosScreen />
    </Authed>
  );
}
