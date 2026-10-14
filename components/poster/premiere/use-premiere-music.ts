"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startPremiereMusic, soundEnabled, soundCats, soundVolume, type PremiereMusic } from "@/lib/ui/sfx";
import { subscribeClock, syncedNow } from "@/lib/ui/synced-clock";

/** Opt-in per opening. No autoplay retry, independent timer or network work. */
export function usePremiereMusic(active: boolean, target: number) {
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);
  const music = useRef<PremiereMusic | null>(null);
  const latest = useRef({ active, target }); latest.current = { active, target };
  const stop = useCallback(() => { music.current?.stop(); music.current = null; setPlaying(false); }, []);
  useEffect(() => {
    const tick = () => {
      const current = latest.current;
      const enabled = ("AudioContext" in window || "webkitAudioContext" in window) && soundEnabled() && soundCats().celebrate && soundVolume() > 0;
      setAvailable(enabled);
      if (!current.active || document.hidden || !enabled || current.target - syncedNow() <= 10500) { stop(); return; }
      if (music.current) { if (!music.current.update(current.target - syncedNow())) stop(); else setPlaying(music.current.playing); }
    };
    const visibility = () => { if (document.hidden) stop(); };
    tick(); const off = subscribeClock(tick);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("vic:sound", tick);
    window.addEventListener("storage", tick);
    return () => { off(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("vic:sound", tick); window.removeEventListener("storage", tick); music.current?.stop(); music.current = null; };
  }, [stop]);
  // An owner-edited deadline or a chained next target needs a new opt-in.
  useEffect(() => { stop(); }, [active, target, stop]);
  const toggle = useCallback(() => {
    if (music.current) { stop(); return; }
    const current = latest.current;
    if (!current.active || document.hidden || current.target - syncedNow() <= 10500) return;
    const next = startPremiereMusic();
    if (next) { music.current = next; next.update(current.target - syncedNow()); setPlaying(next.playing); }
  }, [stop]);
  return { playing, available, toggle };
}
