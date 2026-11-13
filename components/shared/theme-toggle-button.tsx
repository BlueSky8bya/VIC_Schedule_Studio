"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { resolvedDark, setThemeMode, THEME_EVENT } from "@/lib/ui/theme";
import { hapticTick } from "@/lib/ui/haptics";

/** 밝게 ↔ 어둡게 한 번에(2026-11-13 소유자: "설정 아이콘 옆, 같은 크기"). 설정 창의 '화면 모드'와 같은 값을 바꾸고
 *  서로 따라간다(lib/ui/theme.ts THEME_EVENT). '기기 따라'였다면 지금 보이는 반대쪽으로 고정한다.
 *  시청자 헤더·편집실 헤더 공용 — 모양은 설정 단추(.viewer-settings-open)와 같다. */
export function ThemeToggleButton({ dataAct = "theme-toggle" }: { dataAct?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => setDark(resolvedDark());
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  const label = dark ? "밝은 화면으로" : "어두운 화면으로";
  return (
    <button
      aria-label={label}
      aria-pressed={dark ?? undefined}
      className="viewer-settings-open"
      data-act={dataAct}
      data-tip={label}
      onClick={() => {
        hapticTick();
        setThemeMode(resolvedDark() ? "light" : "dark");
      }}
      type="button"
    >
      {dark ? <Sun aria-hidden="true" size={17} strokeWidth={2.2} /> : <Moon aria-hidden="true" size={17} strokeWidth={2.2} />}
    </button>
  );
}
