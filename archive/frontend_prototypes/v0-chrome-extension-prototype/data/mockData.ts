'use client';

// ============================================================
// --- data/mockData.ts ---
// Mock data covering 4 platforms, 10 conversations, bilingual titles
// ============================================================

import type { Conversation, Message } from "@/types";

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    uuid: "chatgpt-abc123",
    platform: "ChatGPT",
    title: "如何用 React 实现虚拟列表优化",
    snippet:
      "我正在开发一个需要渲染大量列表项的应用，列表可能有上万条数据，直接渲染会导致严重的性能问题...",
    url: "https://chatgpt.com/c/abc123",
    created_at: Date.now() - 60_000,
    updated_at: Date.now() - 60_000,
    message_count: 12,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 2,
    uuid: "claude-def456",
    platform: "Claude",
    title: "Rust ownership 机制详解",
    snippet:
      "Can you explain Rust ownership, borrowing, and lifetimes with practical examples?",
    url: "https://claude.ai/chat/def456",
    created_at: Date.now() - 3_600_000,
    updated_at: Date.now() - 1_800_000,
    message_count: 8,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 3,
    uuid: "gemini-ghi789",
    platform: "Gemini",
    title: "2024 年最值得关注的 AI 论文",
    snippet:
      "请帮我梳理 2024 年下半年最有影响力的 AI/ML 论文，按领域分类...",
    url: "https://gemini.google.com/app/ghi789",
    created_at: Date.now() - 7_200_000,
    updated_at: Date.now() - 5_400_000,
    message_count: 6,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 4,
    uuid: "deepseek-jkl012",
    platform: "DeepSeek",
    title: "PostgreSQL 查询性能优化指南",
    snippet:
      "我的 SQL 查询在百万级数据表上非常慢，explain analyze 显示全表扫描...",
    url: "https://chat.deepseek.com/jkl012",
    created_at: Date.now() - 86_400_000,
    updated_at: Date.now() - 80_000_000,
    message_count: 15,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 5,
    uuid: "chatgpt-mno345",
    platform: "ChatGPT",
    title: "Building a Chrome Extension with Plasmo",
    snippet:
      "I want to build a browser extension that captures web page content. What framework should I use?",
    url: "https://chatgpt.com/c/mno345",
    created_at: Date.now() - 172_800_000,
    updated_at: Date.now() - 170_000_000,
    message_count: 20,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 6,
    uuid: "claude-pqr678",
    platform: "Claude",
    title: "用 TypeScript 重构遗留代码的最佳实践",
    snippet:
      "我们团队有一个 5 年历史的 JavaScript 项目，想逐步迁移到 TypeScript，应该怎么规划...",
    url: "https://claude.ai/chat/pqr678",
    created_at: Date.now() - 259_200_000,
    updated_at: Date.now() - 250_000_000,
    message_count: 10,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 7,
    uuid: "deepseek-stu901",
    platform: "DeepSeek",
    title: "Docker Compose 多服务编排实战",
    snippet:
      "帮我设计一个 docker-compose.yml，包含 Nginx 反向代理、Node.js 后端、PostgreSQL 和 Redis...",
    url: "https://chat.deepseek.com/stu901",
    created_at: Date.now() - 345_600_000,
    updated_at: Date.now() - 340_000_000,
    message_count: 7,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 8,
    uuid: "gemini-vwx234",
    platform: "Gemini",
    title: "SwiftUI vs Flutter 跨平台方案对比",
    snippet:
      "我想开发一个同时支持 iOS 和 Android 的应用，预算有限，应该选择哪个框架...",
    url: "https://gemini.google.com/app/vwx234",
    created_at: Date.now() - 432_000_000,
    updated_at: Date.now() - 430_000_000,
    message_count: 9,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 9,
    uuid: "chatgpt-yz567",
    platform: "ChatGPT",
    title: "Designing a REST API for E-commerce",
    snippet:
      "I need to design a scalable RESTful API for an e-commerce platform handling 10K+ daily orders...",
    url: "https://chatgpt.com/c/yz567",
    created_at: Date.now() - 518_400_000,
    updated_at: Date.now() - 515_000_000,
    message_count: 14,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
  {
    id: 10,
    uuid: "gemini-abc890",
    platform: "Gemini",
    title: "机器学习模型部署到生产环境的最佳实践",
    snippet:
      "我训练了一个 PyTorch 模型，想部署到生产环境，请问有什么推荐方案...",
    url: "https://gemini.google.com/app/abc890",
    created_at: Date.now() - 604_800_000,
    updated_at: Date.now() - 600_000_000,
    message_count: 11,
    is_archived: false,
    is_trash: false,
    tags: [],
  },
];

export const MOCK_MESSAGES: Message[] = [
  // Conversation 1 — React Virtual List
  {
    id: 1,
    conversation_id: 1,
    role: "user",
    content_text:
      "我正在开发一个需要渲染大量列表项的应用，列表可能有上万条数据。直接渲染 DOM 节点会导致严重的性能问题和内存占用。请问用 React 实现虚拟列表（Virtual List）有哪些主流方案？各自的优缺点是什么？",
    created_at: Date.now() - 65_000,
  },
  {
    id: 2,
    conversation_id: 1,
    role: "ai",
    content_text:
      '在 React 中实现虚拟列表有几种主流方案：\n\n1. **react-window** — Brian Vaughn 开发的轻量库，是 react-virtualized 的精简版。包体积小（约 6KB gzip），API 简洁，支持固定高度和可变高度列表。适合大多数场景。\n\n2. **react-virtualized** — 功能最全的方案，支持表格、网格、瀑布流等多种布局。但包体积较大（约 28KB gzip），API 复杂度高。除非你需要高级功能，否则推荐 react-window。\n\n3. **@tanstack/react-virtual** — TanStack 生态的虚拟化方案，headless 设计，不绑定任何 UI 库。可变高度支持优秀，与 TanStack Table 配合很好。\n\n4. **自己实现** — 核心原理是只渲染可视区域 ± buffer 的 DOM 节点，通过 Intersection Observer 或 scroll 事件计算可见范围。适合学习，但生产环境不建议造轮子。\n\n对于你的万级数据场景，我推荐 react-window + 动态高度测量的组合。需要我写一个具体的实现示例吗？',
    created_at: Date.now() - 62_000,
  },
  {
    id: 3,
    conversation_id: 1,
    role: "user",
    content_text:
      "请用 react-window 写一个支持动态高度的虚拟列表示例，要求：1. 列表项高度不固定（每项内容长度不同）2. 支持滚动到指定位置 3. 加载更多（infinite scroll）",
    created_at: Date.now() - 60_500,
  },
  {
    id: 4,
    conversation_id: 1,
    role: "ai",
    content_text:
      '好的，这里是一个完整的实现示例。核心思路是使用 `VariableSizeList` 配合 `react-window` 的 `resetAfterIndex` 方法来处理动态高度：\n\n```tsx\nimport { VariableSizeList as List } from "react-window";\nimport { useRef, useCallback, useEffect } from "react";\nimport InfiniteLoader from "react-window-infinite-loader";\n\ninterface VirtualListProps {\n  items: string[];\n  hasMore: boolean;\n  loadMore: () => Promise<void>;\n}\n\nexport function VirtualList({ items, hasMore, loadMore }: VirtualListProps) {\n  const listRef = useRef<List>(null);\n  const sizeMap = useRef<Record<number, number>>({});\n\n  const getSize = (index: number) => sizeMap.current[index] || 60;\n\n  const setSize = useCallback((index: number, size: number) => {\n    sizeMap.current[index] = size;\n    listRef.current?.resetAfterIndex(index);\n  }, []);\n\n  return (\n    <InfiniteLoader\n      isItemLoaded={(index) => index < items.length}\n      itemCount={hasMore ? items.length + 1 : items.length}\n      loadMoreItems={loadMore}\n    >\n      {({ onItemsRendered, ref }) => (\n        <List\n          ref={(el) => { listRef.current = el; ref(el); }}\n          height={600}\n          itemCount={items.length}\n          itemSize={getSize}\n          onItemsRendered={onItemsRendered}\n          width="100%"\n        >\n          {({ index, style }) => (\n            <ListItem\n              style={style}\n              content={items[index]}\n              index={index}\n              setSize={setSize}\n            />\n          )}\n        </List>\n      )}\n    </InfiniteLoader>\n  );\n}\n```\n\n这个实现有几个关键点：使用 `sizeMap` 缓存每个元素的实际高度，通过 `resetAfterIndex` 在高度变化时触发重新计算，以及用 `InfiniteLoader` 实现无限滚动加载。',
    created_at: Date.now() - 60_000,
  },
  // Conversation 2 — Rust Ownership
  {
    id: 5,
    conversation_id: 2,
    role: "user",
    content_text:
      "Can you explain Rust ownership with practical examples? I keep getting borrow checker errors.",
    created_at: Date.now() - 3_600_000,
  },
  {
    id: 6,
    conversation_id: 2,
    role: "ai",
    content_text:
      'Rust\'s ownership system has three core rules:\n\n1. Each value has exactly one owner\n2. When the owner goes out of scope, the value is dropped\n3. You can have either one mutable reference OR any number of immutable references\n\nHere\'s a practical example that demonstrates common pitfalls:\n\n```rust\nfn main() {\n    let s1 = String::from("hello");\n    let s2 = s1; // s1 is MOVED, not copied\n    // println!("{}", s1); // Error: value borrowed after move\n    println!("{}", s2); // Works\n\n    // To keep both, clone explicitly:\n    let s3 = s2.clone();\n    println!("{} {}", s2, s3); // Both work\n}\n```\n\nThe most common borrow checker error comes from trying to mutate while borrowing:\n\n```rust\nlet mut v = vec![1, 2, 3];\nlet first = &v[0]; // immutable borrow\nv.push(4);         // mutable borrow while immutable exists\nprintln!("{}", first);\n```\n\nThe fix is to limit borrow lifetimes -- ensure the immutable reference is no longer used before mutating.',
    created_at: Date.now() - 3_500_000,
  },
  // Conversation 3 — AI Papers
  {
    id: 7,
    conversation_id: 3,
    role: "user",
    content_text:
      "请帮我梳理 2024 年下半年最有影响力的 AI/ML 论文，按领域分类。",
    created_at: Date.now() - 7_200_000,
  },
  {
    id: 8,
    conversation_id: 3,
    role: "ai",
    content_text:
      "2024 下半年重要论文概览：\n\n**大语言模型**\n- Llama 3.1 (Meta) — 开源 405B 参数模型，在多项基准上接近 GPT-4\n- Claude 3.5 Sonnet (Anthropic) — 在编码和推理任务上表现突出\n\n**多模态**\n- GPT-4o (OpenAI) — 原生多模态，实时语音对话\n- Gemini 1.5 Pro (Google) — 百万级 Token 上下文窗口\n\n**推理与搜索**\n- o1 (OpenAI) — Chain-of-thought 推理模型\n- DeepSeek-V2 — 高效 MoE 架构\n\n**图像生成**\n- FLUX.1 (Black Forest Labs) — 新一代扩散模型\n- Stable Diffusion 3 (Stability AI) — MMDiT 架构\n\n**代码与工程**\n- Cursor / Copilot Workspace — AI 辅助编程的新范式\n- SWE-bench 系列论文 — 自动化软件工程评测",
    created_at: Date.now() - 7_000_000,
  },
  // Conversation 4 — PostgreSQL
  {
    id: 9,
    conversation_id: 4,
    role: "user",
    content_text:
      "我的 SQL 查询在百万级数据表上非常慢，explain analyze 显示全表扫描，怎么优化？",
    created_at: Date.now() - 86_400_000,
  },
  {
    id: 10,
    conversation_id: 4,
    role: "ai",
    content_text:
      "针对百万级数据表的查询优化，以下是分层策略：\n\n**第一层：索引优化**\n- 检查 WHERE 子句中的列是否有索引\n- 使用复合索引覆盖多列查询条件\n- 对于范围查询，注意索引列的顺序（等值条件在前，范围在后）\n\n**第二层：查询改写**\n- 避免 `SELECT *`，只查需要的列\n- 将 `NOT IN` 改为 `NOT EXISTS`\n- 使用 `LIMIT` + 游标分页代替 `OFFSET`\n\n**第三层：表结构优化**\n- 考虑分区表（按时间/范围分区）\n- 对冷数据归档到只读表\n- 使用 `VACUUM ANALYZE` 更新统计信息\n\n**第四层：缓存与物化视图**\n- 频繁查询的聚合结果用 `MATERIALIZED VIEW`\n- 应用层引入 Redis 缓存热点查询\n\n建议先用 `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` 把执行计划发给我，我帮你分析具体瓶颈。",
    created_at: Date.now() - 86_000_000,
  },
];
