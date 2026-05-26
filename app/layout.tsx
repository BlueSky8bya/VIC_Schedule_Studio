import type { Metadata } from "next";
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${gaegu.variable} ${blackHanSans.variable} ${nanumMyeongjo.variable} ${jua.variable} ${doHyeon.variable} ${nanumPen.variable} ${gamja.variable} ${gugi.variable} ${hiMelody.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
