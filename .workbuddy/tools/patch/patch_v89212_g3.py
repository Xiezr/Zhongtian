# -*- coding: utf-8 -*-
# v89.212：§212 新段（smoke）+ §212e 新段（e2e）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

SM = 'E:/Deepseekdb/smoke-test.js'
E2 = 'E:/Deepseekdb/e2e-test.js'

# ---------------- G10: smoke §212 段 ----------------
smoke_new = """  /* ============================================================
   * §212（v89.212 · 老板 1/2）：城外堆场**按资源分账**（地块多的存的多）+ 出征行序（老板令）
   * ============================================================ */
  console.log('  --- §212 堆场按资源分账 + 出征行序 ---');
  (function () {
    var fs212 = require('fs'), p212 = require('path');
    var dS212 = fs212.readFileSync(p212.join(__dirname, 'js/domain.js'), 'utf8');
    var sS212 = fs212.readFileSync(p212.join(__dirname, 'js/state.js'), 'utf8');
    var uS212 = fs212.readFileSync(p212.join(__dirname, 'js/ui.js'), 'utf8');

    /* ① 出口组（源码级） */
    check('§212① 出口组：extStoreCapByResOf（底账）+ extStoreCapOf(city,key) + storeCapOf 带 key + 分账字段', (function () {
      var by212 = codeOf(dS212, 'GAME.extStoreCapByResOf = function');
      var sc212 = codeOf(dS212, 'GAME.storeCapOf = function');
      var sp212 = codeOf(dS212, 'GAME.storePartsOf = function');
      return /EXT_BUILDINGS\\[e\\.type\\]/.test(by212)
        && /by\\[k\\] = Math\\.round/.test(by212)
        && /return by\\[key\\] \\|\\| 0/.test(by212)
        && /sp\\.capByRes\\[key\\]/.test(sc212)
        && /extByRes: extByRes, capByRes: capByRes/.test(sp212);
    })());

    /* ② 消费点全带 key（源码级 · state 三处循环 + 入账/逾溢/运输） */
    check('§212② 按资源消费点：state 三处循环（每城 capByRes）+ 入账 / 逾溢 / 运输', (function () {
      var nCaps = (sS212.match(/var caps = GAME\\.storePartsOf\\(ct\\)\\.capByRes \\|\\| \\{\\};/g) || []).length;
      return nCaps === 3
        && /storeCapOf\\(ct, key\\);/.test(dS212)
        && /storeCapOf\\(ct, k\\)/.test(codeOf(dS212, 'GAME.overflowRotOf = function'))
        && /storeCapOf\\(to, key\\)/.test(dS212);
    })());

    /* ③ 行为：地块多存得多（交叉对照） */
    check('§212③ 行为：地块多存得多（A 粮 > B 粮 · B 木 > A 木 · 期望值锚定）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 's212a', mapSeed: 212 });
        G.state = st;
        var mk = function (id, exts) {
          var c = G.makeCity({ id: id, name: id, col: 6, row: 6 });
          st.cities.push(c);
          var g = G.extGridOf(c);
          g.length = 0;
          exts.forEach(function (t, i) { g.push({ id: 'x' + i, type: t, lv: 1 }); });
          return c;
        };
        var A = mk('s212a1', ['farm', 'farm', 'farm', 'farm', 'forest']);
        var B = mk('s212a2', ['farm', 'forest', 'forest', 'forest', 'forest']);
        var BS = DATA.BASE_STORE, DV = DATA.EXT_STORE_DIV;
        return G.storeCapOf(A, 'grain') > G.storeCapOf(B, 'grain')
          && G.storeCapOf(B, 'wood') > G.storeCapOf(A, 'wood')
          && G.storeCapOf(A, 'grain') === BS + Math.round(4 * BS / DV)
          && G.storeCapOf(A, 'wood') === BS + Math.round(1 * BS / DV)
          && G.storeCapOf(A, 'stone') === BS;   /* 无石场 → 只有基础（堆场不摊到别类） */
      } finally { G.state = keep; }
    })());

    /* ④ 行为：按资源封顶（tickOnce 实跑） */
    check('§212④ 行为：按资源封顶（粮超自身上限不涨 · 木低于自身上限正常增长）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 's212b', mapSeed: 212 });
        G.state = st;
        var c = G.makeCity({ id: 's212c1', name: 'c', col: 6, row: 6 });
        st.cities.push(c);
        var g = G.extGridOf(c);
        g.length = 0;
        g.push({ id: 'x1', type: 'farm', lv: 6 }, { id: 'x2', type: 'forest', lv: 12 });
        var R = G.res(c);
        R.grain = 4500000; R.wood = 5000000;
        var g0 = R.grain, w0 = R.wood;
        for (var t = 0; t < 60; t++) G.tickOnce();
        return (R.grain - g0) <= 2 && (R.wood - w0) > 0
          && G.storeCapOf(c, 'grain') === 2000000 + Math.round(6 * 2000000 / 6)
          && G.storeCapOf(c, 'wood') === 2000000 + Math.round(12 * 2000000 / 6);
      } finally { G.state = keep; }
    })());

    /* ⑤ 账目自洽（base + extByRes[k] === capByRes[k] · 合计 = Σ分账） */
    check('§212⑤ 账目自洽：base + extByRes[k] === capByRes[k] · ext === ΣextByRes', (function () {
      var sp = G.storePartsOf(G.currentCity());
      var ok = true;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
        if (sp.base + sp.extByRes[k] !== sp.capByRes[k]) ok = false;
      });
      var sum = ['grain', 'wood', 'stone', 'iron'].reduce(function (t, k) { return t + sp.extByRes[k]; }, 0);
      return ok && sp.ext === sum && G.storeCapOf(G.currentCity()) === sp.total;
    })());

    /* ⑥ 出征行序（老板令） */
    check('§212⑥ 出征行序 = 老板令（计略移至出征战术之后 · 源码顺序）', (function () {
      var i0 = uS212.indexOf('ui.openExpModal = function');
      var exp = i0 < 0 ? '' : uS212.slice(i0, uS212.indexOf('\\n  ui.', i0 + 30));
      var seq = ['exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic', 'exp-a-items'];
      var last = -1, ok = true;
      seq.forEach(function (k) { var p = exp.indexOf(k); if (p < 0 || p < last) ok = false; last = p; });
      return ok && exp.indexOf('exp-a-tactic') > exp.indexOf('exp-a-tacmenu');
    })());

    /* ⑦ 需求档案在册（老板原文关键句逐字） */
    check('§212⑦ 需求档案在册（v89.212 · 老板原文关键句逐字）', (function () {
      var md = fs212.readFileSync(p212.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.212') >= 0
        && md.indexOf('城外资源建筑并未提供准确储存上限') >= 0
        && md.indexOf('应该是地块多的存的多吧') >= 0
        && md.indexOf('目标，主将，出征方式，出征方案，出征战术，出征计略，可用道具') >= 0;
    })());
  })();

"""

rep(SM, 'G10 smoke §212 段',
    "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    "  })();\n\n" + smoke_new + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    '§212① 出口组')

# ---------------- G11: e2e §212e 段 ----------------
e2e_new = """
  /* ============================================================
   * §212e（v89.212 · 老板 1）：堆场按资源分账（真 DOM）——
   * 仓库面板四行各显各的上限 / 城外面板「另加<资源>上限」
   * ============================================================ */
  try {
    const c212e = G.currentCity() || G.state.cities[0];
    const g212e = G.extGridOf(c212e);
    const bk212e = JSON.stringify(g212e);
    try {
      g212e.length = 0;
      g212e.push({ id: 'x1', type: 'farm', lv: 2 }, { id: 'x2', type: 'forest', lv: 1 },
        { id: 'x3', type: 'quarry', lv: 1 }, { id: 'x4', type: 'mine', lv: 1 });
      /* ① 仓库面板：四行资源各显各的上限（粮 2 块 > 木/石/铁 各 1 块） */
      G.ui.openStore();
      await sleep(320);
      const caps212e = Array.from(document.querySelectorAll('#modal-root .store-row .cap')).map((el) => el.textContent);
      check('§212e① 仓库面板：四行资源各显各的上限（粮 ≠ 木 = 石 = 铁）', caps212e.length === 4
        && !!caps212e[0] && !!caps212e[1] && caps212e[0] !== caps212e[1]
        && caps212e[1] === caps212e[2] && caps212e[2] === caps212e[3],
        JSON.stringify(caps212e));
      G.ui.closeAllModals();
      await sleep(120);
      /* ② 城外面板：标签按归属资源（idx1 = forest → 「另加木材上限」） */
      G.ui.openExtModal(1);
      await sleep(320);
      const extTxt212e = (document.getElementById('modal-root') || document.body).textContent || '';
      check('§212e② 城外面板：forest 块标「另加木材上限」（按归属资源）',
        extTxt212e.indexOf('另加木材上限') >= 0, extTxt212e.slice(0, 90));
      G.ui.closeAllModals();
      await sleep(120);
    } finally {
      const back212e = JSON.parse(bk212e);
      g212e.length = 0;
      back212e.forEach((e) => g212e.push(e));
    }
  } catch (e212e) {
    check('§212e 段异常', false, String(e212e && e212e.message || e212e));
  }

  return finish();"""

rep(E2, 'G11 e2e §212e 段',
    "\n  return finish();",
    e2e_new,
    '§212e① 仓库面板')

print('--- G10-G11 完成 ---')
