import type { MembershipRole } from "@/lib/domain/schedule-types";

export function canEditSchedule(role: MembershipRole) {
  return role === "owner";
}

export function canReadPrivateLayer(role: MembershipRole, hasUnlockSession: boolean) {
  return (role === "owner" || role === "trusted_member") && hasUnlockSession;
}

export function assertOwner(role: MembershipRole) {
  if (!canEditSchedule(role)) {
    throw new Error("Only owner can mutate schedule data.");
  }
}
