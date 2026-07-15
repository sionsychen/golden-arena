// 文本战报 CLI(决定11 投影层的最轻形态)。薄壳:只负责 IO,战报格式化在 src/report.ts(纯函数)。
// 跑法:npm run battle

import { skills } from "../src/data/skills.js";
import { unitsA, unitsB } from "../src/data/units.js";
import { runBattle, type TeamInput } from "../src/index.js";
import { formatBattleReport } from "../src/report.js";

const teams: TeamInput[] = [
  { team: "A", units: unitsA },
  { team: "B", units: unitsB },
];

const result = runBattle(teams, skills, 12345);

for (const line of formatBattleReport(result, teams)) {
  console.log(line);
}
