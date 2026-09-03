"use client";

// P2-ARCH-1 2단계: 역할 배지 + 권한 팝오버(구 renderRoleBadge)를 studio-shell에서 분리
// (동작·마크업·클래스 변화 0). 설정 스위치는 2026-09-04 StudioSettingsList(studio-settings.tsx)로 분리 —
// 웹은 서쪽 도구 카드의 설정(톱니) 팝오버가 그리고, 모바일(도구 카드 없음)만 `settings` 슬롯으로 여기 아래에
// 이어 붙인다.

import type { ReactNode } from "react";
import { PlainEmail } from "@/components/ui/plain-email";
import type { MembershipRole } from "@/lib/domain/schedule-types";

type RoleDisplay = { badgeLabel: string; label: string; summary: string; can: string[] };

type Props = {
  role: MembershipRole; // 배지 색 클래스(actor.role — 미리보기와 무관하게 실제 역할)
  email?: string | null;
  roleDisplay: RoleDisplay;
  previewing: boolean; // previewRole !== null
  open: boolean;
  onToggleOpen: () => void;
  // 설정 목록(모바일 전용 슬롯) — 웹은 도구 카드의 설정 팝오버로 옮겨 여기선 비운다.
  settings?: ReactNode;
};

export function RoleBadge({ role, email, roleDisplay, previewing, open, onToggleOpen, settings }: Props) {
  return (
    <div className="actor-badge-wrap">
      {/* 배지 전체가 토글 버튼 — "?"만이 아니라 역할 라벨 어디를 눌러도 설명이 뜬다(웹·모바일). */}
      <button
        aria-expanded={open}
        aria-label="역할 권한 보기"
        className={`actor-badge ${role}`}
        onClick={onToggleOpen}
        type="button"
        data-act="역할 권한 보기"
      >
        <strong>{roleDisplay.badgeLabel}</strong>
        <span className="role-help-q" aria-hidden="true">
          ?
        </span>
      </button>
      {open ? (
        <div className="role-help-pop" role="dialog" aria-label="역할 권한">
          <strong className="role-help-title">
            {roleDisplay.label}
            {previewing ? <span className="role-help-preview"> (미리보기 중입니다..)</span> : null}
          </strong>
          {email ? (
            <PlainEmail className="role-help-email" value={email} />
          ) : (
            <span className="role-help-email">비로그인</span>
          )}
          <p className="role-help-summary">{roleDisplay.summary}</p>
          <ul className="role-help-can">
            {roleDisplay.can.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {settings}
        </div>
      ) : null}
    </div>
  );
}
