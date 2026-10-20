/* eslint-disable @next/next/no-img-element -- Finite local game textures are already packed WebP assets. */
import { normalizeCompanionHomeTv, type CompanionHomeTvChannel } from "@/lib/ui/viewer-companion/home-room-media";

/** Five finite local pictures; the CRT's existing projected plane clips every
 * moving layer. No stream, audio, timer or external image request is started. */
export function CompanionTvPicture({ channel, animate }: { channel: CompanionHomeTvChannel; animate: boolean }) {
  const current = normalizeCompanionHomeTv(channel);
  return <div className="vc-tv-picture" data-channel={current} data-tv-loop={animate || undefined}>
    <img src={current === "tori" ? "/companion/home/143/tv-screen-tori.webp" : `/companion/home/135/tv-screen-${current}.webp`} width="244" height="202" alt="" draggable={false} decoding="async" />
    {current === "tori" ? <><span className="vc-tv-live-dot" /><span className="vc-tv-spark vc-tv-spark-a">✦</span><span className="vc-tv-spark vc-tv-spark-b">♥</span></>
      : current === "nature" ? <svg className="vc-tv-bird" viewBox="0 0 24 10" aria-hidden="true"><path d="M1 7Q6 0 12 7Q18 0 23 7" fill="none" stroke="#77552f" strokeWidth="2" strokeLinecap="round" /></svg>
      : current === "cooking" ? <span className="vc-tv-steam"><i /><i /><i /></span>
      : current === "toys" ? <span className="vc-tv-ball" />
      : <><span className="vc-tv-star vc-tv-star-a">✦</span><span className="vc-tv-star vc-tv-star-b">✧</span></>}
    <span className="vc-tv-glass" />
  </div>;
}
