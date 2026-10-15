# -*- coding: utf-8 -*-
# v89.150（老板 3）：smoke 收尾 4 条 —— 回放退役后的判据调整
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
# ---------- ① E3/E1：CSS 判据换新三块 ----------
("""      var cOk = hS94.indexOf('.rp-ctl') >= 0 && hS94.indexOf('.rp-ev') >= 0 && hS94.indexOf('.exp-ops-row') >= 0;
      return uiOk && /data-action="rep-play"/.test(one) && /data-action="rep-jump"/.test(one) && wOk && cOk;""",
 """      /* v89.150：`.rp-ctl / .rp-ev`（回放专用样式）已退役 → 判据换成三块新样式 + 沙盘滑杆样式仍在 */
      var _h94 = stripComment(hS94);
      var cOk = _h94.indexOf('.rp-lines') >= 0 && _h94.indexOf('.rp-gain') >= 0
        && _h94.indexOf('.exp-ops-row') >= 0 && _h94.indexOf('.rp-range') >= 0
        && _h94.indexOf('.rp-ctl') < 0 && _h94.indexOf('.rp-ev') < 0;
      return uiOk && wOk && cOk;""",
 '① E3/E1 CSS 判据'),

# ---------- ② ⑩ 正文页去重 → 改为分段渲染判据 ----------
("""    /* ⑩ 战报正文页去重：简报里的【兵种损耗】文本段被剥离（结构化表仍在） */
    var c10 = (function () {
      try {
        var srcOK = /ui\\.stripBodyDup = function/.test(u99) && /ui\\.stripBodyDup\\(r\\.body\\)/.test(u99);
        if (!srcOK) return { ok: false, dbg: '源码级不匹配' };
        var f = G.ui.stripBodyDup;
        var a = f('A段<br>【兵种损耗】我军 长枪兵 1,000 → 800（损 200）<br>敌军 义兵 500 → 0（损 500）');
        var b = f('A段<br>【兵种损耗】我军 长枪兵 1,000 → 800（损 200）<br>敌军 义兵 500 → 0（损 500）<br>【斗将】甲胜乙');
        var c = f('无损耗段');
        return { ok: a === 'A段' && b === 'A段<br>【斗将】甲胜乙' && c === '无损耗段',
          dbg: 'a=[' + a + '] b=[' + b + '] c=[' + c + ']' };
      } catch (e) { return { ok: false, dbg: 'EX:' + (e && e.message) }; }
    })();
    check('⑩ 战报正文页去重：剥离简报里的【兵种损耗】文本段（结构化表仍在）', c10.ok, c10.dbg);""",
 """    /* ⑩ v89.150（老板 3）：正文页改**分段渲染**（唯一出口 ui.reportSectOf）——
       旧的"剥掉【兵种损耗】文本段"（ui.stripBodyDup）随整块渲染一并退役；
       现在损耗段归 loss 段（不渲染进正文），另两块（总结/收获）分类分行。 */
    var c10 = (function () {
      try {
        var _c99 = stripComment(u99);
        var srcOK = /ui\\.reportSectOf = function/.test(u99) && /ui\\.reportGainHTML = function/.test(u99)
          && _c99.indexOf('ui.stripBodyDup') < 0;
        if (!srcOK) return { ok: false, dbg: '源码级不匹配' };
        var f = G.ui.reportSectOf;
        var a = f({ body: '【许都】攻城胜利。<br>远征将领：赵。战斗持续 3 回合。<br>经验：赵 +10　Lv2（10 / 99）'
          + '<br>【兵种损耗】我军 长枪兵 1,000 → 800（损 200）<br>敌军 义兵 500 → 0（损 500）'
          + '<br>【战利品】粮 3,000；材料：铁 ×2<br>【斗将】甲胜乙' });
        var b = G.ui.reportSplitLine('战利品：粮 3,000、木 2,000');
        return { ok: a.summary.length === 2 && a.gain.length === 4 && a.loss.length === 2
            && a.events.length === 1 && /^【斗将】/.test(a.events[0])
            && b.label === '战利品' && b.body === '粮 3,000、木 2,000',
          dbg: 'sum=' + a.summary.length + ' gain=' + a.gain.length + ' loss=' + a.loss.length
            + ' ev=' + a.events.length + ' lab=' + b.label };
      } catch (e) { return { ok: false, dbg: 'EX:' + (e && e.message) }; }
    })();
    check('⑩ v89.150：正文页分段渲染（总结 / 收获 / 损耗三段 · 收获按「；」拆行 + 类别拆分）', c10.ok, c10.dbg);""",
 '② ⑩ 分段渲染'),

# ---------- ③ ① rid 化：去掉"rlog 回调"判据（回合纪要已删） ----------
("""        && /ui\\._repId = 0;/.test(u)
        && /ui\\.viewReportText\\(rid\\)/.test(u)                 /* rlog 回调捕获 rid */
        && /data-action="open-sandbox" data-rid=/.test(u)""",
 """        && /ui\\._repId = 0;/.test(u)
        /* ⛔ v89.150：`/ui\\.viewReportText\\(rid\\)/`（回合纪要 rlog 回调捕获 rid）随纪要板块退役 */
        && /data-action="open-sandbox" data-rid=/.test(u)""",
 '③ rid 化判据'),

# ---------- ④ §129⑦：去掉回放帧文案判据（已退役） ----------
("""        /* 其余读数（沙盘 / 回放帧 / 事件行）也已统一 —— 渲染文案里不得再有裸「间距 」 */
        && uS129.indexOf("'<span class=\\"bt-g\\">最近距离 ") >= 0
        && uS129.indexOf("（最近距离 '") >= 0
        && uS129.indexOf(">间距 <b") < 0;""",
 """        /* 其余读数（沙盘 / 事件行）也已统一 —— 渲染文案里不得再有裸「间距 」
           （⛔ v89.150：回放帧 `replayFrameHTML` 随板块退役，它那条"最近距离"文案一并消失） */
        && uS129.indexOf("'<span class=\\"bt-g\\">最近距离 ") >= 0
        && uS129.indexOf(">间距 <b") < 0
        && stripComment(uS129).indexOf('ui.replayFrameHTML') < 0;""",
 '④ §129⑦ 读数判据'),
])

print('ALL OK · len=' + str(len(s)))
