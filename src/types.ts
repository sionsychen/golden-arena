// 全局类型单一信源。sim 层全整数,禁浮点。

/** targeting 声明式枚举(决定7)。所有"选一个/排序"的平局一律收敛到 slotIndex。 */
export type TargetKind = "front" | "lowest_hp" | "highest_atk" | "all" | "self" | "lowest_hp_ally";

/** 可被 buff 影响的数值维度。 */
export type StatKind = "atk" | "speed";

/**
 * 效果原语(决定8)。判别联合,由 effects.ts 的解释器消费。
 * 绝无代码 escape hatch——表达不出的新机制 = "加原语 + 写 ADR"的信号。
 */
export type Effect =
  | { type: "damage"; power: number; target: TargetKind }
  | { type: "buff"; stat: StatKind; amount: number; duration: number; target: TargetKind }
  | { type: "dot"; power: number; duration: number; target: TargetKind };

/** 技能定义(声明式数据)。单技能起步(决定6):轮到即无脑放。 */
export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly effects: readonly Effect[];
}

/** 单位定义(声明式数据)。deps: skillId 必须存在于 skills(schema 校验悬空引用)。 */
export interface UnitDef {
  readonly id: string;
  readonly name: string;
  readonly maxHp: number;
  readonly atk: number;
  readonly speed: number;
  readonly skillId: string;
}

/** 队伍标识。 */
export type TeamId = "A" | "B";

/** 运行时挂在单位上的状态(buff/debuff/dot),时长按承受方自己的行动次数结算(决定9)。 */
export interface StatusEffect {
  readonly kind: "buff" | "dot";
  readonly stat?: StatKind;
  readonly amount?: number;
  readonly dotPower?: number;
  duration: number;
}

/**
 * 运行时单位。slotIndex 是全局稳定破平键(决定4/7)的唯一来源。
 * hp/atk/speed 是当前有效值(含 buff);baseAtk/baseSpeed 保留原值供 buff 叠加基准。
 */
export interface Unit {
  readonly slotIndex: number;
  readonly defId: string;
  readonly name: string;
  readonly team: TeamId;
  readonly maxHp: number;
  hp: number;
  readonly baseAtk: number;
  readonly baseSpeed: number;
  atk: number;
  speed: number;
  /** 距下次行动的剩余行动值(AV),整数。取全场最小者行动。 */
  av: number;
  readonly skillId: string;
  statuses: StatusEffect[];
}

/**
 * 结构化事件(决定11)。必须是对象不是拼好的字符串,才能被 digest/校验/i18n/多投影层消费。
 * 事件流 = 将来文本战报 / three.js 渲染的数据源。
 */
export type BattleEvent =
  | { type: "act"; slotIndex: number; name: string; av: number }
  | { type: "damage"; srcSlot: number; tgtSlot: number; amount: number; hpAfter: number }
  | { type: "dot_tick"; slotIndex: number; amount: number; hpAfter: number }
  | {
      type: "buff_apply";
      srcSlot: number;
      tgtSlot: number;
      stat: StatKind;
      amount: number;
      duration: number;
    }
  | { type: "dot_apply"; srcSlot: number; tgtSlot: number; power: number; duration: number }
  | { type: "status_expire"; slotIndex: number; kind: "buff" | "dot" }
  | { type: "death"; slotIndex: number; name: string }
  | { type: "battle_end"; winner: TeamId | "draw"; reason: "wipe" | "timeout"; turns: number };

/** 单位终局快照(golden 状态采样的原子)。 */
export interface UnitSnapshot {
  readonly slotIndex: number;
  readonly defId: string;
  readonly team: TeamId;
  readonly hp: number;
  readonly atk: number;
  readonly speed: number;
  readonly alive: boolean;
}

/** sim 一等输出(决定11):结果 + 结构化事件流。 */
export interface BattleResult {
  readonly winner: TeamId | "draw";
  readonly reason: "wipe" | "timeout";
  readonly turns: number;
  readonly events: readonly BattleEvent[];
  readonly finalUnits: readonly UnitSnapshot[];
}
