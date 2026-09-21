export const LIVE_ROLES = ["owner", "viewer", "anon", "developer"] as const;
export const LIVE_DEVICES = ["desktop", "android", "ios", "mobile"] as const;
export const LIVE_POLL_MS = 15_000;
export const LIVE_WINDOW_SECONDS = 90;

export type LivePresence = {
  observedAt: string;
  windowSeconds: number;
  total: number;
  roles: Record<(typeof LIVE_ROLES)[number], number>;
  devices: Record<(typeof LIVE_DEVICES)[number], number>;
};
