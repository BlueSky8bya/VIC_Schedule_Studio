"use client";

import { useEffect, useRef, useState } from "react";

// 값이 바뀔 때 '탁' 튀어오르는 숫자(스코어 등). 변화를 감지해 pop 애니메이션을 한 번 재생한다.
// 작은 수(0→1)는 굴러오름(count-up)이 거의 안 보여 pop이 손맛의 핵심. reduce-motion이면 CSS가 끈다.
export function PopNumber({
  value,
  className
}: {
  value: number | string;
  className?: string;
}) {
  const [popping, setPopping] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPopping(true);
    const t = window.setTimeout(() => setPopping(false), 420);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <span className={`pop-number${popping ? " pop" : ""}${className ? ` ${className}` : ""}`}>
      {value}
    </span>
  );
}
