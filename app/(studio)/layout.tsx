// (studio) 라우트 그룹 공용 레이아웃 — 스튜디오·꾸미기 화면의 CSS를 여기서 한 번에 <head>로
// 올린다. page/컴포넌트에서 import하면 loading.tsx 이후 스트리밍으로 늦게 적용돼 모바일 첫 진입에
// 잠깐 무스타일(FOUC)로 보였고, 모바일 편집실 아젠다(.agenda-*는 public-poster.css 정의)가 첫
// 로드에 깨지기도 했다. 레이아웃에서 import하면 그룹의 모든 라우트가 첫 페인트부터 styled.
//
// 공개 포스터 `/`(루트, 이 그룹 밖)는 이 CSS를 받지 않으므로, 비로그인/시청자가 스튜디오 CSS를
// 안 받는 성능 이득은 그대로 유지된다.
import "@/components/poster/public-poster.css";
import "@/components/studio/studio-shell.css";

export default function StudioGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
