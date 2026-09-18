"use client";

// 설정 스위치의 **상태 한 벌**(2026-09-19) — 진동 · 생동감 있는 동작 · 눈 편한 테마 · 계절 배경 · 배경 효과.
// 편집실(StudioShell)과 시청자 화면(PublicPoster)이 같은 설정 창을 여는데, 상태 로직이 편집실 안에만
// 있어 시청자 쪽에 복사본이 생길 뻔했다 — AGENTS G-18("한 기능 = 한 구현")에 따라 여기로 뺀다.
// 진실의 원천은 언제나 localStorage + <html> 속성(lib/ui/motion.ts · gfx.ts · haptics.ts)이고,
// 이 훅은 그 값을 마운트 뒤에 읽어(SSR 불일치 방지) 화면에 비춘다.
import { useCallback, useEffect, useState } from "react";
import { detectDevice } from "@/lib/presence/presence-client";
import { hapticTick, hapticsEnabled, setHapticsEnabled } from "@/lib/ui/haptics";
import {
  type AmbientMode,
  ambientMode,
  eyeComfortEnabled,
  reduceMotionEnabled,
  setAmbientMode,
  setEyeComfort,
  setReduceMotion
} from "@/lib/ui/motion";
import { gfxAutoMode, gfxPref, setGfxPref, type GfxMode, type GfxPref } from "@/lib/ui/gfx";
import { darkEnabled, setDarkMode } from "@/lib/ui/theme";

export type SettingsPrefs = {
  hapticsSupported: boolean;
  hapticsOn: boolean;
  toggleHaptics: () => void;
  reduceMotion: boolean;
  toggleReduceMotion: () => void;
  eyeComfort: boolean;
  toggleEyeComfort: () => void;
  dark: boolean;
  toggleDark: () => void;
  ambientMode: AmbientMode;
  changeAmbientMode: (mode: AmbientMode) => void;
  gfxPref: GfxPref;
  gfxAuto: GfxMode;
  changeGfxPref: (pref: GfxPref) => void;
};

/**
 * @param onGfxAuto 자동 판정이 스스로 품질을 내렸을 때(vic:gfx-auto). 편집실은 토스트로 알린다.
 */
export function useSettingsPrefs(onGfxAuto?: (mode: GfxMode) => void): SettingsPrefs {
  // 진동은 Android(Chrome/삼성)에서만 실제로 울린다. iOS엔 'vibrate'가 없고, 데스크톱 Chrome은
  // 있으되 무동작 — 토글이 무의미하므로 Android에서만 노출한다.
  const [hapticsSupported, setHapticsSupported] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" && "vibrate" in navigator && detectDevice() === "android";
    setHapticsSupported(supported);
    if (supported) setHapticsOn(hapticsEnabled());
  }, []);
  const toggleHaptics = useCallback(() => {
    setHapticsOn((prev) => {
      const next = !prev;
      setHapticsEnabled(next); // localStorage(vic.haptics)에 먼저
      if (next) hapticTick(); // 켜는 순간 한 번 울려 "이렇게 울려요"를 바로 체감
      return next;
    });
  }, []);

  // 생동감 있는 동작(2026-09-03 극성 반전) — ON(기본)=장식 모션·물결 켜짐, OFF=옛 '동작 줄이기'.
  const [reduceMotion, setReduceMotionState] = useState(false);
  useEffect(() => {
    setReduceMotionState(reduceMotionEnabled());
  }, []);
  const toggleReduceMotion = useCallback(() => {
    setReduceMotionState((prev) => {
      const next = !prev;
      setReduceMotion(next); // localStorage + <html data-reduce-motion> 즉시
      return next;
    });
    hapticTick();
  }, []);

  // 눈 편한 테마 — 채도·눈부심을 낮춘다.
  const [eyeComfort, setEyeComfortState] = useState(false);
  useEffect(() => {
    setEyeComfortState(eyeComfortEnabled());
  }, []);
  const toggleEyeComfort = useCallback(() => {
    setEyeComfortState((prev) => {
      const next = !prev;
      setEyeComfort(next);
      return next;
    });
    hapticTick();
  }, []);

  // 다크 모드 — 토큰 팔레트 한 벌을 어둡게(lib/ui/theme.ts). 눈 편한 테마와 독립이다.
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    setDarkState(darkEnabled());
  }, []);
  const toggleDark = useCallback(() => {
    setDarkState((prev) => {
      const next = !prev;
      setDarkMode(next); // localStorage + <html data-theme> 즉시
      return next;
    });
    hapticTick();
  }, []);

  // 배경 효과 품질(lib/ui/gfx.ts v3) — 자동(기기 판정)/항상 최대/가볍게 + 자동 판정 결과(표시용).
  const [gfxPrefState, setGfxPrefState] = useState<GfxPref>("auto");
  const [gfxAuto, setGfxAuto] = useState<GfxMode>("full");
  useEffect(() => {
    setGfxPrefState(gfxPref());
    setGfxAuto(gfxAutoMode());
    const onAuto = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: GfxMode }>).detail?.mode;
      if (!mode) return;
      setGfxAuto(mode);
      onGfxAuto?.(mode);
    };
    window.addEventListener("vic:gfx-auto", onAuto);
    return () => window.removeEventListener("vic:gfx-auto", onAuto);
  }, [onGfxAuto]);

  // 계절 배경 세 상태(켜짐·흐리게·끔). 상태의 진실은 <html data-ambient> — 설정 셀렉트, 레일의 순환
  // 버튼, 페인트-전 스크립트가 모두 그 속성을 쓰므로 여기선 속성 변화를 지켜보며 따라간다.
  const [ambientModeState, setAmbientModeState] = useState<AmbientMode>("on");
  useEffect(() => {
    const read = () => setAmbientModeState(ambientMode());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient"] });
    return () => mo.disconnect();
  }, []);

  // 잠금: 계절 배경 끔 ⇔ 배경 효과 '끄기'. 두 컨트롤이 한 상태다.
  const changeAmbientMode = useCallback((mode: AmbientMode) => {
    if (ambientMode() !== mode) setAmbientMode(mode);
    setAmbientModeState(mode);
    if (mode !== "off" && gfxPref() === "off") {
      setGfxPref("auto");
      setGfxPrefState("auto");
    }
    hapticTick();
  }, []);
  const changeGfxPref = useCallback((pref: GfxPref) => {
    setGfxPref(pref); // localStorage + <html data-gfx> 즉시(배경 레이어는 속성을 지켜본다)
    setGfxPrefState(pref);
    if (pref === "off" && ambientMode() !== "off") {
      setAmbientMode("off");
      setAmbientModeState("off");
    }
    hapticTick();
  }, []);

  return {
    hapticsSupported,
    hapticsOn,
    toggleHaptics,
    reduceMotion,
    toggleReduceMotion,
    eyeComfort,
    toggleEyeComfort,
    dark,
    toggleDark,
    ambientMode: ambientModeState,
    changeAmbientMode,
    gfxPref: gfxPrefState,
    gfxAuto,
    changeGfxPref
  };
}
