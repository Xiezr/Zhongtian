# v89.177 补丁 E：断言 —— smoke §177（12 条）+ e2e §177（2 条）
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

SMOKE_SEC = r'''  (function () {
    console.log('  --- 177. v89.177 民心/民怨 · 措施 · 君主突破综合考验 ---');
    var fs177 = require('fs'), p177 = require('path');

    /* ① 民心公式（唯一出口） */
    console.log('  --- ① 民心公式（真调） ---');
    check('§177① ★ heartsBaseOf = 100−税率×100（0/30/50/75/100% → 100/70/50/25/0）', (function () {
      var bkTax = G.state.tax, out = [];
      [0, 0.3, 0.5, 0.75, 1].forEach(function (t) { G.state.tax = t; out.push(G.heartsBaseOf()); });
      G.state.tax = bkTax;
      return out.join(',') === '100,70,50,25,0';
    })());
    check('§177①b heartsOf = 基准+安抚 · minyuan = 100−民心 · applyHearts 写缓存', (function () {
      var bk = { tax: G.state.tax, c: G.state.heartsComfort, h: G.state.hearts };
      G.state.tax = 0.5; G.state.heartsComfort = 20;
      var h = G.heartsOf(), m = G.minyuanOf(), c = G.applyHearts();
      var r = h === 70 && m === 30 && c === 70 && G.state.hearts === 70;
      G.state.tax = bk.tax; G.state.heartsComfort = bk.c; G.state.hearts = bk.h;
      return r;
    })());
    check('§177①c 安抚钳制（上限 comfortCap · 下限 −100）', (function () {
      var bk = { tax: G.state.tax, c: G.state.heartsComfort };
      G.state.tax = 0.5;
      G.heartsComfortAdd(999); var hi = G.heartsComfortOf();
      G.heartsComfortAdd(-999); var lo = G.heartsComfortOf();
      G.state.tax = bk.tax; G.state.heartsComfort = bk.c; G.applyHearts();
      return hi === DATA.HEARTS.comfortCap && lo === -100;
    })());

    /* ② 措施（真调 · 每日一次 · 耗金币） */
    console.log('  --- ② 措施（真调） ---');
    check('§177② ★ doHeartsAction：扣金/加安抚/当日再调拒/跨日恢复', (function () {
      var bk = { gold: G.goldOf(), c: G.state.heartsComfort, days: G.state.heartsDays, tax: G.state.tax };
      try {
        G.state.tax = 0.5;
        G.state.heartsComfort = 0;
        G.state.heartsDays = {};
        G.goldAdd(100000);
        var g0 = G.goldOf();
        var r = G.doHeartsAction('boost');
        var r2 = G.doHeartsAction('boost');                 /* 当日再调 = 拒 */
        G.state.heartsDays.boost = null;                    /* 跨日（清当日记录）→ 可再调 */
        var r3 = G.doHeartsAction('boost');
        var r4 = G.doHeartsAction('soothe');
        return r.ok === true
          && (g0 - G.goldOf()) === (DATA.HEARTS.boost.cost * 2 + DATA.HEARTS.soothe.cost)
          && G.heartsComfortOf() === (DATA.HEARTS.boost.add * 2 + DATA.HEARTS.soothe.add)
          && r2.ok === false && /本日已行/.test(r2.msg)
          && r3.ok === true && r4.ok === true;
      } finally {
        G.goldAdd(bk.gold - G.goldOf());
        G.state.heartsComfort = bk.c;
        G.state.heartsDays = bk.days;
        G.state.tax = bk.tax;
        G.applyHearts();
      }
    })());
    check('§177②b 金不足 → 拒（提示黄金不足）', (function () {
      var bk = { gold: G.goldOf(), days: G.state.heartsDays };
      try {
        G.state.heartsDays = {};
        G.goldAdd(-G.goldOf());
        var r = G.doHeartsAction('soothe');
        return r.ok === false && /黄金不足/.test(r.msg);
      } finally {
        G.goldAdd(bk.gold - G.goldOf());
        G.state.heartsDays = bk.days;
      }
    })());

    /* ③ 安抚衰减（tick 真调） */
    console.log('  --- ③ 安抚衰减 ---');
    check('§177③ 安抚每游戏小时向 0 回落（1 tick = 120 游戏秒 → −1/60）', (function () {
      var bk = { c: G.state.heartsComfort, tax: G.state.tax };
      G.state.tax = 0.5;
      G.state.heartsComfort = 10;
      G.tickOnce();
      var c1 = G.state.heartsComfort;
      G.state.heartsComfort = bk.c; G.state.tax = bk.tax; G.applyHearts();
      return c1 < 10 && c1 > 9.9;
    })());

    /* ④ 调税即时重算 */
    console.log('  --- ④ 调税即时重算 ---');
    check('§177④ doSetTax(30) → 民心 70（安抚 0 时）', (function () {
      var bk = { tax: G.state.tax, c: G.state.heartsComfort };
      try {
        G.state.heartsComfort = 0;
        G.doSetTax(30);
        return G.heartsOf() === 70;
      } finally {
        G.doSetTax(Math.round(bk.tax * 100));
        G.state.heartsComfort = bk.c; G.applyHearts();
      }
    })());

    /* ⑤ 君主突破综合考验 */
    console.log('  --- ⑤ 综合考验 ---');
    check('§177⑤ ★ lordTrialOf：五关行（政务/城池/军队/资源/宝物）+ 口径读表', (function () {
      var lord = null;
      (G.state.generals || []).forEach(function (g) { if (g.isLord) lord = g; });
      if (!lord) { lord = G.makeGeneral('测试君主', 1, 'idle', G.state.cities[0].id, false); lord.isLord = true; }
      var tr = G.lordTrialOf(lord);
      var keys = tr.rows.map(function (r) { return r.key; }).join(',');
      var tbl = (DATA.LORD_BREAK.trials || [])[0];
      return tr.n === 1 && keys === 'quests,cities,army,gold,treasure'
        && tr.rows[0].goal === tbl.quests && tr.rows[4].goal === tbl.treasure
        && typeof tr.ok === 'boolean';
    })());
    check('§177⑤b 考验表在册（trials 三段 · 逐段递增）', (function () {
      var t = DATA.LORD_BREAK.trials;
      return Array.isArray(t) && t.length === 3
        && t[0].cities < t[1].cities && t[1].cities < t[2].cities
        && t[0].gold < t[1].gold && t[1].gold < t[2].gold;
    })());

    /* ⑥ 界面与接入（源码级） */
    console.log('  --- ⑥ 界面与接入（源码级） ---');
    (function () {
      var uS = fs177.readFileSync(p177.join(__dirname, 'js', 'ui.js'), 'utf8');
      var mS = fs177.readFileSync(p177.join(__dirname, 'js', 'main.js'), 'utf8');
      check('§177⑥ 官府段在册：heartsBox177 + 「民心 / 民怨」标题 + 两处拼接（施工/正常互斥）',
        uS.indexOf('heartsBox177') >= 0 && /民心 \/ 民怨/.test(uS)
        && uS.split('guanfuBox + heartsBox177 + queueBox174 +').length === 3);
      check('§177⑥b main.js：hearts-boost / hearts-soothe 动作 + doSetTax 重算',
        mS.indexOf("case 'hearts-boost'") >= 0 && mS.indexOf("case 'hearts-soothe'") >= 0
        && mS.indexOf('GAME.applyHearts()') >= 0);
      check('§177⑥c 君主面板考验清单在册（_trialHTML177 · 五关逐条）',
        uS.indexOf('_trialHTML177') >= 0 && uS.indexOf('突破考验（第') >= 0);
      check('§177⑥d HEARTS 表在册（安抚上限/衰减/两措施）',
        DATA.HEARTS.comfortCap === 50 && DATA.HEARTS.decayPerHour === 0.5
        && DATA.HEARTS.boost.cost === 2000 && DATA.HEARTS.soothe.cost === 6000);
    })();

    var arc177 = fs177.readFileSync(p177.join(__dirname, '需求档案.md'), 'utf8');
    check('§177⑦ 需求档案在册（v89.177 · 老板原文关键句逐字）',
      arc177.indexOf('v89.177') >= 0
      && arc177.indexOf('民心=100-税率*100') >= 0
      && arc177.indexOf('综合考验') >= 0);
  })();

'''

s = read('smoke-test.js')
anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
assert s.count(anchor) == 1
if '§177①' not in s:
    s = s.replace(anchor, SMOKE_SEC + anchor)
    write('smoke-test.js', s)
    print('[ok] E1 smoke §177')
else:
    print('[skip] E1')

E2E_SEC = r'''/* ============================================================
 * v89.177（民心/民怨 · 君主突破考验）：真 DOM 版
 * ============================================================ */
(function () {
  check('v89.177 官府弹窗「民心 / 民怨」段（值 + 两措施按钮 · 真 DOM）', (function () {
    G.ui.closeAllModals();
    const c = G.state.cities[0];
    let gIdx = -1;
    c.cells.forEach(function (cc, i) { if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i; });
    if (gIdx < 0) return false;
    G.ui.openBuildModal(gIdx);
    const txt = document.querySelector('#modal-root').textContent || '';
    const b1 = document.querySelector('#modal-root [data-action="hearts-boost"]');
    const b2 = document.querySelector('#modal-root [data-action="hearts-soothe"]');
    G.ui.closeAllModals();
    return txt.indexOf('民心 / 民怨') >= 0 && txt.indexOf('鼓舞民心') >= 0
      && txt.indexOf('消减民怨') >= 0 && !!b1 && !!b2;
  })());
  check('v89.177 君主面板「突破考验」五关清单（真 DOM · 打开君主面板）', (function () {
    G.ui.closeAllModals();
    if (!G.lordGeneralOf || !G.lordGeneralOf()) return 'SKIP-无条件';
    G.ui.openLordInfo();
    const txt = document.querySelector('#modal-root').textContent || '';
    G.ui.closeAllModals();
    return txt.indexOf('突破考验') >= 0 && txt.indexOf('宝物（珠宝）') >= 0;
  })());
})();

'''

e = read('e2e-test.js')
anchor2 = "let ABORTED = false;\nfunction finish() {"
assert e.count(anchor2) == 1
if 'v89.177 官府弹窗' not in e:
    e = e.replace(anchor2, E2E_SEC + anchor2)
    write('e2e-test.js', e)
    print('[ok] E2 e2e §177')
else:
    print('[skip] E2')
print('DONE-E177')
