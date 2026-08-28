import {
  NODES,
  ENTRIES,
  STEPS,
  SLOT_DEFS,
  VOICE_TRANSCRIPT,
  VOICE_SLOTS,
} from "./script.js";

const $ = (sel) => document.querySelector(sel);

const body = $("#body");
const rail = $("#rail");
const railFill = $("#railFill");
const railCount = $("#railCount");
const railSlots = $("#railSlots");
const railNote = $("#railNote");
const footer = $("#footer");
const voiceWrap = $("#voiceWrap");
const voiceLive = $("#voiceLive");
const storyEl = $("#story");
const entrySwitch = $("#entrySwitch");

/** Candidates are per-theme; each carries "what recently changed", not a % move. */
const CANDIDATES = {
  "AI / 半导体": [
    ["NVDA", "英伟达", "下周财报，三大云厂商刚集体上调资本开支指引", "2026-08-05"],
    ["AMD", "超威", "MI400 首次拿到超大规模客户订单，供应链在验证", "2026-08-19"],
    ["ASML", "阿斯麦", "出口管制细则落地，此前压制估值的不确定性解除", "2026-08-22"],
  ],
  "创新药 / 医疗": [
    ["LLY", "礼来", "减重适应症 III 期数据读出，主要终点达成", "2026-08-14"],
    ["VRTX", "福泰", "非阿片类镇痛药获 FDA 优先审评资格", "2026-08-21"],
    ["1801.HK", "信达生物", "两款产品新进医保目录，放量节奏待观察", "2026-08-09"],
  ],
  "新能源 / 电车": [
    ["ENPH", "Enphase", "欧洲户储库存去化完成，渠道订单环比转正", "2026-08-18"],
    ["300750", "宁德时代", "固态电池中试线通过验证，量产时点前移", "2026-08-25"],
    ["FSLR", "First Solar", "本土制造补贴细则明确，在手订单排至 2028", "2026-08-11"],
  ],
  "生活消费倒推": [
    ["COST", "开市客", "会员费提价后续费率未下滑，超市场担忧", "2026-08-07"],
    ["SBUX", "星巴克", "中国同店连续两季转正，本土化策略见效", "2026-08-16"],
    ["9988.HK", "阿里巴巴", "云业务重回双位数增长，AI 相关收入占比提升", "2026-08-20"],
  ],
};

const state = {
  node: "welcome",
  slots: {},
  trail: [],
  neutral: false,
  sample: false,
  entry: "analyze",
  disputed: false,
  disputeReason: "",
};

/* ------------------------------------------------------------- helpers */

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

const filledCount = () => SLOT_DEFS.filter((s) => state.slots[s.key]).length;

/** Bare ticker, e.g. "NVDA · 纳斯达克（样例）" -> "NVDA". */
const ticker = () => String(state.slots.symbol || "NVDA").split(" ")[0];

/**
 * Per-symbol demo content. Anything not authored falls back to a generic
 * template so no branch ever shows another company's facts.
 */
const THESES = {
  NVDA: "NVDA 的数据中心需求在本季财报中仍未见顶",
  AMD: "AMD 的 MI400 能真正打进超大规模客户的采购名单",
  ASML: "ASML 的估值压制来自出口管制，而管制已经落地",
  LLY: "LLY 的减重管线还能再吃下一个适应症的增量市场",
  VRTX: "VRTX 的非阿片类镇痛能拿到定价权",
  ENPH: "ENPH 的欧洲渠道去库存已经结束",
  FSLR: "FSLR 的在手订单足以穿越补贴政策周期",
  COST: "COST 的会员粘性强到可以持续提价",
  SBUX: "SBUX 的中国业务已经走出下滑",
};

const thesisFor = (sym) =>
  THESES[sym] || `${sym} 当前的价格还没有反映你看到的那个变化`;

/** [stance, text, source, date, freshness] */
const EVIDENCE = {
  NVDA: [
    ["support", "上季数据中心营收 $41.1B，同比 +154%，超指引上沿。", "NVDA 10-Q", "2026-07-30", "fresh"],
    ["support", "三大云厂商本年资本开支指引合计上调 $28B。", "各家电话会", "2026-08-05", "fresh"],
    ["support", "GB300 产能爬坡快于预期，交期从 42 周缩至 26 周。", "供应链调研", "2026-08-19", "fresh"],
    ["oppose", "远期市盈率 38x，处于过去 3 年 88% 分位。", "市场数据", "2026-08-27", "fresh"],
    ["oppose", "过去 4 次财报后有 3 次单日跌幅 > 5%，即使业绩超预期。", "历史回测", "2026-08-27", "fresh"],
  ],
};

const genericEvidence = (sym) => [
  ["support", `${sym} 最近一期财报的主要指标高于卖方一致预期。`, "公司财报", "2026-08-14", "fresh"],
  ["support", `你提到的那个变化已经出现在管理层指引里，措辞由「观察」转为「确认」。`, "电话会纪要", "2026-08-14", "fresh"],
  ["support", `同业中已有 2 家给出方向一致的表述，说明不是孤立现象。`, "同业财报", "2026-08-06", "fresh"],
  ["oppose", `当前估值处于过去 3 年 79% 分位，好消息已被部分定价。`, "市场数据", "2026-08-27", "fresh"],
  ["oppose", `机构持仓在过去两个季度已明显上升，边际买盘可能不足。`, "13F 汇总", "2026-06-30", "stale"],
];

const SCENARIOS = {
  NVDA: [
    ["bull", "牛", "指引再超预期，数据中心 > $46B", "+18%", "up"],
    ["base", "基准", "小幅超预期，估值消化", "+3%", "up"],
    ["bear", "熊", "指引持平，市场获利了结", "−14%", "down"],
  ],
};

const genericScenarios = () => [
  ["bull", "牛", "你看到的变化被下期数据确认", "+21%", "up"],
  ["base", "基准", "变化成立但节奏慢于预期", "+4%", "up"],
  ["bear", "熊", "变化被证伪，估值回到起点", "−17%", "down"],
];

const INVALIDATION = {
  NVDA: `如果 <b>数据中心营收指引下调</b>，或 <b>股价跌破 $158</b>（前低支撑），那么「需求未见顶」这个命题就不再成立。`,
};

const SECTOR_ETF = {
  "AI / 半导体": ["SMH", 280.4],
  "创新药 / 医疗": ["XBI", 96.2],
  "新能源 / 电车": ["ICLN", 14.8],
  "生活消费倒推": ["XLP", 82.6],
};

/** Reference prices so every derived number is internally consistent. */
const PRICES = {
  NVDA: 184.22, AMD: 168.4, ASML: 912.6,
  LLY: 842.5, VRTX: 468.9, "1801.HK": 62.4,
  ENPH: 41.7, 300750: 268.3, FSLR: 214.8,
  COST: 946.2, SBUX: 98.4, "9988.HK": 118.6,
  TSLA: 214.32,
};

const priceOf = (sym) => PRICES[sym] || 100;

const money = (n) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/** Round to a plausible option strike given the underlying's magnitude. */
const strike = (n) => {
  const step = n > 500 ? 25 : n > 100 ? 5 : n > 30 ? 2.5 : 1;
  return Math.round(n / step) * step;
};

const genericInvalidation = (sym) =>
  `如果 <b>下期财报没有确认你看到的那个变化</b>，或 <b>${sym} 跌破你成本价 15%</b>，那么这个命题就不再成立——届时该重写理由，而不是等回本。`;

/* ------------------------------------------------------------- rail */

function renderRail(node) {
  const show = node.rail !== false && node.phase !== "done";
  rail.hidden = !show;
  if (!show) return;

  const n = filledCount();
  const total = SLOT_DEFS.length;
  railFill.style.width = `${(n / total) * 100}%`;
  railCount.innerHTML = `决策卡 ${n}/${total} <span class="caret">▲</span>`;

  railSlots.innerHTML = "";
  SLOT_DEFS.forEach((s) => {
    const v = state.slots[s.key];
    const row = el("div", `slot${v ? "" : " empty"}`);
    row.append(el("dt", null, s.label), el("dd", null, v || "待填"));
    railSlots.append(row);
  });
  railSlots.append(
    el(
      "p",
      "rail-note",
      n === total
        ? "决策卡已完整。随时可以回来修改任意一项。"
        : "每答一题这里就长一格。中途离开会自动保存，回来能接着走。"
    )
  );
}

function toggleRail() {
  const open = rail.classList.toggle("open");
  rail.setAttribute("aria-expanded", String(open));
}

rail.addEventListener("click", toggleRail);
rail.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleRail();
  }
});

/* ------------------------------------------------------------- story panel */

function renderStory(node) {
  const s = node.story || { title: "", why: "", tags: [] };
  storyEl.innerHTML = "";

  const head = el("div", "block");
  head.append(el("h2", null, "这一屏在解决什么"));
  head.append(el("h3", "story-title", s.title));
  head.append(el("p", "story-why", s.why));
  const tags = el("div", "tags");
  (s.tags || []).forEach((t) => tags.append(el("span", "tag metric", t)));
  head.append(tags);
  storyEl.append(head);

  // four-step map
  const mapBlock = el("div", "block");
  mapBlock.append(el("h2", null, "四步闭环"));
  const map = el("div", "map");
  STEPS.forEach((st, i) => {
    let cls = "map-row";
    if (node.mapStep === i) cls += " on";
    else if (node.mapStep != null && i < node.mapStep) cls += " past";
    else if (node.phase === "done") cls += " past";
    const row = el("div", cls);
    row.append(el("span", "idx", String(i + 1)));
    row.append(el("span", null, st.label));
    map.append(row);
  });
  mapBlock.append(map);
  storyEl.append(mapBlock);

  // decision trail
  if (state.trail.length) {
    const tb = el("div", "block");
    tb.append(el("h2", null, `用户走过的路径 · ${state.trail.length} 步`));
    const trail = el("div", "trail");
    state.trail.forEach((t) => {
      const item = el("div", `trail-item${t.relief ? " relief" : ""}`);
      const railCol = el("div", "trail-rail");
      railCol.append(el("span", "trail-dot"), el("span", "trail-line"));
      const bodyCol = el("div", "trail-body");
      bodyCol.append(el("div", "trail-q", t.q), el("div", "trail-a", t.a));
      item.append(railCol, bodyCol);
      trail.append(item);
    });
    tb.append(trail);
    storyEl.append(tb);
  }

  // Pacing model — the thing that makes it feel like a person, not a form.
  const pace = el("div", "block");
  pace.append(el("h2", null, "这一屏的节奏"));
  [
    ["回显", "把用户刚点的话变成他自己的气泡", Boolean(state.trail.length)],
    ["正在输入", "停顿必须有人味，不能像卡住", true],
    ["专属回应", "针对这个选择说一句，证明我听懂了", true],
    ["下一问", "按上一句的字数留出阅读时间", true],
    ["选项", "永远最后出现，不抢注意力", true],
  ].forEach(([k, v, on], i) => {
    const row = el("div", `map-row${on ? " on" : ""}`);
    row.append(el("span", "idx", String(i + 1)));
    row.append(el("span", null, `<b style="color:#e9e6e0">${k}</b> · ${v}`));
    pace.append(row);
  });
  pace.append(
    el(
      "p",
      "story-why",
      `延迟按文字长度算（约 <strong>34ms/字</strong>，封顶 1.15 秒），最后一句说完直接给选项——<strong>没人要在读完之后再等</strong>。任何时候点一下空白处可以跳过等待。`
    )
  );
  storyEl.append(pace);

  const act = el("div", "block");
  act.append(el("h2", null, "操作"));
  const wrap = el("div", "story-actions");
  const restart = el("button", null, "↺ 重新开始");
  restart.onclick = () => reset("welcome", "analyze");
  wrap.append(restart);
  act.append(wrap);
  storyEl.append(act);
}

/* ------------------------------------------------------------- rich renderers */

const RENDER = {
  search() {
    const box = el("div", "search enter", `<span>🔍</span><span>搜索股票、ETF、代码…</span>`);
    return [box];
  },

  thinking(node) {
    const lines =
      node.variant === "review"
        ? [
            "核对你当初的理由今天还成不成立",
            "拉取近 90 天的事件和财报",
            "找出与你判断冲突的事实",
            "计算这笔持仓的真实暴露",
          ]
        : [
            `读取 ${ticker()} 最近财报与指引`,
            "扫描近 7 天事件与新闻",
            "主动查找反对这个判断的证据",
            "计算牛 / 基准 / 熊三种情景",
          ];

    const wrap = el("div", "thinking");
    lines.forEach((text, i) => {
      const row = el("div", "think-row");
      row.style.animationDelay = `${i * 90}ms`;
      row.append(el("span", "tick", ""), el("span", null, text));
      wrap.append(row);
      setTimeout(() => {
        row.classList.add("done");
        row.querySelector(".tick").textContent = "✓";
      }, 420 + i * 420);
    });

    const timer = el("p", "disclaimer", "预计 12 秒 · 数据 as-of 2026-08-27 收盘");
    return [wrap, timer];
  },

  card(node) {
    const review = node.variant === "review";
    const out = [];

    // thesis
    const c1 = el("div", "card enter");
    c1.append(el("div", "card-kicker", `<span class="dot"></span>你的命题`));
    if (review) {
      c1.append(
        el(
          "div",
          "thesis",
          `你在赌 <em>TSLA 的价值来自 FSD/Robotaxi 落地</em>，而不是来自卖车。`
        )
      );
      c1.append(
        el(
          "div",
          "callout warn",
          `<b>命题漂移</b><br>你买入时（2025-03）的理由是 FSD 落地。今天市场定价的主要变量已经变成<b>交付量和价格战</b>。这不是价格波动，是命题变了。`
        )
      );
      c1.querySelector(".callout").style.marginTop = "11px";
    } else if (state.neutral) {
      c1.append(
        el(
          "div",
          "thesis",
          `你还没选方向，所以我<em>不替你站队</em>。下面是正反两面对称的证据，由你裁决。`
        )
      );
    } else {
      c1.append(
        el(
          "div",
          "thesis",
          `你在赌 <em>${thesisFor(ticker())}</em>，并会在${
            state.slots.horizon?.startsWith("几天") ? "几天" : state.slots.horizon?.startsWith("几个月") ? "几个月" : "几周"
          }内被市场重新定价。`
        )
      );
    }
    out.push(c1);

    // evidence
    const c2 = el("div", "card enter");
    const ev = el("div", "ev");

    const items = review
      ? [
          ["oppose", "Robotaxi 商业化时间表已第 3 次推迟，最新指引为 2027。", "公司 Q2 电话会", "2026-07-24", "fresh"],
          ["oppose", "汽车业务毛利率连续两季下滑至 14.6%。", "10-Q", "2026-07-24", "fresh"],
          ["support", "能源存储业务同比 +67%，成为新增长极。", "10-Q", "2026-07-24", "fresh"],
          ["oppose", "你的成本 $268，现价 $214，浮亏 20.1%。", "你的导入数据", "2026-08-27", "fresh"],
          ["support", "FSD v13 接管率环比改善 40%。", "第三方路测", "2026-06-10", "stale"],
        ]
      : EVIDENCE[ticker()] || genericEvidence(ticker());

    const nSupport = items.filter((x) => x[0] === "support").length;
    const nOppose = items.filter((x) => x[0] === "oppose").length;
    c2.append(
      el(
        "div",
        "card-kicker",
        `<span class="dot"></span>证据 · 支持 ${nSupport} 条，反对 ${nOppose} 条`
      )
    );

    items.forEach(([stance, text, src, date, fresh]) => {
      const item = el("div", `ev-item ${stance}`);
      item.append(el("span", "ev-bar"));
      const b = el("div", "ev-body");
      b.append(el("div", "ev-text", text));
      const meta = el("div", "ev-meta");
      meta.append(
        el("span", "pill", stance === "support" ? "支持" : stance === "oppose" ? "反对" : "中性"),
        el("span", null, src),
        el("span", `pill ${fresh}`, `${date}${fresh === "stale" ? " · 偏旧" : ""}`)
      );
      b.append(meta);
      item.append(b);
      ev.append(item);
    });

    if (state.disputed) {
      const item = el("div", "ev-item neutral");
      item.append(el("span", "ev-bar"));
      const b = el("div", "ev-body");
      b.append(el("div", "ev-text", `我不认同上面那条反对证据：${state.disputeReason}`));
      const meta = el("div", "ev-meta");
      meta.append(
        el("span", "pill", "你的反驳"),
        el("span", null, "你 · 2026-08-28"),
        el("span", "pill fresh", "将在复盘时与事实对照")
      );
      b.append(meta);
      item.append(b);
      ev.append(item);
    }

    c2.append(ev);
    out.push(c2);

    // scenarios
    const c3 = el("div", "card enter");
    // Scenario window must track the horizon the user actually chose.
    const h = state.slots.horizon || "";
    const window = review
      ? "6 个月"
      : h.startsWith("几天")
      ? "2 周"
      : h.startsWith("几个月")
      ? "6 个月"
      : "6 周";
    c3.append(el("div", "card-kicker", `<span class="dot"></span>三种情景 · 未来 ${window}`));
    const scen = el("div", "scen");
    const rows = review
      ? [
          ["bull", "牛", "Robotaxi 试点城市落地", "+24%", "up"],
          ["base", "基准", "交付持平，价格战延续", "−6%", "down"],
          ["bear", "熊", "毛利率跌破 12%", "−31%", "down"],
        ]
      : SCENARIOS[ticker()] || genericScenarios();
    rows.forEach(([cls, name, text, num, dir]) => {
      scen.append(
        el("span", `scen-name ${cls}`, name),
        el("span", "scen-text", text),
        el("span", `scen-num ${dir}`, num)
      );
    });
    c3.append(scen);
    out.push(c3);

    // invalidation
    const c4 = el("div", "card enter");
    c4.append(el("div", "card-kicker", `<span class="dot"></span>失效条件`));
    c4.append(
      el(
        "div",
        "callout invalid",
        review
          ? `如果 <b>Q3 交付量同比转负</b>，或 <b>Robotaxi 指引再次推迟</b>，那么「FSD 叙事」这个命题正式失效——届时你持有的理由必须重写，而不是等回本。`
          : state.slots.invalidation
          ? `你自己定的：<b>${state.slots.invalidation}</b>。触发时我会提醒你，这个命题需要重新审视。`
          : INVALIDATION[ticker()] || genericInvalidation(ticker())
      )
    );
    out.push(c4);

    out.push(
      el(
        "p",
        "disclaimer",
        "数据 as-of 2026-08-27 收盘 · 仅用于演示，非投资建议 · 结构化结果是决策支持，不替代你的最终判断"
      )
    );
    return out;
  },

  dispute() {
    const c = el("div", "card enter");
    c.append(el("div", "card-kicker", `<span class="dot"></span>点选你不认同的证据`));
    const ev = el("div", "ev");
    // Show the real evidence list for this symbol; last item pre-marked as the demo pick.
    const src = EVIDENCE[ticker()] || genericEvidence(ticker());
    const shown = [src[0], src[3], src[4]];
    state.disputeReason =
      ticker() === "NVDA"
        ? "那几次都是在估值更高的位置，这次已经回调过了。"
        : "机构持仓上升不代表买盘耗尽，指数基金的被动配置也算在里面。";
    shown.forEach(([stance, text], i) => {
      const picked = i === shown.length - 1;
      const item = el("div", `ev-item ${stance}`);
      item.style.cursor = "pointer";
      item.append(el("span", "ev-bar"));
      const b = el("div", "ev-body");
      b.append(el("div", "ev-text", text));
      const meta = el("div", "ev-meta");
      meta.append(el("span", "pill", picked ? "✓ 已标记不认同" : "点击标记"));
      if (picked) meta.querySelector(".pill").classList.add("stale");
      b.append(meta);
      item.append(b);
      ev.append(item);
    });
    c.append(ev);

    const note = el("div", "card enter");
    note.append(el("div", "card-kicker", `<span class="dot"></span>你的理由`));
    note.append(
      el(
        "div",
        "callout soft",
        `「${state.disputeReason}」<br><br><span style="font-size:11px">这条会作为<b>你的证据</b>存进决策卡，下次复盘时我拿它跟事实对照。</span>`
      )
    );

    state.disputed = true;
    return [c, note];
  },

  express() {
    const out = [];
    const sym = ticker();
    const budget = state.slots.budget || "最大损失 ≤ $2,000（默认）";
    const cap = Number((budget.match(/\$([\d,]+)/) || [0, "2,000"])[1].replace(/,/g, ""));

    // Everything below is derived from the reference price so the numbers stay
    // internally consistent for whichever symbol the user picked.
    const px = priceOf(sym);
    const shares = Math.max(1, Math.round(4000 / px));
    const stockCost = shares * px;

    const lower = strike(px * 1.03);
    const upper = strike(px * 1.14);
    const width = upper - lower;
    const contracts = 1;
    const debit = Math.round(width * 0.34 * 100) * contracts;
    const maxGain = width * 100 * contracts - debit;
    const breakeven = lower + debit / 100 / contracts;

    const [etfName, etfPx] = SECTOR_ETF[state.slots.theme] || SECTOR_ETF["AI / 半导体"];
    const etfUnits = Math.max(1, Math.round(8000 / etfPx));
    const etfCost = etfUnits * etfPx;

    const list = [
      {
        name: `买入 ${sym} 正股 ${shares} 股`,
        cost: money(stockCost),
        cells: [["最大损失", money(stockCost)], ["盈亏平衡", money(px)], ["最大收益", "无上限"]],
        note: "最直接的表达。没有到期日，不受波动率影响，但资金占用大。",
        fit: cap >= stockCost,
        fitText: cap >= stockCost ? "✓ 在你的损失约束内" : `✗ 理论最大损失超出你设的 ${budget}`,
      },
      {
        name: `${sym} 10月 ${money(lower)}/${money(upper)} 牛市价差`,
        cost: money(debit),
        cells: [
          ["最大损失", money(debit)],
          ["盈亏平衡", money(breakeven)],
          ["最大收益", money(maxGain)],
        ],
        note: `损失被权利金锁死。需要涨过 ${money(breakeven)} 才赚，10-17 到期，隐含波动率 52%（偏高）。`,
        fit: cap >= debit,
        fitText:
          cap >= debit
            ? `✓ 最大损失锁死在 ${money(debit)}，符合你的约束`
            : `✗ 超出你设的 ${budget}`,
        tag: "最贴合你的目标",
      },
      {
        name: `买入 ${etfName} ETF ${etfUnits} 份`,
        cost: money(etfCost),
        cells: [["最大损失", money(etfCost)], ["盈亏平衡", money(etfPx)], ["最大收益", "无上限"]],
        note: `分散到整个板块，弱化单票财报风险，但也稀释了你对 ${sym} 的判断。`,
        fit: cap >= etfCost,
        fitText: cap >= etfCost ? "✓ 在约束内" : `✗ 超出你设的 ${budget}`,
      },
    ];

    list.forEach((x) => {
      const b = el("button", "expr enter");
      const head = el("div", "expr-head");
      head.append(el("span", "expr-name", x.name), el("span", "expr-cost", x.cost));
      b.append(head);
      if (x.tag) {
        const t = el("div", "opt-tag");
        t.textContent = x.tag;
        t.style.display = "inline-block";
        t.style.marginTop = "7px";
        b.append(t);
      }
      const grid = el("div", "expr-grid");
      x.cells.forEach(([k, v]) => {
        const cell = el("div", "expr-cell");
        cell.append(el("dt", null, k), el("dd", null, v));
        grid.append(cell);
      });
      b.append(grid);
      b.append(el("div", "expr-note", x.note));
      b.append(el("div", `expr-fit${x.fit ? "" : " bad"}`, x.fitText));
      b.onclick = () => {
        state.slots.structure = `${x.name}（示例）`;
        pushTrail("选择交易表达", x.name);
        go("a_rule");
      };
      out.push(b);
    });

    const skip = mkOption(
      { title: "先不选表达方式", sub: "直接去定纪律规则，表达以后再说", kind: "relief" },
      () => {
        state.slots.structure = "暂不选择";
        pushTrail("选择交易表达", "先跳过", true);
        go("a_rule");
      }
    );
    out.push(skip);

    out.push(
      el(
        "p",
        "disclaimer",
        "以上均为<b>示例 / 模拟结构</b>，不是下单建议，也不是实时报价。期权数据 as-of 2026-08-27 收盘。首次体验不提供下单入口。"
      )
    );
    return out;
  },

  consent() {
    const c = el("div", "card enter");
    c.append(el("div", "card-kicker", `<span class="dot"></span>Rethinka 会做什么`));
    const kv = el("div", "kv");
    [
      ["只读取", "账户信息与持仓明细"],
      ["不保存", "券商密码、短信验证码、交易密码"],
      ["不获取", "任何下单 / 转账权限"],
      ["可撤销", "设置里一键断开，随时"],
    ].forEach(([k, v]) => {
      const row = el("div", "kv-row");
      row.append(el("dt", null, k), el("dd", null, v));
      kv.append(row);
    });
    c.append(kv);

    const c2 = el("div", "callout info enter", "连接失败也不影响你继续——截图导入和手动输入永远可用。");
    return [c, c2];
  },

  positions() {
    const out = [];
    const top = el("button", "pos enter");
    const h = el("div", "pos-head");
    h.append(el("span", "pos-sym", "TSLA · 20 股"), el("span", "pos-pl down", "−20.1%"));
    top.append(h);
    top.append(el("div", "pos-meta", "成本 $268.40 · 现价 $214.32 · 持有 17 个月"));
    top.append(
      el(
        "div",
        "pos-flag",
        "<b>优先复盘</b> · 浮亏最大 + 没有任何纪律规则 + 近 30 天出现 3 条与买入理由冲突的证据"
      )
    );
    top.onclick = () => {
      pushTrail("挑选复盘仓位", "TSLA（AI 推荐优先）");
      go("b_recall");
    };
    out.push(top);

    [
      ["AAPL · 50 股", "+12.4%", "up", "成本 $198.20 · 现价 $222.80"],
      ["SMH · 30 份", "+31.7%", "up", "成本 $213.10 · 现价 $280.40"],
      ["PFE · 200 股", "−8.2%", "down", "成本 $28.90 · 现价 $26.53"],
    ].forEach(([sym, pl, dir, meta]) => {
      const b = el("button", "pos enter");
      const hh = el("div", "pos-head");
      hh.append(el("span", "pos-sym", sym), el("span", `pos-pl ${dir}`, pl));
      b.append(hh);
      b.append(el("div", "pos-meta", meta));
      b.onclick = () => {
        pushTrail("挑选复盘仓位", sym.split(" ")[0]);
        go("b_recall");
      };
      out.push(b);
    });

    out.push(el("p", "disclaimer", `来源：${state.slots.source || "截图导入"} · as-of 2026-08-27 收盘 · 共 6 个持仓，显示前 4 个`));
    return out;
  },

  candidates() {
    const out = [];
    const list = CANDIDATES[state.slots.theme] || CANDIDATES["AI / 半导体"];
    list.forEach(([sym, name, evt, date]) => {
      const b = el("button", "expr enter");
      const head = el("div", "expr-head");
      head.append(el("span", "expr-name", `${sym} · ${name}`), el("span", "expr-cost", "证据已变"));
      b.append(head);
      b.append(el("div", "expr-note", evt));
      b.append(el("div", "expr-fit", `最近变化 ${date}`));
      b.onclick = () => {
        state.slots.symbol = `${sym} · 纳斯达克`;
        pushTrail("挑选候选标的", `${sym} · ${name}`);
        go("a_direction");
      };
      out.push(b);
    });

    out.push(
      el(
        "p",
        "disclaimer",
        "按<b>近期证据变化</b>排序，不是按涨幅排序 · 这不是推荐，只是「值得研究」的候选 · as-of 2026-08-27"
      )
    );
    return out;
  },

  voiceparse() {
    const out = [];
    const c = el("div", "card enter");
    c.append(el("div", "card-kicker", `<span class="dot"></span>解析结果 · 点任意一项可改`));
    const kv = el("div", "kv");
    [
      ["标的", VOICE_SLOTS.symbol, "「英伟达」"],
      ["方向", VOICE_SLOTS.direction, "「会超预期 / 想买点」"],
      ["时间窗口", VOICE_SLOTS.horizon, "「下周财报」"],
      ["为什么是现在", VOICE_SLOTS.why, "「下周财报」"],
    ].forEach(([k, v, src]) => {
      const row = el("div", "kv-row");
      row.append(el("dt", null, `${k}<br><span style="font-size:10px;opacity:.7">来自 ${src}</span>`), el("dd", null, v));
      kv.append(row);
    });
    c.append(kv);
    out.push(c);

    out.push(
      el(
        "div",
        "callout warn enter",
        `还有一件事你没说：<b>什么情况下你会认输</b>。<br>你提到「怕跳水」——这是担心，还不是失效条件。`
      )
    );
    return out;
  },

  done() {
    const out = [];
    const c = el("div", "card enter");
    c.append(el("div", "card-kicker", `<span class="dot"></span>你刚刚产出了四样东西`));
    const kv = el("div", "kv");
    [
      ["① 一个命题", state.slots.symbol || "—"],
      ["", `${state.slots.direction || "—"} · ${state.slots.horizon || "—"}`],
      ["② 一组证据", state.entry === "review" ? "5 条，含 3 条反对你的" : `5 条，含 ${
        (EVIDENCE[ticker()] || genericEvidence(ticker())).filter((x) => x[0] === "oppose").length
      } 条反对你的`],
      ["③ 一个交易表达", state.slots.structure || "暂未选择"],
      ["④ 一条纪律规则", state.slots.rule || "—"],
    ].forEach(([k, v]) => {
      const row = el("div", "kv-row");
      row.append(el("dt", null, k), el("dd", null, v));
      kv.append(row);
    });
    c.append(kv);
    out.push(c);

    out.push(
      el(
        "div",
        "callout info enter",
        `<b>下次我什么时候找你</b><br>财报日（09-03）后的第二天，或者你的规则被触发时。届时我只问两件事：发生了什么？它改变了命题，还是只是价格波动？`
      )
    );
    out.push(el("p", "disclaimer", `用时 4 分 12 秒 · 全程未连接券商 · 仅用于演示，非投资建议。`));
    return out;
  },

  /**
   * The payoff screen. Deliberately shows a *lived-in* workspace three weeks
   * out rather than today's empty state — an empty dashboard can't argue for
   * itself, but a scorecard of your own past calls can.
   */
  workspace() {
    const out = [];
    const sym = ticker();

    // 1) Scorecard — the actual retention hook: "was I right last time?"
    const score = el("div", "card ws-score enter");
    score.append(el("div", "card-kicker", `<span class="dot"></span>你的判断记录`));
    const grid = el("div", "score-grid");
    [
      ["6", "个命题", ""],
      ["4", "个应验", "up"],
      ["2", "个证伪", "down"],
      ["67%", "命中率", ""],
    ].forEach(([n, label, tone]) => {
      const cell = el("div", `score-cell ${tone}`.trim());
      cell.append(el("div", "score-n", n));
      cell.append(el("div", "score-l", label));
      grid.append(cell);
    });
    score.append(grid);
    score.append(
      el(
        "p",
        "score-note",
        `被证伪的 2 个里，有 1 个是<b>你自己反驳我之后改对的</b>。这个记录只有你自己看得到。`
      )
    );
    out.push(score);

    // 2) Open theses — issue: "未完成想法"
    const open = el("div", "card enter");
    open.append(el("div", "card-kicker", `<span class="dot"></span>在跟踪的命题 · 3`));
    [
      [sym, state.slots.direction || "看多", "距失效条件还有 14%", "live"],
      ["ASML", "看多", "已触发你的规则 · 等你决定", "alert"],
      ["COST", "观望", "还差一个信号：会员续费率", "wait"],
    ].forEach(([s, dir, note, tone]) => {
      const row = el("div", `ws-row ${tone}`);
      const l = el("div", "ws-l");
      l.append(el("div", "ws-sym", `${s} <span class="ws-dir">${dir}</span>`));
      l.append(el("div", "ws-note", note));
      row.append(l);
      row.append(el("span", `ws-dot ${tone}`));
      open.append(row);
    });
    out.push(open);

    // 3) Evidence drift — issue: "最新证据变化"
    const drift = el("div", "card enter");
    drift.append(el("div", "card-kicker", `<span class="dot"></span>你睡觉时，证据变了`));
    [
      ["昨天", `${sym} 新增一条<b>反对</b>证据：竞品拿到大单`, "oppose"],
      ["3 天前", "ASML 的一条支持证据<b>过期了</b>（管制细则已消化）", "stale"],
      ["上周", "你标记为「不认同」的那条，<b>事实站在你这边</b>", "win"],
    ].forEach(([when, what, tone]) => {
      const row = el("div", `ws-drift ${tone}`);
      row.append(el("span", "ws-when", when));
      row.append(el("span", "ws-what", what));
      drift.append(row);
    });
    out.push(drift);

    // 4) Exposure — issue: "风险暴露"
    const exp = el("div", "card enter");
    exp.append(el("div", "card-kicker", `<span class="dot"></span>你可能没注意到的集中度`));
    exp.append(
      el(
        "div",
        "callout warn",
        `你 3 个命题里有 <b>2 个</b>押的是同一件事：<b>AI 资本开支不下滑</b>。<br>它们看起来是不同的票，其实是同一个赌注。`
      )
    );
    out.push(exp);

    const opts = el("div", "options enter");
    [
      { title: "分析下一笔", sub: "第二张卡通常只要 2 分钟", kind: "accent" },
      { title: "连接只读持仓", sub: "把真实仓位也纳进来一起看" },
      { title: "开启纸上跟踪", sub: "不花钱，先验证判断准不准" },
    ].forEach((o) => opts.append(mkOption(o, () => reset("welcome", "analyze"))));
    out.push(opts);

    out.push(el("p", "disclaimer", "演示数据，非投资建议。"));
    return out;
  },

  partial() {
    const out = [];
    out.push(el("div", "bubble lead enter", "已保存，随时能回来。"));
    const c = el("div", "card enter");
    c.append(el("div", "card-kicker", `<span class="dot"></span>半成品决策卡 · ${filledCount()}/7`));
    const kv = el("div", "kv");
    SLOT_DEFS.forEach((s) => {
      const row = el("div", "kv-row");
      row.append(el("dt", null, s.label), el("dd", null, state.slots[s.key] || "待填"));
      if (!state.slots[s.key]) row.querySelector("dd").style.color = "var(--border-strong)";
      kv.append(row);
    });
    c.append(kv);
    out.push(c);
    out.push(
      el(
        "div",
        "callout soft enter",
        `回来时你会直接落在「<b>失效条件</b>」这一步，前面答过的不用再答一遍。`
      )
    );
    const opts = el("div", "options enter");
    opts.append(mkOption({ title: "继续把它做完", kind: "accent" }, () => go("a_goal")));
    opts.append(mkOption({ title: "回到首页", kind: "ghost" }, () => reset("welcome", "analyze")));
    out.push(opts);
    return out;
  },
};

/* ------------------------------------------------------------- options */

function mkOption(o, onClick) {
  const b = el("button", `opt ${o.kind || ""}`.trim());
  const main = el("div", "opt-main");
  main.append(el("div", "opt-title", o.title));
  if (o.sub) main.append(el("div", "opt-sub", o.sub));
  b.append(main);
  if (o.tag) b.append(el("span", "opt-tag", o.tag));
  b.onclick = onClick;
  return b;
}

/* ------------------------------------------------------------- trail */

function pushTrail(q, a, relief) {
  state.trail.push({ q, a, relief: !!relief });
}

function questionLabel(node) {
  const say = node.sayFn ? node.sayFn(state) : node.say;
  const first = (say || [])[0];
  if (!first) return node.story?.title || "";
  return first.t.replace(/<[^>]+>/g, "");
}

/* ------------------------------------------------------------- pacing engine */

/**
 * People need time to read. Dumping a whole screen at once makes the product
 * feel like a form; revealing one thought at a time makes it feel like someone
 * is talking to you.
 *
 * Delay is proportional to how much there is to read, clamped so it never drags.
 * Chinese runs ~5.5 chars/sec at a comfortable pace; we go a bit faster than
 * that since the user can also just tap to skip ahead.
 */
const readMs = (html) => {
  const chars = String(html).replace(/<[^>]+>/g, "").length;
  return Math.min(1150, Math.max(300, 220 + chars * 34));
};

const TYPING_MS = 420;

/** Everything currently scheduled, so a tap can flush it instantly. */
let beatQueue = [];
let beatTimer = null;

function clearBeats() {
  clearTimeout(beatTimer);
  beatTimer = null;
  beatQueue = [];
  body.classList.remove("waiting");
}

/** Play queued beats one at a time. Each beat is { wait, run }. */
function runBeats() {
  if (!beatQueue.length) {
    body.classList.remove("waiting");
    return;
  }
  const beat = beatQueue.shift();
  beatTimer = setTimeout(() => {
    beat.run();
    scrollDown();
    runBeats();
  }, beat.wait);
}

/** Skip the wait and paint everything that's still pending. */
function flushBeats() {
  if (!beatQueue.length) return;
  clearTimeout(beatTimer);
  const pending = beatQueue;
  beatQueue = [];
  pending.forEach((b) => b.run());
  // Any indicator whose paired beat was consumed earlier would linger.
  body.querySelectorAll(".bubble.typing").forEach((n) => n.remove());
  body.classList.remove("waiting");
  scrollDown();
}

function scrollDown() {
  body.scrollTop = body.scrollHeight;
}

/** A "…" bubble that stands in for the agent composing its next line. */
function typingBubble() {
  const b = el("div", "bubble typing enter", `<i></i><i></i><i></i>`);
  return b;
}

/**
 * Queue one agent bubble, preceded by a typing indicator so the pause reads as
 * "she's thinking" rather than "the app froze".
 */
function beatSay(s, opts = {}) {
  const showTyping = opts.typing !== false;
  if (showTyping) {
    beatQueue.push({
      wait: opts.lead ?? 200,
      run: () => body.append(typingBubble()),
    });
  }
  beatQueue.push({
    wait: showTyping ? TYPING_MS : opts.lead ?? 200,
    // Clear whatever indicator is live rather than closing over a specific
    // node: a flush may run this beat without its paired beat ever having run.
    run: () => {
      body.querySelectorAll(".bubble.typing").forEach((n) => n.remove());
      body.append(el("div", `bubble ${s.cls || ""} enter`.trim(), s.t));
    },
  });
  // Reading room before the NEXT bubble. Skipped after the final line, since a
  // silent gap right before the options is just dead air — the typing indicator
  // covers inter-bubble pauses, but nothing covers this one.
  if (!opts.last) beatQueue.push({ wait: readMs(s.t), run: () => {} });
}

function beatNode(el_, wait = 240) {
  beatQueue.push({ wait, run: () => body.append(el_) });
}

/* ------------------------------------------------------------- main render */

function go(id, ack) {
  state.node = id;
  render(ack);
}

/**
 * @param ack - the agent's reply to the choice that got us here. Shown first,
 *              before the next question, so the user feels heard.
 */
function render(ack) {
  const node = NODES[state.node];
  clearBeats();
  body.innerHTML = "";

  // Anything already on screen (user echo + ack) is painted immediately;
  // the new question is what gets revealed with pacing.
  if (ack) {
    body.append(el("div", "bubble user enter", ack.choice));
    beatSay({ t: ack.text }, { lead: 300 });
  }

  const say = node.sayFn ? node.sayFn(state) : node.say;
  (say || []).forEach((s, i) => {
    beatSay(s, {
      lead: i === 0 && !ack ? 160 : 200,
      // The last line flows straight into whatever comes next — options or a
      // card. A reading pause only helps between two things to read.
      last: i === say.length - 1,
    });
  });

  if (node.render && RENDER[node.render]) {
    // Cards carry a lot of text; give the first one room to land, then let the
    // rest follow quickly so scanning isn't held hostage to the animation.
    RENDER[node.render](node).forEach((n, i) => beatNode(n, i === 0 ? 320 : 190));
  }

  const options = node.optionsFn ? node.optionsFn(state) : node.options;
  if (options) {
    const wrap = el("div", "options enter");
    options.forEach((o) => {
      wrap.append(
        mkOption(o, () => {
          if (o.set) Object.assign(state.slots, o.set);
          if (o.neutral) state.neutral = true;
          if (o.sample) state.sample = true;
          pushTrail(questionLabel(node), o.title, o.kind === "relief");
          go(o.next, o.ack ? { choice: o.title, text: o.ack } : { choice: o.title, text: "好。" });
        })
      );
    });
    beatNode(wrap);
  }

  if (node.autoNext) {
    beatQueue.push({
      wait: 2400,
      run: () => {
        if (NODES[state.node] === node) go(node.autoNext);
      },
    });
  }

  footer.hidden = node.phase === "done";
  $("#footerHint").innerHTML =
    state.node === "welcome"
      ? `懒得点？<b>按住说话</b>，直接讲给我听 →`
      : `<b>按住说话</b>随时插话，不用等我问完`;

  renderRail(node);
  renderStory(node);
  body.scrollTop = 0;
  body.classList.add("waiting");
  runBeats();
}

// Tapping anywhere in the transcript skips ahead — never make someone wait
// for an animation they've already read past.
body.addEventListener("click", (e) => {
  if (e.target.closest(".opt, .expr, .pos, .ev-item")) return;
  flushBeats();
});

/* ------------------------------------------------------------- composer */

/**
 * WeChat-style input: a keyboard/voice mode toggle, a text field that turns
 * into a send button once you type, and an attachment tray for images and
 * files. Options remain the low-effort path; this is the escape hatch for
 * users who would rather just say it.
 */
const modeToggle = $("#modeToggle");
const cmpInput = $("#cmpInput");
const cmpHold = $("#cmpHold");
const plusBtn = $("#plusBtn");
const sendBtn = $("#sendBtn");
const attachPanel = $("#attachPanel");

let voiceMode = false;

function setVoiceMode(on) {
  voiceMode = on;
  cmpInput.hidden = on;
  cmpHold.hidden = !on;
  modeToggle.textContent = on ? "⌨" : "🎙";
  modeToggle.classList.toggle("on", on);
  modeToggle.setAttribute("aria-label", on ? "切换键盘输入" : "切换语音输入");
  if (!on) cmpInput.focus();
  syncSend();
}

function syncSend() {
  const has = !voiceMode && cmpInput.value.trim().length > 0;
  sendBtn.hidden = !has;
  plusBtn.hidden = has;
}

function closeTray() {
  attachPanel.hidden = true;
  plusBtn.setAttribute("aria-expanded", "false");
}

modeToggle.addEventListener("click", () => {
  closeTray();
  setVoiceMode(!voiceMode);
});

cmpInput.addEventListener("input", syncSend);
cmpInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendTyped();
});
sendBtn.addEventListener("click", sendTyped);

plusBtn.addEventListener("click", () => {
  const open = attachPanel.hidden;
  attachPanel.hidden = !open;
  plusBtn.setAttribute("aria-expanded", String(open));
});

/**
 * Free text is parsed the same way voice is: pull out whatever slots we can,
 * then rejoin the graph. A real build would send this to the LLM loop.
 */
function sendTyped() {
  const text = cmpInput.value.trim();
  if (!text) return;
  cmpInput.value = "";
  syncSend();
  closeTray();
  handleFreeInput(text);
}

const ATTACH_COPY = {
  photo: ["🖼", "IMG_2418.HEIC", "2.4 MB · 图片"],
  camera: ["📷", "拍摄_0828.jpg", "1.8 MB · 图片"],
  file: ["📄", "持仓明细_2026Q3.pdf", "312 KB · PDF"],
  screenshot: ["📱", "券商持仓截图.png", "1.1 MB · 图片"],
};

attachPanel.addEventListener("click", (e) => {
  const btn = e.target.closest(".att");
  if (!btn) return;
  closeTray();
  const [ico, name, size] = ATTACH_COPY[btn.dataset.kind];

  clearBeats();
  const echo = el("div", "bubble user attach-echo enter");
  echo.append(el("span", "ae-ico", ico));
  const meta = el("div", "ae-meta");
  meta.append(el("div", "ae-name", name));
  meta.append(el("div", "ae-size", size));
  echo.append(meta);
  body.append(echo);
  scrollDown();

  pushTrail("上传附件", name);

  // A screenshot is a real shortcut: it routes into the portfolio branch.
  const isHolding = btn.dataset.kind === "screenshot" || btn.dataset.kind === "file";
  beatSay({
    t: isHolding
      ? "收到，我看到你的持仓了。正在识别标的和成本价……"
      : "收到，我看一下这张图。识别到的信息我会跟你确认。",
  });
  if (isHolding) {
    beatQueue.push({
      wait: 900,
      run: () => {
        state.entry = "review";
        state.slots.source = "截图导入";
        syncEntryButtons();
        go("b_parsed");
      },
    });
  }
  runBeats();
});

/* ------------------------------------------------------------- voice */

let holdTimer = null;
let wordTimer = null;

function startHold() {
  cmpHold.classList.add("holding");
  cmpHold.textContent = "松开 发送";
  voiceWrap.classList.add("on");
  voiceLive.textContent = "";
  const words = VOICE_TRANSCRIPT.split(" ");
  let i = 0;
  wordTimer = setInterval(() => {
    if (i >= words.length) return;
    voiceLive.textContent += (i ? " " : "") + words[i];
    i += 1;
  }, 430);
  holdTimer = setTimeout(endHold, 2600);
}

function endHold() {
  clearTimeout(holdTimer);
  clearInterval(wordTimer);
  cmpHold.classList.remove("holding");
  cmpHold.textContent = "按住 说话";
  if (!voiceWrap.classList.contains("on")) return;
  voiceLive.textContent = VOICE_TRANSCRIPT;
  setTimeout(() => {
    voiceWrap.classList.remove("on");
    handleFreeInput(VOICE_TRANSCRIPT, true);
  }, 560);
}

cmpHold.addEventListener("mousedown", startHold);
cmpHold.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startHold();
});
window.addEventListener("mouseup", () => cmpHold.classList.contains("holding") && endHold());
window.addEventListener("touchend", () => cmpHold.classList.contains("holding") && endHold());

/**
 * Shared handler for voice and typed input. The demo recognises a few shapes;
 * anything else gets a graceful "let me work with what you gave me" path.
 */
function handleFreeInput(text, isVoice = false) {
  const t = text.trim();

  // The scripted demo utterance (or anything close to it) fast-fills 4 slots.
  const looksLikeThesis = isVoice || /财报|超预期|看多|看空|想买|跳水|涨|跌/.test(t);

  if (looksLikeThesis && /英伟达|NVDA|财报/i.test(t)) {
    Object.assign(state.slots, VOICE_SLOTS);
    state.entry = "voice";
    syncEntryButtons();
    pushTrail(isVoice ? "按住说话" : "键盘输入", t);
    go("v_result", { choice: t, text: "让我想想……" });
    return;
  }

  // Otherwise acknowledge and route to the most useful starting point rather
  // than dead-ending on "I didn't understand that".
  pushTrail(isVoice ? "按住说话" : "键盘输入", t);
  clearBeats();
  body.innerHTML = "";
  body.append(el("div", "bubble user enter", t));
  beatSay({ t: "我记下了。" });
  beatSay({ t: "为了给你更有价值的分析，我先确认几个关键信息——", cls: "sub" });
  beatQueue.push({ wait: 400, run: () => go("a_symbol") });
  runBeats();
}

/* ------------------------------------------------------------- entries */

function reset(nodeId, entry) {
  clearBeats();
  state.slots = {};
  state.trail = [];
  state.neutral = false;
  state.sample = false;
  state.disputed = false;
  state.disputeReason = "";
  state.entry = entry;
  rail.classList.remove("open");
  syncEntryButtons();
  go(nodeId);
}

const ENTRY_START = {
  analyze: "a_symbol",
  review: "b_import",
  explore: "c_theme",
  voice: "welcome",
};

function syncEntryButtons() {
  [...entrySwitch.children].forEach((b) => {
    b.classList.toggle("on", b.dataset.entry === state.entry);
  });
}

ENTRIES.forEach((e) => {
  const b = el("button", null, e.label);
  b.dataset.entry = e.id;
  b.onclick = () => {
    if (e.id === "voice") {
      reset("welcome", "voice");
      setVoiceMode(true);
      setTimeout(() => {
        startHold();
      }, 260);
      return;
    }
    reset(ENTRY_START[e.id], e.id);
  };
  entrySwitch.append(b);
});

const home = el("button", null, "⌂ 首页");
home.onclick = () => {
  // Replay the cold start: reset first, then let the splash re-trigger render.
  reset("welcome", "analyze");
  clearBeats();
  runSplash();
};
entrySwitch.prepend(home);

/* ------------------------------------------------------------- splash */

const splash = $("#splash");

/**
 * Cold-start screen. Short enough not to be a toll booth, long enough to set
 * the tone before the first question. Tapping skips it.
 */
function runSplash() {
  splash.classList.remove("gone");
  void splash.offsetWidth; // restart the CSS animations on replay
  clearTimeout(runSplash.t);
  runSplash.t = setTimeout(dismissSplash, 1900);
}

/**
 * The conversation only starts once the splash is out of the way — otherwise
 * its opening beats play behind it and the user misses them. Tapping the
 * splash both skips it and starts the conversation immediately.
 */
function dismissSplash() {
  if (splash.classList.contains("gone")) return;
  clearTimeout(runSplash.t);
  splash.classList.add("gone");
  render();
}

splash.addEventListener("click", dismissSplash);

syncEntryButtons();
setVoiceMode(false);
renderRail(NODES.welcome);
renderStory(NODES.welcome);
runSplash();
