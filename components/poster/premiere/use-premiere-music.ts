"use client";

import { useEffect } from "react";
import { startPremiereMusic, soundEnabled, soundCats, soundVolume, type PremiereMusic } from "@/lib/ui/sfx";
import { subscribeClock, syncedNow } from "@/lib/ui/synced-clock";

/** Default-on through the master bus. One blocked attempt waits for input;
 * the shared clock never becomes an autoplay retry loop. */
export function usePremiereMusic(active: boolean, target: number) {
  useEffect(() => {
    if (!active) return;
    let music: PremiereMusic | null = null, attempted = false, listening = false;
    const eligible = () => !document.hidden && target - syncedNow() > 10500 && target - syncedNow() <= 68000
      && ("AudioContext" in window || "webkitAudioContext" in window) && soundEnabled() && soundCats().celebrate && soundVolume() > 0;
    const stop = () => { music?.stop(); music = null; };
    const listen = (next: boolean) => {
      if (listening === next) return;
      listening = next;
      if (next) { document.addEventListener("pointerdown", gesture); document.addEventListener("keydown", gesture); }
      else { document.removeEventListener("pointerdown", gesture); document.removeEventListener("keydown", gesture); }
    };
    const start = () => {
      attempted = true; stop(); music = startPremiereMusic();
      if (music && !music.update(target - syncedNow())) stop();
    };
    function gesture(event: Event) {
      if (!event.isTrusted || !eligible() || event.defaultPrevented) return;
      // Leaving the show or navigating focus must not begin music on exit.
      if (event.target instanceof Element && event.target.closest(".pm-banner")) return;
      if (event instanceof KeyboardEvent && (event.repeat || ["Escape", "Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key) || event.key.startsWith("Arrow") || event.metaKey || event.ctrlKey || event.altKey)) return;
      start(); listen(!music?.playing);
    }
    const tick = () => {
      if (!eligible()) { stop(); attempted = false; listen(false); return; }
      if (!attempted) start();
      else if (music && !music.update(target - syncedNow())) stop();
      listen(!music?.playing);
    };
    tick(); const off = subscribeClock(tick);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("vic:sound", tick); window.addEventListener("storage", tick);
    return () => {
      off(); listen(false); stop(); document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("vic:sound", tick); window.removeEventListener("storage", tick);
    };
  }, [active, target]);
}
