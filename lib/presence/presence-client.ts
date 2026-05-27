"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { MembershipRole } from "@/lib/domain/schedule-types";

// 접속자 현황(개발자 창)용 실시간 프레즌스.
// Supabase Realtime Presence는 서버 DB 없이 채널에 모인 사용자 상태를 메모리로 공유한다
// (마이그레이션 불필요). 모든 로그인 사용자가 자기 "역할"만 track하고, 개발자 패널이 합산한다.
// 개인정보(이메일 등)는 절대 싣지 않는다 — 역할 카운트만(공개 채널이라 누구나 구독 가능).

export type DeviceKind = "desktop" | "android" | "ios" | "mobile";

export type PresenceCounts = {
  viewer: number;
  worker: number;
  manager: number;
  owner: number;
  developer: number;
  total: number;
  // 기기별 합계 — 웹(데스크톱) / 안드로이드 / iOS / 기타 모바일.
  devices: { desktop: number; android: number; ios: number; mobile: number };
};

const EMPTY: PresenceCounts = {
  viewer: 0,
  worker: 0,
  manager: 0,
  owner: 0,
  developer: 0,
  total: 0,
  devices: { desktop: 0, android: 0, ios: 0, mobile: 0 }
};

// 클라이언트 UA로 기기 종류를 판별한다(웹/안드로이드/iOS/기타 모바일).
function detectDevice(): DeviceKind {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mobi|Mobile/i.test(ua)) return "mobile";
  return "desktop";
}

const CHANNEL = "presence:vic";

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let counts: PresenceCounts = EMPTY;
let started = false;
const listeners = new Set<(c: PresenceCounts) => void>();

function notify() {
  for (const listener of listeners) listener(counts);
}

function recompute() {
  if (!channel) return;
  const state = channel.presenceState<{ role?: string; device?: string }>();
  const next: PresenceCounts = { ...EMPTY, devices: { ...EMPTY.devices } };
  for (const key of Object.keys(state)) {
    for (const entry of state[key]) {
      const role = entry.role as MembershipRole | undefined;
      if (role && role in next) {
        next[role] += 1;
        next.total += 1;
      }
      const device = entry.device as DeviceKind | undefined;
      if (device && device in next.devices) {
        next.devices[device] += 1;
      }
    }
  }
  counts = next;
  notify();
}

// 모든 로그인 사용자가 마운트 시 1회 호출 — 자기 역할을 프레즌스에 등록한다.
export function startPresence(role: MembershipRole) {
  if (started) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  if (typeof window === "undefined") return;

  started = true;
  try {
    client = createBrowserClient(url, anon);
    const presenceKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    channel = client.channel(CHANNEL, { config: { presence: { key: presenceKey } } });
    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel?.track({ role, device: detectDevice() });
        }
      });
  } catch {
    // 실시간 연결 실패는 조용히 무시 — 접속자 현황은 보조 기능이라 앱 동작을 막지 않는다.
    started = false;
  }
}

// 개발자 패널이 실시간 카운트를 구독한다. 등록 즉시 현재 값을 한 번 전달.
export function subscribePresence(cb: (c: PresenceCounts) => void): () => void {
  listeners.add(cb);
  cb(counts);
  return () => {
    listeners.delete(cb);
  };
}
