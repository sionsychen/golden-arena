import { describe, expect, it } from "vitest";
import { resolveTargets } from "../src/targeting.js";
import { compareBy, pickBy, pickFront } from "../src/tiebreak.js";
import type { TeamId, Unit } from "../src/types.js";

// 命门专项(决定4/7):所有平局一律收敛到 slotIndex,绝不靠遍历顺序。
// 每个断言都故意制造平局,验证 slotIndex 是唯一裁决者。

function mkUnit(slotIndex: number, over: Partial<Unit> & { team?: TeamId }): Unit {
  return {
    slotIndex,
    defId: `u${slotIndex}`,
    name: `u${slotIndex}`,
    team: over.team ?? "A",
    maxHp: 100,
    hp: over.hp ?? 100,
    baseAtk: over.atk ?? 10,
    baseSpeed: over.speed ?? 100,
    atk: over.atk ?? 10,
    speed: over.speed ?? 100,
    av: over.av ?? 0,
    skillId: "x",
    statuses: [],
  };
}

describe("tiebreak: slotIndex 是唯一破平键", () => {
  it("pickBy 平局取 slotIndex 最小者", () => {
    // 三个 hp 全等,期望取 slotIndex 最小(=2),与数组顺序无关
    const units = [mkUnit(5, { hp: 20 }), mkUnit(2, { hp: 20 }), mkUnit(8, { hp: 20 })];
    expect(pickBy(units, (u) => u.hp)?.slotIndex).toBe(2);
  });

  it("pickBy 数组乱序不影响结果", () => {
    const a = [mkUnit(9, { hp: 30 }), mkUnit(3, { hp: 30 }), mkUnit(7, { hp: 30 })];
    const b = [mkUnit(3, { hp: 30 }), mkUnit(7, { hp: 30 }), mkUnit(9, { hp: 30 })];
    expect(pickBy(a, (u) => u.hp)?.slotIndex).toBe(pickBy(b, (u) => u.hp)?.slotIndex);
  });

  it("compareBy 主键相等回落 slotIndex 升序", () => {
    const lo = mkUnit(1, { hp: 50 });
    const hi = mkUnit(4, { hp: 50 });
    expect(compareBy(lo, hi, (u) => u.hp)).toBeLessThan(0);
    expect(compareBy(hi, lo, (u) => u.hp)).toBeGreaterThan(0);
  });

  it("pickFront = 存活最小 slotIndex", () => {
    const units = [mkUnit(6, {}), mkUnit(2, {}), mkUnit(4, {})];
    expect(pickFront(units)?.slotIndex).toBe(2);
  });

  it("空候选返回 undefined", () => {
    expect(pickBy([], (u) => u.hp)).toBeUndefined();
    expect(pickFront([])).toBeUndefined();
  });
});

describe("targeting: 平局与存活过滤", () => {
  const caster = mkUnit(0, { team: "A" });

  it("lowest_hp 平局取 slotIndex 最小的敌人", () => {
    const enemies = [mkUnit(3, { team: "B", hp: 15 }), mkUnit(1, { team: "B", hp: 15 })];
    const t = resolveTargets("lowest_hp", caster, [caster], enemies);
    expect(t.map((u) => u.slotIndex)).toEqual([1]);
  });

  it("highest_atk 平局取 slotIndex 最小的敌人", () => {
    const enemies = [mkUnit(5, { team: "B", atk: 20 }), mkUnit(2, { team: "B", atk: 20 })];
    const t = resolveTargets("highest_atk", caster, [caster], enemies);
    expect(t.map((u) => u.slotIndex)).toEqual([2]);
  });

  it("front 取存活最小 slotIndex,跳过已死", () => {
    const enemies = [mkUnit(1, { team: "B", hp: 0 }), mkUnit(3, { team: "B", hp: 10 })];
    const t = resolveTargets("front", caster, [caster], enemies);
    expect(t.map((u) => u.slotIndex)).toEqual([3]);
  });

  it("all 只返回存活敌人", () => {
    const enemies = [mkUnit(1, { team: "B", hp: 0 }), mkUnit(2, { team: "B", hp: 10 })];
    const t = resolveTargets("all", caster, [caster], enemies);
    expect(t.map((u) => u.slotIndex)).toEqual([2]);
  });

  it("self 返回施法者", () => {
    const t = resolveTargets("self", caster, [caster], []);
    expect(t.map((u) => u.slotIndex)).toEqual([0]);
  });

  it("lowest_hp_ally 在己方里选,平局取 slotIndex 最小", () => {
    // caster hp=100,两个 ally hp=12 平局 → 最低是 ally,平局取 slotIndex 最小(=2)
    const ally1 = mkUnit(2, { team: "A", hp: 12 });
    const ally2 = mkUnit(4, { team: "A", hp: 12 });
    const t = resolveTargets("lowest_hp_ally", caster, [caster, ally1, ally2], []);
    expect(t.map((u) => u.slotIndex)).toEqual([2]);
  });
});
