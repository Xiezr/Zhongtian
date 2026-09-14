/* 经济审计：金币收入构成（v68 · 老板「审计一下」）
 *
 * 目的：为「限制税收金币的直接获得的数量」提供**改前基线** —— 数据先行，不拍脑袋。
 * 跑法：node .workbuddy/tools/audit/economy_audit.js        （文本报告）
 *       node .workbuddy/tools/audit/economy_audit.js --json （单行 JSON，便于对照）
 *
 * 口径（全部写明，避免"不知道数是怎么算的"）：
 *   · 税率 50% / 民心 100 —— DEFAULT_SETTINGS 的实际默认值
 *   · 金额单位 = 每**游戏小时**（与游戏内「产量/h」同口径；120× 倍率下 1 游戏时 = 30 现实秒）
 *   · 爵位按城池数自动选（RANK[k].city ≤ 城数的最高档），俸禄取其 salary
 *   · 未计科技/装备/道具加成 —— 它们对各来源等比例生效，不改变构成结论
 *   · 所有数字经游戏自身接口计算（cityProdPerSec / maxPopOf / cityDailyYield / levyPlan），
 *     本工具**不复制任何公式** —— 复制公式就是第二出口
 *
 * 三档场景（构造，非读取存档）：
 *   新手 1 城·官府3·民房×2  |  中期 3 城·官府8·民房×4  |  后期 5 城(含名城)·官府12·民房×6
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');   // → E:\Deepseekdb
const JS = path.join(ROOT, 'js');

/* ---- vm 沙箱：按加载顺序跑模块（与 index.html 同序，跳过 ui/main —— 审计不需要 DOM） ---- */
const sb = { console, document: undefined, location: undefined };
sb.window = sb;
vm.createContext(sb);
for (const f of ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'story', 'portraits']) {
  vm.runInContext(fs.readFileSync(path.join(JS, f + '.js'), 'utf8'), sb, { filename: f + '.js' });
}
const G = sb.GAME, D = G.DATA;
if (!D || !G.newGame) { console.error('✗ 模块加载失败'); process.exit(2); }

const fmt = v => Math.round(v).toLocaleString('en-US');
const pct = v => (v * 100).toFixed(1) + '%';
const isJson = process.argv.includes('--json');

/* ---- 场景构造 ---- */
const GF_IDX = [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3];   // 官府 4 格（v16 右侧中部）

function setupCity(city, govLv, houses) {
  city.cells.forEach(c => { c.build = null; c.pending = null; c.official = false; });
  GF_IDX.forEach(g => { city.cells[g].build = { id: 'guanfu', lvl: govLv }; city.cells[g].official = true; });
  let placed = 0;
  for (let i = 0; i < city.cells.length && placed < houses; i++) {
    if (!city.cells[i].official && !city.cells[i].build) {
      city.cells[i].build = { id: 'minfang', lvl: govLv };
      placed++;
    }
  }
  return city;
}

function buildScene(nSelf, namedTypes, govLv, houses) {
  G.newGame({ name: '审计', avatar: '🧔', gender: 'male', region: 'random' });
  const s = G.state;
  const cities = [];
  for (let i = 0; i < nSelf; i++) {
    const c = i === 0 ? s.cities[0] : G.makeCity({ id: 'audit_self' + i, name: '自建' + i, x: 100 + i, y: 100, type: 'self' });
    cities.push(setupCity(c, govLv, houses));
  }
  namedTypes.forEach((t, i) => {
    const c = G.makeCity({ id: 'audit_' + t, name: t, x: 200 + i, y: 200, type: t });
    cities.push(setupCity(c, govLv, houses));
  });
  s.cities = cities;
  /* 爵位按城数自动选最高可达档 */
  let rank = 0;
  D.RANK.forEach((r, i) => { if ((r.city || 1) <= cities.length) rank = i; });
  s.rank = rank;
  s.hearts = 100;
  s.tax = D.DEFAULT_SETTINGS.tax;
  return { s, cities, rank };
}

function auditScene(label, nSelf, namedTypes, govLv, houses) {
  const { s, cities, rank } = buildScene(nSelf, namedTypes, govLv, houses);
  const ts = G.timeScale();
  const toHour = perRealSec => perRealSec / ts * 3600;      // → 每游戏小时

  let taxPerH = 0, popCap = 0;
  cities.forEach(c => {
    taxPerH += toHour(G.cityProdPerSec(c).gold);
    popCap += G.maxPopOf(c);
  });
  const salaryPerH = (D.RANK[rank] || {}).salary || 0;

  /* 岁贡（名城专有）与征调（手动，列为参考） */
  const y = G.dailyYieldSummary();
  const tributePerH = (y.gold || 0) / 24;
  let levyGoldPerDay = 0;
  cities.forEach(c => {
    const plan = (G.levyPlan(c) || {}).resources || [];
    plan.forEach(r => { if (r.key === 'gold') levyGoldPerDay += r.qty; });
  });

  const auto = taxPerH + salaryPerH + tributePerH;
  const parts = [
    { name: '税收（人口×民心×税率）', perH: taxPerH },
    { name: '俸禄（爵位 ' + (D.RANK[rank] || {}).name + '）', perH: salaryPerH },
    { name: '岁贡（名城每日）', perH: tributePerH },
  ];

  return {
    label, cities: cities.length, govLv, houses, rank: (D.RANK[rank] || {}).name,
    popCap, taxPerH, salaryPerH, tributePerH, autoPerH: auto,
    levyGoldPerDay, parts,
    taxShare: auto > 0 ? taxPerH / auto : 0,
    /* 关键比值：攒一件 4 级打造（FORGE.costByQ[4].gold）需要多少游戏小时 */
    hoursFor4: auto > 0 ? (D.FORGE.costByQ[4].gold / auto) : 0,
    hoursFor3: auto > 0 ? (D.FORGE.costByQ[3].gold / auto) : 0,
  };
}

const scenes = [
  auditScene('新手 · 1城·官府3·民房×2', 1, [], 3, 2),
  auditScene('中期 · 3城·官府8·民房×4', 3, [], 8, 4),
  auditScene('后期 · 5城(含都/州/郡)·官府12·民房×6', 2, ['county', 'jun', 'zhou'], 12, 6),
];

if (isJson) {
  console.log(JSON.stringify({ ts: G.timeScale(), tax: D.DEFAULT_SETTINGS.tax, scenes }, null, 0));
  process.exit(0);
}

/* ---- 文本报告 ---- */
const L = [];
L.push('══════════════════════════════════════════════════════════');
L.push(' 经济审计 · 金币收入构成（v68 基线）');
L.push(' 税率 ' + (D.DEFAULT_SETTINGS.tax * 100) + '% · 民心 100 · 单位=每游戏小时 · 未计科技加成');
L.push('══════════════════════════════════════════════════════════');
for (const sc of scenes) {
  L.push('');
  L.push('【' + sc.label + '】  爵位=' + sc.rank + '  人口上限=' + fmt(sc.popCap));
  L.push('  来源                              每游戏时       占比');
  L.push('  ─────────────────────────────────────────────────────');
  for (const p of sc.parts) {
    L.push('  ' + p.name.padEnd(28, ' ') + String(fmt(p.perH)).padStart(10) + '   ' +
      (sc.autoPerH > 0 ? pct(p.perH / sc.autoPerH) : '—'));
  }
  L.push('  ─────────────────────────────────────────────────────');
  L.push('  自动收入合计                      ' + String(fmt(sc.autoPerH)).padStart(10));
  L.push('  （参考：征调民力 ' + fmt(sc.levyGoldPerDay) + '/游戏日，手动触发，未计入）');
  L.push('  ▸ 金币能攒多快：3 级打造(' + fmt(D.FORGE.costByQ[3].gold) + '金) 需 ' +
    sc.hoursFor3.toFixed(1) + ' 游戏时 · 4 级打造(' + fmt(D.FORGE.costByQ[4].gold) + '金) 需 ' +
    sc.hoursFor4.toFixed(1) + ' 游戏时');
}
L.push('');
L.push('──────────────────────────────────────────────────────────');
L.push(' 读法：税收占比越高 → "金币主要靠人口自然增长"（被动化）越强。');
L.push(' 决策参考：若要限制税收直给（老板需求），应看**后期档**的税收占比与');
L.push(' 绝对量 —— 改动前后各跑一次本工具对照，不拍脑袋。');
L.push('══════════════════════════════════════════════════════════');
console.log(L.join('\n'));
