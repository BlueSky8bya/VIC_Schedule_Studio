"use client";

// Public Realtime Presence was retired: tab identifiers, roles and visibility
// must never be broadcast to an anonymously readable channel. Device detection
// stays shared by the server-only visit beacon and local preferences.
export type DeviceKind = "desktop" | "android" | "ios" | "mobile";

export function detectDevice(): DeviceKind {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mobi|Mobile/i.test(ua)) return "mobile";
  return "desktop";
}
