"use client";

import { useRemainSeconds } from "@/lib/ui/use-remain-seconds";
import "./teaser-countdown.css";

// 최초공개(떡밥) 큰 카운트다운 — 편집실 게이트 카드와 시청자 팝오버(미리보기 포함)가 **같은 컴포넌트**를
// 쓴다(한 기능=한 구현). 설명문 대신 '얼마나 남았는지'가 주인공. 값이 바뀌는 숫자만 key 리마운트로
// 스프링 팝(초 단위 심장박동). reduce-motion은 CSS에서 끈다.
//
// 시계는 카드·링과 같은 공용 훅(useRemainSeconds: ceil + 초 경계 기상)이다. 예전엔 여기만
// 자체 setInterval(1000) + floor를 써서 링(ceil)과 1초 어긋났고, 마운트 시각에 따라 넘어가는
// 순간도 달랐다(2026-09-27 소유자 지적: 링이 나올 때 두 숫자가 다르다).
export function TeaserCountdown({ revealAt }: { revealAt: string }) {
  const target = Date.parse(revealAt);
  const total = useRemainSeconds(Number.isNaN(target) ? null : target) ?? 0;
  const days = Math.floor(total / 86_400);
  const hours = Math.floor(total / 3_600) % 24;
  const mins = Math.floor(total / 60) % 60;
  const secs = total % 60;
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
