# 回合制自动战斗 Sim — 设计决策交接文档

> 本文档记录项目启动前经过 `grill-me` 逐条敲定的设计决策。
> 每条都含"为什么"和代价。标 **[DEFER]** 的是刻意推迟的"后续教学关卡"。
> 新会话接手时先读本文档,无需重新讨论这些已决项。

## 元目标(最重要,别忘)

**这个项目是"手段"不是"产品"。** 真正目的是**练出一套 AI 主力开发的工作流**
(仿 world-of-claudecraft 那种:AI agent 能自主开发 + 能自己验证对错)。
战斗 sim 只是练这套工作流的**载体**,因为它满足三条硬标准:

1. 正确性能被测试机械钉死(决定论 sim)→ AI 能自证对错,不用人肉喂饭
2. 小到一天能启动,又大到有并行压力
3. 内容可扩展成 data-as-code → 源源不断产生独立可并行的 PR

**核心心法:不要照抄 WoCC 的终态(43 个 CLAUDE.md/8 个 review agent)。**
那是它 1900 个 PR 之后被痛点逼出来的。第一天只搭"能自证的最小切片",
其余机制**痛点驱动、撞到了再加**。

参考资产(在 D:\WorkingVault\Notes\):
- claude-md-ai-collab-patterns.md — AI 协作规范 6 模式
- sim-determinism-engineering.md — 决定论三层强制(本项目地基)
- ai-asset-generation-pipeline.md — AI 生成资产(远期)

---

## 已敲定的设计决策(14 条)

### 战斗模型

1. **自动结算(auto-battler)**,无玩家逐回合输入。sim 是纯函数
   `(初始队伍, 种子) → 结果+事件流`。这是最干净的验证锚点。
   策略深度全部前移到**组队构筑**,不在战斗操作。

2. **无位置,纯队列**。两队各一排,靠 targeting 规则结算,无坐标无移动。
   - **[DEFER]** 站位/前后排/格子 → 留作"给已有系统加空间层而不破坏决定论"的教学关卡。

3. **整数速度 + AV 行动值系统(仿星穹铁道)**,详见下条。

### 行动顺序(星铁式 AV 流)

4. **整数行动值(AV)时间轴**,不是"回合重排"。
   - 跑道长度 `BIG`(如 10000),单位按速度前进,**AV = BIG / 速度**(定死取整规则,**全程整数,禁浮点**)。
   - **取当前 AV 最小者行动**,行动后该单位 AV 重置(重新累积)。
   - **平局(AV 相同)→ 用 `slotIndex` 固定稳定键破平,绝不靠遍历顺序。**
   - 推条/拉条 = `av ± BIG × 百分比`,整数,clamp [0, BIG]。速度 buff 走这里。
   - **必须有终止兜底**:累计推进 AV 超上限 → 按总血量%裁决胜负,防"两奶妈互推永不结束"。

5. **事件跳跃推进,不逐 tick 模拟**。直接算 min AV 一次性推进全场时间,
   跳过无事发生的中间 tick。纯整数减法 + 一次排序,无累积误差。
   - **[DEFER]** 额外行动/插队(大招/追击)→ 星铁灵魂,但留作后续。第一版纯 AV 流。

### 单位行动

6. **单技能起步**。每个单位一个招牌技能,轮到 = 无脑放。
   - **[DEFER]** 多技能+冷却+选择逻辑 → 留作"给单位加 AI 决策层"的教学关卡。
   - 深度靠**单位变多**(并行 PR 燃料),不靠单位变复杂。

7. **targeting = 声明式枚举**:`front / lowest_hp / highest_atk / all / self / lowest_hp_ally`。
   技能数据带 `target` 字段。
   - **命门:所有"选一个/排序"操作的平局,一律收敛到同一把尺子 `slotIndex`。**
     `lowest_hp` 排序键 = `(hp, slotIndex)`,`highest_atk` = `(-atk, slotIndex)`。
     整个代码库"平局怎么破"只有一个答案、一个可 review 的模式。

### 效果与状态

8. **技能效果 = 纯声明式数据 + 预定义原语组合**(yume/WoCC 路线)。
   例:`{type:'damage', power:30, target:'lowest_hp'}`、`{type:'buff', stat:'atk', amount:5, duration:2}`。
   sim 里有固定的"效果解释器"消费这些数据。
   - **绝不开代码 escape hatch(不允许技能带任意 apply 函数)。**
     表达不出的新机制 = "加原语 + 写 ADR"的信号,不是"破例写代码"。
   - 前期要忍原语少、有些技能表达不出——那个时刻正是练"扩展原语集"的教材。

9. **buff/debuff 时长 = 按"承受方自己的行动次数"结算**(星铁式)。
   - DOT 伤害 + duration−1 发生在**承受方轮到行动时、行动之前**。
   - `duration:2` = 受害者接下来 2 个自己的回合。减速敌人=拖长其 debuff 承受(feature 非 bug)。

10. **slice 1 无 RNG,纯确定**。伤害定值、目标按规则、无暴击闪避。
    - golden 只 pin 两重:状态快照 + 事件流 digest。
    - **[DEFER]** RNG(暴击/闪避/随机目标)→ **第一个专项教学关卡**。
      加暴击时 golden 因"凭空冒出抽值"全红,逼你接单流 PRNG + observer seam
      + 抽值顺序指纹(sim-determinism 笔记全套)。单独、干净地练一次。

### sim 输出

11. **sim 一等输出 = 结果 + 结构化事件流**。
    边跑边 emit `{type:'act',unit,av}`、`{type:'damage',src,tgt,amount,hpAfter}`、`{type:'death',unit}`...
    - **事件必须是结构化对象,不是拼好的字符串。** 才能被 digest/机械校验/i18n/多投影层消费。
    - 事件流 = 将来文本战报 / Godot 渲染的数据源(sim 产状态,投影层消费,同 WoCC/yume 架构)。

---

## 工作流层决策

12. **golden test = 独立文件(可读 trace) + digest 指纹**。测试框架 **Vitest**。
    - golden 存 `tests/golden/<scenario>.json`,存完整可读 trace(状态快照+事件流)。
    - 另单独 pin digest 抓"数值碰巧相等但顺序变了"的隐形漂移(RNG 抽值顺序指纹等 slice2)。
    - **排除法采样**:dump"除排除列表外每个字段",新加 gameplay 字段**默认被 pin**。
      排除列表本身也 pin 进快照(防偷偷塞字段掩盖漂移)。
    - **更新 = 显式独立动作**:`UPDATE_GOLDEN=1`,且重生是单独 commit。
      **铁律:红了先假设代码错,不是 golden 该更新。改代码别改 harness。**

13. **verify = 单一 exit-code 安全入口**:`npm run verify` = tsc + schema校验 + vitest(含golden) + biome。
    - **绝不用 `npm test | tail` 吞 exit code**(agent 靠 exit code 判断成败)。
    - **schema 校验是声明式数据路线的独有红利**:不跑战斗就能抓数据错
      (target 枚举拼错、悬空引用),最便宜的一层网,务必吃到。
    - slice 1 规模小,全量跑就行。**"只测改动文件"等被慢拖垮再加**(痛点驱动)。
    - **心法:verify 覆盖到哪,AI 的自主就到哪。** verify 漏掉的(如数值平衡)
      = 必须留给人/专职 review agent 判断的部分。这条线 = "AI 管什么/人管什么"的边界。

14. **CLAUDE.md 第一天极简单文件(~100 行),只钉死不变量**:
    - 内容:项目是什么 + verify 怎么跑 + 那几条铁律(整数AV、统一slotIndex破平、
      sim层纯逻辑禁 Date.now/Math.random/IO、事件结构化、红了先怪代码)。
    - 写法抄笔记两条:**显式作用域**(用"所有/每个",强模型不主动泛化);
      **anchor rule**(禁写"目前6个规则""见第42行"这类会腐烂的,只引稳定符号名+pinned test名)。
    - **[DEFER]** Stop hook → 第一次被"verify抓不到但不想要"的事恶心到(console.log/em-dash/.only)当天加。
    - **[DEFER]** 分布式多 CLAUDE.md → 等 src 真长到多个各有局部约定的子系统再就近拆。
    - **心法:CLAUDE.md 只写"AI 自己撞不出来、或代价很大"的东西**。能被 verify 抓的、
      能从代码推断的,都不写。稀缺篇幅只留给"隐形的、跨文件的、违反很久才发现的"约束。

---

## 第一天的目标(不是搭脚手架,是搭"第一个能自证的切片")

```
一场确定性战斗:2单位 + 3技能 + 固定种子 → 固定结果
+ golden test 钉住这场战斗的 trace(状态快照 + 事件流 digest)
+ 三件套:根CLAUDE.md(钉死不变量) / verify命令 / (hook等痛点)
```

**这一刻是分水岭**:从此 AI 加任何新单位/技能,golden 红了它自己就知道搞坏没有——
工作流开始自主转。其余机制(worktree隔离、分层gate、模块接缝、fresh reviewer)
**全部等真撞到那个痛点再加,一个都别提前搭。**

痛点 → 机制 对照表:
| 撞到这个痛 | 才加这个 |
|---|---|
| 单文件膨胀改一处碰一堆 | 模块化 + context seam |
| 多 agent 并行踩同一文件 | worktree 隔离 + 单一 owner |
| agent 审自己 diff 漏 bug | fresh reviewer(只做 coverage) |
| review 太贵没法天天跑 | 分层 gate(hook/push/agent) |
| 加字段忘写测试 | golden 新字段默认 pin(已在12实现) |