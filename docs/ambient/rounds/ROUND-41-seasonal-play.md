# R41 — Visible seasonal objects to catch

2026-09-15 user asks spring/summer/winter graspable objects comparable to autumn leaves. Spring coloured petals, summer fresh green leaves, winter large distinct snow crystals. User direction supersedes earlier pale tiny seed-like materials and restrained spring petal palette for these interactive objects only.

Preserve individual drag/release physics, perspective size/speed/whole-sprite fade, horizon retirement, load budget and showcase-only motion. Replace cached code-drawn sprite forms, increase near-view size/hit area. Autumn/terrain unchanged. Validate three seasonal drags, distance retirement, low-load and rendered noon/night contrast. No push requested.

Status: locally verified, awaiting visual feedback. No push requested.

## Result

- Six cached 64×64 variants per season: colourful notched petals, fresh leaves with visible veins, six-arm snow crystals with blue under-stroke. Base radii 27–44px replace 4–10px particles; depth and tilt still reduce displayed dimensions. Hit radius includes a 12px minimum and follows perspective size.
- Individual grab/drag/release retained. Retirement now accounts for enlarged radius at screen edges; B/C review caught and fixed old bottom +24px boundary. Cached art remains small (96KiB primary sprites per instance); count/load budgets unchanged.
- Final typecheck/lint/build PASS. Full unit suite 84 files/870 tests PASS before edge follow-up; affected activity suite 8 tests PASS after follow-up, including three new bottom-retirement checks. Browser: all three seasons grab/drag/release PASS, six noon/night captures, zero errors (`.scratch-pw/qa/r41`). A visual review: foreground legibility good, distant whole-sprite fade retained, no actionable visual defect.
- Earlier R39 loading and R40 ridge changes remain in this unpushed worktree. Tree placement stays deferred until other biome base designs.
