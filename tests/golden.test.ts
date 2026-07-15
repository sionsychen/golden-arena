import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { skills } from "../src/data/skills.js";
import { unitsA, unitsB } from "../src/data/units.js";
import { digest } from "../src/digest.js";
import { runBattle } from "../src/index.js";
import type { BattleResult } from "../src/types.js";

// Golden-trace parity gate(决定12 + 地基笔记第三层)。
// 任何改变 sim 行为的 PR 都会让这个 test 变红,by design。
// 铁律:红了先假设代码错,改代码别改 harness。重生只能用显式 UPDATE_GOLDEN=1、单独 commit。

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, "golden", "base.json");
const FIXED_SEED = 12345;

/**
 * 排除法采样(地基笔记第三层第1点):dump"除排除列表外的每个字段"。
 * 新加 gameplay 字段默认被 pin——忘了测,golden 自动变红逼你处理。
 * 排除列表只放表现层/派生值,每条带理由。排除列表本身也 pin 进快照(防偷塞字段掩盖漂移)。
 */
const EXCLUDED_EVENT_FIELDS: readonly string[] = [
  // 目前无排除项:所有事件字段都是 gameplay 真值,全部 pin。
  // 将来加"表现层"字段(如动画时长)才往这里放,并写明理由。
];

const EXCLUDED_UNIT_FIELDS: readonly string[] = [
  // 目前无排除项。
];

interface GoldenFile {
  readonly seed: number;
  readonly winner: string;
  readonly reason: string;
  readonly turns: number;
  readonly excludedEventFields: readonly string[];
  readonly excludedUnitFields: readonly string[];
  readonly eventDigest: string;
  readonly stateDigest: string;
  readonly events: readonly Record<string, unknown>[];
  readonly finalUnits: readonly Record<string, unknown>[];
}

function omit(obj: Record<string, unknown>, excluded: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    if (!excluded.includes(k)) out[k] = obj[k];
  }
  return out;
}

function sample(result: BattleResult): GoldenFile {
  const events = result.events.map((e) =>
    omit(e as unknown as Record<string, unknown>, EXCLUDED_EVENT_FIELDS),
  );
  const finalUnits = result.finalUnits.map((u) =>
    omit(u as unknown as Record<string, unknown>, EXCLUDED_UNIT_FIELDS),
  );
  return {
    seed: FIXED_SEED,
    winner: result.winner,
    reason: result.reason,
    turns: result.turns,
    excludedEventFields: [...EXCLUDED_EVENT_FIELDS],
    excludedUnitFields: [...EXCLUDED_UNIT_FIELDS],
    eventDigest: digest(events),
    stateDigest: digest(finalUnits),
    events,
    finalUnits,
  };
}

function runFixedBattle(): BattleResult {
  return runBattle(
    [
      { team: "A", units: unitsA },
      { team: "B", units: unitsB },
    ],
    skills,
    FIXED_SEED,
  );
}

describe("golden: 固定战斗的 trace 指纹", () => {
  const current = sample(runFixedBattle());

  if (process.env.UPDATE_GOLDEN === "1") {
    mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    it("golden 已重生(UPDATE_GOLDEN=1)", () => {
      expect(existsSync(GOLDEN_PATH)).toBe(true);
    });
  } else {
    it("golden 文件存在(不存在先跑 npm run golden:update)", () => {
      expect(existsSync(GOLDEN_PATH)).toBe(true);
    });

    const golden: GoldenFile = existsSync(GOLDEN_PATH)
      ? (JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenFile)
      : ({} as GoldenFile);

    it("事件流 digest 不漂移(值+顺序)", () => {
      expect(current.eventDigest).toBe(golden.eventDigest);
    });

    it("终局状态 digest 不漂移", () => {
      expect(current.stateDigest).toBe(golden.stateDigest);
    });

    it("排除列表被 pin(防偷塞字段掩盖漂移)", () => {
      expect(current.excludedEventFields).toEqual(golden.excludedEventFields);
      expect(current.excludedUnitFields).toEqual(golden.excludedUnitFields);
    });

    it("完整 trace 逐字段一致(新字段默认被 pin)", () => {
      expect(current.events).toEqual(golden.events);
      expect(current.finalUnits).toEqual(golden.finalUnits);
      expect(current.winner).toBe(golden.winner);
      expect(current.reason).toBe(golden.reason);
      expect(current.turns).toBe(golden.turns);
    });
  }
});
