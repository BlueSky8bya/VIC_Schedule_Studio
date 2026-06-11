// 포메이션 슬롯 — bx(자기 골 0 .. 상대 골 1), by(위 0 .. 아래 1). 골키퍼 제외 필드 10명.
// (worldcup-ball-goal.tsx에서 이전. 엔진 단일 출처.)

import type { FormationId, Slot } from "@/lib/football/core/types";

export const FORMATIONS: Record<FormationId, Slot[]> = {
  "4-3-3": [
    { bx: 0.18, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.37, role: "DF" },
    { bx: 0.1, by: 0.63, role: "DF" },
    { bx: 0.18, by: 0.88, role: "DF" },
    { bx: 0.34, by: 0.5, role: "DM" },
    { bx: 0.47, by: 0.3, role: "MF" },
    { bx: 0.47, by: 0.7, role: "MF" },
    { bx: 0.72, by: 0.14, role: "WG" },
    { bx: 0.84, by: 0.5, role: "FW" },
    { bx: 0.72, by: 0.86, role: "WG" }
  ],
  "4-4-2": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.45, by: 0.12, role: "WG" },
    { bx: 0.4, by: 0.38, role: "MF" },
    { bx: 0.4, by: 0.62, role: "MF" },
    { bx: 0.45, by: 0.88, role: "WG" },
    { bx: 0.78, by: 0.4, role: "FW" },
    { bx: 0.78, by: 0.6, role: "FW" }
  ],
  "3-5-2": [
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.42, by: 0.1, role: "WG" },
    { bx: 0.4, by: 0.35, role: "MF" },
    { bx: 0.3, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.65, role: "MF" },
    { bx: 0.42, by: 0.9, role: "WG" },
    { bx: 0.8, by: 0.42, role: "FW" },
    { bx: 0.8, by: 0.58, role: "FW" }
  ],
  "4-2-3-1": [
    { bx: 0.17, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.17, by: 0.88, role: "DF" },
    { bx: 0.32, by: 0.4, role: "DM" },
    { bx: 0.32, by: 0.6, role: "DM" },
    { bx: 0.55, by: 0.16, role: "WG" },
    { bx: 0.58, by: 0.5, role: "MF" },
    { bx: 0.55, by: 0.84, role: "WG" },
    { bx: 0.85, by: 0.5, role: "FW" }
  ],
  "4-1-4-1": [
    { bx: 0.17, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.17, by: 0.88, role: "DF" },
    { bx: 0.32, by: 0.5, role: "DM" },
    { bx: 0.52, by: 0.14, role: "WG" },
    { bx: 0.5, by: 0.4, role: "MF" },
    { bx: 0.5, by: 0.6, role: "MF" },
    { bx: 0.52, by: 0.86, role: "WG" },
    { bx: 0.82, by: 0.5, role: "FW" }
  ],
  "3-4-3": [
    { bx: 0.12, by: 0.3, role: "DF" },
    { bx: 0.1, by: 0.5, role: "DF" },
    { bx: 0.12, by: 0.7, role: "DF" },
    { bx: 0.44, by: 0.12, role: "WG" },
    { bx: 0.42, by: 0.4, role: "MF" },
    { bx: 0.42, by: 0.6, role: "MF" },
    { bx: 0.44, by: 0.88, role: "WG" },
    { bx: 0.78, by: 0.22, role: "WG" },
    { bx: 0.84, by: 0.5, role: "FW" },
    { bx: 0.78, by: 0.78, role: "WG" }
  ],
  "5-3-2": [
    { bx: 0.16, by: 0.1, role: "DF" },
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.16, by: 0.9, role: "DF" },
    { bx: 0.4, by: 0.3, role: "MF" },
    { bx: 0.34, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.7, role: "MF" },
    { bx: 0.76, by: 0.4, role: "FW" },
    { bx: 0.76, by: 0.6, role: "FW" }
  ],
  "5-4-1": [
    { bx: 0.16, by: 0.1, role: "DF" },
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.16, by: 0.9, role: "DF" },
    { bx: 0.42, by: 0.14, role: "WG" },
    { bx: 0.38, by: 0.4, role: "MF" },
    { bx: 0.38, by: 0.6, role: "MF" },
    { bx: 0.42, by: 0.86, role: "WG" },
    { bx: 0.74, by: 0.5, role: "FW" }
  ],
  "4-5-1": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.44, by: 0.1, role: "WG" },
    { bx: 0.4, by: 0.32, role: "MF" },
    { bx: 0.32, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.68, role: "MF" },
    { bx: 0.44, by: 0.9, role: "WG" },
    { bx: 0.8, by: 0.5, role: "FW" }
  ],
  // 포지셔널 플레이(과르디올라) — 3백+더블피벗+전방 4(하프스페이스 점유)+1톱.
  "3-2-4-1": [
    { bx: 0.12, by: 0.25, role: "DF" },
    { bx: 0.1, by: 0.5, role: "DF" },
    { bx: 0.12, by: 0.75, role: "DF" },
    { bx: 0.34, by: 0.4, role: "DM" },
    { bx: 0.34, by: 0.6, role: "DM" },
    { bx: 0.6, by: 0.12, role: "WG" },
    { bx: 0.62, by: 0.38, role: "MF" },
    { bx: 0.62, by: 0.62, role: "MF" },
    { bx: 0.6, by: 0.88, role: "WG" },
    { bx: 0.85, by: 0.5, role: "FW" }
  ],
  // 다이아몬드(4-3-1-2) — 좁은 중앙 다이아 + 투톱(수직적 티키타카).
  "4-3-1-2": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.3, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.3, role: "MF" },
    { bx: 0.4, by: 0.7, role: "MF" },
    { bx: 0.58, by: 0.5, role: "MF" },
    { bx: 0.82, by: 0.4, role: "FW" },
    { bx: 0.82, by: 0.6, role: "FW" }
  ],
  // 4-4-1-1 — 두 줄 수비(시메오네) 기본형. 4백 4미들 + 처진 공격수.
  "4-4-1-1": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.44, by: 0.12, role: "WG" },
    { bx: 0.38, by: 0.4, role: "MF" },
    { bx: 0.38, by: 0.6, role: "MF" },
    { bx: 0.44, by: 0.88, role: "WG" },
    { bx: 0.64, by: 0.5, role: "MF" },
    { bx: 0.84, by: 0.5, role: "FW" }
  ],
  // 4-6-0 — 제로톱(가짜 9번). 정통 스트라이커 없이 미드 6, 최전방은 내려와 연계.
  "4-6-0": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.32, by: 0.4, role: "DM" },
    { bx: 0.32, by: 0.6, role: "DM" },
    { bx: 0.56, by: 0.14, role: "WG" },
    { bx: 0.62, by: 0.42, role: "MF" },
    { bx: 0.62, by: 0.58, role: "MF" },
    { bx: 0.56, by: 0.86, role: "WG" }
  ]
};
