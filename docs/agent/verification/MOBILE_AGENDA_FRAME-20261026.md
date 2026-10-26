# Mobile agenda frame verification — 2026-10-26

Scope: adopted mobile date/filter frame, always-open tag filter, notice0/3 and viewport adaptation; all actual public/studio/preview implementations shared. No DB changes, new API fields, authority changes or automatic activity events.

Confirmed defects and repairs:
- Prior no-notice public layout:16px top versus8px bottom gap, document+4px. Actual footer footprint and removal of duplicate header margin replace guessed padding.
- Prior outer scroll: public document grew4px per scroll and studio dates moved135px behind notice. Internal bounded date/tag scroll and existing management-after-dates placement eliminate outer overflow.
- Short preview rail: tag body0px. Noninteractive28px heading and footer return free space while44px choices remain.
- Moving inline management into a narrow column clipped fixed controls. Existing shared full-width tag modal preserves editing and discard guards.
- Independent review caught missing one-tap month controls and hidden LIVE label in compact preview footer. Month arrows retain44px hits; only non-LIVE labels are visually compacted, with accessible text retained.

G-22 audit: existing timeline and least-used action catalogue keep desktop folding and existing human actions. Removing the mobile disclosure adds no replacement fake human event. Scrolling/resizing/automatic notice context remains excluded; no title/body metadata added. Anonymous/role gates unchanged.

Evidence location: local durable `C:/Users/im917/.codex/vic-pipeline/runs/20261026-mobile-agenda-frame/`; immutable originals in `original-failures.json`, `original-failures/` and referenced receipt folders. Original failed attempts stay failures. Interrupted broad unit attempt is not PASS; relevant120 local units passed, exact-commit CI required before release completion.

Local final gates PASS: production `npm run build` including prebuild, typecheck, full lint, harness and120 related units. Browser coverage spans64 portrait combinations, original13 motion/selection/teaser cases, rotation2, tag modal1, actual month controls/LIVE2 and edit/add-return2. This is28 scoped cases across immutable attempts, not a claim that28 ran together on the last build. `qa-summary.json` explains exact affected-case reruns/content reuse. Original failures and invalid preparations retain their original outcomes.

Latest affected5 PASS on the final build:16 worst-case portrait routes have exactly8px outer gaps and minimum46.234375px tag body;320/390×owner/developer×edit/add gives8 exact focus returns and0px window/flow/card drift. Owner landscape document578px/scroll188 and tag body62px restores to portrait844px/scroll0. Independent source reviewer accepted final focus and spacing changes. Final affected receipts have0 mutations and0 page errors.

The initially tried landscape clipping was superseded after actual tags fell to4px. Short viewports now keep the whole notice board in static document flow and a minimum168px frame. Frame reveal aligns dates/filters before navigation and keyboard focus. Portrait remains one viewport.

Integration is not established by local checks. The durable `release-confirmation.json` requires the exact commit, successful CI, READY production alias binding and executed public mobile/fixture-guard readback. Release controller retains this next stage.

Limits: synthetic fixtures/intercepted network cannot establish genuine login/RLS or physical iOS/Android behavior. No new privacy/real-device assurance. Prior desktop golden discrepancy remains historical; do not alter its baseline for this mobile work.
