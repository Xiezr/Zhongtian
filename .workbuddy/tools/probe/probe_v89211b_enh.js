/* v89.211 探针 B：强化/蕴养数值链全链排查（老板 1「强化后装备属性似乎并未真实增加」）
   ------------------------------------------------------------
   目标态断言：落盘前跑 → 红（显示链缺失）；落盘后跑 → 全绿。
   覆盖：写回(inst.enh) → genEquipBonus(六维/体力) → genAttrs(atk/atkPct/staMax) →
         战斗消费(tactic.simulate A/B 对照) → 显示链(equipDescOf) → 决策链(equipScore)
         → 蕴养侧(lingPowerOf) → 存档持久化。
   运行：node .workbuddy/tools/probe/probe_v89211b_enh.js（输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}
function sumLoss(loss) { var t = 0; for (var k in loss) t += loss[k]; return t; }

var keep = G.state;
var bkRandom = Math.random;
try {
  var st = G.newGame({ name: '强化探针', cityName: '许都', mapSeed: 7 });
  G.state = st;
  var c0 = st.cities[0];
  G.ui._cityId = c0.id;
  /* 铁匠铺（forgeLevel 门槛） */
  c0.cells[0].build = { id: 'tiejiangpu', lvl: 3 };
  /* 钱粮 */
  G.goldAdd(99999999);
  c0.res.iron = 99999999; c0.res.stone = 99999999; c0.res.grain = 99999999; c0.res.wood = 99999999;

  var g = st.generals[0];
  var inst = G.addEquip('yt_sword', 0);   /* 倚天长剑：倚天套武器（atk 主项） */
  var eq = G.systems.equipItem(g.id, inst.u);
  chk('◎ 前置：装上倚天长剑（inventory→g.equip.weapon）', eq.ok === true, eq.msg);

  /* ---------- ① 百炼：写回 ---------- */
  console.log('=== ① 百炼写回（inst.enh）===');
  var r1 = G.enhance(inst.u);
  chk('①a enhance(+1) 成功', r1.ok === true && inst.enh === 1, r1.msg);
  var it = DATA.EQUIP.yt_sword;

  /* ---------- ② genEquipBonus：六维乘链 ---------- */
  console.log('=== ② genEquipBonus 乘链 ===');
  /* 先降回 0 测对照 */
  inst.enh = 0;
  var b0 = G.systems.genEquipBonus(g), a0 = G.genAttrs(g), sm0 = G.staMax(g);
  inst.enh = 1;
  var b1 = G.systems.genEquipBonus(g), a1 = G.genAttrs(g), sm1 = G.staMax(g);
  var expAtk1 = it.atk * 1.08;
  chk('②a b.atk = 装备攻 × 1.08（+1 级）', Math.abs(b1.atk - expAtk1) < 0.01,
    'b0=' + b0.atk + ' b1=' + b1.atk + ' exp=' + expAtk1);
  chk('②b b.sta = 装备体 × 1.08', Math.abs(b1.sta - it.sta * 1.08) < 0.01,
    b0.sta + '→' + b1.sta);
  chk('②c genAttrs.atk 增加', a1.atk > a0.atk, a0.atk + '→' + a1.atk);
  chk('②d genAttrs.atkPct 增加（战斗换算原子）', a1.atkPct > a0.atkPct,
    a0.atkPct + '→' + a1.atkPct);
  if (it.tong) chk('②e genAttrs.tong 增加', a1.tong > a0.tong, a0.tong + '→' + a1.tong);
  chk('②f staMax 增加（装备体力并入上限）', sm1 > sm0, sm0 + '→' + sm1);

  /* ---------- ③ 满级 (+10) ---------- */
  console.log('=== ③ 满级 +10 与极限值 ===');
  var lv = 1, guard = 0;
  while (lv < G.enhMax() && guard++ < 30) { var rr = G.enhance(inst.u); if (!rr.ok) break; lv = inst.enh; }
  chk('③a 连点至满级 +' + G.enhMax(), inst.enh === G.enhMax(), 'enh=' + inst.enh);
  var b10 = G.systems.genEquipBonus(g), a10 = G.genAttrs(g), sm10 = G.staMax(g);
  chk('③b 满级 b.atk = 装备攻 × 1.8', Math.abs(b10.atk - it.atk * 1.8) < 0.02,
    b10.atk + ' vs ' + it.atk * 1.8);
  chk('③c 满级 staMax 显著高于裸装', sm10 - sm0 > it.sta * 0.75,
    sm0 + '→' + sm10);

  /* ---------- ④ 战斗消费 A/B 对照（同种子） ---------- */
  console.log('=== ④ 战斗消费（tactic 引擎 A/B）===');
  var atkArmy = { changqiang: 5000, gongjian: 2000 };
  var defArmy = { gongjian: 3000 };
  Math.random = function () { return 0.5; };
  inst.enh = 0;
  var sim0 = G.battle.simulate(U.deep(atkArmy), g, U.deep(defArmy), 0, null, {});
  var aLoss0 = sim0.atkLoss, dLoss0 = sim0.defLoss;
  inst.enh = G.enhMax();
  var sim10 = G.battle.simulate(U.deep(atkArmy), g, U.deep(defArmy), 0, null, {});
  var aLoss10 = sim10.atkLoss, dLoss10 = sim10.defLoss;
  Math.random = bkRandom;
  console.log('     enh0: winner=' + sim0.winner + ' 我损=' + aLoss0 + ' 敌损=' + dLoss0 + ' 回合=' + (sim0.rounds || '?'));
  console.log('     enh10: winner=' + sim10.winner + ' 我损=' + aLoss10 + ' 敌损=' + dLoss10 + ' 回合=' + (sim10.rounds || '?'));
  chk('④a 强化后战斗结果变好（我损↓ 或 敌损↑）',
    aLoss10 < aLoss0 || dLoss10 > dLoss0 || (sim0.winner !== 'atk' && sim10.winner === 'atk'),
    '我损 ' + aLoss0 + '→' + aLoss10 + ' · 敌损 ' + dLoss0 + '→' + dLoss10);

  /* ---------- ⑤ 显示链（目标态：equipDescOf 唯一出口） ---------- */
  console.log('=== ⑤ 显示链（按件强化计入展示）===');
  chk('⑤a GAME.equipDescOf 在册（按件显示唯一出口）', typeof G.equipDescOf === 'function');
  if (typeof G.equipDescOf === 'function') {
    var d10 = G.equipDescOf(inst);
    var expTxt = String(Math.round(it.atk * 1.8));
    chk('⑤b +10 装备描述含强化后攻值 ' + expTxt, d10.indexOf(expTxt) >= 0, d10);
    inst.enh = 0;
    chk('⑤c +0 装备描述 = 原值（不虚标）', G.equipDescOf(inst).indexOf(String(it.atk)) >= 0,
      G.equipDescOf(inst));
    inst.enh = G.enhMax();
  }
  chk('⑤d GAME.eqEnhMulOf 在册（强化乘数唯一出口）', typeof G.eqEnhMulOf === 'function');
  if (typeof G.eqEnhMulOf === 'function') {
    chk('⑤e eqEnhMulOf(+10) ≈ 1.8', Math.abs(G.eqEnhMulOf(inst) - 1.8) < 1e-9,
      G.eqEnhMulOf(inst));
  }

  /* ---------- ⑥ 决策链：equipScore 计入强化 ---------- */
  console.log('=== ⑥ 决策链（评分/一键最优）===');
  var hiInst = { u: 9001, id: 'yt_sword', enh: G.enhMax() };
  var loInst = { u: 9002, id: 'yt_sword', enh: 0 };
  var sHi = G.systems.equipScore(hiInst), sLo = G.systems.equipScore(loInst);
  chk('⑥a equipScore 按件计入强化（+10 > +0）', sHi > sLo, sHi + ' vs ' + sLo);
  chk('⑥b equipScore 兼容装备谱直传（full def 零误杀 · 对象按 id 解析到规范谱）',
    Math.abs(G.systems.equipScore(it) - ((it.tong||0) * 3 + (it.yw||0) * 3 + (it.zm||0) * 3 + (it.nz||0) * 3
      + (it.atk||0) + (it.def||0) + (it.sta||0) * 0.2 + (it.spd||0) * 4 + 50)) < 0.01);

  /* ---------- ⑦ 蕴养链（君主 + 修炼装备） ---------- */
  console.log('=== ⑦ 蕴养链（lingPowerOf / genAttrs / 显示）===');
  var lord = G.lordGeneralOf();
  chk('⑦a 君主在册且可修炼', !!lord && G.canCultivate(lord));
  var lingId = null;
  Object.keys(DATA.EQUIP).forEach(function (id) {
    var t2 = DATA.EQUIP[id];
    if (!t2.ling) return;
    if (!lingId || ((t2.lingv || 0) > (DATA.EQUIP[lingId].lingv || 0))) lingId = id;
  });
  chk('⑦b 找到修炼装备样例', !!lingId, lingId);
  var lit = DATA.EQUIP[lingId], linst = G.addEquip(lingId, 0);
  var eqL = G.systems.equipItem(lord.id, linst.u);
  chk('⑦c 君主穿上修炼装备（进 lingEquip）', eqL.ok === true, eqL.msg);
  var tg = G.toggleEquipSet(lord.id, 'ling');
  chk('⑦d 切修炼生效套', tg.ok === true, tg.msg);
  var lp0 = G.lingPowerOf(lord), la0 = G.genAttrs(lord), lsm0 = G.staMax(lord);
  st.items.lingsui = 99999;
  var rt = G.lingTemper(linst.u);
  chk('⑦e 蕴养+1 成功且写回', rt.ok === true && linst.enh === 1, rt.msg);
  var lp1 = G.lingPowerOf(lord), la1 = G.genAttrs(lord), lsm1 = G.staMax(lord);
  var expLing = lit.lingv || 0;
  chk('⑦f lingPowerOf 增加（灵力 × 1.08）', lp1 > lp0 || expLing === 0,
    lp0 + '→' + lp1 + '（lingv=' + expLing + '）');
  if (lit.tong) chk('⑦g 修炼装备六维经 genAttrs 增加', la1.tong > la0.tong, la0.tong + '→' + la1.tong);
  if (lit.sta) chk('⑦h 修炼装备体力并入 staMax', lsm1 > lsm0, lsm0 + '→' + lsm1);
  if (typeof G.equipDescOf === 'function') {
    linst.enh = 5;
    var ld = G.equipDescOf(linst);
    chk('⑦i 修炼装备描述按件含强化（+5）', lit.lingv ? ld.indexOf('灵+' + Math.round(lit.lingv * 1.4)) >= 0 : true,
      ld);
    linst.enh = 1;
  }

  /* ---------- ⑧ 存档持久化 ---------- */
  console.log('=== ⑧ 存档持久化 ===');
  var j = G.savePayload();   /* 已是 JSON 字符串（不再二次 stringify） */
  chk('⑧a 存档含该件 enh=10（按件入档）', j.indexOf('"u":' + inst.u + ',"id":"yt_sword","enh":10') >= 0
    || j.indexOf('"enh":10') >= 0, 'searched uid=' + inst.u);
  chk('⑧b 存档含蕴养件 enh=1', j.indexOf('"u":' + linst.u + ',"id":"' + lingId + '","enh":1') >= 0,
    'uid=' + linst.u);

  /* ---------- ⑨ 显示消费点源码核对（唯一出口被引用面） ---------- */
  console.log('=== ⑨ 显示消费点（源码）===');
  var uS = fs.readFileSync(R + 'js/ui.js', 'utf8');
  var nDescOf = (uS.match(/GAME\.equipDescOf\(/g) || []).length;
  chk('⑨a ui.js 引用 equipDescOf ≥ 4 处（甲/详/选/卡）', nDescOf >= 4, 'n=' + nDescOf);
  chk('⑨b 装备面板槽位行不再直读 item.atk 裸值',
    !/item\.slot === 'weapon' && item\.atk \? ' 攻' \+ item\.atk/.test(uS));
  var sS = fs.readFileSync(R + 'js/systems.js', 'utf8');
  chk('⑨c sysc equipScore 计入 enh（源码）', /eqEnhMulOf|eqEnhOf/.test(sS.slice(sS.indexOf('S.equipScore'), sS.indexOf('S.equipScore') + 900)));
} catch (e) {
  console.log('  ✗ 探针异常: ' + (e && e.stack || e));
  FAIL++;
} finally {
  G.state = keep;
  G.ui._cityId = null;
  Math.random = bkRandom;
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
