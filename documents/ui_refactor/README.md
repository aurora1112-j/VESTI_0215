# Vesti UI Refactor Spec Package

Status: Active canonical UI refactor directory
Owner: Frontend + UI Design + QA

## What this directory covers

This directory stores canonical UI interaction, information architecture, and state-topology specifications for extension-owned surfaces.

It is the correct home for:
- Threads / Reader interaction contracts
- sidepanel UI state topology
- feature-specific UI refactor specs and state-machine contracts
- UI debugging and manual acceptance guidance
- global IA and component-system rules

It is not the correct home for:
- capture / parser DOM normalization strategy (`documents/capture_engine/`)
- web-surface-specific runtime/productization specs (`documents/web_dashboard/`)
- cross-surface dynamic rendering governance (`documents/ui_runtime/`)
- floating capsule feature specs (`documents/floating_capsule/`)

## Active canonical entries

- `markdown_note_editor_and_obsidian_import_spec.md`
  - Canonical Library notes contract for the shared CodeMirror Markdown editor, richer note schema, and Obsidian vault export-first behavior.
- `threads_search_engineering_spec.md`
  - Canonical engineering spec for Threads search contract upgrade, list highlight, Reader navigation, and phased delivery boundaries.
- `threads_search_state_machine_contract.md`
  - Canonical state topology and data contract for lifted `SearchSession`, lightweight offscreen summaries, and Reader occurrence navigation.

## Supporting references

- `ui_refactor_debugging_playbook.md`
  - UI refactor debugging and regression workflow shared by engineering and QA.
- `ui_refactor_manual_sampling_and_acceptance.md`
  - Manual sampling matrix, evidence expectations, and Go/No-Go gates.

## Relationship with `ui_runtime/`

动态渲染、状态门控、加载到 ready 的过渡纪律、以及 entity-scoped disclosure / local UI state reset，已经统一迁到 `documents/ui_runtime/`。

判断方法：
- 如果问题在问“这个 surface 应该先显示什么、后显示什么、何时允许 secondary metadata / overlay 出现”，去 `ui_runtime/`
- 如果问题在问“这个功能的交互结构、信息架构、状态机边界是什么”，留在 `ui_refactor/`

## Existing versioned spec tracks

- `v1_4_information_architecture_contract.md`
  - v1.4 information architecture contract for four-zone boundaries, naming, and route semantics.
- `v1_4_settings_information_density_contract.md`
  - v1.4 Settings information density contract.
- `v1_4_ui_refactor_engineering_spec.md`
  - v1.4 global UI refactor engineering spec.
- `v1_4_ui_refactor_component_system_spec.md`
  - v1.4 component system and visual token contract.
- `v1_4_library_annotation_storage_and_export_spec.md`
  - v1.4 Library annotation storage and export contract.
- `v1_4_library_split_note_workspace_spec.md`
  - v1.4 Library split note workspace contract for split layout, extraction flow, and autosave behavior.
- `v1_8_1_insights_ui_refactor_spec.md`
  - v1.8.1 Insights refactor specification.
- `v1_8_1_insights_state_machine_contract.md`
  - v1.8.1 Insights state machine contract.
- `v1_8_1_insights_manual_sampling_and_acceptance.md`
  - v1.8.1 Insights manual sampling and acceptance guide.
- `v1_8_2_thread_summary_ui_refactor_spec.md`
  - v1.8.2 Thread Summary full-stack UI refactor spec.
- `v1_8_2_thread_summary_state_machine_contract.md`
  - v1.8.2 Thread Summary state machine contract.
- `v1_8_2_thread_summary_manual_sampling_and_acceptance.md`
  - v1.8.2 Thread Summary manual sampling and acceptance guide.

## Naming and version policy

- Release versions continue to use `vX.Y.Z` and `vX.Y.Z-rc.N`.
- New canonical UI refactor documents should prefer topic-based filenames over new pseudo-release prefixes.
- Existing `v1_4_*`, `v1_8_1_*`, and `v1_8_2_*` files remain as historical and still-valid versioned materials; they are not renamed in this pass.
- Cross-domain parser/capture dependencies must reference `documents/capture_engine/`.
- Dynamic rendering governance must reference `documents/ui_runtime/`.
