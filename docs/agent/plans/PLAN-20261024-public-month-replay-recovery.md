# Public month links and Studio replay recovery

User adopted both proposals on2026-10-24 and requested implementation, actual UI checks, independent review and production deployment. Original observations remain in local `.scratch-pw/site-daily/non-companion-ideas-20261024/report.json`; earlier accepted TV/search changes remain completed.

## Scope and boundaries

- Studio replay: cache only valid successful public metadata; distinguish temporary failure from a valid empty list; coalesce requests and suppress stale success/error UI after a newer selection, context change or unmount. No API/DTO/authority or player implementation change.
- Public root: strict `month=YYYY-MM` (years1000..9999, months01..12), explicit URL before valid view cookie before existing KST/default month. Preserve unrelated query/hash and existing `history.state`; update through `replaceState`, without adding month history entries. Embedded preview/onair/Studio never opt in. Preserve role redirects and public loaders.
- G22: existing search-replay-ext, month arrows/picker/today and month.change semantics/labels/capture remain. URL synchronization and retries create no extra autonomous human-action records. Audit timeline/least-used mapping and guards; no new tracking.

## Execution and acceptance

1. Implement scoped helpers/components and meaningful retry/URL regression units.
2. Run type/lint/unit/build and harness checks. Build once in credential-free immutable snapshot; no operating DB setup/mutations or new dependency.
3. Actual native UI: HTTP/network/JSON failure then recovery; valid-empty cache; pending/newer intent/context; public URL/cookie precedence, new recipient, reload, next/today/search/picker, year boundary, desktop/mobile and overlay back; embedded Studio preview address unchanged; earlier search-return regression. Preserve original failures and normal-speed media. These scoped cases are not full certification.
4. Non-author role/boundary/KST/UX/QA review before integration. Exact commit CI and public deployment SHA plus anonymous deployed month interaction afterward.

## Verification and recovery

Final local product: BUILD_ID `mXn6BviAvZsIY_0r29Rzz`, product key `845edbf5c7166e8f48a17c9ac95d36de4d3deddef46bc35dcf6f7ab2b1232ee2`. Strict receipt SHA256 `18575330d229809da8bfdc66bb381bb5303ff369baa03c0e4b59262d60dcbcd1`:15 selected,15 actual PASS,0 reused. Scope includes10 new month/replay cases and5 prior search-return cases; no living AI/full certification claim. Type/lint/build pass. Full units with bounded workers:6991 PASS,1 existing active-process cache-reclamation skip,0 FAIL; earlier original unit/art failure and its isolated18 PASS remain separate.

Independent review found same-month pending restoration and range-end inconsistencies; actual search→other month caught an overlay close/pop regression. Final implementation uses the existing single overlay pop owner, live view on overlay close and URL restoration on ordinary pop, with pathname protection. Added Back/X→next, range/duplicate-input and missing-selected-VOD safeguards. Earlier13P1F selector and14P1F product reports remain unchanged; no cross-build case PASS was reused.

G22 audit: existing `search-replay-ext`, public/Studio arrows, picker/today, and `month.change` targets/readable labels remain in the action timeline and least-used catalogue. Pointer and keyboard replay were exercised. Existing narrative deduplication/guards remain; URL effects are derived state and do not emit another human action. Public metadata is explicitly parsed; no private/search query/identity/URL payload was added to collection. Both developer displays retain their existing shared catalogue/rendering, verified by source review and the unchanged activity unit contracts.

Local evidence/review and exact production closure are maintained in `.scratch-pw/site-daily/accepted-non-companion-20261024/` and the daily state. Production delivery is authorized; claim deployment only after its exact public SHA and anonymous UI checks. Existing user work and all immutable original receipts/media stay retained. Recovery: a scoped application revert of this release's month/replay changes; no schema/data reversal or cleanup is needed. Real login/RLS/physical-device and unrelated companion36/full cases remain outside this scope.
