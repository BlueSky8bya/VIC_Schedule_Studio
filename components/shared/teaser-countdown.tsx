"use client";

import { useEffect, useState } from "react";
import "./teaser-countdown.css";

// 최초공개(떡밥) 큰 카운트다운 — 편집실 게이트 카드와 시청자 팝오버(미리보기 포함)가 **같은 컴포넌트**를
// 쓴다(한 기능=한 구현). 설명문 대신 '얼마나 남았는지'가 주인공. 값이 바뀌는 숫자만 key 리마운트로
// 스프링 팝(초 단위 심장박동). reduce-motion은 CSS에서 끈다.
export function TeaserCountdown({ revealAt }: { revealAt: string }) {
  const target = new Date(revealAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, target - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor(left / 3_600_000) % 24;
  const mins = Math.floor(left / 60_000) % 60;
  const secs = Math.floor(left / 1_000) % 60;
  const seg = (value: number, unit: string, id: string, accent = false) => (
    <span className={`tg-seg${accent ? " tg-seg-accent" : ""}`} key={id}>
      {/* key에 값 포함 → 값이 바뀔 때만 리마운트돼 팝 애니메이션이 그 숫자에만 걸린다. */}
      <strong className="tg-num" key={`${id}-${value}`}>
        {String(value).padStart(2, "0")}
      </strong>
      <em className="tg-unit">{unit}</em>
    </span>
  );
  return (
    <div aria-label="공개까지 남은 시간" className="tg-countdown" role="timer">
      {days > 0 ? seg(days, "일", "d") : null}
      {seg(hours, "시간", "h")}
      {seg(mins, "분", "m")}
      {seg(secs, "초", "s", true)}
    </div>
  );
}
