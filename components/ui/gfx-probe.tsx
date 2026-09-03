"use client";

import { useEffect } from "react";
import { probeGfx } from "@/lib/ui/gfx";

// 그래픽 여력 판정을 페이지당 한 번 돌린다(lib/ui/gfx.ts). 렌더 없음.
export function GfxProbe() {
  useEffect(() => {
    void probeGfx();
  }, []);
  return null;
}
