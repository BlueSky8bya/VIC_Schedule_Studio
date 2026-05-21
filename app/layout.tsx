import type { Metadata } from "next";
import "./globals.css";
import "./home.css";
import "@/components/poster/public-poster.css";
import "@/components/studio/studio-shell.css";

export const metadata: Metadata = {
  title: "VIC Schedule Studio",
  description: "Streamer-first schedule studio and public poster."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
