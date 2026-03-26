# 设计思路：后端

## 一、核心问题

Dialectica 的后端需要解决一个本质上是**有状态的、多步骤的 AI 对话流程**：用户提交 claim → 系统经过 5 个 LLM 节点处理 → 中途暂停等待用户回答 → 恢复继续 → 输出最终结论。

这不是一次性的 LLM 调用，而是一条需要维持上下文、可中断、可恢复的推理链。选型的出发点就是：什么架构能把这条链管理得最清晰。

---

## 二、技术栈选择

### LangGraph：状态机而非 AgentExecutor

最初考虑过用 LangChain 的 `AgentExecutor` + 工具调用链。放弃的原因：

- `AgentExecutor` 是 loop-based，不适合需要固定节点顺序的流程
- 中断/恢复（interrupt）支持不原生，需要大量 hack
- 节点间状态传递不透明，调试困难

LangGraph 的 `StateGraph` 解决了这些问题：

```
[START] → understand → steelman → attack → interrogate → [INTERRUPT] → synthesize → [END]
```

每个节点是一个独立的 async 函数，读取 `DialecticaState`，只写入自己负责的字段。节点间通过共享 state 通信，图的拓扑在 `graph.py` 里一次性声明清楚，不会散落在各处。

**中断机制**用 `interrupt_before=["synthesize"]`：图在进入 synthesize 节点之前自动暂停，把控制权还给 API。等用户提交 Socratic 回答后，调用 `graph.update_state()` 注入数据，再调用 `graph.astream_events(None, config=config)` 恢复执行。

**MemorySaver** 作为 checkpointer，把每个 thread 的 state 存在内存里。选择内存而不是 Redis/数据库的原因：这是 portfolio demo，无需持久化，简单最重要。每个 session 有独立的 `thread_id`，graph 通过 `{"configurable": {"thread_id": ...}}` 区分。

### FastAPI + SSE：推流而非轮询

用户体验的关键是**实时看到每个节点的输出**，而不是等全部跑完再一次性返回。方案对比：

| 方案 | 问题 |
|---|---|
| WebSocket | 需要维护双向连接，前端复杂度高 |
| HTTP 轮询 | 延迟高，服务器压力大 |
| SSE | 单向推流，HTTP 原生支持，前端用 `fetch` + async generator 即可 |

前端 `odieyang.com` 已经有 SSE 使用经验（Pulse 项目），复用同一套模式。

用 `sse-starlette` 的 `EventSourceResponse` 包裹一个 async generator：

```python
async def event_generator():
    async for event in graph.astream_events(initial_state, config=config, version="v2"):
        name = event.get("name", "")
        kind = event.get("event", "")
        if kind == "on_chain_start" and name in NODE_NAMES:
            yield {"event": "node_start", "data": ...}
        elif kind == "on_chat_model_stream":
            yield {"event": "token", "data": ...}
        elif kind == "on_chain_end":
            yield {"event": "node_end", "data": ...}
```

`astream_events` 是 LangGraph 的事件流接口，可以精细拦截每个节点的 start/stream/end 事件，而不是粗粒度的整图输出。

### LLM 分级：gpt-4o-mini + gpt-4o

前 4 个节点（understand/steelman/attack/interrogate）用 `gpt-4o-mini`：

- 任务明确，输出结构固定，用 `with_structured_output(PydanticModel)` 强制格式
- mini 速度快、成本低，适合迭代密集的节点

synthesize 节点用 `gpt-4o`：

- 最终输出，质量要求最高
- 需要整合全部上下文（claim、steelman、attacks、用户 Socratic 回答）写出有说服力的 refined argument

### ChromaDB：零基础设施的本地向量库

RAG 检索需要一个向量数据库。选型优先级：运维简单 > 检索质量 > 可扩展性（portfolio demo，不需要千亿级别）。

ChromaDB 本地持久化，直接挂载到 Railway volume，不需要单独的向量数据库服务。`lru_cache(maxsize=1)` 保证向量库只在第一次请求时加载，之后复用同一实例。

嵌入模型用 `text-embedding-3-small`：cost-efficient，对哲学/逻辑类文本检索质量够用。

---

## 三、状态设计

`DialecticaState` 是整个系统的核心数据结构：

```python
class DialecticaState(TypedDict):
    original_claim: str       # 只写一次，永不覆盖
    core_claim: str           # understand 节点写入
    claim_assumptions: list[str]
    steelman_text: str        # steelman 节点写入
    steelman_sources: list[str]
    attacks: list[str]        # attack 节点写入
    attack_sources: list[str]
    socratic_questions: list[str]  # interrogate 节点写入
    user_responses: list[str]      # 用户输入，API 注入
    synthesis: str            # synthesize 节点写入
    argument_map: dict
    current_node: str
    awaiting_user: bool
    error: Optional[str]
```

设计原则：**每个字段只由一个节点负责写入**。`original_claim` 设置后绝不覆盖，这是整个推理链的锚点。节点只读自己需要的字段，只写自己负责的字段，职责清晰。

`argument_map` 用 Pydantic 模型 `ArgumentMap` 校验，最终 `.model_dump()` 成 dict 存入 state，便于 JSON 序列化。

---

## 四、遇到的问题与解法

### 问题 1：SSE 分隔符 CRLF 导致事件被吞

**现象**：前端偶尔丢失事件，表现为某些 `node_end` 事件没有触发 UI 更新。

**根因**：SSE 协议规定用 `\n\n` 分隔事件。`sse-starlette` 实际发送的是 `\r\n\r\n`（CRLF）。前端原始代码 `text.split('\n\n')` 无法正确切割含 `\r` 的字符串，每隔一个事件就有一半内容被混入下一个事件的 raw 字符串里，解析后 `data` 字段为空，被静默丢弃。

**解法**：在 `readSSE.js` 里统一规范化：

```javascript
const normalized = rawText.replace(/\r\n/g, '\n')
const events = normalized.split('\n\n')
```

放在 shared utility 里而不是各自修，之后 `ResponseForm` 复用同一个 `readSSE` 函数，不会再出现同类问题。

---

### 问题 2：ChatPromptTemplate 把 JSON schema 里的 `{}` 当模板变量

**现象**：`synthesize` 节点调用时抛出 `KeyError`：

```
KeyError: 'Input to ChatPromptTemplate is missing variables {'\n  "core_claim"'}'
```

**根因**：`SYNTHESIZE_SYSTEM` 里有一段 JSON schema 示例：

```python
"""
Output this JSON:
{
  "core_claim": "...",
  "refined_claim": "..."
}
"""
```

Python 的 `str.format()` 调用时会把所有 `{...}` 解释为占位符，所以用了 `{{...}}` 双括号转义。但 `str.format()` 执行后双括号变成单括号，结果字符串里有裸露的 `{`。

`ChatPromptTemplate.from_messages()` 拿到这个字符串后**再次**做模板变量替换，把 `{\n  "core_claim"` 识别为一个变量名，`ainvoke` 时找不到这个 key，抛出 `KeyError`。

**解法**：绕开 `ChatPromptTemplate`，直接用 `SystemMessage` + `HumanMessage`：

```python
structured_llm = _llm(settings.synthesis_model).with_structured_output(SynthesizeOutput)
messages = [
    SystemMessage(content=SYNTHESIZE_SYSTEM),          # 原始字符串，不经过任何模板处理
    HumanMessage(content=SYNTHESIZE_USER.format(...))  # 只对 user message 做 .format()
]
result = await structured_llm.ainvoke(messages)
```

`SYNTHESIZE_SYSTEM` 里的 JSON schema 无需 `{{}}` 转义，直接写 `{}`，因为它不再经过任何模板引擎。

---

### 问题 3：向量库加载时找不到 OpenAI API key

**现象**：RAG 检索偶尔抛出 `AuthenticationError`，但 `.env` 里 key 明明存在。

**根因**：`ChromaDB` + `OpenAIEmbeddings` 初始化时，LangChain 默认从 `OPENAI_API_KEY` 环境变量读取 key。在某些部署环境下，环境变量加载顺序问题导致 `OpenAIEmbeddings()` 初始化时 key 还未注入。

**解法**：在 `retriever.py` 的 `_get_vectorstore()` 里显式传入：

```python
from ..config import settings
embeddings = OpenAIEmbeddings(
    model=settings.embedding_model,
    api_key=settings.openai_api_key,  # 明确传入，不依赖环境变量自动发现
)
```

---

## 五、Auto-Response 子系统设计

Socratic 回答阶段加了三个辅助端点，设计思路是**渐进式辅助**：

1. **`/auto-respond`**：一次生成 3 条回答，适合不想思考的用户。LLM 读取完整上下文（claim + attacks + questions），输出 JSON 数组，前端解析后填入三个 textarea。用 `await llm.ainvoke()` 而非流式，因为三条回答是原子结果。

2. **`/auto-respond-one`**：针对单条问题的流式建议，适合想参与但需要启发的用户。Token 级别流式输出，直接打进 textarea，有"打字机"效果。接受 `perspective_hint` 参数，当用户从 Tier 3 选了视角后，把视角的自然语言描述（而不是 stance ID）注入 system prompt 里的 `stance_instruction`。

3. **`/suggest-perspectives`**：为特定问题生成 3–4 个视角选项（"作为功利主义者"、"从历史角度"等）。非流式，返回 JSON。LLM 会根据 question 内容动态生成，而不是固定枚举，所以视角是上下文感知的。

这三个端点都复用 `_get_session_state()` 从 MemorySaver 里读取当前会话的完整 state，不需要前端把所有上下文重新发送过来。

---

## 六、总结

后端的设计核心是**把复杂性锁在正确的地方**：

- 流程复杂性交给 LangGraph 管理（节点顺序、状态传递、中断/恢复）
- 输出格式复杂性交给 Pydantic 管理（`with_structured_output`）
- 传输复杂性交给 SSE 管理（统一的事件流协议）
- API 层保持薄：FastAPI 的每个端点只做"读 session → 调 graph/LLM → 吐 SSE"，不包含业务逻辑
