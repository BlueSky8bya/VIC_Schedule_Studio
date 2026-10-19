import type { CompanionPlay } from "./brain";
import type { CompanionPersonality } from "./preferences";
import type { CompanionHomeTvState } from "./home-room-media";
import type { CompanionToyKind } from "./toy-catalog";

/** All listed triggers are required, not alternatives. Event triggers are
 * current finite signals; the director also proves each source's predicates.
 * Free means a safe choice opportunity, never a forged pet/meal/work event. */
export type SceneTrigger = "editor-open" | "free" | "toy" | "food" | "pet" | "music" | "work" | "undo" | "arrival" | "layout" | "toy-returned" | "toy-settled" | "recovered" | "meal" | "favorite" | "outfit" | "rain" | "summer" | "night" | "experience" | "tv";
export type SceneBeat = (
  | { kind: "pose"; pose: CompanionPlay | "sniff" | "look" | "stretch" | "shake"; ms?: number }
  | { kind: "go"; target: "pointer" | "sofa" | "floor" | "window" | "pad" | "novel-place" | "toy" | "toy-other-side" | "food" | "box" | "dispenser" }
  | { kind: "tv"; state: CompanionHomeTvState | "next" }
  | { kind: "light"; lit: boolean }
  | { kind: "radio"; playing: boolean }
  | { kind: "curtain"; phase: "open" | "shade" | "closed" }
  | { kind: "toy"; mode: "play" | "return" | "inspect" | "toss" | "nudge" | "spawn"; kinds?: readonly CompanionToyKind[]; limit?: number }
  | { kind: "food"; mode: "eat" | "tidy" | "inspect" | "compare" | "spawn" }
  | { kind: "watch"; ms: number }
  | { kind: "sleep"; ms: number }
  | { kind: "wash"; ms: number }
  | { kind: "hide"; ms: number }
) & { optional?: boolean };
export type PersonalitySceneRecipe = {
  id: string; label: string; personality: CompanionPersonality; major: boolean;
  triggers: readonly SceneTrigger[]; steps: readonly SceneBeat[];
};

const p = (pose: Extract<SceneBeat, { kind: "pose" }>["pose"]): SceneBeat => ({ kind: "pose", pose });
const g = (target: Extract<SceneBeat, { kind: "go" }>["target"]): SceneBeat => ({ kind: "go", target });
const t = (mode: Extract<SceneBeat, { kind: "toy" }>["mode"], kinds?: readonly CompanionToyKind[], limit = 1): SceneBeat => ({ kind: "toy", mode, ...(kinds ? { kinds } : {}), limit });
const f = (mode: Extract<SceneBeat, { kind: "food" }>["mode"]): SceneBeat => ({ kind: "food", mode });
const tv = (state: CompanionHomeTvState | "next"): SceneBeat => ({ kind: "tv", state });
const light = (lit: boolean): SceneBeat => ({ kind: "light", lit });
const curtain = (phase: "open" | "shade" | "closed"): SceneBeat => ({ kind: "curtain", phase });
const w = (ms: number): SceneBeat => ({ kind: "watch", ms });
const nap = (ms: number): SceneBeat => ({ kind: "sleep", ms });
const wash = (ms: number): SceneBeat => ({ kind: "wash", ms });
const hide = (ms: number): SceneBeat => ({ kind: "hide", ms });
const opt = (beat: SceneBeat): SceneBeat => ({ ...beat, optional: true });

/** Source: docs/agent/reports/REPORT-20261019-136-personality-scenes.html.
 * The complete source contracts are preserved in the137 implementation audit.
 * These are executable requests, not completion evidence. The single runtime
 * retains object IDs through pick/travel/drop and requires each actual ACK.
 * Optional branches never create an absent object or forge an experience.
 * Entry signatures are separate preparation, not a success of these scenes. */
export const COMPANION_PERSONALITY_SCENES: readonly PersonalitySceneRecipe[] = Object.freeze([
  // P01 계기: 실제 방문을 확인했고, 착지·잡기·운반 등 진행 중인 일을 안전하게 마친 첫 여유가 생긴다.
  { id: "P01", label: "돌아온 사람을 위한 작은 개막식", personality: "performer", major: true, triggers: ["arrival"], steps: [p("cheer-rehearsal"), p("celebrate"), p("bow"), g("floor")] },
  // P02 계기: 접근 가능한 실제 마라카스나 탬버린이 있고, 허기·사용자 입력에 양보할 필요가 없다.
  { id: "P02", label: "마라카스 한 개로 여는 소품 무대", personality: "performer", major: true, triggers: ["toy"], steps: [t("inspect", ["maraca", "tambourine"]), g("floor"), t("play", ["maraca", "tambourine"]), p("cheer-rehearsal"), p("bow"), t("return", ["maraca", "tambourine"])] },
  // P03 계기: 허용된 라디오·악기에서 실제 들린 구절이 있고, 다른 공연이나 음소거 정책과 충돌하지 않는다.
  { id: "P03", label: "음악 한 구절을 받는 짧은 응원", personality: "performer", major: true, triggers: ["music"], steps: [p("cheer-rehearsal"), p("celebrate"), p("bow")] },
  // P04 계기: 공개 일반 일정의 실제 저장 성공이라는 고정 완료 신호가 왔고, 입력·IME·저장·모달 소유권이 끝난다.
  { id: "P04", label: "잘 끝난 공개 작업에 축하 한 번", personality: "performer", major: true, triggers: ["work"], steps: [p("cheer-rehearsal"), p("celebrate"), p("bow"), g("floor")] },
  // P05 계기: 짧은 공연을 실제로 마친 직후 사용자가 쓰다듬어 주었으며, 교감 기능이 허용돼 있다.
  { id: "P05", label: "앵콜은 딱 한 번, 다른 재롱으로", personality: "performer", major: true, triggers: ["pet"], steps: [p("celebrate"), p("bow"), p("groom")] },
  { id: "P06", label: "공과 맞춰 통통", personality: "performer", major: false, triggers: ["toy"], steps: [t("toss", ["ball"]), w(700), g("toy"), p("celebrate"), p("bow")] },
  { id: "P07", label: "기차 옆 행진", personality: "performer", major: false, triggers: ["toy"], steps: [t("nudge", ["train"]), g("toy"), p("bow")] },
  { id: "P08", label: "별 지팡이 소개", personality: "performer", major: false, triggers: ["toy"], steps: [t("inspect", ["star-wand"]), p("cheer-rehearsal"), p("bow"), t("return", ["star-wand"])] },
  { id: "P09", label: "굴러도 마지막 인사", personality: "performer", major: false, triggers: ["recovered"], steps: [p("shake"), p("bow")] },
  { id: "P10", label: "새로 입은 액세서리 자랑", personality: "performer", major: false, triggers: ["outfit"], steps: [p("celebrate"), p("bow"), p("groom")] },
  { id: "P11", label: "관객 없는 연습", personality: "performer", major: false, triggers: ["free"], steps: [p("cheer-rehearsal"), p("bow")] },
  { id: "P12", label: "빛 아래 작은 무대", personality: "performer", major: false, triggers: ["tv"], steps: [g("floor"), p("cheer-rehearsal"), p("celebrate"), p("bow")] },
  // C01 계기: 사용자가 놓은 실제 장난감이 정착했고, 아직 덜 경험한 물건이며 안전한 접근로가 있다.
  { id: "C01", label: "처음 놓인 장난감의 양쪽 살피기", personality: "curious", major: true, triggers: ["toy", "toy-settled"], steps: [p("sniff"), g("toy"), t("inspect"), opt(g("toy-other-side")), p("sniff"), p("bow"), t("play"), t("return")] },
  // C02 계기: 실제 식사 가능한 새 음식이 있고, feeding이 켜져 있으며 현재 배고픔이 식사를 허용한다.
  { id: "C02", label: "처음 맛보는 음식 앞의 한 걸음", personality: "curious", major: true, triggers: ["food"], steps: [f("inspect"), p("shake"), g("food"), f("eat")] },
  // C03 계기: 실제 종이비행기가 있고, 날리기·도착·회수가 성립하는 안전한 목적지가 확인된다.
  { id: "C03", label: "종이비행기의 도착 지점 조사", personality: "curious", major: true, triggers: ["toy"], steps: [t("inspect", ["paper-plane"]), t("toss", ["paper-plane"]), w(900), g("toy"), t("inspect", ["paper-plane"]), t("return", ["paper-plane"])] },
  // C04 계기: 실제 TV 시청을 시작할 수 있고, 사람이 최근 끄거나 고정한 선택을 침범하지 않는 자유 기회다.
  { id: "C04", label: "TV 다섯 채널 중 한 번 비교하기", personality: "curious", major: true, triggers: ["tv"], steps: [g("sofa"), tv("nature"), w(1400), tv("next"), w(3000), p("bow")] },
  // C05 계기: 실제 월 이동·레이아웃 변경이 끝나 새 안전 구간이 확인됐으며 사용자의 입력이 끝났다.
  { id: "C05", label: "달력이 바뀐 뒤 안전한 새 자리 하나", personality: "curious", major: true, triggers: ["layout"], steps: [p("sniff"), g("novel-place"), p("stretch"), p("bow")] },
  { id: "C06", label: "멈춘 공을 늦게 톡", personality: "curious", major: false, triggers: ["toy", "toy-settled"], steps: [w(500), g("toy"), t("nudge", ["ball"]), p("bow")] },
  { id: "C07", label: "만화경 가까이 보기", personality: "curious", major: false, triggers: ["toy"], steps: [t("inspect", ["kaleidoscope"]), p("sniff"), t("return", ["kaleidoscope"])] },
  { id: "C08", label: "팽이 앞 갸웃", personality: "curious", major: false, triggers: ["toy"], steps: [t("inspect", ["spinning-top"]), p("bow"), t("return", ["spinning-top"])] },
  { id: "C09", label: "덜 논 실물 선택", personality: "curious", major: false, triggers: ["toy"], steps: [t("inspect"), t("play"), p("bow")] },
  { id: "C10", label: "반대쪽으로 빼꼼", personality: "curious", major: false, triggers: ["free"], steps: [hide(1600), p("bow"), g("novel-place")] },
  { id: "C11", label: "처음 들린 소리", personality: "curious", major: false, triggers: ["music"], steps: [p("sniff"), w(2500), p("bow")] },
  { id: "C12", label: "창밖 비 한 번 보기", personality: "curious", major: false, triggers: ["rain"], steps: [g("window"), curtain("open"), w(2200), p("stretch")] },
  // A01 계기: 포인터가 실제 접근 가능한 안전한 곳에 멈췄고, 입력·드래그·모달이 없으며 petting이 허용된다.
  { id: "A01", label: "멈춘 마우스 옆의 작은 부탁", personality: "affectionate", major: true, triggers: ["free"], steps: [g("pointer"), p("ask-petting"), w(1200), p("bow"), g("floor")] },
  // A02 계기: 사용자가 실제 쓰다듬었고 기존 교감 완료가 확인된다. 자율 동작을 사용자 경험으로 위조하지 않는다.
  { id: "A02", label: "실제 쓰다듬기 뒤 오래 남는 만족", personality: "affectionate", major: true, triggers: ["pet"], steps: [p("lean-nuzzle"), p("groom"), p("bow")] },
  // A03 계기: 실제 오리·물고기 인형을 소유해 놀고 있는데 사용자가 안전한 근처에 멈춘다.
  { id: "A03", label: "놀던 인형을 들고 사람에게 인사", personality: "affectionate", major: true, triggers: ["toy"], steps: [t("inspect", ["duck", "plush-fish"]), g("pointer"), p("bow"), t("play", ["duck", "plush-fish"]), t("return", ["duck", "plush-fish"])] },
  // A04 계기: 실제 보이는 재회가 있었고 공유 KST가 밤이다. 부재 기간은 인사의 변주에만 쓴다.
  { id: "A04", label: "밤의 실제 재회, 조용한 옆자리", personality: "affectionate", major: true, triggers: ["arrival", "night"], steps: [g("pointer"), p("lean-nuzzle"), w(1000), p("bow")] },
  // A05 계기: 실제 낙하·거친 놀이 후 회복을 마쳤고, 사용자가 다시 안전한 곳에 멈춘다.
  { id: "A05", label: "넘어진 뒤, 실제 안심을 기다리는 재접근", personality: "affectionate", major: true, triggers: ["recovered"], steps: [p("shake"), g("pointer"), p("ask-petting"), w(1000), p("groom"), g("floor")] },
  { id: "A06", label: "쿠션에서 몸 내밀기", personality: "affectionate", major: false, triggers: ["free"], steps: [g("sofa"), p("lean-nuzzle"), p("groom")] },
  { id: "A07", label: "한 번만 따라가기", personality: "affectionate", major: false, triggers: ["free"], steps: [g("pointer"), p("bow"), g("floor")] },
  { id: "A08", label: "음식보다 먼저 인사", personality: "affectionate", major: false, triggers: ["food"], steps: [g("pointer"), p("bow"), f("eat")] },
  { id: "A09", label: "음악 끝에 가까이 꾸벅", personality: "affectionate", major: false, triggers: ["music"], steps: [g("pointer"), p("bow"), w(800)] },
  { id: "A10", label: "저장 뒤 응원 대신 곁 지키기", personality: "affectionate", major: false, triggers: ["work"], steps: [g("pointer"), p("lean-nuzzle"), w(1200), p("bow")] },
  { id: "A11", label: "TV보다 사람 보기", personality: "affectionate", major: false, triggers: ["tv"], steps: [w(700), g("pointer"), p("bow"), g("sofa"), w(1700)] },
  { id: "A12", label: "교감 OFF의 조용한 인사", personality: "affectionate", major: false, triggers: ["free"], steps: [p("bow"), p("groom")] },
  // S01 계기: 한 활동을 마치고 빈 쿠션에 안전하게 도착했으며, 현재 에너지를 다시 확인할 수 있다.
  { id: "S01", label: "잘 자려다 다시 구경하는 쿠션 의식", personality: "sleepy", major: true, triggers: ["free"], steps: [g("sofa"), p("doze-curl"), p("cozy-nest"), nap(6500), p("stretch")] },
  // S02 계기: 현재 졸음이 있지만 실제 허기가 높고 접근 가능한 음식이 있으며 feeding이 허용된다.
  { id: "S02", label: "졸리지만 밥부터 먹는 한 끼", personality: "sleepy", major: true, triggers: ["food"], steps: [p("stretch"), f("inspect"), f("eat"), p("groom"), g("sofa")] },
  // S03 계기: 실제 휴식 조건이 있고 가까운 장난감 한 개가 안전하게 반납 가능하다. 급한 욕구와 사용자 입력은 없다.
  { id: "S03", label: "장난감 하나만 치우고 쉬기", personality: "sleepy", major: true, triggers: ["toy"], steps: [t("return", undefined, 1), g("sofa"), p("cozy-nest"), nap(5500)] },
  // S04 계기: 공유 KST가 밤이고 실제 졸음과 수면 허용이 있으며 안전한 귀가가 완료됐다.
  { id: "S04", label: "달별 TV를 보다 준비하는 밤 휴식", personality: "sleepy", major: true, triggers: ["night"], steps: [g("sofa"), tv("moon"), w(2200), p("doze-curl"), tv("off"), light(false), curtain("closed"), nap(7000), p("stretch")] },
  // S05 계기: 실제 깃털 장난감이 가까운 안전한 곳에 있고 현재 놀이 선택이 허용된다.
  { id: "S05", label: "깃털에 놀라 깨어나는 짧은 놀이", personality: "sleepy", major: true, triggers: ["toy"], steps: [t("inspect", ["feather"]), t("play", ["feather"]), p("stretch"), t("return", ["feather"]), p("bow")] },
  { id: "S06", label: "느린 첫 인사", personality: "sleepy", major: false, triggers: ["arrival"], steps: [p("stretch"), p("bow")] },
  { id: "S07", label: "물고기 인형 감상", personality: "sleepy", major: false, triggers: ["toy"], steps: [t("inspect", ["plush-fish"]), w(900), t("return", ["plush-fish"])] },
  { id: "S08", label: "쓰담 뒤 하품", personality: "sleepy", major: false, triggers: ["pet"], steps: [p("doze-curl"), p("stretch")] },
  { id: "S09", label: "쉬다가 자세 바꾸기", personality: "sleepy", major: false, triggers: ["free"], steps: [p("cozy-nest"), p("stretch"), p("groom")] },
  { id: "S10", label: "떨어진 물건에 눈 뜨기", personality: "sleepy", major: false, triggers: ["toy", "toy-settled"], steps: [p("stretch"), t("inspect"), p("bow")] },
  { id: "S11", label: "깨어 있는 귀 반응", personality: "sleepy", major: false, triggers: ["free"], steps: [p("doze-curl"), p("stretch"), p("bow")] },
  { id: "S12", label: "작업 틈 스트레칭", personality: "sleepy", major: false, triggers: ["work"], steps: [p("stretch"), p("groom")] },
  // T01 계기: 실제 장난감이 흩어져 있고 급한 허기가 없으며 상자까지 현재 경로가 성립한다.
  { id: "T01", label: "한 물건부터 끝내는 장난감 정리", personality: "tidy", major: true, triggers: ["toy"], steps: [p("groom"), t("return", undefined, 1), p("bow")] },
  // T02 계기: 현재 배가 부르고 실제 최애·선호 음식이 남았으며 집 안에 안전한 빈 보관 자리가 있다.
  { id: "T02", label: "좋아하는 음식은 버리지 않고 보관", personality: "tidy", major: true, triggers: ["food"], steps: [f("tidy"), p("groom"), p("bow")] },
  // T03 계기: 포만 상태·비최애 음식·현재 쓰레기통·접근 경로가 모두 유효하며 기존 폐기 조건이 충족된다.
  { id: "T03", label: "버릴 수 있는 음식만 실제 쓰레기통으로", personality: "tidy", major: true, triggers: ["food"], steps: [f("tidy"), p("shake"), p("groom")] },
  // T04 계기: 정리 대상으로 다가가는 중이거나 유한한 운반 과정에서 사용자가 같은 물건을 직접 잡는다.
  { id: "T04", label: "정리하다 사용자가 집으면 바로 양보", personality: "tidy", major: true, triggers: ["experience"], steps: [p("bow"), opt(t("return", undefined, 1)), p("groom")] },
  // T05 계기: 마지막 실제 물건의 반납 완료가 확인됐고 빈 씻기 패드로 가는 몸의 안전 경로가 성립한다.
  { id: "T05", label: "정리 완료 뒤 씻고 쉬는 작은 보상", personality: "tidy", major: true, triggers: ["toy-returned"], steps: [g("pad"), wash(2000), g("sofa"), p("groom")] },
  { id: "T06", label: "겹친 음식 하나 옮기기", personality: "tidy", major: false, triggers: ["food"], steps: [f("tidy"), p("bow")] },
  { id: "T07", label: "할 일이 없으면 몸단장", personality: "tidy", major: false, triggers: ["free"], steps: [p("groom"), p("sniff"), p("bow")] },
  { id: "T08", label: "음식과 장난감 중 한 작업", personality: "tidy", major: false, triggers: ["toy", "food"], steps: [t("return", undefined, 1), p("groom")] },
  { id: "T09", label: "운반 중 새 물건은 다음 차례", personality: "tidy", major: false, triggers: ["toy", "toy-settled"], steps: [t("return", undefined, 1), p("sniff"), p("bow")] },
  { id: "T10", label: "굴러도 원래 물건으로", personality: "tidy", major: false, triggers: ["toy", "recovered"], steps: [p("shake"), t("return", undefined, 1), p("groom")] },
  { id: "T11", label: "음악 중에도 반납부터", personality: "tidy", major: false, triggers: ["toy", "music"], steps: [t("return", undefined, 1), p("bow"), w(1100)] },
  { id: "T12", label: "편집 완료 뒤 내 주변 정돈", personality: "tidy", major: false, triggers: ["work", "toy"], steps: [t("return", undefined, 1), p("groom")] },
  // M01 계기: 실제 공이 안전한 바닥에 있고 이동·점프 등 현재 허용 기능과 경로가 맞는다.
  { id: "M01", label: "한 번 굴리고 한 번 더 바꾸는 공놀이", personality: "mischievous", major: true, triggers: ["toy"], steps: [t("toss", ["ball"]), g("toy"), t("toss", ["ball"]), g("toy"), t("return", ["ball"])] },
  // M02 계기: 실제 자동차 장난감이 있고 충돌 없이 짧게 움직일 바닥 구간이 확인된다.
  { id: "M02", label: "자동차를 밀고 따라잡는 작은 소동", personality: "mischievous", major: true, triggers: ["toy"], steps: [t("nudge", ["toy-car"]), g("toy"), p("pounce"), t("return", ["toy-car"])] },
  // M03 계기: 사용자가 실제 소품을 잡았다 놓았고 정착이 끝났으며, 같은 실물은 현재 사용자 소유가 아니다.
  { id: "M03", label: "사용자가 놓은 소품에 딱 한 번 덤비기", personality: "mischievous", major: true, triggers: ["toy", "toy-settled"], steps: [p("pounce"), t("play"), t("return")] },
  // M04 계기: 사용자가 실제 장난감을 방금 반납했으며 그 완료가 확인된다. 근처에 다른 안전한 놀이나 제자리 표현이 있다.
  { id: "M04", label: "정리한 상자는 건드리지 않는 딴청", personality: "mischievous", major: true, triggers: ["toy-returned"], steps: [p("look"), g("floor"), p("pounce"), p("bow")] },
  // M05 계기: 자율 TV 선택이 향후 연결돼 있고 실제 시청 구간이 끝났으며, 사람 선택과 충돌하지 않는 낮은 에너지 상태다.
  { id: "M05", label: "채널 한 번 바꾸다가 조용해지는 반전", personality: "mischievous", major: true, triggers: ["tv"], steps: [w(1000), tv("moon"), w(3300), p("groom")] },
  { id: "M06", label: "나온 블록 조금 흩어 보기", personality: "mischievous", major: false, triggers: ["toy"], steps: [t("toss", ["blocks"]), g("toy"), t("inspect", ["blocks"]), p("bow")] },
  { id: "M07", label: "상자에서 한 개만", personality: "mischievous", major: false, triggers: ["free"], steps: [g("box"), t("spawn", undefined, 1), t("play"), t("return")] },
  { id: "M08", label: "먹기 전 한 번만 장난", personality: "mischievous", major: false, triggers: ["food"], steps: [f("inspect"), p("pounce"), f("eat")] },
  { id: "M09", label: "비행기 반대쪽 봤다가 따라가기", personality: "mischievous", major: false, triggers: ["toy"], steps: [t("toss", ["paper-plane"]), p("look"), g("toy"), t("inspect", ["paper-plane"]), t("return", ["paper-plane"])] },
  { id: "M10", label: "고리 따라가다 회복", personality: "mischievous", major: false, triggers: ["toy", "recovered"], steps: [p("shake"), t("inspect", ["hoop"]), t("return", ["hoop"])] },
  { id: "M11", label: "발견되면 완전히 나오기", personality: "mischievous", major: false, triggers: ["free"], steps: [hide(1700), p("bow"), g("novel-place")] },
  { id: "M12", label: "되돌리기 뒤 작은 갸웃", personality: "mischievous", major: false, triggers: ["undo"], steps: [p("sniff"), p("bow")] },
  // G01 계기: 접근 가능한 실제 최애 음식이 있고 현재 허기와 feeding 설정이 식사를 허용한다.
  { id: "G01", label: "최애를 찾은 귀, 실제 한입의 만족", personality: "gourmet", major: true, triggers: ["food"], steps: [p("bow"), f("inspect"), f("eat"), p("celebrate"), p("groom")] },
  // G02 계기: 현재 배가 부른데 실제 좋아하는 음식이 남아 있고 집 안의 안전한 보관 자리가 있다.
  { id: "G02", label: "배부른 날 최애를 남겨 두기", personality: "gourmet", major: true, triggers: ["food"], steps: [f("tidy"), p("sniff"), p("bow")] },
  // G03 계기: 현재 다시 배고파졌고 이전에 실제 보관한 음식 ID가 남아 있으며 지금도 접근 가능하다.
  { id: "G03", label: "이전에 보관한 음식과 다시 만남", personality: "gourmet", major: true, triggers: ["food", "experience"], steps: [g("food"), p("sniff"), f("eat"), p("celebrate")] },
  // G04 계기: 실제 두 음식이 있고 하나는 먹어 본 부류의 새 음식이다. 급한 허기가 아니라 짧게 고를 여유가 있다.
  { id: "G04", label: "새 빵과 익숙한 한 끼 사이의 결정", personality: "gourmet", major: true, triggers: ["food"], steps: [f("compare"), f("inspect"), f("eat"), p("groom")] },
  // G05 계기: 실제 식사를 마쳐 포만 상태이고 TV 시청 또는 당근 모양 장난감을 안전하게 볼 수 있다.
  { id: "G05", label: "식후 요리 TV, 당근 장난감은 먹지 않기", personality: "gourmet", major: true, triggers: ["meal"], steps: [p("groom"), g("sofa"), tv("cooking"), w(3000), opt(t("inspect", ["squeaky-carrot"])), opt(t("return", ["squeaky-carrot"]))] },
  { id: "G06", label: "정착한 음식부터 보기", personality: "gourmet", major: false, triggers: ["food"], steps: [p("sniff"), f("eat"), p("groom")] },
  { id: "G07", label: "가까운 한 끼가 먼저", personality: "gourmet", major: false, triggers: ["food"], steps: [f("eat"), p("celebrate")] },
  { id: "G08", label: "최애가 실제 바뀐 날", personality: "gourmet", major: false, triggers: ["favorite"], steps: [p("celebrate"), opt(f("inspect")), p("groom")] },
  { id: "G09", label: "음악은 먹은 다음", personality: "gourmet", major: false, triggers: ["music", "meal"], steps: [p("groom"), p("bow")] },
  { id: "G10", label: "아침 귀가의 음식 확인", personality: "gourmet", major: false, triggers: ["arrival", "food", "experience"], steps: [p("sniff"), f("eat"), p("groom")] },
  { id: "G11", label: "저장 성공 뒤 한입 후보", personality: "gourmet", major: false, triggers: ["work"], steps: [opt(f("eat")), p("bow")] },
  { id: "G12", label: "음식 없는 날의 여유", personality: "gourmet", major: false, triggers: ["free"], steps: [p("groom"), p("bow"), opt(t("inspect")), opt(t("return"))] },
  // H01 계기: 집이 실제 열려 있고 상자에 꺼낼 수 있는 소품이 있으며 안전한 바닥과 왕복 경로가 있다.
  { id: "H01", label: "상자에서 꺼내 놀고 다시 집으로", personality: "homebody", major: true, triggers: ["free"], steps: [g("box"), t("spawn", undefined, 1), t("play"), t("return"), g("sofa"), p("groom")] },
  // H02 계기: 집 밖 실제 소품을 선호하고 현재 안전한 왕복 경로가 있으며 사용자 소유·급한 욕구가 없다.
  { id: "H02", label: "밖의 좋아하는 소품을 데려오기", personality: "homebody", major: true, triggers: ["toy", "experience"], steps: [p("bow"), g("toy"), t("inspect"), t("return"), g("sofa"), p("groom")] },
  // H03 계기: 보고 있는 달력 월이 여름이고 공유 햇빛이 강하다. 실제로 깨어 있으며 자율 가구 선택이 허용되는 여유다.
  { id: "H03", label: "여름 낮, 깨어 즐기는 작은 극장", personality: "homebody", major: true, triggers: ["summer"], steps: [g("sofa"), curtain("closed"), light(false), tv("nature"), w(3600), p("groom")] },
  // H04 계기: 사용자가 집을 접었다 다시 열었고 현재 물건·배우의 진행 중 소유권이 확인된다.
  { id: "H04", label: "접혔다 열린 집으로 실제 귀가", personality: "homebody", major: true, triggers: ["layout"], steps: [g("sofa"), p("sniff"), p("bow"), p("groom")] },
  // H05 계기: 집 안 활동 하나를 실제 마쳤고, 쿠션과 바닥 등 둘 이상의 안전한 생활 자리가 있다.
  { id: "H05", label: "쿠션·바닥·창가로 바뀌는 작은 일상", personality: "homebody", major: true, triggers: ["free"], steps: [g("sofa"), p("groom"), g("floor"), p("stretch"), g("window"), curtain("open"), w(1800)] },
  { id: "H06", label: "집 앞 기차 왕복", personality: "homebody", major: false, triggers: ["toy"], steps: [t("nudge", ["train"]), g("toy"), t("return", ["train"]), g("sofa")] },
  { id: "H07", label: "고리 쌓기 소품 감상", personality: "homebody", major: false, triggers: ["toy"], steps: [t("inspect", ["stacking-rings"]), p("sniff"), t("return", ["stacking-rings"])] },
  { id: "H08", label: "좋아하는 음식 집 보관", personality: "homebody", major: false, triggers: ["food"], steps: [f("tidy"), p("groom")] },
  { id: "H09", label: "새로 펼친 방 둘러보기", personality: "homebody", major: false, triggers: ["layout"], steps: [g("sofa"), p("sniff"), p("bow")] },
  { id: "H10", label: "익숙한 노래 한 구간", personality: "homebody", major: false, triggers: ["music", "experience"], steps: [g("sofa"), w(3000), p("groom")] },
  { id: "H11", label: "새 편집 패널에 자리 양보", personality: "homebody", major: false, triggers: ["layout"], steps: [g("sofa"), p("stretch")] },
  { id: "H12", label: "포근히 파묻히기 후보", personality: "homebody", major: false, triggers: ["free"], steps: [g("sofa"), p("cozy-nest"), p("stretch"), p("groom")] },
  // B01 계기: 자유로운 선택 기회에 실제 장난감 한 개가 있고 검사·놀이·반납 경로가 모두 성립한다.
  { id: "B01", label: "살펴보고 놀고 반납하는 생활 한 편", personality: "balanced", major: true, triggers: ["toy"], steps: [t("inspect"), t("play"), t("return"), p("bow")] },
  // B02 계기: 비슷한 목적의 활동을 두 번 실제 완료했고 다른 적합한 실제 대상이 있으며 급한 욕구가 없다.
  { id: "B02", label: "두 번 같은 일을 했으면 다음 재미 찾기", personality: "balanced", major: true, triggers: ["free"], steps: [p("stretch"), g("novel-place"), p("bow"), opt(t("inspect")), opt(t("return"))] },
  // B03 계기: 최애·익숙한 음식·새 음식 중 실제로 둘 이상을 고를 수 있고 feeding이 허용된다.
  { id: "B03", label: "배고픔과 새로움 사이에서 한 끼 결정", personality: "balanced", major: true, triggers: ["food"], steps: [f("inspect"), f("eat"), p("groom")] },
  // B04 계기: 실제 장난감이 여럿 흩어졌고 급한 욕구가 없으며 상자 반납과 TV·창가 감상 중 다른 한 활동이 가능하다.
  { id: "B04", label: "한두 개 정리한 뒤 감상으로 전환", personality: "balanced", major: true, triggers: ["toy"], steps: [t("return", undefined, 2), g("window"), curtain("open"), w(2400), p("bow")] },
  // B05 계기: 실제 이동 중 넘어짐·레이아웃 변화·사용자 조작으로 현재 장면이 중단됐고 회복 후 재개 여부를 판단할 수 있다.
  { id: "B05", label: "예상 밖의 중단에도 같은 일을 마치기", personality: "balanced", major: true, triggers: ["recovered"], steps: [p("shake"), opt(t("return", undefined, 1)), opt(f("tidy")), p("bow")] },
  { id: "B06", label: "공 한 번 뒤 반납", personality: "balanced", major: false, triggers: ["toy"], steps: [t("play", ["ball"]), t("return", ["ball"]), p("bow")] },
  { id: "B07", label: "짧은 인사 뒤 양보", personality: "balanced", major: false, triggers: ["free"], steps: [g("pointer"), p("bow"), w(900), g("floor")] },
  { id: "B08", label: "쉬었다 작은 놀이", personality: "balanced", major: false, triggers: ["toy"], steps: [g("floor"), t("play"), t("return")] },
  { id: "B09", label: "최근과 다른 소품", personality: "balanced", major: false, triggers: ["toy"], steps: [t("inspect"), t("play"), t("return")] },
  { id: "B10", label: "좋았던 교감 한 번 제안", personality: "balanced", major: false, triggers: ["experience"], steps: [g("pointer"), p("ask-petting"), w(1000), p("bow")] },
  { id: "B11", label: "가을비 뒤 차분한 생활", personality: "balanced", major: false, triggers: ["rain"], steps: [g("window"), curtain("open"), w(1800), opt(f("tidy")), p("groom")] },
  { id: "B12", label: "가장 최근 작업 완료만 응원", personality: "balanced", major: false, triggers: ["work"], steps: [p("bow"), p("stretch")] },

  //36 cross-feature combinations follow the report table row order.
  // 음악 화면 한 구간을 본 뒤 소파 앞 안전한 자리에서 짧은 재롱. 인사와 같은 소품 반납으로 끝.
  { id: "X-P-house", label: "재롱둥이 · 집·TV·빛·씻기", personality: "performer", major: false, triggers: ["tv"], steps: [w(1800), g("floor"), p("cheer-rehearsal"), p("bow"), opt(t("return"))] },
  // 공개 저장 성공 신호 하나에 축하 한 번. 다음 입력이면 바로 양보.
  { id: "X-P-editor", label: "재롱둥이 · 편집하는 사람 곁", personality: "performer", major: false, triggers: ["work"], steps: [p("celebrate"), p("bow")] },
  // 실제 악구에 응원 한 토막. 구절이 끝나면 인사하고 감상 종료.
  { id: "X-P-music", label: "재롱둥이 · 실제 음악", personality: "performer", major: false, triggers: ["music"], steps: [p("cheer-rehearsal"), p("bow")] },
  // 익숙한 저녁의 실제 재회에 작은 개막식. 옆으로 비켜 주며 끝.
  { id: "X-P-return-time", label: "재롱둥이 · 귀가·재회·시간대", personality: "performer", major: false, triggers: ["arrival", "experience", "night"], steps: [p("cheer-rehearsal"), p("celebrate"), p("bow"), g("floor")] },
  // 자연·장난감 화면을 한 번 비교하고 관심 있는 채널 한 구간에 머묾.
  { id: "X-C-house", label: "탐험둥이 · 집·TV·빛·씻기", personality: "curious", major: false, triggers: ["tv"], steps: [g("sofa"), tv("nature"), w(1400), tv("toys"), w(2600), p("bow")] },
  // 공개 편집창의 안전한 열림 신호에 갸웃. 입력 시작이면 원래 생활.
  { id: "X-C-editor", label: "탐험둥이 · 편집하는 사람 곁", personality: "curious", major: false, triggers: ["editor-open"], steps: [p("sniff"), p("bow")] },
  // 처음 실제 들린 소리 쪽을 집중해 보고 한 구간 뒤 원래 탐색.
  { id: "X-C-music", label: "탐험둥이 · 실제 음악", personality: "curious", major: false, triggers: ["music"], steps: [p("sniff"), w(2300), p("bow")] },
  // 봄 새벽의 실제 귀가에 창 쪽 확인. viewed-month와 공유 KST를 함께 사용.
  { id: "X-C-return-time", label: "탐험둥이 · 귀가·재회·시간대", personality: "curious", major: false, triggers: ["arrival"], steps: [g("window"), curtain("open"), p("sniff"), w(2000), p("stretch")] },
  // 시청 중 사람이 멈추면 화면에서 사람 쪽으로 고개 전환. 무반응이면 시청 마침.
  { id: "X-A-house", label: "애교쟁이 · 집·TV·빛·씻기", personality: "affectionate", major: false, triggers: ["tv"], steps: [w(1100), g("pointer"), p("lean-nuzzle"), p("bow")] },
  // 공개 작업 종료 뒤 안전한 옆자리에서 짧은 교감 제안. 새 입력 즉시 양보.
  { id: "X-A-editor", label: "애교쟁이 · 편집하는 사람 곁", personality: "affectionate", major: false, triggers: ["work"], steps: [g("pointer"), p("lean-nuzzle"), w(900), p("bow")] },
  // 실제 연주가 끝난 틈에 사람 쪽 인사. 기다림 종료가 있음.
  { id: "X-A-music", label: "애교쟁이 · 실제 음악", personality: "affectionate", major: false, triggers: ["music"], steps: [g("pointer"), p("bow"), w(1000)] },
  // 밤의 실제 귀가에 조용한 비비기. 직접 OFF한 조명을 뒤집지 않음.
  { id: "X-A-return-time", label: "애교쟁이 · 귀가·재회·시간대", personality: "affectionate", major: false, triggers: ["arrival", "night"], steps: [g("pointer"), p("lean-nuzzle"), p("bow")] },
  // 실제 졸음·수면 허용 때 달별 시청 뒤 휴식 준비. OFF면 깨어 있는 마무리.
  { id: "X-S-house", label: "잠꾸러기 · 집·TV·빛·씻기", personality: "sleepy", major: false, triggers: ["night"], steps: [g("sofa"), tv("moon"), w(2600), p("doze-curl"), nap(6000), p("stretch")] },
  // 작업 틈 하품·스트레칭 한 번. 편집 중 수면 연출 없음.
  { id: "X-S-editor", label: "잠꾸러기 · 편집하는 사람 곁", personality: "sleepy", major: false, triggers: ["work"], steps: [p("stretch"), p("groom")] },
  // 잔잔한 실제 음악에 느린 스트레칭. 현재 수면 조건으로 끝 선택.
  { id: "X-S-music", label: "잠꾸러기 · 실제 음악", personality: "sleepy", major: false, triggers: ["music"], steps: [p("stretch"), opt(nap(5000)), p("groom")] },
  // 겨울밤이라도 실제 졸음과 귀가 접지가 먼저. 물건 마무리 뒤 휴식.
  { id: "X-S-return-time", label: "잠꾸러기 · 귀가·재회·시간대", personality: "sleepy", major: false, triggers: ["arrival", "night"], steps: [g("sofa"), p("doze-curl"), opt(nap(6000)), p("stretch")] },
  // 마지막 반납 완료 뒤 실제 씻기 후보. 동작 미구현이면 몸단장까지만.
  { id: "X-T-house", label: "깔끔이 · 집·TV·빛·씻기", personality: "tidy", major: false, triggers: ["toy-returned"], steps: [g("pad"), wash(2200), p("groom")] },
  // 공개 저장 성공 뒤 내 소품 하나 정리. 일정 내용을 읽거나 변경하지 않음.
  { id: "X-T-editor", label: "깔끔이 · 편집하는 사람 곁", personality: "tidy", major: false, triggers: ["work", "toy"], steps: [t("return", undefined, 1), p("bow")] },
  // 음악이 와도 현재 반납부터 완료. 이후 인사·감상 한 구간.
  { id: "X-T-music", label: "깔끔이 · 실제 음악", personality: "tidy", major: false, triggers: ["music", "toy"], steps: [t("return", undefined, 1), p("bow"), w(1500)] },
  // 귀가 때 현재 흩어진 실물 하나를 반납하고 편한 자리로.
  { id: "X-T-return-time", label: "깔끔이 · 귀가·재회·시간대", personality: "tidy", major: false, triggers: ["arrival", "toy"], steps: [t("return", undefined, 1), g("sofa"), p("groom")] },
  // 채널 한 번 비교 뒤 심심하면 실제 장난감 하나. 연타·점멸 없음.
  { id: "X-M-house", label: "사고뭉치 · 집·TV·빛·씻기", personality: "mischievous", major: false, triggers: ["tv"], steps: [w(1600), tv("next"), w(2300), opt(t("play", undefined, 1)), opt(t("return", undefined, 1))] },
  // 실제 공개 undo/redo 완료 뒤 작은 갸웃. 키와 기록에 손대지 않음.
  { id: "X-M-editor", label: "사고뭉치 · 편집하는 사람 곁", personality: "mischievous", major: false, triggers: ["undo"], steps: [p("sniff"), p("bow")] },
  // 경쾌한 실제 구간에 허용된 짧은 덤벼들기. 한 소품으로 끝.
  { id: "X-M-music", label: "사고뭉치 · 실제 음악", personality: "mischievous", major: false, triggers: ["music", "toy"], steps: [p("pounce"), t("play", undefined, 1), t("return", undefined, 1), p("bow")] },
  // 밤·낮은 현재 에너지에는 달별 시청의 조용한 반전도 가능.
  { id: "X-M-return-time", label: "사고뭉치 · 귀가·재회·시간대", personality: "mischievous", major: false, triggers: ["arrival"], steps: [g("sofa"), tv("moon"), w(3300), p("groom")] },
  // 실제 식후 만족 뒤 요리 화면 한 구간. 화면 음식은 섭취 아님.
  { id: "X-G-house", label: "먹보 · 집·TV·빛·씻기", personality: "gourmet", major: false, triggers: ["meal"], steps: [p("groom"), g("sofa"), tv("cooking"), w(3000)] },
  // 저장 성공 뒤 실제 음식·허기가 맞으면 식사, 아니면 인사 한 번.
  { id: "X-G-editor", label: "먹보 · 편집하는 사람 곁", personality: "gourmet", major: false, triggers: ["work"], steps: [opt(f("eat")), p("bow")] },
  // 식사 중이면 먹기부터 완료. 식후 짧은 만족 반응으로 응답.
  { id: "X-G-music", label: "먹보 · 실제 음악", personality: "gourmet", major: false, triggers: ["music", "meal"], steps: [p("groom"), p("bow")] },
  // 실제 관측한 아침 band에도 음식·허기가 있어야 식사. 부재 벌점 없음.
  { id: "X-G-return-time", label: "먹보 · 귀가·재회·시간대", personality: "gourmet", major: false, triggers: ["arrival", "food"], steps: [p("sniff"), f("eat"), p("groom")] },
  // 한여름 깨어 있는 극장: 허용 커튼·지속 전등·TV 아래 소파 감상.
  { id: "X-H-house", label: "집돌이 · 집·TV·빛·씻기", personality: "homebody", major: false, triggers: ["summer"], steps: [g("sofa"), curtain("closed"), light(false), tv("nature"), w(3600), p("groom")] },
  // 패널 geometry 완료 뒤 현재 집 앵커에서 자리 양보.
  { id: "X-H-editor", label: "집돌이 · 편집하는 사람 곁", personality: "homebody", major: false, triggers: ["layout"], steps: [g("sofa"), p("stretch")] },
  // 좋아하던 실제 음악을 집의 익숙한 자리에서 한 구간 감상.
  { id: "X-H-music", label: "집돌이 · 실제 음악", personality: "homebody", major: false, triggers: ["music", "experience"], steps: [g("sofa"), w(3300), p("groom")] },
  // 실제 귀가를 마치고 집 안 생활. 밤이라고 자동 수면하지 않음.
  { id: "X-H-return-time", label: "집돌이 · 귀가·재회·시간대", personality: "homebody", major: false, triggers: ["arrival"], steps: [g("sofa"), p("bow"), p("groom"), w(1400)] },
  // 시청 한 구간이 끝나면 놀이·정리·교감 중 최근과 다른 한 편.
  { id: "X-B-house", label: "동글이 · 집·TV·빛·씻기", personality: "balanced", major: false, triggers: ["tv"], steps: [w(1800), opt(t("play")), opt(t("return")), p("stretch"), p("bow")] },
  // 가장 최근 유효한 공개 완료 신호에 꾸벅. 중복·밀린 응원 없음.
  { id: "X-B-editor", label: "동글이 · 편집하는 사람 곁", personality: "balanced", major: false, triggers: ["work"], steps: [p("bow"), p("groom")] },
  // 실제 악구 마무리에 한 번 반응하고 현재 적합한 다른 생활로.
  { id: "X-B-music", label: "동글이 · 실제 음악", personality: "balanced", major: false, triggers: ["music"], steps: [p("bow"), p("stretch"), g("novel-place")] },
  // 가을 실제 비를 잠깐 보고 감상·정리 중 하나를 완결. 억지 외출 없음.
  { id: "X-B-return-time", label: "동글이 · 귀가·재회·시간대", personality: "balanced", major: false, triggers: ["arrival", "rain"], steps: [g("window"), curtain("open"), w(1600), opt(f("tidy")), p("groom")] },
]);
