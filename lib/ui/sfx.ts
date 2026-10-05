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
  | "page"
  | "page-prev"
  | "tap"
  | "tab"
  | "detent"
  | "toggle-on"
  | "toggle-off"
  | "copy"
  | "paste"
  | "note";

const CATEGORY: Record<SfxName, SoundCategory> = {
  fanfare: "celebrate",
  grand: "celebrate",
  birthday: "celebrate",
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
  page: "ui",
  "page-prev": "ui",
  tap: "ui",
  tab: "ui",
  detent: "ui",
  "toggle-on": "ui",
  "toggle-off": "ui",
  copy: "edit",
  paste: "edit",
  note: "celebrate"
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

// ── 음색 엔진(2026-10-06 3차 — 소유자: "애플 형식으로 각 기능에 맞게 더 통통 튀고 촥 감기게, 더 다양하고
// 귀에 안 거슬리는 부드러운 소리로, 버튼 상호작용·감정 연구자료에 맞게") ──
// 근거(출처 목록은 docs/ux/UI_RULES.md UI-40):
//   · 애플 WWDC19 '오디오-햅틱 디자인': 인과·조화·쓸모. 소리는 화면 움직임과 **같은 박자**(애플페이 체크 = 톡 두 번),
//     날카로운 움직임엔 짧은 어택, 미끄러지는 움직임엔 이어지는 소리(바람). 작은 것은 작게 들려야 한다.
//   · 날카로움 낮게 = '둥글고 부드럽게' — 기본은 낮고, '딸깍 맞물림'(잇기)만 또렷하게.
//   · Brewster 이어콘: 음높이 하나로는 구분이 약하다 → **음 개수·리듬**으로 기능을 가른다(한 점 = 누름,
//     두 점 = 켜기·되돌리기, 세 점 = 해제·단계 상승). 기본음은 200Hz~2kHz, 배음은 5kHz 아래.
//   · 감정: 올라가는 음 = 긍정(켜기·저장·하트), 내려가는 음 = 되돌림(끄기·닫기·삭제). 실패도 불협화(단2도) 대신
//     **같은 낮은 음 두 번**(리듬으로 '어-어') — 거칠지 않게.
//   · 심리음향: 귀는 2~5kHz에 가장 민감·거슬림 → 출력 전체를 부드럽게 깎는다(저역통과 4.2kHz). 겹치는 음은 협화
//     음정(옥타브·5도·4도·장3도)만, 2도 겹침 금지(Plomp–Levelt 거칠기). 어택이 느리고 밝기가 낮을수록 부드럽다.
//   · 길이(Material): 자주 나는 소리 40~120ms, 확인음 ≤260ms, 축하만 길게(드물게).
//   · 반복 피로: 매번 음높이 ±3%·크기 ±1.5dB 흔든다(같은 소리가 기계처럼 반복되지 않게, 알아듣기는 그대로).
//   · 지연: 누른 뒤 20ms 안에 — 버튼 처리기 안에서 바로 낸다. 스프링 착지 소리는 오버슈트 꼭짓점에 작은 '톡'을 더한다.
//   · 끝은 setTargetAtTime으로 0에 수렴(지수 램프로 끊으면 '딱' 잡음).

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

/** 공용 출력 버스 — 원음 + 짧은 잔향 → 부드럽게 깎기(저역통과) → 압축기 → 스피커. 한 번만 만든다. */
function masterBus(ac: AudioContext): GainNode {
  if (bus && bus.ac === ac) return bus.input;
  const input = ac.createGain();
  const soften = ac.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 4200; // 2~5kHz 거슬림 대역을 눌러 둥글게
  soften.Q.value = 0.5;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const makeup = ac.createGain();
  makeup.gain.value = 1.9; // 압축·깎기로 줄어든 만큼 되돌려 100에서 또렷하게
  // 잔향 — 0.3초 노이즈 감쇠 임펄스(작은 방). 마른 소리는 장난감처럼 들린다.
  const len = Math.floor(ac.sampleRate * 0.3);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const verb = ac.createConvolver();
  verb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.14;
  input.connect(soften);
  input.connect(verb).connect(wet).connect(soften);
  soften.connect(comp).connect(makeup).connect(ac.destination);
  bus = { input, ac };
  return input;
}

const N = (semi: number) => 523.25 * Math.pow(2, semi / 12); // C5 기준 반음
let jitter = 1; // 이번 소리의 음높이 흔들림(±3%) — playNow가 정한다

type ToneSpec = {
  f: number; // 시작 음높이
  at?: number; // 시작(초, 지금부터)
  vol?: number;
  tau?: number; // 감쇠 시간상수(초) — 약 5τ 뒤 사라진다
  attack?: number;
  glideTo?: number; // 음높이를 여기로(통통 = 아래→위, 내려앉음 = 위→아래)
  glide?: number; // 미끄러지는 시간
  type?: OscillatorType;
};
/** 소리 하나 — 짧은 어택, 지수 감쇠(끝은 0으로 수렴), 선택적으로 음높이 미끄럼. */
function tone(ac: AudioContext, out: AudioNode, { f, at = 0, vol = 0.3, tau = 0.06, attack = 0.003, glideTo, glide = 0.025, type = "sine" }: ToneSpec) {
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f * jitter, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo * jitter), t0 + glide);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.setTargetAtTime(0, t0 + attack, tau);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + attack + tau * 7);
}

/** 톡(blip) — 삼각파가 0.72배에서 제 음으로 톡 올라선다: 가장 작은 '눌렀다'. */
const blip = (ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.26, tau = 0.03) =>
  tone(ac, out, { f: f * 0.72, glideTo: f, glide: 0.02, at, vol, tau, attack: 0.002, type: "triangle" });
/** 퐁(bubble) — 더 크게 튀어 오르는 물방울(열기·집기·단계 상승). */
const bubble = (ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.28, tau = 0.045) =>
  tone(ac, out, { f: f * 0.6, glideTo: f * 1.12, glide: 0.05, at, vol, tau, attack: 0.003 });
/** 내려앉음(drip) — 위에서 아래로 톡(닫기·끄기). */
const drip = (ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.24, tau = 0.04) =>
  tone(ac, out, { f: f * 1.25, glideTo: f * 0.8, glide: 0.05, at, vol, tau, attack: 0.003 });
/** 마림바 — 나무 건반 모드 합성(1 : 4 : 9.88, 위 모드일수록 빨리 사라진다). 따뜻하고 통통한 '똥'. */
function marimba(ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.3, tau = 0.09) {
  tone(ac, out, { f, at, vol, tau, attack: 0.002 });
  if (f * 4 < 5000) tone(ac, out, { f: f * 4, at, vol: vol * 0.25, tau: tau / 4, attack: 0.001 });
  if (f * 9.88 < 5000) tone(ac, out, { f: f * 9.88, at, vol: vol * 0.08, tau: tau / 8, attack: 0.001 });
}
/** 종(chime) — FM, 반송:변조 = 1:2(협화), 변조 깊이는 1.5에서 소리보다 빨리 0으로 → 반짝이다 맑게 가라앉는다. */
function chime(ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.22, tau = 0.14) {
  const t0 = ac.currentTime + at;
  const fc = f * jitter;
  const car = ac.createOscillator();
  const mod = ac.createOscillator();
  const idx = ac.createGain();
  const g = ac.createGain();
  car.frequency.setValueAtTime(fc, t0);
  mod.frequency.setValueAtTime(fc * 2, t0);
  idx.gain.setValueAtTime(fc * 2 * 1.5, t0);
  idx.gain.setTargetAtTime(0, t0, tau / 3);
  mod.connect(idx).connect(car.frequency);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.002);
  g.gain.setTargetAtTime(0, t0 + 0.002, tau);
  car.connect(g).connect(out);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + tau * 7);
  mod.stop(t0 + tau * 7);
}
/** 보잉 — 튀어 올랐다 출렁이며 자리 잡는 음(오버슈트 → 안착). 하트 '통!'. */
function boing(ac: AudioContext, out: AudioNode, f: number, at = 0, vol = 0.24) {
  const t0 = ac.currentTime + at;
  const fc = f * jitter;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(fc * 0.55, t0);
  o.frequency.exponentialRampToValueAtTime(fc * 1.18, t0 + 0.045); // 튀어 올라 넘침
  o.frequency.exponentialRampToValueAtTime(fc * 0.97, t0 + 0.09); // 살짝 되돌아
  o.frequency.exponentialRampToValueAtTime(fc, t0 + 0.13); // 안착
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
  g.gain.setTargetAtTime(0, t0 + 0.06, 0.05);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + 0.45);
}
/** 바람 — 노이즈를 대역 필터로 쓸어 올리거나(열기·다음 달) 내린다(닫기·이전 달·던지기). */
function whoosh(ac: AudioContext, out: AudioNode, from: number, to: number, len: number, at = 0, vol = 0.22, lowpass = false) {
  const t0 = ac.currentTime + at;
  const n = Math.floor(ac.sampleRate * len * 1.4);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = lowpass ? "lowpass" : "bandpass";
  f.Q.value = lowpass ? 0.7 : 1.5;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + len);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + len * 0.3);
  g.gain.setTargetAtTime(0, t0 + len * 0.45, len / 5);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + len * 1.4);
}

function render(ac: AudioContext, out: AudioNode, name: SfxName) {
  switch (name) {
    // ── 축하(드물게 — 길고 화려해도 된다) ── 장조 아르페지오(1-3-5-8), 반짝임은 작게.
    case "birthday": {
      // 2026-10-06 소유자: "빵빠레 한 번 크게 터지고 생일축하 멜로디" — 큰 빵빠레(마림바 1-3-5-8 + 종) 뒤
      // SONG_DELAY초에 생일 축하 노래(Happy Birthday, 퍼블릭 도메인) 한 절: 3/4박, 오르골(종) 선율 + 마디 첫 박 나무 베이스.
      [0, 4, 7, 12].forEach((s2, i) => marimba(ac, out, N(s2), i * 0.07, 0.32, 0.12));
      chime(ac, out, N(16), 0.28, 0.22, 0.24);
      const t0 = SONG_DELAY;
      for (const n of BIRTHDAY_SONG) chime(ac, out, N(n.semi), t0 + n.at, 0.24, n.len);
      [-24, -17, -17, -24, -24, -19, -24, -24].forEach((semi, m) => marimba(ac, out, N(semi), t0 + (1 + m * 3) * SONG_BEAT, 0.2, 0.22));
      const end = t0 + BIRTHDAY_SONG[BIRTHDAY_SONG.length - 1].at;
      chime(ac, out, N(12), end + 0.08, 0.1, 0.3);
      chime(ac, out, N(16), end + 0.16, 0.08, 0.3);
      break;
    }
    case "note": // 연속 탭 멜로디의 한 음(화음이면 함께) — 오르골 종 + 한 옥타브 아래 나무 받침
      pendingNotes.forEach((semi, k) => {
        chime(ac, out, N(semi), 0, k ? 0.18 : 0.26, 0.22);
        if (k === 0) marimba(ac, out, N(semi - 12), 0, 0.12, 0.08);
      });
      break;
    case "grand": {
      // 의식 빵빠레(데뷔 주년·D+N00) — "따 따 따 따~안!": 같은 음 셋을 빠르게(셋잇단) 두드리고 한 옥타브 위 장화음으로
      // 크게 펼친다. 화음은 마림바 1-3-5-8을 한꺼번에 + 종 반짝, 끝에 작은 반짝 셋이 흩어진다(축포 박자와 같다).
      [0, 0.11, 0.22].forEach((t2) => {
        marimba(ac, out, N(7), t2, 0.3, 0.06);
        marimba(ac, out, N(-5), t2, 0.16, 0.05);
      });
      [0, 4, 7, 12].forEach((s2) => marimba(ac, out, N(s2), 0.36, 0.26, 0.2));
      chime(ac, out, N(12), 0.36, 0.24, 0.32);
      chime(ac, out, N(16), 0.4, 0.18, 0.3);
      [19, 24, 16].forEach((s2, i) => chime(ac, out, N(s2 - 12), 0.7 + i * 0.16, 0.1, 0.14));
      break;
    }
    case "fanfare":
      [0, 4, 7, 12].forEach((s, i) => marimba(ac, out, N(s), i * 0.075, 0.3, 0.12));
      chime(ac, out, N(16), 0.31, 0.2, 0.22);
      chime(ac, out, N(19), 0.38, 0.12, 0.2);
      break;
    case "chime": // 종 두 음(5도 상행)
      chime(ac, out, N(0), 0, 0.24, 0.2);
      chime(ac, out, N(7), 0.11, 0.22, 0.24);
      break;
    case "bells": // 방울 — 종 다섯 점(장3화음 오르내림)
      [0, 4, 7, 4, 12].forEach((s, i) => chime(ac, out, N(s), i * 0.065, 0.15, 0.12));
      break;
    case "spooky": // 귀여운 으스스 — 출렁이며 내려가는 보잉 둘(단3도)
      boing(ac, out, N(-5), 0, 0.24);
      boing(ac, out, N(-8), 0.18, 0.2);
      break;
    case "sparkle": // 반짝 — 종 빠른 상행(장조), 작게
      [0, 4, 7, 12, 16].forEach((s, i) => chime(ac, out, N(s + 7), i * 0.045, 0.12, 0.1));
      break;
    case "soft": // 낮고 조용한 마림바 한 음
      marimba(ac, out, N(-5), 0, 0.24, 0.12);
      break;
    case "levelup": // 단계 상승 — 퐁 셋(1-3-5) + 종 마무리
      [0, 4, 7].forEach((s, i) => bubble(ac, out, N(s), i * 0.065, 0.24));
      chime(ac, out, N(12), 0.2, 0.2, 0.2);
      break;
    case "pop": // 기본 축하 — 퐁 + 작은 종
      bubble(ac, out, N(7), 0, 0.3);
      chime(ac, out, N(12), 0.07, 0.12, 0.14);
      break;
    // ── 하트·기대 ──
    case "heart-on": // 보잉(튀어 올라 안착) + 옥타브 위 작은 반짝 = '통!'
      boing(ac, out, N(4), 0, 0.28);
      blip(ac, out, N(16), 0.07, 0.1, 0.03);
      break;
    case "heart-off": // 살짝 내려앉음
      drip(ac, out, N(4), 0, 0.2);
      break;
    case "hope": // 별빛 — 종 두 점(5도)
      chime(ac, out, N(7), 0, 0.16, 0.12);
      chime(ac, out, N(14), 0.08, 0.12, 0.14);
      break;
    // ── 누름·이동(가장 자주 — 짧고 작게) ──
    case "tick": // 무엇을 눌렀는지 모를 때의 기본 톡(서버 확인 박자 등)
      blip(ac, out, N(12), 0, 0.14, 0.022);
      break;
    case "tap": // 단추 한 번 — 한 점
      blip(ac, out, N(7), 0, 0.2, 0.028);
      break;
    case "tab": // 탭·세그먼트·라디오 고르기 — 나무 '똑' 한 점(높게, 짧게)
      marimba(ac, out, N(12), 0, 0.2, 0.045);
      break;
    case "detent": // 슬라이더 한 칸·끌면서 칸 넘기 — 시계 톱니처럼 아주 작게
      blip(ac, out, N(19), 0, 0.09, 0.012);
      break;
    case "toggle-on": // 스위치 켜기 — 장3도 상행 두 점(40ms)
      marimba(ac, out, N(7), 0, 0.22, 0.05);
      marimba(ac, out, N(11), 0.04, 0.22, 0.06);
      break;
    case "toggle-off": // 스위치 끄기 — 장3도 하행, 3dB 작게
      marimba(ac, out, N(11), 0, 0.16, 0.05);
      marimba(ac, out, N(7), 0.04, 0.16, 0.06);
      break;
    case "select": // 일정 카드 고르기 — 마림바 한 점(따뜻하게)
      marimba(ac, out, N(7), 0, 0.24, 0.07);
      break;
    case "open": // 열림 — 바람이 올라오고, 자리 잡는 순간 퐁
      whoosh(ac, out, 500, 1800, 0.14, 0, 0.12);
      bubble(ac, out, N(7), 0.1, 0.18, 0.04);
      break;
    case "close": // 닫힘 — 바람이 내려가며 사라진다
      whoosh(ac, out, 1600, 450, 0.13, 0, 0.13);
      drip(ac, out, N(0), 0.06, 0.1, 0.03);
      break;
    case "lift": // 집기 — 퐁 위로(손에 들림)
      bubble(ac, out, N(4), 0, 0.22, 0.04);
      break;
    case "page": // 다음 달 — 위로 쓸리는 바람 + 희미한 톡
      whoosh(ac, out, 600, 2000, 0.12, 0, 0.16);
      blip(ac, out, N(12), 0.06, 0.06, 0.02);
      break;
    case "page-prev": // 이전 달 — 아래로 쓸리는 바람
      whoosh(ac, out, 2000, 600, 0.12, 0, 0.16);
      blip(ac, out, N(7), 0.06, 0.06, 0.02);
      break;
    // ── 편집 ──
    case "save": // 저장 — 체크 애니메이션 박자(톡-톡)에 맞춘 5도 상행 종
      chime(ac, out, N(0), 0, 0.22, 0.12);
      chime(ac, out, N(7), 0.09, 0.22, 0.18);
      break;
    case "drop": // 놓기 — 낮은 나무 '똥' 착지 + 스프링 오버슈트 꼭짓점에 작은 톡
      marimba(ac, out, N(-5), 0, 0.3, 0.08);
      blip(ac, out, N(7), 0.12, 0.08, 0.02);
      break;
    case "delete": // 삭제 — 음이 0.6배로 꺼지며 사라짐 + 부드러운 바람(저역)
      tone(ac, out, { f: N(4), glideTo: N(4) * 0.6, glide: 0.12, vol: 0.22, tau: 0.05 });
      whoosh(ac, out, 1400, 300, 0.14, 0.02, 0.1, true);
      break;
    case "copy": // 복사 — 같은 음 두 번(메아리 = 하나가 둘로), 두 번째는 옥타브 위로 작게
      blip(ac, out, N(7), 0, 0.22, 0.03);
      blip(ac, out, N(19), 0.06, 0.12, 0.03);
      break;
    case "paste": // 붙여넣기 — 휙 날아가(짧은 바람) 나무 '똥' 착지 + 오버슈트 꼭짓점 톡
      whoosh(ac, out, 700, 1600, 0.1, 0, 0.1);
      marimba(ac, out, N(0), 0.12, 0.28, 0.08);
      blip(ac, out, N(12), 0.24, 0.07, 0.02);
      break;
    case "fling": // 던지기 — 휙(아래로) + 멀어지는 물방울
      whoosh(ac, out, 2400, 400, 0.24, 0, 0.22);
      drip(ac, out, N(12), 0.06, 0.12, 0.04);
      break;
    case "undo": // 되돌리기 — 온음 하행 두 점
      marimba(ac, out, N(9), 0, 0.2, 0.05);
      marimba(ac, out, N(7), 0.05, 0.2, 0.06);
      break;
    case "redo": // 다시 — 온음 상행 두 점(되돌리기의 거울)
      marimba(ac, out, N(7), 0, 0.2, 0.05);
      marimba(ac, out, N(9), 0.05, 0.2, 0.06);
      break;
    case "link": // 잇기 — 완전4도 상행, 바짝 붙은 두 점 '찰칵'(맞물림 = 또렷하게)
      marimba(ac, out, N(7), 0, 0.22, 0.04);
      marimba(ac, out, N(12), 0.035, 0.24, 0.06);
      break;
    case "unlink": // 끊기 — 완전4도 하행, 간격 넓게
      marimba(ac, out, N(12), 0, 0.2, 0.04);
      marimba(ac, out, N(7), 0.08, 0.18, 0.05);
      break;
    // ── 알림 ──
    case "unlock": // 열림 — 종 1-3-5 상행
      [0, 4, 7].forEach((s, i) => chime(ac, out, N(s), i * 0.07, 0.2, 0.16));
      break;
    case "error": // 실패 — 같은 낮은 음 두 번(리듬으로 '어-어', 불협화 없음), 둥근 삼각파
      tone(ac, out, { f: 277, vol: 0.26, tau: 0.045, attack: 0.005, type: "triangle" });
      tone(ac, out, { f: 277, at: 0.11, vol: 0.24, tau: 0.06, attack: 0.005, type: "triangle" });
      break;
    default:
      blip(ac, out, N(7));
      break;
  }
}

// ── '톡' 고르기 — 진동 hapticTick이 앱 곳곳(200곳 넘게)에서 같은 '톡'을 내던 것을, **방금 누른 것**을 보고
// 그 기능에 맞는 소리로 바꾼다(스위치 켜기/끄기·탭·닫기·열기·슬라이더·끌면서 칸 넘기). 호출부는 그대로.
let lastPointer = { el: null as Element | null, at: 0, x: 0, y: 0, down: false, moved: false };
let lastKey = { key: "", el: null as Element | null, at: 0 };
if (typeof window !== "undefined") {
  const opt = { capture: true, passive: true } as const;
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = { el: e.target as Element | null, at: performance.now(), x: e.clientX, y: e.clientY, down: true, moved: false };
    },
    opt
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      if (lastPointer.down && !lastPointer.moved && Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) > 6) lastPointer.moved = true;
    },
    opt
  );
  const up = () => {
    lastPointer.down = false;
    lastPointer.at = performance.now();
  };
  window.addEventListener("pointerup", up, opt);
  window.addEventListener("pointercancel", up, opt);
  window.addEventListener("keydown", (e) => (lastKey = { key: e.key, el: e.target as Element | null, at: performance.now() }), opt);
}

const CLOSE_RE = /닫기|취소|close|cancel|dismiss/i;
function tickFor(): SfxName {
  const now = performance.now();
  // 끌고 있는 중(누른 채 움직임) = 칸 넘기 톱니
  if (lastPointer.down && lastPointer.moved) return "detent";
  const sinceKey = now - lastKey.at;
  const sincePointer = now - lastPointer.at;
  // 화살표·페이지 키로 값을 옮기는 중 = 톱니
  if (sinceKey < 250 && /^(Arrow|Page|Home|End)/.test(lastKey.key)) return "detent";
  // 누른 지 오래(서버 확인 박자 등) — 기본 톡
  if (Math.min(sinceKey, sincePointer) > 400) return "tick";
  const src = sinceKey < sincePointer ? lastKey.el : lastPointer.el;
  const el = src?.closest?.("input,button,[role],a,summary,label,[data-act]") ?? null;
  if (!el) return "tap";
  if (el instanceof HTMLInputElement) {
    if (el.type === "range") return "detent";
    if (el.type === "checkbox") return el.checked ? "toggle-on" : "toggle-off"; // 네이티브는 이미 바뀐 값
    if (el.type === "radio") return "tab";
  }
  const role = el.getAttribute("role");
  if (role === "radio" || role === "tab" || role === "option" || role === "menuitemradio" || el.hasAttribute("aria-selected")) return "tab";
  const checked = el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed");
  if (role === "switch" || checked !== null) return checked === "true" ? "toggle-off" : "toggle-on"; // 처리기 안 = 바뀌기 전 값
  const label = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("data-act") ?? ""}`;
  if (CLOSE_RE.test(label)) return "close";
  if (/^open-|-open$/.test(el.getAttribute("data-act") ?? "") || el.hasAttribute("aria-haspopup")) return "open";
  const expanded = el.getAttribute("aria-expanded");
  if (expanded === "true") return "close";
  if (expanded === "false") return "open";
  return "tap";
}

// '톡'은 진동 hapticTick과 같은 순간에 자동으로 붙는다(lib/ui/haptics). 같은 손동작에서 더 구체적인 소리
// (하트·놓기·저장…)가 나면 '톡'은 양보한다 — 호출 순서와 무관하게: 톡은 한 틱 미뤄 두고, 그 사이 다른 소리가 났으면 버린다.
// 무엇을 눌렀는지는 **지금**(처리기 안, 상태가 바뀌기 전) 읽어 둔다.
let lastSpecificAt = 0;

/** 소리 하나. 자물쇠(전체 켜기·종류·다른 탭)를 여기서 다 본다 — 호출부는 이름만 부르면 된다. */
export function playSfx(name: SfxName, opts: { force?: boolean } = {}): void {
  if (name === "tick" && !opts.force) {
    if (typeof window === "undefined") return;
    const resolved = tickFor();
    window.setTimeout(() => {
      if (performance.now() - lastSpecificAt < 80) return;
      playNow(resolved);
    }, 0);
    return;
  }
  lastSpecificAt = typeof performance !== "undefined" ? performance.now() : 0;
  playNow(name, opts);
}

let lastPlayed = { name: "tick" as SfxName, at: 0 };
let songUntil = 0;
let pendingNotes: number[] = [0];

// ── 노래·연속 탭 멜로디(2026-10-06 소유자: "빵빠레를 여러 번 연속 클릭하면 한 번에 한 음씩 — 비행기 멜로디처럼") ──
/** 생일 축하 노래 박 길이(초)와 빵빠레 뒤 노래 시작까지(초). 화면의 춤추는 음표도 이 시간표를 그대로 쓴다. */
export const SONG_BEAT = 0.27;
export const SONG_DELAY = 0.75;
const BIRTHDAY_NOTES: [number, number][] = [
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [0, 1], [-1, 2],
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [2, 1], [0, 2],
  [-5, 0.75], [-5, 0.25], [7, 1], [4, 1], [0, 1], [-1, 1], [-3, 2],
  [5, 0.75], [5, 0.25], [4, 1], [0, 1], [2, 1], [0, 3]
];
/** 생일 노래 음표 시간표 — at(노래 시작부터 초)·semi(C5 기준 반음)·len(울림). */
export const BIRTHDAY_SONG: { at: number; semi: number; len: number }[] = (() => {
  let beat = 0;
  return BIRTHDAY_NOTES.map(([semi, beats], i) => {
    const n = { at: beat * SONG_BEAT, semi, len: i === BIRTHDAY_NOTES.length - 1 ? 0.5 : Math.min(0.32, beats * SONG_BEAT * 0.9) };
    beat += beats;
    return n;
  });
})();
// 연속 탭 멜로디(2026-10-06 소유자: "비행기 말고 여러 간단한 멜로디, 최소 10개 — 젓가락 행진곡 같은") —
// 모두 저작권이 끝난 전래·고전 선율. 숫자 = C5 기준 반음, 배열 = 화음(젓가락 행진곡의 두 손가락).
// 탭 연타가 새로 시작될 때마다 다른 곡(직전 곡은 피함), 성탄은 징글벨, 생일은 생일 노래.
type Step = number | number[];
const MELODIES: { title: string; notes: Step[] }[] = [
  { title: "떴다 떴다 비행기", notes: [4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7, 4, 2, 0, 2, 4, 4, 4, 2, 2, 4, 2, 0] },
  {
    title: "젓가락 행진곡",
    notes: [[5, 7], [5, 7], [5, 7], [5, 7], [5, 7], [5, 7], [4, 7], [4, 7], [4, 7], [4, 7], [4, 7], [4, 7], [2, 11], [2, 11], [2, 11], [2, 11], [4, 12], [2, 11], [0, 12], [0, 12]]
  },
  { title: "반짝반짝 작은 별", notes: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0, 7, 7, 5, 5, 4, 4, 2, 7, 7, 5, 5, 4, 4, 2, 0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0] },
  { title: "나비야", notes: [7, 4, 4, 5, 2, 2, 0, 2, 4, 5, 7, 7, 7, 7, 4, 4, 4, 5, 2, 2, 2, 0, 4, 7, 7, 4, 4, 4] },
  { title: "환희의 송가", notes: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0] },
  { title: "엘리제를 위하여", notes: [4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, -4, -1, 0, -8, 4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, 0, -1, -3] },
  { title: "런던 다리", notes: [7, 9, 7, 5, 4, 5, 7, 2, 4, 5, 4, 5, 7, 7, 9, 7, 5, 4, 5, 7, 2, 7, 4, 0] },
  { title: "자크 형제", notes: [0, 2, 4, 0, 0, 2, 4, 0, 4, 5, 7, 4, 5, 7, 7, 9, 7, 5, 4, 0, 7, 9, 7, 5, 4, 0, 0, -5, 0, 0, -5, 0] },
  { title: "올드 맥도날드", notes: [7, 7, 7, 2, 4, 4, 2, 11, 11, 9, 9, 7, 2, 7, 7, 7, 2, 4, 4, 2, 11, 11, 9, 9, 7] },
  { title: "노를 저어라", notes: [0, 0, 0, 2, 4, 4, 2, 4, 5, 7, 12, 12, 12, 7, 7, 7, 4, 4, 4, 0, 0, 0, 7, 5, 4, 2, 0] },
  { title: "뻐꾸기", notes: [7, 4, 7, 4, 2, 0, 2, 0, 2, 4, 5, 2, 4, 5, 7, 4, 7, 4, 7, 4, 5, 4, 2, 0] },
  { title: "징글벨", notes: [4, 4, 4, 4, 4, 4, 4, 7, 0, 2, 4, 5, 5, 5, 5, 5, 4, 4, 4, 4, 2, 2, 4, 2, 7] },
  { title: "도레미 계단", notes: [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0] }
];
const JINGLE = MELODIES.findIndex((m) => m.title === "징글벨");
const STREAK_GAP_MS = 2500;
let tapStreak = { key: "", at: 0, i: 0, mel: 0 };
let melodyCursor = -1;

/**
 * 기념일 탭 — 첫 탭은 그 날의 빵빠레, 2.5초 안에 이어 누르면 한 번에 한 음씩 멜로디(생일 = 생일 노래, 그 외 = 비행기).
 * 쉬었다 누르면 처음(빵빠레)부터. 생일 노래가 흐르는 동안의 탭은 소리 없이 넘긴다(노래를 덮지 않게).
 * 반환: "first"(빵빠레) · "note"(멜로디 한 음 — semi 포함) · "busy"(노래 중).
 */
export function playCelebrationTap(
  key: string,
  sound: CelebrationSound
): { kind: "first" | "note" | "busy"; semi?: number; title?: string } {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const cont = tapStreak.key === key && now - tapStreak.at < STREAK_GAP_MS;
  if (!cont) {
    // 새 연타 — 곡을 고른다: 성탄은 징글벨, 그 밖엔 직전과 다른 곡을 차례로(처음은 무작위에서 출발).
    let mel = key === "christmas" ? JINGLE : 0;
    if (key !== "christmas") {
      if (melodyCursor < 0) melodyCursor = Math.floor(Math.random() * MELODIES.length);
      melodyCursor = (melodyCursor + 1) % MELODIES.length;
      if (melodyCursor === JINGLE) melodyCursor = (melodyCursor + 1) % MELODIES.length;
      mel = melodyCursor;
    }
    tapStreak = { key, at: now, i: 0, mel };
    playCelebration(sound);
    return { kind: "first" };
  }
  tapStreak.at = now;
  if (sound === "birthday" && now < songUntil) return { kind: "busy" };
  const birthday = sound === "birthday";
  const notes: Step[] = birthday ? BIRTHDAY_NOTES.map((n) => n[0]) : MELODIES[tapStreak.mel].notes;
  const step = notes[tapStreak.i % notes.length];
  const title = tapStreak.i === 0 ? (birthday ? "생일 축하합니다" : MELODIES[tapStreak.mel].title) : undefined;
  tapStreak.i += 1;
  pendingNotes = Array.isArray(step) ? step : [step];
  playSfx("note");
  return { kind: "note", semi: pendingNotes[pendingNotes.length - 1], title };
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
  // 같은 소리가 30ms 안에 겹치면 하나만(두 경로가 같은 순간을 알릴 때 두 배로 커지지 않게)
  const now = performance.now();
  if (lastPlayed.name === name && now - lastPlayed.at < 30) return;
  // 노래(생일)는 끝나기 전에 또 누르면 겹쳐 부르지 않는다 — 한 곡이 끝날 때까지 새 노래는 무시.
  if (name === "birthday") {
    if (now < songUntil) return;
    songUntil = now + (SONG_DELAY + BIRTHDAY_SONG[BIRTHDAY_SONG.length - 1].at + 0.6) * 1000;
  }
  lastPlayed = { name, at: now };
  document.documentElement.dataset.sfxLast = name; // 검증용 흔적(Playwright가 어떤 소리였는지 읽는다)
  const out = ac.createGain();
  // 크기 곡선 — 1.6제곱(낮은 쪽은 섬세하게, 100이면 압축기 뒤에서 또렷하게) × 크기 ±1.5dB 흔들기.
  const level = Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20);
  out.gain.value = Math.pow(vol / 100, 1.6) * 1.25 * level;
  out.connect(masterBus(ac));
  jitter = 1 + (Math.random() * 2 - 1) * 0.03; // 음높이 ±3%(반음 미만 — 같은 소리로 알아듣되 기계적 반복은 아니게)
  render(ac, out, name);
  jitter = 1;
}

/** 기념일 테마 소리(lib/ui/celebration의 sound 이름). */
export function playCelebration(sound: CelebrationSound): void {
  if (sound === "none") return;
  playSfx(sound);
}
