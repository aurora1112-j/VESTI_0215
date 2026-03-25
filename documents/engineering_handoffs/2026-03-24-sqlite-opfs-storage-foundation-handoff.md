# 2026-03-24 Handoff: SQLite + OPFS storage foundation for the Chrome extension

## 0. Summary

This branch implements the storage-foundation slice for keeping Chrome extension as the primary product shape while introducing a local SQLite read-model, plus the next query-rollout slice that moves more Library and Explore reads onto that read-model.

The key decisions now reflected in code are:

- Dexie remains the authoritative write path
- background no longer duplicates offscreen business logic
- offscreen becomes the single owner for offscreen-targeted runtime execution
- SQLite + OPFS run in one offscreen worker only
- query-heavy paths can use SQLite, but must fall back to Dexie safely
- Library list filtering, topic counts, dashboard stats, and Explore semantic context retrieval now attempt SQLite first

This is a storage/runtime foundation branch, not a release-facing polish branch.

## 1. Branch and workspace state

- worktree: `/Users/aurora/vesti_combine/worktrees/storage-foundation-opfs`
- branch: `codex/storage-foundation-opfs`
- intended role: candidate / spike branch for storage foundation work
- `CHANGELOG.md`: intentionally not updated

## 2. What landed

### 2.1 New storage state and abstraction layer

Added:

- `frontend/src/lib/db/storageEngineState.ts`
- `frontend/src/lib/db/archiveStore.ts`
- `frontend/src/lib/db/dexieArchiveStore.ts`
- `frontend/src/lib/db/knowledgeWorkerProtocol.ts`
- `frontend/src/lib/db/knowledgeQueryStore.ts`

These files establish:

- persistent engine state in `chrome.storage.local`
- a Dexie-backed authoritative archive export layer
- a worker protocol for SQLite initialization, sync, and query execution
- an offscreen-owned query store that can initialize, validate, sync, and fall back

### 2.2 Offscreen ownership and worker bootstrap

Added:

- `frontend/src/background/offscreenDocument.ts`
- `frontend/src/workers/knowledge-store.worker.ts`

Updated:

- `frontend/src/background/index.ts`
- `frontend/src/offscreen/index.ts`
- `frontend/src/options.tsx`
- `frontend/src/lib/utils/chromeStorageBridge.ts`
- `frontend/src/lib/services/captureSettingsService.ts`
- `frontend/src/lib/services/llmSettingsService.ts`

Behavioral changes:

- background now creates the offscreen document and forwards offscreen-targeted requests instead of handling those repository/search actions itself
- offscreen only accepts forwarded requests marked as coming through background
- offscreen bootstraps the SQLite read-model in the background
- all SQLite / OPFS access is isolated to one worker
- the offscreen container now reuses `options.html?offscreen=1` so Plasmo emits a real page for `chrome.offscreen.createDocument()`
- offscreen-specific settings reads and writes no longer touch `chrome.storage.local` directly; they bridge through background because that API is unavailable in offscreen documents

### 2.3 SQLite schema and sync model

Phase 1 SQLite tables now include:

- conversations
- messages
- topics
- notes
- annotations
- summaries
- weekly_reports
- explore_sessions
- explore_messages
- embeddings
- edges

Important implementation details:

- `conversations.uuid` is preserved in the read-model
- `conversations.origin_at` is persisted as a derived query column for ordering and range filtering
- SQLite indexes now cover `origin_at`, `platform + origin_at`, and `trash/archive + origin_at`
- embeddings are stored as raw `Float32` blobs
- similarity edges are materialized into `edges`
- worker-side `CLEAR_KNOWLEDGE_DATA` clears all read-model tables, not only a subset

### 2.4 Query-path rollout

Updated:

- `frontend/src/lib/db/repository.ts`
- `frontend/src/lib/services/searchService.ts`

SQLite read-model is now attempted first for:

- text search id lookup
- text search match summaries
- all-edge retrieval
- related-conversation retrieval
- library conversation listing with date/platform pushdown
- conversation-range listing used by weekly surfaces
- topic counts used to build the topic tree
- dashboard aggregate stats
- Explore semantic context retrieval after query embedding generation

If the read-model is unavailable or stale-sync fails, these paths fall back to Dexie.

### 2.5 UI pushdown changes

Updated:

- `frontend/src/sidepanel/containers/ConversationList.tsx`
- `frontend/src/sidepanel/pages/InsightsPage.tsx`

Behavioral changes:

- Library no longer fetches the whole conversation set and then applies date/platform filters only in React
- date presets are converted into `dateRange` before calling storage
- selected platforms are passed as `platforms[]` to storage
- weekly Insights conversation lists request `includeTrash: false` from storage, while preserving the existing UI guard
- front-end grouping labels such as `Started Today / Started This Week / Started Earlier` stay in the presentation layer

### 2.6 UI visibility and protocol alignment

Updated:

- `frontend/src/lib/types/index.ts`
- `frontend/src/sidepanel/components/DataManagementPanel.tsx`
- `frontend/src/lib/messaging/protocol.ts`

This adds:

- storage-engine status into the data overview snapshot
- migration/error visibility in the data-management panel
- `via: "background"` support on offscreen-routed explore messages touched by the forwarding change

## 3. Validation run during this handoff

Executed:

- `pnpm -C frontend build`
- `pnpm -C frontend exec tsc --noEmit`

Result:

- extension build passes
- no remaining TypeScript errors in the newly added storage-foundation files
- workspace still has unrelated baseline failures in `src/vendor/vesti-ui.ts`
- workspace also still has unrelated package-level missing module/type issues in `../packages/vesti-ui`

These baseline issues prevent using the current workspace typecheck as a full green gate for the entire repo, but the new storage code is no longer the source of TS failures.

## 4. Known limitations and follow-up items

### 4.1 Delta application is correct but heavy

`UPSERT_CONVERSATION_DELTA` currently reconstructs a synthetic snapshot from retained SQLite rows plus delta rows, then reuses `replaceSnapshot()`.

That keeps logic simple and correct for a first implementation, but it is heavier than a true table-local upsert path. A later pass should replace this with direct per-table updates.

### 4.2 Search is still substring-based

Phase 1 text search still uses substring matching semantics rather than SQLite FTS tables. This is acceptable for compatibility, but not the final ranking/search design.

### 4.3 Embedding generation is still on the existing route

Explore semantic retrieval now assembles context from SQLite, but query embedding generation still uses the existing embedding route and settings flow. This branch does not make embedding generation local or offline yet.

### 4.4 Edge rebuild is still batch-oriented

Edges are now materialized inside SQLite, which is a better ownership model than JS recomputation in dashboard code. However, rebuild remains batch-oriented after imports and deltas and may need smarter incremental maintenance later.

### 4.5 Runtime verification still needs extension smoke

This branch has code-level and type-level verification, but still needs manual extension validation for:

- offscreen creation on cold start
- worker re-open after extension reload
- OPFS availability in the target Chrome runtime
- Dexie fallback when SQLite bootstrap fails
- Gemini/Claude/ChatGPT capture after offscreen settings bootstrap, specifically verifying that no `Page failed to load.` or `STORAGE_UNAVAILABLE` errors remain
- Library date/platform filters still matching prior behavior after storage pushdown
- dashboard counts and topic counts staying aligned with Dexie results on the same dataset
- Explore scoped retrieval producing comparable sources and context drafts after the SQLite-first change

### 4.6 Platform constraints discovered during runtime validation

Runtime smoke uncovered two Chrome extension platform constraints that now shape this branch:

- `chrome.offscreen.createDocument()` must point at an emitted extension page; a source-only `offscreen.html` path is not enough in the current Plasmo build output
- offscreen documents have `chrome.runtime` messaging but do not expose `chrome.storage.local`, so any storage-backed settings or engine state accessed from offscreen must use a bridge or another owner context

## 5. Recommended next step

Keep this work on the current candidate branch while validating the runtime path in a real extension session.

If the flow is stable:

1. cut a minimal `codex/pr-*` branch from a clean baseline
2. move only the storage foundation slice needed for upstream review
3. keep broader experiments or follow-up optimizations off that PR branch

After that, the next engineering target should be local embedding generation as an optional path. That will do more for true offline Explore behavior than adding `sqlite-vec` before the generation side is local.
