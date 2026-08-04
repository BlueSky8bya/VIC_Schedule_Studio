"use client";

// P2-ARCH-1 2단계: 매니저·작업자 읽기전용 상세(구 renderReadonlyDetail)를 studio-shell에서
// 프리젠테이션 컴포넌트로 분리(동작·마크업·클래스 변화 0). 상태는 전부 props로 받는다.
// 권한 분기(canEditTagsThing/canEditSupportThing)는 호출부가 계산해 넘긴다 — 여기선 표시만.

import { ChevronRight } from "lucide-react";
import type {
  BroadcastTag,
  ColorPaletteEntry,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";
import { VISIBILITY_LABEL } from "@/lib/studio/editor-model";
import type { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { TagPicker } from "@/components/tags/tag-picker";

type Props = {
  selectedDate: string;
  selectedEvent: StudioScheduleEvent | null;
  canEditTagsThing: boolean;
  canEditSupportThing: boolean;
  maxEventTags: number;
  palette: ColorPaletteEntry[];
  viewTags: BroadcastTag[];
  legendTags: BroadcastTag[];
  tagVisual: ReturnType<typeof createTagVisualResolver>;
  onClose: () => void;
  onToggleTag: (event: StudioScheduleEvent, tagId: string) => void;
  onOpenSupportSheet: (event: StudioScheduleEvent) => void;
};

export function ReadonlyEventDetail({
  selectedDate,
  selectedEvent,
  canEditTagsThing,
  canEditSupportThing,
  maxEventTags,
  palette,
  viewTags,
  legendTags,
  tagVisual,
  onClose,
  onToggleTag,
  onOpenSupportSheet
}: Props) {
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
             data-act="상세 카드 닫기">
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
          {canEditTagsThing ? (
            // 매니저: 태그 할당을 직접 토글. 작업자는 읽기 전용 칩만 본다.
            <div className="detail-row">
              <span className="detail-label">
                태그 <span className="tag-picker-hint">최대 {maxEventTags}개 · 누르면 바로 적용</span>
              </span>
              <div className="tag-picker">
                {/* 게이트는 좁게 — 태그 쓰기는 toggleEventTag가 일정별 직렬 체인 + 의도 ref +
                    중복 제거로 연타를 감당한다(전역 pending으로 막지 않는다). */}
                <TagPicker
                  max={maxEventTags}
                  onToggle={(id) => onToggleTag(selectedEvent, id)}
                  palette={palette}
                  selectedIds={selectedEvent.tagIds}
                  tags={viewTags}
                />
              </div>
            </div>
          ) : selectedEvent.tagIds.length > 0 ? (
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
          {selectedEvent.isSupport && canEditSupportThing ? (
            <button className="button" onClick={() => onOpenSupportSheet(selectedEvent)} type="button">
              업 도움 기간/링크 수정
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
