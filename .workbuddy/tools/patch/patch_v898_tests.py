# -*- coding: utf-8 -*-
"""
v89.8 测试补丁：smoke §81 / e2e §81 升级到 v2 结构（段数 5~7 · 壁画 · 段进度）
"""
import io
import sys

ROOT = r'E:\Deepseekdb'
FAILS = []


def read(p):
    return io.open(ROOT + '\\' + p, encoding='utf-8', newline='').read()


def write(p, s):
    io.open(ROOT + '\\' + p, 'w', encoding='utf-8', newline='').write(s)


def apply(path, old, new, tag):
    src = read(path)
    n = src.count(old)
    if n != 1:
        FAILS.append('[%s] 锚点命中 %d 次' % (tag, n))
        return
    write(path, src.replace(old, new, 1))
    if new not in read(path):
        FAILS.append('[%s] 落盘回查失败' % tag)
        return
    print('OK  ' + tag)


# ============================================================
# smoke §81
# ============================================================
apply('smoke-test.js',
'''  var SG_KINDS = { building: 1, ext: 1, wild: 1, city: 1, misc: 1 };
''',
'''  var SG_KINDS = { building: 1, ext: 1, wild: 1, city: 1, misc: 1 };
  var SG_MURALS = ['yat', 'ku', 'zhai', 'yuan', 'jiu', 'xiang', 'hu', 'hud', 'shan', 'ying', 'men', 'fu', 'xiao'];
  var sgStrip = function (s) { return String(s || '').replace(/\\s+/g, ''); };
''', 'smoke · SG_MURALS 常量')

apply('smoke-test.js',
'''  check('故事库：数据齐（≥5 篇 · id 唯一 · 锚点合法 · 幕/结局/字数达标）', (function () {
    var all = GAME.SG.list();
    if (all.length < 5) return false;
    var ids = {}, ok = true;
    all.forEach(function (st) {
      if (ids[st.id]) ok = false;
      ids[st.id] = 1;
      if (!SG_KINDS[(st.anchor || {}).kind]) ok = false;
      if ((st.nodes || []).length < 3) ok = false;
      if ((st.endings || []).length < 3) ok = false;
      var n = 0;
      (st.nodes || []).forEach(function (x) { n += String(x.t || '').length; });
      (st.endings || []).forEach(function (x) { n += String(x.t || '').length; });
      if (n < 1000) ok = false;
    });
    return ok;
  })());
''',
'''  /* v2：段数 5~7 且全路径同层（幕的选项只能指向下一层；结局只能由最深层指向） */
  check('故事库：数据齐（≥5 篇 · 段数 5~7 全路径同层 · bg 白名单 · 字数达标）', (function () {
    var all = GAME.SG.list();
    if (all.length < 5) return false;
    var ids = {}, ok = true;
    all.forEach(function (st) {
      if (ids[st.id]) ok = false;
      ids[st.id] = 1;
      if (!SG_KINDS[(st.anchor || {}).kind]) ok = false;
      var nodes = st.nodes || [], ends = st.endings || [];
      if (ends.length < 3) ok = false;
      var idx = {}, depth = {}, q = [];
      nodes.forEach(function (n) { idx[n.id] = n; });
      if (!nodes.length) { ok = false; return; }
      depth[nodes[0].id] = 1; q.push(nodes[0].id);
      while (q.length) {
        var cur = q.shift();
        ((idx[cur] || {}).o || []).forEach(function (op) {
          if (idx[op.to] && depth[op.to] == null) { depth[op.to] = depth[cur] + 1; q.push(op.to); }
        });
      }
      var ranks = 0;
      for (var k in depth) if (depth[k] > ranks) ranks = depth[k];
      if (ranks < 5 || ranks > 7) ok = false;
      nodes.forEach(function (n) {
        if (SG_MURALS.indexOf(n.bg) < 0) ok = false;
        (n.o || []).forEach(function (op) {
          if (idx[op.to]) { if (depth[op.to] !== depth[n.id] + 1) ok = false; }
          else if (depth[n.id] !== ranks) ok = false;
        });
      });
      ends.forEach(function (x) { if (SG_MURALS.indexOf(x.bg) < 0) ok = false; });
      var n = 0;
      nodes.forEach(function (x) { n += sgStrip(x.t).length; });
      ends.forEach(function (x) { n += sgStrip(x.t).length; });
      if (n < 2400) ok = false;
    });
    return ok;
  })());

  check('故事库：壁画库齐备（ui.SG_MURAL 13 键 ⊇ 数据全部 bg）', (function () {
    var M = GAME.ui.SG_MURAL || {};
    var cnt = 0; for (var k in M) cnt++;
    var used = {}, ok = true;
    GAME.SG.list().forEach(function (st) {
      (st.nodes || []).forEach(function (n) { used[n.bg] = 1; });
      (st.endings || []).forEach(function (x) { used[x.bg] = 1; });
    });
    for (var u in used) if (!M[u]) ok = false;
    return cnt === 13 && ok;
  })());
''', 'smoke · 数据齐 + 壁画库')

apply('smoke-test.js',
'''  /* 官府篇正路：n1 查账 → n2 封仓 → n3 留路 = e2（partial） */
  check('故事库：开卷 → 推进 → 结局（3 步落 e2 · 账目非空 · 结局后拒绝再选）', (function () {
    var r = GAME.SG.begin('bld-guanfu-01');
    if (!r.ok) return false;
    var a = GAME.SG.choose(0), b = GAME.SG.choose(0), c = GAME.SG.choose(1);
    if (!(a.ok && b.ok && c.ok)) return false;
    if (c.run.phase !== 'end' || !c.run.ending || c.run.ending.id !== 'e2') return false;
    if (!(c.run.got && c.run.got.got && c.run.got.got.length)) return false;
    return GAME.SG.choose(0).ok === false;
  })());
''',
'''  /* 官府篇正路（v2）：一路选第 1 项走满 6 段 → 结局；段数 = rankCount */
  check('故事库：开卷 → 推进 → 结局（6 段走满 · 账目非空 · 结局后拒绝再选）', (function () {
    var r = GAME.SG.begin('bld-guanfu-01');
    if (!r.ok) return false;
    var ranks = GAME.SG.rankCount(GAME.SG.one('bld-guanfu-01'));
    var guard = 0;
    while (GAME.SG._run.phase === 'node' && guard++ < 20) GAME.SG.choose(0);
    var run = GAME.SG._run;
    if (run.phase !== 'end' || !run.ending) return false;
    if (ranks !== 6 || run.path.length !== ranks) return false;
    if (!(run.got && run.got.got)) return false;
    return GAME.SG.choose(0).ok === false;
  })());
''', 'smoke · 开卷推进')

apply('smoke-test.js',
'''  /* 官府篇另一路：n1 夜访 → n3 揭破 = e1（win）—— 重读换结局 */
  check('故事库：入档进度（新结局记首次 · 同结局重读 → 首次标记为假）', (function () {
    var rec0 = GAME.SG.progress()['bld-guanfu-01'];
    if (!rec0 || (rec0.done || []).indexOf('e2') < 0) return false;
    var n0 = rec0.n || 0;
    GAME.SG.begin('bld-guanfu-01');
    GAME.SG.choose(1);
    var c = GAME.SG.choose(0);
    if (!c.ok || c.run.phase !== 'end' || c.run.ending.id !== 'e1') return false;
    var rec1 = GAME.SG.progress()['bld-guanfu-01'];
    if (!(c.run.got.first === true && (rec1.n || 0) === n0 + 1 && rec1.done.length >= 2)) return false;
    GAME.SG.begin('bld-guanfu-01');
    GAME.SG.choose(1);
    var c2 = GAME.SG.choose(1);                        /* 再走一遍 → e2（已读过） */
    var rec2 = GAME.SG.progress()['bld-guanfu-01'];
    return c2.ok && c2.run.ending.id === 'e2' && c2.run.got.first === false && (rec2.n || 0) === n0 + 2;
  })());
''',
'''  /* 换结局（v2）：同一条路走到末段，改选第 2 项 → 落到不同结局；重读 → 首次标记为假 */
  check('故事库：入档进度（段末改选换结局 · 新结局记首次 · 同结局重读 → 首次标记为假）', (function () {
    var rec0 = GAME.SG.progress()['bld-guanfu-01'] || { n: 0, done: [] };
    var n0 = rec0.n || 0;
    var ranks = GAME.SG.rankCount(GAME.SG.one('bld-guanfu-01'));
    var walk = function (lastPick) {
      GAME.SG.begin('bld-guanfu-01');
      var guard = 0;
      while (GAME.SG._run.phase === 'node' && guard++ < 20) {
        var last = (GAME.SG._run.path.length + 1) === ranks;
        GAME.SG.choose(last ? lastPick : 0);
      }
      return GAME.SG._run;
    };
    var run1 = walk(1);                                 /* 末段第 2 项 → e2（首次读到） */
    if (!(run1.phase === 'end' && run1.ending && run1.ending.id === 'e2' && run1.got.first === true)) return false;
    var run2 = walk(1);                                 /* 再走一遍 → 同结局，首次为假 */
    if (!(run2.phase === 'end' && run2.ending.id === 'e2' && run2.got.first === false)) return false;
    var rec1 = GAME.SG.progress()['bld-guanfu-01'];
    return (rec1.n || 0) === n0 + 2 && (rec1.done || []).length >= 2;
  })());
''', 'smoke · 入档进度')

apply('smoke-test.js',
'''  /* 客栈篇败局：n1 静观 → n3 喝止 = e3（lose · 声望 −20）→ 不得为负 */
  check('故事库：负赏赐不越界（声望扣至 0 即止）', (function () {
    var keep = GAME.state.rep;
    GAME.state.rep = 10;
    GAME.SG.begin('bld-kezhan-01');
    GAME.SG.choose(1);
    var c = GAME.SG.choose(2);
    var repOk = (GAME.state.rep === 0);
    GAME.state.rep = keep;
    return c.ok && c.run.ending.id === 'e3' && c.run.ending.grade === 'lose' && repOk;
  })());
''',
'''  /* 客栈篇败局（v2）：在数据里找到负声望结局，按可达性搜一条路走过去 → 声望扣至 0 即止 */
  check('故事库：负赏赐不越界（声望扣至 0 即止）', (function () {
    var st = GAME.SG.one('bld-kezhan-01');
    var target = null;
    (st.endings || []).forEach(function (x) { if (!target && (x.reward || {}).rep < 0) target = x.id; });
    if (!target) return false;
    var canReach = function (from) {
      var seen = {}, q = [from];
      while (q.length) {
        var cur = q.shift();
        if (cur === target) return true;
        if (seen[cur]) continue;
        seen[cur] = 1;
        var node = null;
        (st.nodes || []).forEach(function (n) { if (n.id === cur) node = n; });
        if (!node) continue;
        (node.o || []).forEach(function (op) { q.push(op.to); });
      }
      return false;
    };
    var keep = GAME.state.rep;
    GAME.state.rep = 10;
    GAME.SG.begin('bld-kezhan-01');
    var guard = 0;
    while (GAME.SG._run.phase === 'node' && guard++ < 20) {
      var node = GAME.SG.nodeOf(GAME.SG._run, GAME.SG._run.nodeId);
      var pick = -1;
      for (var i = 0; i < (node.o || []).length; i++) {
        if (canReach(node.o[i].to)) { pick = i; break; }
      }
      if (pick < 0) break;
      GAME.SG.choose(pick);
    }
    var ok = GAME.SG._run.phase === 'end' && GAME.SG._run.ending.id === target
      && GAME.SG._run.ending.grade === 'lose' && GAME.state.rep === 0;
    GAME.state.rep = keep;
    return ok;
  })());
''', 'smoke · 负赏赐')

apply('smoke-test.js',
'''    var okSettle = GAME.SG.settle.toString().indexOf('applyReward') >= 0;
    return okMain && okEntry && okSettle;
  })());
})();
''',
'''    var okSettle = GAME.SG.settle.toString().indexOf('applyReward') >= 0;
    return okMain && okEntry && okSettle;
  })());

  /* v89.8：壁画与段进度接线（两层骨架 · 交叉淡入 · 段进度点 · rankCount 出口） */
  check('故事库：壁画与段进度接线（两层 .sgr-bg · sgBg 交叉淡入 · 段进度点 · rankCount）', (function () {
    var okRender = ('' + GAME.ui.sgRender).indexOf('sgr-bg') >= 0
      && ('' + GAME.ui.sgRender).indexOf('sgr-scrim') >= 0;
    var okBg = /delete cur\\.dataset\\.on/.test('' + GAME.ui.sgBg)
      && /dataset\\.on = '1'/.test('' + GAME.ui.sgBg);
    var okProg = ('' + GAME.ui.sgHTML).indexOf('sgr-dots') >= 0
      && ('' + GAME.ui.sgHTML).indexOf('共 ') >= 0;
    var okRank = typeof GAME.SG.rankCount === 'function'
      && GAME.SG.rankCount(GAME.SG.one('wild-hill-01')) === 7;
    return okRender && okBg && okProg && okRank;
  })());
})();
''', 'smoke · 壁画接线')

# ============================================================
# e2e §81
# ============================================================
apply('e2e-test.js',
"""  console.log('--- 81. 文字游戏 · 故事库（真实点击） ---');""",
"""  console.log('--- 81. 文字游戏 · 故事库（真实点击 · v2 结构） ---');""",
'e2e · 标题')

apply('e2e-test.js',
"""    var fx = document.querySelector('#story-fx');
    check('★ 全屏阅读器打开（第 1 幕 · 选项≥2 · 正文非空）', !!fx
      && fx.textContent.indexOf('第 1 幕') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);
    var guard = 0;
    while (guard++ < 8) {
      var pk = fx.querySelector('[data-action="story-pick"]');
      if (!pk) break;
      click(pk);
      await sleep(25);
    }
""",
"""    var fx = document.querySelector('#story-fx');
    var bgLayers = fx ? fx.querySelectorAll('.sgr-bg') : [];
    check('★ 全屏阅读器打开（第 1 段 · 共 6 段 · 壁画两层就位 · 选项≥2）', !!fx
      && bgLayers.length === 2
      && fx.textContent.indexOf('第 1 段') >= 0 && fx.textContent.indexOf('共 6 段') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);
    var muralKeys = {}, seenSeg = 0;
    if (fx) {
      var m0 = fx.querySelector('.sgr-bg[data-on]');
      if (m0) muralKeys[m0.dataset.key] = 1;
    }
    var guard = 0;
    while (guard++ < 12) {
      var pk = fx.querySelector('[data-action="story-pick"]');
      if (!pk) break;
      click(pk);
      await sleep(30);
      seenSeg = Math.max(seenSeg, Number((fx.textContent.match(/第 (\\d) 段/) || [0, 0])[1]) || 0);
      var mOn = fx.querySelector('.sgr-bg[data-on]');
      if (mOn) muralKeys[mOn.dataset.key] = 1;
    }
    var keyN = 0; for (var kk in muralKeys) keyN++;
    check('★ 壁画随段变换（段位走到 ≥3 · 壁画出现 ≥2 张）', seenSeg >= 3 && keyN >= 2,
      '走到第 ' + seenSeg + ' 段 · 壁画 ' + keyN + ' 张');
""", 'e2e · 阅读器与壁画')

# ============================================================
if FAILS:
    print('\n'.join(['FAIL  ' + x for x in FAILS]))
    sys.exit(1)
print('ALL OK · 测试补丁全部落盘')
