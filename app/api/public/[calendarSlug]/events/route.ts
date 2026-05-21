import { NextResponse } from "next/server";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

type PublicEventsRouteProps = {
  params: Promise<{
    calendarSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: PublicEventsRouteProps) {
  const { calendarSlug } = await params;
  const schedule = await getPublicSchedule(calendarSlug);

  return NextResponse.json(schedule);
}
