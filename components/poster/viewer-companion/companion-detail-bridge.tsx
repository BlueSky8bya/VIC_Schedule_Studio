"use client";

import { useLayoutEffect, type RefObject } from "react";
import { COMPANION_DETAIL_EVENT, type CompanionDetailNotice } from "@/lib/ui/viewer-companion/hide-targets";

/** PC popover and agenda sheet share this committed-DOM notification. The
 * existing card input still opens the detail; this bridge never clicks/opens it
 * and creates no observer, timer, sprite request or duplicate detail state. */
export function CompanionDetailBridge({ eventId, sheetRef, ready }: { eventId: string | null; sheetRef: RefObject<HTMLElement | null>; ready: boolean }) {
  useLayoutEffect(() => {
    const sheet = sheetRef.current, win = sheet?.ownerDocument.defaultView;
    if (!win) return;
    const notice: CompanionDetailNotice = eventId && sheet?.isConnected && sheet.dataset.companionDetailEvent === eventId ? { eventId, sheet, ready: false } : { eventId: null, sheet: null, ready: false };
    win.dispatchEvent(new CustomEvent<CompanionDetailNotice>(COMPANION_DETAIL_EVENT, { detail: notice }));
    return () => { sheet?.removeAttribute("data-companion-detail-ready"); win.dispatchEvent(new CustomEvent<CompanionDetailNotice>(COMPANION_DETAIL_EVENT, { detail: { eventId: null, sheet: null, ready: false } })); };
  }, [eventId, sheetRef]);
  useLayoutEffect(() => {
    const sheet = sheetRef.current, win = sheet?.ownerDocument.defaultView;
    if (!ready || !eventId || !sheet || !win) return;
    let live = true;
    // The parent's layout effect installs the mobile440ms morph after this
    // child effect. One frame sees that actual animation, not an estimated
    // timeout or the hidden first PC positioning pass.
    const frame = win.requestAnimationFrame(() => {
      const animations = sheet.getAnimations().filter(animation => {
        const timing = animation.effect?.getComputedTiming();
        return timing && Number.isFinite(Number(timing.endTime));
      });
      void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (!live || !sheet.isConnected || sheet.dataset.companionDetailEvent !== eventId || !sheet.getClientRects().length || win.getComputedStyle(sheet).visibility === "hidden") return;
        sheet.dataset.companionDetailReady = "";
        win.dispatchEvent(new CustomEvent<CompanionDetailNotice>(COMPANION_DETAIL_EVENT, { detail: { eventId, sheet, ready: true } }));
      });
    });
    return () => { live = false; win.cancelAnimationFrame(frame); };
  }, [eventId, ready, sheetRef]);
  return null;
}
