import { cache } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { isOwnerEmail, normalizeEmail } from "@/lib/auth/config";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import type { User } from "@supabase/supabase-js";

export type CurrentActor = {
  email: string | null;
  isAuthenticated: boolean;
  role: MembershipRole;
  trustedRole: "manager" | null;
  // 신뢰 멤버가 동시에 가질 수 있는 역할 플래그(표시용). role은 effective(매니저면 manager)지만,
  // 한 계정이 매니저·작업자 둘 다일 수 있어 배지/팝오버에서 두 역할을 함께 보여주려고 둔다.
  isManager?: boolean;
};

export const anonymousActor: CurrentActor = {
  email: null,
  isAuthenticated: false,
  role: "viewer",
  trustedRole: null
};

// 한 요청 안에서 페이지와 여러 로더가 각자 actor를 물어봐도 getUser·역할 조회를
// 한 번만 하도록 React cache로 묶는다(중복 네트워크 왕복 제거).
export const resolveCurrentActor = cache(_resolveCurrentActor);

async function _resolveCurrentActor(calendarSlug = "vic"): Promise<CurrentActor> {
  const user = await getCurrentSupabaseUser();
  const email = normalizeEmail(user?.email);

  if (!email) {
    return anonymousActor;
  }

  if (!isGoogleAuthenticatedUser(user)) {
    return {
      email,
      isAuthenticated: true,
      role: "viewer",
      trustedRole: null
    };
  }

  // 관리자(owner)를 가장 먼저 확인 — isOwnerEmail은 env 비교라 DB 왕복이 0이다. 가장 흔한
  // /studio 사용자(관리자)가 platform_admins 조회 없이 즉시 풀리게 해 actor 지연을 줄인다.
  // (관리자 계정과 개발자 계정은 서로 다른 사람이라 우선순위를 바꿔도 권한이 겹치지 않는다.)
  if (isOwnerEmail(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "owner",
      trustedRole: null
    };
  }

  // 플랫폼 개발자 — 본인이 소유하지 않은 캘린더에서도 가로지르는 유지보수 권한을 갖는다.
  if (await isPlatformDeveloper(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "developer",
      trustedRole: null
    };
  }

  if (await isTrustedManager(calendarSlug, email)) {
    return {
      email,
      isAuthenticated: true,
      role: "manager",
      trustedRole: "manager",
      isManager: true
    };
  }

  return {
    email,
    isAuthenticated: true,
    role: "viewer",
    trustedRole: null
  };
}

function isGoogleAuthenticatedUser(user: User | null) {
  if (!user) {
    return false;
  }

  if (user.app_metadata.provider === "google") {
    return true;
  }

  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

async function isPlatformDeveloper(email: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("platform_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  return !error && Boolean(data);
}


// 신뢰 멤버 = 매니저 한 종류(작업자 철수 2026-08-27). 활성 행이 있으면 매니저.
async function isTrustedManager(calendarSlug: string, email: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("trusted_members")
    .select("id, calendars!inner(slug)")
    .eq("email", email)
    .eq("is_active", true)
    .eq("calendars.slug", calendarSlug)
    .maybeSingle();

  return !error && Boolean(data);
}
