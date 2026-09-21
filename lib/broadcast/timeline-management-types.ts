import type { PublicVodTimeline } from "@/lib/domain/schedule-types";

export type TimelineManagementRow = {
  titleNo: number;
  title: string;
  day: string;
  pinnedKey: string | null;
  representativeKey: string | null;
  candidates: {
    key: string;
    authorNick: string;
    entries: PublicVodTimeline["entries"];
    reason: string;
    eligible: boolean;
    present: boolean;
    visibility: "auto" | "show" | "hide";
    sourceCount: number;
  }[];
};
export type TimelineModerationAction = "pin" | "automatic" | "show" | "hide" | "auto";
