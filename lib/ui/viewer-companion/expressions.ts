import type { CompanionPersonality } from "./preferences";

/** These are face sequences, not new brain actions. No expression moves the
 * pet, restarts its current action, creates an item or grants a reward. */
export const COMPANION_EXPRESSIONS = [
  ["scent", "냄새를 따라가는 눈"], ["first-bite", "첫 한입 기대"], ["savor", "천천히 음미"], ["sour", "시큼해서 찡긋"], ["hot", "뜨거워 호호"], ["icy", "너무 차가워 찌릿"],
  ["spicy", "매워서 눈물 맺힘"], ["polite-no", "싫지만 예의 차리기"], ["full", "배불러 만족"], ["last-bite", "마지막 한입 아쉬움"], ["sleepy", "졸음을 참는 눈"], ["awake", "개운한 기상"],
  ["greeting", "발견하고 반기는 눈"], ["shy", "부끄러워 시선 피하기"], ["melt", "쓰다듬기에 녹는 얼굴"], ["more-pets", "손길 멈춰서 빤히"], ["busy", "지금은 조금 귀찮아"], ["play-ready", "같이 놀고 싶은 초롱눈"],
  ["tidy-pride", "정리 끝내고 뿌듯"], ["treasure", "소중한 장난감 흐뭇"], ["search", "어디 뒀지 찾는 눈"], ["reading", "책에 집중한 얼굴"], ["tv", "TV에 푹 빠짐"], ["giggle", "웃음 참다가 빵"],
  ["listen", "소리에 귀 쫑긋"], ["relief", "놀랐다가 안심"], ["innocent", "들켜서 시치미"], ["sorry", "미안해서 올려보기"], ["oops", "아차 하고 집중"], ["unimpressed", "어이없어 반눈"],
  ["sunny", "햇살에 눈 가늘게"], ["rain", "빗소리에 차분한 눈"], ["sneeze", "재채기 직전 간질"], ["warm", "더워서 잠깐 헥"], ["cold", "추워서 입 달달"], ["resolve", "마음먹고 또렷한 눈"],
] as const;
export type CompanionExpressionId = typeof COMPANION_EXPRESSIONS[number][0];
export type CompanionFace = Readonly<{ left: number; right: number; gazeX: number; gazeY: number; smile: number; open: number; slant: number; tears: number; tremble: number; weight: number }>;
const neutral: CompanionFace = { left: 1, right: 1, gazeX: 0, gazeY: 0, smile: 0, open: 0, slant: 0, tears: 0, tremble: 0, weight: 0 };
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
export const COMPANION_EXPRESSION_MS = 1450;
// New reactions retain a recognisable plump pupil. Natural blink/sleep frames
// remain in the original animation; a reaction never turns every eye to a line.
export const COMPANION_EXPRESSION_MIN_EYE = .76;

/** Eye openness clips the existing eye, never enlarges its width/iris. Body,
 * ears, face spacing and eyewear are not part of this sampler. */
export function sampleCompanionExpression(id: CompanionExpressionId, progress: number, reduced = false): CompanionFace {
  const p = clamp(progress); if (reduced || p <= 0 || p >= 1) return neutral;
  const weight = smooth(p / .2) * smooth((1 - p) / .22), beat = smooth((p - .25) / .35), wave = Math.sin(p * Math.PI * 2), v = { ...neutral, weight };
  switch (id) {
    case "scent": Object.assign(v, { gazeX: 1.2 * wave, gazeY: .5, open: .12 }); break;
    case "first-bite": Object.assign(v, { gazeY: .6, smile: .5, open: .25 * beat }); break;
    case "savor": Object.assign(v, { left: .25, right: .25, smile: .85 }); break;
    case "sour": Object.assign(v, { left: .08, right: .6, open: .35, slant: -.4 }); break;
    case "hot": Object.assign(v, { left: .65, right: .65, open: .45 + .25 * Math.sin(p * Math.PI * 6) ** 2 }); break;
    case "icy": Object.assign(v, { left: .12 + .4 * beat, right: .12 + .4 * beat, smile: -.35, tremble: .7 }); break;
    case "spicy": Object.assign(v, { left: .45, right: .45, open: .7, tears: .8 }); break;
    case "polite-no": Object.assign(v, { left: .7, right: .85, gazeX: 1.1, smile: .3 - .5 * beat }); break;
    case "full": Object.assign(v, { left: .48, right: .48, smile: .75, gazeY: .3 }); break;
    case "last-bite": Object.assign(v, { gazeY: .9, smile: -.5 * (1 - beat), left: .8, right: .8 }); break;
    case "sleepy": Object.assign(v, { left: .2 + .75 * beat, right: .45 + .5 * beat, smile: -.1 }); break;
    case "awake": Object.assign(v, { left: .35 + .65 * beat, right: .35 + .65 * beat, smile: .45 * beat, gazeY: -.4 }); break;
    case "greeting": Object.assign(v, { smile: .8, open: .25 * (1 - beat), gazeY: -.5 }); break;
    case "shy": Object.assign(v, { gazeX: 1.15 * (1 - beat), left: .85, right: .85, smile: .4 }); break;
    case "melt": Object.assign(v, { left: .08, right: .08, smile: .8, gazeY: -.2 }); break;
    case "more-pets": Object.assign(v, { gazeY: -.9, open: .25, smile: .2 }); break;
    case "busy": Object.assign(v, { left: .5, right: .65, gazeX: -.8, smile: -.2 }); break;
    case "play-ready": Object.assign(v, { gazeX: wave, smile: .7, open: .2 }); break;
    case "tidy-pride": Object.assign(v, { left: .35, right: .35, smile: .95, gazeY: -.25 }); break;
    case "treasure": Object.assign(v, { gazeY: .9, left: .6, right: .6, smile: .7 }); break;
    case "search": Object.assign(v, { gazeX: 1.3 * Math.sin(p * Math.PI * 3), gazeY: .35, open: .15 }); break;
    case "reading": Object.assign(v, { gazeX: 1.1 * (p * 2 - 1), gazeY: .9, left: .75, right: .75 }); break;
    case "tv": Object.assign(v, { gazeX: -.8, gazeY: .2, open: .35 }); break;
    case "giggle": Object.assign(v, { left: 1 - .9 * beat, right: 1 - .9 * beat, smile: .95, open: .5 * beat }); break;
    case "listen": Object.assign(v, { gazeX: .9, gazeY: -.6, left: .9, right: 1, open: .1 }); break;
    case "relief": Object.assign(v, { left: 1 - .6 * beat, right: 1 - .6 * beat, open: .4 * (1 - beat), smile: .5 * beat }); break;
    case "innocent": Object.assign(v, { gazeX: 1.2 * beat, smile: .1, left: .95, right: .95 }); break;
    case "sorry": Object.assign(v, { gazeY: .8 - 1.6 * beat, smile: -.4, slant: .4 }); break;
    case "oops": Object.assign(v, { open: .5 * (1 - beat), smile: -.15, gazeY: .7, left: 1 - .2 * beat, right: 1 - .2 * beat }); break;
    case "unimpressed": Object.assign(v, { left: .4, right: .5, smile: -.45, gazeX: .6 }); break;
    case "sunny": Object.assign(v, { left: .35, right: .35, smile: .45, gazeY: -.5 }); break;
    case "rain": Object.assign(v, { left: .65, right: .65, smile: .25, gazeY: .45, gazeX: -.55 }); break;
    case "sneeze": Object.assign(v, { left: .65 - .6 * beat, right: .65 - .6 * beat, open: .2 + .6 * Math.sin(p * Math.PI) ** 4 }); break;
    case "warm": Object.assign(v, { left: .7, right: .7, open: .5 + .15 * wave, gazeY: .2 }); break;
    case "cold": Object.assign(v, { left: .55, right: .55, smile: -.3, tremble: 1 }); break;
    case "resolve": Object.assign(v, { left: .85, right: .85, gazeX: .8, smile: .2, slant: -.3 }); break;
  }
  v.left = Math.max(COMPANION_EXPRESSION_MIN_EYE, v.left);
  v.right = Math.max(COMPANION_EXPRESSION_MIN_EYE, v.right);
  return v;
}

export type CompanionExpressionContext = Readonly<{
  token: string; status: string; play?: string; phase: number; personality: CompanionPersonality; atHome: boolean; energy: number;
  food?: string; foodRefused?: boolean; petting: boolean; busy: boolean; userNear: boolean; toyPlaying: boolean; toyApproach: boolean;
  lookingOut: boolean; reading: boolean; watching: boolean; music: boolean; season: number; weather: string; daylight: boolean;
  outing: boolean; cleanupReceipt?: number; meal?: { serial: number; food: string; full: boolean; last: boolean }; mishap?: boolean;
}>;
const sour = new Set(["lemon", "lime", "grapefruit", "green-apple", "yuzu", "kumquat"]), icy = new Set(["frozen-leftover-pizza", "frozen-leftover-tteokbokki", "ice-cream", "mint-choco-ice-cream", "bingsu", "popsicle"]);
const hot = /(?:soup|stew|tteokguk|ramen|ramyeon|kalguksu|samgyetang|miyeok|guk|hotteok)/, spicy = /(?:tteokbokki|kimchi|spicy|buldak|jjamppong)/;
export function companionMealExpression(food: string): CompanionExpressionId {
  return icy.has(food) || food.startsWith("frozen-") ? "icy" : sour.has(food) ? "sour" : spicy.test(food) ? "spicy" : hot.test(food) ? "hot" : "savor";
}

/** Finite display-only owner. Concrete event/action tokens are consumed once;
 * no timer/rAF is created and an expired sequence cannot rearm itself. */
export function createCompanionExpressions() {
  let active: { id: CompanionExpressionId; token: string; began: number } | undefined, previousPet = false, petStarted = 0, petEnded = 0, serial = 0, nextAt = 0;
  let previousInside: boolean | undefined, entered = 0, mealSerial = 0, mealAt = -Infinity, cleanup = 0;
  const seen = new Map<string, number>();
  return {
    sample(c: CompanionExpressionContext, now: number, quiet = false) {
      if (!Number.isFinite(now) || quiet) { active = undefined; previousPet = c.petting; mealSerial = c.meal?.serial ?? mealSerial; cleanup = c.cleanupReceipt ?? cleanup; return null; }
      if (c.petting && !previousPet) { petStarted = now; serial++; }
      if (!c.petting && previousPet) petEnded = now;
      previousPet = c.petting;
      if (previousInside === false && c.atHome) { entered++; } previousInside = c.atHome;
      if (active && (now - active.began >= COMPANION_EXPRESSION_MS || now < active.began)) { active = undefined; nextAt = now + 8000; }
      let id: CompanionExpressionId | undefined, token = c.token;
      if (c.petting) { id = c.busy || ["sleepy", "homebody"].includes(c.personality) && c.energy < .35 ? "busy" : now - petStarted > 550 ? "melt" : ["affectionate", "balanced"].includes(c.personality) ? "shy" : "greeting"; token = `pet:${serial}:${id}`; }
      else if (petEnded && now - petEnded < 1800) { id = "more-pets"; token = `pet-end:${serial}`; }
      else if (c.cleanupReceipt && c.cleanupReceipt !== cleanup) { id = "tidy-pride"; token = `cleanup:${c.cleanupReceipt}`; }
      else if (c.meal && c.meal.serial !== mealSerial) { id = companionMealExpression(c.meal.food); token = `meal:${c.meal.serial}`; }
      else if (c.meal && now - mealAt < 4400 && now - mealAt >= COMPANION_EXPRESSION_MS) { id = c.meal.full ? "full" : c.meal.last ? "last-bite" : undefined; token = `meal-after:${c.meal.serial}`; }
      else if (c.foodRefused) id = "polite-no";
      else if (c.status === "eat" && c.phase < .45) id = "first-bite";
      else if (c.play === "slip-tumble" || c.play === "tumble") id = c.phase < .5 ? "oops" : "relief";
      else if (c.play === "recover" || c.play === "bump") id = "relief";
      else if (c.mishap && c.userNear) id = c.personality === "mischievous" ? "innocent" : "sorry";
      else if (c.play === "sulk" || c.status === "disappointed") id = "unimpressed";
      else if (c.status === "wake") id = "awake";
      else if (c.status === "yawn" || c.energy < .25 && ["idle", "look"].includes(c.status)) id = "sleepy";
      else if (c.status === "sniff") id = c.food ? "scent" : "search";
      else if (c.toyApproach) id = "play-ready";
      else if (c.reading) id = "reading";
      else if (c.toyPlaying) id = c.play === "wiggle" || c.play === "bounce" ? "giggle" : "treasure";
      else if (c.watching) id = c.phase > .65 && ["performer", "mischievous"].includes(c.personality) ? "giggle" : "tv";
      else if (c.music) id = "listen";
      else if (c.lookingOut) id = c.weather === "rain" || c.weather === "snow" ? "rain" : c.season === 3 || c.season === 4 ? "sneeze" : c.daylight ? "sunny" : "rain";
      else if (c.atHome && entered && (c.season >= 11 || c.season <= 2)) { id = "cold"; token = `return:${entered}:cold`; }
      else if (c.season >= 6 && c.season <= 8 && c.daylight && ["idle", "look"].includes(c.status)) id = "warm";
      else if (c.outing && ["walk", "look", "idle"].includes(c.status)) id = "resolve";
      else if (c.userNear && !c.atHome && c.status === "look") id = "greeting";
      if (id && !token.includes(":" + id)) token += ":" + id;
      const known = seen.has(token);
      const direct = /^(pet:|pet-end:|meal:|meal-after:|cleanup:)/.test(token);
      if (id && !known && (!active || c.petting && !active.token.startsWith("pet:") || !c.petting && token.startsWith("meal:") || token.startsWith("cleanup:")) && (direct || now >= nextAt)) {
        active = { id, token, began: now }; seen.set(token, now);
        if (token.startsWith("meal:")) { mealSerial = c.meal!.serial; mealAt = now; }
        if (token.startsWith("cleanup:")) cleanup = c.cleanupReceipt!;
        // Per-action tokens plus a global rest keep faces from becoming a
        // stationary performance loop. This does not delay the brain.
        if (seen.size > 96) seen.delete(seen.keys().next().value!);
      }
      if (!active) return null;
      return { id: active.id, progress: clamp((now - active.began) / COMPANION_EXPRESSION_MS) };
    },
    clear() { active = undefined; previousPet = false; petEnded = 0; nextAt = 0; },
  };
}
