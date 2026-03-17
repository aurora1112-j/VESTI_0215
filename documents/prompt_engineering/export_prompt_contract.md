# Export Prompt Contract

Status: Active canonical contract  
Audience: Prompt engineers, runtime engineers

## Purpose

Define the long-term runtime ownership and artifact boundaries for export prompts.

## Runtime source of truth

The only long-term runtime prompt source is:
- `frontend/src/lib/prompts/**`

Documentation in `documents/prompt_engineering/**` defines contracts and governance, but it is not the runtime prompt text authority.

## Target prompt layout

Export prompts should converge to this structure:

- `frontend/src/lib/prompts/export/structurePlanner.ts`
- `frontend/src/lib/prompts/export/evidenceCompactor.ts`
- `frontend/src/lib/prompts/export/compactComposer.ts`
- `frontend/src/lib/prompts/export/summaryComposer.ts`
- `frontend/src/lib/prompts/export/repair.ts`
- `frontend/src/lib/prompts/export/shared.ts`

Supporting domain folders:
- `frontend/src/lib/prompts/explore/`
- `frontend/src/lib/prompts/legacy/insights/`

The prompt registry entrypoint remains:
- `frontend/src/lib/prompts/index.ts`

## Export artifact contract

### `export_e1_structure_planner`
- stage: `E1`
- input: export dataset metadata + ordered messages + mode + locale + profile
- output: planning notes only

### `export_e2_evidence_compactor`
- stage: `E2`
- input: dataset + planning notes
- output: evidence skeleton with reasoning, artifacts, decisions, unresolved work

### `export_e3_compact_composer`
- stage: `E3`
- input: evidence skeleton + profile
- output: compact markdown under the shipping headings

### `export_e3_summary_composer`
- stage: `E3`
- input: evidence skeleton + profile
- output: summary markdown under the shipping headings

### `export_repair`
- stage: repair path after invalid structured output
- input: failed output + expected contract context
- output: repaired markdown candidate

## Contract rules

- `frontend/src/lib/services/**` must not become the long-term home for new prompt text
- service-local prompts already present in runtime services are migration debt
- `frontend/src/lib/prompts/index.ts` should remain a registry, not a mixed domain implementation dump
- export prompt payload types belong in `frontend/src/lib/prompts/types.ts`

## Current migration debt

The following locations still contain long-lived prompt text or repair text that should eventually migrate out:
- `frontend/src/lib/services/insightGenerationService.ts`
- `frontend/src/lib/services/searchService.ts`

This debt is tracked, not blessed.