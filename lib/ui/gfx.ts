// 그래픽 여력 판정(2026-09-03) — 눈 편한 테마의 루트 CSS filter가 약한 기기에서 프레임을 깎는다.
// 실측(소프트웨어 렌더 = GPU 가속 없는 PC 흉내): idle 79fps → 필터 켜면 45fps(20ms 초과 프레임 33%).
// GPU가 있는 기기에선 차이 0. 그래서 기기별로 한 번 재서 '라이트'면 필터 대신 **토큰 팔레트**
// (globals.css `html[data-eye-comfort="lite"]`, 필터 결과를 미리 계산한 색)로 같은 인상을 낸다.
//
// 판정 = 페이지가 자리잡은 뒤(로드+3초) 1.5초씩 두 번 rAF 간격을 재서, 두 번 다 '나쁜 표본'이면
// lite(한 번만 나쁘면 로딩 잔여 작업일 수 있어 무시). 나쁜 표본 = 20ms 초과 프레임 8% 이상 또는
// 평균 간격 19ms 이상(실측: GPU 기기 0~0.4% · 소프트웨어 렌더 16%/49fps — 사이가 넓다).
// 코어 2개 이하면 재지 않고 lite.
// 결과는 30일 기억(vic.gfx) — 매번 재면 첫 3초가 흔들린다. 30일 뒤 다시 잰다(기기 교체·드라이버).
// 눈 편한 테마가 꺼져 있거나 이미 lite면 재지 않는다(측정 대상이 없다).
const GFX_KEY = "vic.gfx";
const GFX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SAMPLE_MS = 1_500;
const BAD_FRAME_MS = 20;
const BAD_RATIO = 0.08;
const BAD_MEAN_MS = 19;

type GfxRecord = { mode: "lite" | "full"; at: number };

function readRecord(): GfxRecord | null {
  try {
    const raw = window.localStorage.getItem(GFX_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<GfxRecord>;
    if ((rec.mode !== "lite" && rec.mode !== "full") || typeof rec.at !== "number") return null;
    if (Date.now() - rec.at > GFX_TTL_MS) return null;
    return { mode: rec.mode, at: rec.at };
  } catch {
    return null;
  }
}

export function gfxLite(): boolean {
  if (typeof window === "undefined") return false;
  return readRecord()?.mode === "lite";
}

/** 눈 편한 테마 속성값 — 필터("1") 또는 토큰 팔레트("lite"). */
export function eyeComfortAttrValue(): "1" | "lite" {
  return gfxLite() ? "lite" : "1";
}

function remember(mode: GfxRecord["mode"]): void {
  try {
    window.localStorage.setItem(GFX_KEY, JSON.stringify({ mode, at: Date.now() } satisfies GfxRecord));
  } catch {
    /* 저장소 불가 — 이번 세션만 */
  }
}

function sampleFrames(ms: number): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = performance.now();
    const end = last + ms;
    const step = (now: number) => {
      gaps.push(now - last);
      last = now;
      if (now < end && !document.hidden) requestAnimationFrame(step);
      else resolve(gaps);
    };
    requestAnimationFrame(step);
  });
}

/** 표본이 '나쁜가' — 20ms 초과 비율 또는 평균 간격. 표본이 너무 적으면(탭 숨김 등) 좋다고 본다. */
function isBadSample(gaps: number[]): boolean {
  if (gaps.length < 20) return false;
  const ratio = gaps.filter((g) => g > BAD_FRAME_MS).length / gaps.length;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return ratio >= BAD_RATIO || mean >= BAD_MEAN_MS;
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** 한 번만 부른다(레이아웃의 GfxProbe). 판정이 lite로 바뀌면 그 자리에서 속성값을 갈아 끼운다. */
export async function probeGfx(): Promise<void> {
  if (typeof window === "undefined") return;
  if (readRecord()) return; // 30일 안에 이미 판정
  const root = document.documentElement;
  if (root.getAttribute("data-eye-comfort") !== "1") return; // 필터가 안 켜져 있으면 잴 것이 없다
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) {
    remember("lite");
    root.setAttribute("data-eye-comfort", "lite");
    return;
  }
  await wait(3_000);
  if (document.hidden) return; // 숨은 탭은 rAF가 안 돌아 잴 수 없다 — 다음 방문에
  if (!isBadSample(await sampleFrames(SAMPLE_MS))) {
    remember("full");
    return;
  }
  await wait(1_000);
  if (document.hidden) return;
  if (!isBadSample(await sampleFrames(SAMPLE_MS))) {
    remember("full");
    return;
  }
  remember("lite");
  if (root.getAttribute("data-eye-comfort") === "1") root.setAttribute("data-eye-comfort", "lite");
}
