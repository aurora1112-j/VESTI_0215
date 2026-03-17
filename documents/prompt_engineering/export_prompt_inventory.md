# Export Prompt Inventory

Status: Active canonical inventory  
Audience: Prompt engineering, runtime engineering, maintainers

## Purpose

Keep a single 1:1 inventory of export runtime entries, prompt artifacts, profiles, and migration debt.

## Active shipping inventory

| Stage | Runtime entry | Prompt source | Profiles | Output |
| --- | --- | --- | --- | --- |
| `E0 dataset_builder` | `frontend/src/sidepanel/utils/exportConversations.ts` + export dataset helpers | none (deterministic) | n/a | normalized export dataset |
| `E3 compact composer` | `frontend/src/sidepanel/utils/exportCompression.ts` | `frontend/src/lib/prompts/exportCompact.ts` | `kimi_handoff_rich`, `step_flash_concise` | compact markdown |
| `E3 summary composer` | `frontend/src/sidepanel/utils/exportCompression.ts` | `frontend/src/lib/prompts/exportSummary.ts` | `kimi_handoff_rich`, `step_flash_concise` | summary markdown |

## Target inventory after decomposition

| Stage | Target prompt artifact | Target runtime location |
| --- | --- | --- |
| `E1` | `export_e1_structure_planner` | `frontend/src/lib/prompts/export/structurePlanner.ts` |
| `E2` | `export_e2_evidence_compactor` | `frontend/src/lib/prompts/export/evidenceCompactor.ts` |
| `E3 compact` | `export_e3_compact_composer` | `frontend/src/lib/prompts/export/compactComposer.ts` |
| `E3 summary` | `export_e3_summary_composer` | `frontend/src/lib/prompts/export/summaryComposer.ts` |
| `repair` | `export_repair` | `frontend/src/lib/prompts/export/repair.ts` |

## Adjacent systems kept outside export canonical ownership

### Explore
- runtime owner: `frontend/src/lib/services/searchService.ts`
- status: independent feature line
- reuse policy: patterns only, not document-structure inheritance

### Legacy Insights
- runtime owner: `frontend/src/lib/services/insightGenerationService.ts`
- status: compatibility line, not prompt-engineering mainline
- legacy docs archived under `documents/archive/prompt_engineering/legacy_insights/`

## Migration debt inventory

These files still carry prompt-like runtime text outside the target export folder model:
- `frontend/src/lib/services/insightGenerationService.ts`
- `frontend/src/lib/services/searchService.ts`

They remain visible here so future cleanup does not lose track of them.