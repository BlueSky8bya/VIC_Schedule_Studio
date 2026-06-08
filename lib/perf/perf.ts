// 서버 구간별 응답시간 계측(동작 변화 없음 — 측정·로깅만). "여기가 평소보다 느리다 / 벤치마크보다
// 느리다"를 데이터로 잡으려는 토대. 두 가지로 본다:
//  1) timed(label, fn): 각 서버 작업(actor 조회·스케줄 로드·DB 쿼리…)을 감싸 [perf] 로그를 찍는다 →
//     Vercel 로그에서 라우트/구간별 ms 확인·비교. (페이지 서버 컴포넌트는 응답 헤더를 못 박으므로 로그로.)
//  2) ServerTiming: API 라우트(Response 반환)에서 구간을 모아 Server-Timing 헤더로 내보낸다 →
//     브라우저 개발자도구 Network 탭에 구간별 막대로 보인다.
//
// PERF_LOG=off 환경변수로 로깅만 끌 수 있다(측정 코드는 그대로 — 오버헤드는 무시할 수준의 now() 2회).

import { recordPerfSample } from "@/lib/perf/record";

const LOG_ENABLED = process.env.PERF_LOG !== "off";

function now(): number {
  // performance.now()가 없는 런타임(드묾) 대비.
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

// 비동기 작업 한 구간을 재서 [perf] 로그(LOG_ENABLED일 때) + 표본 기록(패널용, 항상). 투명 래퍼.
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = now();
  let ok = true;
  try {
    return await fn();
  } catch (e) {
    ok = false;
    throw e;
  } finally {
    const ms = now() - t0;
    if (LOG_ENABLED) console.log(`[perf] ${label} ${ms.toFixed(1)}ms${ok ? "" : " (error)"}`);
    recordPerfSample(label, ms); // 개발자 인사이트 "서버 성능" 패널용 표본(응답 후 기록)
  }
}

// 동기 구간용(있다면). 거의 비동기라 보조.
export function timedSync<T>(label: string, fn: () => T): T {
  if (!LOG_ENABLED) return fn();
  const t0 = now();
  try {
    return fn();
  } finally {
    console.log(`[perf] ${label} ${(now() - t0).toFixed(1)}ms`);
  }
}

// API 라우트(Response 반환)에서 여러 구간을 모아 Server-Timing 헤더 문자열로. 브라우저 devtools 표시용.
export class ServerTiming {
  private marks: { name: string; dur: number; desc?: string }[] = [];

  // 한 구간을 재서 기록 + (옵션) [perf] 로그도 같이.
  async measure<T>(name: string, fn: () => Promise<T>, desc?: string): Promise<T> {
    const t0 = now();
    try {
      return await fn();
    } finally {
      const dur = now() - t0;
      this.marks.push({ name, dur, desc });
      if (LOG_ENABLED) console.log(`[perf] ${desc ?? name} ${dur.toFixed(1)}ms`);
      recordPerfSample(desc ?? name, dur); // 패널 표본(라벨은 설명 우선)
    }
  }

  // 이미 잰 값을 직접 추가.
  add(name: string, durationMs: number, desc?: string): void {
    this.marks.push({ name, dur: durationMs, desc });
  }

  // "name;dur=12.3;desc=...,..." — Response 헤더 Server-Timing 값.
  header(): string {
    return this.marks
      .map((m) => {
        const d = m.desc ? `;desc=${JSON.stringify(m.desc)}` : "";
        return `${m.name};dur=${m.dur.toFixed(1)}${d}`;
      })
      .join(", ");
  }
}
