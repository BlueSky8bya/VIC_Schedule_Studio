import Image from "next/image";

// REF-004, original transparent portrait. No generated face, implied teaser
// content, crowd count or separate animation clock. See the research record.
export function PremiereScene({ pulse }: { pulse: number }) {
  return <div className="pm-scene" aria-hidden="true">
    <div className="pm-folds"><i /><i /></div>
    <div className="pm-host"><div key={pulse} className={pulse ? "pm-host-response" : undefined}>
      <PremierePortrait />
    </div></div>
    {pulse ? <div className="pm-wish" key={pulse}><span>✦</span><i /><i /><i /><i /></div> : null}
  </div>;
}

export function PremierePortrait() {
  return <Image src="/premiere/tori-invitation.webp" width={640} height={640} alt="" sizes="(max-width: 1040px) 160px, 300px" unoptimized draggable={false} />;
}
