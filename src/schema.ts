import { z } from "zod";
import type { Skill, UnitDef } from "./types.js";

// Zod schema = 声明式数据的"事实标准"(决定8/13)。不跑战斗就能抓数据错。
// 与 types.ts 保持一致:target 用枚举,effect 用判别联合。

export const targetKindSchema = z.enum([
  "front",
  "lowest_hp",
  "highest_atk",
  "all",
  "self",
  "lowest_hp_ally",
]);

export const statKindSchema = z.enum(["atk", "speed"]);

export const effectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("damage"),
    power: z.int().nonnegative(),
    target: targetKindSchema,
  }),
  z.object({
    type: z.literal("buff"),
    stat: statKindSchema,
    amount: z.int(),
    duration: z.int().positive(),
    target: targetKindSchema,
  }),
  z.object({
    type: z.literal("dot"),
    power: z.int().nonnegative(),
    duration: z.int().positive(),
    target: targetKindSchema,
  }),
]);

export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  effects: z.array(effectSchema).min(1),
});

export const unitDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxHp: z.int().positive(),
  atk: z.int().nonnegative(),
  speed: z.int().positive(), // speed 必须 >0:AV = BIG/speed,零会除零(决定4)
  skillId: z.string().min(1),
});

/** 悬空引用/重复 id 检查(schema 之外的跨记录约束)。返回错误消息列表,空=通过。 */
export function checkReferentialIntegrity(
  units: readonly UnitDef[],
  skills: readonly Skill[],
): string[] {
  const errors: string[] = [];
  const skillIds = new Set(skills.map((s) => s.id));

  const seenSkill = new Set<string>();
  for (const s of skills) {
    if (seenSkill.has(s.id)) errors.push(`duplicate skill id '${s.id}'`);
    seenSkill.add(s.id);
  }

  const seenUnit = new Set<string>();
  for (const u of units) {
    if (seenUnit.has(u.id)) errors.push(`duplicate unit id '${u.id}'`);
    seenUnit.add(u.id);
    // 悬空引用:每个 UnitDef.skillId 必须存在于 skills(决定13 点名的红利)
    if (!skillIds.has(u.skillId)) {
      errors.push(`unit '${u.id}' references unknown skillId '${u.skillId}'`);
    }
  }
  return errors;
}
