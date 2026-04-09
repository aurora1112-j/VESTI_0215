# v1.4 Library Split Note Workspace Spec

Status: Active canonical contract  
Owner: Frontend + Library  
Track: `v1.4`

## Summary

- Library keeps the existing single-workspace `conversations` and `notes` modes.
- Desktop widths add a `split` workspace with a conversation reader on the left and a conversation-linked note editor on the right.
- Users can enter split in two ways:
  - explicit `Split View`
  - first successful text extraction from the reader into a note
- Split is sticky for the current Library session until the user explicitly exits it.

## Layout Contract

- The current left navigation rail plus middle list column are treated as one `navigation group`.
- In split, that `navigation group` is hidden by default instead of permanently occupying width.
- A low-distraction toggle remains in the upper-left corner and opens the navigation group as an overlay.
- Closing the overlay does not resize or push the reader and note panes.
- Split is enabled only at `lg+`; narrower widths fall back to the existing single-workspace flow.

## Conversation-Centric Note Flow

- Split is optimized for reading the current conversation while maintaining that conversation's note.
- Target note resolution:
  - if the currently selected note is already linked to the current conversation, continue writing into it
  - otherwise reuse the most recently updated linked note for that conversation
  - if no linked note exists, create one on first import or extraction
- Split is not a general two-pane note browser; full `My Notes` browsing stays in the existing single-workspace notes mode.

## Selection Extraction

- Extraction only listens for valid text selections inside a single message body in the reader.
- When a valid selection exists, a lightweight floating action appears near the selection and:
  - ensures the target note has been resolved or created
  - enters split automatically
  - appends the selected text into the right-side note
- Appended content uses lightweight plain text:
  - add one blank line first if the note is not empty
  - append only the selected excerpt body
- This iteration does not add a separate excerpt or anchor persistence table.

## Note Editing Contract

- The split note editor shares the same single CodeMirror Markdown editor surface used by `My Notes`.
- The split note editor uses real debounced autosave rather than waiting for `onBlur`.
- Title and body share the same autosave cycle.
- Default debounce window is approximately `700-800ms`.
- Pending changes must flush before:
  - switching conversations
  - switching notes
  - exiting split
  - component unmount
- Split note resolution only considers `native` notes; imported Obsidian notes do not become conversation notes.
- The split note header/footer controls in this iteration include:
  - save status
  - `Exit Split`
  - `Delete Note`
- Note-level Notion export, Obsidian vault export, and note archive are out of scope for split in this pass; those actions remain in `My Notes`.

## Existing Library Feature Compatibility

- The annotation popover and drawer contract remains unchanged.
- Annotation `My Notes` and `Notion` export stays message-level and one-shot.
- `Import to Notes` resolves or creates the conversation note and enters split; when no note exists yet, it may seed the first note content from conversation-derived material.

## Validation

1. `Split View` opens the two-pane workspace.
2. Text extraction enters split automatically and appends the excerpt.
3. The navigation group hides by default in split, can be reopened via the toggle, and auto-closes after selecting a conversation.
4. Autosave persists through the existing `updateNote` path so content survives refreshes and conversation switches.
5. Deleting the current split note keeps the reader usable and shows the right-side `Create Conversation Note` empty state.
