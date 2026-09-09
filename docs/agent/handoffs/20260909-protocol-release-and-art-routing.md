# Dated protocol release and art source routing

Status: Completed
Date: 2026-09-09 (KST)
Base revision: 94b0a71d9732f21e557cca507e77eecd419b84fe plus the previous uncommitted repair

User requested a properly named latest initialization protocol after inspecting the G-drive folder, then an updated and optimized art source instruction structure. The external protocol is an editing target; no project bootstrap or wholesale schema migration is executed.

## External release

The folder contains a newer 2026-09-04 schema 2.0 edition in addition to the July editions. The latest file combines its collaboration/conditional-profile contracts with the September memory repair. Released source: `G:/내 드라이브/project initializing/project-initializing_260909.md`, schema 2.1, 154,718 UTF-8 bytes, SHA-256 `9006d9fa196843c2fe9e286336e05fde3a412569873a482e2c8672cbe33f51ef`.

- Folder README selects the latest edition and explains SOLO/TEAM_PARALLEL use. Released dated files remain immutable; a later revision gets a new date or same-day `_r2` filename.
- The July original was restored byte-for-byte from the pre-repair backup: 95,970 bytes, SHA-256 `f06a778f9590d3d5871114ea0c498282c7559d9dc1b927d8318f92d9189fa89d`.
- The previously amended July edition remains beside it as `project-initializing_260712.md.20260909-memory-repair.bak`: 111,976 bytes, SHA-256 `69a2d33983f51c27a48eebc97771cae935f9611b68d6ea3da855083fb91a441c`.
- September 4 and July 10 original bytes remain unchanged. The source file identifies its three merge inputs and hashes.
- Independent review preserved the September collaboration, conditional profiles and adapter contracts. Corrections clarify SOLO versus TEAM state ownership, provider-specific session input/EOF verification, and current-generated versus historical artifact checks.
- New initialization, audit/partial application and actual migration have distinct provenance rules. This repository preserves its original adoption source/schema and records the new source under `review_protocol_*`; it does not claim a full schema 2.1 migration.

## Art source changes

- Added art-src/AGENTS.md because no local agent instruction file existed. It contains storage/delivery invariants and selective routing, without duplicating counts, master prompts or live task status.
- Replaced the old README's public-first normalization and automatic source-copy instructions. Folder roles now distinguish new runs, legacy originals, rejected evidence, outside inspiration, accepted sheets and public outputs.
- Preserved the known missing-original scope for the first accepted pine trio. A rejected image with the same filename is not a substitute for a missing accepted original.
- Corrected the reference library's visual-success claim and stale inventories. Its images are not automatically attached by the current request generator. Provenance/sidecars and the curated-reference cleanup procedure remain intact.
- Root AGENTS and ambient routing now lead into the local art instructions. Standalone batch measurements use the frozen baseline, matching normalization.
- Reduced the current pine handoff to actionable status and repeat-defect guidance. Its previous 13,614 bytes are preserved in a [fenced history snapshot](../../ambient/history/20260909-pine-handoff-before-routing.md), SHA-256 be96d6eb2ce396338bc548aee0ed7a089b4d3fdda12e1f498cab5e30fbc29323. Old public writes, implicit cleanup and past request commands are no longer current instructions.
- Harness validation covers the new art entry documents. Session impact classification recognizes local README/AGENTS as documentation and accepts them for matching ambient changes.

## Verification

- Scoped harness unit tests: 18 passed, including local art guidance classification and actual stdin session behavior.
- ESLint on the changed harness scripts/test: passed. Document links, lifecycle and memory budgets: checked with harness:verify.
- External document: 77 parsed numbered sections, six YAML blocks, header/date/schema/self-reference, three input hashes and README links passed. Twenty unaffected September sections were compared and preserved exactly. No bootstrap or live provider behavior was executed to validate the document.
- Reference library: `npm run ref:check` passed (103 referenced images at verification time).
- Independent art-doc review: no material contract conflict, broken local link or lost history; source snapshot restoration hash matched.
- Image/run baseline: 221 PNG and run files across art-src, public/ambient/art and docs/ambient/reference. Sorted path/hash-list SHA-256 bc2b824a532883f98e3862f8877b3e86abae546ae79dda10c437382d9e26170f matched before and after the work.
- Local art AGENTS is 3,152 UTF-8 bytes; root AGENTS 5,951 bytes, within its 6,144-byte budget. Current pine handoff is 2,247 bytes, with the longer original retained as evidence.
- No art implementation, generated image, public asset or DB behavior changed in this follow-up. Product build and the prior 680-test run remain historical evidence in the [earlier repair](20260909-memory-and-art-pipeline-repair.md), not newly executed product verification for this turn.

## Current entry points

- [Art source instructions](../../../art-src/AGENTS.md)
- [Art source folder map](../../../art-src/README.md)
- [Pipeline commands](../../ambient/ART_PIPELINE.md)
- [Current state](../CURRENT_STATE.md)

No commit, push, deploy, new image generation or owner-art approval is part of this release.
