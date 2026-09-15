# R65 — Navigation loading feedback

2026-09-16 KST. Owner cannot tell whether initial showcase arrow navigation is stuck or waiting. Local change, not pushed; R64 remains pending separately.

World navigation emits vic:biome-loading when a valid destination enters the existing readiness queue. Shared showcase displays a persistent destination-specific status immediately: “숲 배경 준비 중… / 준비되면 자동으로 이동해요”. Current scene remains visible. Departure/arrival clears status; disposal clears pending status. Existing ready checks, dt=0 warmup, movement, repeated-input guard and reduced-motion path are unchanged. No global page overlay or fabricated percentage.

Loader rejection now clears the matching queued destination and reports a distinct error with retry guidance, rather than leaving an unhandled rejection. Superseded/disposed request failures cannot clear a different queue. Hanging asset requests still display preparing; no timeout or forced incomplete-scene transition was introduced. Esc remains available through existing showcase controls.

A inspected the actual loading capture: readable two-line status on a small translucent panel, existing scene/exit/navigation visible, no blocking visual issue.

Verification: typecheck/lint/build passed, five world-travel tests pass including synchronous loading notification, readiness/reduced-motion behavior and rejected-load retry. Production-build Playwright held the forest background request, pressed ArrowRight, verified immediate status/current meadow, repeated ArrowRight without extra queue, then released request and verified automatic forest arrival/status removal. No browser errors. Actual captures .scratch-pw/qa/r65/loading.png and arrived.png. B/C code reviews found no blockers; timeout absence recorded above. No production/device loading-speed claim.
