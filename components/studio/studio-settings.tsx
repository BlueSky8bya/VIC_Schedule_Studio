"use client";

// 설정 목록(2026-09-04) — 역할 배지 팝오버에 살던 스위치(진동·생동감 있는 동작·눈 편한 테마·차분한
// 편집실) + 계절 배경 + 포스터 테마 셀렉트를 한 컴포넌트로. 웹은 서쪽 도구 카드 톱니가 여는 **설정 모달**
// (태그 편집·인사이트와 같은 창 인프라)이, 모바일(도구 카드 없음)은 역할 배지 팝오버가 이 목록을 그린다.
// 앞으로 생길 설정은 여기에만 추가. data-act 키는 예전 그대로(인사이트 집계 연속).
// (멤버 관리는 2026-09-04 기능 철수 — ADR-0018.)

import { Eye, Gauge, Leaf, Palette, Sparkles, Vibrate } from "lucide-react";
import { POSTER_THEMES, type PosterThemeKey } from "@/lib/domain/schedule-types";
import type { GfxMode, GfxPref } from "@/lib/ui/gfx";
import type { AmbientMode } from "@/lib/ui/motion";
import { RhhSelect } from "@/components/studio/rhh-select";

export type StudioSettingsProps = {
  hapticsSupported: boolean;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  eyeComfort: boolean;
  onToggleEyeComfort: () => void;
  // (차분한 편집실 스위치는 2026-09-04 제거 — 항상 ON. 사용자: "끄면 살짝 어두워질 뿐 뭐가 차분한지 모르겠다".)
  // 계절 배경(2026-09-04, ADR-0017 개정 2) — 달력 달의 계절(여름 물결·가을 낙엽·겨울 눈밭·봄 풀밭). 기본 ON. OFF면 전부 없음.
  ambientMode: AmbientMode; // 켜짐 · 흐리게 · 끔(2026-09-04 세 상태)
  onChangeAmbientMode: (mode: AmbientMode) => void;
  // 배경 효과 품질(2026-09-04, lib/ui/gfx.ts v3) — 자동(기기 판정)/항상 최대/가볍게. gfxAuto = 자동 판정 결과(표시용).
  gfxPref: GfxPref;
  gfxAuto: GfxMode;
  onChangeGfxPref: (pref: GfxPref) => void;
  // 배경 감상 모드(웹 편집실만 — 모바일은 배경이 없어 넘기지 않는다). 있으면 줄을 그린다.
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
  ambientMode,
  onChangeAmbientMode,
  gfxPref,
  onChangeGfxPref,
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
      {/* (차분한 편집실 스위치 제거 — 2026-09-04, 항상 ON. html[data-studio-calm]은 페인트-전 스크립트가 늘 붙인다.) */}
      {/* 계절 배경 — 보고 있는 달력 달의 계절 배경(여름 물결·가을 낙엽·겨울 눈밭·봄 풀밭). OFF면 전부 없음(개정 2).
          모바일(≤640)엔 배경 자체가 없어 이 줄과 '배경 효과' 줄을 숨긴다(.rhh-ambient, 2026-09-04 사용자). */}
      <div className="role-help-haptics rhh-ambient">
        <span className="rhh-label">
          <Leaf aria-hidden="true" size={14} />
          계절 배경
        </span>
        <RhhSelect<AmbientMode>
          ariaLabel="계절 배경 상태 고르기"
          dataAct="ambient-mode-select"
          onChange={onChangeAmbientMode}
          options={[
            { value: "on", label: "켜기" },
            { value: "dim", label: "흐리게" },
            { value: "off", label: "끄기" }
          ]}
          value={ambientMode}
        />
      </div>
      {/* 배경 효과 품질(gfx v3) — 기기 판정이 '가볍게/끔'으로 떨어진 PC(토리님)에서 사용자가 직접 되돌리는 손잡이.
          자동 옵션 라벨에 판정 결과를 괄호로 보여 준다. 계절 배경이 OFF면 '끄기'로 잠긴다(두 컨트롤이 한 상태). */}
      <div className="role-help-haptics rhh-ambient">
        <span className="rhh-label">
          <Gauge aria-hidden="true" size={14} />
          배경 효과
        </span>
        <RhhSelect<GfxPref>
          ariaLabel="배경 효과 품질 고르기"
          dataAct="gfx-pref-select"
          disabled={ambientMode === "off"}
          lockedLabel="끄기"
          onChange={onChangeGfxPref}
          options={[
            // 라벨은 짧게 "자동 조절"(2026-09-04 사용자: 주저리 설명 금지). 기기 판정 결과는 title로만.
            { value: "auto", label: "자동 조절" },
            { value: "max", label: "항상 최대" },
            { value: "lite", label: "가볍게" },
            { value: "off", label: "끄기" }
          ]}
          value={gfxPref}
        />
      </div>
      {/* (배경 감상 줄은 2026-09-04 사용자 결정으로 제거 — 아바타 자리·시청자 레일의 "감상하기" 버튼 하나만 둔다. 중복 금지.) */}
      {/* 포스터 테마 — 시청자 화면 배경(서버 저장, 소유자만). 스위치 줄과 같은 규격의 셀렉트. */}
      {posterTheme !== null ? (
        <div className="role-help-haptics">
          <span className="rhh-label">
            <Palette aria-hidden="true" size={14} />
            포스터 테마
          </span>
          <RhhSelect<PosterThemeKey>
            ariaLabel="포스터 테마 고르기"
            dataAct="poster-theme-select"
            disabled={posterThemeSaving}
            onChange={onChangePosterTheme}
            options={POSTER_THEMES.map((t) => ({ value: t.key, label: t.label }))}
            value={posterTheme}
          />
        </div>
      ) : null}
      {/* (멤버 관리 입구는 기능 철수(2026-09-04, ADR-0018)로 제거.) */}
    </>
  );
}
