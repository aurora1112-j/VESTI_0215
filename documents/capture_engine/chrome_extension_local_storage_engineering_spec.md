# Chrome Extension Local Storage Engineering Spec

Status: Active baseline  
Audience: Runtime engineers, capture/search maintainers, dashboard and data-management contributors  
Scope: Local-first persistence and query execution inside the Chrome extension runtime

## 1. Summary

Vesti remains a Chrome extension first. The local storage roadmap therefore treats Dexie as the authoritative capture store in the near term while introducing a SQLite read-model for query-heavy paths.

The storage foundation is now split into two internal roles:

- `ArchiveStore`
  - authoritative local archive for capture, dedupe, notes, annotations, summaries, and exports
  - phase 1 implementation: Dexie / IndexedDB
- `KnowledgeQueryStore`
  - query-optimized local read-model for text search, related-conversation retrieval, and materialized similarity edges
  - phase 1 implementation: SQLite WASM on OPFS, owned by a single offscreen worker

This spec defines the runtime ownership boundary, storage roles, migration rules, and rollout order for that split.

Phase status in this version:

- phase 1 foundation landed:
  - offscreen owns worker lifecycle
  - SQLite + OPFS read-model is initialized, migrated, validated, and rebuildable
  - text search and relationship queries are SQLite-first
- phase 2 query rollout landed:
  - library conversation listing and date/platform filtering are SQLite-first
  - topic counts and dashboard aggregates are SQLite-first
  - Explore weekly-range retrieval and semantic context assembly are SQLite-first after query embedding generation

## 2. Product and engineering boundary

### In scope

- keep the extension fully local-first
- preserve the current `StorageApi` contract for UI consumers
- keep Dexie as the authoritative write path for capture and data mutation
- introduce SQLite + OPFS as a read-model for query-dense paths
- make offscreen the only runtime owner for storage execution outside Dexie authoring code
- make edge materialization a database concern instead of repeated JS graph reconstruction

### Out of scope for this spec version

- replacing Dexie as the authoritative write engine
- user-visible `.sqlite` file management
- companion app or desktop-shell packaging
- FTS, compressed vectors, or user-managed file export workflows
- artifact, attention-signal, or interaction-event persistence rollout

## 3. Runtime ownership model

### 3.1 Background responsibilities

`background` is a coordinator only.

It may:

- call `setupOffscreenDocument()`
- forward runtime messages addressed to `target: "offscreen"`
- report bootstrap and forwarding failures
- run background-only tasks such as scheduling and vectorization triggers

It must not:

- execute repository or search business logic that is owned by offscreen
- open SQLite directly
- duplicate request handling that is already addressed to offscreen

### 3.2 Offscreen responsibilities

The offscreen document is the single owner of storage execution for offscreen-targeted requests.

It must:

- be created explicitly through `chrome.offscreen.createDocument()`
- remain the only runtime context that handles forwarded `target: "offscreen"` requests
- bootstrap one storage worker for SQLite / OPFS access
- keep Dexie-authoritative writes and SQLite read-model sync in the same runtime domain

### 3.3 Worker responsibilities

All SQLite and OPFS access must happen inside one worker created by the offscreen document.

The worker owns:

- SQLite initialization
- OPFS VFS setup
- schema creation and compatibility columns
- full snapshot imports
- conversation-scoped delta upserts
- materialized edge rebuilds
- read-model query execution

No UI context, content script, or background context should access SQLite directly.

## 4. Storage roles

### 4.1 ArchiveStore

`ArchiveStore` is the authoritative archive and mutation source.

Phase 1 implementation details:

- backing store: Dexie / IndexedDB
- owns capture persistence
- owns dedupe and update semantics
- remains the source for exports
- remains the source of truth when SQLite is unavailable or invalid

### 4.2 KnowledgeQueryStore

`KnowledgeQueryStore` is a local read-model fed from the authoritative archive.

Phase 1 implementation details:

- backing store: SQLite WASM + OPFS
- booted from the offscreen document through a worker
- synchronized from Dexie snapshots and conversation deltas
- used only for query-dense paths first
- treated as disposable and rebuildable from Dexie

## 5. Phase 1 schema boundary

Phase 1 SQLite tables:

- `conversations`
- `messages`
- `topics`
- `notes`
- `annotations`
- `summaries`
- `weekly_reports`
- `explore_sessions`
- `explore_messages`
- `embeddings`
- `edges`

Important phase 1 notes:

- `conversations` must preserve `uuid` in addition to platform/title/time metadata
- `conversations` also persist a derived `origin_at` query column defined as `COALESCE(source_created_at, first_captured_at, created_at)`
- `conversations` maintain SQLite indexes on `origin_at`, `(platform, origin_at)`, and `(is_trash, is_archived, origin_at)`
- `embeddings` currently support `target_type = 'conversation'` only
- embeddings are stored as raw `Float32` blobs in phase 1
- `edges` are materialized from embeddings inside SQLite

Explicitly deferred from phase 1:

- `artifacts`
- `attention_signals`
- `interaction_events`
- compressed vector storage
- FTS-specific search tables

## 6. Engine state and migration rules

SQLite rollout state is stored in `chrome.storage.local`.

Tracked fields:

- `activeEngine`
- `migrationState`
- `snapshotWatermark`
- `appliedWatermark`
- `lastError`

Default posture:

- `activeEngine = dexie`
- Dexie remains authoritative even after SQLite becomes query-ready

### 6.1 Initial migration

The first migration follows this sequence:

1. initialize worker and SQLite / OPFS
2. export a full snapshot from Dexie
3. import that snapshot into SQLite
4. validate record counts and spot-check digest
5. mark the read-model ready only after validation passes

### 6.2 Steady-state sync

After initialization:

- conversation-scoped writes mark affected conversation ids as dirty
- broad mutations mark the read-model for a full snapshot refresh
- a watermark in `chrome.storage.local` tracks whether pending Dexie changes have been applied
- query entrypoints flush pending changes before using SQLite

### 6.3 Failure policy

If SQLite init, import, validation, or sync fails:

- record the latest error in `chrome.storage.local`
- fall back to Dexie reads
- do not block capture or other authoritative writes
- keep the UI contract stable

The read-model must be treated as rebuildable, not mission-critical.

## 7. Query rollout

Phase 1 SQLite reads were limited to hot paths where JS scans or O(n^2) graph work were the weakest fit.

Initial read-model consumers:

- `searchConversationIdsByText`
- `searchConversationMatchesByText`
- `findAllEdges`
- `findRelatedConversations`

Phase 2 extends SQLite-first reads into library and Explore query surfaces without changing UI contracts.

Current additional read-model consumers:

- `listConversations`
- `listConversationsByRange`
- `getTopics`
- `getDashboardStats`
- `retrieveRagContext`

Current UI pushdown rules:

- library date presets are converted to `dateRange` before storage calls
- library multi-platform filters are passed as `platforms[]`
- Insights weekly lists call `getConversations({ dateRange, includeTrash: false })`
- grouping labels such as `Started Today / This Week / Earlier` remain presentation logic in the UI

Current boundaries that still must not move:

- capture writes
- authoring mutations
- export generation
- LLM / embedding generation routing

Near-term rollout order after this phase:

1. tighten incremental sync so conversation and metadata changes avoid heavy snapshot-style refreshes
2. move more weighted ranking and aggregate queries into SQLite
3. consider FTS or vector extensions only after current SQL-first query rollout is stable

## 8. Clear, export, and recovery rules

- `clearAllData()` must clear both Dexie and SQLite read-model tables
- export continues to come from Dexie authoritative data in phase 1
- LLM and other local settings stored in `chrome.storage.local` are not part of the read-model clear path
- an empty SQLite read-model after clear is still a valid ready state if Dexie is also empty

## 9. Search and graph semantics

Phase 1 preserves current functional behavior while changing execution strategy.

Allowed phase 1 simplifications:

- text search may continue to use substring matching instead of FTS
- edge reasons may remain coarse, for example `embedding_similarity`
- edge rebuild can remain batch-oriented after imports or deltas

Required phase 1 improvement:

- Network and related-conversation retrieval must stop depending on repeated Dexie vector scans plus ad hoc JS edge construction as the primary path

## 10. Future phases

### Next candidates inside the extension

- add local embedding generation as an optional path so new vectors can be created offline
- tighten delta sync and table-local upserts to reduce write amplification
- evaluate FTS tables for text search ranking once current substring compatibility is no longer required
- evaluate `sqlite-vec` or another ANN path only after local embedding generation and query contracts are stable
- add materialized scores, time-decay ranking, and richer edge reasons beyond pure vector similarity

### Product-shape escalation path

- consider a companion app only if the product needs user-visible local files, larger indexing workloads, or desktop-grade lifecycle control

## 11. Historical note

This spec intentionally preserves the local-first extension shape:

- UI consumers still talk to the same `StorageApi`
- Dexie remains authoritative for now
- SQLite is introduced as a rebuildable read-model rather than a product-shape change

Any future move to companion apps or user-managed SQLite files requires a new spec rather than silently extending this one.
