# 2026-03-21 Week 3 Runtime Package-Aware Ingestion

## Summary

Week 3 shipped runtime work on `feature/capture-week2-rollout` was split into:

- `3ed88d6` `feat(prompt): add package-aware prompt ingestion adapter for shipped export runtime`
- `9788db7` `feat(insights): align summary and insight generation with prompt-ready package text`
- `ff509c3` `test(prompt): freeze week3 sample-to-signal mapping and runtime regression checklist`

## What Changed

### Shipped runtime boundary

The shipped runtime now has a bounded prompt-ingestion layer between stored messages and prompt assembly.

That layer produces:

- `bodyText`
- `transcriptText`
- `structureSignals`
- `sidecarSummaryLines`
- `artifactRefs`

This boundary is now used by:

- export compression
- conversation summary generation
- insight generation

### What this solves

- citation tails no longer need to re-enter prompt body text
- artifact detection no longer depends only on regex over raw `content_text`
- table / math / code-heavy threads now expose stronger prompt-side structure signals
- fallback export heuristics and summary local synthesis operate on cleaner prompt-ready body text

### What is still not true

- the runtime is not yet fully AST-native
- `semantic_ast_v2` is still consumed indirectly through canonical text and structure signals
- weekly digest is not yet fully upgraded to the same package-aware depth
- artifact replay and historical repair remain deferred

## Frozen Prompt Assets

Week 3 prompt-side regression assets now live at:

- `documents/prompt_engineering/week3_prompt_signal_mapping.md`
- `documents/prompt_engineering/week3_runtime_regression_checklist.md`

These should be treated as the canonical bridge between:

- sample evidence
- prompt-ingestion signals
- shipped runtime consumer behavior

## Operational Note

`vesti-web/next-env.d.ts` still drifts during Next builds and must remain excluded from commits.
