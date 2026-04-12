# Markdown Note Editor And Obsidian Export Spec

Status: Active canonical contract  
Owner: Frontend + Library  
Track: mainline preview

## Summary

- Library notes remain IndexedDB-backed. The canonical note body is still stored in Dexie, not in vault files.
- `My Notes` and split `Conversation Note` both edit inside one shared CodeMirror 6 Markdown editor surface.
- The note model preserves richer source metadata and now also stores per-note Obsidian export mapping.
- Obsidian integration for this pass is export-first:
  - users choose a local Obsidian vault directory from the note-level export action
  - local notes export into `Vesti/`
  - imported Obsidian notes can export back to their known relative path when the chosen vault matches
- Obsidian import and sync are explicitly deferred as primary UX for a later pass.

## Note Data Model

`Note`

```ts
type NoteSourceType = "native" | "obsidian"

interface Note {
  id: number
  title: string
  content: string
  excerpt: string
  hash: string
  created_at: number
  updated_at: number
  linked_conversation_ids: number[]
  source_type: NoteSourceType
  source_path: string | null
  import_meta: NoteImportMeta | null
  obsidian_export: NoteObsidianExportMeta | null
}
```

`NoteObsidianExportMeta`

```ts
interface NoteObsidianExportMeta {
  vault_id: string
  relative_path: string
  last_exported_at: number
}
```

Rules:
- Dexie remains the source of truth for note content.
- `excerpt` is a persisted cache derived from Markdown with frontmatter removed and syntax softened.
- `hash` is the SHA-256 hash of persisted `content`.
- `source_path` remains null for native notes unless the note originated from Obsidian import.
- `obsidian_export` stores the last successful export target path for stable re-export.

## Editor Contract

- Notes no longer switch between `textarea` and HTML preview.
- The editor has three explicit behavior states:
  - static:
    - render inactive top-level Markdown blocks as preview HTML for headings, paragraphs, lists, blockquotes, tables, and horizontal rules
    - keep inactive inline emphasis, link labels, and task markers visually softened inside raw blocks that are not promoted to full block preview
    - render inline and block LaTeX with KaTeX
  - active:
    - keep the current active block in raw Markdown so users edit source directly
    - reveal Markdown markers for the current active line or active syntax node only
    - keep surrounding blocks in static preview state
  - raw:
    - top YAML frontmatter always stays raw
    - fenced code blocks always stay raw
    - unsupported or plugin-specific syntax stays raw
- Code blocks are not rendered as preview in this pass; they remain fence-based editing surfaces with clearer styling.

## Layout And Typography Contract

- The note editor body uses the reading UI font stack with stable CJK coverage.
- Monospace is limited to inline code, fenced code, and frontmatter/code metadata.
- The note detail pane stays width-stable and caps readable content width inside the editor surface.
- Wrapping rules must prevent long mixed Chinese/English lines or URLs from visually overlapping.
- Decorations must not use block-level styles that distort ordinary paragraph line boxes.

## Draft And Persistence Contract

- The editor owns draft state while the repository owns persisted state.
- Autosave remains debounced at approximately `750ms`.
- Pending draft changes must flush before:
  - switching notes
  - switching conversations
  - entering or exiting split
  - component unmount
  - explicit `Cmd/Ctrl + S`
- Repository writes recompute `title`, `excerpt`, `hash`, and `updated_at`.

## Title And Frontmatter Contract

- The top title field remains visible above the editor.
- If the note starts with YAML frontmatter and contains `title`, the top title field edits `frontmatter.title`.
- If the note does not have top-level YAML frontmatter, the top title field edits the standalone `note.title`.
- Removing `frontmatter.title` falls back to the standalone title field instead of forcing H1-driven title persistence.

## Split Workspace Contract

- Split continues to resolve conversation-linked notes only from `native` notes.
- Imported Obsidian notes never participate in `ensureConversationNote` resolution.
- Split uses the shared editor and shared autosave behavior.
- Vault connection and Obsidian export actions live in `My Notes`, not in the split workspace controls.

## Obsidian Export Contract

- `My Notes` exposes one per-note `Export to Obsidian` action in the selected note detail pane between the editor and `Linked Conversations`.
- Each export attempt opens the browser directory picker so the user can choose the destination vault folder at the moment of export.
- Export target resolution:
  - if a note already has `obsidian_export` for the chosen vault, reuse that path
  - otherwise, if the note originated from Obsidian and the chosen vault matches by id or name, reuse the note's relative source path
  - otherwise export to `Vesti/<sanitized-title>.md`
  - if a new local export path collides before mapping exists, create a suffixed filename instead of overwriting
- Successful export updates `obsidian_export` but does not change note content ownership.
- Export feedback appears only as transient helper text below the export button.
- If directory permission is denied or the picker is cancelled, export is blocked and the UI shows a transient error below the export button.

## Validation

1. Mixed Chinese and English note content wraps cleanly without overlap.
2. Regular notes and split notes both render through the shared CodeMirror editor.
3. Heading, emphasis, task, link, and LaTeX rendering behave according to the static/active/raw contract.
4. Fenced code blocks and frontmatter remain raw.
5. Autosave flushes on idle, note switch, conversation switch, split enter/exit, unmount, and `Cmd/Ctrl + S`.
6. Inactive Markdown blocks render as preview HTML while the active block remains editable raw Markdown.
7. Choosing an Obsidian vault directory from the export action succeeds on supported browser surfaces.
8. Local notes export to `Vesti/` inside the chosen vault.
9. Imported notes export back to their known relative path when the chosen vault matches.
10. Re-export reuses the established export path instead of silently branching new files.

## Out Of Scope

- Making vault files the canonical storage medium for notes.
- A full Obsidian sync engine.
- Replacing code fences with rendered code-block preview.
- Plugin execution or semantic emulation beyond raw preservation.
