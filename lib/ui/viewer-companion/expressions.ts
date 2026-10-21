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
/** Eye shapes use the original eye footprint. Closed smiles/squeezes are
 * explicit curves, never an almost-flat clipped pupil. All fields stay numeric
 * so the same finite sampler is usable by the runtime and visual audit. */
export const COMPANION_EYE_SHAPE = { round: 0, soft: 1, flat: 2, smile: 3, squeeze: 4, focus: 5, worry: 6 } as const;
export const COMPANION_MOUTH_SHAPE = { smile: 0, round: 1, pout: 2, grin: 3, wave: 4, tongue: 5, cat: 6 } as const;
export type CompanionFace = Readonly<{ left: number; right: number; leftShape: number; rightShape: number; leftClosure: number; rightClosure: number; mouth: number; brow: number; shine: number; gazeX: number; gazeY: number; smile: number; open: number; slant: number; tears: number; tremble: number; weight: number }>;
const neutral: CompanionFace = { left: 1, right: 1, leftShape: 0, rightShape: 0, leftClosure: 0, rightClosure: 0, mouth: 0, brow: 0, shine: 0, gazeX: 0, gazeY: 0, smile: 0, open: 0, slant: 0, tears: 0, tremble: 0, weight: 0 };
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
export const COMPANION_EXPRESSION_MS = 1450;
// This is an open pupil's aperture, not a blink. Deliberate closures have
// their own continuous channel and substantial curved contour (166).
export const COMPANION_EXPRESSION_MIN_EYE = .78;
export function sampleCompanionExpression(id: CompanionExpressionId, progress: number, reduced = false): CompanionFace {
  const p = clamp(progress); if (reduced || p <= 0 || p >= 1) return neutral;
  const weight = smooth(p / .2) * smooth((1 - p) / .22), beat = smooth((p - .25) / .35), wave = Math.sin(p * Math.PI * 2), v = { ...neutral, weight };
  const E = COMPANION_EYE_SHAPE, M = COMPANION_MOUTH_SHAPE;
  const eyes = (leftShape: number, rightShape = leftShape, closure = 1) => Object.assign(v, { leftShape, rightShape,
    leftClosure: leftShape === E.smile || leftShape === E.squeeze ? closure : 0,
    rightClosure: rightShape === E.smile || rightShape === E.squeeze ? closure : 0 });
  switch (id) {
    case "scent": Object.assign(v, { gazeX: 1.6 * wave, gazeY: .6, left: .85, open: .1, mouth: M.round }); break;
    case "first-bite": Object.assign(v, { gazeY: 1.1, smile: .8, open: .55 * beat, mouth: M.round, shine: 1 }); break;
    case "savor": eyes(E.soft); Object.assign(v, { left: .65, right: .65, smile: .75, gazeY: .3 }); break;
    case "sour": eyes(E.squeeze, E.flat); Object.assign(v, { right: .65, open: .35, mouth: M.pout, slant: -.5 }); break;
    case "hot": eyes(E.worry); Object.assign(v, { open: .45 + .25 * Math.sin(p * Math.PI * 6) ** 2, mouth: M.round, brow: .7, gazeY: -.3 }); break;
    case "icy": eyes(E.squeeze); Object.assign(v, { smile: -.5, mouth: M.wave, tremble: .85, brow: .3 }); break;
    case "spicy": eyes(E.soft); Object.assign(v, { left: .65, right: .65, open: .9, mouth: M.grin, tears: 1, brow: .9 }); break;
    case "polite-no": eyes(E.soft, E.round); Object.assign(v, { left: .65, gazeX: 1.4, smile: .15 - .6 * beat, mouth: M.pout }); break;
    case "full": eyes(E.soft); Object.assign(v, { left: .65, right: .65, smile: .9, mouth: M.cat, gazeY: .6 }); break;
    case "last-bite": eyes(E.worry); Object.assign(v, { gazeY: 1.3, smile: -.65, mouth: M.pout, brow: .8 }); break;
    case "sleepy": eyes(E.flat, E.soft); Object.assign(v, { left: .55 + .35 * beat, right: .7, open: .35 + .4 * Math.sin(p * Math.PI) ** 2, mouth: M.round, gazeY: .7 }); break;
    case "awake": eyes(E.smile, E.smile, 1 - smooth((beat - .1) / .5)); Object.assign(v, { smile: .75 * beat, mouth: M.grin, gazeY: -1, shine: .6 }); break;
    case "greeting": eyes(E.smile, E.soft); Object.assign(v, { right: .8, smile: 1, open: .55, mouth: M.grin, gazeY: -.6 }); break;
    case "shy": eyes(E.soft); Object.assign(v, { gazeX: 1.6 * (1 - beat * .45), gazeY: .65, left: .8, right: .8, smile: .5, mouth: M.pout }); break;
    case "melt": eyes(E.smile); Object.assign(v, { smile: 1, mouth: M.cat, gazeY: -.3, slant: .35 }); break;
    case "more-pets": Object.assign(v, { gazeY: -1.6, open: .4, mouth: M.round, brow: .6, shine: .8 }); break;
    case "busy": eyes(E.flat, E.focus); Object.assign(v, { left: .55, right: .7, gazeX: -1.3, smile: -.5, brow: -.6 }); break;
    case "play-ready": Object.assign(v, { gazeX: 1.3 * wave, gazeY: -.4, smile: .9, open: .6, mouth: M.grin, shine: 1 }); break;
    case "tidy-pride": eyes(E.smile, E.soft); Object.assign(v, { left: .6, right: .6, smile: 1, gazeY: -.8, mouth: M.grin, slant: -.25 }); break;
    case "treasure": eyes(E.soft); Object.assign(v, { gazeY: 1.4, left: .8, right: .8, smile: .7, mouth: M.cat, shine: .6 }); break;
    case "search": eyes(E.round, E.flat); Object.assign(v, { right: .7, gazeX: 1.8 * Math.sin(p * Math.PI * 3), gazeY: .3, open: .25, mouth: M.round, brow: .5 }); break;
    case "reading": eyes(E.focus); Object.assign(v, { gazeX: 1.6 * (p * 2 - 1), gazeY: 1.4, left: .8, right: .8, smile: -.1 }); break;
    case "tv": Object.assign(v, { gazeX: -1.4, gazeY: .15, open: .6, mouth: M.round }); break;
    case "giggle": eyes(E.smile, E.smile, smooth((beat - .12) / .5)); Object.assign(v, { smile: 1, open: .95 * beat, mouth: M.grin, slant: .45 * wave }); break;
    case "listen": eyes(E.round, E.soft); Object.assign(v, { gazeX: 1.4, gazeY: -1.3, right: .8, open: .1, brow: .6, mouth: M.round }); break;
    case "relief": eyes(E.smile, E.smile, smooth((beat - .22) / .5)); Object.assign(v, { open: .65 * (1 - beat), mouth: M.round, smile: .6 * beat, brow: .7 * (1 - beat) }); break;
    case "innocent": eyes(E.round, E.soft); Object.assign(v, { gazeX: 1.7 * beat, right: .85, smile: .1, mouth: M.cat, brow: .35 }); break;
    case "sorry": eyes(E.worry); Object.assign(v, { gazeY: .8 - 2.1 * beat, smile: -.8, mouth: M.pout, brow: 1, slant: .4 }); break;
    case "oops": Object.assign(v, { open: .85 - .35 * beat, mouth: M.round, gazeY: 1.1, brow: .9 }); break;
    case "unimpressed": eyes(E.flat); Object.assign(v, { left: .55, right: .55, smile: -.1, gazeX: 1.2, mouth: M.wave }); break;
    case "sunny": eyes(E.soft); Object.assign(v, { left: .55, right: .55, smile: .7, gazeY: -1.2 }); break;
    case "rain": eyes(E.soft); Object.assign(v, { left: .8, right: .8, smile: .35, gazeY: 1.1, gazeX: -.9 }); break;
    case "sneeze": eyes(E.squeeze); Object.assign(v, { open: .3 + .7 * Math.sin(p * Math.PI) ** 4, mouth: M.round, brow: -.4 }); break;
    case "warm": eyes(E.flat); Object.assign(v, { left: .7, right: .7, open: .65, mouth: M.tongue, gazeY: .7 }); break;
    case "cold": eyes(E.worry); Object.assign(v, { left: .8, right: .8, smile: -.5, mouth: M.wave, tremble: 1, brow: .65 }); break;
    case "resolve": eyes(E.focus); Object.assign(v, { left: .75, right: .75, gazeX: 1.3, smile: .5, slant: -.4, brow: -.8 }); break;
  }
  // Compress the authored aperture range instead of clamping many different
  // faces to the same value. Half-lids remain distinct without sliver pupils.
  const aperture = (n: number) => COMPANION_EXPRESSION_MIN_EYE + (clamp(n, .55, 1) - .55) / .45 * (1 - COMPANION_EXPRESSION_MIN_EYE);
  v.left = aperture(v.left); v.right = aperture(v.right);
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
