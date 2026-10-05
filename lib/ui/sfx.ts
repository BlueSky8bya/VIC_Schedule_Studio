// 효과음(2026-10-06) — 파일 없이 Web Audio로 짧게 합성한다(에셋·네트워크 0, 1초 미만).
// 앱의 모든 소리는 이 한 곳을 거친다(진동의 lib/ui/haptics.ts와 같은 '두꺼비집' 구조).
//
// 통과해야 울리는 자물쇠:
//   1) 효과음 전체 켜기(vic.sound) — **기본 켜짐**(2026-10-06 소유자 결정, 'off'를 고른 기기만 끔). 방송 중엔 편집실·시청자 화면 소리가 송출에 섞이거나,
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
  | "note"
  | "coin"
  | "gacha-drop"
  | "capsule-open";

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
  note: "celebrate",
  coin: "celebrate",
  "gacha-drop": "celebrate",
  "capsule-open": "celebrate"
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
  return read(KEY) !== "off"; // 기본 켜짐 — 끈 적 없는 기기는 소리가 난다
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
    // ── 생일 캡슐 뽑기 ──
    case "coin": // 동전 — 맑은 금속 두 점(높게, 짤랑)
      chime(ac, out, N(19), 0, 0.2, 0.08);
      chime(ac, out, N(24), 0.06, 0.16, 0.12);
      break;
    case "gacha-drop": // 캡슐이 떨어져 구른다 — 나무 '똥' + 통통 두 번 튐
      marimba(ac, out, N(-5), 0, 0.3, 0.07);
      bubble(ac, out, N(4), 0.14, 0.16, 0.035);
      bubble(ac, out, N(7), 0.26, 0.1, 0.03);
      break;
    case "capsule-open": // 캡슐이 '퐁' 열리고 반짝 — 장3화음 종
      bubble(ac, out, N(0), 0, 0.26, 0.04);
      [4, 7, 12].forEach((s2, i) => chime(ac, out, N(s2), 0.08 + i * 0.06, 0.16, 0.16));
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
//
// ── 한 동작 = 한 소리(2026-10-06 소유자: "더블클릭으로 창 하나 띄우는데 소리가 두 번 난다 — 전수조사해서 섬세하게") ──
// 손동작(포인터 누름·키 누름) 하나와 그 결과를 '동작'으로 묶고, 동작 하나에선 소리 하나만 낸다.
//  · 우선순위: 1 일반 톡(누른 것에서 고른 소리) < 2 화면 소리(열기·닫기·고르기·달 넘김·집기) < 3 결과 소리(저장·놓기·
//    하트·삭제·알림). 같은 동작에서 뒤에 오는 같거나 낮은 소리는 버리고, 더 높은 소리만 이어 낸다(집기 → 놓기).
//  · 일반 톡은 TICK_DEFER_MS 미뤄 둔다 — 그 사이 같은 동작의 화면·결과 소리(창이 열림 등)가 오면 톡은 버린다.
//  · 더블클릭 자리(편집실 카드·띠·날짜 칸): 첫 클릭 소리를 DOUBLE_DEFER_MS 미뤄 둔다. 두 번째 클릭이 오면 버리고,
//    더블클릭이 여는 창 소리 하나만 낸다. 미룬 소리가 이미 났으면 더블클릭 쪽 소리를 버린다(어느 쪽이든 하나).
//  · 누른 지 오래된 '두 번째 박자'(서버 확인 진동)는 소리 없음 — 결과 소리(저장 확인음)는 그대로 난다.
//  · 규칙 밖(동작 하나에 여러 번 나야 하는 것): 칸 넘기 톱니(detent)·축하와 멜로디(celebrate).
const GESTURE_IDLE_MS = 700; // 마지막 입력 뒤 이만큼 지나면 '입력 없는 소리'(서버 확인 등)로 본다
const DOUBLE_MS = 380; // 같은 자리 두 번째 누름이 이 안이면 더블클릭(같은 동작)
const TICK_DEFER_MS = 45; // 일반 톡 대기 — 지각 한계(≈70ms) 안
const DOUBLE_DEFER_MS = 220; // 더블클릭 자리의 첫 클릭 소리 대기
const DOUBLE_SURFACE = ".studio-event-pill, .support-bar, .studio-day";

let lastPointer = { el: null as Element | null, at: 0, x: 0, y: 0, down: false, moved: false };
let lastKey = { key: "", el: null as Element | null, at: 0 };
let gesture = { id: 0, at: 0, input: 0, el: null as Element | null, best: 0 };
let pending: { timer: number; gid: number; pr: number; fire: () => void } | null = null;

function surfaceOf(el: Element | null): Element | null {
  return el?.closest?.(DOUBLE_SURFACE) ?? null;
}
function firePending(): void {
  const p = pending;
  if (!p) return;
  window.clearTimeout(p.timer);
  pending = null;
  p.fire();
}
function dropPending(): void {
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending = null;
}
/** 새 입력 — 같은 자리를 바로 다시 누른 것(더블클릭)이면 같은 동작을 잇고, 아니면 새 동작을 연다. */
function beginInput(el: Element | null, viaKey: boolean): void {
  const now = performance.now();
  const surf = viaKey ? null : surfaceOf(el);
  const cont = !viaKey && surf !== null && now - gesture.at < DOUBLE_MS && surf === surfaceOf(gesture.el);
  if (cont) {
    gesture.at = now;
    gesture.input = now;
    // 첫 클릭 소리가 아직 대기 중이면 버리고 다시 판정 — 더블클릭이 여는 소리가 그 자리를 갖는다.
    if (pending && pending.gid === gesture.id) {
      dropPending();
      gesture.best = 0;
    }
    return;
  }
  firePending(); // 앞 동작의 대기 소리는 그 동작 몫 — 지금 낸다
  gesture = { id: gesture.id + 1, at: now, input: now, el, best: 0 };
}
if (typeof window !== "undefined") {
  const opt = { capture: true, passive: true } as const;
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = { el: e.target as Element | null, at: performance.now(), x: e.clientX, y: e.clientY, down: true, moved: false };
      beginInput(e.target as Element | null, false);
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
    gesture.input = lastPointer.at; // 끌기를 놓은 순간도 같은 동작의 입력
  };
  window.addEventListener("pointerup", up, opt);
  window.addEventListener("pointercancel", up, opt);
  window.addEventListener(
    "keydown",
    (e) => {
      lastKey = { key: e.key, el: e.target as Element | null, at: performance.now() };
      beginInput(e.target as Element | null, true);
    },
    opt
  );
}

const CLOSE_RE = /닫기|취소|close|cancel|dismiss/i;
/** 방금 누른 것에 맞는 소리. 누른 지 오래됐으면(서버 확인 박자 등) null = 소리 없음. */
function tickFor(): SfxName | null {
  const now = performance.now();
  // 끌고 있는 중(누른 채 움직임) = 칸 넘기 톱니
  if (lastPointer.down && lastPointer.moved) return "detent";
  const sinceKey = now - lastKey.at;
  const sincePointer = now - lastPointer.at;
  // 화살표·페이지 키로 값을 옮기는 중 = 톱니
  if (sinceKey < 250 && /^(Arrow|Page|Home|End)/.test(lastKey.key)) return "detent";
  // 누른 지 오래 — '두 번째 박자'(서버 확인)는 진동만, 소리는 없다(한 동작 = 한 소리).
  if (Math.min(sinceKey, sincePointer) > 400) return null;
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
/** 지금 소리가 더블클릭 자리(편집실 카드·띠·날짜 칸)를 누른 데서 나왔나. */
function onDoubleSurface(): boolean {
  const now = performance.now();
  return now - lastPointer.at < 400 && lastPointer.at >= lastKey.at && surfaceOf(lastPointer.el) !== null;
}
function priorityOf(name: SfxName, fromTick: boolean): number {
  if (fromTick) return 1;
  return CATEGORY[name] === "ui" ? 2 : 3;
}
/** 동작 규칙을 통과하나(통과하면 그 동작의 최고 우선순위를 올린다). */
function admit(name: SfxName, fromTick: boolean): boolean {
  if (name === "detent") return true;
  if (CATEGORY[name] === "celebrate") {
    gesture.best = 3; // 축하·멜로디는 늘 나고, 같은 동작의 톡은 따라 나지 않게 자리를 차지한다
    return true;
  }
  const pr = priorityOf(name, fromTick);
  const active = performance.now() - gesture.input < GESTURE_IDLE_MS;
  if (!active) return !fromTick; // 입력 없이 난 소리: 톡은 침묵, 화면·결과 소리는 그대로
  if (pr <= gesture.best) return false;
  gesture.best = pr;
  return true;
}
/** 소리를 잠시 미뤄 둔다 — 같은 동작에서 더 중요한 소리가 오면 버려진다. 대기 중인 것보다 약하면 줄 서지 않는다. */
function defer(name: SfxName, fromTick: boolean, ms: number): void {
  const pr = priorityOf(name, fromTick);
  if (pending && pending.gid === gesture.id) {
    if (pending.pr > pr) return;
    dropPending();
  }
  const gid = gesture.id;
  const fire = () => {
    if (admit(name, fromTick)) playNow(name);
  };
  pending = {
    gid,
    pr,
    fire,
    timer: window.setTimeout(() => {
      pending = null;
      fire();
    }, ms)
  };
}

/** 소리 하나. 자물쇠(전체 켜기·종류·다른 탭)와 '한 동작 = 한 소리' 규칙을 여기서 다 본다 — 호출부는 이름만 부르면 된다. */
export function playSfx(name: SfxName, opts: { force?: boolean } = {}): void {
  if (opts.force) {
    // 설정의 '들어 보기'·견본 — 규칙 밖, 바로. 같은 동작의 톡은 따라 나지 않게 자리를 차지한다.
    dropPending();
    gesture.best = 3;
    playNow(name, opts);
    return;
  }
  if (typeof window === "undefined") return;
  if (name === "tick") {
    const resolved = tickFor();
    if (!resolved) return;
    if (resolved === "detent") {
      playNow(resolved);
      return;
    }
    defer(resolved, true, onDoubleSurface() ? DOUBLE_DEFER_MS : TICK_DEFER_MS);
    return;
  }
  // 더블클릭 자리의 '고르기'는 미뤄 둔다 — 더블클릭이면 여는 소리 하나만.
  if (name === "select" && onDoubleSurface()) {
    defer(name, false, DOUBLE_DEFER_MS);
    return;
  }
  // 같은 동작의 미뤄 둔 소리(톡·첫 클릭)는 이 소리에 자리를 내준다.
  if (pending && pending.gid === gesture.id && pending.pr <= priorityOf(name, false)) dropPending();
  if (admit(name, false)) playNow(name, opts);
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
// 음은 2026-10-06 악보 대조(위키 LilyPond·flutetunes MIDI·abcnotation ABC를 음 단위로 파싱, 한국 곡은 계이름·악보 이미지 대조).
// 2차(같은 날 소유자: "젓가락 행진곡이 마무리 안 되고 끊긴다, 2절·3절도 최대한"): 곡마다 끝맺음(으뜸음 마침)까지 온전한 한
// 형식(절+후렴, 반복 포함)으로 다시 받았고, 절 수(verses)만큼 되풀이한다. 덜 확실한 곡: 나비야·비행기(계이름 2차 자료),
// 아리랑(대체 출처 하나가 다름), 윌리엄 텔(피아노 편곡 MIDI 상성부).
type Melody = { title: string; notes: Step[]; verses?: number }; // verses = 같은 선율로 부르는 절 수(그만큼 되풀이)
const MELODIES: Melody[] = [
  { title: "떴다 떴다 비행기", notes: [4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7, 4, 2, 0, 2, 4, 4, 4, 2, 2, 4, 2, 0], verses: 2 },
  { title: "젓가락 행진곡", notes: [[-7, -5], [-7, -5], [-7, -5], [-7, -5], [-7, -5], [-7, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-12, 0], [-12, 0], [-12, 0], [-10, -1], [-8, -3], [-7, -5], [-7, -5], [-7, -5], [-7, -5], [-7, -5], [-7, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-8, -5], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-10, -1], [-12, 0], [-12, 0], [-12, 0], [0, 4], [-1, 2], [-3, 0], [-5, -1], [-7, -3], [-8, -5], [-8, -5], [-8, -5], [-7, -3], [-8, -5], [-10, -7], [-10, -7], [-10, -7], [-8, -5], [-10, -7], [-12, -8], [-10, -7], [-8, -5], [0, 4], [-1, 2], [-3, 0], [-5, -1], [-7, -3], [-8, -5], [-8, -5], [-8, -5], [-7, -3], [-8, -5], [-10, -7], [-10, -7], [-10, -7], [-8, -5], [-10, -7], [-12, -8], [-10, -7], [-12, -8]] },
  { title: "반짝반짝 작은 별", notes: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0, 7, 7, 5, 5, 4, 4, 2, 7, 7, 5, 5, 4, 4, 2, 0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0] },
  { title: "나비야", notes: [7, 4, 4, 5, 2, 2, 0, 2, 4, 5, 7, 7, 7, 7, 4, 4, 4, 5, 2, 2, 0, 4, 7, 7, 4, 4, 4, 2, 2, 2, 2, 2, 4, 5, 4, 4, 4, 4, 4, 5, 7, 7, 4, 4, 5, 2, 2, 0, 4, 7, 7, 4, 4, 4] },
  { title: "환희의 송가", notes: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0, 2, 2, 4, 0, 2, 4, 5, 4, 0, 2, 4, 5, 4, 2, 0, 2, -5, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0] },
  { title: "엘리제를 위하여", notes: [4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, -4, -1, 0, -8, 4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, 0, -1, -3, 4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, -4, -1, 0, -8, 4, 3, 4, 3, 4, -1, 2, 0, -3, -12, -8, -3, -1, -8, 0, -1, -3] },
  { title: "런던 다리", notes: [7, 9, 7, 5, 4, 5, 7, 2, 4, 5, 4, 5, 7, 7, 9, 7, 5, 4, 5, 7, 2, 7, 4, 0], verses: 6 },
  { title: "자크 형제", notes: [0, 2, 4, 0, 0, 2, 4, 0, 4, 5, 7, 4, 5, 7, 7, 9, 7, 5, 4, 0, 7, 9, 7, 5, 4, 0, 0, -5, 0, 0, -5, 0] },
  { title: "올드 맥도날드", notes: [0, 0, 0, -5, -3, -3, -5, 4, 4, 2, 2, 0, -5, 0, 0, 0, -5, -3, -3, -5, 4, 4, 2, 2, 0, -5, -5, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5, -3, -3, -5, 4, 4, 2, 2, 0], verses: 5 },
  { title: "노를 저어라", notes: [0, 0, 0, 2, 4, 4, 2, 4, 5, 7, 12, 12, 12, 7, 7, 7, 4, 4, 4, 0, 0, 0, 7, 5, 4, 2, 0] },
  { title: "뻐꾸기", notes: [7, 4, 7, 4, 2, 0, 2, 0, 2, 2, 4, 5, 2, 4, 4, 5, 7, 4, 7, 4, 7, 4, 5, 4, 2, 0], verses: 2 },
  { title: "징글벨", notes: [-5, 4, 2, 0, -5, -5, -5, 4, 2, 0, -3, -3, -3, 5, 4, 2, -1, 7, 7, 5, 2, 4, -5, -5, 4, 2, 0, -5, -5, -5, 4, 2, 0, -3, -3, -3, 5, 4, 2, 7, 7, 7, 7, 9, 7, 5, 2, 0, 7, 4, 4, 4, 4, 4, 4, 4, 7, 0, 2, 4, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 2, 2, 4, 2, 7, 4, 4, 4, 4, 4, 4, 4, 7, 0, 2, 4, 5, 5, 5, 5, 5, 4, 4, 4, 4, 7, 7, 5, 2, 0], verses: 4 },
  { title: "도레미 계단", notes: [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0] },
  { title: "양키 두들", notes: [0, 0, 2, 4, 0, 4, 2, -5, 0, 0, 2, 4, 0, -1, -5, 0, 0, 2, 4, 5, 4, 2, 0, -1, -5, -3, -1, 0, 0, -3, -1, -3, -5, -3, -1, 0, -3, -5, -3, -5, -7, -8, -5, -3, -1, -3, -5, -3, -1, 0, -3, -5, 0, -1, 2, 0, 0], verses: 4 },
  { title: "오! 수재나", notes: [0, 2, 4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 0, 2, 0, 2, 4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 2, 0, 0, 2, 4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 0, 2, 0, 2, 4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 2, 0, 5, 5, 9, 9, 9, 7, 7, 4, 0, 2, 0, 2, 4, 7, 7, 9, 7, 4, 0, 2, 4, 4, 2, 2, 0], verses: 4 },
  { title: "캉캉", notes: [0, 2, 5, 4, 2, 7, 7, 7, 9, 4, 5, 2, 2, 2, 5, 4, 2, 0, 12, 11, 9, 7, 5, 4, 2, 0, 2, 5, 4, 2, 7, 7, 7, 9, 4, 5, 2, 2, 2, 5, 4, 2, 0, 7, 2, 4, 0, 0, 2, 5, 4, 2, 7, 7, 7, 9, 4, 5, 2, 2, 2, 5, 4, 2, 0, 12, 11, 9, 7, 5, 4, 2, 0, 2, 5, 4, 2, 7, 7, 7, 9, 4, 5, 2, 2, 2, 5, 4, 2, 0, 7, 2, 4, 0] },
  { title: "터키 행진곡", notes: [-1, -3, -4, -3, 0, 2, 0, -1, 0, 4, 5, 4, 3, 4, 11, 9, 8, 9, 11, 9, 8, 9, 12, 9, 12, 11, 9, 7, 9, 11, 9, 7, 9, 11, 9, 7, 6, 4, 4, 5, 7, 7, 9, 7, 5, 4, 2, 4, 5, 7, 7, 9, 7, 5, 4, 2, 0, 2, 4, 4, 5, 4, 2, 0, -1, 0, 2, 4, 4, 5, 4, 2, 0, -1, -1, -3, -4, -3, 0, 2, 0, -1, 0, 4, 5, 4, 3, 4, 11, 9, 8, 9, 11, 9, 8, 9, 12, 9, 11, 12, 11, 9, 8, 9, 4, 5, 2, 0, -1, -3] },
  { title: "미뉴에트", notes: [2, -5, -3, -1, 0, 2, -5, -5, 4, 0, 2, 4, 6, 7, -5, -5, 0, 2, 0, -1, -3, -1, 0, -1, -3, -5, -6, -5, -3, -1, -5, -3, 2, -5, -3, -1, 0, 2, -5, -5, 4, 0, 2, 4, 6, 7, -5, -5, 0, 2, 0, -1, -3, -1, 0, -1, -3, -5, -3, -1, -3, -5, -6, -5] },
  { title: "윌리엄 텔 서곡", notes: [-5, -5, -5, -5, -5, -5, -5, -5, 0, 2, 4, -5, -5, -5, -5, -5, 0, 4, 2, -1, -5, -5, -5, -5, -5, -5, -5, -5, 0, 2, 4, 0, 4, 7, 5, 4, 2, 0, 4, 0, -5, -5, -5, -5, -5, -5, -5, -5, 0, 2, 4, -5, -5, -5, -5, -5, 0, 4, 2, -1, -5, -5, -5, -5, -5, -5, -5, -5, 0, 2, 4, 0, 4, 7, 5, 4, 2, 0, 0, 2, 4, 5, 7, 9, 11, 12] },
  { title: "클레멘타인", notes: [0, 0, 0, -5, 4, 4, 4, 0, 0, 4, 7, 7, 5, 4, 2, 2, 4, 5, 5, 4, 2, 4, 0, 0, 4, 2, -5, -1, 2, 0, 0, 0, 0, -5, 4, 4, 4, 0, 0, 4, 7, 7, 5, 4, 2, 2, 4, 5, 5, 4, 2, 4, 0, 0, 4, 2, -5, -1, 2, 0], verses: 4 },
  { title: "족제비 뿅", notes: [0, 0, 2, 2, 4, 7, 4, 0, 0, 0, 2, 2, 4, 0, 0, 0, 2, 2, 4, 7, 4, 0, 9, 2, 5, 4, 0], verses: 3 }
];
// 그 날과 관련된 노래(2026-10-06 소유자: "크리스마스·추석·설날 등 유명한 날은 관련 동요나 유명한 노래, 없으면 상관없는 노래") —
// 저작권이 끝난 곡만: 까치 까치 설날은·어머님 은혜·스승의 은혜·달달 무슨 달 등은 아직 보호 중이라 쓰지 않는다.
// 이 곡들은 그 날 전용이라 무작위 차례에는 끼지 않는다.
const THEME_MELODIES: Melody[] = [
  { title: "아리랑", notes: [0, 2, 0, 2, 5, 7, 5, 7, 9, 7, 9, 7, 5, 2, 0, 2, 0, 2, 5, 7, 5, 7, 9, 7, 5, 2, 0, 2, 5, 7, 5, 5, 12, 12, 12, 9, 7, 9, 7, 9, 5, 2, 0, 2, 0, 2, 5, 7, 5, 7, 9, 7, 5, 2, 0, 2, 5, 7, 5, 5], verses: 3 },
  { title: "산왕의 궁전에서", notes: [-1, 1, 2, 4, 6, 2, 6, 5, 1, 5, 4, 0, 4, -1, 1, 2, 4, 6, 2, 6, 11, 9, 6, 2, 6, 9, 6, 8, 10, 11, 13, 10, 13, 14, 10, 14, 13, 10, 13, 6, 8, 10, 11, 13, 10, 13, 14, 10, 14, 13, -1, 1, 2, 4, 6, 2, 6, 5, 1, 5, 4, 0, 4, -1, 1, 2, 4, 6, 2, 6, 11, 6, 2, 6, 11, -1] },
  { title: "석별의 정", notes: [-5, 0, 0, 0, 4, 2, 0, 2, 4, 0, 0, 4, 7, 9, 9, 7, 4, 4, 0, 2, 0, 2, 4, 0, -3, -3, -5, 0, 9, 7, 4, 4, 0, 2, 0, 2, 9, 7, 4, 4, 7, 9, 9, 7, 4, 4, 0, 2, 0, 2, 4, 0, -3, -3, -5, 0], verses: 2 },
  { title: "결혼 행진곡", notes: [-5, 0, 0, 0, -5, 2, -1, 0, -5, 0, 5, 5, 4, 2, 0, 4, 2, -1, 0, 2, -5, 0, 0, 0, -5, 2, -1, 0, -5, 0, 4, 7, 4, 0, -3, 2, 4, 0] },
  { title: "어메이징 그레이스", notes: [-5, 0, 4, 0, 4, 2, 0, -3, -5, -5, 0, 4, 0, 4, 2, 7, 4, 7, 4, 7, 4, 0, -5, -3, 0, 0, -3, -5, -5, 0, 4, 0, 4, 2, 0], verses: 6 },
  { title: "애국가", notes: [-5, 0, -1, -3, 0, -3, -5, -3, 0, 2, 4, 5, 4, 2, 7, 5, 4, 2, 0, -1, -3, -5, -8, -5, 0, 2, 2, 4, 0, -1, 0, 2, -1, 4, 5, 7, 4, 2, 0, -1, 0, 2, 7, 5, 4, 2, 0, -1, -3, -5, -8, -5, 0, 2, 2, 4, 0], verses: 4 },
  { title: "브람스 자장가", notes: [4, 4, 7, 4, 4, 7, 4, 7, 12, 11, 9, 9, 7, 2, 4, 5, 2, 2, 4, 5, 2, 5, 11, 9, 7, 11, 12, 0, 0, 12, 9, 5, 7, 4, 0, 5, 7, 9, 4, 7, 0, 0, 12, 9, 5, 7, 4, 0, 5, 4, 2, 0], verses: 2 },
  { title: "엔터테이너", notes: [2, 3, 4, 12, 4, 12, 4, 12, 12, 14, 15, 16, 12, 14, 16, 11, 14, 12, 2, 3, 4, 12, 4, 12, 4, 12, 9, 7, 6, 9, 12, 16, 14, 12, 9, 14, 2, 3, 4, 12, 4, 12, 4, 12, 12, 14, 15, 16, 12, 14, 16, 11, 14, 12, 12, 14, 16, 12, 14, 16, 12, 14, 12, 16, 12, 14, 16, 12, 14, 12, 16, 12, 14, 16, 11, 14, 12] },
  { title: "비발디 '봄'", notes: [4, 8, 8, 8, 6, 4, 11, 11, 9, 8, 8, 8, 6, 4, 11, 11, 9, 8, 9, 11, 9, 8, 6, 3, -1, 4, 8, 8, 8, 6, 4, 11, 11, 9, 8, 8, 8, 6, 4, 11, 11, 9, 8, 9, 11, 9, 8, 6, 4, 11, 9, 8, 9, 11, 13, 11, 4, 11, 9, 8, 9, 11, 13, 11, 4, 13, 11, 9, 8, 6, 4, 8, 6, 4, 4, 11, 9, 8, 9, 11, 13, 11, 4, 11, 9, 8, 9, 11, 13, 11, 4, 13, 11, 9, 8, 6, 4, 8, 6, 4] },
  { title: "고요한 밤", notes: [-5, -3, -5, -8, -5, -3, -5, -8, 2, 2, -1, 0, 0, -5, -3, -3, 0, -1, -3, -5, -3, -5, -8, -3, -3, 0, -1, -3, -5, -3, -5, -8, 2, 2, 5, 2, -1, 0, 4, 0, -5, -8, -5, -7, -10, -12], verses: 3 },
  { title: "그린슬리브스", notes: [-3, 0, 2, 4, 5, 4, 2, -1, -5, -3, -1, 0, -3, -3, -4, -3, -1, -4, -8, -3, 0, 2, 4, 5, 4, 2, -1, -5, -3, -1, 0, -1, -3, -4, -6, -4, -3, 7, 7, 5, 4, 2, -1, -5, -3, -1, 0, -3, -3, -4, -3, -1, -4, -8, 7, 7, 5, 4, 2, -1, -5, -3, -1, 0, -1, -3, -4, -6, -4, -3] },
  { title: "캐논", notes: [11, 9, 7, 6, 4, 2, 4, 6, 7, 6, 4, 2, 0, -1, 0, -3, -5, -1, 2, 0, -1, -5, -1, -3, -5, -8, -5, 2, 0, 4, 2, 0, -1, -5, -3, 6, 7, 11, 14, 2, 4, 0, 2, -1, -5, 7, 7, 6, 7] }
];
/** 테마 키 → 그 날의 노래 제목. 여기 없는 날은 무작위 차례(MELODIES). */
const THEME_SONG: Record<string, string> = {
  christmas: "징글벨",
  halloween: "산왕의 궁전에서",
  seollal: "아리랑",
  chuseok: "아리랑",
  daeboreum: "아리랑",
  newyear: "석별의 정",
  love: "결혼 행진곡",
  children: "반짝반짝 작은 별",
  memorial: "어메이징 그레이스",
  national: "애국가",
  gaecheon: "애국가",
  // 2026-10-06 2차(소유자 "더 많이") — 뜻이 닿는 곡을 고른다.
  parents: "브람스 자장가", // 엄마의 자장가
  teachers: "환희의 송가", // 감사의 합창
  pepero: "젓가락 행진곡", // 막대 과자 = 젓가락
  aprilfools: "엔터테이너", // 장난스러운 래그타임
  arbor: "비발디 '봄'", // 새싹
  rest: "브람스 자장가", // 푹 쉬는 날
  bok: "올드 맥도날드", // 농장 친구들
  hangul: "도레미 계단", // 가나다라 = 도레미파
  milestone: "캐논", // 축하·기념
  "milestone-grand": "캐논",
  "debut-anniv": "캐논"
};
const ALL_MELODIES = [...MELODIES, ...THEME_MELODIES];
const RANDOM_POOL = MELODIES.map((m, i) => i).filter((i) => !Object.values(THEME_SONG).includes(MELODIES[i].title));
const STREAK_GAP_MS = 2500;
let tapStreak = { key: "", at: 0, i: 0, mel: 0, moved: false }; // moved = 첫 곡을 끝내고 무작위 곡으로 넘어감
let lastRandomMel = -1;
/** 곡 전체 음 — 절 수만큼 되풀이(2절·3절까지 이어 친다). */
function melodySteps(m: Melody): Step[] {
  const n = Math.max(1, m.verses ?? 1);
  return n === 1 ? m.notes : Array.from({ length: n }, () => m.notes).flat();
}

/**
 * 기념일 탭 — 한 번 누르면 한 음(2026-10-06 소유자). 그 날의 노래가 있으면 그 노래, 없으면 돌아가며 다른 곡.
 * 한 번에 쭉 울리는 건 특별한 날뿐: 생일(빵빠레 + 생일 노래)·데뷔 주년/D+N00(의식 빵빠레) — 첫 탭에 통째로,
 * 이어 누르면 한 음씩. 2.5초 쉬면 곡 처음부터. 생일 노래가 흐르는 동안의 탭은 소리 없이 넘긴다.
 * 반환: kind "first"(연타의 첫 탭 — 특별한 날이면 노래/빵빠레, 아니면 첫 음 semi·title 포함) · "note"(이어지는 한 음) · "busy".
 */
export function playCelebrationTap(
  key: string,
  sound: CelebrationSound
): { kind: "first" | "note" | "busy"; semi?: number; title?: string } {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const cont = tapStreak.key === key && now - tapStreak.at < STREAK_GAP_MS;
  const grand = sound === "birthday" || sound === "grand";
  if (!cont) {
    // 새 연타 — 곡을 고른다: 그 날의 노래가 있으면 그 곡, 없으면 직전과 다른 곡을 차례로(처음은 무작위에서 출발).
    const themed = THEME_SONG[key];
    let mel = themed ? ALL_MELODIES.findIndex((m) => m.title === themed) : -1;
    if (mel < 0) {
      // 그 날의 노래가 없는 날 — 어느 날에도 매인 적 없는 곡들 중 무작위(직전 곡은 피한다, 2026-10-06 소유자).
      const choices = RANDOM_POOL.length > 1 ? RANDOM_POOL.filter((i) => i !== lastRandomMel) : RANDOM_POOL;
      mel = choices[Math.floor(Math.random() * choices.length)];
      lastRandomMel = mel;
    }
    tapStreak = { key, at: now, i: 0, mel, moved: false };
    if (grand) {
      playCelebration(sound);
      return { kind: "first" };
    }
  } else {
    tapStreak.at = now;
    if (sound === "birthday" && now < songUntil) return { kind: "busy" };
  }
  // 곡이 끝나면(2026-10-06 소유자) 같은 곡을 되풀이하지 않고 무작위로 다른 곡으로 넘어간다 — 날에 매인 곡(성탄 징글벨 등)도
  // 한 번 끝나면 무작위 곡으로 이어진다. 넘어간 곡의 첫 음에 다시 곡 이름 쪽지.
  let birthday = sound === "birthday" && !tapStreak.moved;
  let notes: Step[] = birthday ? BIRTHDAY_NOTES.map((n) => n[0]) : melodySteps(ALL_MELODIES[tapStreak.mel]);
  if (tapStreak.i >= notes.length) {
    const choices = RANDOM_POOL.filter((i) => i !== tapStreak.mel && i !== lastRandomMel);
    const next = choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : RANDOM_POOL[0];
    lastRandomMel = next;
    tapStreak.mel = next;
    tapStreak.i = 0;
    tapStreak.moved = true; // 생일 노래 다음부터도 일반 곡
    birthday = false;
    notes = melodySteps(ALL_MELODIES[next]);
  }
  const step = notes[tapStreak.i];
  const title = tapStreak.i === 0 ? (birthday ? "생일 축하합니다" : ALL_MELODIES[tapStreak.mel].title) : undefined;
  tapStreak.i += 1;
  pendingNotes = Array.isArray(step) ? step : [step];
  playSfx("note");
  return { kind: cont ? "note" : "first", semi: pendingNotes[pendingNotes.length - 1], title };
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
  // 검증용 순서 기록 — 테스트가 window.__sfxTrace = []를 깔아 둔 경우에만(한 동작 = 한 소리 실측).
  const trace = (window as unknown as { __sfxTrace?: string[] }).__sfxTrace;
  if (Array.isArray(trace)) trace.push(name);
  const out = ac.createGain();
  // 크기 곡선 — 1.6제곱(낮은 쪽은 섬세하게, 100이면 압축기 뒤에서 또렷하게) × 크기 ±1.5dB 흔들기.
  const level = Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20);
  out.gain.value = Math.pow(vol / 100, 1.6) * 1.25 * level;
  out.connect(masterBus(ac));
  // 음높이 ±3% 흔들기는 '효과음'에만 — 멜로디·노래·빵빠레(축하)와 잠금 해제 화음은 정확한 음으로.
  // ±3%는 반음의 절반이라, 노래에 걸면 음마다 조금씩 샵·플랫으로 어긋나 들렸다(2026-10-06 소유자 "음이 살짝 이상하다").
  jitter = CATEGORY[name] === "celebrate" || name === "unlock" ? 1 : 1 + (Math.random() * 2 - 1) * 0.03;
  render(ac, out, name);
  jitter = 1;
}

/** 기념일 테마 소리(lib/ui/celebration의 sound 이름). */
export function playCelebration(sound: CelebrationSound): void {
  if (sound === "none") return;
  playSfx(sound);
}
