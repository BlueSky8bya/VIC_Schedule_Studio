"use client";

import { useMemo } from "react";
import type { PublicSearchResult } from "@/lib/domain/schedule-types";
import type { SearchSort } from "@/lib/search/group";

export type PublicSearchSnapshot = {
  revision: symbol;
  q: string;
  submitted: string | null;
  result: PublicSearchResult | null;
  resultFor: string | null;
  sort: SearchSort;
  selectedRow: string | null;
  expanded: ReadonlySet<number>;
  scrollTop: number;
};
export type PublicSearchSession = { current: PublicSearchSnapshot | null };

/** Owned by one mounted calendar surface. Never a module cache or browser
 * storage: reload/unmount and a calendar/actor/role/preview change discard it. */
export function usePublicSearchSession(scope: string): PublicSearchSession {
  return useMemo(() => ({ current: null, scope }), [scope]);
}

/** Input identities invalidate the caller's memo. Discard all data here;
 * only this opaque client token may cross into the public search sheet. */
export function createPublicSearchRevision(...inputs: readonly unknown[]): symbol {
  void inputs;
  return Symbol("public-search");
}
