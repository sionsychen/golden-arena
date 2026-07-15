import type { Skill } from "../types.js";

// 声明式技能数据(决定6:每个单位一个招牌技能;一个技能可含多个效果原语)。
// 这组技能刻意覆盖全部三种原语 + 多效果技能,让 golden 钉住核心机构(尤其决定9的 dot/duration 时序)。
export const skills: readonly Skill[] = [
  // 纯伤害,打最前排(front)
  {
    id: "cleave",
    name: "顺劈",
    effects: [{ type: "damage", power: 10, target: "front" }],
  },
  // 纯伤害,点杀残血(lowest_hp)——与 front 区分开,coverage 到真实选敌
  {
    id: "snipe",
    name: "狙击",
    effects: [{ type: "damage", power: 8, target: "lowest_hp" }],
  },
  // 持续伤害(dot):在承受方自己的回合、行动之前结算(决定9)
  {
    id: "venom",
    name: "淬毒",
    effects: [{ type: "dot", power: 5, duration: 3, target: "front" }],
  },
  // 多效果招牌技:先自 buff 攻击力,再攻击——buff 直接影响自身后续伤害,让 buff 原语在 golden 里"有意义"
  {
    id: "warcry",
    name: "战吼",
    effects: [
      { type: "buff", stat: "atk", amount: 6, duration: 2, target: "self" },
      { type: "damage", power: 4, target: "front" },
    ],
  },
];
