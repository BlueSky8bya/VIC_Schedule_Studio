// (studio) 라우트 그룹 공용 레이아웃 — 스튜디오·꾸미기 화면의 CSS를 여기서 한 번에 <head>로
// 올린다. page/컴포넌트에서 import하면 loading.tsx 이후 스트리밍으로 늦게 적용돼 모바일 첫 진입에
// 잠깐 무스타일(FOUC)로 보였고, 모바일 편집실 아젠다(.agenda-*는 public-poster.css 정의)가 첫
// 로드에 깨지기도 했다. 레이아웃에서 import하면 그룹의 모든 라우트가 첫 페인트부터 styled.
//
// 공개 포스터 `/`(루트, 이 그룹 밖)는 이 CSS를 받지 않으므로, 비로그인/시청자가 스튜디오 CSS를
// 안 받는 성능 이득은 그대로 유지된다.
import { redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import "@/components/poster/public-poster.css";
import "@/components/studio/studio-shell.css";
import "@/components/studio/broadcast-panel.css";

// 접근 가드 — 스튜디오(/studio 이 그룹 전체)는 비시청자(owner/developer)
// 전용. 시청자(비로그인 포함)가 URL로 직접 들어오면 공개 포스터 `/`로 돌려보낸다. 공개 `/`가
// 비시청자를 /studio로 보내는 것의 정확한 역(逆) — 이 역가드가 없어 시청자가 편집실에 들어가지던
// 보안 버그를 막는다. resolveCurrentActor는 cache()라 page와 중복 조회되지 않는다.
export default async function StudioGroupLayout({ children }: { children: React.ReactNode }) {
  const actor = await resolveCurrentActor("vic");
  if (actor.role === "viewer") {
    redirect("/");
  }
  return children;
}
