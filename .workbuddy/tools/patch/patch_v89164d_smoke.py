# -*- coding: utf-8 -*-
"""v89.164 补丁 D：smoke 加 §164 段（曲线 / 时长对齐 / 智能战斗）"""
import io

R = 'E:/Deepseekdb/'
p = 'smoke-test.js'
s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if '164. v89.164（六维曲线' in s:
    print('skip：§164 已在')
    raise SystemExit(0)

ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

NEW = """  /* ============================================================
   * §164. v89.164（老板 3）：
   *   ① 城主六维加成改**曲线**（分段减半 · 收敛 +300%/+150%）
   *   ② 征兵时长按五条对齐关系重排（青州=长枪 · 刀盾=藤甲 · 突骑>弓箭 · 轻骑=虎豹 · 铁骑=西凉）
   *   ③ 智能战斗系统（DATA.SMART_PLAN · stepBattle 执行 · 默认开）
   * ============================================================ */
  console.log('\\n===== 164. v89.164（六维曲线 · 时长对齐 · 智能战斗） =====');
  (function () {
    var fs164 = require('fs'), p164 = require('path');
    var dS164 = stripComment(fs164.readFileSync(p164.join(__dirname, 'js', 'domain.js'), 'utf8'));
    var bS164 = stripComment(fs164.readFileSync(p164.join(__dirname, 'js', 'battle.js'), 'utf8'));

    console.log('  --- ① 六维曲线（分段减半 · 收敛 +300%/+150%） ---');
    check('§164① 常量表 DATA.MAYOR_CURVE 存在（seg 150 · maxK 20）', (function () {
      var C = DATA.MAYOR_CURVE || {};
      return C.seg === 150 && C.maxK === 20;
    })());
    check('§164① curveBonusOf 唯一出口（一处定义）', (function () {
      return (dS164.match(/GAME\\.curveBonusOf = function/g) || []).length === 1;
    })());
    check('§164① ★ 样本点：80→+80% · 150→+150% · 200→+175% · 300→+225% · 500→+268.75%', (function () {
      var f = G.curveBonusOf;
      return Math.abs(f(80, 0.01, 150) - 0.8) < 1e-9
        && Math.abs(f(150, 0.01, 150) - 1.5) < 1e-9
        && Math.abs(f(200, 0.01, 150) - 1.75) < 1e-9
        && Math.abs(f(300, 0.01, 150) - 2.25) < 1e-9
        && Math.abs(f(500, 0.01, 150) - 2.6875) < 1e-9;
    })());
    check('§164① ★ 收敛：nz 5000 → +300%（有界）· zm 836 → +146.7%', (function () {
      var a = G.curveBonusOf(5000, 0.01, 150);
      var b = G.curveBonusOf(836, 0.005, 150);
      return a > 2.999 && a <= 3.0 + 1e-9 && Math.abs(b - 1.4666) < 5e-4;
    })());
    check('§164① 首段与旧线性一字不差（150 点内逐点恒等：n/100）', (function () {
      var ok = true;
      [10, 40, 80, 120, 149, 150].forEach(function (n) {
        if (Math.abs(G.curveBonusOf(n, 0.01, 150) - n * 0.01) > 1e-9) ok = false;
      });
      return ok;
    })());
    check('§164① 二次截断退役：三处消费端不再各截一刀（源码级）', (function () {
      var sS = stripComment(fs164.readFileSync(p164.join(__dirname, 'js', 'state.js'), 'utf8'));
      var syS = stripComment(fs164.readFileSync(p164.join(__dirname, 'js', 'systems.js'), 'utf8'));
      return dS164.indexOf('Math.min(1.5, mb.build || 0)') < 0
        && dS164.indexOf('Math.min(1.0, mbc.def)') < 0
        && syS.indexOf('Math.min(1.5, _mb.research)') < 0;
    })());

    console.log('  --- ② 征兵时长 · 五条对齐关系 ---');
    check('§164② ★ 青州=长枪 · 刀盾=藤甲 · 轻骑=虎豹 · 铁骑=西凉 · 突骑>弓箭手', (function () {
      var T = DATA.TROOPS;
      return T.qingzhoubing.time === T.changqiang.time
        && T.daodun.time === T.tengjiabing.time
        && T.qingji.time === T.hubaoqi.time
        && T.tieji.time === T.xiliangtieqi.time
        && T.tuqibing.time > T.gongjian.time;
    })(), '青州/长枪 ' + DATA.TROOPS.qingzhoubing.time + ' · 刀盾/藤甲 ' + DATA.TROOPS.daodun.time
      + ' · 突骑 ' + DATA.TROOPS.tuqibing.time + '>弓 ' + DATA.TROOPS.gongjian.time
      + ' · 轻骑/虎豹 ' + DATA.TROOPS.qingji.time + ' · 铁骑/西凉 ' + DATA.TROOPS.tieji.time);
    check('§164② 上限口径保持（步兵 ≤60 · 骑兵 ≤300 · 器械未动）', (function () {
      var bad = 0;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'inf' && t.time > 60) bad++;
        if (t.cat === 'cav' && t.time > 300) bad++;
      });
      return bad === 0 && DATA.TROOPS.chuangnu.time >= 1000;
    })());

    console.log('  --- ③ 智能战斗（通用方案 · 默认开） ---');
    check('§164③ DATA.SMART_PLAN 结构（阈值 + 目标表覆盖全部骑兵）', (function () {
      var P = DATA.SMART_PLAN || {};
      if (!(P.gapInf > 0) || !(P.gapCav > 0)) return false;
      var ok = true;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        if (DATA.TROOPS[k].cat === 'cav' && !P.targets[k]) ok = false;   /* 骑族全在表里 */
      });
      return ok && P.targets.changqiang === 'qingji' && P.targets.gongjian === 'gongjian';
    })());
    check('§164③ smartStanceOf 纯函数：远程进射程转守 · 骑/步接敌转守', (function () {
      var bow = { range: 1200, spd: 250 }, cav = { range: 80, spd: 1000 }, inf = { range: 50, spd: 300 };
      var f = G.battle.smartStanceOf;
      return f(bow, 900) === 'hold' && f(bow, 1500) === 'advance'
        && f(cav, 200) === 'hold' && f(cav, 400) === 'advance'
        && f(inf, 200) === 'hold' && f(inf, 400) === 'advance';
    })());
    check('§164③ 开关：默认开 · setSmartBattle(false) 关 · 还原', (function () {
      var bk = (G.state.settings || {}).smartBattle;
      var d1 = G.battle.smartOnOf() === true;                 /* 默认（undefined）= 开 */
      G.battle.setSmartBattle(false);
      var d2 = G.battle.smartOnOf() === false;
      G.battle.setSmartBattle(true);
      var d3 = G.battle.smartOnOf() === true;
      G.state.settings.smartBattle = bk;
      return d1 && d2 && d3;
    })());
    check('§164③ ★ smartApply 真调：只托管攻方（我方 stance/target 写进 rec.cmd 与 env）', (function () {
      var A = { yibing: 300, gongjian: 300, qingji: 200 };
      var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
      var rec = { side: 'atk', cmd: {} };
      G.battle.smartApply(rec, env);
      var bow = env.units.atk.filter(function (u) { return u.id === 'gongjian'; })[0];
      var cav = env.units.atk.filter(function (u) { return u.id === 'qingji'; })[0];
      var defBow = env.units.def.filter(function (u) { return u.id === 'gongjian'; })[0];
      /* 初始 gap = field−100−100 ≥ 射程 → advance；目标已按表指派 */
      return rec.cmd.gongjian && rec.cmd.gongjian.t === 'gongjian'
        && rec.cmd.qingji && rec.cmd.qingji.t === 'gongjian'
        && bow.stance === 'advance' && cav.stance === 'advance'
        && bow.target === 'gongjian' && cav.target === 'gongjian'
        && (defBow.target || '') === '';                    /* 守方不动 */
    })());
    check('§164③ stepBattle 接入：smartApply 在 history push 之前（源码级）', (function () {
      var seg = bS164.slice(bS164.indexOf('GAME.battle.stepBattle = function'));
      var iSmart = seg.indexOf('smartApply(rec, ses)');
      var iHist = seg.indexOf('rec.history.push(snapCmd)');
      return iSmart >= 0 && iHist >= 0 && iSmart < iHist;
    })());
    check('§164③ ★ 真跑对比：智能方案交换比 ≥ 2× 全默认（镜像小局）', (function () {
      var A = { yibing: 500, changqiang: 500, daodun: 400, gongjian: 400, qingji: 200, tieji: 100, chuangnu: 40, toudan: 20 };
      function run(smart) {
        var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
        var rec = { side: 'atk', cmd: {} };
        var guard = 0;
        while (!env.over && guard++ < 36) {
          if (smart) G.battle.smartApply(rec, env);
          var st = env.step(); if (!st) break;
        }
        var fin = env.finish();
        var aL = 0, dL = 0;
        for (var k in fin.atkLossBy) aL += fin.atkLossBy[k];
        for (var k in fin.defLossBy) dL += fin.defLossBy[k];
        return { aL: aL, dL: dL };
      }
      var off = run(false), on = run(true);
      var rOff = off.aL > 0 ? off.dL / off.aL : 0;
      var rOn = on.aL > 0 ? on.dL / on.aL : 0;
      _r164sim = 'off=' + rOff.toFixed(2) + ' → on=' + rOn.toFixed(2);
      return rOn > rOff * 2 && on.dL > off.dL;
    })(), _r164sim);
    check('§164③ 界面：战术下拉含「⚡ 智能战斗」· 摘要行 · 战场指示（源码级）', (function () {
      var uS = fs164.readFileSync(p164.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /⚡ 智能战斗（通用方案）/.test(uS) && /value="smart"/.test(uS)
        && /智能战斗（接敌转守 · 逐回合自动指挥）/.test(uS) && /bt-smart/.test(uS);
    })());
    check('§164④ 需求档案在册（v89.164 · 老板原文关键句逐字）', (function () {
      var arc = fs164.readFileSync(p164.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.164') >= 0
        && arc.indexOf('六维加成都走第三条路子') >= 0
        && arc.indexOf('青州=长枪，刀盾=藤甲') >= 0
        && arc.indexOf('设计一套通用的战斗方式') >= 0;
    })());
  })();

"""

assert s.count(ANCHOR) == 1, '锚点数=%d' % s.count(ANCHOR)
s = s.replace(ANCHOR, NEW + ANCHOR)

# _r164sim 变量声明（放在 §164 段前）
old_decl = """  console.log('\\n===== 164. v89.164（六维曲线 · 时长对齐 · 智能战斗） =====');
  (function () {"""
new_decl = """  console.log('\\n===== 164. v89.164（六维曲线 · 时长对齐 · 智能战斗） =====');
  var _r164sim = '';
  (function () {"""
assert s.count(old_decl) == 1
s = s.replace(old_decl, new_decl)

io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('§164 已插入 · 新长度', len(s))
