# v1.4 Library Annotation Storage and Export Spec

Status: candidate
Owner: Frontend + Library Reader
Track: `v1.4` candidate `codex/ui-v1.4-a`

## Summary
- Library Reader annotations are stored in a dedicated IndexedDB `annotations` table.
- A single message can hold multiple saved annotations.
- Saved annotations remain append-only in this round.
- Annotation text participates in the existing conversation-level retrieval and graph refresh path.
- Each saved annotation can be exported to:
  - `My Notes` as a conversation-linked local note with appended annotation sections
  - `Notion` as a one-shot page export into a database selected after OAuth connection

## Data Contract

`Annotation`

```ts
interface Annotation {
  id: number
  message_id: number
  conversation_id: number
  content_text: string
  created_at: number
  days_after: number
}
```

Rules:
- `id` is a numeric Dexie primary key.
- `days_after` is computed on write with:
  - `floor((annotation.created_at - conversation.created_at) / 86400000)`
  - negative values clamp to `0`
- The migration from the previous schema maps:
  - `content -> content_text`
  - removes single-message overwrite behavior

## Runtime Interface
- Storage API:
  - `getAnnotationsByConversation(conversationId)`
  - `saveAnnotation({ conversationId, messageId, contentText })`
  - `deleteAnnotation(annotationId)`
  - `exportAnnotationToNote(annotationId)`
  - `exportAnnotationToNotion(annotationId)`
- `saveAnnotation` always appends a new annotation row.
- `deleteAnnotation` removes only the selected annotation row.

## Reader Behavior
- Conversation rows show an icon-only annotation affordance.
- Annotated messages display a subtle passive dot in the action zone.
- The passive dot stays visible at rest; hover/focus reveals the open annotation affordance.
- The resting state does not show a count badge.
- On desktop, clicking the annotation affordance opens a lightweight popover anchored below the trigger icon.
- The desktop popover is positioned inside the message-flow scroll container at its opened coordinates.
- It may overlap message content, does not reserve layout width beside the reader, and can be clipped by the reader scroll container while the conversation scrolls.
- On narrow widths, the same annotation surface falls back to a bottom drawer.
- Opening the annotation surface shows:
  - a light anchor preview with `You` or the real platform name
  - a chronological annotation timeline for the selected message
  - thin dividers between annotations, with no collapse model
  - a minimal composer at the bottom
- The composer:
  - uses a borderless textarea with placeholder `Comment...`
  - saves on `Cmd/Ctrl + Enter`
  - auto-saves and closes when focus leaves the whole surface
  - silently discards empty drafts on dismiss
- Each saved annotation row supports:
  - `My Notes`
  - `Notion`
  - `Delete`
  - row actions stay hidden until hover/focus on desktop, and remain visible in the drawer fallback

## Retrieval and Export
- Annotation text is fused into the existing conversation-level text builders used by:
  - full-text search
  - conversation embedding refresh
  - related conversation graph
- No annotation-level vector table or standalone graph node model is introduced in this round.
- `My Notes` export aggregates annotations into one local note per conversation and includes:
  - conversation title
  - platform
  - conversation date
  - source URL when available
  - per-annotation sections containing the full anchor message, annotation body, and `days_after`
  - anchor speaker labels use `You` for user messages and the real conversation platform name for AI replies
- repeated exports from the same conversation append new sections instead of creating duplicate notes
- linked conversation backlink only; no duplicated full transcript block
- duplicate-export detection uses hidden annotation markers rather than a visible `Annotation ID` line
- `Notion` export creates one page per selected annotation and includes:
  - title property resolved from the target database
  - callout with the anchor message truncated to 100 characters
  - annotation body
  - `days_after`
  - platform
  - conversation date
- `My Notes` aggregation currently identifies its export-managed note by content markers rather than durable schema metadata.
  - existing notes are not lost
  - if the user heavily rewrites that note structure, later exports may create a new note instead of appending

## Settings Contract
- Notion integration settings are stored locally in `chrome.storage.local` under a dedicated key.
- Fields:
  - `authMode: "oauth_public" | "legacy_manual" | "disconnected"`
  - `accessToken`
  - `workspaceId`
  - `workspaceName`
  - `selectedDatabaseId`
  - `selectedDatabaseTitle`
  - `updatedAt`
- Default UX:
  - `Connect to Notion`
  - official OAuth browser flow
  - in-app database picker backed by Notion search
  - export disabled until both workspace connection and database selection are complete
- Backward compatibility:
  - previously saved `notionToken` / `notionDatabaseId` values are still read and normalized as `legacy_manual`
  - legacy manual settings are treated as migration compatibility, not the default interaction path
- OAuth bridge:
  - proxy routes:
    - `GET /api/notion/oauth/start`
    - `GET /api/notion/oauth/callback`
    - `GET /api/notion/oauth/session/:sessionId`
  - extension auth entry uses `chrome.identity.launchWebAuthFlow`
- Export remains manual and one-shot only.

## Notes Preview
- My Notes preview uses markdown soft line breaks.
- A normal single Enter should render as a visible line break in preview.
- Stored markdown source remains unchanged.

## Notion Validation Flow
1. Create a Notion public integration and register the proxy HTTPS callback URI.
2. Create or choose a target database in Notion.
3. Share that database with the integration.
4. In Vesti Settings, click `Connect to Notion`.
5. Complete the official Notion OAuth flow and return to the extension.
6. Use the in-app picker to search for and select the shared database.
7. In Library Reader, save an annotation and export it via `Notion`.
8. Confirm the target database receives a new page containing:
   - the conversation-derived title
   - a callout with the truncated anchor message
   - the annotation body
   - `days_after`, platform, and conversation date
9. Negative checks:
   - user cancels OAuth and sees a reconnectable message
   - session handoff expires and prompts a fresh connection
   - no database is selected, so export stays disabled
   - revoked or invalid token clears local auth state and prompts reconnect
   - unshared database does not appear until it is shared and refreshed
