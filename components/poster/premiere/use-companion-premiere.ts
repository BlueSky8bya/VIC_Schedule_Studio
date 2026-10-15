"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";
import { companionPremiereGeneration, companionPremiereItems, companionPremiereSourceStatus, isCompanionPremiereId, type CompanionPremiereCue, type CompanionPremiereExit, type CompanionPremiereItem } from "@/lib/ui/viewer-companion/premiere";

/** Semantic handoff only. The conductor owns time and the single creature
 * renderer owns movement; this hook owns neither a second clock nor a sprite. */
export function useCompanionPremiere(frame: PremiereFrame, enabled: boolean, close: () => void) {
  const instance = useId(), pauseKey = `premiere-stage-${instance}`;
  const session = useRef<{ opening: number; active: boolean; cancelled: boolean; source?: Pick<CompanionPremiereItem, "id" | "revealAt">; generation: string; target: number; items: CompanionPremiereItem[] }>({ opening: 0, active: false, cancelled: false, generation: "", target: 0, items: [] });
  const [join, setJoin] = useState<{ generation: string; id: string } | null>(null);
  const joinedRef = useRef(join), closedGeneration = useRef("");
  const [exit, setExit] = useState<CompanionPremiereExit | undefined>();
  const serial = useRef(0);
  const projected = companionPremiereItems(frame.items);
  const active = enabled && frame.phase !== "idle" && frame.phase !== "return";
  const memory = session.current;
  const status = memory.source ? companionPremiereSourceStatus(memory.source, projected) : "missing";
  if (active && (!memory.active || !memory.source || status === "rescheduled" || status === "missing" && joinedRef.current?.generation !== memory.generation)) {
    memory.opening = memory.opening >= Number.MAX_SAFE_INTEGER ? 1 : memory.opening + 1;
    memory.generation = companionPremiereGeneration(projected, memory.opening);
    memory.source = projected.find(item => item.id === memory.source?.id) ?? projected.find(item => item.state === "masked") ?? projected[0];
    memory.cancelled = false;
  } else if (active && status === "missing") {
    if (joinedRef.current?.generation === memory.generation) memory.cancelled = true;
  }
  // Return belongs to this same opening. Only idle/OFF arms a fresh opening;
  // later chain members never replace the frozen cohort generation.
  if (!enabled || frame.phase === "idle") memory.active = false;
  else if (active) memory.active = true;
  // Keep the last confirmed items through return and the first idle frame so
  // the renderer can consume an explicit return after the page loses inert.
  if (enabled && frame.phase !== "idle" && projected.length) { memory.items = projected; memory.target = frame.target; }
  const cue: CompanionPremiereCue | null = enabled && !memory.cancelled ? {
    owner: pauseKey, generation: memory.generation, phase: frame.phase,
    target: frame.phase === "idle" ? memory.target : frame.target,
    items: frame.phase === "idle" || !projected.length ? memory.items : projected,
    ...(exit?.generation === memory.generation ? { exit } : {}),
  } : null;
  const latest = useRef({ frame, enabled, close, cue });
  latest.current = { frame, enabled, close, cue };

  const onJoin = useCallback((generation: string, id: string) => {
    const current = latest.current;
    if (!current.enabled || !current.cue || current.cue.generation !== generation || !generation
      || current.frame.phase === "idle" || current.frame.phase === "return" || closedGeneration.current === generation
      || !isCompanionPremiereId(id) || !current.cue.items.some(item => item.id === id) || joinedRef.current?.generation === generation) return;
    const source = current.cue.items.find(item => item.id === id)!;
    session.current.source = { id: source.id, revealAt: source.revealAt };
    const next = { generation, id }; joinedRef.current = next; setJoin(next);
  }, []);

  const onClose = useCallback((reason: "calendar" | "dismiss" = "dismiss") => {
    const current = latest.current, generation = current.cue?.generation ?? "";
    if (generation && closedGeneration.current === generation) return;
    if (generation) closedGeneration.current = generation;
    const joined = joinedRef.current;
    if (reason === "calendar" && current.enabled && current.cue && joined?.generation === generation
      && current.frame.phase !== "idle" && current.frame.phase !== "return") {
      const released = current.frame.items.filter(item => item.state === "released" && isCompanionPremiereId(item.id) && current.cue!.items.some(allowed => allowed.id === item.id && allowed.state === "released"));
      const target = released.find(item => item.id === joined.id) ?? [...released].sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0];
      if (target) {
        serial.current = serial.current >= Number.MAX_SAFE_INTEGER ? 1 : serial.current + 1;
        setExit({ token: serial.current, generation, id: target.id });
      }
    }
    current.close();
  }, []);

  return { cue, pauseKey, onClose, onJoin, joined: Boolean(enabled && cue?.generation && join?.generation === cue.generation) };
}
