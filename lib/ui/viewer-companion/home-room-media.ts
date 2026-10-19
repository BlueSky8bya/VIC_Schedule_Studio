/** Finite, local room decoration. No playback, clock, learning or autonomy. */
export const COMPANION_HOME_TV_CHANNELS = ["nature", "music", "cooking", "toys", "moon"] as const;
export type CompanionHomeTvChannel = typeof COMPANION_HOME_TV_CHANNELS[number];
export type CompanionHomeTvState = CompanionHomeTvChannel | "off";
const NAMES: Readonly<Record<CompanionHomeTvChannel, string>> = {
  nature: "자연", music: "음악", cooking: "요리", toys: "장난감", moon: "달과 별",
};
/** The option describes the next click before mutation, for one G22 event. */
export function companionHomeTvControl(state: CompanionHomeTvState) {
  const index = state === "off" ? -1 : COMPANION_HOME_TV_CHANNELS.indexOf(state);
  const next: CompanionHomeTvState = index === COMPANION_HOME_TV_CHANNELS.length - 1 ? "off" : COMPANION_HOME_TV_CHANNELS[index + 1];
  const option = state === "off" ? "on" : next === "off" ? "off" : "next";
  const currentName = state === "off" ? "꺼짐" : NAMES[state];
  const label = next === "off" ? `TV ${currentName} · 누르면 끄기`
    : state === "off" ? "TV 꺼짐 · 누르면 자연 채널 켜기" : `TV ${currentName} · 누르면 ${NAMES[next]} 채널`;
  return { next, option, label } as const;
}
