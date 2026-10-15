#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_smoke.py -- add smoke section 81 (text game / story library)

Inserted right before the final result print in smoke-test.js.
No backslash escapes anywhere (newlines via chr(10), no regex literals with \\s):
the JS uses charCode/join instead of regex, so nothing can be eaten on the way to disk.
Idempotent: skips when the marker is already present.
"""
import io

P = r'E:\Deepseekdb\smoke-test.js'
A = chr(10)

ANCHOR = u"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

SECTION = u"""/* ============================================================
 * 81. 文字游戏 · 故事库（story/ · GAME.SG / ui.SG_*）
 * ============================================================ */
(function () {
  console.log('\\n===== 81. 文字游戏 · 故事库（story/） =====');

  var SG_KINDS = { building: 1, ext: 1, wild: 1, city: 1, misc: 1 };

  check('故事库：数据齐（≥5 篇 · id 唯一 · 锚点合法 · 幕/结局/字数达标）', (function () {
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

  check('故事库：入口区块（有故事出文案 · 无故事返回空串）', (function () {
    var has = GAME.SG.anchor('building', 'guanfu').length > 0;
    var b1 = GAME.ui.SG_BLOCK('building', 'guanfu', '官府');
    var b2 = GAME.ui.SG_BLOCK('building', 'minfang', '民房');
    return has && b1.indexOf('听一段故事') >= 0 && b1.indexOf('story-list') >= 0 && b2 === '';
  })());

  /* 官府篇正路：n1 查账 → n2 封仓 → n3 留路 = e2（partial） */
  check('故事库：开卷 → 推进 → 结局（3 步落 e2 · 账目非空 · 结局后拒绝再选）', (function () {
    var r = GAME.SG.begin('bld-guanfu-01');
    if (!r.ok) return false;
    var a = GAME.SG.choose(0), b = GAME.SG.choose(0), c = GAME.SG.choose(1);
    if (!(a.ok && b.ok && c.ok)) return false;
    if (c.run.phase !== 'end' || !c.run.ending || c.run.ending.id !== 'e2') return false;
    if (!(c.run.got && c.run.got.got && c.run.got.got.length)) return false;
    return GAME.SG.choose(0).ok === false;
  })());

  /* 官府篇另一路：n1 夜访 → n3 揭破 = e1（win）—— 重读换结局 */
  check('故事库：入档进度（done 累积 · 重读换结局 → 首次标记为假）', (function () {
    var rec0 = GAME.SG.progress()['bld-guanfu-01'];
    if (!rec0 || (rec0.done || []).indexOf('e2') < 0) return false;
    var n0 = rec0.n || 0;
    GAME.SG.begin('bld-guanfu-01');
    GAME.SG.choose(1);
    var c = GAME.SG.choose(0);
    if (!c.ok || c.run.phase !== 'end' || c.run.ending.id !== 'e1') return false;
    var rec1 = GAME.SG.progress()['bld-guanfu-01'];
    return c.run.got.first === false && (rec1.n || 0) === n0 + 1 && rec1.done.length >= 2;
  })());

  /* 客栈篇败局：n1 静观 → n3 喝止 = e3（lose · 声望 −20）→ 不得为负 */
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

  check('故事库：接线（三处入口 · 四动作 · 奖赏走 STORY.applyReward）', (function () {
    var mS = '';
    try { mS = '' + require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8'); } catch (e) { mS = ''; }
    var okMain = mS.indexOf("case 'story-list'") >= 0 && mS.indexOf("case 'story-open'") >= 0
      && mS.indexOf("case 'story-pick'") >= 0 && mS.indexOf("case 'story-exit'") >= 0;
    var okEntry = GAME.ui.openBuildModal.toString().indexOf("ui.SG_BLOCK('building'") >= 0
      && GAME.ui.openLandModal.toString().indexOf("ui.SG_BLOCK('wild'") >= 0
      && GAME.ui.openCityPanel.toString().indexOf("ui.SG_BLOCK('city'") >= 0;
    var okSettle = GAME.SG.settle.toString().indexOf('applyReward') >= 0;
    return okMain && okEntry && okSettle;
  })());
})();

"""

src = io.open(P, encoding='utf-8', newline='').read()
if u'81. 文字游戏 · 故事库' in src:
    print('smoke already contains section 81 -- skip (idempotent)')
    raise SystemExit(0)

n = src.count(ANCHOR)
if n != 1:
    print('anchor matched %d times (expected 1) -- aborted' % n)
    raise SystemExit(1)

src = src.replace(ANCHOR, SECTION + ANCHOR)
io.open(P, 'w', encoding='utf-8', newline='').write(src)

chk = io.open(P, encoding='utf-8', newline='').read()
ok = (u'81. 文字游戏 · 故事库' in chk) and chk.count(ANCHOR) == 1
print('smoke-test.js written (%d chars) -- verify %s' % (len(chk), 'PASS' if ok else 'FAIL'))
raise SystemExit(0 if ok else 1)
