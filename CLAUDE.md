# CLAUDE.md — 回合制自动战斗 sim

## 这是什么

一个**决定论**回合制自动战斗 sim。核心是纯函数 `runBattle`(见 `src/index.ts`):
输入(队伍, 种子)→ 输出(结果 + 结构化事件流)。无玩家逐回合输入,策略深度在组队构筑。

本项目是"练 AI 自主开发工作流"的载体:golden test 钉死正确性,AI 加任何单位/技能后
`npm run verify` 变红就知道搞坏了。完整设计背景见 `DESIGN_DECISIONS.md`(14 条已决项)。

## 唯一验证入口

```
npm run verify
```

= `tsc --noEmit` + schema 校验 + `vitest run` + `biome check`,单一 exit-code。
**绝不用 `| tail` 之类吞掉 exit code**——AI 靠 exit code 判成败。
verify 覆盖到哪,AI 的自主就到哪;它漏掉的(如数值平衡)才留给人判断。

## 铁律(违反 = 测试变红,不是"请遵守")

1. **sim 层全整数,禁浮点。** `src/` 下每一处 gameplay 运算都必须是整数。
   AV = `Math.floor(BIG / speed)`,伤害/血量/时长全整数。

2. **sim 层禁 `Math.random` / `Date.now` / `performance.now` / 任何 IO。**
   `src/` 下每个文件都是纯逻辑。需要随机时走注入的 PRNG seam(slice1 尚无 RNG)。

3. **所有"选一个 / 排序"的平局,一律收敛到 `slotIndex`。**
   整个代码库破平只有一个答案:`src/tiebreak.ts`。`targeting.ts`、engine 的行动顺序,
   每一处选敌/排序都必须调 `tiebreak.ts` 的比较器,绝不靠数组遍历顺序破平。
   命门由 `tests/tiebreak.test.ts` 钉死。

4. **技能效果 = 纯声明式数据 + 预定义原语。** 见 `src/effects.ts` 的效果解释器。
   **绝不开代码 escape hatch**(不允许技能带任意 apply 函数)。
   表达不出的新机制 = "在 `effects.ts` 加一个原语 + 在 `DESIGN_DECISIONS.md` 记一条 ADR"的信号,
   不是"破例写代码"。

5. **事件必须是结构化对象,不是拼好的字符串。** 见 `src/types.ts` 的 `BattleEvent`。
   事件流是将来文本战报 / three.js 渲染的数据源,必须可被 digest / 机械校验 / i18n 消费。

6. **golden 红了,先假设是代码错,不是 golden 该更新。** 见 `tests/golden.test.ts`。
   改代码别改 harness:别放宽精度、别删采样字段、别为了过而重生 golden。
   重生只能用显式 `npm run golden:update`(`UPDATE_GOLDEN=1`),且必须是单独一个 commit。

## 加内容的正确姿势

- **加单位**:往 `src/data/units.ts` 加一条 `UnitDef`。`skillId` 必须指向已存在技能,
  否则 schema 校验(`npm run check-schema`)不跑战斗就报悬空引用。
- **加技能**:往 `src/data/skills.ts` 加一条 `Skill`,`effects` 只能用 `Effect` 已有原语。
- 加完跑 `npm run verify`。golden 会因新单位/技能改变战斗而变红——
  确认改动符合预期后,`npm run golden:update` 单独 commit 重生。

## 决定论怎么保证(三层,别破坏)

1. 物理基础:全整数 + sim 层零随机零 IO(铁律 1、2)。
2. 抽值顺序稳定:破平统一收敛 `slotIndex`(铁律 3)——迭代顺序变动不分叉世界。
3. golden-trace 指纹:`tests/golden.test.ts` 按排除法采样(**新 gameplay 字段默认被 pin**)
   + 事件流/状态双 digest。任何行为漂移都变红。

## [DEFER] 撞到痛点再加,现在别提前搭

- Stop hook(机械扫 `console.log`/`.only(`/em-dash 等 verify 抓不到的):第一次被恶心到当天加。
- 分布式多 CLAUDE.md:等 `src/` 长到多个各有局部约定的子系统再就近拆。
- RNG(暴击/闪避/随机目标):第一个专项教学关卡,届时给 golden 加第三重"抽值顺序指纹"。
- 站位/多技能/插队大招:见 `DESIGN_DECISIONS.md` 各 [DEFER] 条。

## 给 AI 的协作提示

- 强模型倾向 under-spawn:探索/审查该主动 fan-out 子代理。
- 硬约束都有 pinned test 兜底(`tests/tiebreak.test.ts`、`tests/golden.test.ts`);
  拿不准某改动对不对,先跑 `npm run verify`,让测试告诉你。
