# Companion food vectors

Retrieved and checked 2026-10-15 KST from the primary Google Noto Emoji repository. These are vector images, not an installed emoji font and not AI-generated raster art. Runtime serves local files only.

- Upstream: [googlefonts/noto-emoji](https://github.com/googlefonts/noto-emoji).
- Pinned commit: `e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e`.
- Actual current source directory: [`2D/svg`](https://github.com/googlefonts/noto-emoji/tree/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/2D/svg). The historical `svg/` path moved upstream.
- Graphics license: [upstream SVG notice](https://github.com/googlefonts/noto-emoji/blob/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/2D/svg/LICENSE), Apache-2.0. Full text is distributed in [LICENSE.txt](LICENSE.txt), original copyright notice in [UPSTREAM_NOTICE.txt](UPSTREAM_NOTICE.txt).
- Exact source URLs, source SHA-256 and delivered SHA-256: [sources.json](sources.json).

Eight files are unmodified upstream SVG bytes: `apple.svg` (U+1F34E), `lemon.svg` (U+1F34B), `strawberry.svg` (U+1F353), `watermelon.svg` (U+1F349), `tomato.svg` (U+1F345), `peach.svg` (U+1F351), `orange.svg` (U+1F34A), `pear.svg` (U+1F350).

Five files are VIC Schedule Studio derivatives, explicitly marked in each SVG. No upstream originals for these five are claimed:

| File | Basis and modification |
|---|---|
| `raspberry.svg` | Code-native aggregate berry contours using the same Noto food palette, highlight and leaf vocabulary. |
| `grapefruit.svg` | Noto orange: pink cut face, cream pith and radial segment spokes added. |
| `plum.svg` | VIC code-native subtly asymmetric vertical-oval red/burgundy plum: short bare stem, shallow fruit seam and subtle wax bloom, using Noto food shading conventions. Replaces the earlier round contour; no apple shoulder/waist, leaf or peach-like split. |
| `persimmon.svg` | Noto tomato with an orange palette; calyx and silhouette retained. |
| `apricot.svg` | Noto peach with a golden-orange palette; split contour and leaves retained. |

All five derivatives are distributed under Apache-2.0 as well. Modifications: VIC Schedule Studio, 2026-10-15. Copyright of the underlying Noto work remains Google, Inc. This attribution does not imply Google endorsement.

The plum corrections preserve the original `apple.svg` bytes and its source attribution. The original purple-apple derivative SHA-256 (`fa6913b2ec7de27b806e8e2d2708f9f6c4764c624e1ed668a994303072a2d234`) and the first red round contour SHA-256 (`02176fce14522c20ba86fabd8e5edb581e233f8f908f32ef5a6bed8baf9772c2`) remain recorded in `sources.json`; both prior vectors remain in Git history. The latest owner correction narrows the rounded body into a gently uneven vertical oval, retaining the same red/burgundy palette and food shading family. Reproduce and check the corrected local vector with `node scripts/prepare-companion-plum.mjs --check`; it also checks that the other twelve delivered SVGs retain their hashes. This correction changes the drawing of the existing `plum`/자두 snack, not its identity or the thirteen-fruit catalogue. No eggplant asset is present.

Selection: compared the primary Noto SVG license with [Twemoji graphics licensing](https://github.com/twitter/twemoji#license). Noto's rounded shaded forms stay legible at the existing 36px food size and provide a coherent source for this small family. This is a product design choice, not an assertion that thirteen exact fruit originals exist upstream.
