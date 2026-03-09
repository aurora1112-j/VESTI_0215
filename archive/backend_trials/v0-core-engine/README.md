# Vesti Backend MVP (GPT + Claude)

This folder contains the first MVP backend trial for the Vesti browser extension.
The goal is to implement a local-first core engine that captures ChatGPT and
Claude conversations via DOM parsing and stores them in IndexedDB through an
Offscreen Document (MV3-compliant).

Key principles:
- Local-first data flow: Host DOM -> Content Script -> Offscreen IndexedDB
- Strict TypeScript types (no `any`)
- Layered architecture with clear module boundaries
- Service layer matches frontend `mockService` signatures

Structure highlights:
- src/core: Observer + Parser + Pipeline
- src/db: Dexie schema and repository helpers
- src/offscreen: DB host + message handler
- src/background: message router + offscreen lifecycle
- src/services: UI-facing storage service
- tests: parser fixtures and dedup tests

This is a trial backend and is not yet wired into a full Plasmo extension.

## Scripts
- npm test (vitest)
- npm run typecheck
