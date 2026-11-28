import { Authed } from "@/app/jobs/authed";
import { JobRecordScreen } from "@/components/jobs/job-record-screen";
import { isBusiness } from "@/lib/jobs-app/types";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ business?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const business = isBusiness(query.business) ? query.business : "emoro";
  return (
    <Authed>
      <JobRecordScreen id={id} business={business} />
    </Authed>
  );
}
