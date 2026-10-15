# -*- coding: utf-8 -*-
# v89.157 补丁 D2：battle.js —— 程序化抓段（evLine → evTextOf 提取 + roundLinesOf）
import io
P = 'E:/Deepseekdb/js/battle.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

if u'GAME.battle.evTextOf = function' in s:
    print('patch D skip（已落盘）')
else:
    a = s.index(u'  GAME.battle.replayFramesOf = function (r) {')
    b = s.index(u'    var a0 = (log[0] && log[0].a) || 0', a)
    OLD_HEAD = s[a:b]
    k1 = OLD_HEAD.index(u'    function evLine(rr) {\n') + len(u'    function evLine(rr) {\n')
    k2 = OLD_HEAD.rindex(u'    }\n')
    EVBODY = OLD_HEAD[k1:k2]
    assert u'var parts = [], hostOf = {};' in EVBODY and u'return s0;' in EVBODY
    # 顶层函数体：整体退 2 格缩进（风格一致）
    EVBODY2 = u'\n'.join([(l[2:] if l.startswith(u'  ') else l) for l in EVBODY.split(u'\n')])

    HEADER = u"""  /* ============================================================
   * v89.157（老板「逐回合文字复盘」）：**逐回合文字**的唯一出口
   * ------------------------------------------------------------
   * 与关键帧摘要（replayFramesOf 的 ev 字段）**同源** —— 回合事件的措辞只在这里定义
   * （改措辞只改一处）；`roundLinesOf` 把每回合拼成一行，供战报正文的
   * 「逐回合文字复盘」入口消费（旧档没有 roundsLog 的战报返回空数组）。
   * ============================================================ */
  GAME.battle.evTextOf = function (rr, maxEv) {
"""
    ROUND = u"""  };

  /* 逐回合一行：`第N回合（我 X · 敌 Y）：我长枪→弓兵 杀 120；…`
     —— 兵力读回合记录（rr.a / rr.d = 双方当时兵力）；没有事件的回合写「（无交火）」。 */
  GAME.battle.roundLinesOf = function (r) {
    if (!r || !r.roundsLog || !r.roundsLog.length) return [];
    var maxEv = (DATA.REPLAY && DATA.REPLAY.maxEv) || 56;
    return r.roundsLog.map(function (rr) {
      var ev = GAME.battle.evTextOf(rr, maxEv);
      var tail = [];
      if (rr.a != null) tail.push('我 ' + U.numText(rr.a, 0));
      if (rr.d != null) tail.push('敌 ' + U.numText(rr.d, 0));
      return '第' + (rr.r != null ? rr.r : '?') + '回合' +
        (tail.length ? '（' + tail.join(' · ') + '）' : '') + '：' + (ev || '（无交火）');
    });
  };

  GAME.battle.replayFramesOf = function (r) {
    var cfg = DATA.REPLAY || {};
    var maxFrames = cfg.maxFrames || 10, maxEv = cfg.maxEv || 56;
    if (!r || r.engine !== 'tactic' || !r.roundsLog || !r.roundsLog.length) return null;
    var log = r.roundsLog, strips = r.strips || [], n = log.length;
    /* v89.157：事件措辞抽到唯一出口 evTextOf（与战报「逐回合文字复盘」同源） */
    var evLine = function (rr) { return GAME.battle.evTextOf(rr, maxEv); };
"""
    NEW_HEAD = HEADER + EVBODY2 + u"\n" + ROUND
    s = s[:a] + NEW_HEAD + s[b:]
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('patch D2 落盘')

chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.battle.evTextOf = function') == 1
assert chk.count(u'GAME.battle.roundLinesOf = function') == 1
assert chk.count(u'GAME.battle.replayFramesOf = function') == 1
assert chk.count(u'function evLine(rr) {') == 0
print('patch D done, len', orig, '->', len(chk))
