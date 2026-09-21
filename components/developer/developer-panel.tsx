"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Monitor, ShieldCheck, Smartphone, Users } from "lucide-react";
import { LIVE_POLL_MS, type LivePresence } from "@/lib/presence/live-types";

type RoleKey = "owner" | "viewer" | "anon" | "developer";
const ROWS: { key: RoleKey; label: string; icon: typeof Users }[] = [
  { key: "owner", label: "관리자", icon: ShieldCheck },
  { key: "viewer", label: "시청자", icon: Eye },
  { key: "anon", label: "비로그인", icon: EyeOff },
  { key: "developer", label: "개발자", icon: Users }
];

type DeviceKey = "desktop" | "android" | "ios" | "mobile";
const DEVICES: { key: DeviceKey; label: string; icon: typeof Monitor }[] = [
  { key: "desktop", label: "웹(PC)", icon: Monitor },
  { key: "android", label: "안드로이드", icon: Smartphone },
  { key: "ios", label: "iOS", icon: Smartphone },
  { key: "mobile", label: "기타 모바일", icon: Smartphone }
];

export function DeveloperPanel() {
  const [counts, setCounts] = useState<LivePresence | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "denied">("loading");
  useEffect(() => {
    let stopped = false;
    let denied = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (stopped || denied || document.visibilityState !== "visible") return;
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 10_000);
      try {
        const response = await fetch("/api/developer/presence", {
          cache: "no-store", credentials: "same-origin", signal: request.signal
        });
        if (stopped || controller !== request) return;
        if (response.status === 401 || response.status === 403) {
          denied = true;
          setCounts(null);
          setStatus("denied");
          return;
        }
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json() as LivePresence;
        if (stopped || controller !== request) return;
        setCounts(data);
        setStatus("ready");
      } catch {
        if (!stopped && controller === request) {
          setCounts(null);
          setStatus("error");
        }
      } finally {
        clearTimeout(timeout);
        if (controller === request) {
          controller = null;
          if (!stopped && !denied && document.visibilityState === "visible") {
            timer = setTimeout(() => void refresh(), LIVE_POLL_MS);
          }
        }
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      const previous = controller;
      controller = null;
      previous?.abort();
      setCounts(null);
      if (!denied) setStatus("loading");
      void refresh();
    };
    document.addEventListener("visibilitychange", visibility);
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const c = counts;
  return (
    <div className="developer-panel">
      <p className="developer-panel-hint">
        현재 열린 화면의 접속 현황 · 15초마다 갱신
      </p>
      <div className="developer-panel-live">
        <div className="dp-live-tile is-watching">
          <strong>{c ? c.total : "…"}</strong>
          <span>활성 화면</span>
        </div>
      </div>
      <p className="developer-panel-hint">
        최근 90초 안에 접속 신호가 있는 세션입니다. 여러 탭은 중복될 수 있고,
        숨겨진 탭은 집계하지 않습니다. 비정상 종료는 약 90초 뒤 다음 갱신에 반영됩니다.
      </p>
      <h3 className="developer-panel-subhead">역할별</h3>
      <ul className="developer-panel-list">
        {ROWS.map(({ key, label, icon: Icon }) => (
          <li key={key} data-role={key}>
            <span className="dp-role">
              <Icon aria-hidden="true" size={16} />
              {label}
            </span>
            <span className="dp-count">{c ? c.roles[key] : "…"}</span>
          </li>
        ))}
      </ul>

      <h3 className="developer-panel-subhead">기기별</h3>
      <ul className="developer-panel-list">
        {DEVICES.map(({ key, label, icon: Icon }) => (
          <li key={key} data-device={key}>
            <span className="dp-role">
              <Icon aria-hidden="true" size={16} />
              {label}
            </span>
            <span className="dp-count">{c ? c.devices[key] : "…"}</span>
          </li>
        ))}
      </ul>

      <p className="developer-panel-hint" role="status">
        {status === "loading" ? "접속 현황을 불러오는 중…" :
          status === "denied" ? "개발자 권한이 필요합니다. 로그인 상태를 확인해 주세요." :
          status === "error" ? "접속 현황을 불러오지 못했어요. 자동으로 다시 시도합니다." :
          c ? `최근 갱신 ${new Date(c.observedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })} (KST)` : ""}
      </p>
    </div>
  );
}
