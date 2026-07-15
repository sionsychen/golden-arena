import { applyEffect, recomputeStats } from "./effects.js";
import { pickBy } from "./tiebreak.js";
import type { BattleEvent, BattleResult, Skill, TeamId, Unit, UnitSnapshot } from "./types.js";

/** AV 跑道长度(决定4)。AV = BIG / speed,全整数,禁浮点。 */
export const BIG = 10000;

/**
 * 终止兜底上限(决定4):累计推进 AV 超此值 → 按总血量% 裁决,防"两奶妈互推永不结束"。
 * 取值远高于正常战斗(正常靠 wipe 结束),仅作死循环护栏。
 */
export const AV_CAP = 1_000_000;

function aliveOf(units: readonly Unit[], team: TeamId): Unit[] {
  return units.filter((u) => u.team === team && u.hp > 0);
}

/** 超时裁决(决定4):比"剩余血量占比",整数交叉相乘避免浮点。相等为平。 */
function judgeByHp(units: readonly Unit[]): TeamId | "draw" {
  let hpA = 0;
  let maxA = 0;
  let hpB = 0;
  let maxB = 0;
  for (const u of units) {
    if (u.team === "A") {
      hpA += u.hp;
      maxA += u.maxHp;
    } else {
      hpB += u.hp;
      maxB += u.maxHp;
    }
  }
  const lhs = hpA * maxB;
  const rhs = hpB * maxA;
  if (lhs > rhs) return "A";
  if (lhs < rhs) return "B";
  return "draw";
}

/**
 * 承受方轮到时、行动之前的状态结算(决定9):
 * 每条 status 先结算 dot 伤害,再 duration-1,归零则移除。duration:2 = 恰好 2 次自己的回合。
 */
function settleStatuses(actor: Unit, emit: (e: BattleEvent) => void): void {
  const kept: typeof actor.statuses = [];
  for (const s of actor.statuses) {
    if (s.kind === "dot" && actor.hp > 0) {
      const dmg = Math.max(0, s.dotPower ?? 0);
      actor.hp = Math.max(0, actor.hp - dmg);
      emit({ type: "dot_tick", slotIndex: actor.slotIndex, amount: dmg, hpAfter: actor.hp });
      if (actor.hp <= 0) {
        emit({ type: "death", slotIndex: actor.slotIndex, name: actor.name });
      }
    }
    s.duration -= 1;
    if (s.duration <= 0) {
      emit({ type: "status_expire", slotIndex: actor.slotIndex, kind: s.kind });
    } else {
      kept.push(s);
    }
  }
  actor.statuses = kept;
  recomputeStats(actor);
}

/**
 * 决定论 sim 核心(决定1/4/5/11):纯函数,全整数,禁 Math.random/Date.now/IO。
 * 事件跳跃推进——取全场 min AV 一次性推进,跳过无事 tick。
 *
 * @param units       已装配好的运行时单位(index.ts 负责从 UnitDef 组装,含 slotIndex)
 * @param skillsById  技能查表
 * @returns 结果 + 结构化事件流
 */
export function runBattle(units: Unit[], skillsById: ReadonlyMap<string, Skill>): BattleResult {
  const events: BattleEvent[] = [];
  const emit = (e: BattleEvent): void => {
    events.push(e);
  };

  for (const u of units) {
    u.av = Math.floor(BIG / u.speed);
  }

  let totalAv = 0;
  let turns = 0;
  let winner: TeamId | "draw" = "draw";
  let reason: "wipe" | "timeout" = "wipe";

  while (true) {
    if (aliveOf(units, "A").length === 0 || aliveOf(units, "B").length === 0) {
      const aAlive = aliveOf(units, "A").length > 0;
      const bAlive = aliveOf(units, "B").length > 0;
      winner = aAlive ? "A" : bAlive ? "B" : "draw";
      reason = "wipe";
      break;
    }

    const liveUnits = units.filter((u) => u.hp > 0);
    // 取全场 min AV 者行动;平局收敛到 slotIndex(与 targeting 同一把尺子)。
    const actor = pickBy(liveUnits, (u) => u.av);
    if (actor === undefined) break;

    const minAv = actor.av;
    for (const u of liveUnits) u.av -= minAv;
    totalAv += minAv;
    turns += 1;

    if (totalAv > AV_CAP) {
      winner = judgeByHp(units);
      reason = "timeout";
      break;
    }

    settleStatuses(actor, emit);
    actor.av = Math.floor(BIG / actor.speed);

    if (actor.hp <= 0) continue; // 被 dot 结算致死,不再行动

    emit({ type: "act", slotIndex: actor.slotIndex, name: actor.name, av: actor.av });

    const skill = skillsById.get(actor.skillId);
    if (skill === undefined) {
      throw new Error(`unknown skillId '${actor.skillId}' for unit '${actor.defId}'`);
    }
    const allies = units.filter((u) => u.team === actor.team);
    const enemies = units.filter((u) => u.team !== actor.team);
    for (const eff of skill.effects) {
      applyEffect(eff, actor, allies, enemies, emit);
    }
  }

  emit({ type: "battle_end", winner, reason, turns });

  const finalUnits: UnitSnapshot[] = units.map((u) => ({
    slotIndex: u.slotIndex,
    defId: u.defId,
    team: u.team,
    hp: u.hp,
    atk: u.atk,
    speed: u.speed,
    alive: u.hp > 0,
  }));

  return { winner, reason, turns, events, finalUnits };
}
