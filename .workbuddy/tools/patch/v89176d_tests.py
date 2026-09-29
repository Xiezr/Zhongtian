# v89.176 补丁 D：测试断言 —— smoke §176（14 条）+ e2e §176（3 条）
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new):
    s = read(f)
    c = s.count(old)
    assert c == 1, tag + ' 锚点命中 ' + str(c) + ' 次'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

SMOKE_SEC = r'''  (function () {
    console.log('  --- 176. v89.176 智能战术 v2（接敌预测 · 阵型 · 保兵闸 · 沙盘统一）---');
    var fs176 = require('fs'), p176 = require('path');

    /* ① contactForecast 纯函数（接敌预测唯一出口） */
    console.log('  --- ① 接敌预测（真调） ---');
    check('§176① ★ contactForecast 真调：近距双向开火 + engage 集合 + contact', (function () {
      var A = [{ id: 'gongjian', count: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }];
      var D2 = [{ id: 'gongjian', count: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }];
      var fc = G.tactic.contactForecast(A, D2, 2600);
      return fc.fire.length === 2 && fc.engage['atk|gongjian'] === true && fc.engage['def|gongjian'] === true
        && fc.contact === true;
    })());
    check('§176①b 远距不开火 + 推进预演（gapAfter 确定性 1900）', (function () {
      var A = [{ id: 'gongjian', count: 100, adv: 100, spd: 250, er: 1200, stance: 'advance' }];
      var D2 = [{ id: 'gongjian', count: 100, adv: 100, spd: 250, er: 1200, stance: 'advance' }];
      var fc = G.tactic.contactForecast(A, D2, 2600);
      /* 各自推 250（cap=910 不拦）→ adv 350/350 → gapAfter = 2600−350−350 = 1900 */
      return fc.fire.length === 0 && fc.contact === false && fc.gapAfter === 1900;
    })());
    check('§176①c hold 不推进（防御原地待敌）', (function () {
      var A = [{ id: 'gongjian', count: 100, adv: 100, spd: 250, er: 1200, stance: 'hold' }];
      var D2 = [{ id: 'yibing', count: 100, adv: 100, spd: 200, er: 20, stance: 'advance' }];
      var fc = G.tactic.contactForecast(A, D2, 2600);
      /* 我方 hold → adv 不动；敌推 200 → 敌 adv 300。gapAfter = 2600−100−300 = 2200 */
      return fc.gapAfter === 2200 && fc.fire.length === 0;
    })());

    /* ② smartStanceOf 五模式（真调） */
    console.log('  --- ② 阵型模式（真调） ---');
    check('§176② ★ smartStanceOf 五模式：turtle 全 hold / charge 全 advance / line 贴射程才守', (function () {
      var f = G.battle.smartStanceOf;
      var inf = { id: 'changqiang', range: 50, spd: 300 };
      var bow = { id: 'gongjian', range: 1200, spd: 250 };
      return f(inf, 40, null, 'turtle') === 'hold' && f(inf, 9999, null, 'turtle') === 'hold'
        && f(inf, 40, null, 'charge') === 'advance' && f(inf, 10, null, 'charge') === 'advance'
        && f(inf, 90, null, 'line') === 'advance' && f(inf, 40, null, 'line') === 'hold'
        && f(bow, 900, null, 'line') === 'hold' && f(bow, 1500, null, 'line') === 'advance';
    })());
    check('§176②b spear：尖刀（fastestId）近距仍 advance；其余回落 echelon', (function () {
      var f = G.battle.smartStanceOf;
      var plan = { gapInf: 250, gapCav: 250, rangeK: 1, fastestId: 'qingji' };
      var cav = { id: 'qingji', range: 80, spd: 1000 };
      var inf = { id: 'changqiang', range: 50, spd: 300 };
      return f(cav, 50, plan, 'spear') === 'advance'      /* 尖刀贴脸也不停 */
        && f(inf, 50, plan, 'spear') === 'hold'           /* 非尖刀：gap 50 ≤ 250 → echelon 的 hold */
        && f(inf, 400, plan, 'spear') === 'advance';
    })());
    check('§176②c 缺省兼容：三参调用行为 = echelon（与 §164③ 同判据）', (function () {
      var f = G.battle.smartStanceOf;
      var bow = { range: 1200, spd: 250 };
      return f(bow, 900) === 'hold' && f(bow, 1500) === 'advance';
    })());

    /* ③ 保兵闸出口 */
    console.log('  --- ③ 保兵闸（损失/名城/撤退线） ---');
    check('§176③ 撤退线读表（retreatAt 0.30 / warnAt 0.22）· 唯一出口',
      G.battle.retreatAtOf() === 0.30 && G.battle.warnAtOf() === 0.22
      && DATA.SMART_PLAN.retreatAt === 0.30 && DATA.SMART_PLAN.warnAt === 0.22);
    check('§176③b mustTakeOf：野地/无目标 → 可撤；系统城口径 = isFamousCity', (function () {
      var f = G.isFamousCity;
      return G.battle.mustTakeOf(null) === false
        && G.battle.mustTakeOf({ target: { kind: 'wild', x: 2, y: 2 } }) === false
        && f({ type: 'county' }) === true && f({ type: 'capital' }) === true
        && f({ type: 'self' }) === false && f({ type: 'fort' }) === false;
    })());
    check('§176③c ★ lossRatioOf 真调：与手算一致 + 无快照回 0', (function () {
      var A = { changqiang: 300, daodun: 200, gongjian: 200 };
      var env = G.tactic.begin(A, null, { qingji: 800, gongjian: 900 }, 0, null, {});
      var g = 0;
      while (!env.over && g++ < 5) env.step();
      var lr = G.battle.lossRatioOf(env);
      var snap = env.snap(), s0 = 0, s1 = 0;
      snap.atk.forEach(function (u) { s0 += u.start; s1 += u.count; });
      var manual = s0 > 0 ? (s0 - s1) / s0 : 0;
      return lr >= 0 && lr <= 1 && Math.abs(lr - manual) < 1e-9
        && G.battle.lossRatioOf(null) === 0;
    })());

    /* ④ stepBattle 接入（源码级） */
    console.log('  --- ④ 接入（源码级） ---');
    (function () {
      var bS = fs176.readFileSync(p176.join(__dirname, 'js', 'battle.js'), 'utf8');
      var step = codeOf(bS, 'GAME.battle.stepBattle = function');
      check('§176④ stepBattle：保兵闸在智能改写之后、history 之前 · mode 记录',
        step.indexOf('lossRatioOf(ses)') > step.indexOf('smartApply(rec, ses)')
        && step.indexOf('lossRatioOf(ses)') < step.indexOf('rec.history.push(snapCmd)')
        && step.indexOf('retreatBattle(id)') >= 0
        && step.indexOf('rec.smartMode') >= 0);
    })();

    /* ⑤ 界面：统一化 + 损失 + 角标（真调输出） */
    console.log('  --- ⑤ 界面（共享出口与读数） ---');
    (function () {
      var uS = fs176.readFileSync(p176.join(__dirname, 'js', 'ui.js'), 'utf8');
      check('§176⑤ 三线/标尺共享出口：fieldLinesHTML 在册 + sd 转发 + bt 调用（id 前缀分家）',
        uS.indexOf('ui.fieldLinesHTML = function') >= 0
        && uS.indexOf('return ui.fieldLinesHTML(function (sd2)') >= 0
        && uS.indexOf("ui.fieldLinesHTML(ui.btSideName, snap.atk || [], snap.def || [], D, 'bt-fl')") >= 0
        && uS.indexOf('ui.fieldScaleHTML = function') >= 0);
      var snap176 = { field: 2600, atk: [
          { id: 'changqiang', name: '长枪兵', count: 80, start: 100, adv: 1400, spd: 300, er: 50, stance: 'advance' }],
        def: [{ id: 'gongjian', name: '弓箭手', count: 90, start: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }],
        towers: null };
      var fh = G.ui.btFieldHTML(snap176);
      check('§176⑤b ★ btFieldHTML 输出：三线（bt-fl-a）+ 标尺 + 接敌角标（incoming）',
        fh.indexOf('bt-fl-a') >= 0 && fh.indexOf('sd-scale') >= 0
        && /bt-fl-c/.test(fh) && fh.indexOf('incoming') >= 0,
        fh.slice(0, 120));
      check('§176⑤c ★ 顶栏损失读数：btLossHTML 真调（我损 20%）· 无 start → 空', (function () {
        var h1 = G.ui.btLossHTML({}, snap176);
        var h0 = G.ui.btLossHTML({}, { field: 100, atk: [{ id: 'x', count: 5, adv: 0 }], def: [] });
        return h1.indexOf('我损 20%') >= 0 && h1.indexOf('bt-loss') >= 0
          && h1.indexOf('敌损 10%') >= 0 && h0 === '';
      })());
      check('§176⑤d 撤退预警三态：≥30% danger · ≥22% warn · 常态无类', (function () {
        function loss(pct) {
          return G.ui.btLossHTML({}, { field: 100,
            atk: [{ id: 'x', count: 100 - pct, start: 100, adv: 0 }], def: [] });
        }
        return loss(35).indexOf('danger') >= 0 && loss(25).indexOf('warn') >= 0
          && loss(10).indexOf('warn') < 0 && loss(10).indexOf('danger') < 0;
      })());
      check('§176⑤e ★ 沙盘损失：sdLossHTML 真调（我 10% / 敌 20%）', (function () {
        var st = { atk: [{ id: 'gongjian', count: 90, start: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }],
          def: [{ id: 'gongjian', count: 80, start: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }],
          towers: 0, round: 3 };
        var sb = { field: 2600, ourSide: 'atk' };
        var h = G.ui.sdLossHTML(st, sb);
        return h.indexOf('损失 我') >= 0 && h.indexOf('10%') >= 0 && h.indexOf('20%') >= 0;
      })());
      check('§176⑤f 智能行含「阵型 · 规则」（源码级 modeCN 接线）',
        uS.indexOf('mc175') >= 0 && uS.indexOf('DATA.SMART_PLAN.modeCN') >= 0
        && uS.indexOf('strat175') >= 0);
      check('§176⑤g 撤退行渲染（源码级 · 🏳️ 智能撤退 + 残部带回）',
        uS.indexOf('🏳️ 智能撤退') >= 0 && uS.indexOf('sn175.retreat') >= 0);
      var hS = fs176.readFileSync(p176.join(__dirname, 'index.html'), 'utf8');
      check('§176⑤h 样式：.bt-unit.incoming 与 #bt-loss 三态在册',
        hS.indexOf('.bt-unit.incoming') >= 0 && hS.indexOf('#bt-loss.warn') >= 0
        && hS.indexOf('#bt-loss.danger') >= 0);
    })();

    var arc176 = fs176.readFileSync(p176.join(__dirname, '需求档案.md'), 'utf8');
    check('§176⑥ 需求档案在册（v89.176 · 老板原文关键句逐字）',
      arc176.indexOf('v89.176') >= 0
      && arc176.indexOf('损伤30%的局面，宁愿撤退') >= 0
      && arc176.indexOf('谁在下一回合接敌') >= 0);
  })();

'''

rep('smoke-test.js', 'D1 smoke §176',
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
SMOKE_SEC + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""")

E2E_SEC = r'''/* ============================================================
 * v89.176（智能战术 v2）：接敌角标 / 损失读数 / 沙盘统一 —— 真 DOM 版
 * ============================================================ */
(function () {
  const snap176 = { field: 2600, round: 3, maxRounds: 30, towers: null,
    atk: [{ id: 'changqiang', name: '长枪兵', count: 80, start: 100, adv: 1400, spd: 300, er: 50, stance: 'advance' }],
    def: [{ id: 'gongjian', name: '弓箭手', count: 90, start: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }] };
  check('v89.176 顶栏损失读数出现（btTopHTML · start↔count 我损 20%/敌损 10%）', (function () {
    const h = G.ui.btTopHTML({ cnt: 60 }, snap176);
    return h.indexOf('bt-loss') >= 0 && h.indexOf('我损 20%') >= 0 && h.indexOf('敌损 10%') >= 0;
  })());
  check('v89.176 战场三线 + 标尺 + 接敌角标（btFieldHTML · bt-fl-a / sd-scale / incoming）', (function () {
    const h = G.ui.btFieldHTML(snap176);
    return h.indexOf('bt-fl-a') >= 0 && h.indexOf('sd-scale') >= 0 && h.indexOf('incoming') >= 0;
  })());
  check('v89.176 智能行显示「阵型 · 规则」（喂 smartLog 带 mode:spear → 针尖麦芒）', (function () {
    const host = document.createElement('div');
    host.id = 'bt-log'; document.body.appendChild(host);
    G.ui.btRoundLine({ r: 96, gap: 1500, events: [] }, snap176,
      { side: 'atk', smartRule: 'front', smartMode: 'spear',
        smartLog: [{ r: 96, n: 2, rule: 'front', mode: 'spear', notes: ['弓箭手 前进→防御'] }] });
    const txt = host.textContent || '';
    return txt.indexOf('针尖麦芒') >= 0 && txt.indexOf('清前排') >= 0;
  })());
})();

'''

rep('e2e-test.js', 'D2 e2e §176',
"""let ABORTED = false;
function finish() {""",
E2E_SEC + """let ABORTED = false;
function finish() {""")

print('DONE-D')
