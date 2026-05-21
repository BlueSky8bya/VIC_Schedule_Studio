import type {
  PublicSchedule,
  PublicScheduleEvent,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";

function toPublicEvent(event: StudioScheduleEvent): PublicScheduleEvent | null {
  if (event.status === "draft") {
    return null;
  }

  return {
    id: event.id,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    publicTitle: event.publicTitle,
    publicDescription: event.publicDescription,
    status: event.status,
    category: event.category,
    variantGroupId: event.variantGroupId,
    variantLabel: event.variantLabel
  };
}

export async function getPublicSchedule(calendarSlug: string): Promise<PublicSchedule> {
  const publicEvents =
    calendarSlug === sampleStudioSchedule.calendar.slug
      ? sampleStudioSchedule.events
          .map(toPublicEvent)
          .filter((event): event is PublicScheduleEvent => event !== null)
      : [];

  return {
    calendar: sampleStudioSchedule.calendar,
    events: publicEvents,
    supportCampaigns: sampleStudioSchedule.supportCampaigns
  };
}
