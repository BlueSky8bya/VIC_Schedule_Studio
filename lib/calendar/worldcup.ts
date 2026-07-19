// 2026 FIFA 월드컵(미국·캐나다·멕시코, 48개국) 일정 표기 + 테마 기간.
// ★ 모든 날짜는 한국시간(KST) 기준(이 앱 불변식 #1). FIFA 공개 일정은 개최지 현지시각(ET/CT/MT/PT)
//   이라 오후·저녁 킥오프면 KST로는 '다음 날'이 된다(예: 결승 현지 7/19 오후 = KST 7/20). 그래서
//   단계 경계일을 현지 날짜 그대로 넣으면 하루 어긋난다 → 아래 STAGE_MARKS는 KST로 환산해 넣는다.
// 대한민국 개별 경기 날짜는 조 추첨/대진에 따라 달라지므로 KOREA_MATCHES로 따로 둔다(KST 기준) —
// 정확한 대진이 확정되면 owner가 이 배열만 채우면 달력(시청자+편집실)에 자동 표시된다.

export type WorldCupMark = {
  name: string; // 달력 칸에 표기될 문구(이모지 포함)
  isFinal?: boolean; // 결승 — 칸 강조용
  isKorea?: boolean; // 대한민국 경기 — 칸 강조용
  result?: "win" | "draw" | "loss"; // 끝난 한국 경기 결과 — 승이면 달력 탭 시 축포 셀레브레이션
};

// 대회 기간(이 기간이 보이는 달엔 포스터 테마를 월드컵으로 자동 전환). KST 기준.
export const WORLD_CUP_START = "2026-06-12"; // 개막전(현지 6/11 저녁, 멕시코시티) → KST 6/12
export const WORLD_CUP_END = "2026-07-20"; // 결승(현지 7/19 오후, 메트라이프) → KST 7/20

// 토너먼트 단계 경계일 — FIFA 공개(개최지 ET) 일정을 KST(+13h)로 환산. 현지 오후·저녁 킥오프라
// 모두 다음 날 KST가 된다. (현지 ET → KST 날짜)
//   개막 6/11 저녁 → 6/12 · 32강 시작 6/28 → 6/29 · 16강 시작 7/4 13:00 → 7/5 · 8강 시작 7/9 16:00 → 7/10
//   4강① 7/14 15:00 → 7/15 · 4강② 7/15 15:00 → 7/16 · 3·4위전 7/18 17:00 → 7/19 · 결승 7/19 15:00 → 7/20
// 4강부터는 하루 1경기라 실제 대진·스코어를 함께 표기한다(한국 경기와 같은 형식). 결승 스페인 1-0
// 아르헨티나(페란 토레스 106' 연장골)로 스페인 우승.
const STAGE_MARKS: Record<string, string> = {
  "2026-06-12": "⚽ 월드컵 개막",
  "2026-06-29": "⚽ 32강",
  "2026-07-05": "⚽ 16강",
  "2026-07-10": "⚽ 8강",
  "2026-07-15": "⚽ 4강 프랑스 0-2 스페인",
  "2026-07-16": "⚽ 4강 잉글랜드 1-2 아르헨티나",
  "2026-07-19": "⚽ 3·4위전 잉글랜드 6-4 프랑스",
  "2026-07-20": "🏆 월드컵 결승 스페인 1-0 아르헨티나"
};

// 대한민국 A조 조별리그 3경기 — 한국시간(KST) 날짜·킥오프 기준.
// 멕시코·남아프리카공화국·체코와 한 조. 추후 16강 이후 진출 시 owner가 추가하면 된다.
// 국기 이모지(🇰🇷 등)는 Windows 크롬에서 'KR'처럼 깨져 안 쓴다 — 텍스트+스타일로 강조.
export const KOREA_MATCHES: Record<string, { name: string; result?: "win" | "draw" | "loss" }> = {
  "2026-06-12": { name: "⚽ 한국 2-1 체코", result: "win" }, // 종료 — 한국 승(탭 시 축포)
  "2026-06-19": { name: "⚽ 한국 0-1 멕시코", result: "loss" }, // 종료 — 한국 패
  "2026-06-25": { name: "⚽ 한국 0-1 남아공", result: "loss" } // 종료 — 한국 패
};

// 그 날의 월드컵 표기(있으면). 한국 경기를 단계 표기보다 우선한다.
export function getWorldCupMark(isoDate: string): WorldCupMark | null {
  const kr = KOREA_MATCHES[isoDate];
  if (kr) {
    return { name: kr.name, isKorea: true, result: kr.result };
  }
  const stage = STAGE_MARKS[isoDate];
  if (stage) {
    return { name: stage, isFinal: isoDate === WORLD_CUP_END };
  }
  return null;
}

// 보고 있는 달이 월드컵 기간과 겹치는가 — 포스터 테마 자동 전환 판정용.
export function isWorldCupMonth(year: number, month: number): boolean {
  const startY = Number(WORLD_CUP_START.slice(0, 4));
  const startM = Number(WORLD_CUP_START.slice(5, 7));
  const endY = Number(WORLD_CUP_END.slice(0, 4));
  const endM = Number(WORLD_CUP_END.slice(5, 7));
  const ym = year * 12 + (month - 1);
  return ym >= startY * 12 + (startM - 1) && ym <= endY * 12 + (endM - 1);
}
