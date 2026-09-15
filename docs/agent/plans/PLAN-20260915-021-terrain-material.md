# Terrain-aware seasonal material physics

Status: Completed

Owner requests terrain-aware leaf/material physics shared across biomes. Add a common surface-force contract with authored valley channel/bank profile, hill slope and pond water; preserve meadow wind behavior. Keep perspective appearance and force coordinates tied to the same source crop. All four seasons use the same solver, lifted/held material avoids ground constraints, winter ice does not receive summer current. Future biomes provide their own profile, not copied valley geography. No water graphics, animals or push.

Verify surface continuity, flow/bank forces and lifted behavior with unit tests; seasonal grabs, motion gates and existing travel with rendered fixtures; type/lint/build and independent review.

[R58 verification](../../ambient/rounds/ROUND-58-terrain-material.md). Local preview, no push.
