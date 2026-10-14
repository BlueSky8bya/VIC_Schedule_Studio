import Image from "next/image";
import type { CSSProperties } from "react";

// Original resting portrait + reference-led reaction/cheer sprites. Decorative
// cast only, never a claim about audience counts or still-gated content.
export type PremiereReaction = { serial: number; kind: "delighted" | "unimpressed" };
const company = [
  { x: 5, size: .68, seed: 0 }, { x: 18, size: .9, seed: 1.7 },
  { x: 30, size: .72, seed: 3.8 }, { x: 43, size: 1, seed: 5.2 },
  { x: 56, size: .66, seed: 7.9 }, { x: 69, size: .82, seed: 9.6 }
];
export function PremiereScene({ pulse, reaction, cheer }: { pulse: number; reaction: PremiereReaction | null; cheer: number }) {
  return <div className="pm-scene" aria-hidden="true">
    <div className="pm-folds"><i /><i /></div>
    <div className="pm-company" key={`crew-${cheer}`} data-reaction={reaction?.kind} data-cheer={cheer ? "" : undefined}>
      <div className="pm-audience-line" />
      {company.map((member, index) => <div className="pm-fan" key={index} style={{ left: `${member.x}%`, "--fan-size": member.size, "--fan-seed": member.seed, "--fan-delay": `${index * 65}ms` } as CSSProperties}>
        <div className="pm-fan-bounce"><CastImage name="victamin-cheer" /><CastImage name="victamin-seated" /></div>
      </div>)}
    </div>
    <div className="pm-host" data-reaction={reaction?.kind}><div key={reaction?.serial ?? 0} className={reaction ? `pm-host-response pm-host-${reaction.kind}` : undefined}>
      <PremierePortrait />
      <div className="pm-expression pm-delighted"><CastImage name="victory-delighted" /></div>
      <div className="pm-expression pm-unimpressed"><CastImage name="victory-unimpressed" /></div>
    </div></div>
    {pulse ? <div className="pm-wish" key={pulse}><span>✦</span><i /><i /><i /><i /></div> : null}
  </div>;
}

function CastImage({ name }: { name: string }) {
  return <Image src={`/premiere/${name}.webp`} width={480} height={480} alt="" sizes={name.startsWith("victamin") ? "140px" : "300px"} unoptimized loading="eager" draggable={false} />;
}

export function PremierePortrait() {
  return <Image src="/premiere/tori-invitation.webp" width={640} height={640} alt="" sizes="(max-width: 1040px) 160px, 300px" unoptimized draggable={false} />;
}
