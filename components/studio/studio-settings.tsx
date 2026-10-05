"use client";

// 설정 목록(2026-09-04) — 역할 배지 팝오버에 살던 스위치(진동·생동감 있는 동작·눈 편한 테마·차분한
// 편집실) + 계절 배경 + 포스터 테마 셀렉트를 한 컴포넌트로. 웹은 서쪽 도구 카드 톱니가 여는 **설정 모달**
// (태그 편집·인사이트와 같은 창 인프라)이, 모바일(도구 카드 없음)은 역할 배지 팝오버가 이 목록을 그린다.
// 앞으로 생길 설정은 여기에만 추가. data-act 키는 예전 그대로(인사이트 집계 연속).
// (멤버 관리는 2026-09-04 기능 철수 — ADR-0018.)

import "./../shared/settings-modal.css";
import Link from "next/link";
import type { Route } from "next";
import { BookA, CloudSun, Eye, Gauge, Leaf, Palette, Sparkles, SunMoon, Trash2, Vibrate, ZoomIn } from "lucide-react";
import type { ReactNode } from "react";
import type { ThemeMode } from "@/lib/ui/theme";
import type { CalSize } from "@/lib/ui/edit-prefs";
import { POSTER_THEMES, type PosterThemeKey } from "@/lib/domain/schedule-types";
import type { GfxMode, GfxPref } from "@/lib/ui/gfx";
import type { AmbientMode } from "@/lib/ui/motion";
import { RhhSelect } from "@/components/studio/rhh-select";
import { AmbientModeSegment } from "@/components/shared/ambient/showcase";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";
import type { DayBand } from "@/components/shared/ambient/world/time";
import { WEATHER_LABEL, weatherOptionsForMonth, type Weather } from "@/components/shared/ambient/world/weather";
import { Clock3 } from "lucide-react";

/** 개발자 세계 시간 여행(2026-09-04 소유자: "개발자는 시간대에 영향받지 않고 마음대로 왔다갔다 오류 확인") — 세션 한정, 저장 안 함. */
export type DevWorldForce = NonNullable<WorldCtx["force"]>;
type BandOpt = "real" | DayBand;
type WeatherOpt = "real" | Weather;
type SeasonOpt = "real" | SeasonKey;

export type StudioSettingsProps = {
  canManageTimelines?: boolean;
  hapticsSupported: boolean;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  eyeComfort: boolean;
  onToggleEyeComfort: () => void;
  // 화면 모드(2026-10-06 세 상태) — 밝게·어둡게·기기 따라. 모든 역할/시청자 미리보기에서 같은 기기 설정.
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  // 달력 크기(달력 확대의 기본값) — 웹만(모바일은 목록이라 확대가 없다).
  calSize: CalSize;
  onChangeCalSize: (size: CalSize) => void;
  // 던져서 삭제 — 편집실(편집 권한)에서만 넘긴다. 없으면 줄이 없다.
  flingDelete?: boolean | null;
  onToggleFlingDelete?: () => void;
  // (차분한 편집실 스위치는 2026-09-04 제거 — 항상 ON. 사용자: "끄면 살짝 어두워질 뿐 뭐가 차분한지 모르겠다".)
  // 계절 배경(2026-09-04, ADR-0017 개정 2) — 달력 달의 계절(여름 물결·가을 낙엽·겨울 눈밭·봄 풀밭). 기본 ON. OFF면 전부 없음.
  ambientMode: AmbientMode; // 켜짐 · 흐리게 · 끔(2026-09-04 세 상태)
  onChangeAmbientMode: (mode: AmbientMode) => void;
  // 배경 효과 품질(2026-09-04, lib/ui/gfx.ts v3) — 자동(기기 판정)/항상 최대/가볍게. gfxAuto = 자동 판정 결과(표시용).
  gfxPref: GfxPref;
  gfxAuto: GfxMode;
  onChangeGfxPref: (pref: GfxPref) => void;
  // 포스터 테마(시청자 화면 배경, calendars.poster_theme) — 소유자만(서버도 owner 검사). null이면 안 그림.
  posterTheme: PosterThemeKey | null;
  onChangePosterTheme: (theme: PosterThemeKey) => void;
  posterThemeSaving: boolean;
  // 개발자 월드 강제 — **effectiveRole이 개발자**일 때만 넘긴다(미리보기 중인 역할엔 줄 자체가 없다).
  // season/onChangeSeason: 감상 톱니에서 계절을 강제해 두고 나오면 편집실 배경이 그 계절로 남는데, 되돌릴 손잡이가
  // 설정에 없었다(2026-09-05 소유자: "가을에서 봄으로 바꾸고 돌아오니 가을로 못 돌아와"). 같은 상태를 여기서도 연다.
  devWorld?: { force: DevWorldForce; onChange: (force: DevWorldForce) => void; season: SeasonKey | null; onChangeSeason: (season: SeasonKey | null) => void } | null;
  // 지금 보고 있는 달 — 그 달에 가능한 날씨 목록을 정하는 데 쓴다.
  devMonth?: number;
};

/** 늘 모든 상태가 보이는 세그먼트(라디오) — 셀렉트는 무엇을 고를 수 있는지 안 보인다(2026-09-04 소유자). */
function SettingsSegment<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  dataAct
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  dataAct: string;
}) {
  return (
    <div aria-label={ariaLabel} className="rhh-seg" data-act={dataAct} role="radiogroup">
      {options.map((o) => (
        <button
          aria-checked={o.value === value}
          className={o.value === value ? "on" : ""}
          key={String(o.value)}
          onClick={() => {
            if (o.value !== value) onChange(o.value);
          }}
          role="radio"
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 줄 머리 — 색 타일 속 아이콘 + 이름. 타일 색은 묶음의 성격(물=화면·움직임, 잎=배경, 쇠=편집·개발). */
function RowLabel({ icon, tone, children }: { icon: ReactNode; tone: "water" | "leaf" | "metal" | "rose"; children: ReactNode }) {
  return (
    <span className="rhh-label">
      <span aria-hidden="true" className="rhh-ico" data-tone={tone}>
        {icon}
      </span>
      {children}
    </span>
  );
}

function Switch({ on, onToggle, label, dataAct }: { on: boolean; onToggle: () => void; label: string; dataAct: string }) {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      className={`rhh-switch ${on ? "on" : ""}`}
      data-act={dataAct}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span className="rhh-knob" aria-hidden="true" />
    </button>
  );
}

export function StudioSettingsList({
  canManageTimelines = false,
  hapticsSupported,
  hapticsOn,
  onToggleHaptics,
  reduceMotion,
  onToggleReduceMotion,
  eyeComfort,
  onToggleEyeComfort,
  themeMode,
  onChangeThemeMode,
  calSize,
  onChangeCalSize,
  flingDelete = null,
  onToggleFlingDelete,
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
  // 그 달에 **실제로 생길 수 있는** 날씨만 고를 수 있다 — 여름에 눈을 강제하면 만들지도 않은 "눈 덮인 여름
  // 바이옴"을 보게 된다(2026-09-05 소유자). 계절을 강제해 뒀으면 목록도 그 계절의 것(감상 톱니와 같은 규칙).
  const seasonMonth: Record<SeasonKey, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };
  const weatherMonth = devWorld?.season ? seasonMonth[devWorld.season] : devMonth;
  const weatherOptions: { value: WeatherOpt; label: string }[] = [
    { value: "real", label: "자동" },
    ...weatherOptionsForMonth(weatherMonth).map((w) => ({ value: w as WeatherOpt, label: WEATHER_LABEL[w] }))
  ];
  const hasEditGroup = canManageTimelines || flingDelete !== null;
  // 설정 창 재설계(2026-10-06 소유자: "많아진 설정에 맞게, 벤치마킹해서") — 애플 설정 앱의 묶음 목록:
  // 성격별 묶음 제목 → 둥근 카드 안 줄들 → 필요할 때만 묶음 아래 한 줄 설명. 줄 이름은 짧게(UI-15),
  // 설명은 '모르면 못 고르는 것'에만 단다. 줄 순서는 자주 바꾸는 것(화면)부터.
  return (
    <>
      <section className="rhh-group">
        <h3 className="rhh-group-title">화면</h3>
        <div className="rhh-group-card">
          <div className="role-help-haptics rhh-stack-sm">
            <RowLabel icon={<SunMoon size={15} />} tone="water">
              화면 모드
            </RowLabel>
            <SettingsSegment<ThemeMode>
              ariaLabel="화면 모드 고르기"
              dataAct="theme-mode-select"
              onChange={onChangeThemeMode}
              options={[
                { value: "light", label: "밝게" },
                { value: "dark", label: "어둡게" },
                { value: "system", label: "자동" }
              ]}
              value={themeMode}
            />
          </div>
          {/* 눈 편한 테마 — 채도·눈부심을 낮춰 오래 봐도 덜 피로하게(글자 대비는 유지). */}
          <div className="role-help-haptics">
            <RowLabel icon={<Eye size={15} />} tone="water">
              눈 편한 테마
            </RowLabel>
            <Switch dataAct="눈 편한 테마 켜기/끄기" label="눈 편한 테마 켜기/끄기" on={eyeComfort} onToggle={onToggleEyeComfort} />
          </div>
          {/* 달력 크기 — 달력 확대의 기본값(칸·글자·띠가 함께). Ctrl+휠로 잠깐 바꾼 배율과 별개. 웹만. */}
          <div className="role-help-haptics rhh-web rhh-stack-sm">
            <RowLabel icon={<ZoomIn size={15} />} tone="water">
              달력 크기
            </RowLabel>
            <SettingsSegment<CalSize>
              ariaLabel="달력 크기 고르기"
              dataAct="cal-size-select"
              onChange={onChangeCalSize}
              options={[
                { value: 1, label: "보통" },
                { value: 1.25, label: "크게" },
                { value: 1.5, label: "더 크게" }
              ]}
              value={calSize}
            />
          </div>
        </div>
        <p className="rhh-group-foot">자동은 기기의 밝기 설정을 따라요.</p>
      </section>

      <section className="rhh-group">
        <h3 className="rhh-group-title">움직임</h3>
        <div className="rhh-group-card">
          {/* 생동감 있는 동작(2026-09-03 극성 반전) — ON(기본)=장식 모션·물결 켜짐, OFF=옛 '동작 줄이기'.
              저장 키(vic.reduceMotion)·html[data-reduce-motion]의 뜻은 그대로고 스위치 방향만 반대. */}
          <div className="role-help-haptics">
            <RowLabel icon={<Sparkles size={15} />} tone="water">
              생동감 있는 동작
            </RowLabel>
            <Switch dataAct="생동감 있는 동작 켜기/끄기" label="생동감 있는 동작 켜기/끄기" on={!reduceMotion} onToggle={onToggleReduceMotion} />
          </div>
          {/* 진동 켜기/끄기 — 진동 지원 기기(안드로이드)에서만. */}
          {hapticsSupported ? (
            <div className="role-help-haptics">
              <RowLabel icon={<Vibrate size={15} />} tone="water">
                진동
              </RowLabel>
              <Switch dataAct="진동 켜기/끄기" label="진동 켜기/끄기" on={hapticsOn} onToggle={onToggleHaptics} />
            </div>
          ) : null}
        </div>
      </section>

      {/* 계절 배경·배경 효과 — 모바일(≤640)엔 배경이 없어 묶음째 숨긴다(.rhh-web). */}
      <section className="rhh-group rhh-web">
        <h3 className="rhh-group-title">배경</h3>
        <div className="rhh-group-card">
          {/* 세 상태가 늘 다 보이는 세그먼트 [켜기|흐리게|끄기] — 레일·아바타 자리의 묶음과 같은 컴포넌트. */}
          <div className="role-help-haptics rhh-ambient rhh-stack-sm">
            <RowLabel icon={<Leaf size={15} />} tone="leaf">
              계절 배경
            </RowLabel>
            <AmbientModeSegment ariaLabel="계절 배경 상태 고르기" className="metal" dataAct="ambient-mode-select" mode={ambientMode} onChange={onChangeAmbientMode} />
          </div>
          {/* 배경 효과 품질(gfx v3) — 기기 판정이 '가볍게/끔'으로 떨어진 PC에서 사용자가 직접 되돌리는 손잡이.
              계절 배경이 OFF면 '끄기'로 잠긴다(두 컨트롤이 한 상태). 목록에 '끄기'는 없다(바로 위 줄이 끄는 손잡이). */}
          <div className="role-help-haptics rhh-ambient">
            <RowLabel icon={<Gauge size={15} />} tone="leaf">
              배경 효과
            </RowLabel>
            <RhhSelect<GfxPref>
              ariaLabel="배경 효과 품질 고르기"
              dataAct="gfx-pref-select"
              disabled={ambientMode === "off"}
              lockedLabel="끄기"
              onChange={onChangeGfxPref}
              options={[
                { value: "auto", label: "자동 조절" },
                { value: "max", label: "항상 최대" },
                { value: "lite", label: "가볍게" }
              ]}
              value={gfxPref === "off" ? "auto" : gfxPref}
            />
          </div>
        </div>
      </section>

      {hasEditGroup ? (
        <section className="rhh-group">
          <h3 className="rhh-group-title">편집</h3>
          <div className="rhh-group-card">
            {flingDelete !== null && onToggleFlingDelete ? (
              <div className="role-help-haptics">
                <RowLabel icon={<Trash2 size={15} />} tone="metal">
                  던져서 삭제
                </RowLabel>
                <Switch dataAct="fling-delete-toggle" label="던져서 삭제 켜기/끄기" on={flingDelete} onToggle={onToggleFlingDelete} />
              </div>
            ) : null}
            {canManageTimelines ? (
              <div className="role-help-haptics">
                <RowLabel icon={<Clock3 size={15} />} tone="metal">
                  팬 타임라인
                </RowLabel>
                <Link className="rhh-link" data-act="vod-timeline-manage" href={"/studio/timelines" as Route}>
                  관리
                </Link>
              </div>
            ) : null}
          </div>
          {flingDelete !== null ? (
            <p className="rhh-group-foot">끄면 카드를 빠르게 던져도 지워지지 않고 제자리로 돌아가요.</p>
          ) : null}
        </section>
      ) : null}

      {/* 포스터 테마 — 시청자 화면 배경(서버 저장, 소유자만). */}
      {posterTheme !== null ? (
        <section className="rhh-group">
          <h3 className="rhh-group-title">시청자 화면</h3>
          <div className="rhh-group-card">
            <div className="role-help-haptics">
              <RowLabel icon={<Palette size={15} />} tone="rose">
                포스터 테마
              </RowLabel>
              <RhhSelect<PosterThemeKey>
                ariaLabel="포스터 테마 고르기"
                dataAct="poster-theme-select"
                disabled={posterThemeSaving}
                onChange={onChangePosterTheme}
                options={POSTER_THEMES.map((t) => ({ value: t.key, label: t.label }))}
                value={posterTheme}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* 개발자 월드 강제(PLAN-20260904-003) — 시간대·날씨를 실제와 무관하게 밀어 넣어 검사한다. 세션 한정(저장 안 함),
          effectiveRole이 개발자일 때만 묶음이 생긴다. 날씨는 실제 기상이 아니라 날짜 시드 난수(world/weather.ts)라 "자동".
          계절에 없는 날씨(여름의 눈)는 목록에서 뺀다. */}
      {devWorld ? (
        <section className="rhh-group rhh-web">
          <h3 className="rhh-group-title">개발자</h3>
          <div className="rhh-group-card">
            <div className="role-help-haptics rhh-ambient rhh-dev">
              <RowLabel icon={<Leaf size={15} />} tone="metal">
                월드 계절
              </RowLabel>
              <RhhSelect<SeasonOpt>
                ariaLabel="월드 계절 강제(개발자)"
                dataAct="dev-world-season"
                onChange={(v) => devWorld.onChangeSeason(v === "real" ? null : v)}
                options={[
                  { value: "real", label: "자동" },
                  { value: "spring", label: "봄" },
                  { value: "summer", label: "여름" },
                  { value: "autumn", label: "가을" },
                  { value: "winter", label: "겨울" }
                ]}
                value={devWorld.season ?? "real"}
              />
            </div>
            <div className="role-help-haptics rhh-ambient rhh-dev">
              <RowLabel icon={<Clock3 size={15} />} tone="metal">
                월드 시간대
              </RowLabel>
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
              <RowLabel icon={<CloudSun size={15} />} tone="metal">
                월드 날씨
              </RowLabel>
              <RhhSelect<WeatherOpt>
                ariaLabel="월드 날씨 강제(개발자)"
                dataAct="dev-world-weather"
                onChange={(v) => devWorld.onChange({ ...devWorld.force, weather: v === "real" ? undefined : v })}
                options={weatherOptions}
                value={devWorld.force.weather ?? "real"}
              />
            </div>
            {/* 하늘 사건(2026-09-08) — 별똥별 평균 1분, 혜성 9분에 한 번이라 기다려서는 확인할 수 없다. 밤·맑은 하늘에서만. */}
            <div className="role-help-haptics rhh-ambient rhh-dev" title="밤 · 맑음/바람에서만 보인다">
              <RowLabel icon={<Sparkles size={15} />} tone="metal">
                하늘 사건
              </RowLabel>
              <RhhSelect<"real" | "shooting-star" | "comet">
                ariaLabel="하늘 사건 강제(개발자)"
                dataAct="dev-sky-event"
                onChange={(v) => devWorld.onChange({ ...devWorld.force, skyEvent: v === "real" ? undefined : v })}
                options={[
                  { value: "real", label: "자동" },
                  { value: "shooting-star", label: "별똥별 계속" },
                  { value: "comet", label: "혜성 계속" }
                ]}
                value={devWorld.force.skyEvent ?? "real"}
              />
            </div>
            {/* 계절 배경 아트 보드·은어 사전 초안 — 개발자 전용 라우트. */}
            <div className="role-help-haptics rhh-ambient rhh-dev">
              <RowLabel icon={<Palette size={15} />} tone="metal">
                배경 아트 보드
              </RowLabel>
              <Link className="rhh-link" data-act="dev-art-board-open" href="/studio/ambient-art">
                열기
              </Link>
            </div>
            <div className="role-help-haptics rhh-ambient rhh-dev">
              <RowLabel icon={<BookA size={15} />} tone="metal">
                은어 사전 초안
              </RowLabel>
              <Link className="rhh-link" data-act="dev-dictionary-open" href={"/studio/search-dictionary" as Route}>
                열기
              </Link>
            </div>
          </div>
          <p className="rhh-group-foot">이 기기·이 창에서만 바뀌고 저장되지 않아요.</p>
        </section>
      ) : null}
    </>
  );
}
