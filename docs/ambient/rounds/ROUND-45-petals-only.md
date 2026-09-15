# R45 — Spring petals only, distinct shapes and pointer breeze

2026-09-15 user confirms spring should keep airborne petals only; all other living/decorative entities return after base background design. Supersedes prior spring dressing and R41 large uniform petals. Winter replacement material question remains unanswered; no winter artwork replacement in this round.

Spring: omit creatures, rocks/traces, separate daisies/clover/dandelions, glints and ground-petal overlays; preserve sky, F/M/N background art and airborne petals. Stop creature simulation/interaction and sprite bake. Background image grass/flowers remain baked artwork. Six distinct rounded/notched/oval/fan/cupped/narrow petal outlines at size16–24 instead of27–40. Summer leaf paths now six species shapes including willow, lobed oak, maple and ginkgo rather than repeats.

Shared drift adds autumn-style radial push plus tangential pointer wake, dt-scaled/bounded, distance attenuation and angular damping. Held pieces remain attached; no force from stationary/outside pointers or dt0. Existing counts, mobile/showcase/reduced-motion gating, local coordinates, KST and public boundary unchanged.

Build, lint, typecheck and11 affected unit tests PASS (three new deterministic sweep tests). Six noon/night and three lower-corner captures plus grab/drag/release PASS with no browser errors, `.scratch-pw/qa/r45`. Main inspected spring base-only composition and additional live pointer sweep capture (`spring-swept.png`). Independent B/C no actionable issue; A scoped review passed: spring petals-only, smaller petals remain findable day/night and at corners; summer silhouette families distinct. Winter art excluded pending choice. No push requested.

Full-suite verification: first run reported one suite-load failure (83 suites/871 tests passed; diagnostic output truncated). Immediate full rerun with retained log passed all84 suites/876 tests; no intervening product edit. Cause not established. Log: `.scratch-pw/r45-tests.log`.
