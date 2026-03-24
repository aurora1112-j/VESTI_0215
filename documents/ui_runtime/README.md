# UI Runtime Documentation Package

Status: Active canonical documentation tree for dynamic rendering governance
Audience: Frontend engineers, QA, maintainers

## Purpose

`documents/ui_runtime/` 是跨 sidepanel / web surface 的动态渲染治理入口。

它专门回答这些问题：
- shell ready 之后，primary content 何时允许出现
- secondary metadata 何时必须延后
- overlay / drawer / popover 何时才允许挂载
- entity 切换时哪些局部 UI state 必须重置
- motion / transition 可以依附哪些已稳定容器，不能依附哪些未稳定高度

## This directory owns

- 动态渲染 phase model
- loading / ready / overlay gate discipline
- entity-scoped UI state reset rules
- cross-surface rendering governance checklist

## This directory does not replace

- `documents/ui_refactor/`
  - global UI / IA / component-system decisions
- `documents/web_dashboard/`
  - web-only module boundaries and contracts
- `documents/reader_pipeline/`
  - reader/export/compression/schema-consumer contract

## Files

- `ui_runtime_dynamic_rendering_contract.md`
  - canonical phase model and rendering rules
- `ui_runtime_rendering_governance_checklist.md`
  - hotspot inventory, risk summary, recommended gates, and refactor slices

## Recommended reading order

1. `ui_runtime_dynamic_rendering_contract.md`
2. `ui_runtime_rendering_governance_checklist.md`
3. `../refactor_tasks/dynamic_rendering_refactor_tasks.md`

## Current trigger examples

以下问题应默认进入本目录：
- “为什么某个 footer / badge / metadata 在 loading 时先跳出来”
- “为什么换实体后沿用了上一条会话的 disclosure 状态”
- “为什么 overlay 抢在 anchor 稳定前出现”
- “为什么某段动画建立在未稳定内容高度上，导致抖动或闪烁”
