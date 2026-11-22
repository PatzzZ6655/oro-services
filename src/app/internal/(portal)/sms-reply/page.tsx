import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current";
import { SmsReplyForm } from "@/components/internal/sms-reply-form";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";

export const metadata: Metadata = {
  title: "SMS reply",
  applicationName: "SMS",
  robots: { index: false, follow: false },
  manifest: "/internal/sms/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SMS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/internal/sms/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/internal/sms/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/internal/sms/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Page() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <SmsReplyPage />
    </Suspense>
  );
}

async function SmsReplyPage() {
  const user = await requireUser();
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      <h1 className="text-2xl font-semibold text-brand-navy">SMS reply</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Paste the customer&apos;s text or a screenshot, dictate what you want to say in Chinese, then send the English yourself.
      </p>
      <div className="mt-4">
        <SmsReplyForm />
      </div>
    </PortalFrame>
  );
}
