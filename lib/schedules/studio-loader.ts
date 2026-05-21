import type { StudioSchedule } from "@/lib/domain/schedule-types";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

export async function getStudioSchedule(calendarSlug: string): Promise<StudioSchedule> {
  return {
    ...sampleStudioSchedule,
    viewerModePreview: await getPublicSchedule(calendarSlug)
  };
}
