import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

export type TeaserStateEntry = {
  id: string;
  dateKey: string;
  revealAt: string | null;
  state: "masked" | "released";
  event: PublicScheduleEvent;
};
export type TeaserStateSnapshot = {
  ok: boolean;
  schemaVersion: 1;
  sampledAtDbMs: number;
  clockSkewMs?: number;
  clockUncertaintyMs?: number;
  entries: TeaserStateEntry[];
};
export const emptyTeaserState = (): TeaserStateSnapshot => ({ ok: false, schemaVersion: 1, sampledAtDbMs: 0, entries: [] });
