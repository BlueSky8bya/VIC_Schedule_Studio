# 125 — independent unmatched-route404

2026-10-19 KST. Bounded source change and local unit verification; root owns build, rendered and provider measurements.

## Evidence and scope

The owner's Vercel Production Functions table for approximately Oct18 21:55–Oct19 09:55 KST showed `_not-found`303 calls/~1minute Active CPU, compared with about4minutes total. The rounded table implies roughly198ms/call and about one quarter of the displayed CPU, not a precise profile or a forecast saving. Actual unmatched request paths and caller classifications were not supplied, so bot traffic, missing assets and stale-client proportions are unknown.

The previous `app/not-found.tsx` is a small static message. The cost path comes from composing it through `app/layout.tsx`, including `ActorTail`→actor/cookies and the application's client shell. The pre-change local prerender manifest contained only `/icon.svg`. Middleware also matches unmatched URLs. Supabase's installed `getUser()` implementation returns a local missing-session error when no access token exists; it is incorrect to claim that every anonymous404 makes an Auth network request. Existing request memoization and080/081 timeout/caching improvements are preserved.

## Change

`next.config.ts` enables the installed Next15.5 `experimental.globalNotFound` support. `app/global-not-found.tsx` defines a complete Korean document for routing-level unmatched URLs only, with static noindex metadata, the existing message and a plain home anchor carrying `data-act="not-found-home"`. Its small CSS module uses shared system-state token names/defaults, system fonts and OS light/dark colors. No authenticated data, actor, remote font, layout stylesheet, loader, preference script or application beacon is imported.

The standalone404 must provide its own styles because Next bypasses normal layouts. This is a documented structural G-18 exception; the application screens continue to use their existing implementation and preferences. It has no animation, clock or polling. Existing segment `notFound()` handling, valid pages/APIs, root layout and middleware are unchanged. The shared404 action target is retained; no arbitrary URL/query is logged, and the standalone document starts no analytics pipeline merely to record an invalid route. Normal application timeline/least-used controls and guards remain unchanged.

The mechanism was introduced in Next15.4 and remains experimental. [Official Next documentation](https://nextjs.org/docs/app/api-reference/file-conventions/not-found). Middleware still runs, so zero request CPU and a particular percentage reduction are not promised. No whole-page public cache or permission/teaser/KST change is made.

## Verification

- New semantic/static-render units: **2/2 PASS**.
- Owned Next config/component/unit/native-spec lint: **PASS**.
- New production-build native suite contains **3 cases**, not yet executed: light desktop unmatched404, OS-dark narrow nested unmatched404, and unchanged valid public clock200/developer-presence401 with no-store and unauthorized DTO.
- Browser cases require actual HTTP404, Korean heading/lang, noindex, keyboard home focus/hit44, no horizontal overflow, no application tail markers/DOM/storage, and no unsolicited API/foreign/write requests. Explicit API checks use only the existing local server with fresh anonymous cookies. Native output records current build identity and its scope, not raw operational/private data.
- Full type/lint/units/build, prerender output, actual rendered behavior and equal-period Vercel CPU/memory comparison remain root-owned. The later local response measurement below is separate from this lane's unit checks. Browser request observations do not establish a server Auth trace.

## Root's subsequent local response measurement

This lane read the root's preserved `.scratch-pw/companion-125/vercel/global404-before.json` and `global404-after.json` and their HTML files. Each measurement uses one initial plus30 sequential anonymous unmatched GETs against a loopback production build.

| Local measurement | Before | After |
|---|---:|---:|
|Response bytes|30,049|11,472|
|Warm median(ms)|13.2352|10.5646|
|Warm p95(ms)|22.3813|14.5178|
|Initial request(ms)|176.2344|49.2869|

The before build was `LveSYGOr3F-gO4soNECzZ`; the after build was `EvOPphFWc5NQdeAbl6tL_`. Root reported the latter build/typecheck/full3,037 units passing. Native verification was running concurrently, so these local latency samples are a limited comparison under uncontrolled load. They are **not billed CPU, memory, production traffic, a server Auth trace or a guaranteed percentage saving**. Original JSON and HTML evidence remain in scratch. The production/native route checks and equal-period provider usage comparison retain their separate root-owned scope.

No build/server/browser, provider setting, credential or production-data operation occurred here. No dependency or protected art changed.

## Root's completed route and release checks

The three native cases passed on the combined125 fixture; the actual production release `a0c44ea79edb0b4d177f2f99a9fec04182f244d8` also returned404 on one fixed unmatched public HTML GET,11,580bytes, Korean/noindex and no application-tail/private markers. That request started no browser or API/beacon. The production response has provider serialization differences from the11,472-byte local document; raw byte equality between these environments is not asserted. Vercel Ready, public fullSHA and remote quality success are recorded in the [shared release proof](COMPANION_HOME_CURTAINS_TOYS-20261019.md#release). No billed CPU/memory or server Auth trace claim is added.
