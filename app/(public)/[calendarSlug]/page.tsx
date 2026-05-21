import { PublicPoster } from "@/components/poster/public-poster";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

type PublicPosterPageProps = {
  params: Promise<{
    calendarSlug: string;
  }>;
};

export default async function PublicPosterPage({
  params
}: PublicPosterPageProps) {
  const { calendarSlug } = await params;
  const schedule = await getPublicSchedule(calendarSlug);

  return <PublicPoster schedule={schedule} />;
}
