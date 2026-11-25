import type { Metadata } from "next";
import { Suspense } from "react";
import { Authed } from "@/app/jobs/authed";
import { NoteScreen } from "@/components/jobs/note-screen";
import { Spinner } from "@/components/jobs/ui";

export const metadata: Metadata = {
  title: "随手记",
  applicationName: "随手记",
  robots: { index: false, follow: false },
  manifest: "/jobs/note/manifest.webmanifest",
  appleWebApp: { capable: true, title: "随手记", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/jobs/note/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/jobs/note/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/jobs/note/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Page() {
  return (
    <Suspense fallback={<Spinner label="Opening" />}>
      <Authed>
        <NoteScreen />
      </Authed>
    </Suspense>
  );
}
