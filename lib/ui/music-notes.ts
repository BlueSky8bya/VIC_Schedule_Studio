// 춤추는 음표(2026-10-06 소유자: "생일 멜로디가 나올 때 음표가 춤추듯이 지나가서 연주하는 동안 눈을 더 재미있게",
// "빵빠레를 연속 클릭하면 한 음씩 멜로디") — 소리(lib/ui/sfx)와 같은 시간표로 화면에 음표를 띄운다.
// DOM 직접(body 직속, 고정 위치) — 노래 7초 동안 React 상태를 흔들지 않는다. 움직임은 transform/opacity만(globals.css .mn-*).
// 높은 음일수록 높이 뜬다(오선지처럼) — 귀로 듣는 선율이 눈으로도 오르내린다.
import { BIRTHDAY_SONG, SONG_DELAY } from "@/lib/ui/sfx";

const GLYPHS = ["♪", "♫", "♬", "♩"];
const COLORS = ["#ff7eb6", "#ffb84d", "#6cc6ff", "#a78bfa", "#4fd1a5", "#ff8f70"];

function spawn(x: number, y: number, cls: string, i: number, travel: number): void {
  const wrap = document.createElement("span");
  wrap.className = `mn-note ${cls}`;
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.left = `${x}px`;
  wrap.style.top = `${y}px`;
  wrap.style.setProperty("--mn-travel", `${travel}px`);
  wrap.style.setProperty("--mn-tilt", `${i % 2 ? 14 : -14}deg`);
  const inner = document.createElement("span");
  inner.className = "mn-inner";
  inner.textContent = GLYPHS[i % GLYPHS.length];
  inner.style.color = COLORS[i % COLORS.length];
  wrap.appendChild(inner);
  document.body.appendChild(wrap);
  window.setTimeout(() => wrap.remove(), 3400);
}

/** 연속 탭 멜로디의 한 음 — 누른 자리에서 음표 하나가 통 튀어 올라 흔들리며 사라진다. */
export function popMusicNote(x: number, y: number, semi: number, i: number): void {
  if (typeof document === "undefined") return;
  spawn(x - 10, y - 14 - semi * 4, "mn-pop", i, 0);
}

let songTimers: number[] = [];
/** 생일 노래 — 음마다 그 순간에 음표가 태어나 오른쪽으로 춤추며 흘러간다(높은 음 = 높이). 다시 부르면 앞 노래 음표 예약은 지운다. */
export function danceBirthdaySong(x: number, y: number): void {
  if (typeof window === "undefined") return;
  songTimers.forEach((t) => window.clearTimeout(t));
  const baseY = Math.max(80, Math.min(window.innerHeight - 80, y - 40));
  const startX = Math.max(24, Math.min(window.innerWidth - 60, x - 20));
  // 화면 오른쪽에서 눌렀으면 왼쪽(화면 안쪽)으로 흘러간다 — 오른쪽 끝 칸(토요일)에서 바로 화면 밖으로 사라지지 않게.
  const toLeft = startX > window.innerWidth * 0.6;
  const room = toLeft ? startX - 40 : window.innerWidth - startX - 40;
  const travel = (toLeft ? -1 : 1) * Math.min(560, Math.max(160, room));
  songTimers = BIRTHDAY_SONG.map((n, i) =>
    window.setTimeout(() => spawn(startX, baseY - n.semi * 7, "mn-dance", i, travel), (SONG_DELAY + n.at) * 1000)
  );
}
