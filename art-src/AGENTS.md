# Entity art work

Scope: this tree. [Root AGENTS](../AGENTS.md) supplies shared permissions. This file owns storage and delivery rules; current status and generated specifications live elsewhere.

## Task routing

| Task | Read |
|---|---|
| Find an entity | [Entity catalogue](목록.md), then `<category>/<entity>/프롬프트.md` |
| Find the authorized delivery | [CURRENT_STATE](../docs/agent/CURRENT_STATE.md), then the exact run request |
| Generate/review | Frozen request inputs and [ART_RULES](../docs/ambient/ART_RULES.md) |
| Catalogue, migrate or process a run | [ART_PIPELINE](../docs/ambient/ART_PIPELINE.md) |
| Source lineage / shared references | [README](README.md), relevant [reference guide](reference/README.md) |

## Storage and delivery

- The entity is the workspace: prompt, references, rejected evidence, preserved sources and review entry points stay together. Create entity directories when material exists or the entity is explicitly selected; the catalogue lists the full plan without empty directories for every slot.
- Get entity grouping and exact filenames from the generated catalogue. A file maps to `생성본/<variant>/<season-or-공통>/<canonical-name>.png`. Availability seasons do not multiply outputs. Stage ids and moon phases are not interchangeable variants.
- A current `프롬프트.md` is an entry point and full file plan. Only `runs/<run>/request.md/json` defines the delivery's exact subset. Existing public files are references, never implicit replacement requests.
- New generator bytes enter the run's flat `raw/` with exact requested names. Derive `normalized/` separately. The entity's `검토/` links those flat outputs and review sheets; do not rename approved artifacts or invent duplicate reviewed copies.
- Preserve source bytes and provenance. A legacy file in `생성본/` is not proven owner-approved or necessarily the first generator output. A same-name public file does not establish its lineage.
- Authorized legacy migration uses the receipt-backed workflow. Keep canonical filenames, original rejected batch identities and image/sidecar pairs. Existing run paths, requests, inputs and hashes stay unchanged; ordinary cleanup never authorizes deleting source or rejection evidence.
- Rejected batches and their notes belong under the entity's `반려본/`. Do not recreate root `incoming-*` folders for redirects; historical paths remain in the migration receipt.
- Entity reference images are selected inspiration candidates, not approved style. Ambiguous or shared material stays in the category library. Record images actually inspected and actually passed to the generator; only request-listed frozen inputs establish that run's reference set.
- After delivery begins, changed instructions or artwork require a new run. Never hand-edit hashes to bypass checks. The documented empty, pending preparation state alone permits `--refresh-prepared`.
- Require complete applicable seasonal packs, measurements and both visual sheets. Unmeasured stays unmeasured; numeric PASS is not owner approval. Preserve run and legacy rejection reasons for subsequent requests.
- Record the owner's actual decision against exact artifacts. `--reviewer owner` is a local field, not authentication or authority to invent approval. Inspect `promote` first; use `--apply` within current publication authorization. Existing public names remain protected.
- Product bundles/public APIs must not import this source archive. Runtime sprites live in `public/ambient/art/`.

## Generated documents

The catalogue owns `목록.md`, entity `프롬프트.md` and the four material-folder READMEs. Do not edit their generated content/hash; use separate notes or review records, then regenerate. Commands and validation live in ART_PIPELINE. Report generated, measured and owner-approved separately.
