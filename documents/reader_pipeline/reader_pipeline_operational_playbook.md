# Reader Pipeline Operational Playbook

Status: Active operational playbook  
Audience: Reader maintainers, export/compression owners, QA, release owners

## 1. Purpose

本文档是 reader pipeline 的统一操作入口，整合 schema 验证、时间语义回归、
reader fidelity、导出检查、compression 检查和 web parity 检查。

## 2. Standard Validation Flow

固定使用以下 5 步：

1. 明确变更范围
   - 是 schema、capture time contract、reader render、export、compression、insights，还是 web parity
2. 先确认 canonical contract
   - 对照 `reader_pipeline_engineering_spec.md`，明确本次应使用 `originAt / captureFreshnessAt / recordModifiedAt` 哪一个
3. 做最小范围验证
   - 优先验证对应 consumer，不要把 capture、reader、web、insights 混成一次大回归
4. 补跨 consumer 对照
   - 至少确认 sidepanel 与 web，或 export 与 reader 之间没有新的语义漂移
5. 收证据
   - 保存 schema/version、样本线程、界面截图、导出样例、prompt 片段

## 3. Validation Matrix

### 3.1 Schema Migration

必检项：

- 历史 conversation 迁移后具备 `first_captured_at`
- 历史 conversation 迁移后具备 `last_captured_at`
- `created_at` 与 `updated_at` 原值不丢失
- 无 secondary index 也能正常启动与读取

### 3.2 Capture Mode Behavior

必检项：

- `mirror` 新线程：`first_captured_at` 接近首次保存时间，后续只更新 `last_captured_at`
- `smart` held -> pass：首次通过时写入 `first_captured_at`
- `manual` held -> force archive：优先取 transient 的 `firstObservedAt`
- metadata edit：只更新 `updated_at`

### 3.3 Timeline and List Views

必检项：

- 线程分组和排序按 `originAt`
- 卡片副文案按 `captureFreshnessAt`
- 顶部统计若使用 `first_captured_at`，文案必须显式说明其“首次捕获”含义

### 3.4 Reader and Web Headers

必检项：

- header 不显示时间 metadata
- 底部折叠 footer 摘要显示 `Started + Last updated`
- footer 展开后只显示去重后的 `Started / Last updated / conditional Captured / conditional Source Time`
- sidepanel 与 web 使用同一套 footer helper 语义

### 3.5 Export, Compression, and Weekly

必检项：

- JSON / MD / TXT 明确输出线程时间字段
- compression / summary / weekly prompt 使用 `originAt`
- 不再把 `updated_at` 混作 conversation start time

## 4. Regression Sample Set

至少保留以下样本：

- `source_created_at` 可空的普通线程
- 首次捕获与最近捕获明显不同的线程
- 手动模式下昨天 held、今天再 force archive 的线程
- 发生 title / tag / star 更新但没有新 capture 的线程
- sidepanel 和 web 都可访问的同一线程

## 5. Release Gate

发布前至少确认：

1. 时间 helper 没有新增分叉
2. Threads、Reader、Web 的时间文案语义一致
3. 导出和 prompt 没有回退到旧的 `updated_at` 起点逻辑
4. 手动模式样本没有把首次观察时间覆盖掉
