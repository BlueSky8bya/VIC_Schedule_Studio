"use client";

import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "vic.worldcupFeatures";
const CHANGE_EVENT = "vic-worldcup-features-change";

function readStoredVisibility() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * 월드컵 시즌 장식·일정·스코어 표시 상태.
 * controlled 값이 없으면 기기별 localStorage를 사용하고, 같은 출처의 다른 탭과도 동기화한다.
 */
export function useWorldCupVisibility(controlled?: boolean) {
  const [storedVisible, setStoredVisible] = useState(true);
  const isControlled = controlled !== undefined;

  useLayoutEffect(() => {
    if (isControlled) return;

    const sync = () => setStoredVisible(readStoredVisibility());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [isControlled]);

  const setVisible = useCallback(
    (next: boolean) => {
      if (isControlled) return;
      setStoredVisible(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        /* 저장소 불가 환경에서는 현재 탭 상태만 유지 */
        return;
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [isControlled]
  );

  return [controlled ?? storedVisible, setVisible] as const;
}
