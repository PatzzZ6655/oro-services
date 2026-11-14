import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current";
import { PortalFallback, PortalFrame } from "@/components/internal/portal-frame";
import { TrainingRegister } from "@/components/internal/training-register";
import { melbourneToday } from "@/lib/appointments";
import { driveConfigured, listLicenceRecords } from "@/lib/reports/drive";

export const metadata = { title: "Training and licences", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <TrainingPage />
    </Suspense>
  );
}

async function TrainingPage() {
  const user = await requireUser();
  const records = driveConfigured() ? await listLicenceRecords().catch(() => []) : null;
  return (
    <PortalFrame email={user.email} name={user.name} showLogo={false}>
      <TrainingRegister records={records} today={melbourneToday()} />
    </PortalFrame>
  );
}
