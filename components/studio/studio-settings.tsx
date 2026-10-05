"use client";

// 설정 목록(2026-09-04) — 역할 배지 팝오버에 살던 스위치(진동·생동감 있는 동작·눈 편한 테마·차분한
// 편집실) + 계절 배경 + 포스터 테마 셀렉트를 한 컴포넌트로. 웹은 서쪽 도구 카드 톱니가 여는 **설정 모달**
// (태그 편집·인사이트와 같은 창 인프라)이, 모바일(도구 카드 없음)은 역할 배지 팝오버가 이 목록을 그린다.
// 앞으로 생길 설정은 여기에만 추가. data-act 키는 예전 그대로(인사이트 집계 연속).
// (멤버 관리는 2026-09-04 기능 철수 — ADR-0018.)

import "./../shared/settings-modal.css";
import Link from "next/link";
import type { Route } from "next";
import { BookA, CloudSun, Eye, Gauge, Leaf, Palette, PenLine, Sparkles, SunMoon, Trash2, Vibrate, ALargeSmall, Type, Bold, Check, Volume1, Volume2, VolumeX, Wrench, PartyPopper, Heart, BellRing, EyeOff, MousePointerClick } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { playSfx, type SfxName, type SoundCategory, type SoundCats } from "@/lib/ui/sfx";
import type { ThemeMode } from "@/lib/ui/theme";
import { TEXT_PX_BASE, TEXT_PX_MAX, TEXT_PX_MIN } from "@/lib/ui/edit-prefs";
import { FONT_BASE, FONT_OPTIONS, FONT_STACKS, type FontKind, type WeightStep } from "@/lib/ui/font-prefs";
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
  // 글씨 크기(px, 일정 제목 기준) — 달력 글자의 기본 크기. Ctrl+휠 확대는 이 크기에서 시작한다. 웹 달력에만.
  textPx: number;
  onChangeTextPx: (px: number) => void;
  // 글꼴(앱 전체)·글씨 굵기(달력 일정 글자) — lib/ui/font-prefs. 모든 역할·시청자 화면에서 같은 기기 설정.
  font: FontSettings;
  // 소리(lib/ui/sfx) — 효과음 전체·음량·종류별·다른 탭. 기본 꺼짐. showEdit = 편집 소리 줄(편집실 편집 권한).
  sound: SoundSettings;
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

type TabKey = "screen" | "text" | "motion" | "sound" | "bg" | "edit" | "viewer" | "dev";

export type SoundSettings = {
  on: boolean;
  toggle: () => void;
  vol: number;
  changeVol: (v: number, commit?: boolean) => void;
  preview: () => void;
  cats: SoundCats;
  toggleCat: (cat: SoundCategory) => void;
  quietHidden: boolean;
  toggleQuietHidden: () => void;
  showEdit: boolean;
};
type Tone = "water" | "leaf" | "metal" | "rose";

// 글꼴 묶음 — 계열별로 나눠 한 줄씩 고른 폭으로(2026-10-06 소유자: "난잡하게 왼쪽 정렬 말고 좌우 균형감 있게").
const FONT_GROUPS: { label: string; kinds: FontKind[] }[] = [
  { label: "고딕", kinds: ["고딕"] },
  { label: "둥근", kinds: ["둥근"] },
  { label: "명조 손글씨", kinds: ["명조", "손글씨"] }
];

// 소리 모아 듣기 — 기능마다 다른 소리를 한자리에서(음 개수·리듬·오르내림으로 구분된다, lib/ui/sfx 근거 주석).
const SOUND_SAMPLES: { name: SfxName; label: string; edit?: boolean }[] = [
  { name: "tap", label: "누르기" },
  { name: "tab", label: "고르기" },
  { name: "toggle-on", label: "켜기" },
  { name: "toggle-off", label: "끄기" },
  { name: "open", label: "열기" },
  { name: "close", label: "닫기" },
  { name: "page", label: "다음 달" },
  { name: "page-prev", label: "이전 달" },
  { name: "heart-on", label: "하트" },
  { name: "lift", label: "집기", edit: true },
  { name: "drop", label: "놓기", edit: true },
  { name: "save", label: "저장", edit: true },
  { name: "link", label: "잇기", edit: true },
  { name: "unlink", label: "끊기", edit: true },
  { name: "undo", label: "되돌리기", edit: true },
  { name: "redo", label: "다시", edit: true },
  { name: "delete", label: "삭제", edit: true },
  { name: "unlock", label: "잠금 해제" },
  { name: "error", label: "실패" },
  { name: "fanfare", label: "축하" },
  { name: "birthday", label: "생일 노래" }
];

export type FontSettings = {
  id: string;
  change: (id: string) => void;
  weight: WeightStep;
  changeWeight: (step: WeightStep) => void;
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
    <div
      aria-label={ariaLabel}
      className="rhh-seg"
      data-act={dataAct}
      role="radiogroup"
      style={
        {
          "--n": options.length,
          "--i": Math.max(0, options.findIndex((o) => o.value === value))
        } as CSSProperties
      }
    >
      {/* 흰 손잡이 하나가 고른 칸으로 미끄러진다(iOS 세그먼트) — 칸마다 배경을 켜고 끄면 '깜빡'이 된다. */}
      <span aria-hidden="true" className="rhh-seg-thumb" />
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
  textPx,
  onChangeTextPx,
  font,
  sound,
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
  const [activeTab, setActiveTab] = useState<TabKey>("screen");
  // 글꼴 미리보기 — 타일에 마우스를 올리면 아래 미리보기만 그 글꼴로(고르기 전 둘러보기), 누르면 고른다.
  const [fontPeek, setFontPeek] = useState<string | null>(null);
  const previewFont = FONT_STACKS[fontPeek ?? font.id] || undefined;
  // 타일 견본 글자는 자기 글꼴로 그린다 — 글꼴 묶음이 화면에 들어올 때 한꺼번에 받고(설정을 연 사람만),
  // 받기 전엔 반짝이는 자리표시로 둔다(대체 글꼴로 그렸다가 바뀌며 튀지 않게).
  const [fontsReady, setFontsReady] = useState<ReadonlySet<string>>(() => new Set([FONT_BASE]));
  // 설정 창 재설계(2026-10-06 소유자: "많아진 설정에 맞게, 벤치마킹해서") — 애플 설정 앱의 묶음 목록:
  // 성격별 묶음 제목 → 둥근 카드 안 줄들 → 필요할 때만 묶음 아래 한 줄 설명. 줄 이름은 짧게(UI-15),
  // 설명은 '모르면 못 고르는 것'에만 단다. 줄 순서는 자주 바꾸는 것(화면)부터.
  // 왼쪽 탭(2026-10-06 소유자: "왼쪽에 탭으로 관리하는 식으로" — macOS 시스템 설정·디스코드·VS Code 설정 벤치마킹).
  // 넓은 창: 왼쪽 묶음 목록 + 오른쪽엔 고른 묶음만. 좁은 곳(폰·편집실 모바일 팝오버): 탭 없이 묶음을 위아래로 쌓는다 —
  // 판단은 화면 폭이 아니라 **이 목록이 놓인 상자의 폭**(컨테이너 쿼리, settings-modal.css)이라 좁은 팝오버에서도 맞다.
  const tabs: { key: TabKey; label: string; icon: ReactNode; tone: Tone; web?: boolean }[] = [
    { key: "screen", label: "화면", icon: <SunMoon size={15} />, tone: "water" },
    { key: "text", label: "글자", icon: <Type size={15} />, tone: "water" },
    { key: "motion", label: "움직임", icon: <Sparkles size={15} />, tone: "water" },
    { key: "sound", label: "소리", icon: <Volume2 size={15} />, tone: "water" },
    { key: "bg", label: "배경", icon: <Leaf size={15} />, tone: "leaf", web: true },
    ...(hasEditGroup ? [{ key: "edit" as const, label: "편집", icon: <PenLine size={15} />, tone: "metal" as const }] : []),
    ...(posterTheme !== null ? [{ key: "viewer" as const, label: "시청자 화면", icon: <Palette size={15} />, tone: "rose" as const }] : []),
    ...(devWorld ? [{ key: "dev" as const, label: "개발자", icon: <Wrench size={15} />, tone: "metal" as const, web: true }] : [])
  ];
  const current: TabKey = tabs.some((t) => t.key === activeTab) ? activeTab : "screen";
  const fontGridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const grid = fontGridRef.current;
    if (!grid || typeof IntersectionObserver === "undefined") return;
    let started = false;
    const io = new IntersectionObserver((entries) => {
      if (started || !entries.some((e) => e.isIntersecting)) return;
      started = true;
      io.disconnect();
      const css = getComputedStyle(document.documentElement);
      for (const f of FONT_OPTIONS) {
        if (!f.stack) continue;
        const fam = f.stack.replace(/var\((--[\w-]+)\)/g, (_m, v: string) => css.getPropertyValue(v).trim() || "sans-serif");
        Promise.all([document.fonts.load(`400 24px ${fam}`, "가나Aa"), document.fonts.load(`700 24px ${fam}`, "가나Aa")])
          .catch(() => null)
          .then(() => setFontsReady((prev) => new Set(prev).add(f.id)));
      }
    });
    io.observe(grid);
    return () => io.disconnect();
  }, [current]);
  // 왼쪽 탭의 선택 하이라이트 — 항목마다 배경을 켜지 않고, 알약 하나가 고른 항목으로 미끄러진다(macOS 사이드바).
  const navRef = useRef<HTMLElement | null>(null);
  const [navPill, setNavPill] = useState<{ y: number; h: number; ready: boolean } | null>(null);
  const tabSig = tabs.map((t) => t.key).join(",");
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-tab="${current}"]`);
    if (!el || el.offsetParent === null) return; // 좁은 곳(탭 숨김)에선 재지 않는다
    setNavPill((prev) => ({ y: el.offsetTop, h: el.offsetHeight, ready: prev !== null }));
  }, [current, tabSig]);
  const pane = (key: TabKey, extra = "") => ({
    className: `rhh-group${extra ? ` ${extra}` : ""}${current === key ? " is-active" : ""}`,
    id: `rhh-tab-${key}-panel`,
    role: "tabpanel" as const,
    "aria-labelledby": `rhh-tab-${key}`
  });
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nav = e.currentTarget.parentElement;
    // 이 기기에서 실제로 보이는 탭만(폰에서 숨는 웹 전용 묶음 제외).
    const visible = tabs.filter((t) => nav?.querySelector<HTMLElement>(`[data-tab="${t.key}"]`)?.offsetParent != null);
    if (visible.length === 0) return;
    const i = visible.findIndex((t) => t.key === current);
    const next = visible[(i + (e.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length];
    setActiveTab(next.key);
    nav?.querySelector<HTMLButtonElement>(`[data-tab="${next.key}"]`)?.focus();
  };
  return (
    <div className="rhh-tabs">
      <div className="rhh-tabs-grid">
      <nav aria-label="설정 묶음" aria-orientation="vertical" className="rhh-nav" ref={navRef} role="tablist">
        {navPill ? (
          <span
            aria-hidden="true"
            className={`rhh-nav-pill${navPill.ready ? " ready" : ""}`}
            style={{ transform: `translateY(${navPill.y}px)`, height: navPill.h }}
          />
        ) : null}
        {tabs.map((t) => (
          <button
            aria-controls={`rhh-tab-${t.key}-panel`}
            aria-selected={current === t.key}
            className={`rhh-nav-item${current === t.key ? " on" : ""}${t.web ? " rhh-web" : ""}`}
            data-act={`settings-tab-${t.key}`}
            data-tab={t.key}
            id={`rhh-tab-${t.key}`}
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            onKeyDown={onTabKey}
            role="tab"
            tabIndex={current === t.key ? 0 : -1}
            type="button"
          >
            <span aria-hidden="true" className="rhh-ico" data-tone={t.tone}>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="rhh-panes">
      <section {...pane("screen")}>
        <h3 className="rhh-group-title" id="rhh-tab-screen-title">화면</h3>
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
        </div>
        <p className="rhh-group-foot">자동은 기기의 밝기 설정을 따라요.</p>
      </section>

      {/* 글자(2026-10-06 소유자: "글꼴 모양·미리보기를 보면서 크기도 같이, 같은 자리에서 스크롤 없이") —
          왼쪽 미리보기(바쁜 날·한가한 날)는 늘 보이고, 오른쪽에서 크기·굵기·글꼴을 바꾸면 바로 따라 바뀐다.
          좁은 곳(폰)은 미리보기가 위에 붙어(sticky) 아래 손잡이를 움직여도 계속 보인다. */}
      <section {...pane("text", "rhh-text-tab")}>
        <h3 className="rhh-group-title" id="rhh-tab-text-title">글자</h3>
        <div className="rhh-text-layout">
          {/* 미리보기 — 바쁜 날(띠·기념일·두 색·미정 빗금·최초공개·하트·세부 줄)과 한가한 날을 나란히.
              달력 카드와 같은 비율(제목 14 · 세부 12.5 · 날짜 20 · 기념일 11px × 글씨 크기)·같은 굵기 규칙. */}
          <div className="rhh-text-stage" aria-hidden="true">
            <div className="rhh-preview-pair" style={{ "--pv": textPx / TEXT_PX_BASE, fontFamily: previewFont } as CSSProperties}>
              <div className="rhh-preview-col">
                <span className="rhh-preview-cap">일정이 많은 날</span>
                <div className="rhh-text-preview">
                  <div className="pv-head">
                    <span className="pv-date">1</span>
                    <span className="pv-mark">🎉 데뷔 1주년</span>
                  </div>
                  <span className="pv-band">🌱 업도움 · 굿즈 사전 판매</span>
                  <div className="pv-card pv-mixed">
                    <b>빅토리 재 데뷔 합니다!!!</b>
                    <ul>
                      <li>뉴아바타 · 뉴헤어</li>
                      <li>새로워진 api 공개</li>
                    </ul>
                    <i className="pv-heart">♥</i>
                  </div>
                  <div className="pv-card pv-tent">
                    <b>
                      종겜 <em>미정</em>
                    </b>
                    <ul>
                      <li>소시지게임 켠왕</li>
                    </ul>
                  </div>
                  <div className="pv-card pv-teaser">
                    <b>🔮 ???</b>
                    <span className="pv-dday">D-9</span>
                  </div>
                  <div className="pv-card pv-plain">
                    <b>고멤FC</b>
                  </div>
                </div>
              </div>
              <div className="rhh-preview-col">
                <span className="rhh-preview-cap">한가한 날</span>
                <div className="rhh-text-preview">
                  <div className="pv-head">
                    <span className="pv-date">14</span>
                  </div>
                  <div className="pv-card pv-rest">
                    <b>휴뱅</b>
                    <ul>
                      <li>정기휴방</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rhh-group-card rhh-text-controls">
          {/* 글씨 크기 — px로 고르고 바로 아래 미리보기로 확인. 고른 크기가 달력의 기본(100%), Ctrl+휠 확대는 여기서 시작. 웹만. */}
          <div className="role-help-haptics rhh-stack-sm">
            <RowLabel icon={<ALargeSmall size={15} />} tone="water">
              글씨 크기
            </RowLabel>
            <div className="rhh-volume">
              <span aria-hidden="true" className="rhh-size-a small">가</span>
              <input
                aria-label="달력 글씨 크기(px)"
                aria-valuetext={`${textPx}px`}
                data-act="text-size"
                max={TEXT_PX_MAX}
                min={TEXT_PX_MIN}
                onChange={(e) => onChangeTextPx(Number(e.currentTarget.value))}
                step={0.5}
                style={{ "--vol": `${((textPx - TEXT_PX_MIN) / (TEXT_PX_MAX - TEXT_PX_MIN)) * 100}%` } as CSSProperties}
                type="range"
                value={textPx}
              />
              <span aria-hidden="true" className="rhh-size-a big">가</span>
              <b className="rhh-vol-num rhh-px">{textPx}px</b>
              <button
                className="rhh-link rhh-preview"
                data-act="text-size-reset"
                disabled={textPx === TEXT_PX_BASE}
                onClick={() => onChangeTextPx(TEXT_PX_BASE)}
                type="button"
              >
                기본
              </button>
            </div>
          </div>
          {/* 글꼴 — 앱 전체. 계열별 묶음 · 고른 폭의 타일(견본 '가나'는 그 글꼴로). 올리면 미리보기만, 누르면 고른다. */}
          <div className="role-help-haptics rhh-stack-sm">
            <RowLabel icon={<Type size={15} />} tone="water">
              글꼴
            </RowLabel>
            <div aria-label="글꼴 고르기" className="rhh-font-picker" data-act="font-select" onMouseLeave={() => setFontPeek(null)} ref={fontGridRef} role="radiogroup">
              {FONT_GROUPS.map((g) => (
                <div className="rhh-font-group" key={g.label}>
                  <span className="rhh-font-group-label">{g.label}</span>
                  <div className="rhh-font-tiles">
                    {FONT_OPTIONS.filter((f) => g.kinds.includes(f.kind)).map((f) => {
                      const on = f.id === font.id;
                      const ready = fontsReady.has(f.id);
                      return (
                        <button
                          aria-checked={on}
                          aria-label={f.label}
                          className={`rhh-font-tile${on ? " on" : ""}`}
                          key={f.id}
                          onBlur={() => setFontPeek(null)}
                          onClick={() => {
                            if (!on) font.change(f.id);
                          }}
                          onFocus={() => setFontPeek(f.id)}
                          onMouseEnter={() => setFontPeek(f.id)}
                          role="radio"
                          type="button"
                        >
                          <span aria-hidden="true" className={`rhh-font-sample${ready ? " ready" : ""}`} style={f.stack ? { fontFamily: f.stack } : undefined}>
                            가나
                          </span>
                          <span className="rhh-font-name">{f.label}</span>
                          {on ? (
                            <span aria-hidden="true" className="rhh-font-check">
                              <Check size={11} strokeWidth={3.4} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* 글씨 굵기 — 달력 일정 글자(제목·세부). 가늘게 = 한 파일 아래(보통 글꼴 파일로), 굵게 = 가장 굵은 파일 위에
              얇은 외곽선까지 — 굵기 파일이 한두 개뿐인 글꼴에서도 세 단계가 눈에 보이게. */}
          <div className="role-help-haptics rhh-stack-sm">
            <RowLabel icon={<Bold size={15} />} tone="water">
              글씨 굵기
            </RowLabel>
            <SettingsSegment<WeightStep>
              ariaLabel="일정 글씨 굵기 고르기"
              dataAct="text-weight-select"
              onChange={font.changeWeight}
              options={[
                { value: -300, label: "가늘게" },
                { value: 0, label: "보통" },
                { value: 100, label: "굵게" }
              ]}
              value={font.weight}
            />
          </div>
          </div>
        </div>
        <p className="rhh-group-foot">글꼴은 화면 전체에, 크기·굵기는 달력 일정 글자에 적용돼요. 달력 위 Ctrl+휠 확대는 고른 크기에서 시작해요.</p>
      </section>

      <section {...pane("motion")}>
        <h3 className="rhh-group-title" id="rhh-tab-motion-title">움직임</h3>
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

      {/* 소리(2026-10-06 — OS·게임 소리 설정 벤치마킹): 전체 켜기 → 음량(끌고 떼면 그 크기로 한 번, 미리 듣기) →
          종류별 켜기 → 다른 탭일 땐 조용히. 전체가 꺼져 있으면 아래 줄은 흐리게 잠긴다(무엇이 있는지는 보이게). */}
      <section {...pane("sound")}>
        <h3 className="rhh-group-title" id="rhh-tab-sound-title">소리</h3>
        <div className="rhh-group-card">
          <div className="role-help-haptics">
            <RowLabel icon={<Volume2 size={15} />} tone="water">
              효과음
            </RowLabel>
            <Switch dataAct="sound-toggle" label="효과음 켜기/끄기" on={sound.on} onToggle={sound.toggle} />
          </div>
          <div className={`role-help-haptics rhh-stack-sm${sound.on ? "" : " is-locked"}`}>
            <RowLabel icon={<Volume1 size={15} />} tone="water">
              음량
            </RowLabel>
            <div className="rhh-volume">
              <VolumeX aria-hidden="true" className="rhh-vol-ico" size={15} />
              <input
                aria-label="효과음 음량"
                aria-valuetext={`${sound.vol}%`}
                data-act="sound-volume"
                disabled={!sound.on}
                max={100}
                min={0}
                onChange={(e) => sound.changeVol(Number(e.currentTarget.value))}
                onKeyUp={(e) => sound.changeVol(Number(e.currentTarget.value), true)}
                onPointerUp={(e) => sound.changeVol(Number(e.currentTarget.value), true)}
                step={5}
                style={{ "--vol": `${sound.vol}%` } as CSSProperties}
                type="range"
                value={sound.vol}
              />
              <Volume2 aria-hidden="true" className="rhh-vol-ico" size={15} />
              <b className="rhh-vol-num">{sound.vol}</b>
              <button
                className="rhh-link rhh-preview"
                data-act="sound-preview"
                disabled={!sound.on}
                onClick={sound.preview}
                type="button"
              >
                들어 보기
              </button>
            </div>
          </div>
          <div className={`role-help-haptics rhh-stack-sm${sound.on ? "" : " is-locked"}`}>
            <RowLabel icon={<MousePointerClick size={15} />} tone="water">
              소리 모아 듣기
            </RowLabel>
            <div className="rhh-font-grid rhh-sound-grid" data-act="sound-sample">
              {SOUND_SAMPLES.filter((x) => !x.edit || sound.showEdit).map((x) => (
                <button disabled={!sound.on} key={x.name} onClick={() => playSfx(x.name, { force: true })} type="button">
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={`rhh-group-card${sound.on ? "" : " is-locked"}`}>
          <div className="role-help-haptics">
            <RowLabel icon={<PartyPopper size={15} />} tone="rose">
              축하
            </RowLabel>
            <Switch dataAct="sound-cat-celebrate" label="축하 소리 켜기/끄기" on={sound.cats.celebrate} onToggle={() => sound.toggleCat("celebrate")} />
          </div>
          <div className="role-help-haptics">
            <RowLabel icon={<MousePointerClick size={15} />} tone="water">
              누름·이동
            </RowLabel>
            <Switch dataAct="sound-cat-ui" label="누름·이동 소리 켜기/끄기" on={sound.cats.ui} onToggle={() => sound.toggleCat("ui")} />
          </div>
          <div className="role-help-haptics">
            <RowLabel icon={<Heart size={15} />} tone="rose">
              하트·기대
            </RowLabel>
            <Switch dataAct="sound-cat-tap" label="하트·기대 소리 켜기/끄기" on={sound.cats.tap} onToggle={() => sound.toggleCat("tap")} />
          </div>
          {sound.showEdit ? (
            <div className="role-help-haptics">
              <RowLabel icon={<PenLine size={15} />} tone="metal">
                편집
              </RowLabel>
              <Switch dataAct="sound-cat-edit" label="편집 소리 켜기/끄기" on={sound.cats.edit} onToggle={() => sound.toggleCat("edit")} />
            </div>
          ) : null}
          <div className="role-help-haptics">
            <RowLabel icon={<BellRing size={15} />} tone="metal">
              알림
            </RowLabel>
            <Switch dataAct="sound-cat-alert" label="알림 소리 켜기/끄기" on={sound.cats.alert} onToggle={() => sound.toggleCat("alert")} />
          </div>
          <div className="role-help-haptics">
            <RowLabel icon={<EyeOff size={15} />} tone="metal">
              다른 탭일 땐 조용히
            </RowLabel>
            <Switch dataAct="sound-quiet-hidden" label="다른 탭일 때 소리 끄기" on={sound.quietHidden} onToggle={sound.toggleQuietHidden} />
          </div>
        </div>
        <p className="rhh-group-foot">
          {sound.showEdit
            ? "누름·이동은 일정 고르기·집기·편집창 열고 닫기·달 넘기기·버튼 누름, 편집은 놓기·저장·잇기·끊기·삭제·되돌리기예요. 방송 중엔 송출에 섞일 수 있어요."
            : "누름·이동은 일정 열고 닫기·달 넘기기·버튼 누름, 축하는 기념일 빵빠레·최초공개 축포예요. 다시보기 소리는 플레이어에서 조절해요."}
        </p>
      </section>

      {/* 계절 배경·배경 효과 — 모바일(≤640)엔 배경이 없어 묶음째 숨긴다(.rhh-web). */}
      <section {...pane("bg", "rhh-web")}>
        <h3 className="rhh-group-title" id="rhh-tab-bg-title">배경</h3>
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
        <section {...pane("edit")}>
          <h3 className="rhh-group-title" id="rhh-tab-edit-title">편집</h3>
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
        <section {...pane("viewer")}>
          <h3 className="rhh-group-title" id="rhh-tab-viewer-title">시청자 화면</h3>
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
        <section {...pane("dev", "rhh-web")}>
          <h3 className="rhh-group-title" id="rhh-tab-dev-title">개발자</h3>
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
      </div>
      </div>
    </div>
  );
}
