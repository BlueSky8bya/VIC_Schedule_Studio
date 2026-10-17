"use client";

import "./companion-home-slots.css";

type Host = (node: HTMLDivElement | null) => void;

/** Hosts, rather than duplicate homes: the shared companion moves its one
 * launcher/room here, outside either calendar's scaled capture surface. */
export function CompanionHomeLauncherSlot({ onHost }: { onHost: Host }) {
  return <div className="vc-home-launcher-slot" ref={onHost} />;
}

export function CompanionHomeShelfSlot({ onHost, side }: { onHost: Host; side: "left" | "right" }) {
  return <div className="vc-home-shelf-slot" data-side={side} ref={onHost} />;
}
