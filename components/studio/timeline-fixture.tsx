"use client";
import { useState } from "react";
import { VodChapters } from "@/components/poster/vod-chapters";
import { TimelineBoard } from "./timeline-board";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import type { TimelineManagementRow } from "@/lib/broadcast/timeline-management-types";

const rows: TimelineManagementRow[] = [{ titleNo: 42, title: "검증용 방송", day: "2020-01-01", pinnedKey: null, representativeKey: "root:1", candidates: [
  { key: "root:1", authorNick: "팬 하나", entries: [{ sec: 0, label: "시작", section: null }, { sec: 300, label: "게임", section: null }, { sec: 590, label: "마무리", section: null }], eligible: true, reason: "overview", present: true, visibility: "auto", sourceCount: 2 },
  { key: "root:2", authorNick: "팬 둘", entries: [{ sec: 10, label: "다른 시작", section: null }, { sec: 310, label: "전투", section: null }, { sec: 599, label: "끝", section: null }], eligible: true, reason: "overview", present: true, visibility: "auto", sourceCount: 1 },
  { key: "root:3", authorNick: "메모 작성자", entries: [{ sec: 120, label: "피드백", section: null }], eligible: false, reason: "feedback", present: true, visibility: "hide", sourceCount: 1 }
] }];
export function TimelineFixture() {
  const [jump, setJump] = useState<number | null>(null);
  return <><section style={{ width: "min(100%, var(--side-panel-w, 360px))", margin: "20px auto" }} aria-label="공개 타임라인">
    <VodChapters slug="fixture" titleNo={42} durationMs={600000} chapters={3} timelineBy="팬 하나" defaultOpen onJump={setJump} />
    <output aria-label="이동 시각">{jump}</output>
  </section><TimelineBoard rows={rows} /><section style={{ width: "min(100%, var(--side-panel-w, 360px))", margin: "20px auto" }} aria-label="개발자 접속 상태"><DeveloperPanel /></section></>;
}
