"use client";

// 설정 목록(2026-09-04) — 역할 배지 팝오버에 살던 스위치 4종(진동·생동감 있는 동작·눈 편한 테마·차분한
// 편집실) + 포스터 테마 셀렉트를 한 컴포넌트로. 웹은 서쪽 도구 카드의 **설정(톱니) 팝오버**가, 모바일
// (도구 카드 없음)은 역할 배지 팝오버가 이 목록을 그린다. 앞으로 생길 설정(계절 배경 등)은 여기에만 추가.
// data-act 키는 예전 그대로(인사이트 집계 연속). 멤버 관리는 도구 카드 타일에서 내려와 여기 맨 아래의
// 조용한 입구(관리자만) — 토리님이 안 쓰는 기능이라 타일 자리를 설정에 내줬다(사용자 결정).

import { Eye, Palette, Sparkles, Users, Vibrate, Waves } from "lucide-react";
import { POSTER_THEMES, type PosterThemeKey } from "@/lib/domain/schedule-types";

export type StudioSettingsProps = {
  hapticsSupported: boolean;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  eyeComfort: boolean;
  onToggleEyeComfort: () => void;
  // 차분한 편집실(2026-09-03) — 팔레트만(물결은 '생동감 있는 동작'이 단독으로 맡는다). 기본 ON.
  studioCalm: boolean;
  onToggleStudioCalm: () => void;
  // 포스터 테마(시청자 화면 배경, calendars.poster_theme) — 소유자만(서버도 owner 검사). null이면 안 그림.
  posterTheme: PosterThemeKey | null;
  onChangePosterTheme: (theme: PosterThemeKey) => void;
  posterThemeSaving: boolean;
  // 멤버 관리 창 열기(관리자만) — 없으면 줄을 안 그린다.
  onOpenMembers?: () => void;
};

export function StudioSettingsList({
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
  posterThemeSaving,
  onOpenMembers
}: StudioSettingsProps) {
  return (
    <>
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
            data-act="진동 켜기/끄기"
          >
            <span className="rhh-knob" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {/* 생동감 있는 동작(2026-09-03 극성 반전) — ON(기본)=장식 모션·물결 켜짐, OFF=옛 '동작 줄이기'.
          저장 키(vic.reduceMotion)·html[data-reduce-motion]의 뜻은 그대로고 스위치 방향만 반대. */}
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
          data-act="생동감 있는 동작 켜기/끄기"
        >
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
          data-act="눈 편한 테마 켜기/끄기"
        >
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
      {/* 멤버 관리 — 도구 카드 타일에서 내려온 조용한 입구(관리자만). data-act는 옛 타일과 같은 키. */}
      {onOpenMembers ? (
        <div className="role-help-haptics">
          <span className="rhh-label">
            <Users aria-hidden="true" size={14} />
            멤버 관리
          </span>
          <button className="rhh-link" data-act="manage-members" onClick={onOpenMembers} type="button">
            열기
          </button>
        </div>
      ) : null}
    </>
  );
}
