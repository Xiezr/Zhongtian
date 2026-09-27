# -*- coding: utf-8 -*-
# v89.150（老板 3）收尾：reportSectOf 事件白名单 / _repId 初始化回归 / smoke 三条判据
import io, re


def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
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


# ============ ① ui.js：事件标记改白名单 + _repId 初始化回归 ============
patch('E:/Deepseekdb/js/ui.js', [
("""  ui.reportSplitLine = function (t) {""",
 """  /* 事件标记**白名单**（唯一出处）：只有这些【】算"战况事件"，
     其余【】一律当主文 —— ⚠️ reportText 的 line1 就是「【城名】攻城胜利」，
     用"凡是【】都算事件"会把主文全吞掉（本补丁第一版就这么错的）。
     白名单来自全仓 grep：出征（斗将/计谋/撤退/围攻）· 守城（守土/遭劫/未破防）·
     侦查（情报层级）。 */
  ui.REPORT_EV_TAGS = { '斗将': 1, '计谋': 1, '撤退': 1, '围攻': 1,
    '守土': 1, '遭劫': 1, '未破防': 1, '情报层级': 1 };
  /* 归"收获"的标记（战利品 + 侦查顺手所得）；💡 守城的【遭劫】是损失，不归收获 */
  ui.REPORT_GAIN_TAGS = { '战利品': 1, '顺手所得': 1, '意外发现': 1, '顺手拾获': 1 };
  ui._repId = 0;                 /* v89.120：当前查看的战报**身份**（rid），不再是数组下标
                                    （v89.150：随回放块退役被误删一次，这里补回 —— 初始化仍要） */
  ui.reportSplitLine = function (t) {""",
 '①-a 白名单 + _repId'),

("""      var m = t.match(/^【([^】]+)】([\\s\\S]*)$/);
      if (m) {
        var tag = m[1], rest = m[2];
        cur = (tag === '兵种损耗') ? 'loss' : (tag === '战利品' ? 'gain' : 'events');
        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行" */
          rest.split('；').forEach(function (x) { if (String(x).trim()) out.gain.push(String(x).trim()); });
        } else if (cur === 'loss') {
          out.loss.push(rest);
        } else {
          out.events.push('【' + tag + '】' + rest);
        }
        return;
      }""",
 """      var m = t.match(/^【([^】]+)】([\\s\\S]*)$/);
      if (m) {
        var tag = m[1], rest = m[2];
        /* 白名单判类（唯一出处 ui.REPORT_EV_TAGS / REPORT_GAIN_TAGS）——
           其余【】（如「【许都】攻城胜利」）**当主文**，不进事件段。 */
        cur = (tag === '兵种损耗') ? 'loss'
          : ui.REPORT_GAIN_TAGS[tag] ? 'gain'
            : ui.REPORT_EV_TAGS[tag] ? 'events' : 'summary';
        if (cur === 'summary') { out.summary.push(t); return; }
        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行" */
          rest.split('；').forEach(function (x) { if (String(x).trim()) out.gain.push(String(x).trim()); });
        } else if (cur === 'loss') {
          out.loss.push(rest);
        } else {
          out.events.push('【' + tag + '】' + rest);
        }
        return;
      }""",
 '①-b 白名单判类'),
])

# ============ ② smoke：三条判据 ============
patch('E:/Deepseekdb/smoke-test.js', [
("""        return { ok: a.summary.length === 2 && a.gain.length === 4 && a.loss.length === 2
            && a.events.length === 1 && /^【斗将】/.test(a.events[0])
            && b.label === '战利品' && b.body === '粮 3,000、木 2,000',""",
 """        /* 期望：summary 2（【许都】主文 + 远征将领）· gain 3（经验 + 「；」拆出的 2 条）
           · loss 2（我军/敌军）· events 1（斗将） */
        return { ok: a.summary.length === 2 && a.gain.length === 3 && a.loss.length === 2
            && a.events.length === 1 && /^【斗将】/.test(a.events[0])
            && b.label === '战利品' && b.body === '粮 3,000、木 2,000',""",
 '②-a ⑩ 期望值'),

("""      var cOk = _h94.indexOf('.rp-lines') >= 0 && _h94.indexOf('.rp-gain') >= 0
        && _h94.indexOf('.exp-ops-row') >= 0 && _h94.indexOf('.rp-range') >= 0
        && _h94.indexOf('.rp-ctl') < 0 && _h94.indexOf('.rp-ev') < 0;""",
 """      /* ⚠️ 负向判据带空格与花括号（`.rp-ev {`）—— 新类名 `.rp-lines.rp-evts` 含 `.rp-ev` 子串，
         裸查会假红（§58.1：负向判据先自问"我排除的到底是什么"）。 */
      var cOk = _h94.indexOf('.rp-lines') >= 0 && _h94.indexOf('.rp-gain') >= 0
        && _h94.indexOf('.exp-ops-row') >= 0 && _h94.indexOf('.rp-range') >= 0
        && _h94.indexOf('.rp-ctl {') < 0 && _h94.indexOf('.rp-ev {') < 0;""",
 '②-b E3/E1 CSS 判据'),

("""        && uS129.indexOf("'<span class=\\"bt-g\\">最近距离 ") >= 0
        && uS129.indexOf(">间距 <b") < 0
        && stripComment(uS129).indexOf('ui.replayFrameHTML') < 0;""",
 """        /* v89.150：回放帧（replayFrameHTML）退役后，"最近距离"的消费点收敛到
           **唯一出口 gapReadOf**（顶栏 + 每次步进的更新循环）——按出口查，不按字面量查。 */
        && /ui\\.gapReadOf = function/.test(uS129)
        && (uS129.match(/gapReadOf\\(/g) || []).length >= 3
        && uS129.indexOf(">间距 <b") < 0
        && stripComment(uS129).indexOf('ui.replayFrameHTML') < 0;""",
 '②-c §129⑦ 读数判据'),
])

print('ALL OK')
