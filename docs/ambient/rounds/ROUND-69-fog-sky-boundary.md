# R69 — Remove the fog horizon opacity step

2026-09-16 KST. Owner supplied a valley sky crop with a straight brightness boundary. Owner authorized push to main with R68 entry focus on 2026-09-16; deployment unverified.

Cause: bakeFogField used altitude multiplier .35 above the logical horizon and 1 immediately below it. Even with smooth depth/noise, opacity jumped approximately 2.86x at a fixed screen row. The previous 6%-height sky tail also concentrated the transition.

Replace the sky tail with a 12%-height smoothstep envelope that reaches full horizon density; altitude above the horizon is 1, matching the ground-side limit. No hard edge at the start of the tail. Ground-side fog, noise, colors, cache sizing and rendering order are unchanged. Clear weather still bypasses fog. Shared change covers current/future consumers, not a valley-specific painted cover. Forest rooted mist and masks remain intact. No security/role/data/KST change.

Verification: typecheck/lint/build; 20 fog/light unit tests including actual baked opacity rows and all three horizon ratios over 720/860/1080/1440 heights. Browser canvas probe measured adjacent horizon-row alpha changes .06–4.44 on 0–255 scale across the 12 size/horizon cases (each cache row spans about eight screen pixels), no old large step. A first overstrict probe included rows farther up the intentional ramp; the final boundary assertion isolates the rows straddling the horizon and separately bounds the surrounding gradient.

Production fixtures captured autumn fog at noon/night across meadow, hill, pond, valley and forest, plus 2560x1080 valley; no browser errors. Source and final captures in `.scratch-pw/qa/r69/`, including before.png. B math/cache review found no blockers and requested multi-biome/pixel verification, completed above. A/C final reviews saw no sharp horizontal cut or terrain/water break. A notes a broad, smooth horizon haze band remains visible on the wide valley: this change removes the opacity discontinuity, not atmospheric horizon haze itself. C found no new overbright fog blocker. Also captured the user's current summer/noon/forest/fog fixture without browser errors.
