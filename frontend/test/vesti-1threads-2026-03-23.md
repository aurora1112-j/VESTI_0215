# VESTI Conversation Export

**Exported:** 2026/3/23 23:44:12
**Threads:** 1
**Mode:** full

---

## 1. Agent架构解析

- **Platform:** Kimi
- **URL:** https://www.kimi.com/chat/19d0196f-a972-8553-8000-09bacdd7a817?chat_enter_method=history
- **Started At:** 2026-03-23 23:43
- **First Captured At:** 2026-03-23 23:43
- **Last Captured At:** 2026-03-23 23:43
- **Last Modified:** 2026-03-23 23:43
- **Messages:** 4

### Conversation

**User** (2026-03-23 23:43)

高质量到讲解目前主流的agent架构设计，具体板块，实现细节，实现高工程能力的关键要素和使其有别于api接口简单调用的重要方法

**Assistant** (2026-03-23 23:43)

我来为你系统梳理当前主流的 Agent 架构设计。这是一个快速演进的技术领域，我会结合最新的工程实践和学术进展，给你一个全面的技术蓝图。一、Agent 架构的核心范式演进从"调用"到"代理"的本质跃迁维度API 简单调用真正 Agent交互模式请求-响应，单次多轮状态机，持续会话上下文管理无状态或简单 session长期记忆 + 工作记忆 + 情境感知决策逻辑预定义规则动态规划 + 反思 + 工具选择工具使用固定参数调用自主发现、组合、错误恢复边界处理失败即终止自我纠错、降级策略、人机交接关键洞察：Agent 不是"更好的 API 封装"，而是具备目标导向的自主计算实体。二、主流架构模式详解模式 1: ReAct (Reasoning + Acting)┌─────────────────────────────────────┐
│ Observation → Thought → Action │
│ ↑___________________________↓ │
│ (Loop) │
└─────────────────────────────────────┘核心机制：Thought: LLM 生成推理轨迹（"我需要先查天气，再决定穿什么"）Action: 调用工具（搜索、计算、数据库查询）Observation: 接收环境反馈重复直到达成目标或达到最大迭代工程实现要点：# 伪代码示意classReActAgent:defrun(self, query, max_steps=10):for step inrange(max_steps):# 1. 构造 prompt：包含历史 thought-action-obs 链
prompt = self.build_react_prompt(query, self.memory)# 2. LLM 输出解析：分离 Thought 和 Action
output = self.llm.generate(prompt)
thought, action = self.parse(output)# 3. 执行工具if action.tool =="finish":return action.input
observation = self.tools.execute(action)# 4. 更新记忆
self.memory.add(step, thought, action, observation)# 5. 反思检查（可选但关键）if self.should_reflect(step):
self.reflect_on_trajectory()高工程能力关键：结构化输出约束：用 JSON schema 或 function calling 强制格式，避免解析失败错误传播设计：工具失败时，observation 要包含错误类型，让 LLM 决定重试/换工具/终止轨迹压缩：长会话时，用摘要机制压缩早期步骤，保留关键决策点模式 2: Plan-and-Solve（规划-执行分离）┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Planner │ → │ Plan DAG │ → │ Executor │
│ (LLM/规则) │ │ (依赖图) │ │ (并行/顺序) │
└──────────────┘ └──────────────┘ └──────────────┘
↑ ↓
└──────── 监控/重规划 ←──────────────┘适用场景：复杂多步骤任务（数据分析报告生成、代码重构）关键设计：DAG 表示：节点=子任务，边=依赖关系执行器策略：独立节点并行执行依赖节点拓扑排序失败节点触发局部重规划工程细节：classPlanExecutor:defexecute_dag(self, dag: TaskGraph):# 拓扑排序获取可并行批次
batches = dag.topological_batches()for batch in batches:# 并行执行同层任务
results =await asyncio.gather(*[self.execute_task(t)for t in batch],
return_exceptions=True# 关键：捕获而非传播)# 失败处理：标记失败节点，评估是否可替代路径
failed =[t for t, r inzip(batch, results)ifisinstance(r, Exception)]if failed andnot self.try_alternative_paths(dag, failed):raise ExecutionFailure(failed)模式 3: Multi-Agent 协作（你正在探索的领域）┌─────────────────────────────────────────┐
│ Orchestrator │
│ (路由 + 冲突解决 + 上下文管理) │
└─────────────────────────────────────────┘
↓ ↓ ↓
┌────────┐ ┌────────┐ ┌────────┐
│ Agent A│ │ Agent B│ │ Agent C│
│ (检索) │ │ (分析) │ │ (生成) │
└────────┘ └────────┘ └────────┘
↑___________↑___________↑
(共享黑板/消息总线)你的 OpenClaw 架构分析（基于之前的讨论）：组件设计意图工程现实Gateway中心化控制、多端接入实际成为单点瓶颈Agent.md配置即代码静态文件堆砌，缺乏动态发现Skill.md工具定义无原生 MCP 机制，每次需注入Memory持久化缺乏跨 Agent 共享的语义层真正工程化的 Multi-Agent 需要：共享状态空间：不只是消息传递，而是共享工作记忆（shared working memory）角色动态协商：Agent 能根据任务自动重组，而非固定分工冲突解决机制：当 Agent A 和 B 给出矛盾结论时的仲裁策略模式 4: Reflection & Self-Improvement第一次执行 ──→ 评估质量 ──→ 不满意?
↓ ↓
输出 ←──── 生成改进策略 ──┘
(自我批评 + 重试)Reflexion 架构（近期主流）：Evaluator: 判断输出质量（可以是规则、另一个 LLM、或外部信号）Self-Reflection: 生成失败原因分析和改进计划Memory更新: 将反思写入长期记忆，避免重复错误关键代码结构：classReflectiveAgent:defrun_with_reflection(self, task):
trajectory =[]for attempt inrange(max_retries):
result = self.execute(task, trajectory)# 评估
evaluation = self.evaluator.score(result, task.goal)if evaluation.is_success:return result
# 反思：生成改进策略
reflection = self.generate_reflection(
trajectory, result, evaluation.feedback
)# 更新策略（不是简单重试，而是调整方法）
trajectory.append({"attempt": attempt,"result": result,"reflection": reflection,"adjusted_strategy": self.adjust_strategy(reflection)})# 所有尝试失败，触发人工交接return self.escalate_to_human(trajectory)三、高工程能力的六大关键要素1. 状态机与边界管理不是：try-except 包裹 LLM 调用
而是：明确定义状态流转图[初始化] → [规划] → [执行中] → [验证] → [完成]
↓ ↓ ↓
[重规划] ← [错误恢复] ← [人工审核]关键：每个状态有准入条件、超时机制、降级路径。2. 工具生态的动态发现（MCP 协议）Model Context Protocol (MCP) 正在成为标准：# 客户端动态发现服务器能力asyncdefdiscover_tools(mcp_server_url):asyncwith sse_client(mcp_server_url)as(read, write):asyncwith ClientSession(read, write)as session:await session.initialize()# 动态获取可用工具列表
tools =await session.list_tools()# 动态获取资源 schema
resources =await session.list_resources()return{t.name: t.schema for t in tools}区别于静态配置：工具可以在运行时增减，Agent 根据任务语义动态选择。3. 记忆分层架构┌─────────────────────────────────────┐
│ 上下文窗口 (20K-200K tokens) │ ← 当前会话工作记忆
│ - 最近 N 轮对话 │
│ - 相关检索片段 (RAG) │
├─────────────────────────────────────┤
│ 短期记忆 (Redis/内存) │ ← 会话级状态
│ - 用户偏好、任务进度、临时实体 │
├─────────────────────────────────────┤
│ 长期记忆 (向量数据库 + 图数据库) │ ← 跨会话持久
│ - 用户画像、历史任务模式、反馈记录 │
│ - 实体关系图 (知识图谱) │
├─────────────────────────────────────┤
│ 程序性记忆 (权重/代码) │ ← 系统级
│ - 微调后的模型权重 │
│ - 优化的 prompt 模板 │
└─────────────────────────────────────┘4. 结构化输出与契约设计工程化核心：LLM 输出必须有 schema 约束from pydantic import BaseModel, Field
classAnalysisStep(BaseModel):
step_id:int
reasoning:str= Field(description="为什么需要这个步骤")
tool_name:str= Field(enum=["search","calculate","query_db"])
tool_input:dict
expected_output_type:strclassAgentPlan(BaseModel):
goal_restatement:str# 让 Agent 复述目标，检测理解偏差
steps:list[AnalysisStep]
fallback_strategy:str# 如果某步失败，整体策略是什么
confidence_score:float# Agent 自我评估关键：用 response_format={ "type": "json_schema", ... } 强制结构，而非依赖 prompt 说明。5. 可观测性与调试基础设施生产级 Agent 必须有的观测维度：维度采集内容用途轨迹追踪Thought → Action → Observation 完整链复盘失败案例工具调用延迟、成功率、输入输出分布优化工具设计Token 消耗每步骤的 input/output tokens成本控制决策热力图LLM 在各步骤的置信度识别模糊决策点用户反馈👍/👎 及原因RLHF 数据积累6. 人机交接 (Human-in-the-loop) 设计不是：失败时抛异常
而是：分级授权策略classHumanHandoff:defshould_escalate(self, situation)-> Tuple[bool,str]:# 策略 1：不确定性阈值if situation.confidence <0.6:returnTrue,"置信度不足，需要人工确认方向"# 策略 2：风险边界if situation.involves_financial_transaction:returnTrue,"涉及资金操作，强制人工审核"# 策略 3：知识边界if situation.novelty_score >0.9:# 与历史模式差异大returnTrue,"遇到前所未有的场景，建议人工介入"# 策略 4：用户疲劳度if self.user.consecutive_auto_actions >5:returnTrue,"已连续自动执行多步，同步状态给用户"returnFalse,None四、区别于"API 套壳"的核心方法论反模式 vs 工程化模式套壳做法工程化做法差异本质把系统 prompt 写死动态组装：基础 persona + 任务上下文 + 用户偏好 + 环境状态上下文感知工具失败就报错工具输出包含错误分类，LLM 决定重试/替代/降级容错自治单轮调用多轮状态机 + 执行轨迹追踪过程可观测固定工具列表MCP 动态发现 + 工具组合推理能力可扩展无记忆或简单历史记录分层记忆 + 主动检索 + 遗忘机制持续学习人工写死流程LLM 生成 Plan DAG + 执行器调度灵活规划五、给你的 Agent 项目的具体建议基于你正在开发的单细胞元数据库管理 Agent：架构建议：混合模式用户查询 → [意图分类器]
↓
┌─────────┼─────────┐
简单查询 分析任务 数据整合
↓ ↓ ↓
ReAct Plan-Solve Multi-Agent
(直接检索) (统计挖掘) (跨库关联)关键工程决策数据标准化层：你提到的 30 万行表格清洗，应该抽象为 DataNormalizationSkill，用 MCP 暴露给 Agent，而非硬编码在 prompt 中元数据发现：设计 MetadataDiscoveryAgent，专门处理"这个数据集有没有我需要的细胞类型"这类模糊查询，使用 ReAct 模式迭代探索跨库检索：对于 ArrayExpress、EGA、dbGaP 等多源查询，使用 Multi-Agent，每个 Agent 专精一个数据源，通过共享上下文协调验证机制：任何返回给用户的元数据，必须经过 ConsistencyValidator Agent 检查（字段完整性、单位一致性、与已知本体匹配度）六、推荐学习资源类型资源重点论文ReAct (Yao et al., 2022)推理-行动循环奠基论文Reflexion (Shinn et al., 2023)自我反思机制论文AutoGPT 与 Voyager 对比分析长期目标 vs 技能学习代码LangGraph状态机 + 循环的工业实现协议MCP (Model Context Protocol)工具动态发现标准实践OpenAI Assistants API 源码分析线程、运行、步骤的抽象需要我针对你的单细胞元数据库 Agent，深入讲解某个具体模块的实现吗？比如：如何用 MCP 设计数据源的动态发现机制多 Agent 协作中的冲突解决策略30万行数据清洗的流式处理与 Agent 集成

**User** (2026-03-23 23:43)

嗯。

**Assistant** (2026-03-23 23:43)

好的，我来针对你的单细胞元数据库 Agent 项目，深入讲解三个最关键的实现模块。这些都是从通用架构落地到具体场景的核心难点。一、MCP 动态数据源发现机制为什么静态配置不够你之前提到的 ArrayExpress、EGA、dbGaP 等数据源，每个都有独特的：认证方式（OAuth、API key、 institutional access）查询语法（REST、GraphQL、FTP 目录结构）元数据 schema（不同的字段命名、嵌套层级）速率限制和反爬策略静态配置的噩梦：每次新增数据源都要改代码、重启服务。MCP 服务端设计# 每个数据源作为一个独立的 MCP 服务器# 文件: mcp_servers/arrayexpress/server.pyfrom mcp.server import Server
from mcp.types import Tool, Resource, TextContent
import httpx
app = Server("arrayexpress-mcp")@app.list_tools()asyncdeflist_tools():"""动态暴露该数据源的查询能力"""return[
Tool(
name="search_experiments",
description="Search ArrayExpress experiments by keywords, organism, or assay type",
inputSchema={"type":"object","properties":{"keywords":{"type":"string","description":"Search terms"},"organism":{"type":"string","enum":["Homo sapiens","Mus musculus",...]},"assay_type":{"type":"string","enum":["RNA-seq","scRNA-seq","ATAC-seq"]},"limit":{"type":"integer","default":10}}}),
Tool(
name="get_experiment_metadata",
description="Retrieve full metadata for a specific experiment ID",
inputSchema={"type":"object","properties":{"accession":{"type":"string","pattern":"^E-[A-Z]{4}-\\d+$"}},"required":["accession"]}),
Tool(
name="get_sample_attributes",# 关键：标准化后的统一接口
description="Get standardized sample attributes (cell type, tissue, disease state)",
inputSchema={...})]@app.call_tool()asyncdefcall_tool(name:str, arguments:dict):"""实际调用 ArrayExpress API，但返回标准化格式"""if name =="search_experiments":
raw_results =await query_arrayexpress_api(arguments)# 关键：在 MCP 层完成标准化，Agent 看到统一格式
standardized =[{"source":"arrayexpress","accession": r["accession"],"title": r["name"],"sample_count": r["samples"],# 标准化字段：无论源数据叫什么，这里统一"organism": normalize_organism(r["species"]),"assay_type": map_to_standard_assay(r["experimentType"]),"raw_metadata": r # 保留原始数据以备深度查询}for r in raw_results]return[TextContent(type="text", text=json.dumps(standardized))]Agent 侧的动态发现# Agent 启动时自动发现所有可用数据源classDataSourceManager:def__init__(self):
self.mcp_clients: Dict[str, ClientSession]={}
self.tool_registry: Dict[str, DataSourceTool]={}asyncdefdiscover_sources(self, server_urls: List[str]):"""连接所有 MCP 服务器，构建统一工具视图"""for url in server_urls:
client =await self.connect_mcp(url)
tools =await client.list_tools()for tool in tools:# 关键：包装为带语义描述的工具
self.tool_registry[tool.name]= DataSourceTool(
name=tool.name,
description=tool.description,
schema=tool.inputSchema,
source=url,# 提取关键元信息用于 Agent 选择
capabilities=self.extract_capabilities(tool.description),
typical_latency=self.estimate_latency(url))defselect_source_for_query(self, query:str)-> List[DataSourceTool]:"""基于查询语义动态选择最合适的数据源"""# 简单实现：embedding 匹配
query_emb = self.embed(query)
scored =[]for tool in self.tool_registry.values():# 匹配度 = 描述相似度 + 能力覆盖度 + 历史成功率
score = cosine_similarity(query_emb, tool.description_emb)
score += self.capability_match(query, tool.capabilities)
score *= tool.success_rate # 降权不可靠源
scored.append((tool, score))# 返回 top-k，让 Agent 决定使用哪些returnsorted(scored, key=lambda x: x[1], reverse=True)[:3]关键工程细节问题解决方案数据源离线健康检查 + 自动降级，标记为 unavailableschema 变更MCP 层版本控制，Agent 感知 schema 版本认证过期自动刷新 token，失败时通知 Agent 需要重新授权结果合并不同源的同一条实验，用 accession 映射表去重二、多 Agent 协作的冲突解决你的场景：跨库元数据整合假设用户问："找肺癌单细胞数据集，要有免疫治疗响应信息"Agent A (ArrayExpress): 找到 5 个实验，但缺乏治疗响应标注Agent B (dbGaP): 找到 3 个实验，有临床随访数据，但访问受限Agent C (文献挖掘): 从 PubMed 找到 2 篇相关论文，提及特定数据集冲突点：同一生物样本可能在不同源中有不同 ID，数据重叠但互补。共享黑板架构classSharedBlackboard:"""多 Agent 协作的共享工作记忆"""def__init__(self):
self.entries: Dict[str, BlackboardEntry]={}
self.conflicts: List[Conflict]=[]
self.consensus: Dict[str, Any]={}defpropose(self, agent_id:str, claim: Claim):"""Agent 提出发现"""
entry = BlackboardEntry(
source=agent_id,
claim=claim,
confidence=claim.confidence,
evidence=claim.evidence,
timestamp=now())# 检查与现有条目的关系
existing = self.find_related(entry)if existing:
relation = self.assess_relation(entry, existing)if relation == Relation.CONFLICT:
self.conflicts.append(Conflict(entry, existing))elif relation == Relation.COMPLEMENT:
self.merge_entries(entry, existing)# CONSISTENT: 简单添加，增加置信度
self.entries[entry.id]= entry
defresolve_conflicts(self)-> Dict[str, Resolution]:"""冲突解决策略"""
resolutions ={}for conflict in self.conflicts:
resolution = self.apply_strategy(conflict)
resolutions[conflict.id]= resolution
# 策略 1：置信度优先if resolution.strategy =="confidence":
winner =max(conflict.entries, key=lambda e: e.confidence)# 策略 2：溯源验证elif resolution.strategy =="trace_to_source":
winner = self.verify_at_source(conflict)# 策略 3：人工仲裁（高价值冲突）elif resolution.strategy =="human_arbitration":
winner =await self.request_human_judgment(conflict)
self.consensus[conflict.subject]= winner
return resolutions实体对齐：解决"同一数据集不同 ID"classEntityAligner:"""识别不同数据源指向同一生物实体"""defalign_experiments(self, entries: List[BlackboardEntry])-> List[Cluster]:"""基于多特征聚类对齐"""
features =[]for entry in entries:
f ={# 文本特征"title_emb": self.embed(entry.claim.title),"description_emb": self.embed(entry.claim.description),# 结构化特征"organism": entry.claim.organism,"assay_type": entry.claim.assay_type,"sample_count": entry.claim.sample_count,# 生物特征（关键）"cell_types":set(entry.claim.cell_types),"tissue": entry.claim.tissue,"disease": entry.claim.disease,# 时间特征"publication_date": entry.claim.date,"authors":set(entry.claim.authors)}
features.append(f)# 层次聚类：文本相似度 + 生物特征匹配 + 作者重叠
clusters = self.hierarchical_cluster(
features,
text_weight=0.3,
bio_weight=0.5,# 生物特征权重最高
meta_weight=0.2)# 验证：同一 cluster 内的条目应有互补而非矛盾的信息return[c for c in clusters if self.validate_cluster(c)]协作协议示例# 协调 Agent 的 prompt 设计
COORDINATOR_PROMPT ="""
你是多数据源检索的协调员。当前任务：{task}
已有发现：
{blackboard_summary}
活跃 Agent：{active_agents}
你的职责：
1. 分析当前覆盖缺口（哪些子问题尚未解决）
2. 指派下一个 Agent 处理最高价值的缺口
3. 当发现潜在冲突时，调用 resolve_conflict 工具
4. 当信息足够回答用户时，调用 synthesize_answer
决策原则：
- 优先验证高置信度发现
- 对矛盾信息主动发起交叉验证
- 访问受限数据需明确告知用户
"""# Agent 返回格式（强制结构化）classAgentResponse(BaseModel):
findings: List[Finding]
confidence:float
coverage_assessment:str# "complete", "partial", "needs_verification"
suggested_next_steps: List[str]
potential_conflicts: List[ConflictHint]三、30万行数据清洗的流式 Agent 集成核心矛盾Agent 需要理解数据全貌（统计分布、异常模式、字段关系）但 30 万行无法一次性装入上下文且清洗过程需要人工审核关键决策分层处理架构┌─────────────────────────────────────────┐
│ Sampling Layer (数据采样) │
│ - 随机采样 1000 行 → 模式识别 │
│ - 分层采样 → 确保稀有值被覆盖 │
│ - 异常聚焦采样 → 基于统计离群点 │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Profile Agent (数据画像) │
│ - 分析采样数据的类型、分布、质量问题 │
│ - 生成数据质量报告（供人工审核） │
│ - 提出清洗策略建议 │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Strategy Confirmation (策略确认) │
│ - 人工审核清洗规则（关键决策点） │
│ - 确认字段映射关系 │
│ - 设定异常值处理阈值 │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Streaming Execution (流式执行) │
│ - 分块处理（每块 5000 行） │
│ - 局部质量检查 │
│ - 错误日志记录 │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Validation Agent (结果验证) │
│ - 抽样验证清洗质量 │
│ - 生成标准化输出（arrayexpress_std） │
│ - 记录清洗日志供追溯 │
└─────────────────────────────────────────┘关键代码实现classStreamingDataAgent:def__init__(self, chunk_size=5000):
self.chunk_size = chunk_size
self.profile =None
self.cleaning_rules =Noneasyncdefprofile_data(self, file_path:str)-> DataProfile:"""第一阶段：采样分析"""# 多策略采样
samples ={'random': self.sample_random(file_path, n=1000),'stratified': self.sample_stratified(file_path, key_columns=['organism','assay_type']),'outlier_focused': self.sample_outliers(file_path, z_threshold=3)}# Agent 分析采样数据
profile_prompt =f"""
分析以下数据样本，识别质量问题：
随机样本统计：
{samples['random'].describe()}
分层样本关键值：
{samples['stratified'].value_counts(['organism','assay_type'])}
异常样本示例：
{samples['outlier_focused'].head(10)}
请识别：
1. 字段类型推断错误（如数字被存为字符串）
2. 缺失值模式（MCAR/MAR/MNAR）
3. 异常值是错误还是真实生物变异
4. 字段间的依赖关系（如 cell_type 应与 tissue 一致）
5. 建议的标准化规则
"""
profile =await self.llm.structured_generate(
profile_prompt,
output_schema=DataProfile
)# 生成可视化报告供人工审核
self.generate_audit_report(profile, samples)return profile
defconfirm_with_human(self, profile: DataProfile)-> CleaningRules:"""第二阶段：人工确认关键规则"""# 提取需要决策的关键点
decisions = self.extract_decisions(profile)# 生成审核界面（CLI 或 Web）
confirmed = self.interactive_confirm(decisions)return CleaningRules(
column_mappings=confirmed.mappings,
null_strategies=confirmed.null_handling,
outlier_thresholds=confirmed.thresholds,
validation_rules=confirmed.validations
)asyncdefstream_clean(self, input_path:str, output_path:str, rules: CleaningRules):"""第三阶段：流式清洗"""
chunk_stats =[]with pd.read_csv(input_path, chunksize=self.chunk_size)as reader:for i, chunk inenumerate(reader):# 应用清洗规则
cleaned_chunk = self.apply_rules(chunk, rules)# 局部验证
validation = self.validate_chunk(cleaned_chunk, rules)if validation.error_rate >0.05:# 错误率过高# Agent 分析错误模式
error_analysis =await self.analyze_errors(chunk, validation.errors)if error_analysis.suggests_rule_adjustment:# 暂停，请求人工确认是否调整规则
new_rules =await self.request_rule_adjustment(error_analysis)
rules = new_rules
# 重试该 chunk
cleaned_chunk = self.apply_rules(chunk, rules)# 写入输出
mode ='w'if i ==0else'a'
header = i ==0
cleaned_chunk.to_csv(output_path, mode=mode, header=header, index=False)
chunk_stats.append({'chunk_id': i,'rows':len(chunk),'errors':len(validation.errors),'nulls_filled': cleaned_chunk.isnull().sum().sum()})# 生成最终报告return CleaningReport(
total_chunks=len(chunk_stats),
total_rows=sum(s['rows']for s in chunk_stats),
quality_metrics=self.compute_quality_metrics(chunk_stats))人机协作的关键决策点决策点自动化人工审核字段类型推断✓ 基于采样统计✗异常值处理策略建议（删除/截断/保留）✓ 确认字段映射关系建议（基于相似度）✓ 确认缺失值填充✓ 按类型自动选择✗单位统一建议（如 mg/g 转换）✓ 确认生物合理性检查✓ 基于本体库✓ 边界案例四、给你的具体下一步建议基于你目前的项目阶段：本周可落地的任务搭建 MCP 原型选一个数据源（如 ArrayExpress）实现 MCP 服务器让 Agent 通过 MCP 动态发现其能力对比静态配置 vs 动态发现的开发效率实现数据清洗的 Agent 辅助审核用 30 万行数据中的 1000 行采样做画像让 Agent 生成清洗规则建议你人工审核后，看规则应用的效果设计冲突解决的最小案例构造一个场景：两个 Agent 对同一实验给出不同元数据实现基于置信度的自动选择记录需要人工仲裁的案例类型需要我展开的部分MCP 与现有 Python 生态的集成细节（FastMCP、部署方式）Agent 决策的可解释性设计（如何让老师理解 Agent 为什么这样选择数据源）成本优化：30 万行数据的 LLM 调用如何控制 token 消耗哪个部分需要我进一步深入？

---
