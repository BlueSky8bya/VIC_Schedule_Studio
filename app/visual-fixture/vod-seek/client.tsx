"use client";
import { DayVodWindow } from "@/components/poster/day-vod-window";
import { useState } from "react";
export function VodSeekFixture({ access, parts = 2, variant = "page" }: { access: "sub" | "plus" | "public" | "mixed"; parts?: number; variant?: "page" | "modal" }) {
  const [closed, setClosed] = useState(false);
  if (closed) return <p>테스트 창 닫힘</p>;
  return <DayVodWindow dateKey="2020-01-01" slug="fixture" side="left" variant={variant} initialPart={1} initialSec={125} onClose={() => {if (variant === "modal") setClosed(true);}} vods={Array.from({length:parts},(_,i)=>({
    titleNo:42+i,title:i===0?"합성 첫 영상":i===1?"합성 다른 영상":`합성 ${i+1}부 · 제목이 길어도 상단 높이가 바뀌지 않는지 확인하는 영상`,
    ...(access==="mixed"?{host:"합성 합방 스트리머",hostId:"fixture-host"}:{}),
    access:access==="mixed"?[undefined,"sub","plus"][i%3] as "sub"|"plus"|undefined:access==="public"?undefined:access,durationMs:600000,chapters:2
  }))} />;
}
