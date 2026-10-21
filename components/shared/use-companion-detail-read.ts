"use client";

import { useEffect, useRef, type RefObject } from "react";
import { COMPANION_PORTRAIT_READY_EVENT } from "@/lib/ui/viewer-companion/memory-catalog";

/** Reading the selected picture/story acknowledges that item. Tiles merely
 * passing through the page are not read, and no synthetic click is emitted. */
export function useCompanionDetailRead(detail: RefObject<HTMLDivElement | null>, active: boolean, identity: string, acknowledge: () => unknown) {
  const latest = useRef(acknowledge); latest.current = acknowledge;
  useEffect(() => {
    const element = detail.current;
    if (!active || !element) return;
    let timer = 0, visible = false, completed = false;
    const cancel = () => { window.clearTimeout(timer); timer = 0; };
    const readable = () => {
      if (!visible || !element.isConnected || document.visibilityState !== "visible" || !document.hasFocus()
        || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (rect.width < 24 || rect.height < 24 || style.visibility !== "visible" || Number(style.opacity) === 0) return false;
      if ([...element.querySelectorAll<HTMLImageElement>("img")].some(image => !image.complete || !image.naturalWidth)) return false;
      if ([...element.querySelectorAll<HTMLCanvasElement>("canvas[data-collection-art-id]")].some(canvas => canvas.dataset.portraitReady !== "true")) return false;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit !== null && element.contains(hit);
    };
    const schedule = () => {
      cancel();
      if (completed || !readable()) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (!readable()) return;
        completed = true; latest.current();
      }, 1200);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.intersectionRatio >= .8; schedule(); }, { threshold: [0, .8, 1] });
    observer.observe(element);
    window.addEventListener("focus", schedule); window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", schedule); document.addEventListener("scroll", schedule, true);
    element.addEventListener("load", schedule, true);
    element.addEventListener(COMPANION_PORTRAIT_READY_EVENT, schedule, true);
    return () => {
      cancel(); observer.disconnect(); window.removeEventListener("focus", schedule); window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", schedule); document.removeEventListener("scroll", schedule, true); element.removeEventListener("load", schedule, true);
      element.removeEventListener(COMPANION_PORTRAIT_READY_EVENT, schedule, true);
    };
  }, [active, identity, detail]);
}
