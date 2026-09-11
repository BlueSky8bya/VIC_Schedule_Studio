# ROUND-34 — Slow local cloud outline deformation

Owner request: visible slow outline deformation and joining neighboring clouds; vertical bobbing alone is insufficient. All other accepted behavior preserved.

- Replace three full-height soft strips with six curved, overlapping 2D regions (three columns × upper/lower).
- Each region expands, compresses and shears about its own local center. Upper domes, underside and side tails have independent phases; slow bounded horizontal drift lets neighboring shapes overlap/connect.
- Remove rigid main-cloud vertical bob and periodic opacity pulse. Actual extracted small puffs retain one-way dissipation/no respawn; large body life remains.
- Existing 20-entry/16MiB cloud cache cap; six cached region draws per source, no per-frame masks or blur. Lite retains undeformed cached regions. Ground, ridge, public roles, KST, mobile/deep and engine stationary gates untouched.

- Taper vertical strain near the sky/horizon boundary. Cull bounds include strain, and offscreen cycle margin is `4.4 * floor + 64`, covering the enlarged envelope (independent review identified the former margin mismatch).

Final runtime checks: still/cache/mobile suite 33 passed, 0 failed; fixture selftest all passed, including deterministic timing and deep weather seal. Harness passed (81 documents; startup brief 8141 bytes).

Verification: final fixture build `JVaUNB6kNxGmF028eUjZh`; typecheck, lint, build, diff whitespace and 80 unit files / 844 tests passed. Night/cloud captures at 1.5/15/30/45 seconds in `.scratch-pw/qa/r34/final/` completed without browser errors. Inspected 1.5/30 seconds: domes flatten/inflate, gaps and overlaps change, no rectangular mask edges or horizontal seams observed. Earlier four-frame independent visual review also confirmed non-rigid shape changes. These are sampled frames, not a fluid simulation or measured performance claim. Independent code reviews integrated boundary/margin fixes; one-way dissipation and cache lifecycle retained. No commit/push.

## Publication authorization
2026-09-11: owner accepted the current preview and explicitly requested push. Publish the accumulated R24–R34 sky/meadow implementation and its existing runtime artwork/provenance. Earlier no-push statements describe the pre-authorization state; they are superseded for this release. This approval is for the integrated result, not a claim of individual seasonal image review. Deployment verification follows push.
`b38cda2e` pushed successfully to origin/main. GitHub commit status reports Vercel pending (deployment 67ZrTPj562qD87Z7z4wQuXbrE93o).
