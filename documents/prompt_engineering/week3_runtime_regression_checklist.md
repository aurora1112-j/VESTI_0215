# Week 3 Runtime Regression Checklist

Status: Active checklist for shipped package-aware prompt ingestion  
Audience: Prompt engineers, runtime engineers, QA

## Build Gates

Run after each functional commit:

- `pnpm -C packages/vesti-ui build`
- `pnpm -C frontend build`
- `pnpm -C vesti-web build`

If `vesti-web/next-env.d.ts` changes during build, restore it before commit.

## Shipped Consumer Checks

### Export Compression

Target:
- `frontend/src/sidepanel/utils/exportCompression.ts`

Must remain true:
- compact export still validates against current heading contract
- summary export still validates against current heading contract
- `bodyText` is no longer polluted by citation tail / artifact tail / UI shell text
- `artifactRefs` are not derived only from raw regex over `content_text`
- `hasTable / hasMath / hasCode / hasCitations / hasArtifacts` influence runtime heuristics
- fallback output still preserves reusable artifact signal when it exists

### Conversation Summary

Target:
- `frontend/src/lib/prompts/conversationSummary.ts`
- `frontend/src/lib/services/insightGenerationService.ts`

Must remain true:
- summary prompt transcript can be driven from prompt-ready transcript input
- compaction input length is evaluated from prompt-ready body text
- local degraded synthesis uses prompt-ready body text, not raw polluted transcript text
- thinking-journey seeds do not reintroduce citation or artifact tail text

## Sample Coverage

The following cases must stay covered:

- `CLAUDE_TITLE_001`
- `CLAUDE_ARTIFACT_001`
- `TABLE_FIDELITY_001`
- `SEARCH_CITATION_001`
- `DOM_DOUBAO_W2_001`
- `DOM_QWEN_W2_001`
- `DOM_YUANBAO_W2_001`
- `DOM_KIMI_W2_001`
- `DOM_DEEPSEEK_W2_001`

Reference mapping:

- [`week3_prompt_signal_mapping.md`](D:/DEV/VESTI-main-git/documents/prompt_engineering/week3_prompt_signal_mapping.md)
- [`week2_regression_sample_manifest.md`](D:/DEV/VESTI-main-git/documents/capture_engine/week2_regression_sample_manifest.md)
- [`post_audit_frozen_case_matrix.md`](D:/DEV/VESTI-main-git/documents/prompt_engineering/post_audit_frozen_case_matrix.md)

## Manual Runtime Assertions

- citation-heavy threads:
  - sidecar summaries appear in prompt transcript
  - citation tail does not re-enter `bodyText`
- artifact-bearing threads:
  - artifact summary lines appear in prompt transcript
  - artifact refs come from sidecar content first when available
- table/math/code-heavy threads:
  - `hasTable / hasMath / hasCode` are preserved
  - reusable artifact detection remains grounded
- explanation-heavy threads:
  - symbolic or formula text is not misclassified as file paths or commands

## Sampling Rule

Week 3 sampling should stay limited to:

- `Qwen`
- `Yuanbao`
- `Kimi`
- `DeepSeek`

Only re-sample when a prompt-ingestion rule depends on current parser output behavior.
