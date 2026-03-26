export const STRINGS = {
  en: {
    // Idle
    headline1:        'Make an argument.',
    headline2:        "We'll make it harder.",
    placeholder:      'Enter a claim, thesis, or position you want to defend…',
    beginBtn:         'Begin ↗',
    surpriseBtn:      'Surprise me →',
    footnote:         'Dialectica does not validate your thinking — it challenges it. The engine attacks your claim, questions your assumptions, and returns a stronger argument.',
    recentLabel:      'Recent',
    clearBtn:         'Clear',

    // Active
    newArgBtn:        'New argument',
    pipelineNodes:    ['Understand', 'Steelman', 'Attack', 'Interrogate', 'Synthesize'],

    // Block labels
    yourClaim:        'Your claim',
    coreClaim:        'Core claim · Assumptions',
    steelman:         'Steelman',
    attacks:          'Attacks',
    socratic:         'Socratic questions',
    yourResponses:    'Your responses',
    refinedArg:       'Refined argument',

    // Understand block
    assumes:          'Assumes:',

    // Response form
    stanceDefend:     'Defend my claim',
    stanceNuanced:    'Nuanced',
    stanceConcede:    'Concede the attacks',
    autoFillAll:      'Auto-fill all ↗',
    generating:       'Generating…',
    suggestBtn:       'Suggest →',
    regenerateBtn:    'Regenerate ↺',
    writing:          'Writing…',
    loading:          'Loading…',
    suggestAs:        'Suggest as:',
    cancelBtn:        'Cancel',
    submitBtn:        'Submit responses ↗',
    responsePlaceholder: (roman) => `Response to question ${roman}…`,

    // Argument map
    mapConceded:      'Conceded',
    mapRetained:      'Retained',
    mapVulnerable:    'Vulnerability',
    mapDelta:         'Confidence delta',

    // ReadMore
    readMore:         'Read more →',
    readLess:         'Read less ←',

    // Errors
    voiceNotSupported: 'Voice input requires Chrome or Safari.',
    errorMsg:          'Something went wrong. Please try again.',
  },

  zh: {
    // 空闲页
    headline1:        '提出一个论点。',
    headline2:        '我们让它更难成立。',
    placeholder:      '输入你想要捍卫的主张、论文或立场……',
    beginBtn:         '开始 ↗',
    surpriseBtn:      '随机一个 →',
    footnote:         'Dialectica 不会验证你的想法，它会挑战它。引擎攻击你的主张，质疑你的假设，并返回一个更强的论点。',
    recentLabel:      '最近使用',
    clearBtn:         '清除',

    // 进行页
    newArgBtn:        '新论点',
    pipelineNodes:    ['理解', '钢人论证', '攻击', '追问', '综合'],

    // 模块标签
    yourClaim:        '你的主张',
    coreClaim:        '核心主张 · 前提假设',
    steelman:         '钢人论证',
    attacks:          '反驳',
    socratic:         '苏格拉底式追问',
    yourResponses:    '你的回应',
    refinedArg:       '精炼后的论点',

    // Understand block
    assumes:          '前提：',

    // 回应表单
    stanceDefend:     '坚守我的立场',
    stanceNuanced:    '综合判断',
    stanceConcede:    '承认反驳有效',
    autoFillAll:      '一键填写全部 ↗',
    generating:       '生成中…',
    suggestBtn:       '帮我回答 →',
    regenerateBtn:    '重新生成 ↺',
    writing:          '写作中…',
    loading:          '加载中…',
    suggestAs:        '以何种立场回答：',
    cancelBtn:        '取消',
    submitBtn:        '提交回应 ↗',
    responsePlaceholder: (roman) => `对问题 ${roman} 的回应…`,

    // 论点地图
    mapConceded:      '已让步',
    mapRetained:      '已守住',
    mapVulnerable:    '仍存隐患',
    mapDelta:         '论证强度变化',

    // ReadMore
    readMore:         '展开 →',
    readLess:         '收起 ←',

    // 错误提示
    voiceNotSupported: '语音输入需要 Chrome 或 Safari 浏览器。',
    errorMsg:          '出现错误，请重试。',
  },
}

export const t = (lang, key) => STRINGS[lang]?.[key] ?? STRINGS['en'][key]
