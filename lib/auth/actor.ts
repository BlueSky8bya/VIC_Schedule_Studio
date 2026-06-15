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
  trustedRole: "manager" | "worker" | null;
  // 신뢰 멤버가 동시에 가질 수 있는 역할 플래그(표시용). role은 effective(매니저면 manager)지만,
  // 한 계정이 매니저·작업자 둘 다일 수 있어 배지/팝오버에서 두 역할을 함께 보여주려고 둔다.
  isManager?: boolean;
  isWorker?: boolean;
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

  const trusted = await findTrustedRoles(calendarSlug, email);

  if (trusted) {
    // effective 역할은 매니저가 작업자를 포함하므로 isManager면 manager.
    const effective = trusted.isManager ? "manager" : "worker";
    return {
      email,
      isAuthenticated: true,
      role: effective,
      trustedRole: effective,
      isManager: trusted.isManager,
      isWorker: trusted.isWorker
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

async function findTrustedRoles(
  calendarSlug: string,
  email: string
): Promise<{ isManager: boolean; isWorker: boolean } | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trusted_members")
    .select("is_manager, is_worker, trusted_role, calendars!inner(slug)")
    .eq("email", email)
    .eq("is_active", true)
    .eq("calendars.slug", calendarSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  let isManager = Boolean(data.is_manager);
  let isWorker = Boolean(data.is_worker);
  // 방어: 플래그가 비어 있는 옛 행이면 effective trusted_role에서 추론.
  if (!isManager && !isWorker) {
    isManager = data.trusted_role === "manager";
    isWorker = data.trusted_role === "worker";
  }
  if (!isManager && !isWorker) {
    return null;
  }
  return { isManager, isWorker };
}
