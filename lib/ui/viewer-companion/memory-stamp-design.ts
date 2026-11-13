/** Art direction for the book only. Each living scene names the incident to
 * draw, rather than using the first stretch/wash or the generic bow. */
type Cue = "star-wand" | "duck" | "feather" | "car" | "ball" | "wash-pad" | "radio" | "toy-box" | "tv" | "pompom" |
  "window" | "card" | "meal" | "picnic" | "calendar" | "trail" | "sun" | "moon" | "sleep" | "sofa" | "cursor" |
  "heart" | "bubbles" | "cheer" | "tune" | "speed" | "hop" | "shake" | "turn" | "dawn" | "look" | "breath" | "settle" | "sparkle";
type Placement = readonly [cue: Cue, x: number, y: number, size: number];
export type CompanionMemoryStamp = Readonly<{
  frame: readonly [row: number, column: number];
  body: readonly [x: number, y: number, size: number];
  behind: readonly Placement[];
  front: readonly Placement[];
}>;
const stamp = (row: number, col: number, body: CompanionMemoryStamp["body"], behind: readonly Placement[] = [], front: readonly Placement[] = []): CompanionMemoryStamp =>
  ({ frame: [row, col], body, behind, front });

export const COMPANION_LIFE_STAMPS = {
  // Two outdoor destinations; lead with the object or action that made the scene.
  "activity:D143-P": stamp(9, 8, [5, 4, 107], [["calendar", 16, 83, 87]], [["star-wand", 84, 44, 38], ["cheer", 8, 44, 24]]),
  "activity:D143-C": stamp(2, 1, [4, 16, 106], [["calendar", 10, 86, 99], ["trail", 82, 51, 39]], [["look", 87, 61, 24]]),
  "activity:D143-A": stamp(33, 0, [6, 16, 105], [["calendar", 13, 85, 98], ["heart", 8, 31, 21]], [["duck", 83, 65, 39]]),
  "activity:D143-S": stamp(2, 8, [6, 17, 104], [["calendar", 12, 87, 91]], [["feather", 82, 58, 43]]),
  "activity:D143-T": stamp(30, 11, [7, 11, 107], [["wash-pad", 10, 48, 105]], [["bubbles", 89, 44, 34], ["shake", 6, 47, 24]]),
  "activity:D143-M": stamp(31, 11, [-1, 13, 107], [["calendar", 14, 86, 99]], [["car", 80, 69, 46], ["speed", 5, 54, 26]]),
  "activity:D143-G": stamp(9, 8, [4, 13, 104], [["picnic", 10, 83, 109]], [["meal", 81, 67, 44]]),
  "activity:D143-H": stamp(1, 8, [-1, 17, 106], [["window", 10, 19, 39]], [["tv", 77, 56, 47]]),
  "activity:D143-B": stamp(2, 1, [21, 15, 105], [["calendar", 19, 84, 105], ["trail", 16, 59, 32]], [["meal", 3, 78, 34]]),
  "activity:D157-P": stamp(9, 8, [15, 2, 108], [["calendar", 25, 86, 91], ["trail", 83, 56, 39]], [["pompom", 7, 57, 34], ["cheer", 5, 32, 22]]),
  "activity:D157-C": stamp(1, 8, [4, 13, 108], [["trail", 78, 51, 44], ["calendar", 56, 90, 61]], [["look", 88, 63, 23]]),
  "activity:D157-A": stamp(29, 11, [6, 13, 111], [["calendar", 13, 85, 92], ["heart", 10, 40, 21]], [["cursor", 91, 53, 30]]),
  "activity:D157-S": stamp(2, 0, [15, 15, 108], [["calendar", 45, 88, 73], ["sun", 12, 30, 27]], [["trail", 6, 81, 30]]),
  "activity:D157-T": stamp(17, 1, [8, 12, 111], [["calendar", 19, 84, 99]], [["bubbles", 85, 44, 36], ["shake", 4, 50, 27]]),
  "activity:D157-M": stamp(2, 1, [16, 16, 106], [["turn", 84, 41, 36]], [["ball", 5, 76, 36]]),
  "activity:D157-G": stamp(2, 8, [16, 14, 106], [["trail", 93, 66, 29]], [["meal", 4, 73, 39], ["sparkle", 8, 53, 22]]),
  "activity:D157-H": stamp(30, 11, [7, 14, 107], [["sofa", 4, 52, 93]], [["toy-box", 81, 72, 42], ["dawn", 88, 31, 29]]),
  "activity:D157-B": stamp(2, 8, [16, 14, 107], [["calendar", 31, 87, 93], ["trail", 94, 58, 31]], [["toy-box", 3, 71, 43]]),
  "activity:routine-meal": stamp(9, 8, [7, 14, 110], [], [["meal", 79, 72, 47], ["sparkle", 91, 42, 25]]),
  "activity:routine-wash": stamp(30, 11, [9, 8, 110], [["wash-pad", 10, 48, 105]], [["bubbles", 87, 42, 37]]),
  "activity:routine-sleep": stamp(11, 0, [12, 10, 110], [["sofa", 12, 44, 104], ["moon", 12, 17, 32], ["sleep", 88, 35, 28]]),
  "activity:routine-nap": stamp(40, 0, [11, 9, 110], [["sofa", 12, 44, 104], ["sun", 12, 19, 31], ["sleep", 87, 40, 30]]),
  "activity:routine-outing": stamp(2, 8, [7, 12, 111], [["calendar", 15, 84, 94], ["dawn", 84, 27, 32]], [["trail", 92, 60, 30]]),
  "activity:routine-music": stamp(40, 0, [2, 9, 110], [["sofa", 5, 44, 102]], [["radio", 80, 71, 45], ["tune", 91, 38, 24]]),
} satisfies Readonly<Record<string, CompanionMemoryStamp>>;

export const COMPANION_ILLUSTRATED_MEMORY_STAMPS: Readonly<Record<string, CompanionMemoryStamp>> = {
  ...COMPANION_LIFE_STAMPS,
  "paper-knead": stamp(35, 0, [6, 9, 116], [["sofa", 11, 44, 106]], [["settle", 92, 61, 26]]),
  "paper-nest": stamp(36, 0, [16, 6, 110], [["sofa", 9, 40, 108]], [["turn", 5, 60, 28]]),
  stretch: stamp(16, 4, [5, 3, 119], [["dawn", 8, 34, 25], ["sparkle", 92, 36, 26]]),
  "pose:walk": stamp(2, 8, [9, 8, 113], [], [["trail", 95, 66, 28]]),
  "pose:jump": stamp(4, 8, [8, -2, 112], [["hop", 17, 57, 93]]),
  "pose:held": stamp(8, 8, [5, 10, 113], [], [["cursor", 80, 28, 31]]),
  "pose:yawn": stamp(10, 0, [7, 6, 115], [], [["breath", 88, 57, 28]]),
  "pose:wake": stamp(12, 15, [6, 6, 114], [["dawn", 88, 38, 31], ["sleep", 10, 26, 23]]),
  "pose:heart": stamp(13, 8, [6, 8, 113], [], [["heart", 87, 48, 32]]),
  "pose:hide": stamp(14, 8, [16, 9, 111], [], [["card", 5, 53, 63]]),
  "pose:emerge": stamp(15, 0, [20, 4, 108], [], [["card", 7, 56, 61], ["sparkle", 95, 42, 24]]),
  "pose:shake": stamp(17, 1, [8, 6, 112], [["shake", 6, 48, 26], ["shake", 93, 38, 28]]),
  "pose:sprint": stamp(20, 1, [16, 9, 111], [["speed", 2, 53, 42]]),
  "pose:recover": stamp(23, 15, [7, 6, 115], [], [["breath", 91, 56, 28]]),
  "pose:glance": stamp(26, 11, [6, 7, 116], [["look", 92, 51, 28], ["look", 9, 50, 21]]),
  "pose:thrown": stamp(32, 8, [12, 2, 111], [["speed", 4, 50, 36], ["hop", 8, 57, 98]]),
};
