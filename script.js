/**
 * Rethinka onboarding — branch script.
 *
 * A step graph. Every node renders into the phone body and (optionally) writes
 * into `slots`, which is the half-built decision card the progress rail previews.
 *
 * PACING MODEL
 * Screens are not painted at once. Each node is a sequence of "beats" the runtime
 * plays with reading-time gaps, so the user is never handed more than one new
 * thought at a time:
 *
 *   [user echo] -> [typing…] -> [ack: I heard you] -> pause -> [next question] -> [options]
 *
 * The `ack` on each option is what makes the agent feel present rather than like
 * a form: it proves the specific answer registered and says what it changes.
 *
 * Node shape:
 *   phase       - proposition | evidence | structure | discipline | done
 *   mapStep     - 0..3 index into the four-step map, or null
 *   say / sayFn - agent bubbles for the question itself
 *   options / optionsFn - choice chips
 *                 { title, sub?, tag?, kind?, set?, next, ack? }
 *                 ack: what the agent says back after this specific choice
 *   render?     - custom renderer name for rich screens
 *   story       - { title, why, tags[] } shown in the right panel
 */

export const ENTRIES = [
  { id: "analyze", label: "1 · 分析一笔交易" },
  { id: "review", label: "2 · 复盘我的持仓" },
  { id: "explore", label: "3 · 找一个机会" },
  { id: "voice", label: "★ 按住说话（越级）" },
];

export const STEPS = [
  { key: "proposition", label: "命题" },
  { key: "evidence", label: "证据" },
  { key: "structure", label: "结构" },
  { key: "discipline", label: "纪律" },
];

/** The seven slots that make up a decision card. Rail shows fill progress. */
export const SLOT_DEFS = [
  { key: "symbol", label: "标的" },
  { key: "direction", label: "方向" },
  { key: "horizon", label: "时间窗口" },
  { key: "why", label: "为什么是现在" },
  { key: "invalidation", label: "失效条件" },
  { key: "structure", label: "交易表达" },
  { key: "rule", label: "纪律规则" },
];

/**
 * Discipline rules are symbol/thesis-specific. Picking the wrong set is how a
 * guided flow starts feeling like a template — a TSLA review must never offer
 * "数据中心指引下调" as a rule.
 */
export const RULE_SETS = {
  nvda: {
    price: { title: "跌破 $158 我就减半", rule: "跌破 $158 → 减半仓" },
    thesis: { title: "数据中心指引下调我就走", rule: "数据中心指引下调 → 退出" },
    time: { title: "财报后第二天必须复盘一次", rule: "财报后 T+1 强制复盘" },
  },
  tsla: {
    price: { title: "跌破 $195 我就减半", rule: "跌破 $195 → 减半仓" },
    thesis: { title: "Robotaxi 指引再推迟我就走", rule: "Robotaxi 指引再推迟 → 退出" },
    time: { title: "每季度交付数据出来后复盘一次", rule: "季度交付数据 → 强制复盘" },
  },
  generic: {
    price: { title: "跌破我的成本价 15% 就减半", rule: "回撤 15% → 减半仓" },
    thesis: { title: "买入理由被事实推翻我就走", rule: "命题被证伪 → 退出" },
    time: { title: "下次财报后必须复盘一次", rule: "财报后 T+1 强制复盘" },
  },
};

export function ruleSetKey(state) {
  const sym = String(state.slots.symbol || "").toUpperCase();
  if (sym.includes("NVDA")) return "nvda";
  if (sym.includes("TSLA")) return "tsla";
  return "generic";
}

export const NODES = {
  /* ============================================================= WELCOME */

  welcome: {
    phase: "proposition",
    mapStep: null,
    rail: false,
    say: [
      { t: "嗨，我是你的投研搭档。", cls: "lead" },
      { t: "先说好：这里<b>不连券商、不会下单</b>，你说什么都不会花钱。", cls: "sub" },
      { t: "我们从一件具体的事开始吧——你最近在琢磨哪笔交易？" },
    ],
    options: [
      {
        title: "我有个标的，想验证一下",
        sub: "心里有方向，但还不太确定",
        tag: "最常见",
        next: "a_symbol",
        ack: "好，那我们就把它拆开看看。",
      },
      {
        title: "我已经买了，但心里没底",
        sub: "拿着不舒服，又不知道该不该走",
        next: "b_import",
        ack: "这种感觉我懂。拿不住往往不是因为亏，是因为忘了当初为什么买。",
      },
      {
        title: "还没想法，随便看看",
        sub: "想找点值得研究的东西",
        next: "c_theme",
        ack: "没想法才是常态，别有压力。",
      },
      {
        title: "先看别人怎么做的",
        sub: "用一个真实案例走一遍，我什么都不用填",
        kind: "relief",
        next: "a_thinking",
        set: {
          symbol: "NVDA · 纳斯达克",
          direction: "看多",
          horizon: "几周（财报前后）",
          why: "财报催化剂",
        },
        sample: true,
        ack: "那我拿 NVDA 做个示范，你只管看。",
      },
    ],
    story: {
      title: "Welcome：先自我介绍，再问问题",
      why: "原来第一句是「你想把哪笔交易想清楚」——正确但冷。现在先说<strong>「我是你的投研搭档」</strong>并主动交代「不连券商、不会下单」，把用户的防备心先放下，再问问题。选项也从功能命名（分析/复盘/探索）改成<strong>用户会对自己说的话</strong>（「我已经买了，但心里没底」）。",
      tags: ["TTFV < 90s", "先降防备再提问", "用用户的话写选项"],
    },
  },

  /* ================================================= ENTRY A — 分析一笔交易 */

  a_symbol: {
    phase: "proposition",
    mapStep: 0,
    say: [{ t: "说说是哪一个？", cls: "lead" }],
    render: "search",
    options: [
      {
        title: "NVDA",
        sub: "英伟达 · 纳斯达克 · $184.22",
        next: "a_direction",
        set: { symbol: "NVDA · 纳斯达克" },
        ack: "英伟达。这只票故事多、噪音也多，正好适合理一理。",
      },
      {
        title: "600519",
        sub: "贵州茅台 · 上交所 · ¥1,472.00",
        next: "a_direction",
        set: { symbol: "600519 · 上交所" },
        ack: "茅台。这只票的分歧基本都在「还能不能提价」上。",
      },
      {
        title: "0700.HK",
        sub: "腾讯控股 · 港交所 · HK$612.50",
        next: "a_direction",
        set: { symbol: "0700.HK · 港交所" },
        ack: "腾讯。行，港股这边我也能拉到数据。",
      },
      {
        title: "还没定，你给我个例子",
        sub: "先用一个公开样例走一遍",
        kind: "relief",
        next: "a_direction",
        set: { symbol: "NVDA · 纳斯达克（样例）" },
        ack: "那就用 NVDA 当靶子。流程走通了，换成你的票也一样。",
      },
    ],
    story: {
      title: "命题 1/4：标的",
      why: "真实搜索优先，样例是兜底而不是主路径。选中样例时会一路带上 <strong>as-of 数据日期</strong>标注，避免用户误以为是实时行情。",
      tags: ["真实 ticker 搜索", "公开样例兜底", "标注 as-of"],
    },
  },

  a_direction: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "你心里是往哪边想的？" },
      { t: "不用怕说错，这里没有人给你打分。<b>「说不准」我也接得住。</b>", cls: "sub" },
    ],
    options: [
      {
        title: "我觉得会涨",
        sub: "可能是低估了，也可能有什么要发生",
        next: "a_horizon",
        set: { direction: "看多" },
        ack: "看多。那我待会儿会特别留意：有没有什么事实是反对你的。",
      },
      {
        title: "我觉得会跌",
        sub: "太贵了，或者基本面在变差",
        next: "a_horizon",
        set: { direction: "看空" },
        ack: "看空。做空最怕的是对的太早，我们把时间也说清楚。",
      },
      {
        title: "我在等一个信号",
        sub: "还没到动手的时候",
        next: "a_horizon",
        set: { direction: "观望" },
        ack: "等信号是个正经策略——前提是你说得出等的是什么。",
      },
      {
        title: "真说不准",
        sub: "所以才想找人捋一捋",
        kind: "relief",
        tag: "我会换个方式",
        next: "a_horizon",
        set: { direction: "未定 · 待证据裁决" },
        neutral: true,
        ack: "那我就不替你站队了。等下我把正反两面摆一样清楚，你自己看完再决定。",
      },
    ],
    story: {
      title: "命题 2/4：方向 —— 「说不准」是一等公民",
      why: "「不用怕说错，这里没有人给你打分」是这一屏的关键一句：<strong>先解除评价焦虑，再要答案</strong>。而且每个方向都有专属回应——选看空会听到「做空最怕的是对的太早」，这种<strong>只有懂行的人才说得出的话</strong>，是建立信任最快的方式。选「真说不准」之后 AI 行为真的不同：不站队，正反对称。",
      tags: ["解除评价焦虑", "回应体现专业", "降压选项改变行为"],
    },
  },

  a_horizon: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "打算拿多久？" },
      { t: "问这个不是走流程——<b>拿几天和拿几个月，该看的东西完全不一样。</b>", cls: "sub" },
    ],
    options: [
      {
        title: "几天就走",
        sub: "赚一波就跑",
        next: "a_why",
        set: { horizon: "几天（事件驱动）" },
        ack: "那基本面就先放一边了，我主要给你看事件、资金流和期权那边的动静。",
      },
      {
        title: "几周",
        sub: "等一个事情发生",
        next: "a_why",
        set: { horizon: "几周（催化剂驱动）" },
        ack: "几周的话，催化剂日历和关键技术位最要紧，我按这个来找。",
      },
      {
        title: "几个月，甚至更久",
        sub: "我不想天天盯盘",
        next: "a_why",
        set: { horizon: "几个月（基本面驱动）" },
        ack: "那短期波动基本可以忽略了。我重点看基本面、估值和行业格局。",
      },
      {
        title: "没想过这个问题",
        sub: "买了再说",
        kind: "relief",
        next: "a_why",
        set: { horizon: "几周（默认，可改）" },
        ack: "很正常，大部分人都是。我先按「几周」给你算，你随时能改。",
      },
    ],
    story: {
      title: "命题 3/4：把「教学」从选项挪进回应",
      why: "上一版把「我会优先看什么证据」写在选项副标题里，信息量对但读起来像说明书。现在<strong>选项只写用户的大白话</strong>（「几天就走 / 赚一波就跑」），把教学放到<strong>选完之后的回应</strong>里。同样的信息，从「你要读」变成「我告诉你」，压力小很多。",
      tags: ["选项说人话", "教学放进回应", "先答后教"],
    },
  },

  a_why: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "最后一个问题：为什么是<b>现在</b>？", cls: "lead" },
      { t: "这只票一直都在，你偏偏这几天想起它——总有个由头。", cls: "sub" },
    ],
    options: [
      {
        title: "财报快到了",
        sub: "或者刚出，感觉还没反应完",
        next: "a_thinking",
        set: { why: "财报催化剂" },
        ack: "财报前后确实是信息最密集的时候，也是最容易被情绪带跑的时候。",
      },
      {
        title: "跌了一波，我觉得跌过头了",
        sub: "想抄个底",
        next: "a_thinking",
        set: { why: "超跌反弹" },
        ack: "「跌多了」是个感觉，我们等下把它变成一个能验证的说法。",
      },
      {
        title: "看到了什么消息",
        sub: "新产品、政策、并购之类的",
        next: "a_thinking",
        set: { why: "事件催化剂" },
        ack: "消息驱动最怕的是「大家都知道了」。我查一下这个消息扩散到哪一步了。",
      },
      {
        title: "图形看着要动了",
        sub: "突破、站上均线之类的",
        next: "a_thinking",
        set: { why: "技术形态" },
        ack: "技术面我会看，但也会帮你确认一下基本面有没有在拖后腿。",
      },
      {
        title: "说不上来，就是有感觉",
        sub: "可能最近老看到它",
        kind: "relief",
        next: "a_thinking",
        set: { why: "待 AI 归因" },
        ack: "直觉往往是有来源的，只是你还没想起来。让我倒推一下最近发生了什么。",
      },
    ],
    story: {
      title: "命题 4/4：为什么是现在",
      why: "加了一句<strong>「这只票一直都在，你偏偏这几天想起它——总有个由头」</strong>。这句话的作用是把一个抽象问题变成一个用户能回答的问题。选「说不上来」时的回应也不是「好的」，而是<strong>「直觉往往是有来源的，只是你还没想起来」</strong>——先肯定用户，再接管工作。",
      tags: ["把抽象问题具象化", "先肯定再接管", "不给空白编辑器"],
    },
  },

  a_thinking: {
    phase: "evidence",
    mapStep: 1,
    say: [],
    render: "thinking",
    autoNext: "a_card",
    story: {
      title: "证据：把等待变成可见的工作",
      why: "90 秒的等待必须是<strong>透明的</strong>——逐条勾选正在做什么（拉财报、找反面证据、算情景）。这既是进度反馈，也是在告诉用户 Rethinka 和「问一句 AI 答一段」的差别：它在做结构化取证，而且<strong>主动去找反对你的证据</strong>。",
      tags: ["TTFV < 90s", "过程可见", "主动找反面证据"],
    },
  },

  a_card: {
    phase: "evidence",
    mapStep: 1,
    sayFn: (state) =>
      state.disputed
        ? [
            { t: "改好了。你那句话我记成了一条<b>你自己的证据</b>——" },
            { t: "下次复盘，我会拿它跟真实发生的事对一下，看是你对还是我对。", cls: "sub" },
          ]
        : [
            { t: "好了，看看你实际上在赌的是什么。" },
            { t: "我把反对你的也放进来了，两条。先别急着划走。", cls: "sub" },
          ],
    render: "card",
    optionsFn: (state) => [
      {
        title: "嗯，是这个意思",
        sub: "往下走",
        kind: "accent",
        next: "a_goal",
        ack: "那我们把它变成一笔具体能做的交易。",
      },
      ...(state.disputed
        ? []
        : [
            {
              title: "有一条我不同意",
              sub: "我想说说我的理由",
              kind: "relief",
              next: "a_dispute",
              ack: "来，哪一条？",
            },
          ]),
      {
        title: "先放着，我再想想",
        sub: "已经存好了，随时回来",
        kind: "ghost",
        next: "done_partial",
        ack: "行，不催你。",
      },
    ],
    story: {
      title: "决策卡：第一张价值卡",
      why: "这是整个 onboarding 的 North Star 产出。关键设计：<strong>支持证据和反对证据必须同屏</strong>，每条都带来源 + 时间 + 新鲜度标记。牛/基准/熊三情景给出可检查的数字。最下面的失效条件用红色区块——这是 Rethinka 区别于行情工具和 AI 聊天的地方：它逼你先想清楚什么情况下你错了。",
      tags: ["North Star 产出", "正反证据同屏", "每条带来源/时间/新鲜度", "失效条件"],
    },
  },

  a_dispute: {
    phase: "evidence",
    mapStep: 1,
    say: [
      { t: "点一下你不同意的那条。" },
      { t: "说真的，<b>你比我更了解你自己的钱</b>。我错了就改。", cls: "sub" },
    ],
    render: "dispute",
    // Must return to the card: the whole point is seeing the rebuttal absorbed.
    options: [
      {
        title: "就这条，帮我重算",
        sub: "把我的理由也算进去",
        kind: "accent",
        next: "a_card",
        ack: "收到，我把你的说法并进去重新看一遍。",
      },
    ],
    story: {
      title: "分歧路径：用户可以推翻 AI",
      why: "如果用户不能反驳，这就只是一个更漂亮的 AI 聊天。<strong>反驳会被存成用户自己的证据条目</strong>，并在下次复盘时和事实对照——这是「结构化结果是决策支持，不替代用户判断」这条边界的具体实现，也是让用户产生所有权的关键动作。",
      tags: ["决策支持而非替代", "用户反驳可留存", "为复盘埋点"],
    },
  },

  a_goal: {
    phase: "structure",
    mapStep: 2,
    say: [
      { t: "同样是看好，你想要的其实不一定一样。" },
      { t: "有人要涨得多，有人要亏得少。<b>你更在意哪个？</b>", cls: "sub" },
    ],
    options: [
      {
        title: "涨了我要吃得到",
        sub: "中间震一震我扛得住",
        next: "a_constraint",
        set: { goalKind: "参与上涨" },
        ack: "那我优先找上涨空间大的做法，代价是过程可能不太舒服。",
      },
      {
        title: "我最怕亏太多",
        sub: "先告诉我最坏能亏多少",
        next: "a_constraint",
        set: { goalKind: "限定损失" },
        ack: "那我们把最大亏损先锁死。心里有底，才拿得住。",
      },
      {
        title: "已经有仓位了，想多赚点",
        sub: "在现有基础上加点收益",
        next: "a_constraint",
        set: { goalKind: "收益增强" },
        ack: "明白，那思路是用现有仓位换点额外收益，代价是让出一部分上涨。",
      },
      {
        title: "先不动，等等看",
        sub: "等更确定了再说",
        next: "a_constraint",
        set: { goalKind: "等待确认" },
        ack: "不动也是一种决定。那我们重点定「等到什么才动」。",
      },
    ],
    story: {
      title: "结构 1/2：先目标，后工具",
      why: "绝大多数产品直接甩出期权链让用户自己挑。这里反过来：<strong>先问目标和约束，再筛出合适的表达方式</strong>，并且明确标注哪个「不适合你的约束」。工具服从意图，而不是让用户去适配工具。",
      tags: ["目标 → 约束 → 工具", "不甩期权链"],
    },
  },

  a_constraint: {
    phase: "structure",
    mapStep: 2,
    say: [
      { t: "这笔最坏的情况，亏多少你能睡得着？" },
      { t: "认真想一下这个数。它决定了下一屏我给你看什么。", cls: "sub" },
    ],
    options: [
      {
        title: "$500 左右",
        sub: "先小试一下",
        next: "a_express",
        set: { budget: "最大损失 ≤ $500" },
        ack: "小仓试水，挺好。第一笔本来就不该下重手。",
      },
      {
        title: "$2,000 上下",
        sub: "正常仓位",
        next: "a_express",
        set: { budget: "最大损失 ≤ $2,000" },
        ack: "记下了，$2,000 是这笔的天花板。",
      },
      {
        title: "$5,000 也行",
        sub: "我比较有信心",
        next: "a_express",
        set: { budget: "最大损失 ≤ $5,000" },
        ack: "行。不过有信心的时候，更要把底线写下来。",
      },
      {
        title: "没想好",
        sub: "帮我定一个",
        kind: "relief",
        next: "a_express",
        set: { budget: "最大损失 ≤ $2,000（默认）" },
        ack: "那我先按 $2,000 算。你看到具体数字之后，大概就知道自己能接受多少了。",
      },
    ],
    story: {
      title: "结构 2/2：约束",
      why: "「最大可接受损失」是唯一必须问的约束，因为它直接决定了下一屏筛掉哪些表达。持有期限已经从时间窗口继承，波动接受度从这里推断——<strong>能推断的绝不再问一遍</strong>，这是控制在 5 分钟内的关键。",
      tags: ["只问不能推断的", "约束驱动筛选"],
    },
  },

  a_express: {
    phase: "structure",
    mapStep: 2,
    say: [
      { t: "按你说的这些，我筛了三种做法。" },
      { t: "不合你条件的我直接标红了，<b>不用你自己算</b>。", cls: "sub" },
    ],
    render: "express",
    story: {
      title: "交易表达：情景损益必须同屏",
      why: "每个表达都展示<strong>所需资金、最大损失、盈亏平衡、牛/基准/熊损益</strong>，并直接标注是否满足用户刚才设的约束（绿色 ✓ / 红色 ✗）。<strong>首次 onboarding 不出现任何真实下单按钮</strong>，全部标「示例/模拟」。",
      tags: ["示例/模拟标注", "无下单按钮", "约束适配可见"],
    },
  },

  /* ================================================= ENTRY B — 复盘我的持仓 */

  b_import: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "那先让我看看你手里有什么。" },
      { t: "怎么方便怎么来——<b>不连券商也完全能走完</b>，我不为难你。", cls: "sub" },
    ],
    options: [
      {
        title: "我截个图给你",
        sub: "券商 App 里截一张，我自己认",
        tag: "最省事",
        next: "b_parsed",
        set: { source: "截图导入" },
        ack: "好，截图就行。看不清的地方我会问你。",
      },
      {
        title: "我直接报给你",
        sub: "说几个代码和成本价",
        next: "b_parsed",
        set: { source: "手动输入" },
        ack: "行，你说几个我记几个，不用报全。",
      },
      {
        title: "连一下券商吧",
        sub: "省得我一个个输",
        kind: "relief",
        next: "b_consent",
        set: { source: "只读连接" },
        ack: "可以。不过连之前，有几句话我得先跟你说清楚。",
      },
    ],
    story: {
      title: "入口 B：券商连接不是门槛",
      why: "issue 里最重要的一条策略：<strong>连券商是价值展示后的信任动作，不是 activation 门槛</strong>。所以这里截图导入是推荐项，只读连接排在最后。连接失败绝不阻断首次体验。",
      tags: ["截图/手动 fallback", "连接失败不阻断", "只读不下单"],
    },
  },

  b_consent: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "钱的事，话得说在前面。" },
      { t: "下面这四条你看完再决定，<b>反悔完全没成本</b>。", cls: "sub" },
    ],
    render: "consent",
    options: [
      {
        title: "看明白了，连吧",
        kind: "accent",
        next: "b_parsed",
        ack: "好，只读连接，随时可以断。",
      },
      {
        title: "还是算了，我截图",
        sub: "这样我更放心",
        kind: "relief",
        next: "b_parsed",
        set: { source: "截图导入" },
        ack: "完全理解，截图一样能用。谨慎点没坏处。",
      },
    ],
    story: {
      title: "连接授权：把边界写在用户看得见的地方",
      why: "四条承诺逐条列出：只读取账户和持仓 / 不保存券商密码、短信验证码、交易密码 / 不获取下单权限 / 随时可撤销。<strong>并且旁边永远留着「算了，我用截图」</strong>——退出成本必须是零。",
      tags: ["不存密码/验证码", "无下单权限", "随时撤销", "退出成本为零"],
    },
  },

  b_parsed: {
    phase: "evidence",
    mapStep: 1,
    say: [
      { t: "看到了，6 个持仓。" },
      { t: "我没打算给你看一张表——<b>先挑一个最该聊的</b>。就它了：", cls: "sub" },
    ],
    render: "positions",
    story: {
      title: "导入后立刻给「优先复盘仓位」",
      why: "issue 里明确要求：连接成功后立即生成一个优先复盘仓位，<strong>而不是只显示静态持仓表</strong>。这里用「亏损 + 无纪律规则 + 有新证据」三个条件排出优先级，并把理由直接写在卡片上，让用户理解排序逻辑。",
      tags: ["优先复盘仓位", "非静态持仓表", "排序理由可见"],
    },
  },

  b_recall: {
    phase: "evidence",
    mapStep: 1,
    say: [
      { t: "先不看现在亏多少。我想问的是——" },
      { t: "<b>当初你为什么买它？</b>", cls: "lead" },
      { t: "想不起来也没事。真的，这比你想的常见得多。", cls: "sub" },
    ],
    options: [
      {
        title: "信 FSD、Robotaxi 那套",
        sub: "觉得它不只是家车企",
        next: "b_thinking",
        set: { why: "FSD/Robotaxi 叙事", symbol: "TSLA · 纳斯达克", direction: "看多", horizon: "几个月（基本面驱动）" },
        ack: "那我们就去看看，这个故事这一年到底走到哪了。",
      },
      {
        title: "当时跌了不少，想抄底",
        sub: "觉得便宜",
        next: "b_thinking",
        set: { why: "超跌抄底", symbol: "TSLA · 纳斯达克", direction: "看多", horizon: "几周（催化剂驱动）" },
        ack: "抄底最怕的是——便宜的东西，可以更便宜。我们看看它现在算不算便宜。",
      },
      {
        title: "别人推荐的",
        sub: "朋友、博主，或者刷到的",
        next: "b_thinking",
        set: { why: "跟随他人（无自有依据）", symbol: "TSLA · 纳斯达克", direction: "看多", horizon: "几周（默认，可改）" },
        ack: "那你现在拿着的，其实是别人的判断。今天我们把它变成你自己的。",
      },
      {
        title: "……真的想不起来了",
        sub: "太久了",
        kind: "relief",
        tag: "很常见",
        next: "b_thinking",
        set: { why: "原始理由已遗失", symbol: "TSLA · 纳斯达克", direction: "未定 · 待证据裁决", horizon: "几周（默认，可改）" },
        neutral: true,
        ack: "说实话，这个答案本身就说明问题了——一笔你说不出理由的仓位，其实一直在替你做决定。那我们干脆当它是新的，重新审一遍。",
      },
    ],
    story: {
      title: "复盘的核心一问：当初为什么买",
      why: "开场先说<strong>「先不看现在亏多少」</strong>——主动把话题从最痛的地方移开，用户才敢往下答。选「真的想不起来了」时的回应是全流程最长的一句，因为这是<strong>用户的 aha moment</strong>：「一笔你说不出理由的仓位，其实一直在替你做决定」。选项写成「……真的想不起来了」，省略号是刻意的。",
      tags: ["先移开痛点", "遗忘即诊断", "aha moment"],
    },
  },

  b_thinking: {
    phase: "evidence",
    mapStep: 1,
    render: "thinking",
    variant: "review",
    autoNext: "b_card",
    say: [],
    story: {
      title: "复盘取证：命题 vs 现状对照",
      why: "复盘路径的取证重点和分析路径不同——它要对照<strong>「当初的理由今天还成立吗」</strong>，所以第一条就是去核对原始命题的现状。",
      tags: ["命题时效核对", "过程可见"],
    },
  },

  b_card: {
    phase: "evidence",
    mapStep: 1,
    render: "card",
    variant: "review",
    say: [
      { t: "看完了。有个事我得直接跟你说——" },
      { t: "<b>你买它的理由，和它现在的样子，已经不是一回事了。</b>", cls: "sub" },
    ],
    options: [
      {
        title: "那我该怎么办",
        kind: "accent",
        next: "b_verdict",
        ack: "先别急着做决定，我把选择摆给你。",
      },
      {
        title: "让我缓缓",
        sub: "存着，我晚点再看",
        kind: "ghost",
        next: "done_partial",
        ack: "应该的。这种事不该当场拍板。",
      },
    ],
    story: {
      title: "复盘版决策卡：多一栏「命题漂移」",
      why: "复盘卡比分析卡多一个关键区块：<strong>当初的理由 vs 今天的事实</strong>。用户会直接看到自己买入时的叙事已经变成了另一件事——这就是「价格波动」和「命题改变」的区别，也是 issue 里 re-entry 环节的核心判断。",
      tags: ["命题漂移可见", "区分价格波动/命题改变"],
    },
  },

  b_verdict: {
    phase: "structure",
    mapStep: 2,
    say: [
      { t: "四条路，没有标准答案。" },
      { t: "但有一条我要提醒你：<b>「等回本」不在这四条里面</b>——那不是决定，那是拖延。", cls: "sub" },
    ],
    options: [
      {
        title: "减一点，减到我睡得着",
        sub: "不想全走，但也扛不住这么多",
        next: "a_rule",
        set: { structure: "减仓至 1/3（示例）", goalKind: "限定损失" },
        ack: "这大概是最诚实的选择——承认自己没那么确定，但也没完全放弃。",
      },
      {
        title: "全出了吧",
        sub: "理由都没了，还拿着干嘛",
        next: "a_rule",
        set: { structure: "清仓退出（示例）", goalKind: "限定损失" },
        ack: "干脆。认亏很难，但拿着一个自己都不信的东西更难。",
      },
      {
        title: "再给它一次机会",
        sub: "但我要设条底线",
        next: "a_rule",
        set: { structure: "维持持仓 + 硬止损（示例）", goalKind: "等待确认" },
        ack: "行，但底线必须是具体的数字或事件，不能是「再看看」。",
      },
      {
        title: "我真的还没想好",
        sub: "别逼我",
        kind: "relief",
        next: "a_rule",
        set: { structure: "暂不调整 · 待复盘（示例）", goalKind: "等待确认" },
        ack: "不逼你。那我们至少约个时间，到那天再认真看一次——别让它就这么飘着。",
      },
    ],
    story: {
      title: "复盘裁决：四个出口都合法，但点破「等回本」",
      why: "新增一句<strong>「『等回本』不在这四条里面——那不是决定，那是拖延」</strong>。这是全流程唯一一次直接批评用户的常见行为，位置选在这里是因为此时信任已经建立。「我真的还没想好 / 别逼我」的回应是「不逼你」——<strong>先接住情绪，再提要求</strong>。",
      tags: ["点破拖延", "先接情绪再提要求", "无死胡同分支"],
    },
  },

  /* ================================================= ENTRY C — 找一个机会 */

  c_theme: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "我不打算直接甩几只票给你——那跟刷短视频没区别。" },
      { t: "换个问法：<b>你平时对哪块比较有感觉？</b>" },
      { t: "从你本来就懂一点的地方开始，比从我的推荐开始靠谱得多。", cls: "sub" },
    ],
    options: [
      {
        title: "AI、芯片这些",
        sub: "算力、数据中心",
        next: "c_pick",
        set: { theme: "AI / 半导体" },
        ack: "这块热闹，但也最容易被故事带着走。正好练手。",
      },
      {
        title: "医药、生物科技",
        sub: "新药、临床、集采",
        next: "c_pick",
        set: { theme: "创新药 / 医疗" },
        ack: "医药是典型的「一个数据出来就变天」，很适合用失效条件来管。",
      },
      {
        title: "新能源、电车",
        sub: "电池、光伏、整车",
        next: "c_pick",
        set: { theme: "新能源 / 电车" },
        ack: "这个行业这两年被杀得挺惨，反而容易找到预期差。",
      },
      {
        title: "我就看我平时用的东西",
        sub: "买啥用啥就看啥",
        kind: "relief",
        next: "c_pick",
        set: { theme: "生活消费倒推" },
        ack: "这其实是最被低估的一种方法——你对产品的直觉，比报告来得早。",
      },
    ],
    story: {
      title: "入口 C：从「你已有的感觉」出发，不是推荐流",
      why: "如果这里直接给一个 AI 精选机会列表，产品就退化成荐股工具了，而且违反 issue 的安全边界。所以先问主题偏好——<strong>用户带着自己的直觉进来，Rethinka 只负责把它结构化</strong>。个性化机会流在 P2，不在首次体验里。",
      tags: ["不做荐股", "从用户直觉出发", "P2 才有机会流"],
    },
  },

  c_pick: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "这三个最近<b>确实发生了点什么</b>。" },
      { t: "注意：不是涨得最猛的三个，是信息刚变化的三个。涨完了才看到，那叫追。", cls: "sub" },
    ],
    render: "candidates",
    story: {
      title: "候选：按「证据变化」排序，不按涨幅",
      why: "每个候选都附一句<strong>「最近发生了什么」</strong>而不是涨跌幅。这是在教用户 Rethinka 的世界观：值得研究的不是涨得凶的，是信息刚变化的。每条都带数据日期和来源。",
      tags: ["按证据变化排序", "非涨幅排序", "带 as-of"],
    },
  },

  /* ============================================ 共用：纪律 + 完成 */

  a_rule: {
    phase: "discipline",
    mapStep: 3,
    say: [
      { t: "还剩最后一件事，答应我别跳过。" },
      { t: "今天你想得很清楚。但真到那天，<b>盘面一红一绿，人是会变的</b>。" },
      { t: "所以趁现在脑子清醒，先给自己留一句话。就一句，不用多。", cls: "sub" },
    ],
    // Rules must be derived from the actual symbol / thesis, never hardcoded.
    optionsFn: (state) => {
      const set = RULE_SETS[ruleSetKey(state)];
      return [
        {
          title: set.price.title,
          sub: "看价格说话",
          next: "a_done",
          set: { rule: set.price.rule },
          ack: "简单直接，好执行。到了那个价，你就不用再纠结了。",
        },
        {
          title: set.thesis.title,
          sub: "看逻辑说话",
          tag: "我建议这条",
          next: "a_done",
          set: { rule: set.thesis.rule },
          ack: "这条最狠，也最有用——它盯的是你买入的理由，不是价格的情绪。",
        },
        {
          title: set.time.title,
          sub: "看时间说话",
          next: "a_done",
          set: { rule: set.time.rule },
          ack: "定期回头看一眼，能避免「拿着拿着就忘了」。",
        },
        {
          title: "你帮我定一条吧",
          sub: "我信你",
          kind: "relief",
          next: "a_done",
          set: { rule: `${set.thesis.rule}（AI 生成）` },
          ack: "那我用你自己写的失效条件改一条——毕竟那是你说的，不是我说的。",
        },
      ];
    },
    story: {
      title: "纪律：用「未来的你」说服「现在的你」",
      why: "这一屏的开场是整个流程情绪最重的地方：<strong>「今天你想得很清楚。但真到那天，盘面一红一绿，人是会变的」</strong>。不讲纪律的重要性，而是让用户想象未来那个会动摇的自己——这比任何说教都有效。「答应我别跳过」是全流程唯一一次用请求的语气。",
      tags: ["用共情替代说教", "只要一条规则", "对应失效条件"],
    },
  },

  a_done: {
    phase: "done",
    mapStep: 3,
    say: [
      { t: "好了，你刚才做完的这件事，其实不太一样。" },
      {
        t: "大多数人研究完就散了——想法在脑子里，理由过两周就忘。<b>你把它写下来了。</b>",
        cls: "sub",
      },
    ],
    render: "done",
    options: [
      {
        title: "然后呢？",
        sub: "看看这张卡以后会变成什么",
        kind: "accent",
        next: "workspace",
        ack: "带你看个东西——不是现在的样子，是你用一阵子之后的样子。",
      },
    ],
    story: {
      title: "完成页：先给意义，再给功能",
      why: "issue 要求完成页回顾<strong>四项产出</strong>（命题/证据/表达/规则）。但只列产出还不够——用户需要知道「这跟我自己记笔记有什么区别」。所以开场先点破：<strong>大多数人研究完就散了，你把它写下来了</strong>。四项产出是证据，那句话才是意义。<br><br>唯一的 CTA 是「然后呢？」——不给三个并列出口，因为此刻用户还不知道沉淀下来的东西有什么用，谈「下一笔」为时过早。",
      tags: ["四项产出可见", "先给意义再给功能", "不强推连券商"],
    },
  },

  /**
   * The real ending. issue 的「First Workspace」一节要求：未完成想法、待复盘持仓、
   * 最新证据变化、风险暴露。这一屏把它们摊开，并且刻意展示「三周后」的状态——
   * 留存的理由不是功能列表，是让用户看见自己积累出来的东西。
   */
  workspace: {
    phase: "done",
    mapStep: 3,
    say: [
      { t: "这是你用了三周之后，这里大概的样子 👇" },
      { t: "不是行情软件，也不是笔记。<b>是一份你自己判断力的记录。</b>", cls: "sub" },
    ],
    render: "workspace",
    story: {
      title: "研究台：让用户看见「值得回来」的理由",
      why: "这是全流程真正的结尾，也是 issue 里「First Workspace」那一节的落点。关键设计：<strong>展示的是三周后的状态，不是现在的空状态</strong>。空 Dashboard 说服不了任何人，但一张「你已经判断对 4 次、错 2 次，胜率 67%」的记分卡可以。<br><br>四个区块对应 issue 要求：<strong>命题追踪</strong>（未完成想法）、<strong>待复盘</strong>（持仓）、<strong>证据变化</strong>（最新证据）、<strong>暴露</strong>（风险）。最上面的记分卡是额外加的——因为 7 日回访率的真正驱动力是<strong>「我想知道我上次那个判断对没对」</strong>，这是别的产品给不了的钩子。",
      tags: ["7 日回访钩子", "展示未来态而非空状态", "判断力可累计"],
    },
  },

  done_partial: {
    phase: "done",
    mapStep: 1,
    say: [],
    render: "partial",
    story: {
      title: "中途退出：也必须有产出",
      why: "用户随时可能走。所以任何时刻退出都<strong>自动保存半成品决策卡</strong>，并明确告诉用户回来时从哪继续。这是「自动保存、继续和返回修改」这条 P0 要求的兜底，也是 7 日回访率的基础。",
      tags: ["自动保存", "可继续", "半成品也有价值"],
    },
  },

  /* ============================================ 语音越级通道 */

  v_result: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "听明白了。" },
      { t: "你这一句话里其实塞了四件事，我先拆出来你看对不对：", cls: "sub" },
    ],
    render: "voiceparse",
    options: [
      {
        title: "对，就是这样",
        sub: "你听得挺准",
        kind: "accent",
        next: "v_invalid",
        ack: "那前面几步就省了。只剩一个问题——也是最关键的那个。",
      },
      {
        title: "有地方听岔了",
        sub: "我自己选一遍",
        kind: "relief",
        next: "a_direction",
        ack: "不好意思，那你手动选吧，这样准确点。",
      },
    ],
    story: {
      title: "语音越级：结构的快速填充器，不是平行通道",
      why: "这是我和你原方案唯一有分歧的地方。<strong>语音不该是另一条自由聊天路径</strong>——那会把产品分裂成两套。语音应该一口气把 4 个槽位填满，回显成可点击修改的 chips 让用户确认，然后<strong>汇入和选择题完全相同的终点</strong>。语音越级，但不越结构。",
      tags: ["语音填槽而非自由聊天", "回显可改", "与选择题同终点"],
    },
  },

  v_invalid: {
    phase: "proposition",
    mapStep: 0,
    say: [
      { t: "你刚才说「怕跳水」——那是担心，不是标准。" },
      { t: "<b>发生什么，你才肯承认自己这次想错了？</b>", cls: "lead" },
      { t: "别的我都能替你补，这个不行。得你自己说。", cls: "sub" },
    ],
    options: [
      {
        title: "财报数据中心不及预期",
        sub: "那说明我看错了逻辑",
        next: "a_thinking",
        set: { invalidation: "数据中心营收不及预期" },
        ack: "好，这是冲着逻辑去的。比盯价格高级。",
      },
      {
        title: "跌破 $158",
        sub: "跌到这我就认",
        next: "a_thinking",
        set: { invalidation: "跌破 $158" },
        ack: "清楚，好执行。到点了别跟自己讨价还价就行。",
      },
      {
        title: "两个哪个先到算哪个",
        sub: "双保险",
        next: "a_thinking",
        set: { invalidation: "指引下调 或 跌破 $158" },
        ack: "稳。逻辑和价格各留一道闸。",
      },
      {
        title: "我真定不出来",
        sub: "你先给我个参考",
        kind: "relief",
        next: "a_thinking",
        set: { invalidation: "跌破 $158（默认建议）" },
        ack: "那我按常见做法给你放一条，你之后看着改。有个数，总比没有强。",
      },
    ],
    story: {
      title: "失效条件：唯一不能被 AI 代答的问题",
      why: "AI 可以补全标的、方向、时间窗口和理由，但<strong>「什么情况下你认输」必须由用户自己承诺</strong>——这是纪律的来源，代答就失去意义了。即使是降压选项也说明「按惯例给一个，你之后能改」，保留用户的最终裁量权。",
      tags: ["失效条件", "不代替用户承诺", "纪律来源"],
    },
  },
};

/** Voice transcript, revealed word by word during press-and-hold. */
export const VOICE_TRANSCRIPT =
  "英伟达下周财报 我觉得会超预期 想买点 但是怕财报后跳水";

export const VOICE_SLOTS = {
  symbol: "NVDA · 纳斯达克",
  direction: "看多",
  horizon: "几周（催化剂驱动）",
  why: "财报催化剂",
};
