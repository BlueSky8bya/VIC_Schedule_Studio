# ROUND-19 — 봄 초원 첫 시안

Status: Owner likes original color/pixel feel/view/open center; finer-pixel revision available, technical layer delivery incomplete · 2026-09-11 (KST)

Owner instruction: “1단계 해보자”. Scope is spring far/ground/frame candidates and a combined view, not runtime integration, other seasons or push.

## Deliverables

- [Review page](../../../art-src/배경층/초원/검토/봄초원-시안.html): combined concept plus three raw candidates, with limitations visible.
- [Frozen request](../../../art-src/배경층/초원/작업회차/20260910-봄-깊이층-시안01/request.md): 3 files; Dave `207597_218580_5945.png` and ACNH `,jx.jpg` selected from indexed mood entries, hashes verified, copied into the run, visually inspected and attached to each built-in image generation call. No approved backdrop baseline exists. Game images are mood/camera references only.
- [Measurements](../../../art-src/배경층/초원/작업회차/20260910-봄-깊이층-시안01/measurements.json): all three are 1536×1024, but RGB with no alpha. The generator painted checkerboards. Colors are 14,995 / 15,766 / 22,662; all fail the 6–10-color and 4px-block rules. These counts include the invalid painted backgrounds, not only vegetation.
- A separate `20260911-투명수정-시안02` targeted edit also failed genuine transparency; source/output and exact prompt are preserved. No automatic background removal, quantization or geometry repair was applied.
- `20260911-합성참고-시안03` contains a separate opaque concept generated from the three candidates. It is NOT a pixel-preserving composite, normalized deliverable or actual app capture. Original bytes and input/output hashes are retained.

## Review and next action

Owner feedback on September11: likes the initial pixel feel, palette, viewpoint and open center; requests 2–4× pixel resolution and the fresh luminous atmosphere of the attached Dave scene. New run `20260911-세밀한초원-시안04` preserves the liked composition and requests approximately 2× finer linear pixel detail at the same 1536×1024 canvas size. The original concept and actual user attachment were inspected, frozen and passed to built-in imagegen. Raw output, exact prompt, input roles and hashes are retained. The result is a finer, brighter concept with airy distant woodland; exact pixel-grid compliance is not claimed. The prior intent to eliminate the liked soft color impression is superseded by this direct user feedback; technical alpha/coordinate checks and promotion remain separate. Sky/clouds here describe the concept only, not new baked runtime weather assets.

Independent visual reviewer inspected three originals plus the concept. The open center and pale far/darker near relationship are useful. Unresolved: ground starts about y384 instead of268, far band ends around430 instead of320, soft shaded/noisy fills violate the intended pixel style, foreground corners are dense triangular masses rather than sparse low tufts. Main agrees. Owner decision remains pending; no approval was invented.

Next: get feedback on the finer-pixel revision and repair the layer delivery route before exact three-layer composition and stage two. Preserve the already liked color/view/open center. The technical failures remain agent work, not a request to waive the art rules. No CLI fallback/model switch was made.

## Preparation and verification

Stage-one-only `scripts/lib/ambient-backdrop-spec.mjs` freezes the accepted rectangular candidate geometry. `ambient-backdrop-pilot.mjs request <회차>` creates new immutable preview requests with one indexed mood image from each game; `ambient-backdrop-inspect.mjs <run>` only measures, never repairs. Existing run names are rejected. Partial candidates are outside the runtime sprite manifest/catalogue and cannot be promoted by the existing sprite workflow. The planned general manifest/family/loader/normalization integration remains stage-two work; this pilot path is not described as that completed P1 infrastructure.

No product code, public assets, role permissions, authentication, server data boundaries or KST runtime behavior changed in this stage. Existing P0 work remains local. The first request was created before KST midnight; later edits/concept are dated September11.

Typecheck and lint passed; five existing art/style suites passed (79 tests). Product build was not rerun because final changes are local tooling, records and candidate images only. The catalogue command through npm did not forward its requested flags and regenerated source hashes while a temporary manifest addition existed. Those owned hash-only edits were verified against HEAD and restored; the manifest and folder mapping additions were also removed when the preview contract was isolated. Final direct `node scripts/ambient-art-catalog.mjs --all --check`, style check (449 images), harness and diff checks passed after cleanup. The isolated spec hash and actual two-reference selection match the frozen request. Existing user files and P0 changes were preserved.
