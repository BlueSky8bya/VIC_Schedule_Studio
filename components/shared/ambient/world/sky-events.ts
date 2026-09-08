// 밤하늘의 드문 사건(2026-09-08) — 별똥별과 혜성. 소유자: "밤하늘에 확률별로 가끔 지나가는 이벤트로."
//
// **왜 SpawnDirector를 안 쓰나.** 그쪽은 상태를 들고 매 step 굴리는 감독이라 생물에는 맞지만 여기엔 두 가지가 걸린다.
//  ① 결정성 — 하네스의 계약은 "같은 URL = 같은 프레임"이고 `advance(1000)`이 `advance(250)×4`와 같아야 한다
//     (VISUAL_QA_PROTOCOL §3.5-1). 상태를 쌓으면 그 계약이 **step을 어떻게 쪼갰는지**에 기대게 된다.
//  ② 하늘은 `sky.ts` 한 모듈을 열한 바이옴이 공유한다. 모듈에 가변 상태를 두면 두 장면이 같은 프레임에 각자 step을 돌려
//     사건이 두 배로 빨리 흐른다(바이옴을 옮길 때마다 하늘이 어긋난다).
//
// 그래서 **일정표를 미리 정해 둔 것처럼** 만든다: 사건 i의 시작 시각과 성질은 (시드, i)의 순수 함수이고, 지금 t에
// 무엇이 떠 있는지는 그 표를 훑어 찾는다. 밖에서 보면 "가끔 지나가는" 것이고 안에서는 완전히 재현 가능하다.
// 간격은 난수라 주기적으로 보이지 않고, 슬롯마다 확률로 **거르기**까지 해서 "올 줄 알았는데 안 오는" 밤이 생긴다.

import { rng } from "@/components/shared/ambient/scenes/util";

export type SkyEventKind = "shooting-star" | "comet";

export type SkyEventSpec = {
  /** 사건 사이 간격(초) — 이 범위에서 시드 난수로 뽑는다. */
  gap: [number, number];
  /** 한 번 떠 있는 시간(초). */
  dur: number;
  /** 슬롯을 실제로 쓸 확률 — 낮을수록 드물다(1이면 간격마다 반드시 온다). */
  chance: number;
  /** 이 여력 아래에서는 뜨지 않는다(약한 기기에서 드문 장식부터 접는다). */
  minLoad: number;
};

/** 별똥별은 심심찮게, 혜성은 어쩌다. 둘 다 밤·맑은 하늘에서만 부른다(호출 쪽이 판정). */
export const SKY_EVENTS: Record<SkyEventKind, SkyEventSpec> = {
  // 평균 간격 ≈ (18+52)/2 ÷ .55 ≈ 64초 — 감상 중 한두 번은 본다.
  "shooting-star": { gap: [18, 52], dur: 1.1, chance: 0.55, minLoad: 0.3 },
  // 평균 ≈ (120+300)/2 ÷ .4 ≈ 8.8분. 감상을 오래 보고 있으면 한 번쯤 만나는 정도 — 더 드물게 하면
  // 그린 그림을 아무도 못 본다(2026-09-08: 처음 잡은 18분은 대부분의 세션에서 한 번도 안 왔다).
  comet: { gap: [120, 300], dur: 26, chance: 0.4, minLoad: 0.5 }
};

/** 지금 떠 있는 사건 하나. u = 0~1 진행도, r = 이 사건에만 딸린 난수 넷(자리·각도·변형·크기). */
export type SkyEvent = { u: number; r: [number, number, number, number] };

type Stream = { starts: number[]; used: boolean[]; rnd: [number, number, number, number][]; end: number };
const cache = new Map<string, Stream>();

/** (시드, 종류)의 일정표를 t까지 채운다. 순수 — 같은 인자면 언제나 같은 표이고, 캐시는 그걸 다시 계산하지 않으려는 것뿐이다. */
function stream(seed: number, kind: SkyEventKind, t: number): Stream {
  const key = `${seed}|${kind}`;
  let s = cache.get(key);
  if (!s) {
    s = { starts: [], used: [], rnd: [], end: 0 };
    cache.set(key, s);
    if (cache.size > 32) cache.delete(cache.keys().next().value as string);
  }
  const spec = SKY_EVENTS[kind];
  // 표를 t 너머까지만 채운다. i번째 사건의 성질은 i로 시드된 난수라, 어디서부터 채우든 같은 값이 나온다.
  while (s.end <= t + spec.dur) {
    const i = s.starts.length;
    const r = rng((seed * 2654435761 + i * 40503 + kind.length * 7919) >>> 0);
    const gap = spec.gap[0] + r() * (spec.gap[1] - spec.gap[0]);
    s.end += gap;
    s.starts.push(s.end);
    s.used.push(r() < spec.chance);
    s.rnd.push([r(), r(), r(), r()]);
  }
  return s;
}

/** 지금 t에 떠 있는 사건(없으면 null). 겹치지 않는다 — 간격이 지속 시간보다 늘 길다. */
export function skyEventAt(seed: number, kind: SkyEventKind, t: number, load: number): SkyEvent | null {
  const spec = SKY_EVENTS[kind];
  if (load < spec.minLoad || t <= 0) return null;
  const s = stream(seed, kind, t);
  // 뒤에서부터 훑는다 — 활성 사건은 언제나 표의 끝 근처다.
  for (let i = s.starts.length - 1; i >= 0; i--) {
    const t0 = s.starts[i];
    if (t0 > t) continue;
    if (t - t0 > spec.dur) return null; // 이보다 앞선 것은 더 오래됐다
    if (!s.used[i]) return null;
    return { u: (t - t0) / spec.dur, r: s.rnd[i] };
  }
  return null;
}

/** 검증·디버그용 — 앞으로 n초 안에 오는 사건의 시작 시각들. */
export function skyEventSchedule(seed: number, kind: SkyEventKind, until: number): number[] {
  const s = stream(seed, kind, until);
  return s.starts.filter((t0, i) => t0 <= until && s.used[i]);
}
