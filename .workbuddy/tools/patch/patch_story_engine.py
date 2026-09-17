#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_engine.py —— 把「文字游戏 · 故事库引擎」挂进 js/state.js

位置：state.js 末尾（GAME.sceneEscape 之后、模块 IIFE 收口 `})();` 之前）。
口径：
  · 数据源 = window.STORY_DATA（story/vol-*.js 追加），**不在 state.js 里存内容**；
  · 奖赏唯一出口复用 STORY.applyReward（本引擎只把扁平 reward 折成它的入参形状）；
  · 运行态 GAME.SG._run 不入档；进度 s.stories 入档（运行中会变）。
幂等：已存在 GAME.SG = {} 则跳过。
用法：python .workbuddy/tools/patch/patch_story_engine.py
"""
import io
import os

P = r'E:\Deepseekdb\js\state.js'

BLOCK = u"""
  /* ============================================================
   * 文字游戏 · 故事库引擎（内容层在 story/vol-*.js）
   * ------------------------------------------------------------
   * 与「江湖游历 / 奇遇」同族（幕 → 选择 → 幕/结局），但**互不依赖**：
   *   · 游历 = 有消耗、有日锁、进战斗与生产链；
   *   · 故事 = 只读叙事 + 一次性赏赐（不进战斗链、不改任何数值公式）。
   * 事实源：window.STORY_DATA（由 story/vol-*.js 追加）。
   * 运行态 GAME.SG._run **不入档**（一次阅读是短会话，同 sceneFx 先例）；
   * 进度 s.stories **入档**（运行中会变 —— 符合「派生数据不入档」的判据）。
   * ============================================================ */
  GAME.SG = {};
  /* 故事全表（无数据时返回空表，界面按空态处理） */
  GAME.SG.list = function () {
    return (typeof window !== 'undefined' && window.STORY_DATA) || [];
  };
  GAME.SG.one = function (sid) {
    var all = GAME.SG.list();
    for (var i = 0; i < all.length; i++) if (all[i].id === sid) return all[i];
    return null;
  };
  /* 该档的阅读进度（懒初始化：老档读入即补，不动 SAVE_VERSION） */
  GAME.SG.progress = function () {
    var s = GAME.state;
    if (!s) return {};
    if (!s.stories) s.stories = {};
    return s.stories;
  };
  /* 某锚点下的故事（带已读进度）——入口与图鉴共用这一处筛选 */
  GAME.SG.anchor = function (kind, id) {
    var pr = GAME.SG.progress();
    var out = [];
    GAME.SG.list().forEach(function (st) {
      var a = st.anchor || {};
      if (a.kind !== kind || a.id !== id) return;
      var r = pr[st.id] || {};
      out.push({ st: st, done: r.done || [], last: r.grade || '', n: r.n || 0 });
    });
    out.sort(function (a, b) { return a.st.id < b.st.id ? -1 : 1; });
    return out;
  };
  /* 开一篇：建立运行态（不入档） */
  GAME.SG.begin = function (sid) {
    var st = GAME.SG.one(sid);
    if (!st) return { ok: false, msg: '没有这篇故事' };
    var nodes = st.nodes || [];
    if (!nodes.length) return { ok: false, msg: '故事缺幕' };
    GAME.SG._run = { st: st, nodeId: nodes[0].id, path: [], phase: 'node', ending: null, got: null, fresh: false };
    return { ok: true, run: GAME.SG._run };
  };
  GAME.SG.nodeOf = function (run, nid) {
    var ns = (run && run.st && run.st.nodes) || [];
    for (var i = 0; i < ns.length; i++) if (ns[i].id === nid) return ns[i];
    return null;
  };
  GAME.SG.endingOf = function (run, eid) {
    var es = (run && run.st && run.st.endings) || [];
    for (var i = 0; i < es.length; i++) if (es[i].id === eid) return es[i];
    return null;
  };
  /* 选一个选项：推进到下一幕，或落到结局并立即结算 */
  GAME.SG.choose = function (i) {
    var run = GAME.SG._run;
    if (!run || run.phase !== 'node') return { ok: false, msg: '当前不在选项中' };
    var node = GAME.SG.nodeOf(run, run.nodeId);
    var op = (node && node.o) ? node.o[i] : null;
    if (!op) return { ok: false, msg: '没有这个选项' };
    run.path.push({ id: run.nodeId, l: op.l });
    var end = GAME.SG.endingOf(run, op.to);
    if (end) {
      run.phase = 'end';
      run.ending = end;
      run.got = GAME.SG.settle(run, end);
    } else {
      run.nodeId = op.to;
    }
    return { ok: true, run: run };
  };
  /* 归档即断开运行态（供退出/收起用） */
  GAME.SG.close = function () { GAME.SG._run = null; };
  /* 结算：赏赐走 STORY.applyReward（唯一奖赏出口），本处只做**形状折算** */
  GAME.SG.settle = function (run, end) {
    var s = GAME.state;
    var rw = end.reward || {};
    var flat = { gold: rw.gold || 0, rep: rw.rep || 0, pop: rw.pop || 0, item: rw.item, count: rw.count };
    var res = {};
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { if (rw[k]) res[k] = rw[k]; });
    if (Object.keys(res).length) flat.res = res;
    if (GAME.story && GAME.story.applyReward) GAME.story.applyReward(flat);
    if ((s.rep || 0) < 0) s.rep = 0;                    /* 声望不为负（lose 结局可能扣） */
    var pr = GAME.SG.progress();
    var rec = pr[run.st.id] || { done: [], n: 0, grade: '' };
    var fresh = rec.done.indexOf(end.id) < 0;
    if (fresh) rec.done.push(end.id);
    rec.n = (rec.n || 0) + 1;
    rec.grade = end.grade || '';
    pr[run.st.id] = rec;
    /* 展示用账目（与 flat 同源，界面不再二次计算） */
    var got = [];
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      if (flat[k]) got.push({ k: GAME.resName ? GAME.resName(k) : k, v: flat[k] });
    });
    if (flat.rep) got.push({ k: '声望', v: flat.rep });
    if (flat.pop) got.push({ k: '人口', v: flat.pop });
    if (flat.item) got.push({ k: (DATA.ITEM_BY_ID && DATA.ITEM_BY_ID[flat.item] ? DATA.ITEM_BY_ID[flat.item].name : flat.item), v: flat.count || 1 });
    return { got: got, first: fresh, done: rec.done.length, total: (run.st.endings || []).length };
  };
"""

src = io.open(P, encoding='utf-8', newline='').read()
if u'GAME.SG = {};' in src:
    print(u'· state.js 已含 GAME.SG —— 跳过（幂等）')
    raise SystemExit(0)

anchor = u'\n})();\n'
if not src.endswith(anchor):
    print(u'✗ state.js 末尾形态不符（应以 \\n})();\\n 收口）—— 已中止')
    raise SystemExit(1)

src = src[:-len(anchor)] + BLOCK + u'})();\n'
io.open(P, 'w', encoding='utf-8', newline='').write(src)

chk = io.open(P, encoding='utf-8', newline='').read()
ok = (u'GAME.SG = {};' in chk) and chk.endswith(u'})();\n') and (u'GAME.SG.settle = function' in chk)
print(u'✓ state.js 已写入引擎（%d → %d 字符）· 回查 %s' % (len(src) - len(BLOCK), len(src), u'通过' if ok else u'失败'))
raise SystemExit(0 if ok else 1)
