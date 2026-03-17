# Export Eval And Drift Gate

Status: Active canonical governance note  
Audience: Prompt engineering, QA, CI owner

## Purpose

Define the export-specific evaluation and drift-governance baseline for the export multi-agent direction.

## Required local gate

Mandatory command before merging export prompt or export-compression changes:
- `pnpm -C frontend eval:prompts --mode=mock --strict`

This remains the first-line local gate.

## Export fixture set

Export fixtures live under:
- `eval/gold/export/`

Current baseline cases must continue to cover:
- code-heavy engineering handoff
- research / note-taking summary
- sparse short thread
- Chinese configuration / debugging thread

## Export-specific validation focus

Export regression review must explicitly inspect:
- required heading preservation
- grounded section density
- artifact preservation for code / commands / paths
- fallback frequency and fallback reason codes

## Invalid-reason codes

The export baseline recognizes these explicit invalid-output reason codes:
- `export_output_too_short`
- `export_missing_required_headings`
- `export_grounded_sections_insufficient`
- `export_artifact_signal_missing`

These codes must remain visible in logs, reports, and export-quality debugging.

## Governance rules

- export prompt changes must be traceable to a named runtime artifact in `frontend/src/lib/prompts/**`
- new export prompt paths must be added to `export_prompt_inventory.md`
- new service-local export prompt strings are not allowed
- export drift discussion should no longer rely on legacy Insights-only prompt docs

## Relationship to repo-wide thresholds

Repo-wide eval thresholds remain anchored in:
- `eval/rubrics/thresholds.json`

This document does not redefine global scoring thresholds. It adds export-specific review obligations on top of the shared gate.