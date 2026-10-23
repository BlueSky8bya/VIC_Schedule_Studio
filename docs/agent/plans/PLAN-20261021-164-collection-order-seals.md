# COMPANION-CATALOG-164

> 공개용 정리본(2026-10-24): 원문 발언·개인 원자료·비공개 검수 원문은 제외했다.

Status: historical — early review record of a feature that later shipped. The display-order rules below were carried into the later watercolor stamp release ([watercolor face release](PLAN-20261021-watercolor-face-release.md)); the five code-native seal frames described here were later replaced by revised stamp designs. This record does not describe the current deployed stamp art and is not an active plan.

## Scope and contract

Owner decision 2026-10-21: the food book sorts by increasing collection difficulty, unprepared before prepared, Korean familiarity, then Korean alphabetical order when familiarity is tied or uncertain. Toys use assembly instead of preparation. Future entries use the same rule. Stamps visibly distinguish the five collection tiers.

- Use separate display orders; preserve append-only draw arrays, item IDs, weights, local discoveries and acknowledgements.
- Food preparation, catalogue familiarity and toy assembly are explicit, exhaustively typed editorial metadata; new IDs require classification. Existing food categories seed preparation with explicit corrections for processed tofu and uncooked shellfish. Familiarity uses broad bands, not claimed survey rankings. Assembly means joining parts to build the play object, not factory manufacture or unfolding/transforming a finished toy.
- Shared viewer/studio/preview code uses the same order for tiles, detail selection, keyboard, page dots and unread traversal.
- Existing specimen pixels, aspect ratios and undiscovered silhouettes remain. Code-native seal frames differ in silhouette and ornament as difficulty rises, without animation or another clock.
- No server/API/auth/role/KST boundary or persistence schema change. No production data or deployment.
- G22: automatic sorting and decorative frames are not human actions. Audit existing fixed food/toy inspect/category/page targets and both developer analytics views; never emit item IDs/familiarity/discovery into metadata.

## Result (at the time of this review)

Implemented for all252 food and84 toy identities. Shared display arrays sort by descending unconditional draw mass (easier first), unprepared/unassembled first, broad Korean familiarity, then Korean alphabetical label/ID. Both food familiarity ties and toy familiarity ties use the same rule; prepared/assembled entries also resolve ties consistently. New IDs require explicit preparation/assembly and familiarity metadata before typecheck succeeds. Draw arrays, weights and storage normalization retain their established order.

The five seal frames then used a plain round seal, green flower edge, blue octagonal medal, gold sunburst and purple crowned/laurel medal with ribbons. The selected detail keeps the exact underlying image and its original contained proportions. Unknown specimens keep neutral silhouettes with no names, rarity badge, odds or seal.

## Verification

- Typecheck, zero-warning lint and production build PASS. Build ID: `yIcIua7SPfq2_O07uNdHr`.
- Full unit suite:397 files,6431 tests PASS. Includes hierarchy, deterministic ties, future insertion, exhaustive identity coverage, unchanged draw intervals/probabilities and pointer/keyboard/read acknowledgement tests.
- Seven distinct guarded production-fixture browser scenarios PASS across completed runs: viewer light all252 food/all84 toy detail previews; studio dark all84 toy details; complete food/toy page order and all five seals in viewer light, studio dark, preview light and1050px short dark viewer; unknown silhouettes plus sorted unread inspection with exact saved-ID membership.
- Earlier browser runs retained: initial test assumed4 columns; responsive geometry actually uses up to5. Another test sampled initial layout before the existing ResizeObserver settled and assumed persisted arrays follow display order. Corrected the harness to wait for real layout and check exact ID membership; no product workaround or assertion about unseen siblings was removed. Failed originals and final passing logs remain in local QA evidence (not published).
- Independent non-author role/boundary/privacy/UX/QA review PASS with no blocking findings. Reviewer directly inspected viewer light, studio dark and preview light five-tier captures, including80px detail, long labels and diagonal toys. This was technical review, not owner aesthetic approval.
- G22 audit: both developer timeline and least-used views still use `describeTarget` from `lib/activity/labels.ts`. Existing food/toy inspect/category/page fixed targets and keyboard deduplication remain; automatic sorting and decorative frames emit no new human events. No item ID, collection, popularity band or learned trait enters analytics. Existing callback and activity suites passed in the full unit run. Browser APIs were intercepted; no real analytics, account or DB writes.
- No server DTO, auth/role/unlock, KST, persistence schema, draw probability or specimen asset change. Fixtures use synthetic local ownership; they do not prove actual earning, real login/RLS or a production deployment.

Evidence: unit/build/type/lint results, visual164 captures and consolidated scenario/source/integration receipts are kept as local QA evidence (not published). No commit, push or deployment was part of this request.
