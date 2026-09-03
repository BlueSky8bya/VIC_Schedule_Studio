// 그래픽 여력 판정 v3(2026-09-04) — 배경 효과(물결·계절 캔버스)와 눈 편한 테마의 루트 filter를 기기에 맞춘다.
//
// v2까지의 문제(토리님 실사고, 2026-09-04): 로드 3초 뒤 rAF 간격 1.5초×2가 나쁘면 'lite'로 박고 물결을 통째로
// 숨겼다(→ "물결이 잠깐 떴다가 몇 초 뒤 사라짐") + 눈 편한 테마를 토큰 팔레트로 바꿨다(→ 태그·카드 원색이 그대로라
// "눈 편한 테마가 OFF"처럼 보임). 스트리밍 PC는 OBS 인코딩·게임 부하로 프레임이 흔들려 GPU가 멀쩡해도 오판했다.
//
// v3 = 세 단계 + 사용자 우선순위 + 2회 판정:
//   full — 전부. lite — 프레임이 나쁜 기기: 물결 1겹(caustic-b·너울 b 숨김), 캔버스 입자 절반·DPR 1 — **보이게 유지**,
//          루트 filter는 그대로(GPU가 있으면 filter 비용은 0에 가깝다). soft — 소프트웨어 렌더(WebGL 렌더러가
//          SwiftShader/llvmpipe/software) 또는 코어 ≤2: 배경 효과 OFF + 눈 편한 테마 토큰 팔레트(filter가 진짜 비싼 곳).
//   판정: soft는 즉시. lite는 rAF 표본이 나쁜 방문이 **두 번 연속**(7일 안)일 때만 — 한 번은 OBS·로딩 잔여 작업일 수 있다.
//   사용자 우선순위 `vic.gfxPref`(auto/max/lite, 설정 "배경 효과")가 있으면 판정을 덮어쓴다. 자동으로 내려가면
//   `vic:gfx-auto` 이벤트로 알린다(편집실이 토스트로 "설정에서 바꿀 수 있어요"를 띄운다).
// 결과는 30일 기억(vic.gfx, v3 — 옛 세대 기록은 lite/full 모두 다시 잰다). 페인트 전 적용은 app/layout.tsx 스크립트.
// off(2026-09-04 사용자: "가볍게가 아니라 끄기 아니야?") = 배경 효과만 끈다 — soft와 달리 눈 편한 테마 필터는 그대로.
export type GfxMode = "full" | "lite" | "soft" | "off";
export type GfxPref = "auto" | "max" | "lite" | "off";

const GFX_KEY = "vic.gfx";
const GFX_PREF_KEY = "vic.gfxPref";
const STRIKE_KEY = "vic.gfxStrike";
const GFX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STRIKE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAMPLE_MS = 1_500;
const BAD_FRAME_MS = 20;
const BAD_RATIO = 0.08;
const BAD_MEAN_MS = 19;
const GFX_PROBE_VERSION = 3;

type GfxRecord = { mode: GfxMode; at: number; v: number };

function readRecord(): GfxRecord | null {
  try {
    const raw = window.localStorage.getItem(GFX_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<GfxRecord>;
    if (rec.mode !== "lite" && rec.mode !== "full" && rec.mode !== "soft") return null; // 기기 판정엔 off가 없다
    if (typeof rec.at !== "number" || Date.now() - rec.at > GFX_TTL_MS) return null;
    if (rec.v !== GFX_PROBE_VERSION) return null; // 옛 세대(v2 lite 포함)는 다시 잰다
    return { mode: rec.mode, at: rec.at, v: rec.v };
  } catch {
    return null;
  }
}

function remember(mode: GfxMode): void {
  try {
    window.localStorage.setItem(GFX_KEY, JSON.stringify({ mode, at: Date.now(), v: GFX_PROBE_VERSION } satisfies GfxRecord));
  } catch {
    /* 저장소 불가 — 이번 세션만 */
  }
}

/** 설정 "배경 효과" — auto(기기 판정) / max(항상 최대) / lite(가볍게). */
export function gfxPref(): GfxPref {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(GFX_PREF_KEY);
    return v === "max" || v === "lite" || v === "off" ? v : "auto";
  } catch {
    return "auto";
  }
}

/** 기기 판정 결과만(우선순위 무시) — 설정 화면의 "자동(…판정)" 표시용. */
export function gfxAutoMode(): GfxMode {
  if (typeof window === "undefined") return "full";
  return readRecord()?.mode ?? "full";
}

/** 지금 적용할 단계 — 사용자 우선순위 > 기기 판정 > full. */
export function gfxMode(): GfxMode {
  if (typeof window === "undefined") return "full";
  const pref = gfxPref();
  if (pref === "max") return "full";
  if (pref === "lite") return "lite";
  if (pref === "off") return "off";
  return readRecord()?.mode ?? "full";
}

/** 눈 편한 테마 속성값 — 루트 filter("1") 또는 토큰 팔레트("lite", 소프트웨어 렌더에서만). */
export function eyeComfortAttrValue(): "1" | "lite" {
  return gfxMode() === "soft" ? "lite" : "1";
}

/** <html data-gfx> + 눈 편한 속성값을 지금 단계로 맞춘다(설정 변경·판정 직후). 배경 레이어는 CSS·엔진이 속성을 지켜본다. */
export function applyGfxMode(mode: GfxMode = gfxMode()): void {
  try {
    const root = document.documentElement;
    if (mode === "full") root.removeAttribute("data-gfx");
    else root.setAttribute("data-gfx", mode);
    if (root.hasAttribute("data-eye-comfort")) root.setAttribute("data-eye-comfort", mode === "soft" ? "lite" : "1");
  } catch {
    /* no-op */
  }
}

export function setGfxPref(pref: GfxPref): void {
  try {
    if (pref === "auto") window.localStorage.removeItem(GFX_PREF_KEY);
    else window.localStorage.setItem(GFX_PREF_KEY, pref);
  } catch {
    /* 무시 */
  }
  applyGfxMode();
  // 장면 엔진(scene-engine.ts)이 여력 띠를 다시 잡게 — max/lite는 data-gfx가 안 바뀌어도 고정값이 달라진다.
  try {
    window.dispatchEvent(new CustomEvent("vic:gfx-pref", { detail: { pref } }));
  } catch {
    /* no-op */
  }
}

/** 소프트웨어 렌더인가 — WebGL 렌더러 문자열(SwiftShader·llvmpipe·software·Basic Render). 컨텍스트는 바로 놓는다. */
function softwareRenderer(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false; // WebGL 자체가 꺼진 환경은 알 수 없다 — 벌주지 않는다
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(renderer);
  } catch {
    return false;
  }
}

function readStrike(): number {
  try {
    const raw = window.localStorage.getItem(STRIKE_KEY);
    if (!raw) return 0;
    const rec = JSON.parse(raw) as { n?: number; at?: number };
    if (typeof rec.at !== "number" || Date.now() - rec.at > STRIKE_TTL_MS) return 0;
    return typeof rec.n === "number" ? rec.n : 0;
  } catch {
    return 0;
  }
}
function writeStrike(n: number): void {
  try {
    if (n <= 0) window.localStorage.removeItem(STRIKE_KEY);
    else window.localStorage.setItem(STRIKE_KEY, JSON.stringify({ n, at: Date.now() }));
  } catch {
    /* 무시 */
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

function notify(mode: GfxMode): void {
  try {
    window.dispatchEvent(new CustomEvent("vic:gfx-auto", { detail: { mode } }));
  } catch {
    /* no-op */
  }
}

/** 한 번만 부른다(레이아웃의 GfxProbe). */
export async function probeGfx(): Promise<void> {
  if (typeof window === "undefined") return;
  if (gfxPref() !== "auto") {
    applyGfxMode();
    return;
  }
  const rec = readRecord();
  if (rec) {
    applyGfxMode(rec.mode);
    return;
  }
  if (softwareRenderer() || (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2)) {
    remember("soft");
    applyGfxMode("soft");
    notify("soft");
    return;
  }
  // 잴 대상이 있을 때만(루트 filter 또는 보이는 배경 레이어). 둘 다 없으면 이 기기에서 비용을 내는 게 없다.
  const root = document.documentElement;
  const filterOn = root.getAttribute("data-eye-comfort") === "1";
  const layer = document.querySelector(".gs-tide, .gs-season");
  const layerOn = !!layer && getComputedStyle(layer).display !== "none";
  if (!filterOn && !layerOn) return;
  await wait(3_000);
  if (document.hidden) return;
  if (!isBadSample(await sampleFrames(SAMPLE_MS))) {
    remember("full");
    writeStrike(0);
    return;
  }
  await wait(1_000);
  if (document.hidden) return;
  if (!isBadSample(await sampleFrames(SAMPLE_MS))) {
    remember("full");
    writeStrike(0);
    return;
  }
  // 나쁨 — 이번 방문이 두 번째 연속이면 lite(보이게 유지하되 가볍게), 아니면 기록만 하고 다음 방문에 다시 잰다.
  if (readStrike() >= 1) {
    remember("lite");
    writeStrike(0);
    applyGfxMode("lite");
    notify("lite");
  } else {
    writeStrike(1);
  }
}
