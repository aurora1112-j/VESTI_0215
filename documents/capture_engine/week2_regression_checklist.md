# Week 2 Regression Checklist

Status: Active QA checklist for Week 2 shipped state  
Audience: Parser maintainers, reader/web maintainers, reviewers

## How To Use

Run this checklist after any change to:

- parser extraction
- AST/table fidelity
- citation/artifact packaging
- sidepanel reader
- `@vesti/ui` / `vesti-web` rich rendering

The expected sample sources are defined in:

- [`week2_regression_sample_manifest.md`](D:/DEV/VESTI-main-git/documents/capture_engine/week2_regression_sample_manifest.md)

## Build Gates

- `pnpm -C packages/vesti-ui build`
- `pnpm -C frontend build`
- `pnpm -C vesti-web build`

If `vesti-web/next-env.d.ts` is touched by build output, restore it before commit.

## Capture / Parser Checks

### Claude

- `CLAUDE_TITLE_001`
  - conversation title comes from app-shell metadata, not body `<h1>`
- `CLAUDE_ARTIFACT_001`
  - standalone artifact is captured as sidecar
  - `plainText` and `normalizedHtmlSnapshot` exist
  - `markdownSnapshot` only appears when safely derived
  - artifact content does not leak back into `content_text`

### ChatGPT

- `SEARCH_CITATION_001`
  - citation labels collapse to the first visible line
  - persisted/exported citation URLs do not include `utm_*`
  - citation pill text does not remain at the end of the message body
  - `Sources` metadata still exists after body cleanup
- `TABLE_FIDELITY_001`
  - true tables still emit `semantic_ast_v2`
  - KaTeX in table cells does not collapse into duplicated renderer text
  - alignment survives when present

### Qwen

- `DOM_QWEN_W2_001`
  - one hard message root yields at most one logical message
  - thinking status card does not leak into body text
  - `qwen-markdown-table-header` and footer actions do not leak into body text
  - Monaco/code chrome does not leak into code content

### Yuanbao

- `DOM_YUANBAO_W2_001`
  - bubble root and role split remain correct
  - AI toolbar does not leak into body
  - app-card/process shell does not leak into body
  - artifact presence is retained as sidecar

### Kimi

- `DOM_KIMI_W2_001`
  - `segment-container / markdown-container` remains the main AI path
  - `segment-code-header` and preview/copy actions do not leak into body
  - `okc-cards-container` and assistant action row remain out of body text

### DeepSeek

- `DOM_DEEPSEEK_W2_001`
  - assistant final answer comes from `.ds-markdown`
  - thinking shell does not replace or pollute final answer text
  - sidebar/input chrome is not treated as message content

### Doubao

- `DOM_DOUBAO_W2_001`
  - wrapper-shell table header actions do not leak into body text
  - native table body still reaches AST/table rendering
  - search/tool widgets remain outside canonical body text

## Reader / Web Checks

- table messages render from AST structure, not flat plain text
- inline math and block math remain visually distinct from normal prose
- code blocks remain isolated from copy/toolbar/badge UI text
- `Sources` stays as a separate disclosure and never becomes body suffix text
- `Artifacts` stays as a separate disclosure and never becomes body suffix text
- web detail view does not fall back to a raw `content_text` transcript when AST is available

## Export Checks

- JSON export keeps `citations[]`, `artifacts[]`, and `normalized_html_snapshot`
- Markdown export writes `Sources` and `Artifacts` as separate per-message sections
- TXT export writes `Sources:` and `Artifacts:` as separate per-message sections
- export body text does not reintroduce citation tail or artifact tail noise

## Frozen Review Rule

- any change that touches citation, artifact, title provenance, or rich table/math/code behavior must map back to at least one frozen case ID in the manifest
