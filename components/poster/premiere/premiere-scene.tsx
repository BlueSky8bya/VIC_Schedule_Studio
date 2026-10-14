"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { PremiereReferencePortrait } from "./premiere-reference-portrait";

// Local cast interactions never claim audience counts or still-gated content.
export type PremiereReaction = { serial: number; kind: "delighted" | "unimpressed"; generation: string };
const company = [
  { x: 6, size: .78, seed: 0 }, { x: 19, size: 1, seed: 1.7 },
  { x: 32, size: .82, seed: 3.8 }, { x: 45, size: 1, seed: 5.2 },
  { x: 58, size: .76, seed: 7.9 }, { x: 71, size: .9, seed: 9.6 }
];
export function PremiereScene({ pulse, reaction, hopeful, calm, generation, cheer, onCheer }: { pulse: number; reaction: PremiereReaction | null; hopeful: boolean; calm: boolean; generation: string; cheer: number; onCheer: () => void }) {
  const audience = useRef<HTMLDivElement>(null);
  const expression = hopeful ? "delighted" : reaction?.kind === "unimpressed" ? "unimpressed" : "neutral";
  useEffect(() => {
    if (audience.current) {
      if (cheer) audience.current.dataset.cheerAt = String(performance.now());
      else delete audience.current.dataset.cheerAt;
    }
  }, [cheer]);
  return <>
    <div className="pm-scene" aria-hidden="true">
      <div className="pm-folds"><i /><i /></div>
      {pulse ? <div className="pm-wish" key={pulse}><span>✦</span><i /><i /><i /><i /></div> : null}
    </div>
    {/* In-flow cast bay. Stable native buttons keep keyboard focus as frames
        change; decorative art has its own accessibility boundary. */}
    <div className="pm-cast-row">
      <div className="pm-company" ref={audience} data-reaction={reaction?.kind} data-cheer={cheer ? "" : undefined}>
        <div className="pm-audience-line" aria-hidden="true" />
        {company.map((member, index) => <button type="button" className="pm-fan" key={index} data-pm-audience-control data-sfx="off" aria-label={`빅타민 ${index + 1} 응원하기`} onClick={onCheer} style={{ "--fan-x": `${member.x}%`, "--fan-size": member.size, "--fan-seed": member.seed, "--fan-index": index } as CSSProperties}>
          <span className="pm-fan-art" aria-hidden="true" />
        </button>)}
      </div>
      <div className="pm-host" aria-hidden="true" data-reaction={expression === "neutral" ? undefined : expression}>
        <PremiereReferencePortrait key={generation} expression={expression} calm={calm} />
      </div>
    </div>
  </>;
}

export function PremierePortrait() {
  return <Image src="/premiere/tori-invitation.webp" width={640} height={640} alt="" sizes="(max-width: 1040px) 160px, 300px" unoptimized draggable={false} />;
}
