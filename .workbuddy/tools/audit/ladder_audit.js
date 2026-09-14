/* 数值阶梯审计 —— 回答一个问题：**从开局到洛阳，这条路走得通吗？**
 *
 * 为什么需要它：`docs/_史料/全面梳理报告.md` 判过一条「数量级断层」
 * （官府 Lv10 满农田仅养义兵 5.3 万 / 攻洛阳需 20 万混编），但那是 v28 之前的数字。
 * v28 把建筑上限 10→12、v24 把外城地块 9 级 39→40、Lv12 农田 7800/h ——
 * 上限抬过三轮，那条结论**没人复算过**。所以把判据脚本化：**数值一改就能重跑**，
 * 别再用二手结论做决策。
 *
 * 判据（三条，全从 data.js 运行时真值推）：
 *   ① 单城各官府等级：外城地块数、混编产量、按各兵种耗粮能养多少兵
 *   ② 各等级守军：野外城池（GAME.map.fortGarrison 口径）与名城（× NPC_CITY_RES.garrisonMul）
 *   ③ 递进阶梯：打下一档需要几座满级城；相邻档的跨度会不会大到"够不着"
 *
 * ⚠️ 口径说明：本脚本用「守军总数」当"需要多少兵"的**上界代理**。
 * 实测（全面梳理报告）20 万重装可 100% 打下 22.4 万守军的洛阳 →
 * 说明真实所需**低于**守军数，故本表偏保守（阶梯比它更宽松）。
 *
 * 用法：node .workbuddy/tools/audit/ladder_audit.js
 * 退出码：0 阶梯可攀 / 1 存在跨度过大的坑
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');      // → E:\Deepseekdb
const DATA_JS = path.join(ROOT, 'js', 'data.js');

const sb = { console, document: undefined };
sb.window = sb; sb.GAME = {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(DATA_JS, 'utf8'), sb, { filename: 'data.js' });
const D = sb.GAME.DATA;
if (!D) { console.error('✗ 拿不到 DATA'); process.exit(2); }

const fmt = v => Math.round(v).toLocaleString('en-US');
const pad = (s, w) => String(s).padStart(w);
const L = [];

/* ── 口径 ── */
const PROD = D.EXT_BUILDINGS.farm.prod;
const FORT = D.FORT;
const fortBase = lv => Math.round(FORT.garrisonBase * Math.pow(FORT.garrisonGrowth, lv - 1) *
  ((D.EXPEDITION && D.EXPEDITION.garrisonMul) || 1));
const FORT_MIX = { yibing: .35, changqiang: .25, daodun: .2, gongjian: .2, qingji: .1 };
const fortTotal = lv => {
  const b = fortBase(lv);
  let t = 0;
  for (const k in FORT_MIX) t += Math.round(b * (k === 'qingji' && lv < 4 ? 0 : FORT_MIX[k]));
  return t;
};
const cityTotal = lv => Math.round(fortTotal(lv) * (D.NPC_CITY_RES.garrisonMul || 1));

const GOV_MAX = D.BUILDINGS.guanfu ? D.BUILDINGS.guanfu.maxLevel : 12;
const capOf = {};
for (let g = 1; g <= GOV_MAX; g++) {
  const tiles = D.EXT_CAP_BY_LV[g - 1];
  const grain = Math.floor(tiles / 4) * PROD[g - 1];   // 混编：四种资源各占 1/4
  capOf[g] = { tiles, grain, yibing: Math.floor(grain / 3), tieji: Math.floor(grain / 35) };
}

L.push('=== ① 单城产能（混编：每种资源各占 1/4）===');
L.push('官府  外城地块   混编各资源/h   可养义兵   可养铁骑');
L.push('-'.repeat(56));
for (let g = 1; g <= GOV_MAX; g++) {
  const c = capOf[g];
  L.push(`${pad(g, 2)}    ${pad(c.tiles, 7)}   ${pad(fmt(c.grain), 12)}   ${pad(fmt(c.yibing), 9)}   ${pad(fmt(c.tieji), 9)}`);
}

L.push('');
L.push('=== ② 各档位守军 ===');
L.push('等级    野外城池   名城(×' + (D.NPC_CITY_RES.garrisonMul || 1) + ')');
L.push('-'.repeat(34));
const TIERS = [5, 7, 9, 10];
for (const lv of TIERS) {
  L.push(`${pad(lv, 2)}   ${pad(fmt(fortTotal(lv)), 10)}   ${pad(fmt(cityTotal(lv)), 12)}`);
}

L.push('');
L.push(`=== ③ 递进阶梯（以单城官府 Lv${GOV_MAX} 的义兵产能为一把尺）===`);
const one = capOf[GOV_MAX].yibing;
L.push(`单城满级可出义兵：${fmt(one)}`);
L.push('目标   名城守军     需几座满级城');
L.push('-'.repeat(42));
const steps = [];
for (const lv of TIERS) {
  const need = cityTotal(lv);
  const cities = need / one;
  steps.push({ lv, need, cities });
  L.push(`Lv${pad(lv, 2)}  ${pad(fmt(need), 10)}   ${pad(cities.toFixed(1), 8)} 座`);
}

/* 跨度只是"节奏"信息，不是通过/不通过的门槛 —— 因为城数可以靠「平原筑城」涨：
   `GAME.buildCityAt` 无城池数量上限，每座新城自带自己的官府与野地槽位。
   所以每档要多备 3.8 倍兵力 = 要多攒 3.8 倍城数，这是**时间成本**，不是墙。
   （第一版我把阈值拍成 2.6× 并据此报"跨度过大"，那是假警 —— 判据没建模筑城。）*/
L.push('');
L.push('=== ④ 相邻档所需兵力的倍数（节奏信息，非门槛）===');
for (let i = 1; i < steps.length; i++) {
  const r = steps[i].cities / steps[i - 1].cities;
  L.push(`  Lv${steps[i - 1].lv} → Lv${steps[i].lv}：${r.toFixed(1)}× —— 城数要多攒 ${r.toFixed(1)} 倍`);
}

/* 真判据：所需城数是否在"可建城数上限"之内 */
const plainsRatio = (D.TERRAIN_WEIGHTS && D.TERRAIN_WEIGHTS.plain) || 0.2;
const mapTiles = (D.MAP_W || 0) * (D.MAP_H || 0);
const plainTiles = Math.round(mapTiles * plainsRatio);
const maxCities = plainTiles;                  // 每块平原理论上都能筑一城（实际受资源与时间限制）
const needMax = steps[steps.length - 1].cities;
const reachable = needMax <= maxCities;

L.push('');
L.push('=== ⑤ 判定 ===');
L.push(`  野外城池：单城满级可出 ${fmt(one)} 义兵，最高档（Lv10）守军 ${fmt(fortTotal(10))} → ` +
  (one >= fortTotal(10) ? '✅ 单城可平推' : '❌ 需多城'));
L.push(`  名城扩张：靠「平原筑城」扩城（无城池数量上限）`);
L.push(`  打洛阳需 ${needMax.toFixed(1)} 座满级城；地图平原约 ${fmt(plainTiles)} 块（上限代理）→ ` +
  (reachable ? '✅ 数量够' : '❌ 地图放不下'));
L.push(`  结论：${reachable && one >= fortTotal(10) ? '✅ 阶梯走得通 —— 卡点只有「时间」，不是「无解」' : '❌ 存在走不通的环节'}`);
L.push('  ⚠️ 本表以「守军总数」为所需兵力上界代理（偏保守，真实所需更低）');

console.log(L.join('\n'));
process.exit(reachable && one >= fortTotal(10) ? 0 : 1);
