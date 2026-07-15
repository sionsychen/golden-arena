import type { TeamInput } from "./index.js";
import type { BattleEvent, BattleResult, TeamId } from "./types.js";

// 文本战报投影层(决定11)。纯函数,只消费事件流,绝不重算 sim。零 IO(IO 隔离在 scripts/)。
// 这是 three.js 投影层之外的另一条投影通道——同一份事件流喂不同投影,证明架构分离成立。

/** slot → 展示信息的映射(事件只带 slotIndex,战报要显示名字/队伍)。 */
interface SlotInfo {
  readonly name: string;
  readonly team: TeamId;
}

function buildSlotTable(teams: readonly TeamInput[]): Map<number, SlotInfo> {
  const table = new Map<number, SlotInfo>();
  let slot = 0;
  for (const t of teams) {
    for (const def of t.units) {
      table.set(slot++, { name: def.name, team: t.team });
    }
  }
  return table;
}

/** "铁卫[A]" 这样的带队标签,让读者一眼看清敌我。 */
function tag(table: Map<number, SlotInfo>, slot: number): string {
  const info = table.get(slot);
  return info ? `${info.name}[${info.team}]` : `#${slot}`;
}

const STAT_CN: Record<string, string> = { atk: "攻击", speed: "速度" };

/** 单条事件 → 一行中文战报。穷尽 switch(漏类型 tsc 会因 noFallthroughCasesInSwitch/类型不全报错)。 */
function formatEvent(e: BattleEvent, table: Map<number, SlotInfo>): string {
  switch (e.type) {
    case "act":
      return `→ ${tag(table, e.slotIndex)} 行动`;
    case "damage":
      return `  ${tag(table, e.srcSlot)} 攻击 ${tag(table, e.tgtSlot)},造成 ${e.amount} 伤害(剩余 HP ${e.hpAfter})`;
    case "dot_apply":
      return `  ${tag(table, e.srcSlot)} 令 ${tag(table, e.tgtSlot)} 中毒(每回合 ${e.power},持续 ${e.duration} 回合)`;
    case "dot_tick":
      return `  ${tag(table, e.slotIndex)} 受到毒素 ${e.amount} 伤害(剩余 HP ${e.hpAfter})`;
    case "buff_apply": {
      const who = e.srcSlot === e.tgtSlot ? "自身" : tag(table, e.tgtSlot);
      return `  ${tag(table, e.srcSlot)} 使 ${who} ${STAT_CN[e.stat] ?? e.stat} +${e.amount}(持续 ${e.duration} 回合)`;
    }
    case "status_expire":
      return `  ${tag(table, e.slotIndex)} 的${e.kind === "buff" ? "增益" : "中毒"}状态结束`;
    case "death":
      return `  ☠ ${tag(table, e.slotIndex)} 倒下`;
    case "battle_end": {
      const outcome = e.winner === "draw" ? "平局" : `${e.winner} 队获胜`;
      const why = e.reason === "wipe" ? "全灭对手" : "超时按血量裁决";
      return `\n=== 战斗结束:${outcome}(${why},共 ${e.turns} 次行动)===`;
    }
  }
}

/**
 * 把一场战斗结果渲染成人能读的中文战报(逐行)。
 * @param result runBattle 的输出
 * @param teams  原始队伍输入(用于 slot→名字映射;事件流只带 slotIndex)
 */
export function formatBattleReport(result: BattleResult, teams: readonly TeamInput[]): string[] {
  const table = buildSlotTable(teams);
  const lines: string[] = [];

  lines.push("=== 开战 ===");
  for (const t of teams) {
    const roster = t.units
      .map((u) => `${u.name}(HP ${u.maxHp}/攻 ${u.atk}/速 ${u.speed})`)
      .join("、");
    lines.push(`${t.team} 队:${roster}`);
  }

  for (const e of result.events) {
    lines.push(formatEvent(e, table));
  }

  lines.push("");
  lines.push("终局状态:");
  for (const u of result.finalUnits) {
    const status = u.alive ? `存活 HP ${u.hp}` : "阵亡";
    lines.push(`  ${tag(table, u.slotIndex)}:${status}`);
  }

  return lines;
}
