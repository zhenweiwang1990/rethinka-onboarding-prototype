# Onboarding Agent · 独立 LLM 循环规格

> 这份文档描述 onboarding 阶段的**独立 agent 循环**：一个专用的 system prompt + 一组受限工具，直到 LLM 调用 `end_onboarding` 才把用户放进 workspace。

## 为什么要独立循环

onboarding 和常规对话的目标函数不一样：

| | 常规 agent | onboarding agent |
| --- | --- | --- |
| 目标 | 回答好当前问题 | **沉淀出可召回的资产** |
| 结束条件 | 用户不问了 | 达到沉淀门槛且用户确认 |
| 工具范围 | 全量 | 受限（不能下单、不能发通知） |
| 失败模式 | 答得不好 | **用户走了，什么也没留下** |

用同一个循环做，模型会倾向于「把问题答漂亮」，而不是「确保东西被存下来」。

---

## 一、核心设计：end 的门槛

`end_onboarding` **不是**「聊够了就结束」，而是一道**资产门槛**。

### 硬门槛（必须全部满足）

```
1. 至少 1 个 thesis 已保存           → 用户有了一个可追踪的判断
2. 该 thesis 至少有 1 条 invalidation → 判断可被证伪，否则无法复盘
3. 至少 1 条 rule 已保存              → 有了纪律，也有了触发点
4. 至少 1 个 recall_hook 已注册       → ★ 有了把用户叫回来的理由
```

前三条来自 issue 的验收要求。**第四条是我加的，也是整个设计的关键**：前三条决定了"这次体验完整"，第四条决定了"用户会不会回来"。没有第四条，onboarding 就是一次性的。

### 软门槛（尽量但不阻塞）

- 交易表达（structure）已选择
- 用户确认过决策卡内容
- 用户主动反驳过至少一条证据（强信号：他在真思考）

### 逃生舱

用户明确说"我不想弄了"、连续两次选择跳过、或超过 12 轮仍未达标 —— 调用 `save_partial_and_exit`，**保存半成品 + 至少注册一个轻量 recall hook**（比如"三天后帮你看一眼"）。

绝不能因为门槛没达到就把用户困住。**降级永远比困住好。**

---

## 二、召回钩子（recall_hook）

这是你说的"有助于之后对用户产生有价值的召回"的落点。onboarding 结束时**必须至少注册一个**。

### 五种类型

| 类型 | 触发时机 | 通知示例 | 适合谁 |
| --- | --- | --- | --- |
| `market_close_summary` | 当日收盘后 | 「NVDA 今天 +2.1%，你关注的数据中心指引没有新消息。你的判断依然成立。」 | 所有人（默认） |
| `morning_brief` | 次日盘前 | 「早上好。昨夜 NVDA 相关有 2 条新消息，其中 1 条和你的命题相关。」 | 有明确命题的用户 |
| `price_alert` | 触及价位 | 「NVDA 触及 $158，这是你设的失效条件。要一起看看吗？」 | 设了价格规则的用户 |
| `event_watch` | 财报/事件日 | 「NVDA 财报明天盘后。你当初关注的是数据中心营收，我准备好对照了。」 | 有催化剂命题的用户 |
| `thesis_review` | 到期复盘 | 「距离你说的『几周』到了。当时的判断，现在回头看怎么样？」 | 所有人 |

### 选择原则

**从用户已经说过的话里生出来，不要问"你想接收什么通知"。**

- 用户选了"几天"→ 优先 `market_close_summary`
- 用户选了"几周（财报）"→ 优先 `event_watch` + `morning_brief`
- 用户设了价格规则 → 必配 `price_alert`
- 用户是复盘入口且答不出当初理由 → `thesis_review`（给一个温和的重看时点）

**通知文案必须引用用户自己的原话**，这是它和普通行情推送的根本区别：不是"NVDA 涨了 2%"，而是"**你当初关注的是数据中心营收**，现在有消息了"。

---

## 三、System Prompt

```text
# 角色

你是 Rethinka 的投研助理，正在陪一位新用户完成第一次投资研究。

你的专业能力：拉取行情与基本面数据、检索新闻与财报、构建交易结构、
计算风险收益。你的工作方式：把用户模糊的直觉，整理成有证据、有结构、
有纪律的决策记录。

# 这次对话的唯一目标

让用户在 5-10 分钟内，亲手产出一份属于他自己的决策记录，并且带走一个
"值得回来看看"的理由。

不是回答问题，不是展示能力，是**帮他沉淀下来东西**。

# 语气准则（重要）

- 肯定用户的每一个选择。他选什么都有他的道理，先认可，再补充。
- 给参考建议，不给命令。用"我的建议是""供你参考""你可以考虑"，
  不用"你应该""你必须""答应我"。
- 共情，不评判。用户说"想不起来当初为什么买"，这很正常，不是错误。
  永远不要让用户觉得自己做错了什么。
- 体现专业，但不说教。用一句话点出专业视角即可，例如"机构做风控
  也是这个思路"，然后立刻回到用户的事情上。
- 每次回应先接住用户刚说的话，再往前推进。不要问完就跳下一题。

绝对不要说：
  ✗ "答应我别跳过"（道德绑架）
  ✗ "盘面一红一绿，人是会变的"（预设用户不可靠）
  ✗ "那不是决定，那是拖延"（指责）
  ✗ "你现在拿着的其实是别人的判断"（否定用户）
应该说：
  ✓ "这是很成熟的处理方式"
  ✓ "我的参考建议是……"
  ✓ "太正常了，隔了几个月谁都记不清"
  ✓ "参考别人的判断很正常，我们把你自己的依据补上"

# 节奏准则

- 一次只问一个问题。用户的脑子需要处理时间。
- 每个问题都提供 3-4 个具体选项，其中至少一个是降压选项
  （"说不准""没想好""你帮我参考"）。降压选项被选中后，你的行为
  必须真的不同（例如不再给方向性建议，改为正反证据对称呈现），
  而不只是安慰。
- 不要让用户面对空白输入框。
- 用户随时可以打字、发语音、传图片或文件，都要接得住。

# 流程（灵活，不必严格按序）

1. 命题：标的 → 方向 → 时间窗口 → 为什么是现在
2. 证据：拉数据，生成决策卡（含支持与反对证据、三种情景）
3. 失效条件：什么情况下要重新考虑（这一条只有用户能定）
4. 结构：目标 → 风险上限 → 交易表达
5. 纪律：一条规则就够
6. 召回：注册至少一个回访钩子

如果用户一句话说清了多个字段（语音/打字），直接跳过对应提问。

# 结束条件

只有当以下四项都完成，才调用 end_onboarding：
1. save_thesis 已成功
2. 该 thesis 有 invalidation
3. save_rule 已成功
4. register_recall_hook 已成功（至少一个）

如果用户明确想离开、连续两次跳过、或已超过 12 轮仍未达标，
调用 save_partial_and_exit，并至少注册一个轻量召回钩子。

不要为了凑满条件而拖住用户。降级退出永远好过强留。

# 安全边界

- 只读。不下单，不接触交易权限。
- 所有数据标注来源和时间。
- 不做收益承诺，不用"稳赚""必涨"这类表述。
- 输出中出现的任何结构都标注"示例/模拟"。
- 首次 onboarding 不出现真实下单入口。
```

---

## 四、Tools 列表

### A. 数据检索（只读，随时可用）

| 工具 | 入参 | 出参 | 用途 |
| --- | --- | --- | --- |
| `search_symbol` | `query` | `[{symbol, name, market, price, asof}]` | 标的搜索，支持中英文和模糊匹配 |
| `get_quote` | `symbol` | `{price, change, volume, mktcap, asof}` | 实时行情 |
| `get_fundamentals` | `symbol, metrics[]` | `{pe, ps, revenue_growth, margins, asof}` | 基本面与估值分位 |
| `get_news` | `symbol, since, limit` | `[{title, source, url, published_at, sentiment}]` | 新闻与公告 |
| `get_earnings` | `symbol` | `{next_date, last_result, guidance, consensus}` | 财报日历与预期 |
| `get_price_levels` | `symbol` | `{support[], resistance[], ma[], atr}` | 技术位（用于生成价格规则） |
| `get_options_chain` | `symbol, expiry` | `{strikes[], iv, oi, spreads[]}` | 期权链（构建价差表达） |

### B. 结构化产出（写入，是"沉淀"的核心）

| 工具 | 入参 | 说明 |
| --- | --- | --- |
| `build_decision_card` | `symbol, direction, horizon, why` | 生成决策卡：命题、支持/反对证据、三种情景、关键变量。**每条证据必须带 source + asof** |
| `save_thesis` | `symbol, direction, horizon, why, invalidation` | ★ 保存命题。**门槛 1、2** |
| `add_evidence` | `thesis_id, stance, text, source, asof` | 追加证据。`stance: support \| oppose \| user_rebuttal` |
| `dispute_evidence` | `evidence_id, user_reason` | ★ 用户反驳。记为 `user_rebuttal`，复盘时优先对照——**这是用户判断力记录的起点** |
| `build_structures` | `thesis_id, goal, max_loss` | 生成 2-3 个交易表达，含成本、最大损失、盈亏平衡、情景损益。全部标注"示例" |
| `save_structure` | `thesis_id, structure_id` | 保存选定表达（软门槛） |
| `save_rule` | `thesis_id, type, condition, action` | ★ 保存纪律规则。`type: price \| thesis \| time`。**门槛 3** |

### C. 召回钩子（★ 决定留存）

| 工具 | 入参 | 说明 |
| --- | --- | --- |
| `register_recall_hook` | `type, thesis_id, schedule, message_template` | ★ **门槛 4**。`type` 见第二节五种。`message_template` 必须引用用户原话 |
| `list_recall_hooks` | — | 已注册的钩子，避免重复 |
| `preview_recall` | `hook_id` | 生成一条示例通知给用户看 —— **让他知道回来能得到什么** |

### D. 输入处理（对应微信式输入栏）

| 工具 | 入参 | 说明 |
| --- | --- | --- |
| `parse_utterance` | `text` | 从自由文本抽取 `{symbol, direction, horizon, why, invalidation}`，允许部分为空 |
| `transcribe_audio` | `audio_url` | 语音转文字，再交给 `parse_utterance` |
| `parse_screenshot` | `image_url` | 识别券商持仓截图 → `[{symbol, shares, cost, pnl}]`，返回置信度 |
| `parse_document` | `file_url` | 解析 PDF/CSV 持仓或研报 |

### E. 流程控制

| 工具 | 入参 | 说明 |
| --- | --- | --- |
| `ask_user` | `question, options[], allow_free_input` | 提问。`options` 里应至少含一个降压项 |
| `show_thinking` | `steps[]` | 展示检索过程，让等待可见 |
| `check_completion` | — | 返回四项门槛的达成状态。**调 end 之前应先调它** |
| `end_onboarding` | `summary, thesis_ids[], hook_ids[]` | ★ 唯一的正常出口。四项门槛齐备才可调用 |
| `save_partial_and_exit` | `reason, resume_at` | 逃生舱。保存半成品 + 至少一个轻量钩子 |

---

## 五、循环骨架

```ts
async function runOnboarding(session: Session) {
  const messages: Message[] = [{ role: "system", content: ONBOARDING_PROMPT }];
  let turns = 0;

  while (turns < MAX_TURNS) {
    const res = await llm.call({ messages, tools: ONBOARDING_TOOLS });

    for (const call of res.toolCalls ?? []) {
      // 正常出口：先校验门槛，不满足就退回让模型补齐
      if (call.name === "end_onboarding") {
        const gate = await checkCompletion(session);
        if (gate.ok) return { status: "completed", ...gate.assets };

        messages.push(toolResult(call, {
          error: "gate_not_met",
          missing: gate.missing,           // e.g. ["recall_hook"]
          hint: "请先补齐缺失项，再结束。不要为此拖住用户。",
        }));
        continue;
      }

      // 逃生舱：无条件放行，但兜底注册一个轻量钩子
      if (call.name === "save_partial_and_exit") {
        await ensureMinimalHook(session);
        return { status: "partial", resumeAt: call.args.resume_at };
      }

      messages.push(toolResult(call, await execute(call, session)));
    }

    if (res.text) await session.say(res.text);
    if (res.needsUserInput) {
      messages.push({ role: "user", content: await session.waitForUser() });
      turns += 1;
    }
  }

  // 兜底：轮次耗尽也必须留下东西
  await ensureMinimalHook(session);
  return { status: "partial", reason: "max_turns" };
}
```

两个关键点：

1. **`end_onboarding` 会被驳回。** 门槛不满足时返回 `gate_not_met` + 缺什么，模型自己补。但 hint 里明确写"不要为此拖住用户"，避免它反复纠缠。
2. **所有退出路径都保证有召回钩子。** `ensureMinimalHook` 是最后一道保险 —— 哪怕用户只填了个标的，也至少能在收盘后给他一条有意义的消息。

---

## 六、埋点

对应 issue 的验收指标：

| 指标 | 埋点 |
| --- | --- |
| TTFV < 90s | `first_decision_card_rendered` 时间戳 |
| 闭环完成率 | `end_onboarding` / `session_start` |
| Position Plan 创建率 | `save_rule` 成功数 / 完成会话数 |
| **7 日回访率** | `recall_notification_opened` → `session_resumed` |
| 第二张卡完成率 | 同用户第二次 `save_thesis` |

额外建议观察：

- **钩子类型 × 回访率** —— 哪种召回真的有用，直接决定 P1 优先级
- `dispute_evidence` 调用率 —— 用户是否在真思考，这是产品是否被当回事的强信号
- `save_partial_and_exit` 的 `missing` 分布 —— 哪一道门槛最容易卡住

---

## 七、已确定的设计决策

### 1. 门槛 4（召回钩子）是硬门槛，注册动作隐式完成

**结论：是硬门槛。** 但注册动作应当**隐式完成**（AI 说"财报后第二天我给你看对照"，用户点"好"即注册），而不是弹一个通知权限设置页。

**重要补充：splash 后必须先注册系统通知权限，再开始 onboarding。**

流程：

```
冷启动 splash (1.9s)
  ↓
系统通知权限请求卡片（iOS/Android 原生样式）
  "Rethinka 会在关键信息变化时通知你，
   比如你关注的命题触发失效条件、
   或新证据出现。"
  [允许] [暍]
  ↓
welcome 对话开始
```

理由：

- 前置到 splash 之后、对话之前，用户还没投入成本，拒绝率低。
- 如果用户拒绝，onboarding 仍可完成，但 `register_recall_hook` 会降级为"保存触发条件，权限开启后生效"，并在结束页温和提示一次。
- iOS/Android 的权限请求只能弹一次，必须谨慎。

### 2. 通知频率上限

**结论：首周每天不超过 1 条，且必须与用户的命题相关。**

实现：

- 每个 `recall_hook` 带一个 `daily_quota` 字段，首周固定为 1。
- 同一天内多个钩子触发时，优先级：`price_alert` > `event_watch` > `thesis_review` > `morning_brief` > `market_close_summary`。
- 通知文案必须引用用户原话，例如"你当初关注的是数据中心营收"，而不是泛泛的"NVDA 有新消息"。

理由：**一旦变成行情推送，就和其它 App 没区别了。** 召回的价值在于它和用户自己的判断绑定，而不是信息本身。

### 3. `parse_screenshot` 的置信度阈值处理

**结论：低于阈值时逐条确认，不直接转手动输入。**

流程：

```python
result = parse_screenshot(image_url)

if result.confidence < 0.85:
    for row in result.holdings:
        if row.confidence < 0.75:
            # 单行置信度过低，逐字段确认
            await ask_user(f"识别到 {row.symbol}，成本价 {row.cost}，对吗？", 
                           ["对", "成本价不对", "标的不对"])
        else:
            # 整体可信，只做一次性确认
            show_card(result.holdings)
            await ask_user("这些持仓对吗？", ["对", "有几个不对，我指出来"])
```

理由：

- **准确度比速度更重要。** 用错误的持仓数据做分析，比慢 30 秒糟糕得多。
- 逐条确认本身是建立信任的机会——用户会感受到"它真的在认真看我的持仓"。
- 机构产品（Bloomberg、万得）都是这个做法。

---

## 八、实现优先级建议

**P0（onboarding 本身）**

- 数据检索工具：`search_symbol`, `get_quote`, `get_fundamentals`, `get_news`, `get_earnings`
- 结构化产出：`build_decision_card`, `save_thesis`, `add_evidence`, `save_rule`
- 召回钩子：`register_recall_hook`（类型优先级：`market_close_summary` > `event_watch` > `price_alert`）
- 流程控制：`ask_user`, `check_completion`, `end_onboarding`, `save_partial_and_exit`
- 输入处理：`parse_utterance`（语音可以 P1）

**P1（决定留存的关键）**

- `dispute_evidence` —— 这是用户判断力记录的起点，也是产品是否被当回事的强信号
- `preview_recall` —— 让用户在结束页**看到一条真实的召回通知示例**，直接回答"我为什么要回来"
- `transcribe_audio` + `parse_utterance` —— 语音越级通道，但准确率会直接决定它是加分项还是减分项
- `parse_screenshot` —— 持仓截图是复盘路径的最快入口，也是和券商 App 的天然衔接点

**P2（体验增强）**

- `get_price_levels`, `get_options_chain` —— 用于生成更精细的交易表达
- `build_structures`, `save_structure` —— 交易结构是软门槛，不阻塞 end
- `parse_document` —— PDF 研报解析，但 OCR + 结构化难度高

---

## 九、关键埋点（对应验收指标）

| 指标 | 埋点 | 目标 |
| --- | --- | --- |
| TTFV < 90s | `first_decision_card_rendered` 时间戳 | < 90s |
| 闭环完成率 | `end_onboarding` / `session_start` | > 60% |
| Position Plan 创建率 | `save_rule` 成功数 / 完成会话数 | > 80% |
| **7 日回访率** | `recall_notification_opened` → `session_resumed` | > 40% |
| 第二张卡完成率 | 同用户第二次 `save_thesis` / 7 日内回访用户数 | > 25% |

**额外建议观察：**

- **钩子类型 × 回访率** —— 哪种召回真的有用，直接决定 P1 优先级
- `dispute_evidence` 调用率 —— 用户是否在真思考
- `save_partial_and_exit` 的 `missing` 分布 —— 哪一道门槛最容易卡住
- **通知权限授予率**（splash 后） —— 如果低于 50%，文案或时机需要调整
