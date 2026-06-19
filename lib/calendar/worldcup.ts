// 2026 FIFA 월드컵(미국·캐나다·멕시코, 48개국) 일정 표기 + 테마 기간.
// 토너먼트 단계 경계일은 FIFA가 공개한 확정 일정이라 그대로 넣는다(빨간날 아님, 표기만).
// 대한민국 개별 경기 날짜는 조 추첨/대진에 따라 달라지므로 KOREA_MATCHES로 따로 둔다 —
// 정확한 대진이 확정되면 owner가 이 배열만 채우면 달력(시청자+편집실)에 자동 표시된다.

export type WorldCupMark = {
  name: string; // 달력 칸에 표기될 문구(이모지 포함)
  isFinal?: boolean; // 결승 — 칸 강조용
  isKorea?: boolean; // 대한민국 경기 — 칸 강조용
  result?: "win" | "draw" | "loss"; // 끝난 한국 경기 결과 — 승이면 달력 탭 시 축포 셀레브레이션
};

// 대회 기간(이 기간이 보이는 달엔 포스터 테마를 월드컵으로 자동 전환).
export const WORLD_CUP_START = "2026-06-11"; // 개막전(에스타디오 아스테카, 멕시코시티)
export const WORLD_CUP_END = "2026-07-19"; // 결승(메트라이프 스타디움, 뉴저지)

// 토너먼트 단계 경계일 — FIFA 공개 일정 기준. 48개국이라 32강(Round of 32)이 있다.
const STAGE_MARKS: Record<string, string> = {
  "2026-06-11": "⚽ 월드컵 개막",
  "2026-06-28": "⚽ 32강",
  "2026-07-04": "⚽ 16강",
  "2026-07-09": "⚽ 8강",
  "2026-07-14": "⚽ 4강",
  "2026-07-18": "⚽ 3·4위전",
  "2026-07-19": "🏆 월드컵 결승"
};

// 대한민국 A조 조별리그 3경기 — 한국시간(KST) 날짜·킥오프 기준.
// 멕시코·남아프리카공화국·체코와 한 조. 추후 16강 이후 진출 시 owner가 추가하면 된다.
// 국기 이모지(🇰🇷 등)는 Windows 크롬에서 'KR'처럼 깨져 안 쓴다 — 텍스트+스타일로 강조.
export const KOREA_MATCHES: Record<string, { name: string; result?: "win" | "draw" | "loss" }> = {
  "2026-06-12": { name: "⚽ 한국 2-1 체코", result: "win" }, // 종료 — 한국 승(탭 시 축포)
  "2026-06-19": { name: "⚽ 한국 0-1 멕시코", result: "loss" }, // 종료 — 한국 패
  "2026-06-25": { name: "⚽ 한국 vs 남아공 10:00" }
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
