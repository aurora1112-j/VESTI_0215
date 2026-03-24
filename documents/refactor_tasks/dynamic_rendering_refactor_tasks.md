# Dynamic Rendering Refactor Tasks

Status: Active implementation backlog
Audience: Frontend engineers, QA, maintainers

## Scope

这份任务单只记录实施切片，不重复 canonical contract。

动态渲染治理规则以这里为准：
- `documents/ui_runtime/ui_runtime_dynamic_rendering_contract.md`
- `documents/ui_runtime/ui_runtime_rendering_governance_checklist.md`

## Current Priority Order

1. 把 reader/footer 的 settled-content gate 稳定下来
2. 收口 entity-scoped disclosure reset，避免跨 conversation 泄漏展开状态
3. 识别高密度 disclosure surface，补充 smoke coverage
4. 给 Explore / Network 建立显式 render phase 模型
5. 逐步把巨石化 surface 下沉为可复用的 runtime shell

## Active Slices

### Slice 1: Reader settled-content gate

- sidepanel `ReaderView`
  - loading / building 仅显示 header、search nav、primary skeleton
  - footer 只在当前会话 primary content settled 后渲染
- web `LibraryTab`
  - collapsed preview / expanded transcript 共用 settled-content gate
  - footer disclosure 按 `selectedConversation.id` 重置

### Slice 2: Disclosure reset discipline

- 盘点所有 `details`、accordion、inline metadata、popover-like disclosure
- 标出哪些已经按 entity key 重置，哪些仍可能沿用旧状态
- 给高风险 surface 补最小 smoke 检查

### Slice 3: Explore runtime gating

- 建立 query-scoped render phase
- 拆开 loading / empty-final / no-match / error
- secondary counts 不再抢在结果列表前出现

### Slice 4: Network runtime gating

- 建立 graph-ready gate
- 时间标签、统计 badge 晚于 graph layout 稳定点出现
- 收口 network 时间 helper 与 reader/web 的分叉

### Slice 5: Shared runtime shell extraction

- 提取 shared reader shell
- 提取 shared disclosure/reset guidance
- 把 runtime gate 从单点 patch 升级成 shared implementation pattern

## Done When

- secondary metadata 不再在 loading 阶段抢占首屏
- entity 切换不会继承上一实体的 disclosure / expanded state
- Explore / Network 也具备明确的 primary-first gating
- 动态渲染规则不再分散在 `ui_refactor/`、`web_dashboard/`、零散 handoff 中
