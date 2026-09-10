# Entity art work

Scope: this tree. [Root AGENTS](../AGENTS.md) supplies shared permissions. This file owns storage and delivery rules; current status and generated specifications live elsewhere.

## Task routing

| Task | Read |
|---|---|
| Find an entity | [Entity catalogue](목록.md), then `<한글 범주>/<한글 엔티티>/프롬프트.md` |
| Find the authorized delivery | [CURRENT_STATE](../docs/agent/CURRENT_STATE.md), then the exact run request |
| Generate/review | Frozen request inputs and [ART_RULES](../docs/ambient/ART_RULES.md) |
| Catalogue, migrate or process a run | [ART_PIPELINE](../docs/ambient/ART_PIPELINE.md) |
| Source lineage / references | [README](README.md), relevant [reference guide](공통화풍참고/README.md) |

## Storage and delivery

- The entity is the workspace: prompt, references, rejected evidence, preserved sources and review entry points stay together. Prepare every manifest entity's basic entry point and four material folders with `art:catalog -- --all` so owners can browse and collect references first. The catalogue calculates the current count. Beach-decoration `starfish` and codex `animal-starfish` share the single `동물/불가사리` entity; do not recreate a ground starfish workspace. Create variant/season subfolders only when material needs them.
- Get entity grouping and exact filenames from the generated catalogue. A file maps to `생성본/<variant>/<season-or-공통>/<canonical-name>.png`. Availability seasons do not multiply outputs. Stage ids and moon phases are not interchangeable variants.
- All directories inside art-src use Korean names (numeric variants/dates remain numeric). `폴더명.json` fixes category/entity folder names separately from runtime IDs and display names. Use the shared path helper; changing the mapping requires an explicit recorded file migration. New run names use Korean and/or digits.
- A current `프롬프트.md` is an entry point and full file plan. Only `작업회차/<회차>/request.md/json` defines the delivery's exact subset. Existing public files are references, never implicit replacement requests.
- New generator bytes enter the run's flat `원본/` with exact requested names. Derive `정리본/` separately. The entity's `검토/` links those flat outputs and review sheets; do not rename approved artifacts or invent duplicate reviewed copies.
- Preserve source bytes and provenance. A legacy file in `생성본/` is not proven owner-approved or necessarily the first generator output. A same-name public file does not establish its lineage.
- Authorized legacy migration uses the receipt-backed workflow. Keep canonical filenames, original rejected batch identities and image/sidecar pairs. The owner's Korean-folder request explicitly relocates existing runs and batches; preserve request/input/review/receipt bytes and hashes, resolve old paths through the recorded mapping. Ordinary cleanup never authorizes deleting source or rejection evidence.
- Rejected batches and their notes belong under the entity's `반려본/`. Do not recreate root `incoming-*` folders for redirects; historical paths remain in the migration receipt.
- Entity reference images support subject form, structure and ecology; they are not approved style. `공통화풍참고/` supports overall mood, color, composition and camera only. Approved project sheets remain style authority. Record images actually inspected and passed to generator; only request-listed frozen inputs establish that run's reference set.
- After delivery begins, changed instructions or artwork require a new run. Never hand-edit hashes to bypass checks. Only empty, pending preparation permits `--refresh-prepared`; relocated legacy requests stay frozen and require a new run for revised instructions.
- Require complete applicable seasonal packs, measurements and both visual sheets. Unmeasured stays unmeasured; numeric PASS is not owner approval. Preserve run and legacy rejection reasons for subsequent requests.
- Record the owner's actual decision against exact artifacts. `--reviewer owner` is a local field, not authentication or authority to invent approval. Inspect `promote` first; use `--apply` within current publication authorization. Promotion copies reviewed raw bytes to the entity's `생성본` path and normalized bytes to public, recording both source/target hashes. Existing names in either destination remain protected.
- Product bundles/public APIs must not import this source archive. Runtime sprites live in `public/ambient/art/`.

## Generated documents

The catalogue owns `목록.md`, entity `프롬프트.md` and the four material-folder READMEs. Do not edit their generated content/hash; use separate notes or review records, then regenerate. Commands and validation live in ART_PIPELINE. Report generated, measured and owner-approved separately.
