"use client";

import "./companion-home-slots.css";

type Host = (node: HTMLDivElement | null) => void;

/** The single launcher lives in actual header chrome, outside either
 * calendar's scaled capture surface. The runtime owns its floating room. */
export function CompanionHomeLauncherSlot({ onHost }: { onHost: Host }) {
  return <div className="vc-home-launcher-slot" ref={onHost} />;
}

export function CompanionHomeShelfSlot({ onHost, side }: { onHost: Host; side: "left" | "right" }) {
  //098 replaces097's reserved shelf with a body-level floating room. Retain
  // this surface-lifetime marker for the shared runtime, without a blank row.
  return <div className="vc-home-shelf-slot" data-side={side} hidden ref={onHost} />;
}
