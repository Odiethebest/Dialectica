# 设计思路：前端

## 一、核心问题

前端需要解决三件事：

1. **状态驱动的 UI**：后端是一条 5 步流水线，前端要把每一步的输出实时渲染出来，同时正确处理"正在流式输出"和"已完成"两种状态
2. **零摩擦入口**：用户要在最短路径内开始一次论证——不能让空白 textarea 成为门槛
3. **视觉语言一致**：Dialectica 不是一个普通的 chatbot，它应该有沉浸感，视觉上呼应"古典辩证"的主题

---

## 二、技术栈选择

### React 19 + Vite：嵌入现有站点

Dialectica 是 `odieyang.com` 的一个路由（`/dialectica`），不是独立部署的应用，所以直接复用已有的 React + Vite 技术栈，不引入任何新的框架。

这个决策带来一个约束：**没有 Next.js，没有 Router，没有全局状态库**。所有状态集中在 `useDialectica` 一个 hook 里，组件完全受控（props-in, events-out）。

### useDialectica：单一状态源

整个对话的状态只存在一个地方：

```javascript
{
  mode: 'idle' | 'streaming' | 'awaiting_input' | 'complete' | 'error',
  currentNode: null | 'understand' | 'steelman' | 'attack' | 'interrogate' | 'synthesize',
  sessionId: null | string,
  coreClaim, claimAssumptions,
  steelmanText, steelmanSources,
  attacks, attackSources,
  socraticQuestions,
  synthesis, argumentMap,
  error,
}
```

`mode` 是渲染逻辑的主开关：
- `idle` → 渲染 `ClaimInput`
- `streaming` / `awaiting_input` / `complete` → 渲染 `DialogueThread`
- `error` → 在 `DialogueThread` 底部渲染错误提示

`currentNode` 决定 `PipelineStatus` 里哪个节点高亮，以及每个 block 是否处于 `isStreaming` 状态。

### SSE 而非 EventSource API

CLAUDE.md 里明确写了"不用 `EventSource` API"。原因：`EventSource` 不支持 POST 请求，只支持 GET，无法把 claim 放在请求体里。

用 `fetch` + async generator 代替：

```javascript
// utils/readSSE.js
export async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const normalized = buffer.replace(/\r\n/g, '\n')
    const parts = normalized.split('\n\n')
    buffer = parts.pop()
    for (const part of parts) {
      // 解析 event: xxx \n data: {...}
      ...
      yield { type, data }
    }
  }
}
```

`readSSE` 提取为独立 utility，`useDialectica` 和 `ResponseForm` 共用同一份，避免两处各自实现导致行为不一致。

---

## 三、视觉设计思路

### 主题：学术辩证

颜色系统围绕两个核心：`maroon（#6B1020）` 和 `gold（#C9A84C）`，配合米白色（`#F3EDE4`）背景，整体感觉接近古典书院或法庭辩论的氛围——严肃、有力量感，不是普通 chatbot 的蓝白冷感。

每个对话 block 的颜色有语义：
- **Understand / Claim**：浅米白（`#F3EDE4`）——中性，陈述事实
- **Steelman**：暖黄（`#EDE0C4`）——加温，代表支持立场
- **Attack**：深红（`#6B1020`）——警示，代表对抗
- **Socratic**：奶油白（`#FDF5E6`）——柔和，引导思考
- **Synthesis**：深金（`#F0E8D4`）——成熟，代表结论

### Parchment SVG：把 UI 变成实体

纯矩形 card 太现代、太像 dashboard，和"辩证"这个主题有割裂感。设计决策是把每个 block 渲染成**手撕羊皮纸**的形状——边缘不规则，有压墨感的横线，像中世纪手稿。

实现路径：

1. `parchmentPath(width, height, roughness)` 用 Math.random() + 四边各自不同的扰动参数生成 SVG path（底边最粗糙，代表撕裂；顶边最平整；左右轻微起伏）
2. SVG 叠在 div 背景层，内容在 `position: relative` 的层上面
3. 5 条虚线横线模拟行文格线，用极低 opacity 不抢眼

**最大的技术挑战**是**streaming 期间无法生成 SVG**：block 刚挂载时内容只有一个光标，高度很小；随着 token 涌入 div 不断增高；如果这时生成 SVG，path 的 height 会偏小，内容溢出 SVG 边界。

**解法**：两阶段渲染：

```
isStreaming=true  →  plain <div>（有背景色，无 SVG，内容正常可见）
isStreaming=false →  visibility:hidden（内容撑开布局）
                     useEffect → requestAnimationFrame → 测量实际高度
                     → 生成 SVG → setSvg → visibility:visible + parchment-in 动画
```

`requestAnimationFrame` 确保 React 已完成 DOM 更新、浏览器已完成 layout，这时 `getBoundingClientRect()` 才能拿到正确的 settled 尺寸。

---

## 四、零摩擦入口设计

空白 textarea 是最大的用户门槛。设计了 6 个互相独立的入口，每个都通过同一个 `handleAutoSubmit(text)` 函数处理：

```javascript
const handleAutoSubmit = useCallback((text) => {
  if (!text || text.trim().length < 3) return
  const trimmed = text.trim()
  setClaim(trimmed)
  saveToHistory(trimmed)
  setTimeout(() => {
    setOriginalClaim(trimmed)
    startSession(trimmed)
  }, 300)
}, [startSession])
```

300ms 延迟是给用户一个视觉确认（textarea 先填上内容），然后自动触发。

6 个入口：

| 入口 | 触发方式 | 适合场景 |
|---|---|---|
| 示例 chip | 点击即提交 | 随便看看 |
| 分类 + claim card | 选分类 → 点 card | 有主题方向 |
| "Surprise me" | 点击随机填充 | 不知道写什么 |
| localStorage 历史 | 点击历史条目 | 回来继续 |
| URL `?claim=` | 页面加载时自动触发 | 分享链接给别人 |
| 语音输入 | 长按麦克风 | 移动端 |

**claim 状态提升**：最初 `claim` state 在 `ClaimInput` 组件内部。加入多入口后，URL 参数和语音输入都需要在 `App.jsx` 层面设置 claim 值，所以把 `claim` 提升到 `App`，`ClaimInput` 变成完全受控组件（`value + onChange`）。这样所有入口都操作同一个 state，不会出现"textarea 显示的和实际提交的不一致"。

---

## 五、三层自动回答

Socratic 回答阶段是用户最可能卡住的环节——三个哲学性问题同时出现，很多人不知道怎么回答。设计了三层辅助，从粗到细：

**Tier 1 — 全局立场 + 一键填充**

用户先选立场（捍卫 / 中立 / 让步），再点"Auto-fill all"，后端用完整上下文生成 3 条回答一次性填入。适合想直接看 synthesis 结果的用户。

**Tier 2 — 单题流式建议**

每个 textarea 旁边有"Suggest →"按钮，点击后后端流式输出这一题的建议，实时打入 textarea。用户可以在建议的基础上修改，比直接全部生成更有参与感。

**Tier 3 — 视角选择器**

第一次点"Suggest →"（textarea 空且没选过视角）时，先向后端请求 3–4 个针对这道题的视角选项（"作为经验主义者"、"从制度角度"等）。用户选了视角后，视角描述作为 `perspective_hint` 传给 Tier 2 端点，LLM 从那个视角生成回答。

**状态独立**：`ResponseTextarea` 是 `ResponseForm` 的子组件，每个 textarea 维护自己的 `suggesting`、`perspectives`、`selectedPersp` 状态，互不干扰。全局的 `stance` 和 `responses` 数组在 `ResponseForm` 层管理。

`ResponseForm` 不再从父组件接收 `responses`/`onChange`——它自己管理这些状态，只在用户点 Submit 时把最终值通过 `onSubmit(responses)` 向上传递。这是一个**受控表单降级为非受控**的设计决策，减少了父组件的复杂度，也避免了三个 textarea 的每次 keystroke 都触发 `App` 的 re-render。

---

## 六、遇到的问题与解法

### 问题 1：Parchment SVG 尺寸与内容不匹配

**现象**：streaming 结束后 SVG 渲染出来，但内容溢出羊皮纸边界——SVG 的高度远小于实际内容高度。

**根因**：`useEffect` 在 React commit phase 执行，此时 DOM 节点存在，但浏览器的 layout（盒模型计算）还没完成，`getBoundingClientRect()` 返回的高度仍是上一帧的值（streaming 时的较小高度）。

**解法**：用 `requestAnimationFrame` 把测量延到下一帧：

```javascript
const raf = requestAnimationFrame(() => {
  const { width, height } = el.getBoundingClientRect()
  if (width === 0 || height === 0) return
  const d = parchmentPath(width, height, cfg.roughness)
  setSvg({ d, width, height })
})
return () => cancelAnimationFrame(raf)
```

在 cleanup 里取消 rAF 防止组件卸载后 setState 报 warning。

---

### 问题 2：visibility:hidden 导致 streaming 期间内容不可见

**现象**：加入 `visibility: hidden` 后，streaming 期间 block 完全不可见，用户看不到任何内容在流入。

**根因**：最初 `visibility: hidden` 贯穿整个生命周期（只要 svg 还是 null 就 hidden），streaming 期间 svg 当然是 null，所以内容不可见。

**解法**：把 streaming 状态单独抽出，不走 SVG 路径：

```jsx
if (isStreaming) {
  return <div style={{ background: cfg.fill }}>...</div>  // plain div，始终可见
}
// 非 streaming：走 visibility:hidden → measure → SVG 路径
```

两条渲染路径完全分离，不相互干扰。

---

### 问题 3：多入口共存导致历史记录重复保存

**现象**：用户点了一个 chip（自动提交），chip 触发 `handleAutoSubmit` → `saveToHistory`；但 textarea 的 onChange 在 `handleAutoSubmit` 的 `setClaim` 后也触发一次 `saveToHistory`（原来 `ClaimInput` 内部也有一处保存）。

**根因**：引入零摩擦功能前，保存历史的逻辑散落在 `ClaimInput` 的多处，每个入口有自己的处理逻辑。

**解法**：统一只在 `handleAutoSubmit` 和 `handleStart`（手动 Begin 按钮）里各调用一次 `saveToHistory`，`ClaimInput` 内部不再有任何历史操作。`claim` state 提升到 `App` 后，这个统一变得很自然——因为所有入口都必须经过 `App` 的 handler，而不是在组件内自行处理。

---

## 七、总结

前端的设计核心是**在复杂交互下保持渲染逻辑的可预测性**：

- 状态集中：`useDialectica` 是唯一数据源，组件只渲染 props
- 路径分离：streaming 和 settled 两种状态走完全不同的渲染路径，不混在一起
- 入口统一：6 个零摩擦入口都汇聚到同一个 `handleAutoSubmit`，行为一致
- 组件自治：`ResponseForm` 管理自己的 textarea 状态，不把每次 keystroke 暴露给父组件
