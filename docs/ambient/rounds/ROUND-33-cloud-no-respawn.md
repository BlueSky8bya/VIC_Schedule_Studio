# ROUND-33 — No re-forming dissipated clouds

Owner correction: keep the fast disappearance, but never regenerate a dissolved small cloud at the same position. Replaces R31 cyclic wisp lifetimes.

- Wisp alpha is monotone decreasing within a transit, with no modulo or grow-in phase. After full disappearance it stays zero.
- Small main clouds and fringe evaporation use the same one-way rule. Large cores retain gentle outline motion.
- Initial visible banks start at simulation t0; newly entering banks receive a fresh lifetime only on their next offscreen transit. Born time is deterministic, independent of frame rate and render cache eviction.
- Existing size-dependent speed, stationary/mobile gates, terrain and ridge untouched.

Final build C8puGLdSgJIf8Xs_NBFkt. Full suite before small-main spread refinement: 79 files /843 tests passed. Final targeted cloud tests 22 passed, including monotone alpha and no return at 300/600/3600s. Final build, explicit typecheck/lint, diff check and harness81 passed. Rendered 1.5/15/30/60s night sequence has no page errors; main bodies remain while isolated puffs disappear. Evidence .scratch-pw/qa/r33.

Code review found small-main split still used cyclic age; corrected to the same one-way evaporation spread. Birth time matches offscreen right-entry envelope and does not depend on cache reuse. Existing night-light and ground improvements unchanged. Local fixture remains on3100. No commit/push.

Final reviewer refinement: fringe evaporation is tier-independent, so reducing quality cannot restore an already dissipated outer lobe. Final build and 22 targeted tests rerun successfully; four-time visual review found no new blocker.
