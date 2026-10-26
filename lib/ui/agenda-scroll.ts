import { reduceMotionEnabled } from "./motion";

/** The short viewport fallback can scroll its full notice board off screen. */
export function revealAgendaFrame(target: HTMLElement): void {
  if (!window.matchMedia("(max-height: 480px)").matches) return;
  const agenda = target.closest<HTMLElement>(".agenda"), flow = agenda?.querySelector<HTMLElement>(".agenda-flow");
  if (!flow) return;
  const surface = agenda?.closest(".studio-mobile,.public-calendar-shell");
  const header = surface?.querySelector<HTMLElement>(".m-topstick,.agenda-header");
  const footer = surface?.querySelector<HTMLElement>(".m-actionrail")
    ?? surface?.closest(".poster-page")?.querySelector<HTMLElement>(".agenda-monthbar");
  const rect = flow.getBoundingClientRect(), top = (header?.getBoundingClientRect().bottom ?? 0) + 8;
  const bottom = (footer?.getBoundingClientRect().top ?? window.innerHeight) - 8;
  const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0;
  if (Math.abs(delta) > .5) window.scrollBy({ top: delta, behavior: "instant" });
}

/** Scroll only the mobile reading frame; preserve the desktop poster stage. */
export function scrollAgendaTarget(target: HTMLElement | null, block: "center" | "nearest" = "center", behavior: ScrollBehavior = "smooth"): boolean {
  const flow = target?.closest<HTMLElement>(".agenda-flow");
  if (!target || !flow) return false;
  revealAgendaFrame(target);
  const frame = flow.getBoundingClientRect(), item = target.getBoundingClientRect();
  const padding = 8, available = flow.clientHeight - padding * 2;
  let delta = 0;
  if (item.height > available) delta = item.top - frame.top - padding;
  else if (block === "center") delta = item.top + item.height / 2 - frame.top - flow.clientHeight / 2;
  else if (item.top < frame.top + padding) delta = item.top - frame.top - padding;
  else if (item.bottom > frame.bottom - padding) delta = item.bottom - frame.bottom + padding;
  flow.scrollTo({ top: flow.scrollTop + delta, behavior: reduceMotionEnabled() ? "instant" : behavior });
  return true;
}
