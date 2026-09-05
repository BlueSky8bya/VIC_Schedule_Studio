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
import { AmbientModeSegment } from "@/components/shared/ambient/showcase";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";
import type { DayBand } from "@/components/shared/ambient/world/time";
import { WEATHER_LABEL, weatherOptionsForMonth, type Weather } from "@/components/shared/ambient/world/weather";
import { Clock3 } from "lucide-react";

/** 개발자 세계 시간 여행(2026-09-04 소유자: "개발자는 시간대에 영향받지 않고 마음대로 왔다갔다 오류 확인") — 세션 한정, 저장 안 함. */
export type DevWorldForce = NonNullable<WorldCtx["force"]>;
type BandOpt = "real" | DayBand;
type WeatherOpt = "real" | Weather;

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
  // 개발자 월드 강제 — **effectiveRole이 개발자**일 때만 넘긴다(미리보기 중인 역할엔 줄 자체가 없다).
  devWorld?: { force: DevWorldForce; onChange: (force: DevWorldForce) => void } | null;
  // 지금 보고 있는 달 — 그 달에 가능한 날씨 목록을 정하는 데 쓴다.
  devMonth?: number;
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
  posterThemeSaving,
  devWorld = null,
  devMonth = 1
}: StudioSettingsProps) {
  // (월드 날짜 줄은 2026-09-05 제거 — 연대기 철거로 날이 화면을 바꾸지 않는다. 흔적은 달만 본다.)
  // 그 달에 **실제로 생길 수 있는** 날씨만 고를 수 있다 — 여름에 눈을 강제하면 만들지도 않은 "눈 덮인 여름
  // 바이옴"을 보게 된다(2026-09-05 소유자). 목록은 월별 평년값 표(world/weather.ts)에서 직접 뽑으므로
  // 표를 고치면 목록도 같이 바뀐다(둘이 어긋날 수 없다).
  const weatherOptions: { value: WeatherOpt; label: string }[] = [
    { value: "real", label: "자동" },
    ...weatherOptionsForMonth(devMonth).map((w) => ({ value: w as WeatherOpt, label: WEATHER_LABEL[w] }))
  ];
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
          세 상태가 늘 다 보이는 세그먼트 [켜기|흐리게|끄기](2026-09-04 사용자: 셀렉트는 '흐리게'가 있는지 안 보였다) — 레일·아바타
          자리의 묶음과 같은 컴포넌트. 모바일(≤640)엔 배경 자체가 없어 이 줄과 '배경 효과' 줄을 숨긴다(.rhh-ambient). */}
      <div className="role-help-haptics rhh-ambient">
        <span className="rhh-label">
          <Leaf aria-hidden="true" size={14} />
          계절 배경
        </span>
        <AmbientModeSegment ariaLabel="계절 배경 상태 고르기" className="metal" dataAct="ambient-mode-select" mode={ambientMode} onChange={onChangeAmbientMode} />
      </div>
      {/* 배경 효과 품질(gfx v3) — 기기 판정이 '가볍게/끔'으로 떨어진 PC(토리님)에서 사용자가 직접 되돌리는 손잡이.
          계절 배경이 OFF면 '끄기'로 잠긴다(두 컨트롤이 한 상태).
          ⚠ 목록에 '끄기'는 없다(2026-09-05 소유자) — 바로 위 '계절 배경' 줄이 이미 끄는 손잡이라,
          같은 일을 하는 항목이 둘이면 어느 쪽이 진짜인지 헷갈린다. 끄기는 잠금 표시로만 나타난다. */}
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
            { value: "lite", label: "가볍게" }
          ]}
          // 예전에 '끄기'로 저장해 둔 값은 목록에 없다 — 자동으로 읽어 빈 칸이 되지 않게 한다
          // (배경이 실제로 꺼져 있으면 disabled + lockedLabel이 '끄기'를 보여준다).
          value={gfxPref === "off" ? "auto" : gfxPref}
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
      {/* 개발자 월드 강제(PLAN-20260904-003) — 시간대·날씨·날짜를 실제와 무관하게 밀어 넣어 연대기·빛 톤·날씨 훅을
          기다리지 않고 검사한다. 세션 한정(저장 안 함), effectiveRole이 개발자일 때만 줄이 생긴다. 연·달은 달력 이동으로.
          · 시간대: 여섯 띠(새벽~밤) — 엔진이 장면 위에 얹는 빛 톤.
          · 날씨: **실제 기상이 아니라** 날짜 시드 난수다(world/weather.ts, 소유자 결정 — 기상 API 안 씀). 그래서 "자동".
            계절에 없는 날씨(여름의 눈)는 목록에서 뺀다 — 만들지도 않은 장면을 보게 된다.
          (월드 날짜는 2026-09-05 제거 — 연대기를 걷어 날이 화면을 바꾸지 않는다.) */}
      {devWorld ? (
        <>
          <div className="role-help-haptics rhh-ambient rhh-dev">
            <span className="rhh-label">
              <Clock3 aria-hidden="true" size={14} />
              월드 시간대 <em className="rhh-dev-tag">개발자</em>
            </span>
            <RhhSelect<BandOpt>
              ariaLabel="월드 시간대 강제(개발자)"
              dataAct="dev-world-band"
              onChange={(v) => devWorld.onChange({ ...devWorld.force, band: v === "real" ? undefined : v })}
              options={[
                { value: "real", label: "자동" },
                { value: "dawn", label: "새벽" },
                { value: "morning", label: "아침" },
                { value: "noon", label: "점심" },
                { value: "dusk", label: "노을" },
                { value: "evening", label: "저녁" },
                { value: "night", label: "밤" }
              ]}
              value={devWorld.force.band ?? "real"}
            />
          </div>
          <div className="role-help-haptics rhh-ambient rhh-dev">
            <span className="rhh-label">
              <Clock3 aria-hidden="true" size={14} />
              월드 날씨 <em className="rhh-dev-tag">개발자</em>
            </span>
            <RhhSelect<WeatherOpt>
              ariaLabel="월드 날씨 강제(개발자)"
              dataAct="dev-world-weather"
              onChange={(v) => devWorld.onChange({ ...devWorld.force, weather: v === "real" ? undefined : v })}
              options={weatherOptions}
              value={devWorld.force.weather ?? "real"}
            />
          </div>
          {/* 계절 배경 아트 보드(2026-09-04) — 배경의 모든 그림 자리(나무·초목·지형·생물)와 코덱스 프롬프트를 한 라우트에서 관리한다. 개발자 전용 라우트. */}
          <div className="role-help-haptics rhh-ambient rhh-dev">
            <span className="rhh-label">
              <Palette aria-hidden="true" size={14} />
              배경 아트 보드 <em className="rhh-dev-tag">개발자</em>
            </span>
            <a className="rhh-link" data-act="dev-art-board-open" href="/studio/ambient-art">
              열기
            </a>
          </div>
        </>
      ) : null}
    </>
  );
}
