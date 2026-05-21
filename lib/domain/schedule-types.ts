export const PRODUCT_TIMEZONE = "Asia/Seoul" as const;

export type MembershipRole = "owner" | "trusted_member" | "viewer";

export type EventStatus = "draft" | "scheduled" | "live" | "done" | "cancelled";

export type PublicScheduleEvent = {
  id: string;
  startsAt: string;
  endsAt: string;
  publicTitle: string;
  publicDescription?: string;
  status: Exclude<EventStatus, "draft">;
  category: "stream" | "collab" | "notice" | "support";
  variantGroupId?: string;
  variantLabel?: string;
};

export type PrivateEventMeta = {
  eventId: string;
  privateTitle?: string;
  privateNotes?: string;
  codename?: string;
  embargoUntil?: string;
  editorNote?: string;
  workState?: "idea" | "waiting" | "confirmed" | "blocked";
};

export type StudioScheduleEvent = Omit<PublicScheduleEvent, "status"> & {
  status: EventStatus;
  privateMeta?: PrivateEventMeta;
};

export type PublicSchedule = {
  calendar: {
    slug: string;
    displayName: string;
    timezone: typeof PRODUCT_TIMEZONE;
    month: string;
  };
  events: PublicScheduleEvent[];
  supportCampaigns: Array<{
    id: string;
    label: string;
    url: string;
    startsOn: string;
    endsOn: string;
  }>;
};

export type StudioSchedule = Omit<PublicSchedule, "events"> & {
  viewerModePreview: PublicSchedule;
  events: StudioScheduleEvent[];
  proposals: Array<{
    id: string;
    type: "slot" | "content" | "collab";
    content: string;
    voteCount: number;
    state: "new" | "reviewing" | "accepted" | "rejected";
  }>;
  requests: Array<{
    id: string;
    source: "collab" | "sponsor" | "guest" | "manual";
    title: string;
    state: "new" | "triaged" | "scheduled" | "closed";
  }>;
};
