# Dialectica — 中文支持技术文档

本文档定义 Dialectica 双语（中文 / 英文）支持的完整实现方案。目标是让中文用户获得与英文用户完全一致的体验，而不是简单地翻译界面文字。

---

## 设计原则

1. **语言跟着用户走，不跟着浏览器走** — 用户主动切换语言，选择持久化到 localStorage
2. **输入什么语言，输出什么语言** — 用户用中文输入论点，所有 AI 输出（Steelman、Attack、Socratic、Synthesis）全部用中文返回
3. **中文排版单独处理** — 中文字体、字号、行距与英文不同，不能共用同一套 CSS
4. **提示词中英分离** — 每个 LangGraph 节点维护两套 system prompt，根据语言选择注入

---

## 第一部分：语言检测与切换

### 语言状态管理

```js
// utils/language.js

const LANG_KEY = 'dialectica_lang';

export const LANGS = {
  EN: 'en',
  ZH: 'zh',
};

export function detectInitialLang() {
  // 1. 优先读用户上次的选择
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === LANGS.ZH || saved === LANGS.EN) return saved;

  // 2. 其次看浏览器语言
  const browserLang = navigator.language || navigator.userLanguage || '';
  if (browserLang.startsWith('zh')) return LANGS.ZH;

  // 3. 默认英文
  return LANGS.EN;
}

export function saveLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}
```

```jsx
// 在 Dialectica.jsx 顶层持有语言状态
const [lang, setLang] = useState(() => detectInitialLang());

const switchLang = (newLang) => {
  setLang(newLang);
  saveLang(newLang);
};
```

### 语言切换按钮

放在 Navbar 右侧，"New argument"按钮左边：

```jsx
<nav className="d-navbar-simple">
  <span className="d-navbar-wordmark">D I A L E C T I C A</span>
  <div className="d-navbar-right">
    <button
      className="d-lang-btn"
      onClick={() => switchLang(lang === 'en' ? 'zh' : 'en')}
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
    {isActive && (
      <button className="d-navbar-new-btn" onClick={handleReset}>
        {lang === 'en' ? 'New argument' : '新论点'}
      </button>
    )}
  </div>
</nav>
```

```css
.d-lang-btn {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: #C4A068;
  background: none;
  border: 1px solid #A8841E44;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 120ms;
  margin-right: 12px;
}
.d-lang-btn:hover {
  color: #E0B84A;
  border-color: #A8841E;
}
```

---

## 第二部分：UI 文案国际化

### 文案配置文件

```js
// i18n/strings.js

export const STRINGS = {
  en: {
    // Idle
    headline1:       'Make an argument.',
    headline2:       "We'll make it harder.",
    placeholder:     'Enter a claim, thesis, or position you want to defend…',
    beginBtn:        'BEGIN ↗',
    surpriseBtn:     'Surprise me →',
    footnote:        'Dialectica does not validate your thinking — it challenges it. The engine attacks your claim, questions your assumptions, and returns a stronger argument.',
    recentLabel:     'RECENT',
    clearBtn:        'Clear',

    // Active
    newArgBtn:       'New argument',
    pipelineNodes:   ['Understand', 'Steelman', 'Attack', 'Interrogate', 'Synthesize'],

    // Block labels
    yourClaim:       'YOUR CLAIM',
    coreClaim:       'CORE CLAIM · ASSUMPTIONS',
    steelman:        'STEELMAN',
    attacks:         'ATTACKS',
    socratic:        'SOCRATIC QUESTIONS',
    yourResponses:   'YOUR RESPONSES',
    refinedArg:      'REFINED ARGUMENT',

    // Response form
    stanceDefend:    'Defend my claim',
    stanceNuanced:   'Nuanced',
    stanceConcede:   'Concede the attacks',
    autoFillAll:     'Auto-fill all ↗',
    suggestBtn:      'Suggest →',
    regenerateBtn:   'Regenerate ↺',
    submitBtn:       'SUBMIT RESPONSES ↗',
    suggestAs:       'Suggest as:',
    cancelBtn:       'Cancel',

    // Argument map
    mapConceded:     'CONCEDED',
    mapRetained:     'RETAINED',
    mapVulnerable:   'VULNERABILITY',
    mapDelta:        'CONFIDENCE DELTA',

    // Categories
    categoryBar: ['Politics', 'Technology', 'Society', 'Philosophy', 'Science'],

    // Errors
    voiceNotSupported: 'Voice input requires Chrome or Safari.',
    autoRespondError:  'Generation failed. Please try again.',
  },

  zh: {
    // 空闲页
    headline1:       '提出一个论点。',
    headline2:       '我们让它更难成立。',
    placeholder:     '输入你想要捍卫的主张、论文或立场……',
    beginBtn:        '开始 ↗',
    surpriseBtn:     '随机一个 →',
    footnote:        'Dialectica 不会验证你的想法，它会挑战它。引擎攻击你的主张，质疑你的假设，并返回一个更强的论点。',
    recentLabel:     '最近使用',
    clearBtn:        '清除',

    // 进行页
    newArgBtn:       '新论点',
    pipelineNodes:   ['理解', '钢人论证', '攻击', '追问', '综合'],

    // 模块标签
    yourClaim:       '你的主张',
    coreClaim:       '核心主张 · 前提假设',
    steelman:        '钢人论证',
    attacks:         '反驳',
    socratic:        '苏格拉底式追问',
    yourResponses:   '你的回应',
    refinedArg:      '精炼后的论点',

    // 回应表单
    stanceDefend:    '坚守我的立场',
    stanceNuanced:   '综合判断',
    stanceConcede:   '承认反驳有效',
    autoFillAll:     '一键填写全部 ↗',
    suggestBtn:      '帮我回答 →',
    regenerateBtn:   '重新生成 ↺',
    submitBtn:       '提交回应 ↗',
    suggestAs:       '以何种立场回答：',
    cancelBtn:       '取消',

    // 论点地图
    mapConceded:     '已让步',
    mapRetained:     '已守住',
    mapVulnerable:   '仍存隐患',
    mapDelta:        '论证强度提升',

    // 分类
    categoryBar: ['政治', '科技', '社会', '哲学', '科学'],

    // 错误提示
    voiceNotSupported: '语音输入需要 Chrome 或 Safari 浏览器。',
    autoRespondError:  '生成失败，请重试。',
  },
};

// 使用方式
export const t = (lang, key) => STRINGS[lang][key] ?? STRINGS['en'][key];
```

### 组件内使用

```jsx
// 在所有组件中传入 lang prop
function ClaimInput({ lang, onAutoSubmit }) {
  return (
    <>
      <h1 className="d-h1">{t(lang, 'headline1')}</h1>
      <h2 className="d-h2">{t(lang, 'headline2')}</h2>
      <textarea placeholder={t(lang, 'placeholder')} />
      <button className="d-btn-begin">{t(lang, 'beginBtn')}</button>
    </>
  );
}
```

---

## 第三部分：示例论点与分类

### 中文示例论点

```js
// i18n/claims.zh.js

export const ZH_EXAMPLES = [
  '人工智能将取代大多数创意工作',
  '民主制度是最好的政治体制',
  '社交媒体加剧了政治极化',
];

export const ZH_RANDOM_CLAIMS = [
  // 科技
  '人工智能将在十年内取代大多数创意工作',
  '社交媒体公司应像公共事业一样受到监管',
  '加密货币终将取代法定货币',
  '远程工作从根本上优于办公室工作',
  '自动驾驶汽车将消除人为驾驶失误',

  // 社会
  '社交媒体使人们在政治上更加对立',
  '取消文化已经走得太远',
  '四天工作制应成为全球标准',
  '无条件基本收入会降低社会生产力',
  '精英大学的录取制度本质上是不公平的',

  // 哲学
  '自由意志只是一种幻觉',
  '意识无法被机器复制',
  '道德相对主义必然导致虚无主义',
  '死刑在任何情况下都不具有正当性',
  '人类本质上是自私的',

  // 政治
  '民主制度是目前最好的政治体制',
  '全球化对发展中国家弊大于利',
  '隐私权比国家安全更重要',
  '核能是解决气候问题的必要手段',

  // 文化
  'AI 生成的艺术不是真正的艺术',
  '应试教育不能准确衡量一个人的智识能力',
  '电子竞技应被认定为正式体育项目',
];

export const ZH_CLAIMS_BY_CATEGORY = {
  政治: [
    '民主制度是目前最好的政治体制',
    '全球化对发展中国家弊大于利',
    '隐私权比国家安全更重要',
  ],
  科技: [
    '人工智能将取代大多数创意工作',
    '社交媒体公司应像公共事业一样受到监管',
    '自动驾驶汽车将消除人为驾驶失误',
  ],
  社会: [
    '社交媒体使人们在政治上更加对立',
    '四天工作制应成为全球标准',
    '精英大学的录取制度本质上是不公平的',
  ],
  哲学: [
    '自由意志只是一种幻觉',
    '意识无法被机器复制',
    '道德相对主义必然导致虚无主义',
  ],
  科学: [
    '核能是解决气候变化问题的必要手段',
    '基因编辑人类胚胎应当被允许',
    '太空探索是对资源的浪费',
  ],
};
```

---

## 第四部分：后端提示词国际化

### 语言透传

前端在调用所有 `/dialectica/*` 接口时，在请求体中携带 `lang` 字段：

```js
// 所有请求统一携带 lang
fetch('/dialectica/start', {
  method: 'POST',
  body: JSON.stringify({ claim, lang }), // lang: "en" | "zh"
});
```

后端 `DialecticaState` 中增加 `lang` 字段：

```python
class DialecticaState(TypedDict):
    original_claim: str
    lang: str          # "en" | "zh" — 新增字段，贯穿所有节点
    # ... 其余字段不变
```

### 提示词语言注入

每个节点的 prompt 根据 `state["lang"]` 动态选择：

```python
# graph/prompts.py

UNDERSTAND_PROMPT = {
    "en": """
You are extracting the core claim and assumptions from a user's argument.

OUTPUT STYLE — NON-NEGOTIABLE:
- Distill the claim to one declarative sentence. No qualifications.
- List assumptions as short noun phrases, not full sentences.
- Maximum 4 assumptions.
- Respond in English.
""",
    "zh": """
你正在从用户的论点中提取核心主张和前提假设。

输出规范（不可违反）：
- 将主张精炼为一句陈述句，不加任何限定语。
- 以简短名词短语列出假设，而非完整句子。
- 最多列出 4 条假设。
- 用中文回答。
""",
}

STEELMAN_PROMPT = {
    "en": """...""",
    "zh": """
你正在为用户的论点构建最强版本（钢人论证）。

输出规范：
- 第一句直接给出该论点最强的表述，不要铺垫。
- 每条支撑证据最多 1-2 句。
- 行文风格：像一位自信的专家在陈述立场，而非中立的总结者。
- 来源引用格式：[论点]. 来源：[名称]
- 用中文回答。
""",
}

ATTACK_PROMPT = {
    "en": """...""",
    "zh": """
你正在生成针对用户论点的三条反驳。

输出规范（不可违反）：
- 每条反驳直接以反证或反例开头，不要铺垫句。
- 每条最多 2 句：第一句是反驳，第二句是来源或推论。
- 语气像交叉质询，而非文献综述。
- 三条反驳分别针对：事实层面、逻辑层面、定义/范围层面。
- 不要用"然而，值得注意的是，原始主张也有其合理性……"来软化攻击。
- 用中文回答。

格式：
[直接反驳，一句话]。[来源或推论，一句话]
""",
}

INTERROGATE_PROMPT = {
    "en": """...""",
    "zh": """
你正在生成三个苏格拉底式追问。

输出规范（不可违反）：
- 每个问题恰好一句话。
- 每个问题包含一个明确的前提，用户必须选择捍卫或放弃它。
- 用户读完应感到被逼到墙角，而非被邀请随意发挥。
- 禁止使用："你能解释一下……"、"你怎么看……"、"你有没有考虑过……"
- 不问"X 是什么"式的开放问题，只问有具体隐含答案的问题。
- 每个问题针对理解节点提取的不同假设。
- 用中文回答。
""",
}

SYNTHESIZE_PROMPT = {
    "en": """...""",
    "zh": """
你正在为用户综合出一个精炼后的论点。

输出规范（不可违反）：
- 第一句直接给出修正后的主张，这是本节点的核心交付物。
- 之后最多 3 句论证。
- 精炼后的主张必须是用户能在辩论中直接说出口的话。
- 禁止元评论，不要写："在分析了各种攻击之后……"、"通过这一辩证过程……"
- 让步要简洁、具体，不要反复强调。
- 结尾应让用户感到他们赢得了某些东西，而非输掉了论点。
- 用中文回答。

格式：
[修正后的主张——一句话]
[为何它能经受住最强攻击——1-2 句]
[让步了什么，以及为何这让主张更强——1 句]
""",
}

AUTO_RESPOND_PROMPT = {
    "en": """...""",
    "zh": """
你正在代表用户生成对苏格拉底式追问的回应。

原始主张：{original_claim}
苏格拉底问题：{socratic_questions}
挑战主张的反驳：{attacks}
立场：{stance}

立场说明：
- "defend"（坚守）：反驳每个问题的前提，找出问题本身的弱点，坚持原始主张。
- "concede"（让步）：承认每个问题指出了真实的弱点，在每条回应中软化主张。
- "nuanced"（综合）：对最强的攻击让步，对最弱的攻击坚守，独立评估每个问题。

输出规范：
- 每条回应 2-4 句话。
- 听起来像一个在思考的人在说话，而非在写论文。
- 每条回应直接从用户的立场出发，不要重复问题内容。
- 禁止以"这是个好问题"或"我理解你的顾虑"开头。
- 用中文回答。

只返回合法 JSON，不要任何前言或 Markdown：
[
  "对问题一的回应……",
  "对问题二的回应……",
  "对问题三的回应……"
]
""",
}

# 节点内调用示例
def get_prompt(key, lang):
    prompts = {
        "understand": UNDERSTAND_PROMPT,
        "steelman":   STEELMAN_PROMPT,
        "attack":     ATTACK_PROMPT,
        "interrogate": INTERROGATE_PROMPT,
        "synthesize": SYNTHESIZE_PROMPT,
        "auto_respond": AUTO_RESPOND_PROMPT,
    }
    return prompts[key].get(lang, prompts[key]["en"])
```

---

## 第五部分：中文排版

中文和英文的排版规则不同，必须单独处理。

### 字体栈

```css
:root {
  /* 英文字体栈（已有）*/
  --d-serif: Georgia, 'Times New Roman', serif;
  --d-sans:  system-ui, -apple-system, sans-serif;

  /* 中文字体栈（新增）*/
  --d-serif-zh: 'Noto Serif SC', 'Source Han Serif SC', 'STSong', 'SimSun', Georgia, serif;
  --d-sans-zh:  'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
```

加载 Google Fonts（在 `index.html` 的 `<head>` 中）：

```html
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

### 中文专属 CSS

```css
/* Dialectica.css */

/* 当语言为中文时，覆盖字体和排版 */
.lang-zh .d-h1 {
  font-family: var(--d-serif-zh);
  font-size: 48px;       /* 中文字号略小，视觉重量相近 */
  line-height: 1.3;      /* 中文行距更大 */
  letter-spacing: 0.02em;
}

.lang-zh .d-h2 {
  font-family: var(--d-serif-zh);
  font-size: 48px;
  line-height: 1.3;
  font-style: normal;    /* 中文没有真斜体，禁用 italic */
  letter-spacing: 0.02em;
}

.lang-zh .btxt {
  font-family: var(--d-serif-zh);
  font-size: 16px;       /* 中文正文略小 */
  line-height: 2;        /* 中文需要更大行距 */
  letter-spacing: 0.01em;
}

.lang-zh .d-ta,
.lang-zh .d-response-ta {
  font-family: var(--d-sans-zh);
  font-size: 17px;
  line-height: 1.9;
}

.lang-zh .d-chip,
.lang-zh .d-category-claim-card {
  font-family: var(--d-sans-zh);
  font-style: normal;    /* 中文 chip 不用斜体 */
}

.lang-zh .blbl,
.lang-zh .d-rlbl {
  font-family: var(--d-sans-zh);
  letter-spacing: 0.08em; /* 中文标签 letter-spacing 收窄 */
}

/* 中文标点挤压 */
.lang-zh {
  font-feature-settings: "chws" 1; /* CJK 标点挤压，现代浏览器支持 */
}

/* 移动端中文字号 */
@media (max-width: 767px) {
  .lang-zh .d-h1,
  .lang-zh .d-h2 {
    font-size: 34px;
  }
}
```

### 在根元素挂载语言 class

```jsx
// Dialectica.jsx
<div className={`dialectica-page lang-${lang}`}>
  ...
</div>
```

### 中文特殊处理

**禁用斜体**：中文字体没有真正的 italic 字型，浏览器会用算法倾斜，效果很差。凡是用 `font-style: italic` 的地方，在 `.lang-zh` 下全部覆盖为 `normal`。

**标点符号**：中文中的括号、引号用全角：`（）`、`「」` 而非 `()`、`""`。在提示词中对 AI 明确约束：

```
中文输出时，使用全角标点：
- 括号：（）而非 ()
- 引号：「」或""而非 ""
- 句号：。而非 .
```

---

## 第六部分：语音输入中文支持

```js
// hooks/useSpeechInput.js

export function useSpeechInput(onTranscript, lang) {
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;

    // 根据语言设置识别语言
    r.lang = lang === 'zh' ? 'zh-CN' : 'en-US';

    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(result => result[0].transcript)
        .join('');
      onTranscript(transcript);
    };

    r.start();
  };

  return { start };
}
```

---

## 第七部分：URL 参数支持

URL 参数同样支持中文（需 URL 编码）：

```
/dialectica?claim=人工智能将取代大多数创意工作&lang=zh
```

```js
// Dialectica.jsx — 挂载时读取参数
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const claimParam = params.get('claim');
  const langParam  = params.get('lang');

  if (langParam === 'zh' || langParam === 'en') {
    setLang(langParam);
    saveLang(langParam);
  }

  if (claimParam) {
    const decoded = decodeURIComponent(claimParam.trim());
    setClaim(decoded);
    setTimeout(() => handleBegin(decoded), 600);
  }
}, []);
```

生成中文深链接示例：

```js
dialecticaUrl('人工智能将取代大多数创意工作', 'zh')
// → /dialectica?claim=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E5%B0%86%E5%8F%96%E4%BB%A3%E5%A4%A7%E5%A4%9A%E6%95%B0%E5%88%9B%E6%84%8F%E5%B7%A5%E4%BD%9C&lang=zh
```

---

## 第八部分：实现顺序

按以下顺序实现，不要并行：

| 步骤 | 内容 | 时间估算 |
|---|---|---|
| 1 | `language.js` 工具函数 + `detectInitialLang` | 30 分钟 |
| 2 | `strings.js` 文案配置 + `t()` 函数 | 1 小时 |
| 3 | 所有组件接入 `lang` prop，替换硬编码文字 | 2 小时 |
| 4 | Navbar 语言切换按钮 | 30 分钟 |
| 5 | 中文 CSS 排版覆盖（`lang-zh` class） | 1 小时 |
| 6 | 后端 `lang` 字段透传 + 中文提示词 | 2 小时 |
| 7 | 中文示例论点和分类数据 | 30 分钟 |
| 8 | URL 参数 `lang` 支持 | 30 分钟 |
| 9 | 语音识别语言切换 | 15 分钟 |

**总计：约 8 小时**

---

## 注意事项

- **不要机器翻译提示词**：中文提示词需要人工重写，机器翻译的提示词质量很差，AI 输出会混乱。本文档中的中文提示词已人工撰写，直接使用。
- **中文输出长度会更短**：中文字符信息密度高，同样的语义内容，中文字数约为英文的 60%。前端的"超过 160 字折叠"规则在中文模式下应调整为 80 字。
- **不要硬编码"I. II. III."罗马数字**：中文模式下改用"一、二、三、"或保持罗马数字（均可接受，保持一致即可）。
- **测试优先级**：优先测试 Attack 和 Synthesize 节点的中文输出，这两个节点最容易出现语言混用（中文输入夹杂英文术语输出）。