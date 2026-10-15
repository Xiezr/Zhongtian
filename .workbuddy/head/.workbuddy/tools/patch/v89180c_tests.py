# v89180c 补丁：测试断言 —— smoke §180（拆械 + 风筝）+ e2e §180（真 DOM：床弩卡 + live 滚动）
import io

P = 'E:/Deepseekdb/'
def read(p):
    return io.open(P + p, 'r', encoding='utf-8', newline='').read()
def write(p, s):
    io.open(P + p, 'w', encoding='utf-8', newline='').write(s)

# ============================================================
# 1. smoke §180（插在 §179 段之后、"console.log('结果：' 之前）
# ============================================================
s = read('smoke-test.js')
anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);"""
assert s.count(anchor) == 1, 'smoke anchor'
sec = """  /* ============================================================
   * §180（v89.180）—— 拆械特性 + 智能风筝（老板四条）
   * 老板原话：「1.补床弩拆器械特性 / 2.你在意的是每人口效率，我在意的是能上场的
   *   总人口和总攻防 / 3.突骑兵是带速度的弓兵，……前出接敌（拉进射程），后边持续
   *   无伤消耗，……距离难道不是弓兵的生命线吗 / 4.如果对弓兵的运用只会前直接对对碰，
   *   那是还不够智能」
   * 标定证据：probe_v89180a（总人口矩阵）· b（风筝候选）· c（拆械倍率）· d（落地后对照）
   * ============================================================ */
  (function () {
    console.log('  --- §180 拆械与风筝 ---');
    var fs180 = require('fs'), p180 = require('path');

    /* ① 拆械表结构 */
    check('§180① 拆械表：床弩 vsMech=3 · 四器械 mech 标签 · 非器械零污染', (function () {
      var T = DATA.TROOPS;
      var mechIds = Object.keys(T).filter(function (k) { return T[k].mech; }).sort();
      return T.chuangnu.vsMech === 3
        && mechIds.join(',') === 'chongche,chuangnu,toudan,zhouche'
        && !T.changqiang.mech && !T.qingji.mech && !T.gongjian.mech;
    })());

    /* ② 拆械引擎真调（单变量对照：×3 胜 / ×1 负，防"没生效"平凡解） */
    check('§180② 拆械引擎真调：床弩打投石（×3 胜 · ×1 负）· 打长枪不受影响', (function () {
      var bak = DATA.TROOPS.chuangnu.vsMech;
      var r3, r1, rK;
      try {
        DATA.TROOPS.chuangnu.vsMech = 3;
        r3 = G.battle.simulate({ chuangnu: 1333 }, null, { toudan: 1000 }, 0, null, { kind: 'wild' });
        rK = G.battle.simulate({ chuangnu: 1333 }, null, { changqiang: 4000 }, 0, null, { kind: 'wild' });
        DATA.TROOPS.chuangnu.vsMech = 1;
        r1 = G.battle.simulate({ chuangnu: 1333 }, null, { toudan: 1000 }, 0, null, { kind: 'wild' });
      } finally { DATA.TROOPS.chuangnu.vsMech = bak; }
      return r3.winner === 'atk' && r3.defLoss >= 1000 * 0.99
        && r1.winner !== 'atk' && r1.defLoss < 1000 * 0.5
        && rK.atkLoss <= 1333 * 0.55;
    })(), (function () {
      return '对照已跑';
    })());

    /* ③ 风筝五态（带 ctx 临战 / 无 ctx 向后兼容） */
    check('§180③ smartStanceOf 风筝五态：威胁退 / 安全守 / 射程外进 / 无窗口守 / 退不动守', (function () {
      var f = G.battle.smartStanceOf;
      var tu = { id: 'tuqibing', range: 1000, spd: 450, er: 1000 };
      var bow = { id: 'gongjian', range: 1200, spd: 250, er: 1200 };
      var k1 = { kite: true, threat: 350, eRange: 50, back: 450 };
      return f(tu, 300, null, 'echelon', k1) === 'retreat'
        && f(tu, 300, null, 'echelon') === 'hold'
        && f(tu, 500, null, 'echelon', k1) === 'hold'
        && f(tu, 1500, null, 'echelon', k1) === 'advance'
        && f(bow, 300, null, 'echelon', { kite: true, threat: 350, eRange: 1200, back: 250 }) === 'hold'
        && f(tu, 300, null, 'echelon', { kite: true, threat: 350, eRange: 50, back: 0 }) === 'hold';
    })());

    /* ④ 风筝真实管线：突骑（能跑）出现"后退"指令；弓（跑不动）不出现 */
    check('§180④ 风筝真实管线：突骑 vs 长枪 8 回合内出「后退」· 弓为对照不出现', (function () {
      function runOne(A, B) {
        var id = Object.keys(A)[0];
        var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
        var rec = { side: 'atk', cmd: {} };
        var saw = false, g = 0;
        while (!env.over && g++ < 8) {
          G.battle.smartApply(rec, env);
          if (rec.cmd && rec.cmd[id] && rec.cmd[id].s === 'retreat') saw = true;
          env.step();
        }
        return saw;
      }
      return runOne({ tuqibing: 2000 }, { changqiang: 4000 }) === true
        && runOne({ gongjian: 2000 }, { changqiang: 4000 }) === false;
    })());

    /* ⑤ 界面可见（源码级：悬停两处 + desc） */
    check('§180⑤ 界面可见：战场悬停与募兵卡各含「拆械」行 · desc 更新', (function () {
      var uS = stripComment(fs180.readFileSync(p180.join(__dirname, 'js', 'ui.js'), 'utf8'));
      var dS = fs180.readFileSync(p180.join(__dirname, 'js', 'data.js'), 'utf8');
      return (uS.match(/拆械/g) || []).length >= 2 && dS.indexOf('拆械破车') >= 0;
    })());

    /* ⑥ live 快照选择器含 panel-body（本轮修的 flaky 根因 · 结构性守卫） */
    check('§180⑥ live 快照/回填含 .panel-body（滚动位不丢 · 两处同改）', (function () {
      var uS180 = fs180.readFileSync(p180.join(__dirname, 'js', 'ui.js'), 'utf8');
      return (uS180.match(/querySelectorAll\\('\\.inner-panel, \\.panel-body, \\.modal-scroll'\\)/g) || []).length === 2;
    })());

    /* ⑦ 需求档案在册 */
    var arc180 = '';
    try { arc180 = fs180.readFileSync(p180.join(__dirname, '需求档案.md'), 'utf8'); } catch (e) { }
    check('§180⑦ 需求档案在册（v89.180 · 老板原文关键句）',
      arc180.indexOf('v89.180') >= 0
      && arc180.indexOf('补床弩拆器械特性') >= 0
      && arc180.indexOf('距离难道不是弓兵的生命线吗') >= 0);
  })();

"""
s = s.replace(anchor, sec + anchor)
write('smoke-test.js', s)
print('smoke OK')

# ============================================================
# 2. e2e §180（插在 v89.177 段之后、return finish() 之前）
# ============================================================
s = read('e2e-test.js')
anchor2 = """})();



  return finish();
}

let ABORTED = false;"""
assert s.count(anchor2) == 1, 'e2e anchor'
sec2 = """})();

/* ============================================================
 * §180（v89.180）拆械 / live 滚动保留（真 DOM 版）
 * ============================================================ */
console.log('\\n--- §180. 拆械与 live 滚动（v89.180） ---');
{
  G.ui.closeAllModals();
  const c180 = G.state.cities[0];
  let fIdx180 = -1;
  c180.cells.forEach(function (cc, i) {
    if (fIdx180 < 0 && cc.build && cc.build.id === 'gongjiangzuofang') fIdx180 = i;
  });
  if (fIdx180 < 0) {
    fIdx180 = c180.cells.findIndex(function (x) { return !x.build && !x.official; });
    if (fIdx180 >= 0) c180.cells[fIdx180] = { build: { id: 'gongjiangzuofang', lvl: 7 }, pending: null };
  }
  G.ui.openTroops(fIdx180, 'siege');
  await sleep(180);
  const card180 = document.querySelector('#modal-root .troop-card[data-troop="chuangnu"]');
  const tip180 = card180 ? card180.querySelector('.tcard-tip') : null;
  const txt180 = tip180 ? (tip180.textContent || '') : '';
  check('§180a 器械页床弩卡悬停含「拆械 对器械伤害 ×3」（真 DOM）',
    !!card180 && txt180.indexOf('拆械') >= 0 && txt180.indexOf('×3') >= 0, txt180.slice(0, 90));

  /* live 每秒重建：.panel-body 滚动位必须保留（v89.180 修复的 flaky 根因 ·
     快照/回填选择器原缺 panel-body —— 上一版靠"恰好时序"才绿） */
  const pb180 = document.querySelector('#modal-root .panel-body');
  if (pb180) pb180.scrollTop = 126;
  G.ui.liveModalTick();
  const pb180b = document.querySelector('#modal-root .panel-body');
  check('§180b live 重建后 .panel-body 滚动位保留 126（确定性：直调 liveModalTick）',
    !!pb180 && !!pb180b && pb180b.scrollTop === 126, pb180b ? String(pb180b.scrollTop) : 'null');
  G.ui.closeAllModals();
  await sleep(60);
}

  return finish();
}

let ABORTED = false;"""
s = s.replace(anchor2, sec2)
write('e2e-test.js', s)
print('e2e OK')
print('ALL DONE')
