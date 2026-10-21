import { COMPANION_EXPRESSIONS, type CompanionExpressionId } from "./expressions";
import { COMPANION_PERSONALITY_SCENES } from "./personality-scene-catalog";

export const COMPANION_PORTRAIT_READY_EVENT = "vic:companion-portrait-ready";

/** Semantic memories, never individual atlas cells. Jump's four phases share
 * one entry; collision keys belong to the existing mishap memories. */
export const COMPANION_MEMORY_POSES = [
  ["rest", "느긋하게 쉬기", 0], ["look", "고개 들어 살피기", 1], ["walk", "아장아장 걷기", 2],
  ["jump", "폴짝 뛰어오르기", 4], ["held", "손에 안겨 있기", 8], ["happy", "기분 좋은 방긋", 9],
  ["yawn", "하품이 하암", 10], ["sleep", "새근새근 잠들기", 11], ["wake", "잠에서 깨어나기", 12],
  ["heart", "마음을 전해요", 13], ["hide", "꼭꼭 숨기", 14], ["emerge", "빼꼼 나타나기", 15],
  ["shake", "몸을 탈탈 털기", 17], ["disappointed", "아쉬운 마음", 18], ["sulky", "조금 삐쳤어요", 19],
  ["sprint", "신나게 달리기", 20], ["recover", "다시 괜찮아졌어", 23], ["glance", "주위를 두리번", 26],
  ["tears", "눈물이 핑", 27], ["sulk", "속상해서 웅크리기", 28], ["thrown", "날아가는 빅타민", 32],
] as const;
const routineMemories = [
  ["routine-meal", "배고프면 냠냠", 9], ["routine-wash", "패드에서 씻기", 30],
  ["routine-sleep", "불 끄고 잠든 뒤 기지개", 11], ["routine-nap", "짧은 낮잠과 기지개", 40],
  ["routine-outing", "기지개 뒤 바깥 산책", 2], ["routine-music", "라디오 켜고 소파에서 쉬기", 1],
] as const;
const newScenes = COMPANION_PERSONALITY_SCENES.filter(scene => /^D(?:143|157)-/.test(scene.id));
export type CompanionExpressionMemoryId = `expression:${CompanionExpressionId}`;
export type CompanionPoseMemoryId = `pose:${typeof COMPANION_MEMORY_POSES[number][0]}`;
export type CompanionActivityMemoryId = `activity:${string}`;
export type CompanionNewMemoryId = CompanionExpressionMemoryId | CompanionPoseMemoryId | CompanionActivityMemoryId;
export type CompanionNewMemory = Readonly<{ id: CompanionNewMemoryId; name: string; hint: string; family: "expression" | "pose" | "activity"; row: number }>;

export const COMPANION_NEW_MEMORIES: readonly CompanionNewMemory[] = Object.freeze([
  ...COMPANION_EXPRESSIONS.map(([id, name]): CompanionNewMemory => ({ id: `expression:${id}`, name, family: "expression", row: 0,
    hint: "함께 지내며 이 얼굴이 실제로 나타나는 순간을 만나 보세요." })),
  ...COMPANION_MEMORY_POSES.map(([id, name, row]): CompanionNewMemory => ({ id: `pose:${id}`, name, family: "pose", row,
    hint: "빅타민이 이 자세를 취하는 모습을 지켜보세요." })),
  ...newScenes.map(scene => ({ id: `activity:${scene.id}` as const, name: scene.label, family: "activity" as const,
    row: scene.steps.some(step => step.kind === "pose" && step.pose === "stretch") ? 16 : scene.steps.some(step => step.kind === "wash") ? 30 : 29,
    hint: "빅타민이 이 일과를 처음부터 끝까지 마치는 모습을 만나 보세요." })),
  ...routineMemories.map(([id, name, row]): CompanionNewMemory => ({ id: `activity:${id}`, name, family: "activity", row,
    hint: "빅타민이 이 일과를 끝까지 마치는 모습을 지켜보세요." })),
]);
const byId = new Map(COMPANION_NEW_MEMORIES.map(memory => [memory.id, memory]));
export const COMPANION_NEW_MEMORY_NAMES = Object.fromEntries(COMPANION_NEW_MEMORIES.map(memory => [memory.id, memory.name])) as Record<CompanionNewMemoryId, string>;
export const COMPANION_NEW_MEMORY_HINTS = Object.fromEntries(COMPANION_NEW_MEMORIES.map(memory => [memory.id, memory.hint])) as Record<CompanionNewMemoryId, string>;
const poseByRow = new Map<number, CompanionPoseMemoryId>(COMPANION_MEMORY_POSES.map(([id, , row]) => [row, `pose:${id}`]));
for (const row of [3, 5, 6]) poseByRow.set(row, "pose:jump");
export const companionNewMemory = (id: string | undefined) => id ? byId.get(id as CompanionNewMemoryId) : undefined;
export const companionPoseMemory = (row: number) => poseByRow.get(row);
export const companionActivityMemory = (id: string) => companionNewMemory(`activity:${id}`)?.id;
