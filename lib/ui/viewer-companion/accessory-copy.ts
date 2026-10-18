import { COMPANION_ACCESSORIES, type CompanionAccessoryId } from "./accessory-catalog";

const descriptions: Partial<Record<CompanionAccessoryId, string>> = {
  sunglasses: "동그란 렌즈로 멋을 낸 선글라스.", beret: "작은 별이 달린 폭신한 베레모.",
  bow: "앞에 살포시 앉은 나비 리본.", "flower-crown": "작은 꽃을 엮은 화관.",
  "pixel-sunglasses": "네모난 픽셀 렌즈에 반짝임 한 조각.", "baseball-cap": "앞챙을 푹 눌러쓴 야구 모자.",
  "party-hat": "축하하는 날의 뾰족한 고깔.", "bell-badge": "앞에 달랑 매단 동그란 방울.",
  "propeller-hat": "작은 프로펠러가 달린 모자.", "magic-pocket": "앞에 붙인 동그란 요술 주머니.",
  "tiny-crown": "두 귀 사이에 쏙 들어가는 작은 왕관.", "round-glasses": "동그란 테가 또렷한 안경.",
  "wire-glasses": "가는 금빛 테의 동그란 안경.", "browline-glasses": "윗테가 도톰한 안경.",
  "heart-glasses": "하트 모양의 렌즈.", monocle: "한쪽 눈에만 걸친 작은 렌즈.",
  "top-hat": "반듯한 챙과 높은 모자통.", "magician-hat": "마술사가 쓰는 높은 모자.",
  "retro-cap": "둥근 모자통에 짧은 챙.", "detective-hat": "작은 탐정의 모자.",
  "wizard-hat": "끝이 뾰족한 마법사 모자.", "bucket-hat": "둥근 챙이 둘러진 모자.",
  "square-glasses": "반듯한 사각 테의 안경.", "sleep-mask-smile": "방긋 웃는 눈이 그려진 수면 안대.",
  "sleep-mask-drowsy": "나른한 눈이 그려진 수면 안대.", "sleep-mask-wide": "동그란 눈이 그려진 수면 안대.",
  "sleep-mask-tori": "토리님 눈매가 그려진 수면 안대.",
};

/** Presentational copy only. No new ability, drop rate or collection state. */
export function companionAccessoryCopy(id: CompanionAccessoryId) {
  const family = COMPANION_ACCESSORIES[id].family;
  const location = family === "head" ? "모자" : family === "eye-mask" ? "수면 안대" : family === "eyes" || family === "eye-cover" ? "안경" : "앞 장식";
  return { location, description: descriptions[id] ?? "빅타민의 작은 소품." };
}
