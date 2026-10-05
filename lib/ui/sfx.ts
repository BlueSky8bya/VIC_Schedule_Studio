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

let ctx: AudioContext | null = null;
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

/** 음 하나 — 주파수·시작(초)·길이(초)·파형·크기. 짧은 어택 + 지수 감쇠(종·현 느낌). bend = 끝 주파수 배율. */
function note(ac: AudioContext, out: AudioNode, f: number, at: number, len: number, type: OscillatorType, vol: number, bend = 0) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  const t0 = ac.currentTime + at;
  o.frequency.setValueAtTime(f, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * bend), t0 + len);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + len + 0.05);
}

const N = (semi: number) => 523.25 * Math.pow(2, semi / 12); // C5 기준 반음

function render(ac: AudioContext, out: AudioNode, name: SfxName) {
  switch (name) {
    case "fanfare": // 도-미-솔-도↑ 금관 느낌(톱니 + 사각 겹침)
      [0, 4, 7, 12].forEach((s, i) => {
        note(ac, out, N(s), i * 0.11, i === 3 ? 0.55 : 0.16, "sawtooth", 0.07);
        note(ac, out, N(s), i * 0.11, i === 3 ? 0.55 : 0.16, "square", 0.04);
      });
      break;
    case "chime": // 맑은 종 두 음(사인 + 배음)
      [7, 12].forEach((s, i) => {
        note(ac, out, N(s), i * 0.14, 0.9, "sine", 0.16);
        note(ac, out, N(s) * 2.01, i * 0.14, 0.5, "sine", 0.05);
      });
      break;
    case "bells": // 방울 — 빠른 삼각파 반짝임
      [12, 16, 19, 16, 24].forEach((s, i) => note(ac, out, N(s), i * 0.07, 0.35, "triangle", 0.1));
      break;
    case "spooky": // 내려가는 단조 + 살짝 휘는 음
      [7, 6, 3, -2].forEach((s, i) => note(ac, out, N(s - 12), i * 0.15, 0.4, "triangle", 0.12, 0.94));
      break;
    case "sparkle": // 올라가는 반짝임
      [12, 16, 19, 24, 28].forEach((s, i) => note(ac, out, N(s), i * 0.05, 0.25, "sine", 0.08));
      break;
    case "soft": // 낮고 조용한 한 음
      note(ac, out, N(-5), 0, 0.9, "sine", 0.1);
      break;
    case "levelup": // 단계 상승 — 빠르게 올라가는 네 음 + 마지막 반짝
      [0, 4, 7, 11, 12].forEach((s, i) => note(ac, out, N(s + 7), i * 0.06, i === 4 ? 0.45 : 0.12, "triangle", 0.1));
      break;
    case "heart-on": // 톡 하고 위로
      note(ac, out, N(7), 0, 0.12, "sine", 0.14, 1.6);
      note(ac, out, N(19), 0.05, 0.16, "sine", 0.05);
      break;
    case "heart-off": // 살짝 아래로
      note(ac, out, N(5), 0, 0.14, "sine", 0.09, 0.7);
      break;
    case "hope": // 별빛 두 점
      note(ac, out, N(24), 0, 0.22, "sine", 0.07);
      note(ac, out, N(31), 0.06, 0.3, "sine", 0.05);
      break;
    case "save": // 조용한 확인 두 음(위로)
      note(ac, out, N(4), 0, 0.16, "sine", 0.08);
      note(ac, out, N(11), 0.07, 0.24, "sine", 0.07);
      break;
    case "drop": // 내려놓는 툭(낮은 음이 짧게 가라앉음)
      note(ac, out, 220, 0, 0.14, "sine", 0.16, 0.55);
      note(ac, out, N(0), 0.01, 0.06, "triangle", 0.04);
      break;
    case "delete": // 아래로 두 음
      note(ac, out, N(0), 0, 0.12, "triangle", 0.08);
      note(ac, out, N(-5), 0.08, 0.2, "triangle", 0.07, 0.8);
      break;
    case "fling": // 휙 — 높은 데서 길게 떨어지는 활강
      note(ac, out, 900, 0, 0.32, "sine", 0.08, 0.15);
      break;
    case "undo": // 짧게 아래로 되감기
      note(ac, out, N(7), 0, 0.1, "sine", 0.08, 0.75);
      break;
    case "redo": // 짧게 위로
      note(ac, out, N(2), 0, 0.1, "sine", 0.08, 1.33);
      break;
    case "link": // 찰칵 — 맞물리는 두 점(위로)
      note(ac, out, N(12), 0, 0.05, "triangle", 0.09);
      note(ac, out, N(19), 0.05, 0.08, "triangle", 0.08);
      break;
    case "unlink": // 툭 끊기는 소리(아래로)
      note(ac, out, N(14), 0, 0.06, "square", 0.04, 0.6);
      break;
    case "unlock": // 열림 — 맑은 세 음 상행
      [0, 4, 7].forEach((s, i) => note(ac, out, N(s + 12), i * 0.08, i === 2 ? 0.5 : 0.18, "sine", 0.1));
      break;
    case "error": // 낮은 두 음(단2도) — 조용하지만 '아니요'로 들린다
      note(ac, out, N(-12), 0, 0.14, "square", 0.04);
      note(ac, out, N(-11), 0.12, 0.2, "square", 0.04);
      break;
    case "tick": // 아주 짧은 톡(진동과 같은 순간) — 애플 키 클릭처럼 거의 질감만
      note(ac, out, 1800, 0, 0.03, "sine", 0.05, 0.6);
      break;
    case "select": // 고르기 — 또렷한 한 점
      note(ac, out, N(9), 0, 0.07, "triangle", 0.08);
      break;
    case "open": // 열림 — 짧게 위로 미끄러짐
      note(ac, out, N(2), 0, 0.12, "sine", 0.07, 1.5);
      break;
    case "close": // 닫힘 — 짧게 아래로
      note(ac, out, N(9), 0, 0.1, "sine", 0.06, 0.66);
      break;
    case "lift": // 집기 — 살짝 떠오르는 두 점
      note(ac, out, N(4), 0, 0.06, "sine", 0.07);
      note(ac, out, N(11), 0.04, 0.08, "sine", 0.06);
      break;
    case "page": // 달 넘김 — 종이 넘기듯 짧은 활강
      note(ac, out, 1400, 0, 0.09, "triangle", 0.04, 0.5);
      break;
    case "pop":
    default: // 톡 — 짧게 위로 휘는 팝
      note(ac, out, N(0), 0, 0.12, "sine", 0.14, 1.8);
      note(ac, out, N(12), 0.06, 0.18, "triangle", 0.06);
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
  // 크기 곡선 — 사람 귀는 로그라 0.5에서 이미 꽤 크다. 제곱으로 낮은 쪽을 넓게(60% ≈ 0.36), 최대 0.9.
  out.gain.value = Math.pow(vol / 100, 2) * 0.9;
  out.connect(ac.destination);
  render(ac, out, name);
}

/** 기념일 테마 소리(lib/ui/celebration의 sound 이름). */
export function playCelebration(sound: CelebrationSound): void {
  if (sound === "none") return;
  playSfx(sound);
}
