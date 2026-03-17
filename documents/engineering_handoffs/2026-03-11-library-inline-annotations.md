# Library Reader Inline Annotations + Export Upgrade (v1.4-a)

Date: 2026-03-11
Repo: /Users/aurora/vesti_combine/worktrees/ui-v1.4-a
Branch: codex/ui-v1.4-a

## 1) Goal
Enable message-level annotations in Library Reader, upgrade them from “one per message” to a true append-only timeline, and add export paths to My Notes and Notion. Annotation text still participates in vectorization/search/graph via conversation-level text fusion, while Notion setup now uses an OAuth-based public integration flow with an in-app database picker.

## 2) Scope / Non-goals
- Scope: Library Reader UI + storage/contracts + IndexedDB schema + vectorization/search/export + Notion settings entry points in extension settings + proxy-local OAuth bridge for Notion public integration.
- Non-goals: new independent annotation vectors or graph nodes; background sync with Notion; CHANGELOG updates.

## 3) Data model & storage
- `annotations` added on top of the current upstream Dexie schema as v13
  - fields: `id`, `conversation_id`, `message_id`, `content_text`, `created_at`, `days_after`
  - indexes: `conversation_id`, `message_id`, `created_at`, `days_after`, `[conversation_id+message_id]`, `[conversation_id+created_at]`
  - migration maps legacy `content -> content_text` and computes `days_after`
- Repository APIs:
  - `listAnnotations(conversationId)`
  - `saveAnnotation({ conversationId, messageId, contentText })` (append-only)
  - `deleteAnnotation(annotationId)`
  - `getAnnotationExportContext(annotationId)`
- Messaging protocol additions:
  - `GET_ANNOTATIONS_BY_CONVERSATION`
  - `SAVE_ANNOTATION`
  - `DELETE_ANNOTATION`
  - `EXPORT_ANNOTATION_TO_NOTE`
  - `EXPORT_ANNOTATION_TO_NOTION`
- Storage API / vesti-web wiring updated to pass new methods into `@vesti/ui`.
- Deletion/clear coverage:
  - `deleteConversation` now clears `annotations` rows for the conversation.
  - `clearAllData` now clears `annotations` as a business table.

## 4) Vectorization + search
- `buildConversationText` and `buildConversationContext` append annotation text.
- `searchConversationIdsByText` scans `content_text` in addition to messages.
- Annotation create/delete triggers `requestVectorization()` to re-embed conversation text.

## 5) Library Reader UI behavior
- AI per-message collapse has been removed; only conversation-level expand/collapse remains.
- User messages use heavier typography.
- Message rows show:
  - no resting marker for unannotated messages
  - a subtle passive dot that stays visible when annotations exist
  - hover/focus affordance for opening the annotation panel
- Desktop no longer uses the right-side sticky annotation sidebar.
- Desktop annotation UI is now a popover anchored below the message action icon.
  - it is positioned inside the message-flow scroll container at the moment it opens
  - it may overlap the reader content instead of reserving layout width
  - it can be clipped by the message-flow scroll container while the conversation scrolls
  - it closes on outside click, `Esc`, or clicking the trigger again
- Narrow widths still use the bottom drawer fallback.
- The annotation surface now shows:
  - a light anchor preview with `You` or the concrete platform name
  - chronological saved annotations for the selected message
  - thin dividers between annotations instead of card stacking
  - hover-only row actions for `My Notes`, `Notion`, and `Delete` on desktop
  - a borderless bottom composer with placeholder `Comment...`
- Composer behavior:
  - `Cmd/Ctrl + Enter` saves immediately
  - leaving the whole surface auto-saves non-empty drafts
  - empty drafts are silently discarded on dismiss

## 6) Export format notes
- JSON export now includes `annotations` with ISO timestamps and `days_after`.
- TXT/MD exports now emit all annotations for a message, not just one.
- My Notes export aggregates into one export-managed note per conversation.
  - first export creates the note
  - later exports append new annotation sections into the same note
  - duplicate exports of the same annotation ID are ignored
  - duplicate detection now uses a hidden markdown comment marker, not a visible `Annotation ID` line
  - full transcript duplication was removed because note backlinks already return to the source conversation
  - anchor message labels render as `You` for user turns and the concrete conversation platform name for AI turns
- Notion export creates one page per selected annotation using an OAuth-backed access token + selected database.
- Default settings UX is now:
  - `Connect to Notion`
  - official OAuth browser flow
  - workspace status
  - searchable shared-database picker
  - `Disconnect`
- Legacy token/database settings are still read if already stored, but the manual token flow is no longer the default UI.

## 6.5) Notes preview policy
- My Notes preview uses markdown soft breaks (`breaks: true`) so a normal single Enter renders visibly.
- This is preview-only behavior; stored markdown semantics are unchanged.

## 7) Files touched (high-signal)
- `frontend/src/lib/db/schema.ts`
- `frontend/src/lib/db/repository.ts`
- `frontend/src/lib/messaging/protocol.ts`
- `frontend/src/lib/services/storageService.ts`
- `frontend/src/offscreen/index.ts`
- `frontend/src/background/index.ts`
- `frontend/src/lib/services/searchService.ts`
- `frontend/src/lib/services/exportSerializers.ts`
- `frontend/src/lib/services/annotationExportService.ts`
- `frontend/src/lib/services/notionSettingsService.ts`
- `packages/vesti-ui/src/notion-integration.ts`
- `packages/vesti-ui/src/tabs/library-tab.tsx`
- `frontend/src/sidepanel/pages/SettingsPage.tsx`
- `packages/vesti-ui/src/dashboard.tsx`
- `frontend/package.json`
- `proxy-local/server.mjs`
- `proxy-local/.env.example`
- `proxy-local/README.md`
- `packages/vesti-ui/src/types.ts`
- `vesti-web/lib/storageService.ts`
- `vesti-web/lib/types.ts`
- `vesti-web/app/page.tsx`

## 8) Manual QA checklist
- Reader loads conversation with icon-only annotation triggers and an always-visible passive dot on annotated rows.
- Desktop clicking the trigger opens a popover below the icon instead of a right-side panel.
- Multiple annotations can be saved against the same message and render chronologically.
- Annotation rows are separated by thin dividers and stay uncollapsed.
- Delete removes only the selected annotation card.
- `Cmd/Ctrl + Enter` saves, and clicking outside auto-saves non-empty drafts.
- Search / Explore: unique keyword in annotation returns conversation.
- Graph/related conversations reflect annotation updates after re-vectorization.
- `Export to My Notes` creates or appends to a linked note for the same conversation.
- `Export to Notion` works after OAuth connection and database selection are completed.

## 8.5) Notion real-account validation
1. Configure Notion as a public integration and register the proxy callback URI.
2. Create or pick a target database, then share it with the integration.
3. In Vesti Settings, click `Connect to Notion`.
4. Finish the official Notion OAuth flow and return to the extension.
5. Search for the shared database in the picker, then select it.
6. Export a saved annotation from Library Reader.
7. Confirm the database gets a new page with:
   - conversation-derived title
   - callout containing the truncated anchor message
   - annotation body
   - `days_after`, platform, and conversation date
8. Verify actionable failures for:
   - user-cancelled OAuth
   - expired OAuth session handoff
   - revoked or invalid token
   - database not shared with the integration
   - database search lag resolved by refresh after sharing

## 9) Follow-ups / Risks
- DB v13 migration upgrades legacy annotations and computes `days_after`; ensure upgrade path in existing installs.
- Any future bulk delete/clear paths should include `annotations`.
- If Notion API behavior changes, re-check the create-page/database-title-property contract.
- Notion OAuth requires proxy configuration (`NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`) before real-account validation can pass.
- My Notes aggregation still matches export-managed notes by content markers, so heavy manual rewrites may cause later exports to create a new note instead of appending.
