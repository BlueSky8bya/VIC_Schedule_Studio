# ROUND-31 — Small detached cloud islands

Owner screenshot 2026-09-11 identifies pea-sized puffs inside the source bitmap, not the whole bitmap rectangle. R30's three soft masks did not give those puffs individual lives.

- Detect connected alpha islands before blurring; extract up to 24 small detached pieces per source, including faint connected edges. Clear their original pixels so they cannot persist as ghosts in the large body.
- Each isolated piece uses its displayed width for a short 5–18s nominal lifetime, independent phase, local drift, spreading/stretching and a fully transparent interval before recycling. Larger main clouds retain at least 90% of their life envelope in every weather; only outlines fluctuate.
- Cache includes isolated canvases under existing 20-entry /16MiB cap. No per-frame extraction or blur. Existing stationary/mobile/deep and R29 terrain/R30 lighting unchanged.
- No source art files changed, no public/server/KST/security changes, no commit/push.

Final build HIgBnFCIUiTfcOoJOM-5N. Full suite before faint-edge refinement: 78 files / 839 tests passed. Final targeted suite 21 tests passed, including faint-edge ownership and short independent lifetimes. Build (lint/type validity), explicit typecheck/lint, 81-document harness and diff check passed. Final stationary/cache/mobile suite: 33 passed, 0 failed.

Actual four-time night capture review shows small puffs changing separately while large bodies remain. Final cleanup renders at 1.5/6.5/11.5s inspected; no page errors or horizontal seams observed. A/B/C reviews: faint-edge ghost issue fixed by connected alpha>0 expansion; no cache cleanup blocker. R30 policy intentionally retains cheap per-cloud drift/fade in lite, omitting shape deformation; global still/reduced time freeze tested. 90% refers to the main life envelope, not every fringe pixel opacity. Real-device frame costs and subjective timing remain owner review items.

Evidence: .scratch-pw/qa/r31 and final/. Local fixture stays on 3100; no commit/push.
