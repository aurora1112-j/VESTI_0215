# Orchestration Documentation Package

Status: Active canonical documentation tree for generic runtime orchestration contracts  
Audience: Runtime engineers, release owners, QA

## Purpose

`documents/orchestration/` now exists to hold cross-product runtime contracts only.

It owns:
- generic pipeline progress/event contracts
- generic tool-trace contracts
- runtime-facing orchestration semantics that can be shared across features

It does not own:
- export prompt artifact design
- Insights feature-specific product architecture
- Explore product-specific UI flow design
- dated rollout narratives for legacy product lines

## Active canonical docs

- `README.md`
- `v1_7_runtime_event_contract.md`
- `tool_trace_contract.md`

## Legacy references

Older product-specific orchestration specs now live under:
- `documents/archive/orchestration/legacy_insights/`
- `documents/archive/orchestration/legacy_explore/`

Those files remain useful as historical implementation references, but they are not active canonical docs.