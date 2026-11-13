"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./loading-state.css";

// 화면 이동 진행선(2026-11-13 소유자: /privacy·/terms·일정표 사이를 눌렀을 때 넘어가는 중인지 멈춘 건지 모르겠다).
// 같은 출처 <a>(Next <Link> 포함) 클릭을 문서에서 잡아 맨 위 얇은 선을 띄우고, 주소(경로·쿼리)가 바뀌어
// 새 화면이 그려지면 채우고 사라진다. 이동이 아주 빠르면(START_DELAY 안에 끝나면) 선을 아예 띄우지 않는다.
// 패키지 없이 한 파일. 루트 layout의 body 직속이라 [data-export-surface] 바깥이다.

const START_DELAY_MS = 80; // 이보다 빨리 끝난 이동은 깜빡임만 남기므로 생략(약 100ms 안에 보인다)
const GIVE_UP_MS = 15_000; // 이동이 취소·실패해 주소가 안 바뀌면 이만큼 뒤 조용히 거둔다
const DONE_HIDE_MS = 400;

function currentKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

// 클릭이 '같은 탭에서 이 사이트의 다른 화면으로 가는' 링크인지.
function navTarget(e: MouseEvent): string | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const el = e.target as Element | null;
  const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return null;
  if (a.hasAttribute("download") || a.hasAttribute("data-no-nav-progress")) return null;
  const target = a.getAttribute("target");
  if (target && target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const key = `${url.pathname}${url.search}`;
  // 같은 화면(해시만 다른 앵커 포함)은 이동이 아니다.
  if (key === currentKey()) return null;
  return key;
}

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<{ start?: number; giveUp?: number; hide?: number }>({});
  const pendingRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const clearTimers = () => {
      const t = timers.current;
      window.clearTimeout(t.start);
      window.clearTimeout(t.giveUp);
      window.clearTimeout(t.hide);
      timers.current = {};
    };
    const finish = () => {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      const wasShown = timers.current.start === undefined;
      clearTimers();
      if (!wasShown) {
        setState("idle");
        return;
      }
      setState("done");
      timers.current.hide = window.setTimeout(() => setState("idle"), DONE_HIDE_MS);
    };
    const onClick = (e: MouseEvent) => {
      const key = navTarget(e);
      if (!key) return;
      clearTimers();
      pendingRef.current = true;
      timers.current.start = window.setTimeout(() => {
        timers.current.start = undefined;
        if (pendingRef.current) setState("loading");
      }, START_DELAY_MS);
      timers.current.giveUp = window.setTimeout(finish, GIVE_UP_MS);
    };
    // 캡처 단계: <Link>가 preventDefault로 클라이언트 이동을 시작하기 전에 본다(그 뒤엔 기본 동작이 막혀 구분이 어렵다).
    document.addEventListener("click", onClick, true);
    // 뒤로·앞으로는 대개 즉시 그려지므로 띄우지 않고, 남은 선만 정리한다.
    window.addEventListener("popstate", finish);
    finishRef.current = finish;
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", finish);
      clearTimers();
    };
  }, []);

  // 새 화면이 커밋되면 경로·쿼리가 바뀐다 → 진행선을 채우고 거둔다.
  const search = searchParams?.toString() ?? "";
  useEffect(() => {
    finishRef.current();
  }, [pathname, search]);

  return (
    <div aria-hidden="true" className="nav-progress" data-nav-progress="" data-state={state}>
      <span className="nav-progress-bar" />
    </div>
  );
}
