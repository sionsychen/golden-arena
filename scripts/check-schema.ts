// verify 的 schema 步(决定13):不跑战斗就抓数据错——最便宜的一层网。
// 独立可跑:tsx scripts/check-schema.ts;失败非零退出,让 agent 靠 exit code 判成败。

import { skills } from "../src/data/skills.js";
import { allUnitDefs } from "../src/data/units.js";
import { checkReferentialIntegrity, skillSchema, unitDefSchema } from "../src/schema.js";

function main(): void {
  const errors: string[] = [];

  for (const s of skills) {
    const r = skillSchema.safeParse(s);
    if (!r.success) {
      errors.push(`skill '${s.id ?? "?"}': ${r.error.issues.map((i) => i.message).join("; ")}`);
    }
  }

  for (const u of allUnitDefs) {
    const r = unitDefSchema.safeParse(u);
    if (!r.success) {
      errors.push(`unit '${u.id ?? "?"}': ${r.error.issues.map((i) => i.message).join("; ")}`);
    }
  }

  errors.push(...checkReferentialIntegrity(allUnitDefs, skills));

  if (errors.length > 0) {
    console.error("schema check FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`schema check OK: ${skills.length} skills, ${allUnitDefs.length} units`);
}

main();
