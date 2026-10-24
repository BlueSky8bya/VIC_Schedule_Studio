"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { isPublicMonth, publicMonthHref, readPublicMonth, type PublicMonth } from "./public-month-link";
import { parseViewCookie, VIEW_COOKIE } from "./view-cookie";

/** Only the standalone public entry opts in. Embedded previews keep their URL. */
export function usePublicMonthLink(view: PublicMonth, setView: Dispatch<SetStateAction<PublicMonth>>, enabled: boolean, restoreCookie: boolean) {
  const ready = useRef(false);
  const restoring = useRef<PublicMonth | null>(null);
  const routePath = useRef<string | null>(null);
  const currentView = useRef(view);
  currentView.current = view;
  const restore = useCallback(() => {
      if (!restoreCookie && !enabled) return;
      if (routePath.current !== window.location.pathname) return;
      const linked = enabled ? readPublicMonth(new URL(window.location.href)) : null;
      const mem = parseViewCookie(document.cookie.split("; ").find(c => c.startsWith(`${VIEW_COOKIE}=`))?.slice(VIEW_COOKIE.length + 1));
      const remembered = { year: mem.sy, month: mem.sm };
      const target = linked ?? (restoreCookie && isPublicMonth(remembered) ? remembered : null);
      const changesView = target && (target.year !== currentView.current.year || target.month !== currentView.current.month);
      // An overlay pop often restores the month already shown, so React need
      // not render. Do not leave a pending restore that blocks the next move.
      restoring.current = changesView ? target : null;
      if (changesView) setView(target);
      ready.current = true;
  }, [enabled, restoreCookie, setView]);
  const writeCurrentUrl = useCallback(() => {
    if (!enabled || routePath.current !== window.location.pathname) return;
    const href = publicMonthHref(new URL(window.location.href), currentView.current);
    if (href && href !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, "", href);
    }
  }, [enabled]);
  useEffect(() => {
    routePath.current ??= window.location.pathname;
    restore();
    return () => { ready.current = false; };
  }, [restore]);

  useEffect(() => {
    if (!enabled || !ready.current) return;
    const pending = restoring.current;
    // A mount/pop restore may have scheduled a different view. Never overwrite
    // its explicit URL with the previous render's month while React settles.
    if (pending && (pending.year !== view.year || pending.month !== view.month)) return;
    restoring.current = null;
    writeCurrentUrl();
  }, [enabled, view, writeCurrentUrl]);

  // The existing single overlay pop owner decides whether this is a close
  // echo. A search selection can change the month before history.back lands;
  // that close must preserve the selected view and update the underlying URL.
  return useCallback((preserveView: boolean) => {
    if (!enabled) return;
    if (preserveView) { restoring.current = null; writeCurrentUrl(); }
    else restore();
  }, [enabled, restore, writeCurrentUrl]);
}
