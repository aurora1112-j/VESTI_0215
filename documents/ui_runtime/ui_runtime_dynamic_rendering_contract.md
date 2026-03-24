# UI Runtime Dynamic Rendering Contract

Status: Active canonical contract
Audience: Frontend engineers, QA, maintainers

## Summary

这份文档定义跨 sidepanel / web surface 的动态渲染契约。
目标不是规定某个单独组件怎么写，而是统一回答：在 runtime UI 里，什么内容可以先出现，什么内容必须后出现，哪些局部状态必须随实体切换而重置。

## Phase Model

### `shell_ready`

宿主外壳已经稳定，页面框架、标题壳、返回入口、主布局骨架可以显示。

允许出现：
- page shell
- route shell
- stable header chrome
- skeleton / loading placeholders

不允许出现：
- 依赖 primary content 稳定后的 secondary metadata
- 依赖 anchor 定位的 overlay / popover

### `primary_loading`

主内容正在获取、排序、拼装或建立索引。

允许出现：
- primary content skeleton
- loading copy
- 非误导性的空壳布局

不允许出现：
- 会被误认为内容入口的 secondary metadata
- 会在主内容到来后明显跳位的落款式 footer
- 继承自上一实体的 disclosure / expanded state

### `primary_ready`

主内容已经以当前实体为单位稳定下来，可阅读、可滚动、可定位。

允许出现：
- message list / detailed reader body
- empty-final state
- reader footer anchor

### `secondary_ready`

只有在 primary content 已稳定后，secondary metadata 才允许出现。

典型对象：
- timestamp footer
- capture/source metadata
- auxiliary statistics
- low-priority provenance details

### `overlay_active`

overlay / drawer / popover 只能在 anchor 已稳定后出现。

典型对象：
- annotation drawer
- contextual popover
- hover / focus driven affordance panel

## Governance Rules

### 1. Primary-first

primary content 永远优先于 secondary metadata。
如果一个信息不是用户进入该页面的主要理由，它就不能抢在主内容前出现。

### 2. Secondary deferral

secondary metadata 只能在 `primary_ready` 之后渲染。
如果主内容仍处于 loading / building / indexing 阶段，secondary metadata 必须延后。

### 3. Entity-keyed state reset

任何 disclosure、accordion、expanded preview、selected row、inline overlay anchor 等局部状态，都必须按实体切换重置。

最常见的实体键：
- `conversation.id`
- `note.id`
- `thread.id`
- `message.id`

### 4. Stable-height before motion

动画和过渡只能依附在已稳定的主内容容器上，不能建立在“高度还会继续变化”的 loading 内容之上。

禁止模式：
- 对未稳定 transcript 高度做 slide/fade 组合过渡
- 在 skeleton 与真实内容交替期间让 footer / overlay 参与布局动画

### 5. Overlay-after-anchor

overlay 只能在 anchor 已存在且布局稳定后挂载。
如果 anchor 所在 surface 仍在切换实体、重排内容或恢复滚动位置，则 overlay 必须等待。

## Application to Reader Timestamp Footer

Reader timestamp footer 属于典型的 secondary metadata。

因此它必须满足：
- loading / building 时不渲染
- primary content settled 后才显示
- disclosure 状态按 `conversation.id` 重置
- annotation overlay 的存在不应破坏 footer 的挂载 gate

## Acceptance Questions

每次做 runtime UI 改动时，至少回答这 5 个问题：

1. 这个 surface 的 primary content 是什么
2. secondary metadata 是否被错误地提前渲染
3. entity 切换时哪些局部状态会泄漏
4. 当前动画是否依赖了不稳定高度
5. overlay 是否晚于 anchor 稳定点出现
