"use client";

// 웹은 조용한 역할/저장 시각 라벨, 모바일은 공용 설정 목록을 여는 역할 + 톱니 버튼.

import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import type { MembershipRole } from "@/lib/domain/schedule-types";

type RoleDisplay = { badgeLabel: string; label: string };

type Props = {
  role: MembershipRole; // 배지 색 클래스(actor.role — 미리보기와 무관하게 실제 역할)
  roleDisplay: RoleDisplay;
  open: boolean;
  onToggleOpen: () => void;
  // 설정 목록(모바일 전용 슬롯) — 웹은 도구 카드의 설정 팝오버로 옮겨 여기선 비운다.
  settings?: ReactNode;
  // 웹 헤더: 설정 팝오버 없이 역할 라벨만.
  quiet?: boolean;
  /**
   * 이 세션의 마지막 저장 시각(KST "HH:MM"). 있으면 **역할 이름 대신** 이 자리에 시각을 쓴다
   * (2026-09-05 소유자: 역할은 계정마다 하나뿐이라 늘 같은 글자였고, 방금 저장이 언제였는지가
   * 훨씬 자주 필요하다). 역할은 배지 색과 aria-label/title로 계속 남는다.
   */
  savedAt?: string | null;
};

// 팝오버 높이 상한 = 열린 자리에서 화면 바닥까지(2026-10-11 소유자: "설정창 스크롤이 안 내려가고 뒤 일정이 내려가").
// 레일은 아직 sticky로 붙기 전이면 더 아래에 있어(실측 top 176 vs 붙은 뒤 132) CSS 고정 값으론 바닥이 잘린다 —
// 열 때 실제 위치를 재서 CSS 변수로 넘긴다. 이후 스크롤로 레일이 위로 붙으면 공간이 늘 뿐이라 다시 잴 필요 없다.
// 하단 동작 줄(.m-actionrail)은 열려 있는 동안 숨으므로(studio-shell.css) 바닥은 화면 끝이다.
function capToViewport(el: HTMLDivElement | null) {
  if (!el) return;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  // 등장 애니메이션(translateY -12px) 중이라 자기 상자를 재면 12px 위로 잡힌다 — 부모 위치 + offsetTop(변형 무시)로.
  const parentTop = el.offsetParent?.getBoundingClientRect().top ?? 0;
  el.style.setProperty("--pop-max-h", `${Math.max(160, Math.floor(vh - (parentTop + el.offsetTop) - 12))}px`);
}

export function RoleBadge({ role, roleDisplay, open, onToggleOpen, settings, quiet = false, savedAt }: Props) {
  if (quiet) {
    return (
      <div className="actor-badge-wrap">
        <span
          aria-label={savedAt ? `${roleDisplay.label} · 마지막 저장 ${savedAt}` : `역할: ${roleDisplay.label}`}
          className={`actor-badge quiet ${role}${savedAt ? " saved-at" : ""}`}
          title={savedAt ? `${roleDisplay.label} · 마지막 저장 ${savedAt} KST` : roleDisplay.label}
        >
          <strong>{savedAt ?? roleDisplay.badgeLabel}</strong>
        </span>
      </div>
    );
  }
  return (
    <div className="actor-badge-wrap">
      {/* 배지 전체가 설정 토글. 기존 data-act는 분석 연속성을 위해 유지한다. */}
      <button
        aria-expanded={open}
        aria-label={`${roleDisplay.label} 설정`}
        className={`actor-badge ${role}`}
        onClick={onToggleOpen}
        type="button"
        data-act="역할 권한 보기"
      >
        <strong>{roleDisplay.badgeLabel}</strong>
        <span className="role-help-q" aria-hidden="true">
          <Settings size={15} strokeWidth={2} />
        </span>
      </button>
      {open ? (
        <div className="role-help-pop" role="dialog" aria-label="설정" ref={capToViewport}>
          <strong className="role-help-title">설정</strong>
          {settings}
        </div>
      ) : null}
    </div>
  );
}
