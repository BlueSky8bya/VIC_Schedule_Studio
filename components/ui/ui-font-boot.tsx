"use client";

import { useEffect } from "react";
import { fontPref } from "@/lib/ui/font-prefs";
import { attachUiFontCss, needsUiFontCss } from "@/lib/ui/ui-font-css";

// 고른 글꼴이 구글 글꼴이면 그 선언 CSS를 받는다(lib/ui/ui-font-css). 일정표·편집실은 설정 훅의 applyFont도
// 같은 일을 하지만, 문서 화면처럼 그 훅이 없는 화면도 고른 글꼴로 보이게 루트에 둔다. 렌더 없음.
export function UiFontBoot() {
  useEffect(() => {
    const id = fontPref();
    if (needsUiFontCss(id)) void attachUiFontCss(id).catch(() => undefined);
  }, []);
  return null;
}
