"use client";

import Image from "next/image";
import Link from "next/link";
import { useClientReady } from "@/components/jobs/client-ready";
import { Screen } from "@/components/jobs/ui";
import { businessLabel } from "@/lib/jobs-app/types";
import { formatMelbourne, loadVisit } from "@/lib/jobs-app/visit";

export function HomeScreen() {
  const ready = useClientReady();
  const visit = ready ? loadVisit() : null;

  return (
    <Screen
      title="Jobs"
      action={
        <form action="/jobs/api/logout" method="post">
          <button type="submit" className="min-h-11 text-base font-semibold underline">
            Sign out
          </button>
        </form>
      }
    >
      <div className="flex items-center gap-3">
        <Image src="/jobs/icons/apple-touch-icon.png" alt="" width={48} height={48} preload className="h-12 w-12" />
        <p className="text-lg font-semibold">ORO Jobs</p>
      </div>
      {visit ? (
        <section className="rounded-2xl border border-black px-4 py-4">
          <p className="text-sm">In progress</p>
          <p className="mt-1 text-lg font-semibold">{visit.title}</p>
          <p className="mt-1 text-base">{visit.address}</p>
          <p className="mt-2 text-sm">
            {businessLabel(visit.business)}
            {visit.departedAt ? ` · ${formatMelbourne(visit.departedAt)}` : ""}
          </p>
        </section>
      ) : null}
      <div className="mt-2 flex flex-col gap-3">
        <Link href="/jobs/depart" className="flex min-h-16 items-center justify-center rounded-2xl bg-black text-xl font-semibold text-white">
          Depart
        </Link>
        <Link href="/jobs/leave" className="flex min-h-16 items-center justify-center rounded-2xl bg-black text-xl font-semibold text-white">
          Leave
        </Link>
        <Link href="/jobs/new" className="flex min-h-16 items-center justify-center rounded-2xl bg-black text-xl font-semibold text-white">
          New job
        </Link>
      </div>
    </Screen>
  );
}
