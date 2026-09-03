import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  Black_Han_Sans,
  Do_Hyeon,
  Gaegu,
  Gamja_Flower,
  Gugi,
  Hi_Melody,
  Jua,
  Nanum_Myeongjo,
  Nanum_Pen_Script
} from "next/font/google";
import "./globals.css";
// 금생수 스킨 토큰 + 띠 공용 질감(ADR-0016) — globals 뒤에 와야 :root 토큰이 덮인다.
import "./metal-water.css";
// 계절 레이어(ADR-0017) — 물결 위 가을 낙엽·겨울 눈·봄 초목. 게이트·규칙은 파일 머리.
import "./ambient.css";
// 포스터/스튜디오 CSS는 각 컴포넌트가 직접 import한다(아래). 루트에서 전역으로 싣지 않음으로써
// 공개 포스터만 보는 비로그인 시청자가 스튜디오 CSS(220KB)를 렌더 차단으로 받지 않게 한다.
import { PresenceBeacon } from "@/components/presence/presence-beacon";
import { RouteBeacon } from "@/components/activity/route-beacon";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { GfxProbe } from "@/components/ui/gfx-probe";

// #7: 텍스트 스티커 글꼴 선택지(한글 지원). next/font로 로드해 CSS 변수로 노출한다.
// preload:false + subsets 미지정 → 전체 글리프(한글 포함) 로드, 경고 없이.
const gaegu = Gaegu({ weight: ["400", "700"], variable: "--font-gaegu", display: "swap", preload: false });
const blackHanSans = Black_Han_Sans({
  weight: "400",
  variable: "--font-blackhan",
  display: "swap",
  preload: false
});
const nanumMyeongjo = Nanum_Myeongjo({
  weight: ["400", "700", "800"],
  variable: "--font-myeongjo",
  display: "swap",
  preload: false
});
const jua = Jua({ weight: "400", variable: "--font-jua", display: "swap", preload: false });
const doHyeon = Do_Hyeon({ weight: "400", variable: "--font-dohyeon", display: "swap", preload: false });
const nanumPen = Nanum_Pen_Script({
  weight: "400",
  variable: "--font-nanumpen",
  display: "swap",
  preload: false
});
const gamja = Gamja_Flower({ weight: "400", variable: "--font-gamja", display: "swap", preload: false });
const gugi = Gugi({ weight: "400", variable: "--font-gugi", display: "swap", preload: false });
const hiMelody = Hi_Melody({ weight: "400", variable: "--font-himelody", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "VIC Schedule Studio",
  description: "Streamer-first schedule studio and public poster.",
  // 화면에 표시된 이메일(계정 배지의 로그인 이메일 등)을 모바일 브라우저가 자동으로 mailto
  // 링크로 바꿔 탭하면 메일 작성창이 열리던 문제 방지(이메일·전화·주소 자동감지 끄기).
  formatDetection: { email: false, telephone: false, address: false }
};

// actor(GoTrue 왕복)에 기대는 비콘·서비스워커만 떼어낸 꼬리. 루트 레이아웃 본체가 이걸
// await하면 셸 HTML 전체(loading.tsx 스켈레톤 포함)가 인증 왕복이 끝날 때까지 한 바이트도
// 안 나간다 — 콜드 엔트리 흰 화면의 원인. Suspense 뒤로 보내 셸은 즉시 흘려보내고,
// 비콘은 actor가 풀리는 대로 스트리밍으로 뒤따라온다(둘 다 화면에 안 그리는 컴포넌트라
// 늦게 붙어도 시각적 차이 없음).
async function ActorTail() {
  // 로그인 사용자만 실시간 프레즌스에 등록(개발자 창 접속자 현황용). 비로그인은 집계 제외.
  const actor = await resolveCurrentActor("vic");
  return (
    <>
      {/* 방문 비콘은 비로그인 방문자에게도 깐다 — 일일/월별 인사이트에 '비로그인' 도달까지 잡는다.
          (로그인은 실제 역할, 비로그인은 role="anon". 서버가 actor로 실제 기록을 확정한다.) */}
      <PresenceBeacon role={actor.isAuthenticated ? actor.role : "anon"} />
      {/* 오프라인 열람용 서비스워커 — 공개 포스터만 캐시(비공개·스튜디오·쓰기는 손대지 않음).
          신원(이메일/anon)이 바뀌면 캐시를 비워 공유 기기에서 이전 사용자 화면이 안 남게. */}
      <ServiceWorkerRegister
        identity={actor.isAuthenticated ? (actor.email ?? actor.role) : "anon"}
      />
    </>
  );
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${gaegu.variable} ${blackHanSans.variable} ${nanumMyeongjo.variable} ${jua.variable} ${doHyeon.variable} ${nanumPen.variable} ${gamja.variable} ${gugi.variable} ${hiMelody.variable}`}
      // 아래 페인트-전 스크립트가 hydration 전에 <html>에 data-eye-comfort/-reduce-motion을
      // 박는다 → 서버 HTML과 불일치로 루트 hydration이 매번 실패했고, 그 여파로 Next 라우터가
      // router.refresh()의 RSC 응답을 버렸다(비공개 잠금해제가 화면에 반영 안 되던 근본 원인,
      // Playwright 실측). next-themes와 같은 표준 해법: 이 속성 불일치만 무시한다.
      suppressHydrationWarning
    >
      <body>
        {/* '동작 줄이기' 설정을 페인트 전에 <html>에 반영 — 켜둔 사용자는 장식 애니메이션이
            깜빡 떴다 사라지지 않는다(FOUC 방지). 기본 OFF: 인앱에서 'on'을 고른 경우에만 켠다
            (2026-08-27 — OS prefers-reduced-motion 시딩(P1-MOTION-1) 철회, 사용자 결정).
            눈 편한 테마는 기본 ON('off'를 고른 경우에만 끔).
            설정 세대(SETTINGS_EPOCH, lib/ui/motion.ts): 저장된 세대가 다르면 스위치 네 키(생동감·눈 편한·차분·
            계절)를 지워 기본값(전부 ON)으로 한 번 되돌리고 세대를 기록 — 읽기 전에 먼저 돈다(2026-09-04 세대). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,s=localStorage,E=" +
              JSON.stringify(SETTINGS_EPOCH) +
              ",K=" +
              JSON.stringify(SETTINGS_EPOCH_KEY) +
              ";if(s.getItem(K)!==E){s.removeItem('vic.reduceMotion');s.removeItem('vic.eyeComfort');s.removeItem('vic.studioCalm');s.removeItem('vic.ambient');s.setItem(K,E)}" +
              "var v=s.getItem('vic.reduceMotion');if(v==='on')d.setAttribute('data-reduce-motion','1');" +
              // 배경 효과 단계(lib/ui/gfx.ts v3): 사용자 우선순위(vic.gfxPref: max/lite) > 기기 판정(vic.gfx v3, 30일: lite/soft).
              // soft(소프트웨어 렌더)에서만 눈 편한 테마를 필터 대신 토큰 팔레트('lite')로.
              "var gm='full',pf=s.getItem('vic.gfxPref');if(pf==='max'){gm='full'}else if(pf==='lite'||pf==='off'){gm=pf}else{try{var r=JSON.parse(s.getItem('vic.gfx')||'null');if(r&&r.v===3&&(r.mode==='lite'||r.mode==='soft')&&Date.now()-r.at<2592000000)gm=r.mode}catch(e){}}" +
              "if(gm!=='full')d.setAttribute('data-gfx',gm);if(s.getItem('vic.eyeComfort')!=='off')d.setAttribute('data-eye-comfort',gm==='soft'?'lite':'1');d.setAttribute('data-studio-calm','1');" +
              // 계절 배경(vic.ambient, ADR-0017 개정 2): 'off'면 물결·계절 장면 전부 숨김 표식.
              "var am=s.getItem('vic.ambient');if(am==='off'||am==='dim')d.setAttribute('data-ambient',am)}catch(e){}"
          }}
        />
        {children}
        {/* (세로 전용 잠금 오버레이 제거 — P0-RESP-1. 가로 휴대폰은 MOBILE_QUERY의
            (max-height ≤640 + coarse) 절이 이미 모바일 레이아웃으로 잡아 정상 사용 가능한데,
            오버레이가 그 위를 통째로 덮어 사용 자체를 막고 있었다. aria-hidden인데 뒤 UI가
            포커스 가능해 접근성 문제도 있었다.) */}
        {/* 어느 화면을 얼마나 봤는지(0062). 프레즌스와 분리 — deps에 pathname을 넣으면
            SPA 라우팅마다 방문 세션이 끊긴다. */}
        <RouteBeacon />
        {/* actor 의존 꼬리(위 ActorTail 주석 참고) — 셸 스트리밍을 막지 않게 Suspense 뒤로. */}
        <Suspense fallback={null}>
          <ActorTail />
        </Suspense>
        {/* 오프라인/온라인 상태 인앱 표시(배지+복귀 토스트) — export surface 바깥(body 직속)이라 캡쳐 무영향. */}
        <OfflineIndicator />
        {/* 그래픽 여력 판정(눈 편한 테마 필터 vs 라이트 팔레트) — 렌더 없음, 기기당 30일 1회. */}
        <GfxProbe />
        {/* 배포 확인용 커밋 해시는 개발자 화면(편집실 액션바 중앙)에만 표시한다(studio-shell). */}
        {/* Vercel Web Analytics — 방문자/페이지뷰 집계(쿠키리스, 개인정보 친화). */}
        <Analytics />
        {/* Vercel Speed Insights — 실제 사용자 로딩 속도(웹 바이탈) 측정. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
