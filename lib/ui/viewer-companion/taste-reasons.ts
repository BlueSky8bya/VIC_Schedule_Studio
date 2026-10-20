import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import type { CompanionLife } from "./life";
import { COMPANION_FOOD_FAMILY } from "./food-family";
import { isCompanionToyKind, type CompanionToyKind } from "./toy-catalog";

export const COMPANION_FOOD_TASTE_REASONS = ["sweet-bite", "fresh-bite", "cozy-bite", "durian-socks", "sharp-sour", "green-bitter", "strong-aroma", "spicy-tickle",
  "fruity-aroma", "fruit-treat", "zesty-bite", "refreshing-bite", "vegetable-aroma", "mild-bite", "crisp-bite", "juicy-bite", "soft-bite", "nutty-bite",
  "baked-aroma", "bread-comfort", "buttery-bite", "rice-savory", "rice-chewy", "noodle-savory", "meal-satisfying", "warm-soup", "cheesy-bite",
  "dessert-smile", "dessert-treat", "cocoa-bite", "creamy-bite", "cool-bite", "durian-whoa", "durian-lingers", "sour-squint", "sour-pucker",
  "bitter-lingers", "green-surprise", "aroma-overload", "aroma-lingers", "spicy-fan", "spicy-surprise",
  "icy-tooth", "frozen-chew", "flavour-clash", "sweet-savoury-surprise", "herb-cloud", "cricket-surprise", "adventurous-bite", "homemade-comfort", "choco-crunch"] as const;
export type CompanionFoodTasteReason = typeof COMPANION_FOOD_TASTE_REASONS[number];
export type CompanionFoodTasteOutcome = { food: CompanionFoodKind; reaction: "delighted" | "liked" | "disliked"; reason: CompanionFoodTasteReason };
export const COMPANION_TOY_TASTE_REASONS = ["toy-fun", "toy-trip", "toy-round", "toy-jingle", "toy-flutter", "toy-soft", "toy-wheels", "toy-spin", "toy-colors", "toy-familiar", "toy-trip-round", "toy-trip-corner", "toy-trip-tangle", "toy-trip-careful", "toy-keycap", "toy-mirror", "toy-face", "toy-music-shape", "toy-pocket"] as const;
export type CompanionToyTasteReason = typeof COMPANION_TOY_TASTE_REASONS[number];
export type CompanionTasteReason = CompanionFoodTasteReason | CompanionToyTasteReason;
export const COMPANION_TASTE_REASON_TEXT: Readonly<Record<CompanionTasteReason, string>> = {
  "sweet-bite": "달콤해서 기분 좋아요", "fresh-bite": "산뜻한 맛이 좋아요", "cozy-bite": "먹으니 마음이 포근해요",
  "durian-socks": "주인 양말 냄새남", "sharp-sour": "너무 셔서 눈이 찡해요", "green-bitter": "쌉쌀한 맛에 깜짝",
  "strong-aroma": "향이 코끝에 오래 남아요", "spicy-tickle": "혀가 따끔따끔해요",
  "toy-fun": "함께 노니 신나요", "toy-trip": "놀다가 걸려 넘어졌어요",
  "fruity-aroma": "달달한 과일 향이 좋아요", "fruit-treat": "한입 먹으면 기분이 좋아요", "zesty-bite": "새콤해서 잠이 확 깨요", "refreshing-bite": "입안이 산뜻해져요",
  "vegetable-aroma": "은은한 채소 향이 좋아요", "mild-bite": "담백해서 자꾸 찾게 돼요", "crisp-bite": "아삭아삭 씹는 게 좋아요", "juicy-bite": "달콤한 즙이 팡 터져요", "soft-bite": "부드럽게 녹는 맛이 좋아요", "nutty-bite": "고소한 맛이 오래 남아요",
  "baked-aroma": "구운 빵 냄새에 끌려요", "bread-comfort": "빵 먹는 시간이 제일 좋아요", "buttery-bite": "고소한 버터 향이 좋아요", "rice-savory": "밥의 고소한 맛이 좋아요", "rice-chewy": "오물오물 씹기 좋아요", "noodle-savory": "면에 밴 맛이 좋아요", "meal-satisfying": "든든하게 먹기 좋아요", "warm-soup": "따뜻한 국물이 포근해요", "cheesy-bite": "치즈의 고소한 맛이 좋아요",
  "dessert-smile": "달콤해서 웃음이 나요", "dessert-treat": "간식 시간이 기다려져요", "cocoa-bite": "진한 초콜릿 맛이 좋아요", "creamy-bite": "크림처럼 부드러워요", "cool-bite": "시원해서 기분이 좋아요",
  "durian-whoa": "코를 찡그리게 되는 냄새예요", "durian-lingers": "먹고 나서도 양말 냄새가 나요", "sour-squint": "신맛에 눈이 저절로 감겨요", "sour-pucker": "혀가 오그라들 만큼 셔요",
  "bitter-lingers": "쌉쌀한 맛이 자꾸 남아요", "green-surprise": "풀 맛에 깜짝 놀랐어요", "aroma-overload": "코끝에 향이 꽉 찼어요", "aroma-lingers": "진한 향이 아직 낯설어요", "spicy-fan": "매워서 입에 바람이 필요해요", "spicy-surprise": "입안이 화끈해서 놀랐어요",
  "toy-round": "동글동글한 모양이 좋아요", "toy-jingle": "딸랑딸랑 소리가 좋아요", "toy-flutter": "가볍게 살랑이는 게 좋아요", "toy-soft": "말랑한 생김새가 좋아요", "toy-wheels": "작은 바퀴가 마음에 들어요", "toy-spin": "빙글빙글 도는 게 재미있어요", "toy-colors": "알록달록해서 자꾸 보게 돼요", "toy-familiar": "여러 번 놀아서 정들었어요",
  "toy-trip-round": "동그란 장난감에 발이 걸렸어요", "toy-trip-corner": "딱딱한 모서리에 걸려 넘어졌어요", "toy-trip-tangle": "길쭉한 장난감에 걸려 넘어졌어요", "toy-trip-careful": "전에 넘어져서 조금 조심해요",
  "icy-tooth": "너무 꽁꽁 얼어서 이가 시려요", "frozen-chew": "차가운 떡이 아직 딱딱해요", "flavour-clash": "달고 짠 맛이 서로 싸워요", "sweet-savoury-surprise": "국물에서 간식 맛이 나서 놀랐어요", "herb-cloud": "민트와 고수 향이 코를 꽉 채워요", "cricket-surprise": "초콜릿인 줄 알았는데 깜짝이야",
  "adventurous-bite": "처음 만난 조합이 은근히 좋아요", "homemade-comfort": "정성 담긴 한 그릇이 포근해요", "choco-crunch": "초콜릿 끝에 바삭한 과자가 좋아요",
  "toy-keycap": "톡 눌러 보고 싶은 모양이에요", "toy-mirror": "거울 속 동그란 친구가 궁금해요", "toy-face": "작은 토리님 얼굴이 반가워요", "toy-music-shape": "음표 닮은 생김새가 재미있어요", "toy-pocket": "가방 속 보물을 찾은 것 같아요",
};
const sour: readonly CompanionFoodKind[] = ["lemon", "grapefruit", "yuzu", "kumquat", "kiwi", "pineapple"];
const green: readonly CompanionFoodKind[] = ["broccoli", "bell-pepper", "eggplant", "cabbage"];
const sweet: readonly CompanionFoodKind[] = ["strawberry", "mango", "peach", "banana", "pudding", "cookie", "macaron", "doughnut", "cupcake"];
function sensory(food: CompanionFoodKind): { negative?: CompanionFoodTasteReason; positive: CompanionFoodTasteReason; chance: number } {
  if (food === "frozen-leftover-pizza") return { negative: "icy-tooth", positive: "cheesy-bite", chance: .3 };
  if (food === "frozen-leftover-tteokbokki") return { negative: "frozen-chew", positive: "rice-chewy", chance: .34 };
  if (food === "cricket-pepero") return { negative: "cricket-surprise", positive: "adventurous-bite", chance: .54 };
  if (food === "herb-avocado-milk") return { negative: "herb-cloud", positive: "adventurous-bite", chance: .52 };
  if (food === "blue-marshmallow-tteokguk" || food === "mint-choco-brisket-stew") return { negative: "flavour-clash", positive: "adventurous-bite", chance: .5 };
  if (food === "kkak-kong-soup" || food === "birthday-seaweed-soup") return { positive: "homemade-comfort", chance: 0 };
  if (food === "pepero") return { positive: "choco-crunch", chance: 0 };
  if (food === "durian") return { negative: "durian-socks", positive: "sweet-bite", chance: .48 };
  if (sour.includes(food)) return { negative: "sharp-sour", positive: "fresh-bite", chance: .24 };
  if (green.includes(food)) return { negative: "green-bitter", positive: "fresh-bite", chance: .22 };
  if (food === "curry") return { negative: "spicy-tickle", positive: "cozy-bite", chance: .22 };
  if (food === "coconut") return { negative: "strong-aroma", positive: "sweet-bite", chance: .2 };
  // An ordinary meal does not acquire an invented aversion to an unfamiliar
  // texture. Only the explicit polarizing flavours above permit adversity.
  return { positive: sweet.includes(food) ? "sweet-bite" : "cozy-bite", chance: 0 };
}

function positiveReasons(food: CompanionFoodKind): readonly CompanionFoodTasteReason[] {
  const basic = sensory(food).positive;
  if (sour.includes(food)) return [basic, "zesty-bite", "refreshing-bite"];
  const family = COMPANION_FOOD_FAMILY[food];
  const families: Record<string, readonly CompanionFoodTasteReason[]> = {
    fruit: [basic, "fruity-aroma", "fruit-treat"], vegetable: [basic, "vegetable-aroma", "mild-bite"], bread: [basic, "baked-aroma", "bread-comfort"],
    rice: [basic, "rice-savory", "rice-chewy"], noodle: [basic, "noodle-savory", "meal-satisfying"], meal: [basic, "meal-satisfying", "nutty-bite"], dessert: [basic, "dessert-smile", "dessert-treat"],
  };
  const special: readonly [readonly string[], CompanionFoodTasteReason][] = [
    [["apple", "carrot", "cucumber", "radish", "bell-pepper", "celery"], "crisp-bite"],
    [["watermelon", "melon", "pear", "peach", "orange", "grape", "tomato"], "juicy-bite"],
    [["banana", "mango", "durian", "avocado"], "soft-bite"], [["chestnut", "walnut", "almond", "peanut", "pistachio"], "nutty-bite"],
    [["croissant", "salt-bread", "financier", "madeleine"], "buttery-bite"], [["soup", "seaweed-soup", "rice-porridge"], "warm-soup"],
    [["pizza", "cheese-bread", "cheesecake"], "cheesy-bite"], [["chocolate", "tiramisu"], "cocoa-bite"], [["pudding", "yogurt", "cream-bun", "cream-puff"], "creamy-bite"],
    [["mochi-icecream", "icecream-cone", "popsicle", "bingsu"], "cool-bite"],
  ];
  return [...new Set([...(families[family] ?? [basic]), ...special.filter(([foods]) => foods.includes(food)).map(([, reason]) => reason)])];
}
function negativeReasons(food: CompanionFoodKind): readonly CompanionFoodTasteReason[] {
  const reason = sensory(food).negative;
  if (reason === "durian-socks") return [reason, "durian-whoa", "durian-lingers"];
  if (reason === "sharp-sour") return [reason, "sour-squint", "sour-pucker"];
  if (reason === "green-bitter") return [reason, "bitter-lingers", "green-surprise"];
  if (reason === "strong-aroma") return [reason, "aroma-overload", "aroma-lingers"];
  if (reason === "spicy-tickle") return [reason, "spicy-fan", "spicy-surprise"];
  if (reason === "flavour-clash") return [reason, "sweet-savoury-surprise"];
  if (reason === "herb-cloud") return [reason, "aroma-overload", "green-surprise"];
  if (reason === "cricket-surprise") return [reason, "flavour-clash", "sour-squint"];
  if (reason === "icy-tooth" || reason === "frozen-chew") return [reason];
  return [];
}
const foodReasons = new Map<CompanionFoodKind, { positive: readonly CompanionFoodTasteReason[]; negative: readonly CompanionFoodTasteReason[] }>();
const foodReasonPool = (food: CompanionFoodKind) => {
  let pool = foodReasons.get(food);
  if (!pool) { pool = { positive: positiveReasons(food), negative: negativeReasons(food) }; foodReasons.set(food, pool); }
  return pool;
};
export function isPositiveCompanionTasteReason(reason: CompanionTasteReason) {
  return !["durian-socks", "sharp-sour", "green-bitter", "strong-aroma", "spicy-tickle", "durian-whoa", "durian-lingers", "sour-squint", "sour-pucker", "bitter-lingers", "green-surprise", "aroma-overload", "aroma-lingers", "spicy-fan", "spicy-surprise", "icy-tooth", "frozen-chew", "flavour-clash", "sweet-savoury-surprise", "herb-cloud", "cricket-surprise", "toy-trip", "toy-trip-round", "toy-trip-corner", "toy-trip-tangle", "toy-trip-careful"].includes(reason);
}
export function companionToyTasteReason(kind: CompanionToyKind, outcome: "played" | "tripped", count: number): CompanionToyTasteReason {
  if (!Number.isSafeInteger(count) || count <= 1) return outcome === "played" ? "toy-fun" : "toy-trip";
  if (outcome === "tripped") {
    if (["ball", "hoop", "ribbon-ball", "yo-yo", "stacking-rings"].includes(kind)) return count % 2 ? "toy-trip-careful" : "toy-trip-round";
    if (["blocks", "dice", "toy-car", "train", "tori-keycap-clicker", "card-mirror", "half-wallet", "power-bank", "sewing-kit", "tori-acrylic-stand", "vr-headset", "drawing-tablet"].includes(kind)) return count % 2 ? "toy-trip-careful" : "toy-trip-corner";
    return ["feather", "paper-plane", "star-wand", "maraca", "toy-rocket", "otamatone", "tail-comb", "airy-velvet-tint", "matte-turbo-lighter", "herbal-lip-balm", "ceramic-safety-cutter", "practice-baseball-bat", "broadcast-microphone", "vr-fishing-rod"].includes(kind) && count % 2 === 0 ? "toy-trip-tangle" : "toy-trip-careful";
  }
  if (count % 3 === 0) return "toy-familiar";
  if (kind === "tori-keycap-clicker") return "toy-keycap";
  if (kind === "card-mirror") return "toy-mirror";
  if (kind === "tori-photocard" || kind === "tori-acrylic-stand") return "toy-face";
  if (kind === "otamatone") return "toy-music-shape";
  if (["tail-comb", "airy-velvet-tint", "half-wallet", "power-bank", "wireless-earbuds", "sewing-kit", "matte-turbo-lighter", "herbal-lip-balm", "ceramic-safety-cutter", "tori-tumbler"].includes(kind)) return "toy-pocket";
  if (["bell", "tambourine", "maraca"].includes(kind)) return "toy-jingle";
  if (["feather", "paper-plane", "pinwheel", "star-wand", "cheer-pompom"].includes(kind)) return "toy-flutter";
  if (["toy-car", "train"].includes(kind)) return "toy-wheels";
  if (kind === "spinning-top") return "toy-spin";
  if (["duck", "plush-fish", "squeaky-carrot", "pangtteok-cushion", "tori-blanket", "practice-baseball-glove"].includes(kind)) return "toy-soft";
  return ["ball", "hoop", "ribbon-ball", "yo-yo", "stacking-rings"].includes(kind) ? "toy-round" : "toy-colors";
}
export function isCompanionToyTasteReason(kind: unknown, reason: unknown): reason is CompanionToyTasteReason {
  if (!isCompanionToyKind(kind)) return false;
  return ["toy-fun", "toy-trip", ...[2, 3, 4].flatMap(count => [companionToyTasteReason(kind, "played", count), companionToyTasteReason(kind, "tripped", count)])].includes(reason as string);
}
/** This is a display explanation of the existing innate preference, not a
 * meal, discovery or learned-memory write. */
export function companionInnateFoodReason(food: CompanionFoodKind) {
  const family = COMPANION_FOOD_FAMILY[food];
  if (sour.includes(food)) return "원래 새콤한 맛을 좋아해요";
  return ({ fruit: "원래 과일 향에 끌려요", vegetable: "원래 담백한 채소를 좋아해요", bread: "원래 고소한 빵을 좋아해요", rice: "원래 밥과 떡을 좋아해요", noodle: "원래 면 요리를 좋아해요", meal: "원래 든든한 간식을 좋아해요", dessert: "원래 달콤한 간식을 좋아해요" })[family] ?? "처음부터 마음에 든 간식이에요";
}

/** One impression after a successful real meal. The caller supplies one draw;
 * reading a profile, refusing food or feeling full never evaluates a taste. */
export function evaluateCompanionFoodTaste(food: CompanionFoodKind, life: Pick<CompanionLife, "seedFood" | "foodScores"> | undefined, roll: number): CompanionFoodTasteOutcome {
  const profile = sensory(food), value = Number.isFinite(roll) ? Math.max(0, Math.min(1, roll)) : .5;
  let seed = 0; for (const char of `${life?.seedFood ?? "apple"}:${food}`) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const stored = life?.foodScores[food], learned = typeof stored === "number" && Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : .5;
  const chance = profile.negative ? Math.max(.06, Math.min(.6, profile.chance + (seed % 17 - 8) / 200 - (learned - .5) * .12)) : 0;
  const disliked = Boolean(profile.negative && value < chance), pool = foodReasonPool(food)[disliked ? "negative" : "positive"];
  const index = value === 0 || value === 1 ? 0 : Math.floor(value * 10007) % pool.length;
  return { food, reaction: disliked ? "disliked" : value >= Math.max(.64, chance + .3) ? "delighted" : "liked", reason: pool[index] };
}

export function isCompanionFoodTasteOutcome(value: unknown): value is CompanionFoodTasteOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!isCompanionFoodKind(item.food)) return false;
  const pool = foodReasonPool(item.food);
  return item.reaction === "disliked" ? pool.negative.includes(item.reason as CompanionFoodTasteReason)
    : ["delighted", "liked"].includes(item.reaction as string) && pool.positive.includes(item.reason as CompanionFoodTasteReason);
}
