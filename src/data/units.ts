import type { UnitDef } from "../types.js";

// 声明式单位数据。2v2:让 front≠lowest_hp 可区分,targeting 原语得到真实 coverage。
// 4 体各用一个不同技能,cleave/snipe/venom/warcry 全部上场,golden 覆盖全部原语。
export const unitsA: readonly UnitDef[] = [
  { id: "a_tank", name: "铁卫", maxHp: 60, atk: 6, speed: 90, skillId: "cleave" },
  { id: "a_ranger", name: "游侠", maxHp: 34, atk: 7, speed: 130, skillId: "snipe" },
];

export const unitsB: readonly UnitDef[] = [
  { id: "b_venom", name: "毒手", maxHp: 44, atk: 5, speed: 115, skillId: "venom" },
  { id: "b_captain", name: "队长", maxHp: 48, atk: 6, speed: 100, skillId: "warcry" },
];

export const allUnitDefs: readonly UnitDef[] = [...unitsA, ...unitsB];
