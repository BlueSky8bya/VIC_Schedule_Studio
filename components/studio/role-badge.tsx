"use client";

// P2-ARCH-1 2단계: 역할 배지 + 권한 팝오버(구 renderRoleBadge)를 studio-shell에서 분리
// (동작·마크업·클래스 변화 0). 설정 토글(진동/동작 줄이기/눈 편한 테마)까지 포함.

import { Eye, Sparkles, Vibrate } from "lucide-react";
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
  hapticsSupported: boolean;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  eyeComfort: boolean;
  onToggleEyeComfort: () => void;
};

export function RoleBadge({
  role,
  email,
  roleDisplay,
  previewing,
  open,
  onToggleOpen,
  hapticsSupported,
  hapticsOn,
  onToggleHaptics,
  reduceMotion,
  onToggleReduceMotion,
  eyeComfort,
  onToggleEyeComfort
}: Props) {
  return (
    <div className="actor-badge-wrap">
      {/* 배지 전체가 토글 버튼 — "?"만이 아니라 역할 라벨 어디를 눌러도 설명이 뜬다(웹·모바일). */}
      <button
        aria-expanded={open}
        aria-label="역할 권한 보기"
        className={`actor-badge ${role}`}
        onClick={onToggleOpen}
        type="button"
       data-act="역할 권한 보기">
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
          {/* 진동 켜기/끄기 — 진동 지원 기기(안드로이드)에서만. */}
          {hapticsSupported ? (
            <div className="role-help-haptics">
              <span className="rhh-label">
                <Vibrate aria-hidden="true" size={14} />
                진동
              </span>
              <button
                aria-checked={hapticsOn}
                aria-label="진동 켜기/끄기"
                className={`rhh-switch ${hapticsOn ? "on" : ""}`}
                onClick={onToggleHaptics}
                role="switch"
                type="button"
               data-act="진동 켜기/끄기">
                <span className="rhh-knob" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {/* 동작 줄이기 — 장식용 반복 모션을 끈다. 기기 무관 항상 노출. */}
          <div className="role-help-haptics">
            <span className="rhh-label">
              <Sparkles aria-hidden="true" size={14} />
              동작 줄이기
            </span>
            <button
              aria-checked={reduceMotion}
              aria-label="동작 줄이기 켜기/끄기"
              className={`rhh-switch ${reduceMotion ? "on" : ""}`}
              onClick={onToggleReduceMotion}
              role="switch"
              type="button"
             data-act="동작 줄이기 켜기/끄기">
              <span className="rhh-knob" aria-hidden="true" />
            </button>
          </div>
          {/* 눈 편한 테마 — 채도·눈부심을 낮춰 오래 봐도 덜 피로하게(글자 대비는 유지). */}
          <div className="role-help-haptics">
            <span className="rhh-label">
              <Eye aria-hidden="true" size={14} />
              눈 편한 테마
            </span>
            <button
              aria-checked={eyeComfort}
              aria-label="눈 편한 테마 켜기/끄기"
              className={`rhh-switch ${eyeComfort ? "on" : ""}`}
              onClick={onToggleEyeComfort}
              role="switch"
              type="button"
             data-act="눈 편한 테마 켜기/끄기">
              <span className="rhh-knob" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
