# Vesti Engine Technical Memo: Doubao CoT Segmentation Hardening

Date: 2026-02-23  
Scope: `frontend/src/lib/core/parser/doubao/DoubaoParser.ts` only

## 1) Symptom Snapshot

Observed on Doubao assistant turns:
- CoT (折叠思考区) and formal markdown output share one turn but live in parallel DOM branches.
- Parser may stop after CoT/search widget subtree and miss formal output.
- Noise widgets (e.g. `2/2`, `参考链接:26`, `编辑历史`) can be captured as standalone assistant content.

Primary user-facing impact:
- Reader shows truncated AI replies.
- `roleDistribution.ai` drops or becomes unstable.
- Message count can inflate with noise-only pseudo messages.

## 2) DOM Evidence Model

Common branch signals:
- CoT branch: `collapse-wrapper*` (and related reasoning wrappers)
- Formal branch: `flow-markdown-body` / `container-*-flow-markdown-body`
- Noise in-between: pagination, edit-history switch, search/reference cards, action buttons

Risk pattern:
- A single dynamic subtree read failure can terminate naive recursive extraction and drop remaining siblings.

## 3) Root-Cause Model

Legacy path in `DoubaoParser` depended on single content-root extraction plus broad message selectors.  
This is brittle against modern componentized DOM where:
- role marker and actual content root are decoupled,
- CoT and final answer are sibling branches,
- non-content widgets inject text that looks parseable.

## 4) Implemented Strategy

### 4.1 Role-first candidate hardening
- Narrowed role anchors to explicit role markers + required message containers.
- Added `isLikelyMessageCandidate(...)` gate:
  - requires role marker or preferred content marker,
  - discards known container noise,
  - applies sanitized-text length and noise-pattern checks.

### 4.2 Segmented AI extraction with isolation
- Added `resolveContentElement(node, role)`:
  - `user`: preferred content path
  - `ai`: dual-branch probe (`AI_COT_LEAVES`, `AI_FINAL_LEAVES`)
- Added `buildSegmentedAiContainer(...)`:
  - merges CoT + formal output into one temporary root (`data-vesti-segment-root="doubao"`),
  - uses in-message headings:
    - `思考过程`
    - `正式回答`
  - formal-output-priority fallback: CoT failure must not block final answer.

### 4.3 Sanitization and noise filtering
- Added clone-based sanitization pipeline:
  - remove inline widget noise selectors,
  - convert divider/separator nodes to newline boundaries,
  - prune empty text nodes and empty containers.
- Upgraded line-level cleaning rules for:
  - pagination (`2/2`)
  - edit history labels
  - reference-count lines (`参考链接:26`, `references:26`)
  - operation-only lines (`show more`, `done`, `copy`, `edit`, `retry`)
  - retrieval-summary lines (`找到xx篇资料参考`)

### 4.4 Role inference fallback chain

Inference order is fixed:
1. `data-testid` (`send_message` / `receive_message`)
2. role attributes (`data-role`, `data-author`, `data-message-author-role`)
3. class hint
4. node marker (`hasUserMarker` / `hasAssistantMarker`)
5. descendant marker (`roleFromDescendants`)
6. ancestor marker (`closestAnySelector` + role hints)
7. unresolved => `null` (counted as dropped unknown role)

No default-to-assistant fallback is used.

### 4.5 Observability
- `Doubao parse stats` now includes `ai_segment_stats`:
  - `cot_detected`
  - `final_detected`
  - `cot_parse_failed`
  - `final_parse_failed`
  - `final_only_fallback_used`

## 5) Rollback Point

Single-file rollback target:
- `frontend/src/lib/core/parser/doubao/DoubaoParser.ts`

No schema change, no API/type contract change, no migration dependency.

## 6) Acceptance Evidence Template

Use this checklist per sampled conversation:
1. Build gate: `pnpm -C frontend build` passes.
2. Parser stats snippet includes non-zero `roleDistribution.ai`.
3. CoT + formal-output case:
   - one `ai` message only,
   - contains `思考过程` + `正式回答`,
   - formal markdown structure remains visible in Reader.
4. Noise case:
   - lines like `2/2`, `参考链接:26`, `编辑历史` are absent from stored assistant content.
5. CoT-failure simulation:
   - final answer still captured (no full-turn drop).
