import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current";
import { SmsReplyForm } from "@/components/internal/sms-reply-form";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";

export const metadata = { title: "SMS reply", robots: { index: false, follow: false } };

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
        Paste the customer&apos;s text, dictate what you want to say in Chinese, then send the English yourself.
      </p>
      <div className="mt-4">
        <SmsReplyForm />
      </div>
    </PortalFrame>
  );
}
