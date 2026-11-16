/* 守将平衡套餐接线（v91.87；所有改动都在 settings.guardBalance 开关后面，默认关闭） */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
function must(s, a, label) { if (s.indexOf(a) < 0) throw new Error('锚点未找到：' + label); return s; }
const done = [];

/* ---------- 1) data.js：三张表 ---------- */
let d = read('js/data.js');
must(d, 'DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.8, atkDim: 0.25 };', 'GUARD_FOLD');
if (d.indexOf('GUARD_FOLD_V2') < 0) {
  d = d.replace('DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.8, atkDim: 0.25 };',
    `DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.8, atkDim: 0.25 };
  /* ============================================================
   * v91.87：守将"稍逊于玩家"档（开关 settings.guardBalance，默认关）
   * 实测（v91.86）：野地 Lv10 守将 = 玩家同等级 0.23 倍四维、战力 1.23× 无将；
   *   名城守将却是 1.00 倍 —— 同一套系统两把尺，跨度 4.3 倍。
   *   根因是两条口径相乘：守将封顶进化体（3.75 点/级）＋折损 dim 0.5，
   *   玩家可到天启体（10 点/级）。
   * 本表一起调：资质按野地等级爬梯；折损 0.5/0.25 → 0.8/0.8。
   * 代价：守将战力 ×1.76 → 用 GUARD_POWER_COMP 下调守军数量，总战力持平。
   * ⚠️ 默认关；关闭时三处生成逐字节走 v89.195 口径。 */
  DATA.GUARD_FOLD_V2 = { dim: 0.8, staPct: 0.9, atkDim: 0.8 };
  DATA.GUARD_RANK_LADDER = ['ying', 'ying', 'ying', 'ming', 'ming', 'ming', 'ming', 'tian', 'tian', 'tian'];
  /* 守军数量补偿（逐级实测：Lv1 0.99 / Lv5 0.81 / Lv7 0.73 / Lv10 0.56） */
  DATA.GUARD_POWER_COMP = { wildBase: 1, wildPerLv: -0.048, wildMin: 0.55, fort: 0.72 };`);
  done.push('data.js 三张表');
}

/* 设置默认值 */
must(d, '    battleWatch: true, battleSec: 60 };', 'DEFAULT_SETTINGS');
if (d.indexOf('guardBalance: false') < 0) {
  d = d.replace('    battleWatch: true, battleSec: 60 };',
    '    battleWatch: true, battleSec: 60,\n    /* v91.87：守将平衡套餐（资质爬梯 + 折损 0.8 + 守军数量补偿），默认关 */\n    guardBalance: false };');
  done.push('settings.guardBalance');
}
write('js/data.js', d);

/* ---------- 2) domain.js：开关助手 + 资质爬梯 + 折损 + 野地守军补偿 ---------- */
let dom = read('js/domain.js');
must(dom, 'GAME.guardRankIdxOf = function (kind, lv) {', 'guardRankIdxOf');
if (dom.indexOf('GAME.guardBal') < 0) {
  dom = dom.replace('GAME.guardRankIdxOf = function (kind, lv) {',
    `/* v91.87：守将平衡套餐唯一开关出口（默认关 = v89.195 口径逐字节不变）。
     三个消费点：资质（此处）· 折损（wildDefenseAt / fortGuardOf）· 守军数量补偿。 */
  GAME.guardBal = {
    on: function () {
      var s = GAME.state;
      return !!(s && s.settings && s.settings.guardBalance);
    },
    fold: function () {
      return GAME.guardBal.on() ? (DATA.GUARD_FOLD_V2 || DATA.GUARD_FOLD) : DATA.GUARD_FOLD;
    },
    rankIdOf: function (kind, lv) {
      if (!GAME.guardBal.on() || kind !== 'wild') return null;
      var L = DATA.GUARD_RANK_LADDER;
      if (!L || !L.length) return null;
      return L[Math.max(0, Math.min(L.length - 1, (lv | 0) - 1))] || null;
    },
    /* 守军数量补偿：守将强多少，兵就减多少，保持"守军总战力"不变 */
    compOf: function (kind, lv) {
      if (!GAME.guardBal.on()) return 1;
      var C = DATA.GUARD_POWER_COMP || {};
      if (kind === 'fort') return C.fort != null ? C.fort : 1;
      var v = (C.wildBase != null ? C.wildBase : 1) + (C.wildPerLv != null ? C.wildPerLv : 0) * Math.max(0, (lv | 0) - 1);
      return Math.max(C.wildMin != null ? C.wildMin : 0.5, Math.min(1, v));
    },
    scaleArmy: function (army, kind, lv) {
      var k = GAME.guardBal.compOf(kind, lv);
      if (!army || Math.abs(k - 1) < 1e-6) return army;
      var out = {};
      for (var id in army) out[id] = Math.max(1, Math.round((army[id] || 0) * k));
      return out;
    }
  };
  GAME.guardRankIdxOf = function (kind, lv) {`);
  done.push('GAME.guardBal');
}
must(dom, "    var want = (kind === 'fort') ? 'ming' : 'ying';", 'rank want');
if (dom.indexOf('_balRk') < 0) {
  dom = dom.replace("    var want = (kind === 'fort') ? 'ming' : 'ying';",
    "    var _balRk = GAME.guardBal.rankIdOf(kind, lv);\n    var want = _balRk || ((kind === 'fort') ? 'ming' : 'ying');");
  done.push('资质爬梯');
}
must(dom, 'GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：野外守将折损（半折，见 DATA.GUARD_FOLD） */', 'wild fold');
if (dom.indexOf('GAME.guardFillOf(g, GAME.guardBal.fold())') < 0) {
  dom = dom.replace('GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：野外守将折损（半折，见 DATA.GUARD_FOLD） */',
    'GAME.guardFillOf(g, GAME.guardBal.fold());   /* v91.87：开关决定折损档（默认 = DATA.GUARD_FOLD） */');
  done.push('野地折损');
}
must(dom, '    return { lv: lv, day: day, army: army, total: total, gen: gen };', 'wild return');
if (dom.indexOf("scaleArmy(army, 'wild', lv)") < 0) {
  dom = dom.replace('    return { lv: lv, day: day, army: army, total: total, gen: gen };',
    `    /* v91.87：守将变强 → 守军数量同幅下调（开关关闭时 scaleArmy 原样返回） */
    if (GAME.guardBal && GAME.guardBal.on()) {
      army = GAME.guardBal.scaleArmy(army, 'wild', lv);
      total = 0;
      for (var _wk in army) total += army[_wk];
    }
    return { lv: lv, day: day, army: army, total: total, gen: gen };`);
  done.push('野地守军补偿');
}
write('js/domain.js', dom);

/* ---------- 3) map.js：据点折损 + 据点守军补偿 ---------- */
let mp = read('js/map.js');
must(mp, 'GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：等级/资质真转战力（野外守将折损半折） */', 'fort fold');
if (mp.indexOf('GAME.guardFillOf(g, GAME.guardBal') < 0) {
  mp = mp.replace('GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：等级/资质真转战力（野外守将折损半折） */',
    'GAME.guardFillOf(g, GAME.guardBal ? GAME.guardBal.fold() : DATA.GUARD_FOLD);   /* v91.87：开关决定折损档 */');
  done.push('据点折损');
}
must(mp, '    return {\n      buxingji: Math.round(base * 0.6),\n      dunwei: Math.round(base * 0.2),\n      daodanche: Math.round(base * 0.2),\n      fujiche: lv >= 4 ? Math.round(base * 0.1) : 0,\n    };', 'fort garrison ret');
if (mp.indexOf("scaleArmy({") < 0) {
  mp = mp.replace('    return {\n      buxingji: Math.round(base * 0.6),\n      dunwei: Math.round(base * 0.2),\n      daodanche: Math.round(base * 0.2),\n      fujiche: lv >= 4 ? Math.round(base * 0.1) : 0,\n    };',
    `    var _gar = {
      buxingji: Math.round(base * 0.6),
      dunwei: Math.round(base * 0.2),
      daodanche: Math.round(base * 0.2),
      fujiche: lv >= 4 ? Math.round(base * 0.1) : 0
    };
    /* v91.87：据点守将变强 → 守军数量同幅下调（开关关闭时原样返回） */
    return (GAME.guardBal && GAME.guardBal.on()) ? GAME.guardBal.scaleArmy(_gar, 'fort', lv) : _gar;`);
  done.push('据点守军补偿');
}
write('js/map.js', mp);

console.log('完成：' + done.join(' / '));
