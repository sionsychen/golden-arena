import { runBattle as runEngine } from "./engine.js";
import type { BattleResult, Skill, TeamId, Unit, UnitDef } from "./types.js";

/** 一队 = 有序的 UnitDef 列表(顺序决定 slotIndex 分配基准)。 */
export interface TeamInput {
  readonly team: TeamId;
  readonly units: readonly UnitDef[];
}

/**
 * 从 UnitDef 装配运行时 Unit,分配全局稳定 slotIndex(决定4/7 的破平单一信源)。
 * slotIndex 按 [A 队顺序, 然后 B 队顺序] 全局递增——同一份输入永远得到同一套 slotIndex。
 */
function assemble(teams: readonly TeamInput[]): Unit[] {
  const units: Unit[] = [];
  let slot = 0;
  for (const t of teams) {
    for (const def of t.units) {
      units.push({
        slotIndex: slot++,
        defId: def.id,
        name: def.name,
        team: t.team,
        maxHp: def.maxHp,
        hp: def.maxHp,
        baseAtk: def.atk,
        baseSpeed: def.speed,
        atk: def.atk,
        speed: def.speed,
        av: 0,
        skillId: def.skillId,
        statuses: [],
      });
    }
  }
  return units;
}

/**
 * sim 一等入口(决定1):纯函数 (初始队伍, 种子) → 结果+事件流。
 * slice1 无 RNG(决定10):seed 收下但不消费,预留 PRNG seam;RNG 是 slice2 专项教学关卡。
 */
export function runBattle(
  teams: readonly TeamInput[],
  skills: readonly Skill[],
  _seed: number,
): BattleResult {
  const skillsById = new Map<string, Skill>(skills.map((s) => [s.id, s]));
  const units = assemble(teams);
  return runEngine(units, skillsById);
}

export type { BattleResult, TeamId } from "./types.js";
