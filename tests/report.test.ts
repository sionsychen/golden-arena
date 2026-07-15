import { describe, expect, it } from "vitest";
import { skills } from "../src/data/skills.js";
import { unitsA, unitsB } from "../src/data/units.js";
import { runBattle, type TeamInput } from "../src/index.js";
import { formatBattleReport } from "../src/report.js";
import type { BattleEvent, BattleResult } from "../src/types.js";

// 投影层测试(决定13:verify 覆盖到哪 AI 自主就到哪——文本战报也要进网)。
// 重点:穷尽所有事件类型不崩 + 关键信息在场。不 pin 逐字文案(那是表现层,会频繁改)。

const teams: TeamInput[] = [
  { team: "A", units: unitsA },
  { team: "B", units: unitsB },
];

describe("report: 文本战报投影", () => {
  it("固定战斗能渲染出完整战报且含结局", () => {
    const result = runBattle(teams, skills, 12345);
    const lines = formatBattleReport(result, teams);
    const text = lines.join("\n");
    expect(text).toContain("开战");
    expect(text).toContain("战斗结束");
    expect(text).toContain("A 队获胜");
    expect(text).toContain("终局状态");
  });

  it("每种事件类型都能渲染成非空行,不崩不留原始 type", () => {
    // 手搓一个覆盖全部 8 种事件的合成结果,确保投影层对每种类型都有分支。
    const allEvents: BattleEvent[] = [
      { type: "act", slotIndex: 0, name: "铁卫", av: 111 },
      { type: "damage", srcSlot: 0, tgtSlot: 2, amount: 16, hpAfter: 28 },
      { type: "dot_apply", srcSlot: 2, tgtSlot: 0, power: 5, duration: 3 },
      { type: "dot_tick", slotIndex: 0, amount: 5, hpAfter: 23 },
      { type: "buff_apply", srcSlot: 3, tgtSlot: 3, stat: "atk", amount: 6, duration: 2 },
      { type: "status_expire", slotIndex: 3, kind: "buff" },
      { type: "death", slotIndex: 2, name: "毒手" },
      { type: "battle_end", winner: "A", reason: "wipe", turns: 7 },
    ];
    const synthetic: BattleResult = {
      winner: "A",
      reason: "wipe",
      turns: 7,
      events: allEvents,
      finalUnits: [],
    };
    const lines = formatBattleReport(synthetic, teams);
    const text = lines.join("\n");
    for (const e of allEvents) {
      // 原始 type 串(如 "dot_apply")不应泄漏进给人看的战报
      expect(text).not.toContain(e.type);
    }
    expect(text).toContain("中毒");
    expect(text).toContain("毒素");
    expect(text).toContain("攻击 +6");
    expect(text).toContain("倒下");
  });

  it("self buff 显示'自身'而非'X 使 X'", () => {
    const synthetic: BattleResult = {
      winner: "draw",
      reason: "wipe",
      turns: 1,
      events: [{ type: "buff_apply", srcSlot: 3, tgtSlot: 3, stat: "atk", amount: 6, duration: 2 }],
      finalUnits: [],
    };
    const text = formatBattleReport(synthetic, teams).join("\n");
    expect(text).toContain("使 自身");
  });
});
