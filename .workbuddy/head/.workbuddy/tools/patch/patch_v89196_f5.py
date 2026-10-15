# -*- coding: utf-8 -*-
"""v89.196 批次F5：e2e 适配与新增
F5a §194 收藏用例造局补"全解锁"（成就型闸）
F5b 新增 §196 e2e 段（藏珍阁三态 + 结束界面回看按钮）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- F5a §194 造局 ----------------
F5A_OLD = """    const buyBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');"""
F5A_NEW = """    /* v89.196（老板 7）：藏珍阁改成就型 —— 旧"直购"用例先拉满全部条件（解锁所有藏品），
       否则会被解锁闸正确拦下（本用例验的是"购买唯一出口"，不是成就闸本身）。
       ⚠️ gathers 键名与 statBump 一字不差（曾写 gather 致凉州系锁死）。 */
    G.state.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
      recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
    G.state.rep = Math.max(G.state.rep || 0, 99999);
    G.state.rank = Math.max(G.state.rank || 0, 9);
    (function () {
      const _lg = G.lordGeneralOf(); if (_lg) _lg.level = Math.max(_lg.level || 1, 300);
      (G.state.cities[0].cells || []).forEach(function (cell) {
        if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
      });
      (G.DATA.ITEMS || []).slice(0, 8).forEach(function (it) {
        G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
      });
    })();
    G.ui.renderCollect();
    await sleep(120);
    const buyBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');"""
rep('e2e-test.js', 'F5a §194 造局', F5A_OLD, F5A_NEW, 'gathers 键名与 statBump 一字不差')

# ---------------- F5b §196 e2e 段 ----------------
F5B_ANCHOR = "  return finish();\n}\n\nlet ABORTED = false;"
F5B_SEC = """  /* ============================================================
   * §196（v89.196）：藏珍阁三态（锁 → 解锁 → 激活按钮）+ 结束界面回看按钮
   * ============================================================ */
  console.log('\\n===== 196. v89.196（成就收藏三态 · 回看按钮） =====');
  {
    const _bkStats196 = G.state.stats, _bkRep196 = G.state.rep, _bkRank196 = G.state.rank,
      _bkCollect196 = G.state.collect;
    try {
      /* ① 清零条件（全锁）→ 打开收藏 → 有 .col-card.locked */
      G.state.stats = {}; G.state.rep = 0; G.state.rank = 0; G.state.collect = {};
      G.ui._colCat = 'all';
      G.ui.setView('collection');
      await sleep(140);
      const lockedN = document.querySelectorAll('#view-container .col-card.locked').length;
      check('§196 藏珍阁三态：未解锁卡片在册（.col-card.locked + 条件行）',
        lockedN >= 1, 'locked=' + lockedN);
      /* ② 拉满 → 重渲染 → 锁解除 + 「激活」按钮出现 */
      G.state.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
        recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
      G.state.rep = 99999; G.state.rank = 9;
      const _lg196 = G.lordGeneralOf(); if (_lg196) _lg196.level = 300;
      (G.state.cities[0].cells || []).forEach(function (cell) {
        if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
      });
      (G.DATA.ITEMS || []).slice(0, 8).forEach(function (it) {
        G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
      });
      G.ui.renderCollect();
      await sleep(140);
      const lockedN2 = document.querySelectorAll('#view-container .col-card.locked').length;
      const actBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');
      check('§196 解锁后：锁解除 + 「激活」按钮在册（成就型两段式）',
        lockedN2 === 0 && !!actBtn, 'locked2=' + lockedN2 + ' btn=' + !!actBtn);
    } finally {
      G.state.stats = _bkStats196; G.state.rep = _bkRep196; G.state.rank = _bkRank196;
      G.state.collect = _bkCollect196;
    }

    /* ③ 结束界面「🎬 回看全程」按钮（构造回执 → btShowEnd → DOM 断言） */
    let actsEl196 = document.getElementById('bt-acts');
    if (!actsEl196) { actsEl196 = document.createElement('div'); actsEl196.id = 'bt-acts'; document.body.appendChild(actsEl196); }
    if (!document.getElementById('bt-cd')) {
      const cde = document.createElement('div'); cde.id = 'bt-cd'; document.body.appendChild(cde);
    }
    const _bkJD196 = G._battleJustDone, _bkBT196 = G.ui._bt;
    G._battleJustDone = { id: 'e2e96', ok: true, winner: 'atk', rounds: 3,
      atkLoss: 1, defLoss: 2, report: { t: 1, title: 'x' } };
    G.ui._bt = { id: 'e2e96', lastRound: 3, playing: false, timer: null };
    try { G.ui.btShowEnd(G.ui._bt); } catch (e) { }
    check('§196 结束界面：「🎬 回看全程」按钮在册（结束回执带 report 时）',
      actsEl196.innerHTML.indexOf('bt-replay') >= 0 && actsEl196.innerHTML.indexOf('回看全程') >= 0,
      actsEl196.innerHTML.slice(0, 90));
    G._battleJustDone = _bkJD196; G.ui._bt = _bkBT196;
    try { actsEl196.innerHTML = ''; } catch (e) { }
  }

"""
s = rd('e2e-test.js')
if '§196（v89.196）：藏珍阁三态' in s:
    print('[skip] F5b §196 e2e 段')
else:
    c = s.count(F5B_ANCHOR)
    assert c == 1, 'F5b anchor=' + str(c)
    s = s.replace(F5B_ANCHOR, F5B_SEC + F5B_ANCHOR)
    wr('e2e-test.js', s)
    print('[ok] F5b §196 e2e 段')

print('批次F5 完成')
