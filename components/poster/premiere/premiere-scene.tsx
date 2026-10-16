"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { premiereAudienceSeed } from "@/lib/ui/premiere/company";
import { useCompanionDesktop } from "@/lib/ui/viewer-companion/capability";

// Local cast interactions never claim audience counts or still-gated content.
const company = [8, 25, 42, 58, 75, 92];
export function PremiereScene({ pulse, hopeful, cheer, onCheer, companionJoined = false }: { pulse: number; hopeful: boolean; cheer: number; onCheer: () => void; companionJoined?: boolean }) {
  const companionDesktop = useCompanionDesktop();
  const audience = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  // This scene mounts once per focused opening. Keep this draw through hope,
  // joined-companion and deadline updates; never randomize during a clock tick.
  const [openingSeed] = useState(() => Math.floor(Math.random() * 0x100000000));
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
    {companionDesktop ? <div className="pm-cast-row">
      <div className="pm-company" ref={audience} data-opening={openingSeed} data-cheer={cheer ? "" : undefined}>
        <div className="pm-audience-line" aria-hidden="true" />
        {company.map((x, index) => <button type="button" className="pm-fan" key={index} data-activity-manual="" data-pm-audience-control data-companion-joined={companionJoined && index === 0 ? "" : undefined} data-sfx="off" aria-label={companionJoined && index === 0 ? "우리 빅타민 응원하기" : `빅타민 ${index + 1} 응원하기`} onClick={onCheer} style={{ "--fan-x": `${x}%`, "--fan-seed": premiereAudienceSeed(openingSeed, index), "--fan-index": index } as CSSProperties}>
          <span className="pm-fan-art" aria-hidden="true" />
        </button>)}
      </div>
    </div> : null}
  </>;
}

export function PremierePortrait() {
  return <Image src="/premiere/tori-invitation.webp" width={640} height={640} alt="" sizes="(max-width: 1040px) 160px, 300px" unoptimized draggable={false} />;
}
