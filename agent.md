# Vesti Public Collaboration Boundary

This public file keeps only the stable collaboration boundaries that are safe to sync to `main`.

## Purpose

- define public engineering expectations for contributors and agents
- point readers to the current canonical documentation
- avoid exposing local environment traces or maintainer-only operating detail

## Public Rules

1. Preserve the Local-First architecture.
   - Host DOM is parsed locally and stored locally.
   - Do not introduce remote data dependencies without an explicit product reason.
2. Respect layer boundaries.
   - parser / capture logic
   - service and messaging coordination
   - UI and consumer rendering
3. Keep parser work platform-scoped.
   - A parser change for one host should not silently alter another host's contract.
4. Treat canonical docs as the public source of truth.
   - `documents/capture_engine/`
   - `documents/reader_pipeline/`
   - `documents/prompt_engineering/`
   - `documents/web_dashboard/`
   - `documents/refactor_tasks/`
5. Keep public artifacts sanitized.
   - Do not commit local auth state, personal paths, raw operator sample locations, or private release notes.
