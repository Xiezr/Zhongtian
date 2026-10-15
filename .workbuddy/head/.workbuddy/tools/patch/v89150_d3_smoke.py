# -*- coding: utf-8 -*-
# v89.150（老板 3）：smoke 旧断言升级 —— 正文三块口径 + 回放 UI 退役
import io, re

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def patch(segs):
    global s
    for old, new, tag in segs:
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)


patch([
# ---------- ① 正文三块（旧"战斗场景/回合纪要"） ----------
("""  check('战报详情含战斗场景与回合纪要区块',
    /战斗场景/.test(uS40) && /bt-scene/.test(uS40) && /回合纪要/.test(uS40) && /兵种损耗/.test(uS40));""",
 """  /* v89.150（老板 3）：「战报正文里不要分回合回放、回合纪要这 2 个板块。保留/设置：
     战斗总结，战斗收获，兵种损耗」—— 判据改三块在册 + 两个旧板块**不得复活**（剥注释查）。 */
  var _u40c = stripComment(uS40);
  check('战报详情 = 三块（战斗总结 / 战斗收获 / 兵种损耗）· 回放与纪要已退役',
    /战斗总结/.test(_u40c) && /战斗收获/.test(_u40c) && /兵种损耗/.test(_u40c)
    && _u40c.indexOf('回合纪要') < 0 && _u40c.indexOf('分回合回放') < 0);""",
 '① 正文三块'),

# ---------- ② E3 界面接线 ----------
("""    check('E3：战报详情接回放 + 列表带 🏅 徽记（界面接线）', (function () {
      return /ui\\.replaySectionHTML = function/.test(uS94)
        && /data-action="rep-play"/.test(uS94) && /ui\\.replayJump = function/.test(uS94)
        && /r\\.underdog \\? '🏅 ' : ''/.test(uS94) && /id="rep-fbox"/.test(uS94);
    })());""",
 """    check('E3：列表带 🏅 徽记 + **回放 UI 已退役**（v89.150 老板 3）', (function () {
      var _c94 = stripComment(uS94);
      return /r\\.underdog \\? '🏅 ' : ''/.test(uS94)
        && _c94.indexOf('ui.replaySectionHTML') < 0 && _c94.indexOf('data-action="rep-play"') < 0
        && _c94.indexOf('ui.replayJump') < 0 && _c94.indexOf('id="rep-fbox"') < 0;
    })());""",
 '② E3 界面接线'),

# ---------- ③ E3/E1 界面与动作齐备 ----------
("""    check('E3/E1：界面与动作齐备（回放控制 / 战法块 / 撤退键 + CSS）', (function () {
      var uiOk = typeof G.ui.replaySectionHTML === 'function' && typeof G.ui.replaySet === 'function'
        && typeof G.ui.replayToggle === 'function' && typeof G.ui.replayJump === 'function'
        && typeof G.ui.expOpsBlockHTML === 'function' && typeof G.ui.setExpOps === 'function'
        && /id="exp-ops"/.test(G.ui.expOpsBlockHTML());
      var one = G.ui.replaySectionHTML({ rounds: 3, retreat: false,
        key: [{ r: 1, tag: 'final', text: '得胜' }],
        frames: [{ r: 1, a: 10, d: 10, gap: 0, s: '▓····▓', ev: '' }] });
      var wOk = ['bt-retreat', 'exp-ops', 'rep-prev', 'rep-next', 'rep-play', 'rep-jump']
        .every(function (a) { return mS94.indexOf("case '" + a + "'") >= 0; });""",
 """    check('E3/E1：界面与动作齐备（战法块 / 撤退键）· 回放控制**已退役**', (function () {
      /* v89.150（老板 3）：四个 rep-* 动作与四个 replay* 函数随板块一并退役（负向判据防复活）。 */
      var _c94 = stripComment(uS94);
      var _m94 = stripComment(mS94);
      var uiOk = typeof G.ui.expOpsBlockHTML === 'function' && typeof G.ui.setExpOps === 'function'
        && /id="exp-ops"/.test(G.ui.expOpsBlockHTML())
        && typeof G.ui.replaySectionHTML === 'undefined'
        && typeof G.ui.replaySet === 'undefined'
        && typeof G.ui.replayToggle === 'undefined'
        && typeof G.ui.replayJump === 'undefined';
      var one = '';
      var wOk = ['bt-retreat', 'exp-ops']
        .every(function (a) { return _m94.indexOf("case '" + a + "'") >= 0; })
        && ['rep-prev', 'rep-next', 'rep-play', 'rep-jump']
          .every(function (a) { return _m94.indexOf("case '" + a + "'") < 0; });""",
 '③ E3/E1 界面与动作'),
])

print('ALL OK · len=' + str(len(s)))
