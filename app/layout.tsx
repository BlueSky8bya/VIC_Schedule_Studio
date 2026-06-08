import type { Metadata } from "next";
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
import "./home.css";
import "@/components/poster/public-poster.css";
import "@/components/studio/studio-shell.css";
import { PresenceBeacon } from "@/components/presence/presence-beacon";
import { resolveCurrentActor } from "@/lib/auth/actor";

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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 로그인 사용자만 실시간 프레즌스에 등록(개발자 창 접속자 현황용). 비로그인은 집계 제외.
  const actor = await resolveCurrentActor("vic");
  return (
    <html
      lang="ko"
      className={`${gaegu.variable} ${blackHanSans.variable} ${nanumMyeongjo.variable} ${jua.variable} ${doHyeon.variable} ${nanumPen.variable} ${gamja.variable} ${gugi.variable} ${hiMelody.variable}`}
    >
      <body>
        {/* '동작 줄이기' 설정을 페인트 전에 <html>에 반영 — 켜둔 사용자는 장식 애니메이션이
            깜빡 떴다 사라지지 않는다(FOUC 방지). 끄면 평소대로. localStorage 접근 실패는 무시. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;if(localStorage.getItem('vic.reduceMotion')==='on')d.setAttribute('data-reduce-motion','1');if(localStorage.getItem('vic.eyeComfort')!=='off')d.setAttribute('data-eye-comfort','1')}catch(e){}"
          }}
        />
        {children}
        {/* 방문 비콘은 비로그인 방문자에게도 깐다 — 일일/월별 인사이트에 '비로그인' 도달까지 잡는다.
            (로그인은 실제 역할, 비로그인은 role="anon". 서버가 actor로 실제 기록을 확정한다.) */}
        <PresenceBeacon role={actor.isAuthenticated ? actor.role : "anon"} />
        {/* 배포 확인용 커밋 해시는 개발자 화면(편집실 액션바 중앙)에만 표시한다(studio-shell). */}
        {/* Vercel Web Analytics — 방문자/페이지뷰 집계(쿠키리스, 개인정보 친화). */}
        <Analytics />
        {/* Vercel Speed Insights — 실제 사용자 로딩 속도(웹 바이탈) 측정. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
