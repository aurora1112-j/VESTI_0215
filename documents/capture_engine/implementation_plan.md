# Capture Engine Implementation Plan

## Phase 1: Smart Debouncer (Week 1)

### 目标
优化 ConversationObserver 的触发机制，减少不必要的捕获。

### 实施步骤

1. 创建 `SmartDebouncer` 类
2. 修改 `ConversationObserver` 集成智能防抖
3. 添加性能监控

### 代码位置
- `frontend/src/lib/core/observer/SmartDebouncer.ts` (新建)
- `frontend/src/lib/core/observer/ConversationObserver.ts` (修改)

---

## Phase 2: Incremental Parsing (Week 2-3)

### 目标
实现增量解析，避免重复处理已解析的消息。

### 实施步骤

1. 为每个 Parser 添加消息缓存
2. 实现节点 ID 生成逻辑
3. 修改 `getMessages()` 支持增量模式

### 代码位置
- `frontend/src/lib/core/parser/claude/ClaudeParser.ts`
- `frontend/src/lib/core/parser/chatgpt/ChatGPTParser.ts`
- `frontend/src/lib/core/parser/gemini/GeminiParser.ts`

---

## Phase 3: Media Extraction (Week 4-5)

### 目标
提取和保存图片、链接等多媒体内容。

### 实施步骤

1. 创建 `MediaExtractor` 工具类
2. 扩展 `ParsedMessage` 接口
3. 更新持久化逻辑

### 代码位置
- `frontend/src/lib/core/parser/shared/mediaExtractor.ts` (新建)
- `frontend/src/types/index.ts` (修改)

---

## Phase 4: Error Handling (Week 6)

### 目标
增强错误处理和降级策略。

### 实施步骤

1. 实现 fallback 解析器
2. 添加重试机制
3. 完善日志记录

### 代码位置
- `frontend/src/lib/core/parser/shared/fallbackParser.ts` (新建)
- 各平台 Parser (修改)
