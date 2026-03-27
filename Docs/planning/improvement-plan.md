# Dialectica — Improvement Plan

本文件是基于当前代码与文档的改进清单，目标是让 Dialectica 从「可演示」提升到「可稳定迭代」。

---

## 1. 目标

### 核心目标
- 提高稳定性：减少流式中断、会话丢失、异常静默失败。
- 提高可维护性：统一文档与实现、补齐测试、降低隐性耦合。
- 提高输出质量：让 RAG 更可控、回答更可追踪、评估更可复现。

### 非目标（短期不做）
- 不引入复杂多租户或完整鉴权系统。
- 不做大规模前端重构（保留现有视觉风格与组件层次）。
- 不切换主要技术栈（继续 FastAPI + LangGraph + React）。

---

## 2. 优先级路线图

## P0（本周完成）

### P0-1：会话与状态可靠性
**问题**
- 会话清理仅在 `/dialectica/start` 触发；长时间运行会累积无效会话。
- 多个端点对过期 session 的行为不一致（有的 SSE error，有的直接 JSON error）。

**改进**
- 抽出统一 `get_session_or_error()` 工具函数。
- 在 `/respond`、`/auto-respond`、`/auto-respond-one`、`/suggest-perspectives` 全部复用。
- 将 `cleanup_sessions()` 放在所有会话读写入口前执行。

**验收标准**
- 所有会话相关端点在 session 失效时返回一致错误格式。
- 运行压测后会话数随 TTL 自动回落，无持续增长。

---

### P0-2：错误处理与可观测性
**问题**
- 前端部分接口失败是静默处理（例如 auto-fill all）。
- 后端错误日志可读性不足，缺少 session_id/thread_id 关联。

**改进**
- 前端统一错误显示策略：所有 AI 生成失败均给出 inline error。
- 后端日志增加结构化字段：`session_id`、`thread_id`、`endpoint`、`node`。
- 对 `json.loads(result.content)` 增加防御与回退提示。

**验收标准**
- 任一 API 人为注入失败时，前端可见错误提示。
- 日志能用 session_id 快速串起一次完整调用链。

---

### P0-3：文档与代码对齐
**问题**
- 部分设计文档/说明与当前实现有漂移（字段名、流式方式、部署细节）。

**改进**
- 明确“Single Source of Truth”：
  - API/状态字段：`Docs/architecture/architecture-overview.md`
  - 部署流程：`Docs/operations/deployment-guide.md`
  - Prompt 行为：`backend/app/graph/prompts.py`
- 在每份文档顶部增加 `Last verified with commit`。

**验收标准**
- 抽查 3 份核心文档与代码字段一致，不出现过期字段名。

---

## P1（1~2 周）

### P1-1：补齐测试（优先后端）
**问题**
- 当前几乎无自动化测试，回归靠手测。

**改进**
- 新增测试目录：
  - `backend/tests/test_api_start_respond.py`
  - `backend/tests/test_auto_respond.py`
  - `backend/tests/test_prompts_contract.py`
  - `backend/tests/test_retriever.py`
- 覆盖关键契约：
  - `socratic_questions` 恰好 3 条
  - `attacks` 恰好 3 条
  - `argument_map` 结构完整
  - SSE 事件顺序与必需事件存在

**验收标准**
- CI 中 pytest 通过。
- 任意改动 prompt/节点逻辑后，契约破坏能在测试中被拦截。

---

### P1-2：RAG 质量提升（轻量版）
**问题**
- 当前仅 `similarity_search`，缺少去重、重排与最小评估。

**改进**
- 检索侧增加：
  - MMR 或多样性检索（减少同质 chunk）
  - 来源去重（同源多 chunk 合并）
  - 可选 metadata 过滤（fallacy/text 分层）
- 新增一个小型离线评估集（20~30 条 claim-query）。

**验收标准**
- 在评估集上，Top-3 命中“相关来源”的比例提升（相对基线至少 +10%）。

---

### P1-3：Prompt 输出约束更稳健
**问题**
- 部分节点仍可能出现格式漂移（尤其 JSON 输出）。

**改进**
- 对 auto-respond / suggest-perspectives 引入严格 schema 校验与重试（最多 1~2 次）。
- 在失败时返回可解释错误，不让前端卡住。

**验收标准**
- 连续 100 次批量调用中，JSON 解析失败率降到可忽略水平。

---

## P2（2~4 周）

### P2-1：会话持久化与多实例兼容
**问题**
- 当前 MemorySaver + 进程内 sessions 适合 demo，不适合多副本。

**改进**
- 迁移到 Redis/SQLite 持久化 checkpointer 与 session metadata。
- 定义 session schema 与清理策略（后台任务）。

**验收标准**
- 服务重启后可恢复进行中的 session。
- 多实例部署下同 session 行为一致。

---

### P2-2：前端性能与可访问性
**问题**
- 大段文本 + SVG 可能造成低端设备掉帧。
- 表单与按钮可访问性（键盘/读屏）可继续加强。

**改进**
- 为 `ParchmentBlock` 增加性能护栏（低端降级为简版背景）。
- 补充 aria label、focus 可视状态、键盘路径测试。

**验收标准**
- 中端移动设备滚动稳定，无明显卡顿。
- 关键流程可仅用键盘完成。

---

### P2-3：产品分析与评估闭环
**问题**
- 缺少量化反馈，难判断哪些改动真正提升体验。

**改进**
- 记录匿名事件：开始率、awaiting_input 到 submit 转化率、auto-response 使用率。
- 增加“结果有帮助吗”简短反馈。

**验收标准**
- 每周能看到漏斗数据与节点级失败率。
- 能基于数据做下一轮迭代优先级。

---

## 3. 建议先做的 7 个具体任务（可直接开工）

1. 统一 session 读取与失效处理（后端 helper）。
2. 所有 auto-response 错误前端显式展示。
3. 增加 API 契约测试（start/respond/auto-respond）。
4. 为 `argument_map` 增加严格校验失败回退。
5. 检索去重与 MMR 开关（默认开启）。
6. 文档加 `Last verified with commit`。
7. 建立最小 CI：`pytest + eslint + vite build`。

---

## 4. 完成定义（Definition of Done）

一个改进项只有在以下条件都满足时算完成：
- 代码已合并，且有对应测试或手工验收记录。
- 文档同步更新（涉及行为变更时必须更新）。
- 本地可复现实验步骤（命令或截图）可追溯。
- 不引入新的静默失败路径。

---

## 5. 总结

Dialectica 当前已经具备完整的产品闭环与清晰的技术架构。下一阶段重点不是“加功能”，而是“稳住契约、建立评估、降低回归成本”。按本计划推进后，项目会更像一个可持续迭代的产品，而不仅是一次高质量 demo。
