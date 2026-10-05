// 효과음(2026-10-06) — 파일 없이 Web Audio로 짧게 합성한다(에셋·네트워크 0, 1초 미만).
// **기본 꺼짐**: 방송 중 편집실·시청자 화면 소리가 송출에 섞이거나, 시청자가 예상 못 한 소리에 놀랄 수 있다.
// 설정 '효과음'을 켠 기기에서만 난다(vic.sound = 'on'). 브라우저는 사용자 조작(클릭) 안에서만 소리를 허용하므로
// 이 함수는 클릭 처리기에서 불려야 한다.
import type { CelebrationSound } from "@/lib/ui/celebration";

const KEY = "vic.sound";

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}
export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* 이번 세션만 */
  }
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

/** 음 하나 — 주파수·시작(초)·길이(초)·파형·크기. 짧은 어택 + 지수 감쇠(종·현 느낌). */
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

/** 테마 소리 재생. 효과음이 꺼져 있으면 아무 일도 없다(호출부가 따로 거를 필요 없음). 소리는 움직임과 별개라 동작 줄이기와 무관. */
export function playCelebration(sound: CelebrationSound): void {
  if (sound === "none" || !soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = 0.5; // 전체 크기 — 은은하게(방송 배경음 위에서도 튀지 않게)
  out.connect(ac.destination);
  switch (sound) {
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
    case "pop":
    default: // 톡 — 짧게 위로 휘는 팝
      note(ac, out, N(0), 0, 0.12, "sine", 0.14, 1.8);
      note(ac, out, N(12), 0.06, 0.18, "triangle", 0.06);
      break;
  }
}
