# Timestamp Semantics Rollout Tasks

Status: Active task ledger  
Audience: Schema maintainers, capture owners, reader/web contributors, QA

## Locked Contract

- `source_created_at`
  - 站点原始时间，占位且可空
- `first_captured_at`
  - 首次观察到该线程的时间
- `last_captured_at`
  - 最近一次成功 capture 并写入的时间
- `created_at`
  - 记录创建 / 首次落库时间
- `updated_at`
  - 记录修改时间

派生 helper：

- `originAt = source_created_at ?? first_captured_at ?? created_at`
- `captureFreshnessAt = last_captured_at ?? updated_at`
- `recordModifiedAt = updated_at`

## Current Surface Rules

当前收口后的前端规则是：

- Threads 分组和排序
  - 使用 `originAt`
  - 分组标题与筛选文案显式写成 `Started ...`
- 卡片上的 `Last captured ...`
  - 使用 `captureFreshnessAt`
  - 表达最近一次成功捕获时间
- 顶部 `X first captured today`
  - 统计 `first_captured_at` 落在今天的线程数
  - 明确表达 acquisition 语义，而不是“今天有捕获活动”
- Reader / Web header
  - 主时间表达线程起点
  - metadata 明细继续展示 `Source Time / First Captured / Last Captured / Last Modified`

这样同一条线程可以同时满足：

- 被分到 `Started This Week`
- 卡片显示 `Last captured 4h ago`
- 不算进顶部的 `first captured today`

这仍然是多时钟并行，但展示层已经不再把它们混成同一种“捕获时间”。

## Current Scope Boundary

当前这轮时间方案已经落到这些主表面：

- Threads
- sidepanel reader
- export / compression / weekly-related prompt input
- web library / web reader

当前**没有**把 `Network` 一并纳入最终统一 contract。

原因不是忽略它，而是 `Network` 仍处于单独演进阶段：

- 当前 graph node set 主要消费 `getConversations()` 的结果
- graph edge contract 仍只有 `threshold + conversationIds`
- `Network` 的时间过滤、时间回放、动态生成动画还没有统一成正式时间语义

因此当前基线应理解为：

- `Network` 之外的主阅读表面已经完成时间语义收口
- `Network` 的时间语义仍待专项设计，不应被默认视为已经跟随本轮方案完成

## Contributor Coordination Note

目前已有贡献者在推进 `Network` 的动态生成动画。
在 `Network` 专项时间 contract 定稿之前，协作约束固定如下：

- 不要把 `conv.created_at` 直接当成 `Network` 的最终节点时间语义
- 不要默认 `Time Range` 已经具有 runtime 过滤语义
- 不要把“动画时间”直接等同于 `source_created_at`、`first_captured_at` 或 `last_captured_at` 中的任一字段
- 如果动画实现必须临时使用某个时间来源，应将该逻辑局部化，并明确标注为 provisional behavior

后续 `Network` 需要单独锁定这三个问题：

1. 节点 chronology 以 `originAt`、`first_captured_at` 还是别的时间为准
2. `Time Range` 只是前端节点过滤，还是进入 edge / storage contract
3. 动态动画表达“线程起点”“首次进入系统”还是“最近一次捕获刷新”

## Manual Capture Scenario Clarification

“昨天手动捕获一次，今天又手动捕获一次”会把这三种时间明显拉开。

当前实现下：

1. `manual` 模式先把 capture 拦成 held，不直接保存
2. transient store 为当前线程维护 `firstObservedAt`
3. 首次 force archive 后，`first_captured_at` 会定格
4. 后续再次 force archive，同一线程会保留旧的 `first_captured_at`
5. 新一次成功保存只推进 `last_captured_at` 和 `updated_at`

因此最典型的状态是：

- `first_captured_at = 昨天`
- `last_captured_at = 今天`
- `originAt = source_created_at ?? first_captured_at ?? created_at`

这正是“在 Started This Week 中看到 Last captured 4h ago”的来源之一。

## Current Assessment

当前方案的问题，不是字段不足，而是展示语义没有统一命名：

- `first captured today`
  - 表达 acquisition 指标
- `Last captured 4h ago`
  - 表达 freshness 指标

从工程角度看，它内部是一致的；从用户感知看，它很容易被误读成同一种“捕获时间”。

## Rollout Tracks

### Track 1. Data Model and Migration

- `Conversation` / `ConversationDraft` / `ConversationRecord` 增加 `first_captured_at`、`last_captured_at`
- `TransientCaptureStatusSnapshot` 增加 `firstObservedAt`
- DB migration 回填：
  - `first_captured_at = created_at`
  - `last_captured_at = updated_at`

### Track 2. Capture Runtime

- `mirror / smart` 首次保存写入 `first_captured_at`
- `manual` force archive 优先使用 transient `firstObservedAt`
- 已有线程只更新 `last_captured_at`
- metadata edit 只更新 `updated_at`

### Track 3. Consumer Helper Adoption

- repository、timeline、thread list、reader、export、compression、insights 统一改用 helper
- 第一轮不新增 secondary index，先接受内存派生
- `DashboardStats` 显式改名为 `firstCapturedTodayCount / firstCaptureStreak / firstCaptureHeatmapData`

### Track 4. Time Copy and Surface Semantics

- Threads 顶部统计文案固定为“First captured today”或等价语义
- 卡片文案固定为 `Last captured ...`
- 分组与筛选固定为 `Started ...`
- Reader / Web header 继续显式展示 `Source Time / First Captured / Last Captured / Last Modified`

### Track 5. QA

- schema migration 验证
- capture mode 验证
- sidepanel + web parity 验证
- JSON / MD / TXT export 验证
- weekly / summary / compression prompt 元信息验证

## Current Status

这轮已经完成第一批 contract、helper 与 surface copy 接入。
后续重点应转向：

1. 清理残余旧文案和模糊统计命名
2. 把时间 contract 写入更多测试和回归样本
3. 在 Threads / Reader / Web 三个主表面上显式区分“起点时间”和“最近捕获时间”
