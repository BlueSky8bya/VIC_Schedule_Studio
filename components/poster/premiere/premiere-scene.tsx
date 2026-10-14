"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

// Local cast interactions never claim audience counts or still-gated content.
const company = [
  { x: 8, size: .78, seed: 0 }, { x: 25, size: 1, seed: 1.7 },
  { x: 42, size: .82, seed: 3.8 }, { x: 58, size: 1, seed: 5.2 },
  { x: 75, size: .76, seed: 7.9 }, { x: 92, size: .9, seed: 9.6 }
];
export function PremiereScene({ pulse, hopeful, cheer, onCheer }: { pulse: number; hopeful: boolean; cheer: number; onCheer: () => void }) {
  const audience = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (audience.current) {
      if (cheer) audience.current.dataset.cheerAt = String(performance.now());
      else delete audience.current.dataset.cheerAt;
    }
  }, [cheer]);
  return <>
    <div className="pm-scene" aria-hidden="true">
      {/* One original photograph, never facial replacement. Loading and rapid
          undo follow the current hope state; no delayed reaction queue. */}
      <div className="pm-wish-backdrop">
        <Image className="pm-wish-photo" data-visible={hopeful && loaded ? "" : undefined} src="/premiere/victory-wish.webp" width={1536} height={864} alt="" unoptimized loading="eager" draggable={false} onLoad={() => setLoaded(true)} />
      </div>
      <div className="pm-folds"><i /><i /></div>
      {pulse ? <div className="pm-wish" key={pulse}><span>✦</span><i /><i /><i /><i /></div> : null}
    </div>
    {/* In-flow cast bay. Stable native buttons keep keyboard focus as frames
        change; decorative art has its own accessibility boundary. */}
    <div className="pm-cast-row">
      <div className="pm-company" ref={audience} data-cheer={cheer ? "" : undefined}>
        <div className="pm-audience-line" aria-hidden="true" />
        {company.map((member, index) => <button type="button" className="pm-fan" key={index} data-pm-audience-control data-sfx="off" aria-label={`빅타민 ${index + 1} 응원하기`} onClick={onCheer} style={{ "--fan-x": `${member.x}%`, "--fan-size": member.size, "--fan-seed": member.seed, "--fan-index": index } as CSSProperties}>
          <span className="pm-fan-art" aria-hidden="true" />
        </button>)}
      </div>
    </div>
  </>;
}

export function PremierePortrait() {
  return <Image src="/premiere/tori-invitation.webp" width={640} height={640} alt="" sizes="(max-width: 1040px) 160px, 300px" unoptimized draggable={false} />;
}
