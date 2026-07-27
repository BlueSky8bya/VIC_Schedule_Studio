import type { BroadcastTool } from "@/lib/broadcast/stroke-engine";

export const PALM_GUARD_MS = 1000;
export const PEN_PRESSURE_GAMMA = 0.65;
export const PEN_PRESSURE_FLOOR = 0.12;
export const PRESSURE_SMOOTHING_TAU_MS = 12;

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/**
 * Expands low stylus pressures while preserving a non-zero visible stroke.
 */
export function mapPenPressure(pressure: number): number {
  const normalized = clamp01(pressure, 0);
  return Math.max(PEN_PRESSURE_FLOOR, normalized ** PEN_PRESSURE_GAMMA);
}

/**
 * Time-based low-pass filter. Equal elapsed time produces equal smoothing,
 * independent of pointer sample rate.
 */
export function smoothPressure(
  previous: number,
  target: number,
  deltaMs: number,
  tauMs: number = PRESSURE_SMOOTHING_TAU_MS
): number {
  const safeTarget = clamp01(target, PEN_PRESSURE_FLOOR);
  const safePrevious = clamp01(previous, safeTarget);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return safePrevious;

  const safeTau =
    Number.isFinite(tauMs) && tauMs > 0 ? tauMs : PRESSURE_SMOOTHING_TAU_MS;
  const alpha = 1 - Math.exp(-deltaMs / safeTau);
  return clamp01(safePrevious + (safeTarget - safePrevious) * alpha, safeTarget);
}

/**
 * Pen contact normally has positive pressure. Primary-button fallback covers
 * implementations that briefly report zero pressure at contact boundaries.
 */
export function isPenContact(
  pointerType: string,
  pressure: number,
  buttons: number
): boolean {
  if (pointerType !== "pen") return false;
  const hasPressure = Number.isFinite(pressure) && pressure > 0;
  const hasPrimaryButton =
    Number.isFinite(buttons) && buttons > 0 && (Math.trunc(buttons) & 1) === 1;
  return hasPressure || hasPrimaryButton;
}

export function shouldIgnoreTouchAfterPen(
  pointerType: string,
  timeStamp: number,
  lastPenContactTs: number | null
): boolean {
  if (pointerType !== "touch" || lastPenContactTs === null) return false;
  if (
    !Number.isFinite(timeStamp) ||
    !Number.isFinite(lastPenContactTs) ||
    timeStamp < 0 ||
    lastPenContactTs < 0
  ) {
    return false;
  }

  const elapsed = timeStamp - lastPenContactTs;
  return elapsed >= 0 && elapsed < PALM_GUARD_MS;
}

/**
 * Hardware pens often have no browser-drawn CSS cursor during contact. Return a visible
 * board-overlay footprint while preserving each tool's actual width relationship.
 */
export function stylusCursorDiameter(tool: BroadcastTool, penWidth: number): number {
  if (tool === "select") return 0;
  const width = Number.isFinite(penWidth) && penWidth > 0 ? penWidth : 5;
  const raw =
    tool === "eraser"
      ? width * 5
      : tool === "hl"
        ? width * 3.5
        : tool === "pen"
          ? width
          : 18;
  return Math.round(Math.max(8, Math.min(96, raw)));
}

export function shouldShowStylusToolCursor(
  pointerType: string,
  tool: BroadcastTool,
  blocked: boolean
): boolean {
  return pointerType === "pen" && tool !== "select" && !blocked;
}

export type StylusCursorAction = "show" | "hide" | "ignore";

/**
 * Keeps one active pen authoritative while allowing a later mouse move to restore
 * the native cursor after pen hover. Touch is ignored so palm events cannot steal it.
 */
export function resolveStylusCursorAction(
  pointerType: string,
  pointerId: number,
  activePenPointerId: number | null,
  tool: BroadcastTool,
  blocked: boolean
): StylusCursorAction {
  if (pointerType === "touch") return "ignore";
  if (pointerType === "mouse") return activePenPointerId === null ? "hide" : "ignore";
  if (pointerType !== "pen") return "ignore";
  if (activePenPointerId !== null && pointerId !== activePenPointerId) return "ignore";
  return shouldShowStylusToolCursor(pointerType, tool, blocked) ? "show" : "hide";
}
