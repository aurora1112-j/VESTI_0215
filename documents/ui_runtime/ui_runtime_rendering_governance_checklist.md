# UI Runtime Rendering Governance Checklist

Status: Active governance checklist
Audience: Frontend engineers, QA, maintainers

## Summary

这份清单记录当前最容易出现动态渲染漂移的热点 surface。
每一项都明确：
- 当前风险
- 推荐 gate
- 局部状态重置点
- 后续 refactor slice

## 1. Sidepanel `ReaderView`

### Current risk

- conversation 壳数据先到时，footer 这类 secondary metadata 会提前出现
- disclosure state 可能从上一条会话泄漏
- loading / building / ready 三阶段的可见内容边界不够明确

### Recommended gate

- `shell_ready`: header、back button、search nav 壳、loading skeleton
- `primary_loading`: 只保留 message skeleton，不挂 footer
- `primary_ready`: transcript / empty-final state
- `secondary_ready`: timestamp footer

### Reset point

- `conversation.id` 切换时，footer disclosure 必须重置
- `refreshToken` 驱动重新加载时，不得复用旧的 ready 状态冒充当前会话已稳定

### Follow-up refactor slice

- 把 `ReaderView` 的 render phase gate 提取成 reader shell-level helper
- 让 footer / empty state / search nav 共享同一个 settled-state contract

## 2. Web `LibraryTab`

### Current risk

- collapsed preview 与 expanded transcript 共享一套消息加载流程，但 secondary metadata 容易在 loading 期间先出现
- `LibraryTab` 巨石化导致 reader patch 很容易误触 summary / notes / annotation 区域
- annotation overlay 与 transcript / footer 容器耦合过深时，点击层和显示时机容易互相污染

### Recommended gate

- `shell_ready`: title row、platform、message count、layout shell
- `primary_loading`: preview placeholder / transcript loading row
- `primary_ready`: collapsed preview text 或 expanded transcript
- `secondary_ready`: timestamp footer
- `overlay_active`: annotation panel

### Reset point

- `selectedConversation.id` 切换时重置 footer disclosure
- annotation active message / popover anchor 必须在会话切换时清空

### Follow-up refactor slice

- 把 detailed reader 从 `LibraryTab` 中下沉成独立子组件
- 拆出 annotation surface orchestration，避免 reader / overlay / notes 继续揉在一个文件里

## 3. `ExploreTab`

### Current risk

- 结果列表、预览卡、筛选器和空态如果没有统一 phase model，很容易在 loading / no-result / error 三种状态之间抖动
- 低优先级统计信息可能抢在真正结果前出现

### Recommended gate

- `shell_ready`: filter chrome、search shell
- `primary_loading`: result skeleton
- `primary_ready`: result list / empty-final state
- `secondary_ready`: low-priority counts、supplementary metadata

### Reset point

- query / filter identity 切换时重置 expanded result、hover affordance、selection state

### Follow-up refactor slice

- 给 Explore surface 建独立的 query-scoped render state，而不是让多个局部 loading flag 并列漂移

## 4. `NetworkTab`

### Current risk

- 网络图布局、时间轴、统计标签如果共享不稳定数据源，容易出现先画节点、再改时间、最后改标签的阶段性抖动
- 时间 helper 在 network 里仍有分叉，容易和 reader / web 对同一时间字段作不同解释

### Recommended gate

- `shell_ready`: graph shell、filter shell
- `primary_loading`: graph placeholder / loading banner
- `primary_ready`: stable graph layout
- `secondary_ready`: derived badges、auxiliary time labels、density stats

### Reset point

- graph scope、time window、selected node 变更时重置局部 hover / selection / drawer state

### Follow-up refactor slice

- 收敛 network 时间语义 helper
- 为 graph layout 引入稳定数据就绪点，避免布局和标签二次抢位

## 5. High-density disclosure surfaces

### Current risk

- accordion、inline metadata、popover trigger、details/summary 等 disclosure surface 很容易在 entity switch 时继承旧状态
- secondary information 过早挂载时，会直接抢占首屏或扰乱滚动起点

### Recommended gate

- disclosure 只在对应实体的 primary content settled 后挂载
- disclosure open state 按实体键重置

### Reset point

- 任何列表项切换、conversation 切换、message anchor 切换都应视作 reset signal

### Follow-up refactor slice

- 为常见 disclosure 模式整理一套 shared helper / component guidance
- 把 “entity-keyed disclosure reset” 纳入 smoke checklist
