// 효과음(2026-10-06) — 파일 없이 Web Audio로 짧게 합성한다(에셋·네트워크 0, 1초 미만).
// 앱의 모든 소리는 이 한 곳을 거친다(진동의 lib/ui/haptics.ts와 같은 '두꺼비집' 구조).
//
// 통과해야 울리는 자물쇠:
//   1) 효과음 전체 켜기(vic.sound = 'on') — **기본 꺼짐**: 방송 중 편집실·시청자 화면 소리가 송출에 섞이거나,
//      시청자가 예상 못 한 소리에 놀랄 수 있다.
//   2) 그 소리의 종류가 켜져 있나(축하·누름·편집·알림 — vic.soundCats, 기본 전부 켜짐).
//   3) '다른 탭에 있을 땐 조용히'(vic.soundQuietHidden, 기본 켜짐) — 탭이 안 보일 때(카운트다운 공개 등)는 울리지 않는다.
// 크기는 vic.soundVol(0~100, 기본 60). 다시보기(숲 플레이어) 소리는 플레이어 자신의 것이라 여기서 다루지 않는다.
// 브라우저는 사용자 조작(클릭) 안에서만 소리를 허용한다 — 대부분의 호출은 클릭 처리기 안에서 일어난다.
import type { CelebrationSound } from "@/lib/ui/celebration";

export type SoundCategory = "celebrate" | "tap" | "ui" | "edit" | "alert";
export type SfxName =
  | Exclude<CelebrationSound, "none">
  | "levelup"
  | "heart-on"
  | "heart-off"
  | "hope"
  | "save"
  | "drop"
  | "delete"
  | "fling"
  | "undo"
  | "redo"
  | "link"
  | "unlink"
  | "unlock"
  | "error"
  | "tick"
  | "select"
  | "open"
  | "close"
  | "lift"
  | "page";

const CATEGORY: Record<SfxName, SoundCategory> = {
  fanfare: "celebrate",
  chime: "celebrate",
  bells: "celebrate",
  spooky: "celebrate",
  sparkle: "celebrate",
  pop: "celebrate",
  soft: "celebrate",
  levelup: "celebrate",
  "heart-on": "tap",
  "heart-off": "tap",
  hope: "tap",
  save: "edit",
  drop: "edit",
  delete: "edit",
  fling: "edit",
  undo: "edit",
  redo: "edit",
  link: "edit",
  unlink: "edit",
  unlock: "alert",
  error: "alert",
  tick: "ui",
  select: "ui",
  open: "ui",
  close: "ui",
  lift: "ui",
  page: "ui"
};

const KEY = "vic.sound";
const VOL_KEY = "vic.soundVol";
const CATS_KEY = "vic.soundCats";
const HIDDEN_KEY = "vic.soundQuietHidden";
export const DEFAULT_SOUND_VOLUME = 60;

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 이번 세션만 */
  }
}

export function soundEnabled(): boolean {
  return read(KEY) === "on";
}
export function setSoundEnabled(on: boolean): void {
  write(KEY, on ? "on" : "off");
}
export function soundVolume(): number {
  const v = Number(read(VOL_KEY));
  return read(VOL_KEY) !== null && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_SOUND_VOLUME;
}
export function setSoundVolume(v: number): void {
  write(VOL_KEY, String(Math.min(100, Math.max(0, Math.round(v)))));
}
export type SoundCats = Record<SoundCategory, boolean>;
export function soundCats(): SoundCats {
  const base: SoundCats = { celebrate: true, tap: true, ui: true, edit: true, alert: true };
  try {
    const raw = JSON.parse(read(CATS_KEY) ?? "null") as Partial<SoundCats> | null;
    return raw ? { ...base, ...raw } : base;
  } catch {
    return base;
  }
}
export function setSoundCat(cat: SoundCategory, on: boolean): void {
  write(CATS_KEY, JSON.stringify({ ...soundCats(), [cat]: on }));
}
export function soundQuietHidden(): boolean {
  return read(HIDDEN_KEY) !== "off";
}
export function setSoundQuietHidden(on: boolean): void {
  write(HIDDEN_KEY, on ? "on" : "off");
}

// ── 음색 엔진(2026-10-06 2차 — 소유자: "구리고 촌스러운 거 말고 귀엽고 통통 튀는 애니메이션에 맞게, 애플 형식으로") ──
// 애플 시스템 사운드·HIG에서 가져온 원칙:
//   · 짧게(대부분 60~250ms) — 소리는 손동작의 '확인'이지 음악이 아니다. 진동과 같은 순간에 같은 길이로.
//   · 거친 파형 금지 — 톱니·사각파(삑삑한 전자음)를 쓰지 않는다. 맑은 사인에 배음을 얹어 나무(마림바)·유리(종)·
//     물방울(퐁) 같은 '실제 물건' 소리를 흉내 낸다. 애플 키보드·AirDrop·Pay 확인음이 이 결이다.
//   · 장조·완전 음정 — 올라가면 긍정(저장·하트), 내려가면 되돌림(닫기·끄기). 실패만 단2도로 짧게 '어-어'.
//   · 아주 짧은 잔향 — 마른 소리는 장난감처럼 들린다. 작은 방 정도의 공간을 깔아 부드럽게.
//   · 크기는 압축기로 고르게 — 음마다 들쭉날쭉하지 않고, 음량 100이면 확실히 들리게(1차는 너무 작았다).
// 통통 튀는 화면 움직임(스프링)과 짝: 물방울은 음높이가 '튀어 오르고', 보잉은 스프링처럼 출렁인다.

let ctx: AudioContext | null = null;
let bus: { input: GainNode; ac: AudioContext } | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 공용 출력 버스 — 원음 + 짧은 잔향 → 압축기 → 스피커. 한 번만 만든다. */
function masterBus(ac: AudioContext): GainNode {
  if (bus && bus.ac === ac) return bus.input;
  const input = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const makeup = ac.createGain();
  makeup.gain.value = 1.8; // 압축으로 줄어든 만큼 되돌려 전체를 키운다
  // 잔향 — 0.35초 노이즈 감쇠 임펄스(작은 방). 섞는 비율은 낮게.
  const len = Math.floor(ac.sampleRate * 0.35);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const verb = ac.createConvolver();
  verb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.16;
  input.connect(comp);
  input.connect(verb).connect(wet).connect(comp);
  comp.connect(makeup).connect(ac.destination);
  bus = { input, ac };
  return input;
}

/** 엔벨로프 붙은 사인 하나. f0→f1(bendTo)로 휠 수 있다. */
function partial(ac: AudioContext, out: AudioNode, f: number, t0: number, len: number, vol: number, bendTo = 0, attack = 0.004) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f, t0);
  if (bendTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, bendTo), t0 + Math.min(len, 0.12));
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + len + 0.05);
}

const N = (semi: number) => 523.25 * Math.pow(2, semi / 12); // C5 기준 반음

type Voice = (ac: AudioContext, out: AudioNode, f: number, at: number, vol?: number) => void;
const T = (ac: AudioContext, at: number) => ac.currentTime + at;

/** 마림바 — 나무 건반. 기음 + 4배 배음(빨리 사라짐) = 따뜻하고 통통한 '똥'. */
const marimba: Voice = (ac, out, f, at, vol = 0.32) => {
  const t0 = T(ac, at);
  partial(ac, out, f, t0, 0.42, vol);
  partial(ac, out, f * 4, t0, 0.06, vol * 0.35);
  partial(ac, out, f * 9.9, t0, 0.025, vol * 0.12);
};
/** 유리 종 — 맑게 반짝. 비조화 배음(2.76·5.4배)이 '유리'처럼 들린다. */
const glass: Voice = (ac, out, f, at, vol = 0.22) => {
  const t0 = T(ac, at);
  partial(ac, out, f, t0, 0.7, vol);
  partial(ac, out, f * 2.76, t0, 0.32, vol * 0.4);
  partial(ac, out, f * 5.4, t0, 0.14, vol * 0.18);
};
/** 물방울 — 음높이가 위로 톡 튀어 오르는 '퐁'(통통 튀는 화면과 짝). */
const bubble: Voice = (ac, out, f, at, vol = 0.3) => {
  const t0 = T(ac, at);
  partial(ac, out, f * 0.6, t0, 0.13, vol, f * 1.5, 0.003);
};
/** 내려앉는 물방울 — 닫기·끄기. */
const drip: Voice = (ac, out, f, at, vol = 0.26) => {
  const t0 = T(ac, at);
  partial(ac, out, f * 1.4, t0, 0.14, vol, f * 0.7, 0.003);
};
/** 보잉 — 스프링처럼 출렁이는 음(비브라토가 점점 잦아든다). */
const boing: Voice = (ac, out, f, at, vol = 0.24) => {
  const t0 = T(ac, at);
  const o = ac.createOscillator();
  const g = ac.createGain();
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f, t0);
  lfo.frequency.setValueAtTime(14, t0);
  depth.gain.setValueAtTime(f * 0.18, t0);
  depth.gain.exponentialRampToValueAtTime(1, t0 + 0.35);
  lfo.connect(depth).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
  o.connect(g).connect(out);
  o.start(t0);
  lfo.start(t0);
  o.stop(t0 + 0.48);
  lfo.stop(t0 + 0.48);
};
/** 바람 — 짧은 노이즈를 대역 필터로 쓸어 올리거나 내린다(달 넘김·던지기). */
function swish(ac: AudioContext, out: AudioNode, at: number, from: number, to: number, len: number, vol = 0.3) {
  const t0 = T(ac, at);
  const n = Math.floor(ac.sampleRate * len);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(from, t0);
  bp.frequency.exponentialRampToValueAtTime(to, t0 + len);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + len * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  src.connect(bp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + len + 0.02);
}

function render(ac: AudioContext, out: AudioNode, name: SfxName) {
  switch (name) {
    // ── 축하 ──
    case "fanfare": // 마림바 상행 아르페지오 + 유리 반짝 마무리(도-미-솔-도-미)
      [0, 4, 7, 12].forEach((s, i) => marimba(ac, out, N(s), i * 0.085));
      glass(ac, out, N(16), 0.34, 0.2);
      glass(ac, out, N(24), 0.42, 0.12);
      break;
    case "chime": // 유리 종 두 음(솔→도)
      glass(ac, out, N(7), 0);
      glass(ac, out, N(12), 0.12);
      break;
    case "bells": // 방울 — 유리 종 빠른 반짝임
      [12, 16, 19, 16, 24].forEach((s, i) => glass(ac, out, N(s), i * 0.065, 0.14));
      break;
    case "spooky": // 귀여운 으스스 — 출렁이는 보잉 두 번(내려감)
      boing(ac, out, N(-5), 0);
      boing(ac, out, N(-9), 0.2, 0.2);
      break;
    case "sparkle": // 반짝 — 유리 빠른 상행
      [12, 16, 19, 24, 28].forEach((s, i) => glass(ac, out, N(s), i * 0.045, 0.12));
      break;
    case "soft": // 낮고 조용한 마림바 한 음
      marimba(ac, out, N(-5), 0, 0.22);
      break;
    case "levelup": // 단계 상승 — 물방울 셋 + 유리 마무리
      [0, 4, 7].forEach((s, i) => bubble(ac, out, N(s + 7), i * 0.07, 0.24));
      glass(ac, out, N(19), 0.22, 0.2);
      break;
    case "pop": // 기본 축하 — 물방울 퐁 + 작은 반짝
      bubble(ac, out, N(7), 0);
      glass(ac, out, N(19), 0.07, 0.1);
      break;
    // ── 하트·기대 ──
    case "heart-on": // 퐁-퐁 위로(장3도)
      bubble(ac, out, N(4), 0, 0.26);
      bubble(ac, out, N(8), 0.07, 0.24);
      break;
    case "heart-off": // 살짝 내려앉음
      drip(ac, out, N(4), 0, 0.2);
      break;
    case "hope": // 별빛 — 유리 두 점
      glass(ac, out, N(19), 0, 0.16);
      glass(ac, out, N(26), 0.08, 0.12);
      break;
    // ── 누름·이동 ──
    case "tick": // 아주 작은 물방울(진동과 같은 순간)
      bubble(ac, out, N(19), 0, 0.12);
      break;
    case "select": // 고르기 — 마림바 한 점(높게)
      marimba(ac, out, N(12), 0, 0.24);
      break;
    case "open": // 열림 — 물방울 위로
      bubble(ac, out, N(7), 0, 0.26);
      break;
    case "close": // 닫힘 — 물방울 아래로
      drip(ac, out, N(7), 0, 0.22);
      break;
    case "lift": // 집기 — 퐁퐁 떠오름
      bubble(ac, out, N(4), 0, 0.22);
      bubble(ac, out, N(11), 0.05, 0.2);
      break;
    case "page": // 달 넘김 — 종이 넘기는 바람
      swish(ac, out, 0, 900, 3200, 0.16, 0.22);
      break;
    // ── 편집 ──
    case "save": // 저장 — 마림바 완전4도 상행(솔→도)
      marimba(ac, out, N(7), 0);
      marimba(ac, out, N(12), 0.08);
      break;
    case "drop": // 놓기 — 낮은 마림바 '똥' + 착지 물방울
      marimba(ac, out, N(-5), 0, 0.3);
      bubble(ac, out, N(7), 0.04, 0.12);
      break;
    case "delete": // 삭제 — 내려앉는 두 음
      drip(ac, out, N(7), 0, 0.22);
      marimba(ac, out, N(-5), 0.07, 0.2);
      break;
    case "fling": // 던지기 — 휙 + 멀어지는 물방울
      swish(ac, out, 0, 3000, 500, 0.3, 0.3);
      drip(ac, out, N(12), 0.05, 0.14);
      break;
    case "undo": // 되돌리기 — 짧게 내려감
      drip(ac, out, N(9), 0, 0.2);
      break;
    case "redo": // 다시 — 짧게 올라감
      bubble(ac, out, N(9), 0, 0.2);
      break;
    case "link": // 잇기 — 마림바 두 점 딸깍(위로)
      marimba(ac, out, N(12), 0, 0.22);
      marimba(ac, out, N(19), 0.06, 0.2);
      break;
    case "unlink": // 끊기 — 한 점 툭(아래로)
      marimba(ac, out, N(7), 0, 0.2);
      drip(ac, out, N(2), 0.03, 0.12);
      break;
    // ── 알림 ──
    case "unlock": // 열림 — 유리 장3화음 상행
      [0, 4, 7].forEach((s, i) => glass(ac, out, N(s + 12), i * 0.07, 0.18));
      break;
    case "error": // 실패 — 귀엽게 '어-어'(마림바 단2도 하행)
      marimba(ac, out, N(-3), 0, 0.26);
      marimba(ac, out, N(-4), 0.13, 0.24);
      break;
    default:
      bubble(ac, out, N(7), 0);
      break;
  }
}

// '톡'(tick)은 진동 hapticTick과 같은 순간에 자동으로 붙는다(lib/ui/haptics). 같은 손동작에서 더 구체적인 소리
// (하트·놓기·저장…)가 나면 '톡'은 양보한다 — 호출 순서와 무관하게: 톡은 한 틱 미뤄 두고, 그 사이 다른 소리가 났으면 버린다.
let lastSpecificAt = 0;

/** 소리 하나. 자물쇠(전체 켜기·종류·다른 탭)를 여기서 다 본다 — 호출부는 이름만 부르면 된다. */
export function playSfx(name: SfxName, opts: { force?: boolean } = {}): void {
  if (name === "tick" && !opts.force) {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      if (performance.now() - lastSpecificAt < 80) return;
      playNow("tick");
    }, 0);
    return;
  }
  lastSpecificAt = typeof performance !== "undefined" ? performance.now() : 0;
  playNow(name, opts);
}

function playNow(name: SfxName, opts: { force?: boolean } = {}): void {
  if (!opts.force) {
    if (!soundEnabled()) return;
    if (!soundCats()[CATEGORY[name]]) return;
    if (soundQuietHidden() && typeof document !== "undefined" && document.hidden) return;
  }
  const vol = soundVolume();
  if (vol <= 0) return;
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  // 크기 곡선 — 1.6제곱(낮은 쪽은 섬세하게, 100이면 압축기 뒤에서 또렷하게). 1차(제곱×0.9, 음마다 0.04~0.16)는 너무 작았다.
  out.gain.value = Math.pow(vol / 100, 1.6) * 1.2;
  out.connect(masterBus(ac));
  render(ac, out, name);
}

/** 기념일 테마 소리(lib/ui/celebration의 sound 이름). */
export function playCelebration(sound: CelebrationSound): void {
  if (sound === "none") return;
  playSfx(sound);
}
