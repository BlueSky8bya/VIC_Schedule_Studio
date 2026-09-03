"use client";

// P2-ARCH-1 2단계: 역할 배지 + 권한 팝오버(구 renderRoleBadge)를 studio-shell에서 분리
// (동작·마크업·클래스 변화 0). 설정 토글(진동/동작 줄이기/눈 편한 테마)까지 포함.

import { Eye, Palette, Sparkles, Vibrate, Waves } from "lucide-react";
import { PlainEmail } from "@/components/ui/plain-email";
import { POSTER_THEMES, type MembershipRole, type PosterThemeKey } from "@/lib/domain/schedule-types";

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
  // 차분한 편집실(2026-09-03) — 편집실 구조를 물·은 톤으로 식히는 테마(lib/ui/motion.ts). 기본 ON.
  studioCalm: boolean;
  onToggleStudioCalm: () => void;
  // 포스터 테마(시청자 화면 배경, calendars.poster_theme) — 소유자만 고른다(서버도 owner 검사).
  // null이면 선택 UI를 안 그린다(비소유자). 꾸미기 화면 철수(ADR-0015) 뒤 남은 유일한 테마 입구.
  posterTheme: PosterThemeKey | null;
  onChangePosterTheme: (theme: PosterThemeKey) => void;
  posterThemeSaving: boolean;
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
  onToggleEyeComfort,
  studioCalm,
  onToggleStudioCalm,
  posterTheme,
  onChangePosterTheme,
  posterThemeSaving
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
          {/* 생동감 있는 동작(2026-09-03 극성 반전, 사용자 결정) — ON(기본)=장식 모션·물결 켜짐,
              OFF=옛 '동작 줄이기'. 저장 키(vic.reduceMotion)·html[data-reduce-motion]의 뜻은 그대로고
              스위치 방향만 반대라, 설정 4개가 전부 'ON=기본값'으로 읽힌다. 기기 무관 항상 노출. */}
          <div className="role-help-haptics">
            <span className="rhh-label">
              <Sparkles aria-hidden="true" size={14} />
              생동감 있는 동작
            </span>
            <button
              aria-checked={!reduceMotion}
              aria-label="생동감 있는 동작 켜기/끄기"
              className={`rhh-switch ${reduceMotion ? "" : "on"}`}
              onClick={onToggleReduceMotion}
              role="switch"
              type="button"
             data-act="생동감 있는 동작 켜기/끄기">
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
          {/* 차분한 편집실 — 저장·달 이동은 물빛, 필터 패널은 은백, 칸은 반 단계 냉각(콘텐츠 색은 그대로). */}
          <div className="role-help-haptics">
            <span className="rhh-label">
              <Waves aria-hidden="true" size={14} />
              차분한 편집실
            </span>
            <button
              aria-checked={studioCalm}
              aria-label="차분한 편집실 켜기/끄기"
              className={`rhh-switch ${studioCalm ? "on" : ""}`}
              onClick={onToggleStudioCalm}
              role="switch"
              type="button"
              data-act="studio-calm-toggle"
            >
              <span className="rhh-knob" aria-hidden="true" />
            </button>
          </div>
          {/* 포스터 테마 — 시청자 화면 배경(서버 저장, 소유자만). 스위치 줄과 같은 규격의 셀렉트. */}
          {posterTheme !== null ? (
            <div className="role-help-haptics">
              <span className="rhh-label">
                <Palette aria-hidden="true" size={14} />
                포스터 테마
              </span>
              <select
                aria-label="포스터 테마 고르기"
                className="rhh-select"
                data-act="poster-theme-select"
                disabled={posterThemeSaving}
                onChange={(e) => onChangePosterTheme(e.target.value as PosterThemeKey)}
                value={posterTheme}
              >
                {POSTER_THEMES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
