"use client";

// 설정 목록(2026-09-04) — 역할 배지 팝오버에 살던 스위치(진동·생동감 있는 동작·눈 편한 테마·차분한
// 편집실) + 계절 배경 + 포스터 테마 셀렉트를 한 컴포넌트로. 웹은 서쪽 도구 카드 톱니가 여는 **설정 모달**
// (태그 편집·인사이트와 같은 창 인프라)이, 모바일(도구 카드 없음)은 역할 배지 팝오버가 이 목록을 그린다.
// 앞으로 생길 설정은 여기에만 추가. data-act 키는 예전 그대로(인사이트 집계 연속).
// (멤버 관리는 2026-09-04 기능 철수 — ADR-0018.)

import { Eye, Leaf, Palette, Sparkles, Vibrate, Waves } from "lucide-react";
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
  // 계절 배경(2026-09-04, ADR-0017) — 물결 위 가을 낙엽·겨울 눈·봄 초목. 기본 ON. OFF면 물결만.
  ambientOn: boolean;
  onToggleAmbient: () => void;
  // 포스터 테마(시청자 화면 배경, calendars.poster_theme) — 소유자만(서버도 owner 검사). null이면 안 그림.
  posterTheme: PosterThemeKey | null;
  onChangePosterTheme: (theme: PosterThemeKey) => void;
  posterThemeSaving: boolean;
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
  ambientOn,
  onToggleAmbient,
  posterTheme,
  onChangePosterTheme,
  posterThemeSaving
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
      {/* 계절 배경 — 보고 있는 달력 달의 계절 배경(여름 물결·가을 낙엽·겨울 눈·봄 초목). OFF면 사철 물결. */}
      <div className="role-help-haptics">
        <span className="rhh-label">
          <Leaf aria-hidden="true" size={14} />
          계절 배경
        </span>
        <button
          aria-checked={ambientOn}
          aria-label="계절 배경 켜기/끄기"
          className={`rhh-switch ${ambientOn ? "on" : ""}`}
          onClick={onToggleAmbient}
          role="switch"
          type="button"
          data-act="계절 배경 켜기/끄기"
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
      {/* (멤버 관리 입구는 기능 철수(2026-09-04, ADR-0018)로 제거.) */}
    </>
  );
}
