import type { Unit } from "./types.js";

/**
 * 【命门】整个代码库"平局怎么破"只有一个答案:收敛到 slotIndex(决定4/7)。
 * 绝不靠数组遍历顺序破平——那会让重构/迭代顺序变动分叉世界。
 *
 * 所有"选一个/排序"操作都必须经过这里,不得在别处另写比较逻辑。
 * 配套 pinned test:tests/tiebreak.test.ts。
 */

/** 稳定升序比较:先比 primary,平局用 slotIndex(升序)兜底。返回 <0 表示 a 优先。 */
export function compareBy(a: Unit, b: Unit, primary: (u: Unit) => number): number {
  const pa = primary(a);
  const pb = primary(b);
  if (pa !== pb) return pa - pb;
  return a.slotIndex - b.slotIndex;
}

/** 从候选中取"primary 最小者",平局取 slotIndex 最小者。空数组返回 undefined。 */
export function pickBy(
  candidates: readonly Unit[],
  primary: (u: Unit) => number,
): Unit | undefined {
  let best: Unit | undefined;
  for (const u of candidates) {
    if (best === undefined || compareBy(u, best, primary) < 0) {
      best = u;
    }
  }
  return best;
}

/** 存活单位中 slotIndex 最小者(front 的定义)。 */
export function pickFront(candidates: readonly Unit[]): Unit | undefined {
  return pickBy(candidates, (u) => u.slotIndex);
}
