"use client";

// P2-ARCH-1 2단계: 읽기전용 일정 상세(구 renderReadonlyDetail)를 studio-shell에서 프리젠테이션
// 컴포넌트로 분리. 지금 이 카드를 보는 건 **개발자의 시청자 화면 미리보기**뿐이다(매니저·작업자 역할은
// 철수 — 2026-08-27 ADR-0015 / 2026-09-04 ADR-0018; 그때 있던 태그 토글·업 도움 수정 입구도 함께 뺐다).

import { ChevronRight } from "lucide-react";
import type {
  BroadcastTag,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";
import { VISIBILITY_LABEL } from "@/lib/studio/editor-model";
import type { createTagVisualResolver } from "@/lib/tags/tag-visual";

type Props = {
  selectedDate: string;
  selectedEvent: StudioScheduleEvent | null;
  legendTags: BroadcastTag[];
  tagVisual: ReturnType<typeof createTagVisualResolver>;
  onClose: () => void;
};

export function ReadonlyEventDetail({ selectedDate, selectedEvent, legendTags, tagVisual, onClose }: Props) {
  return (
    <div
      className="event-detail-readonly"
      key={`${selectedDate}:${selectedEvent?.id ?? "new"}`}
    >
      <div className="editor-heading">
        {/* 윗줄: 접기(>) 옆에 라벨. 읽기전용이라 저장 버튼은 없다. 날짜는 아래줄(라벨 밑 정렬). */}
        <div className="editor-heading-bar">
          <div className="editor-heading-left">
            <button
              aria-label="상세 카드 닫기"
              className="editor-collapse"
              onClick={onClose}
              title="닫기"
              type="button"
              data-act="상세 카드 닫기"
            >
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2.5} />
            </button>
            <p className="eyebrow">일정 보기</p>
          </div>
        </div>
        <h2 className="editor-date editor-heading-date" key={selectedDate}>
          {selectedDate}
        </h2>
      </div>
      {!selectedEvent ? (
        <p className="detail-empty">이 날의 일정을 누르면 자세히 볼 수 있어요.</p>
      ) : (
        <>
          <div className="detail-row">
            <span className="detail-label">제목</span>
            <p className="detail-value">{selectedEvent.publicTitle || "(제목 없음)"}</p>
          </div>
          <div className="detail-row">
            <span className="detail-label">공개 범위</span>
            <p className="detail-value">{VISIBILITY_LABEL[selectedEvent.visibilityScope]}</p>
          </div>
          {selectedEvent.tagIds.length > 0 ? (
            <div className="detail-row">
              <span className="detail-label">태그</span>
              <div className="detail-tags">
                {selectedEvent.tagIds.map((id) => {
                  const tag = legendTags.find((item) => item.id === id);
                  const v = tag ? tagVisual.visualOf(tag.id) : null;
                  return tag && v && !v.missing && v.bg ? (
                    <span
                      className="detail-tag"
                      key={id}
                      style={{
                        backgroundColor: v.bg,
                        borderColor: v.border ?? undefined,
                        color: v.legacyTextColor ?? undefined
                      }}
                    >
                      {tag.displayName}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          ) : null}
          {selectedEvent.isSupport ? (
            <div className="detail-row">
              <span className="detail-label">업 도와주기</span>
              <div className="detail-value">
                {selectedEvent.supportUrl ? (
                  <a href={selectedEvent.supportUrl} rel="noreferrer" target="_blank">
                    {selectedEvent.supportUrl}
                  </a>
                ) : (
                  "링크 없음"
                )}
                {selectedEvent.endDateKey ? (
                  <div className="detail-sub">~ {selectedEvent.endDateKey}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
