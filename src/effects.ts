import { resolveTargets } from "./targeting.js";
import type { BattleEvent, Effect, Unit } from "./types.js";

/** 事件汇聚口(engine 提供)。sim 层不做 IO,只 emit 结构化事件(决定11)。 */
export type Emit = (e: BattleEvent) => void;

/**
 * 从 base 值 + 当前 statuses 重算 atk/speed。
 * 用"从 base 重算"而非"增量加减",避免二次适用/漂移(决定论)。
 */
export function recomputeStats(u: Unit): void {
  let atk = u.baseAtk;
  let speed = u.baseSpeed;
  for (const s of u.statuses) {
    if (s.kind === "buff" && s.stat === "atk") atk += s.amount ?? 0;
    if (s.kind === "buff" && s.stat === "speed") speed += s.amount ?? 0;
  }
  u.atk = atk;
  u.speed = speed;
}

/** 施加一次伤害并 emit;致死则 emit death。整数运算。 */
function applyDamage(target: Unit, amount: number, srcSlot: number, emit: Emit): void {
  if (target.hp <= 0) return;
  const dealt = Math.max(0, amount);
  target.hp -= dealt;
  emit({
    type: "damage",
    srcSlot,
    tgtSlot: target.slotIndex,
    amount: dealt,
    hpAfter: target.hp,
  });
  if (target.hp <= 0) {
    target.hp = 0;
    emit({ type: "death", slotIndex: target.slotIndex, name: target.name });
  }
}

/**
 * 效果解释器(决定8):switch on type,绝无代码 escape hatch。
 * 表达不出的新机制 = "加原语 + 写 ADR"的信号,不在这里破例塞任意函数。
 */
export function applyEffect(
  effect: Effect,
  caster: Unit,
  allies: readonly Unit[],
  enemies: readonly Unit[],
  emit: Emit,
): void {
  const targets = resolveTargets(effect.target, caster, allies, enemies);
  switch (effect.type) {
    case "damage": {
      // atk 参与伤害,否则 atk buff 无意义;power 是技能固有加成。全整数。
      const amount = effect.power + caster.atk;
      for (const t of targets) applyDamage(t, amount, caster.slotIndex, emit);
      return;
    }
    case "buff": {
      for (const t of targets) {
        t.statuses.push({
          kind: "buff",
          stat: effect.stat,
          amount: effect.amount,
          duration: effect.duration,
        });
        recomputeStats(t);
        emit({
          type: "buff_apply",
          srcSlot: caster.slotIndex,
          tgtSlot: t.slotIndex,
          stat: effect.stat,
          amount: effect.amount,
          duration: effect.duration,
        });
      }
      return;
    }
    case "dot": {
      for (const t of targets) {
        t.statuses.push({ kind: "dot", dotPower: effect.power, duration: effect.duration });
        emit({
          type: "dot_apply",
          srcSlot: caster.slotIndex,
          tgtSlot: t.slotIndex,
          power: effect.power,
          duration: effect.duration,
        });
      }
      return;
    }
  }
}
