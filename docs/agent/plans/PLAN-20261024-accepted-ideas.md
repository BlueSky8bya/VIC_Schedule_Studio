# Accepted daily ideas — 2026-10-24

Owner explicitly adopted both proposals and requested implementation, verification, independent review and production deployment. Prior discovery evidence remains immutable in the local idea-discovery-20261024 report; no memory-filter adoption is implied.

## Scope and acceptance

1. C04: choose two TV channels at the TV, view the first safely there for the existing1400ms, then use the sofa for the existing3000ms second viewing. Preserve real control contacts, decoded presentation, manual/OFF/urgent priority and bounded clocks. This replaces only the first-viewing sofa requirement in145/157; final bow remains optional. Shared director/renderer, no new art/model/loop.
2. Search: restore current query/results/sort/selection/expansion/scroll after selecting a result and reopening. Current-document memory only; no query/result persistence, new analytics or API. Clear on explicit clear, reload, calendar/actual actor/role/preview changes. Refresh stale results after schedule changes, reject superseded responses, retain keyboard/focus behavior. Shared viewer/studio/preview implementation.

## Plan

- Inspect current shared lifecycles and source-bound native proof; add focused regression tests for preserved state, invalidation, response order and C04's two real viewing locations.
- Run relevant units plus type/lint/build and harness. One frozen product build for guarded production-fixture UI/native checks. Preserve all failures and videos; no blanket200 restart.
- Independent role/privacy/UX/QA review before integration; fix findings and rerun only affected checks. G-22: audit existing search controls and both developer views; autonomous TV actions remain excluded and query text never enters metadata.
- Commit only this scope with Codex-Session footer, push authorized main after checking remote head, verify remote quality/Vercel and actual public fullSHA. Preserve user dirty primary and immutable QA paths. Report implemented changes and remaining coverage limits; normal36 remains UNVERIFIED.

## Current

Implementation and final scoped verification complete. The authorized production release is confirmed separately by exact commit, public fullSHA and deployed interaction in the local `accepted-ideas-20261024` release record; a successful push alone is not deployment evidence. No case receipt is promoted to full certification.

## Activity and privacy audit (G-22)

Existing search-open/close, search-clear, search-sort, search-hit-event/vod/chapter, expansion/rail/top targets keep the same semantic actions. Both developer timeline and least-used feature views derive these fixed labels from lib/activity/labels.ts; no new control, target, automatic action or metadata is introduced. Resume does not manufacture a human action or re-send the prior selection. Query/results live only in a calendar-owner hook; its context key (calendar, existing actor and role/preview) is never rendered, persisted, sent or logged. Existing public API stays public-only. Autonomous C04 channel/watch steps remain excluded from human activity collection. Relevant label/capture/privacy units run with the full unit suite; guarded fixtures block analytics and all unapproved traffic.

## Preserved diagnosis and iteration

All original results remain in the local `.scratch-pw/site-daily/native/` tree. No result was edited into PASS.

- `2026-10-24-1792821830546-cd5113a4`: C04 first/second watch ownership interruption was a product defect; the explicit sofa move and next-control reservation were repaired. Preview without C04 was insufficient observation. Interrupted search cases were not counted as product failures.
- `2026-10-24-1792822285590-15aa150e`: all three TV checks and search retry/race passed; search return assertions used an offscreen row which Playwright scrolled before selection. Compare actual pre-pick position instead. This was an oracle error, not lost product scroll.
- `2026-10-24-1792822548747-e5eb9588`: final product build `Y3mNwaGo0-ZzYiJ_2Yk-E`; five actual case passes, viewer C04 unobserved and two Studio search-open timeouts. Escape had collapsed the normal Studio panel; setup now reopens it via its native control. A subsequent attempt tried native indoor placement after 55s when no C04 had occurred; this was a fixture experiment, not spontaneous return coverage.
- Strict case continuation of that interrupted reporter was rejected with `global-reporter-error`. No case was imported or reused from it. Its independently verified compile receipt is eligible for product-build-only reuse; changed test fingerprints require fresh cases.
- Initial full units: 6951 pass / 1 unrelated agent-memory timeout; the unchanged file passed 18/18 in isolation. Original failure log is preserved. Final full-suite outcome will be recorded separately.

Privacy controls: credential-free frozen fixtures, network guard, synthetic public search responses and intercepted local public saves only; no real login, operational DB setup/write/delete, new collection or dependency. Original videos, failure traces, source/build digests remain preserved. Returning search term/result caching is only current-document memory; opaque revision tokens discard Studio data.

A targeted recovery can revert this scope's product commit; no migration or persistent search-data cleanup is required. Existing user work and evidence paths must remain intact.

- `2026-10-24-1792822991724-fe0942a3`: product build reused without recompiling; three C04 opportunities unobserved, then two search cases interrupted/three not run by the failure limit. Native placement itself passed same-actor/floor/feet conditions but produced exploration/window routines, not TV. Independent comparison found all run2 successes followed actual same-toy return (Studio31.264s→C04 31.781s; preview31.629s→32.129s; viewer60.711s→61.344s). Final fixture restores those original toy inputs and allows120s actual observation. Product scene/RNG/clocks remain unchanged. This verifies comparison in toy-return context, not frequency.
- Full units in the credential-free UI snapshot encountered omitted original art inputs; that wrong-environment attempt was stopped with its log preserved. Full units run separately in the source checkout containing those inputs; UI snapshot stays free of private source art.

- `2026-10-24-1792823230300-42852a49`: three raw TV cases passed in the actual toy-return context; search setup unnecessarily expanded an unrelated floating panel on viewer/preview, blocking the existing search button with its scrim. Studio's scroll comparison still used a pre-action planned value. Both setup problems were repaired: expand only if the search control is hidden, and use a read-only native click capture listener for the actual selection-time scroll value. Same selected row text is also checked after reopening. Full reporter hit the failure limit, so strict verifyRun rejects global-reporter-error; no TV case PASS was imported or reused from this run.
- Pre-Escape source full units:426 files passed,6957 tests passed,1 existing test skipped (6958 total),259.61s. No timeout relaxation or product change to satisfy unrelated checks. Logs remain in `accepted-ideas-20261024/units-final-source.log`; snapshot missing-art failures remain separate.

- `2026-10-24-1792823519022-69bc4170`: viewer/studio TV raw passes; preview's same toy returned correctly but rainy C12/window/exploration consumed the optional TV opportunity. Viewer/preview search matched the actual scroll and selected item; only mismatched innerText-vs-textContent formatting failed the oracle. Interrupted other cases remain unrun. That reporter cannot supply strict reused PASS.
- `2026-10-24-1792823741011-e44690de`: search viewer/preview and response-race/retry passed; two Studio paths tried the existing button during a collapsing panel. Fixture now waits for actual finite animations, checks visibility and viewport, opens only the hidden Studio panel and waits again. No force-click or product layout patch.
- `2026-10-24-1792823775118-f79c4b95`: isolated TV3 scope passed with the same final product build; original SHA `bd10e34a8117ba1f29088448eec9695d6d58cc9a0965dcfa9f5643c11b3373bf`. A final regression fixture makes the existing Studio/preview clear-weather precondition explicit to exclude rainy C12; no hour, clock, RNG or scene is supplied. It receives a fresh case fingerprint and actual run.

Verification limits: desktop1440x1100 guarded fixture routes cover all three shared surfaces; actual login/RLS/operating DB/mobile device, all nine personalities, full200/full36 and spontaneous behavior frequencies are outside this change. Captured normal-speed videos and read-only decoded/paint/source observations remain raw; independent media checks are sampled, not whole-video/full36 certification. Source-only privacy/G-22 review is separately identified.

- Isolated search attempts `d2085c79` and `e2b9c4b9` preserve their complete reports. The latter passed4/5 including real intercepted save/reorder/deletion, but after clear the active searchbox's Escape folded the outer Studio panel and left the modal. This is a confirmed adjacent product keyboard-ownership defect, not a setup-only failure. The search section now owns bubbling Escape before outside window shortcuts; the existing input suggestion handler can still consume its first Escape. Native regression asserts modal closure and unchanged external panel state. This changes product bytes and requires a new compile, with no cross-build case PASS reuse.
- Independent review also found the TV first-watch summary combined repeated C04 serials during120s. The final oracle groups both watches by the first actual serial before checking count/location/duration. Original receipt and raw observations remain unchanged; corrected grouped observations receive a fresh case run. Test changes are not described as living-AI improvements.

## Final implemented scope and verification

- Living behavior change: C04's first channel stays at the real TV floor, then the existing second watch owns the sofa route. Two different physical channel controls and actual decoded viewing remain required. Same-owner first-view witness protects only the immediate next control within existing bounds. No new model/art/learning/frequency claim.
- Search feature: current-document memory retains query, result, sorting, semantic selected row, expanded VODs and actual scroll; data revisions refresh, old requests abort, deleted selections clear. Actual calendar/actor/role/preview changes and reload isolate it. No new persistent query storage/API/telemetry.
- Adjacent product bug: Escape inside search closes the search before outer panel shortcuts; the first Escape still dismisses suggestions alone when present.
- Test-only changes: native toy-return opportunity preparation, explicit clear weather for Studio/preview, first-serial TV grouping, actual-click scroll capture, settled real panel controls and modal/suggestion/outer-panel assertions. These are QA improvements, not extra living-AI features or adopted proposals.

Final product compile: BUILD_ID `6N8P0AZq-te2AIyQzJqMU`; productKey `8fc204b30e4303b02ed78bd1e06d1b7c26978a8366e2b8ea073e56624c62e8cd`. Four distinct product inputs were compiled once each while fixes evolved; subsequent test-only attempts reuse a verified compile. No cross-build case PASS was imported.

Final exact-build receipts, independently rehashed with current product input hashes:

| Scope | Original result under local native/ | Pinned SHA256 | Actual / reused |
| --- | --- | --- | --- |
| Search shared3 surfaces, response/retry, fixture save | 2026-10-24-1792824406236-91ac6f4d/result.json | 368d904c7e8cc72347b377975272f8534511be71b1ca5cfb50f030e478ae0021 | 5 /0 |
| Same-serial TV-floor→sofa comparison,3 surfaces | 2026-10-24-1792824394787-fbf1e6c5/result.json | c30741d1e2f3a886afaac73af9d6256df5a3ed91ed6b534af96d63d252b1f9b5 | 3 /0 |

Both scopeSatisfied=true with frozen source/build integrity, clear network guard and owned-process cleanup. Root `verified-receipts.json` also rehashes current product inputs. TV180s runs may offer actual new toys at40/80s only before second-watch observation, at most3 real toys; no synthetic scene/clock/RNG. First and second viewing durations and locations use the same serial. This establishes behavior in a toy-return opportunity, not occurrence frequency.

Final typecheck, full lint and production build passed. Source unit and any isolated retry outcomes remain separately recorded in original local logs; no failed suite is overwritten. Final non-author role/privacy/UX/QA report is `independent-review.md`. The local release report records CI, actual deployed fullSHA, public interaction and remaining scope limits after confirmation. QA reports/videos/failures and dirty primary source are retained at their original paths; no storage cleanup is repeated during this task.

Final-product source full-unit attempt:6955 passed /2 existing evidence-helper tests timed out at5000ms /1 skipped (426 files,total6958),308.19s. The unchanged helper file then passed250/250 in13.08s; its two failing cases also passed isolated2/2. No timeout was widened, no helper source changed, and `units-release-source.log` remains FAIL rather than being overwritten. Full-suite CI on the exact pushed commit is checked separately. Final source lint/typecheck/harness all exit0; harness8106/8192 bytes.
