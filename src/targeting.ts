import { pickBy, pickFront } from "./tiebreak.js";
import type { TargetKind, Unit } from "./types.js";

/** 存活过滤(targeting 只作用于存活单位)。 */
function alive(units: readonly Unit[]): Unit[] {
  return units.filter((u) => u.hp > 0);
}

/**
 * 声明式 targeting 解析(决定7)。
 * 所有"选一个/排序"的平局一律经 tiebreak.ts,收敛到 slotIndex。
 *
 * @param kind    技能数据里的 target 字段
 * @param caster  施法者
 * @param allies  施法者同队全体(含自己,含已死)
 * @param enemies 敌队全体(含已死)
 * @returns 命中的存活单位列表(可能为空)
 */
export function resolveTargets(
  kind: TargetKind,
  caster: Unit,
  allies: readonly Unit[],
  enemies: readonly Unit[],
): Unit[] {
  const liveEnemies = alive(enemies);
  const liveAllies = alive(allies);

  switch (kind) {
    case "front": {
      const t = pickFront(liveEnemies);
      return t ? [t] : [];
    }
    case "lowest_hp": {
      const t = pickBy(liveEnemies, (u) => u.hp);
      return t ? [t] : [];
    }
    case "highest_atk": {
      const t = pickBy(liveEnemies, (u) => -u.atk);
      return t ? [t] : [];
    }
    case "all":
      return liveEnemies;
    case "self":
      return caster.hp > 0 ? [caster] : [];
    case "lowest_hp_ally": {
      const t = pickBy(liveAllies, (u) => u.hp);
      return t ? [t] : [];
    }
  }
}
