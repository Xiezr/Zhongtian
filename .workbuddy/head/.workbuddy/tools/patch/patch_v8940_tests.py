# -*- coding: utf-8 -*-
"""v89.40 补丁 2/3：测试层
smoke：批量加点单元断言 / 批量结构断言 / 君主守卫源码断言 / 君主战败运行时断言 / 君主档案与浮层断言
e2e：真实 DOM —— 一次加 10 点全链 + 君主档案无忠诚行
"""
import io, os, sys

R = r'E:\Deepseekdb'
SM = R + r'\smoke-test.js'
E2 = R + r'\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8940'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ========== smoke ① 批量加点单元断言 ==========
A1 = r"""    var r4 = G.addFreePoint(g2, 'tong');   /* 第 4 次：点已用完，拒绝 */
    return r1.ok && r2.ok && r3.ok && !r4.ok && g2.tong === 43 && g2.freePts === 0;
  })());"""
edit(SM, A1, A1 + r"""
  check('⑤ v89.40：一次加点 —— 批量扣除 / 超余额按余额截断', (function () {
    var g4 = G.makeGeneral('加点丙', 1, 'idle', cid74, false, 'liang', 'balance');
    g4.freePts = 8; g4.tong = 40;
    var rb = G.addFreePoint(g4, 'tong', 5);        /* 一次 5 点 */
    var ok1 = rb.ok && g4.tong === 45 && g4.freePts === 3;
    var rc = G.addFreePoint(g4, 'tong', 99);       /* 要 99、只剩 3 → 按余额实加 3 */
    var ok2 = rc.ok && g4.tong === 48 && g4.freePts === 0;
    var rEnd = G.addFreePoint(g4, 'tong', 1);      /* 点已尽 → 拒绝 */
    return ok1 && ok2 && !rEnd.ok;
  })());""", 'smoke · 批量加点单元断言')

# ========== smoke ② 批量加点结构断言 ==========
A2 = r"""  check('④⑤ 加点弹窗：自由点 + 道具双入口、检查上限与库存', (function () {
    return /ui\.openStatPlus = function/.test(uS) && /data-action="stat-plus-free"/.test(uS)
      && /data-action="stat-plus-item"/.test(uS) && /case 'stat-plus-free'/.test(mS)
      && /case 'stat-plus-item'/.test(mS) && /GAME\.doStatPlusFree = function/.test(mS);
  })());"""
edit(SM, A2, A2 + r"""
  check('④⑤ v89.40：一次加点结构（数量框 + qty 透传）', (function () {
    return /qtyInput\('fp-add-' \+ genId/.test(uS)
      && /data-qty-from="fp-add-'/.test(uS)
      && /GAME\.doStatPlusFree = function \(genId, stat, qty\)/.test(mS)
      && /stat-plus-free':[\s\S]{0,160}qtyValueOf\(el\.dataset\.qtyFrom\)/.test(mS);
  })());""", 'smoke · 批量加点结构断言')

# ========== smoke ③ 君主守卫源码断言 ==========
A3 = r"""  check('战败才扣忠诚（battle 已接入）', /defeatLoss/.test(battleSrc26) && /忠诚 -/.test(battleSrc26));"""
edit(SM, A3, A3 + r"""
  check('v89.40：君主豁免战败扣忠（守卫已接入）', /isLordGeneral\(gen\)/.test(battleSrc26));""",
     'smoke · 君主守卫源码断言')

# ========== smoke ④ 君主战败运行时断言 ==========
A4 = r"""    gGu.loyalty = 30;   // 守将忠诚低于 warnAt(50)"""
edit(SM, A4, r"""    /* v89.40（老板）：「君主不会掉忠诚」—— 同一构造的必败之战：
       君主忠诚不动，普通将领照扣（守卫只豁免君主，不是把机制关掉）。 */
    (function () {
      var s40 = G.state, lord40 = G.lordGeneralOf(), gN40 = null;
      (s40.generals || []).forEach(function (x) { if (!gN40 && !G.isLordGeneral(x)) gN40 = x; });
      if (!lord40 || !gN40) { check('v89.40：君主战败不掉忠（缺对象，跳过）', true); return; }
      var c40 = GAME.currentCity() || s40.cities[0];
      var bkArmy40 = JSON.stringify(c40.army || {});
      c40.army = c40.army || {};
      c40.army.yibing = Math.max(c40.army.yibing || 0, 200);
      s40.res.gold += 1e6;
      var mkTgt = function (n) {
        return { id: 'nt' + n, name: '测试坚城' + n, x: 1, y: 1, garrison: { tieji: 900000 }, def: 999, type: 'jun' };
      };
      lord40.loyalty = 80; lord40.stamina = 100; lord40.energy = 100;
      var rtL = G.battle.attackCity(mkTgt(1), { yibing: 50 }, lord40.id);
      var lOK = !!(rtL && rtL.ok && rtL.result && rtL.result.winner === 'def')
        && Math.abs(lord40.loyalty - 80) < 1e-9;
      gN40.loyalty = 80; gN40.stamina = 100; gN40.energy = 100;
      var rtN = G.battle.attackCity(mkTgt(2), { yibing: 50 }, gN40.id);
      var nOK = !!(rtN && rtN.ok && rtN.result && rtN.result.winner === 'def') && gN40.loyalty < 80;
      gN40.loyalty = 90;
      c40.army = JSON.parse(bkArmy40);            /* 复原军力，不打乱后续用例 */
      check('v89.40：君主战败不掉忠（对照：普通将领仍照扣）', lOK && nOK,
        '君主 ' + lord40.loyalty + ' · 普通 ' + gN40.loyalty);
    })();
    gGu.loyalty = 30;   // 守将忠诚低于 warnAt(50)""", 'smoke · 君主战败运行时断言')

# ========== smoke ⑤ 君主档案与浮层断言 ==========
A5 = r"""  check('无选中将领时给出占位提示', (function () {"""
edit(SM, A5, r"""  /* v89.40（老板）：「君主既然不会掉忠诚」—— 详情/悬停对君主整体不出忠诚行；普通将领照旧 */
  check('v89.40：君主档案不出忠诚行与赏赐（普通将领照旧）', (function () {
    var st = G.state, lg = G.lordGeneralOf(), gN = null;     /* 沿用上方「详情」局 */
    (st.generals || []).forEach(function (x) { if (!gN && !G.isLordGeneral(x)) gN = x; });
    if (!lg || !gN) return false;
    var hL = G.ui.genPane(lg), hN = G.ui.genPane(gN);
    return hL.indexOf('gd-line">忠诚') < 0 && hL.indexOf('gen-gift-pick') < 0
      && hN.indexOf('gd-line">忠诚') >= 0 && hN.indexOf('gen-gift-pick') >= 0;
  })());
  check('v89.40：君主悬停浮层不带忠诚（普通将领照旧）', (function () {
    var st = G.state, lg = G.lordGeneralOf(), gN = null;
    (st.generals || []).forEach(function (x) { if (!gN && !G.isLordGeneral(x)) gN = x; });
    if (!lg || !gN) return false;
    var tL = G.ui.genRow(lg, 0, 12, null), tN = G.ui.genRow(gN, 0, 12, null);
    return tL.indexOf('忠诚') < 0 && tN.indexOf('忠诚') >= 0;
  })());
  check('无选中将领时给出占位提示', (function () {""", 'smoke · 君主档案与浮层断言')

# ========== e2e：真实 DOM 一次加点 + 君主档案 ==========
E1 = r"""  /* ② 募兵：初始就能点「训练」（原为「参数错误」） */"""
edit(E2, E1, r"""  /* ①.5 v89.40：一次加点（数量框批量）+ 君主不出忠诚行（真实 DOM） */
  await (async function () {
    const gid40 = s.generals[0].id;
    const fp0 = s.generals[0].freePts || 0;
    const tong0 = s.generals[0].tong;
    s.generals[0].freePts = fp0 + 15;
    G.ui._genSel = gid40;
    G.ui.setView('generals');
    await sleep(60);
    const plus40 = document.querySelector('#view-container .gd-dims [data-action="gen-stat-plus"][data-stat="tong"]');
    check('加点入口在位（六维·统率 ＋）', !!plus40);
    if (plus40) { plus40.click(); await sleep(80); }
    const inp40 = plus40 ? document.getElementById('fp-add-' + gid40) : null;
    const apply40 = plus40 ? document.querySelector('#modal-root [data-action="stat-plus-free"]') : null;
    check('加点弹窗含数量输入框（一次加点）', !!inp40);
    check('加点按钮带 qty 透传（data-qty-from）',
      !!apply40 && apply40.getAttribute('data-qty-from') === ('fp-add-' + gid40));
    let applied40 = false;
    if (inp40 && apply40) {
      inp40.value = '10';
      apply40.click();
      await sleep(100);
      applied40 = Math.abs(s.generals[0].freePts - 5) < 1e-9
        && Math.abs(s.generals[0].tong - (tong0 + 10)) < 1e-9;
    }
    check('一次加 10 点：自由点 -10、属性 +10', applied40,
      'freePts=' + s.generals[0].freePts + ' Δ统=' + (s.generals[0].tong - tong0));
    const close40 = document.querySelector('#modal-root [data-action="close-modal"]');
    if (close40) { close40.click(); await sleep(60); }
    /* 君主：右侧档案不出忠诚行与赏赐；切回普通将领照旧 */
    const lord40 = G.lordGeneralOf();
    if (lord40) {
      G.ui._genSel = lord40.id;
      G.ui.setView('generals');
      await sleep(80);
      const paneL40 = document.querySelector('#view-container .gen-pane');
      const dhL40 = paneL40 ? paneL40.innerHTML : '';
      check('v89.40：君主档案不出忠诚行与赏赐',
        dhL40.length > 200 && dhL40.indexOf('gd-line">忠诚') < 0 && dhL40.indexOf('gen-gift-pick') < 0);
    } else {
      check('v89.40：君主档案不出忠诚行与赏赐（无君主，跳过）', true);
    }
    G.ui._genSel = gid40;
    G.ui.setView('generals');
    await sleep(60);
    const paneN40 = document.querySelector('#view-container .gen-pane');
    check('v89.40：普通将领档案仍有忠诚行与赏赐',
      !!paneN40 && paneN40.innerHTML.indexOf('gd-line">忠诚') >= 0 && paneN40.innerHTML.indexOf('gen-gift-pick') >= 0);
    /* 复原：点数与统率回滚，不打乱后续用例 */
    s.generals[0].freePts = fp0;
    s.generals[0].tong = tong0;
  })();

  /* ② 募兵：初始就能点「训练」（原为「参数错误」） */""", 'e2e · v89.40 真实 DOM 用例')

print('\nALL DONE（6 处）')
