"use client";

import { useLayoutEffect, type RefObject } from "react";
import { COMPANION_DETAIL_EVENT, type CompanionDetailNotice } from "@/lib/ui/viewer-companion/hide-targets";

/** PC popover and agenda sheet share this committed-DOM notification. The
 * existing card input still opens the detail; this bridge never clicks/opens it
 * and creates no observer, timer, sprite request or duplicate detail state. */
export function CompanionDetailBridge({ eventId, sheetRef }: { eventId: string | null; sheetRef: RefObject<HTMLDivElement | null> }) {
  useLayoutEffect(() => {
    const sheet = sheetRef.current, win = sheet?.ownerDocument.defaultView;
    if (!win) return;
    const notice: CompanionDetailNotice = eventId && sheet?.isConnected && sheet.dataset.companionDetailEvent === eventId ? { eventId, sheet } : { eventId: null, sheet: null };
    win.dispatchEvent(new CustomEvent<CompanionDetailNotice>(COMPANION_DETAIL_EVENT, { detail: notice }));
    return () => { win.dispatchEvent(new CustomEvent<CompanionDetailNotice>(COMPANION_DETAIL_EVENT, { detail: { eventId: null, sheet: null } })); };
  }, [eventId, sheetRef]);
  return null;
}
