# Week 3 Prompt Signal Mapping

Status: Frozen runtime signal map for shipped package-aware prompt ingestion  
Audience: Prompt engineers, runtime engineers, reviewers

## Purpose

This document maps the approved sample set to the prompt-ingestion signals that the shipped runtime
must now honor.

It is the bridge between:

- raw text / DOM sampling evidence
- `PromptReadyMessage`
- `PromptStructureSignals`
- shipped consumers:
  - `exportCompression.ts`
  - `conversationSummary.ts`
  - `insightGenerationService.ts`

## Runtime Signal Contract

The shipped runtime now assumes each prompt-ready message exposes:

- `bodyText`
- `transcriptText`
- `structureSignals`
- `sidecarSummaryLines`
- `artifactRefs`

The important `structureSignals` are:

- `hasTable`
- `hasMath`
- `hasCode`
- `hasCitations`
- `hasArtifacts`

## Case Mapping

### `CLAUDE_TITLE_001`

Source:
- `C:\Users\苏祎成\Downloads\claude.txt`

Expected runtime interpretation:
- title remains app-shell metadata
- prompt ingestion must not infer title from body heading

Consumers that must honor this:
- `conversationSummary.ts`
- `exportCompression.ts`

### `CLAUDE_ARTIFACT_001`

Source:
- `C:\Users\苏祎成\Downloads\artifact.txt`

Expected prompt signals:
- `hasArtifacts = true`
- `sidecarSummaryLines` includes artifact summary lines
- `artifactRefs` are derived from artifact sidecars first
- `bodyText` must not include artifact-tail pollution

Consumers that must honor this:
- `exportCompression.ts`
- `insightGenerationService.ts`

### `TABLE_FIDELITY_001`

Source:
- `C:\Users\苏祎成\Downloads\table.txt`

Expected prompt signals:
- `hasTable = true` for true table-bearing messages
- `hasMath = true` when formula cells are present
- `hasCode = true` when code blocks are present
- canonical body text should come from AST-aware behavior, not renderer-polluted text

Consumers that must honor this:
- `exportCompression.ts`
- `conversationSummary.ts`
- `insightGenerationService.ts`

### `SEARCH_CITATION_001`

Source:
- `C:\Users\苏祎成\Downloads\search.txt`

Expected prompt signals:
- `hasCitations = true`
- `sidecarSummaryLines` contains citation summaries
- citation text must not return inside `bodyText`
- citation influence belongs in transcript sidecar context, not body-tail text

Consumers that must honor this:
- `exportCompression.ts`
- `conversationSummary.ts`

### `DOM_DOUBAO_W2_001`

Source:
- `.playwright-auth/samples/20260320-222437-doubao-week2-regression`

Expected prompt signals:
- wrapper-shell table noise does not leak into `bodyText`
- native table content still yields `hasTable = true`
- math/code detection remains grounded in cleaned body text

Consumers that must honor this:
- `exportCompression.ts`
- `insightGenerationService.ts`

### `DOM_QWEN_W2_001`

Source:
- `.playwright-auth/samples/20260321-004643-qwen-parser-regression`

Expected prompt signals:
- thinking status card does not leak into `bodyText`
- table footer/header action chrome does not leak into `bodyText`
- Monaco code content still yields `hasCode = true`
- formula-heavy messages still yield `hasMath = true`

Consumers that must honor this:
- `exportCompression.ts`
- `conversationSummary.ts`
- `insightGenerationService.ts`

### `DOM_YUANBAO_W2_001`

Source:
- `.playwright-auth/samples/20260321-004613-yuanbao-parser-regression`

Expected prompt signals:
- toolbar/download CTA/pane chrome do not leak into `bodyText`
- canvas/preview/code pane become artifact sidecars
- `hasArtifacts = true` when artifact presence is retained

Consumers that must honor this:
- `exportCompression.ts`
- `insightGenerationService.ts`

### `DOM_KIMI_W2_001`

Source:
- `.playwright-auth/samples/20260321-004707-kimi-parser-regression`

Expected prompt signals:
- segment code header / preview / copy controls do not leak into `bodyText`
- actual code block content still yields `hasCode = true`
- `okc-cards-container` remains non-body chrome

Consumers that must honor this:
- `exportCompression.ts`
- `conversationSummary.ts`

### `DOM_DEEPSEEK_W2_001`

Source:
- `.playwright-auth/samples/20260321-004734-deepseek-parser-regression`

Expected prompt signals:
- thinking shell does not replace final answer body text
- sidebar/input/app chrome do not leak into `bodyText`
- assistant final answer remains sourced from `.ds-markdown`

Consumers that must honor this:
- `exportCompression.ts`
- `conversationSummary.ts`
- `insightGenerationService.ts`

## Review Rule

If a runtime change alters prompt-ingestion behavior, reviewers should verify:

1. whether the affected case IDs above are still mapped correctly
2. whether `bodyText` stayed clean
3. whether the right `structureSignals` and `artifactRefs` still exist
4. whether the shipped consumer changed prompt behavior for the right reason
