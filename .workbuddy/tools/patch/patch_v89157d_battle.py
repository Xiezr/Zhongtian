# -*- coding: utf-8 -*-
# v89.157 补丁 D：battle.js —— 事件措辞抽唯一出口 evTextOf + 新增逐回合文字 roundLinesOf
import io
P = 'E:/Deepseekdb/js/battle.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

BODY = u"""    var parts = [], hostOf = {};
    /* v89.119（老板「反击应该在敌方出手后…反击和对方出手记录在同一行」）：
       反击并入**引发它的那次出手**同一段，口径与回合记录/战报纪要一致
       （唯一配对规则：counter.targetId === 该出手的 id，且阵营相反）。 */
    (rr.events || []).forEach(function (e) {
      if (parts.length >= 3) return;
      if (e.kind === 'attack') {
        parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
          + ' 杀 ' + U.numText(e.kill || 0, 0));
        if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = parts.length - 1;
      } else if (e.kind === 'counter') {
        var hk = (e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId;
        var hi = hostOf[hk];
        /* v89.136（老板 3）：同口径 —— 按反击者阵营给词（'对方'→'我方/敌方'） */
        if (hi != null) parts[hi] += '（' + (e.side === 'atk' ? '我方' : '敌方') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';
        else parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0));
      } else if (e.kind === 'tower') {
        parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
      } else if (e.kind === 'wall') {
        parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
      }
    });
    var s0 = parts.join('；');
    if (maxEv && s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
    return s0;
  };"""

NEW_HEAD = u"""  /* ============================================================
   * v89.157（老板「逐回合文字复盘」）：**逐回合文字**的唯一出口
   * ------------------------------------------------------------
   * 与关键帧摘要（replayFramesOf 的 ev 字段）**同源** —— 回合事件的措辞只在这里定义
   * （改措辞只改一处）；`roundLinesOf` 把每回合拼成一行，供战报正文的
   * 「逐回合文字复盘」入口消费（旧档没有 roundsLog 的战报返回空数组）。
   * ============================================================ */
  GAME.battle.evTextOf = function (rr, maxEv) {
""" + BODY + u"""

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
    var evLine = function (rr) { return GAME.battle.evTextOf(rr, maxEv); };"""

OLD_HEAD = u"""  GAME.battle.replayFramesOf = function (r) {
    var cfg = DATA.REPLAY || {};
    var maxFrames = cfg.maxFrames || 10, maxEv = cfg.maxEv || 56;
    if (!r || r.engine !== 'tactic' || !r.roundsLog || !r.roundsLog.length) return null;
    var log = r.roundsLog, strips = r.strips || [], n = log.length;
    function evLine(rr) {
""" + BODY.replace(u"""    var s0 = parts.join('；');
    if (maxEv && s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
    return s0;
  };""", u"""    var s0 = parts.join('；');
      if (s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
      return s0;
    }""")

if u'GAME.battle.evTextOf = function' in s:
    done.append('D skip')
else:
    assert s.count(OLD_HEAD) == 1, 'D count=' + str(s.count(OLD_HEAD))
    s = s.replace(OLD_HEAD, NEW_HEAD)
    done.append('D OK')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.battle.evTextOf = function') == 1
assert chk.count(u'GAME.battle.roundLinesOf = function') == 1
assert chk.count(u'GAME.battle.replayFramesOf = function') == 1
assert chk.count(u'function evLine(rr) {') == 0
assert chk.count(u'{') == s.count(u'{') and chk.count(u'}') == s.count(u'}')
print('patch D done:', done, 'len', orig, '->', len(s))
