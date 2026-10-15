# -*- coding: utf-8 -*-
# v89.156 patch E：smoke-test.js 升级（6 处旧断言 + 新增 §156 节）
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

def rep(old, new, tag, marks):
    global s
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        print(tag + ' OK')
        return True
    if any(mk in s for mk in marks):
        print(tag + ' skip（已落盘）')
        return False
    raise AssertionError(tag + ' anchor missing\n' + old[:200])

# ---------- ① §36「放弃不可逆」（uS36/mS36）：上膛 → 一击执行 ----------
rep(
u"""check('放弃不可逆 → 两段确认弹窗 + 上膛式（连点两次才执行 · v89.154）', /ui\\.openAbandonWildAsk = function/.test(uS36)
    && /case 'wild-abandon-ask'/.test(mS36) && /case 'wild-abandon-arm'/.test(mS36)
    && !/case 'wild-abandon-do':/.test(mS36));""",
u"""check('放弃不可逆 → 两段确认弹窗 + 窗内一击执行（v89.156 · 上膛式退役）', /ui\\.openAbandonWildAsk = function/.test(uS36)
    && /case 'wild-abandon-ask'/.test(mS36) && /case 'wild-abandon-do': \\{/.test(mS36)
    && !/case 'wild-abandon-arm':/.test(mS36));""",
'① §36 放弃不可逆', [u"窗内一击执行（v89.156 · 上膛式退役）"])

# ---------- ② §124② 标题串（· 兵种数量 → 校场出征上限标签） ----------
rep(
u"""            && html.indexOf('派遣兵力 · 兵种数量</div>') >= 0;   /* 标题后不再挂按钮 */""",
u"""            && html.indexOf('派遣兵力（<span id="exp-cap-t">') >= 0;   /* v89.156：标额标签（标题后不挂按钮） */""",
'② §124② 标题串', [u"v89.156：标额标签"])

# ---------- ③ v89.86 野地上限预警 → 限制性信息行 ----------
rep(
u"""    check('v89.86（P-16）：野地上限出兵前预警（元素 + 计算出口）',
      ui8.indexOf('id="exp-wildcap"') >= 0 && /ui\\.updateExpWildCap = function/.test(ui8)
      && /野地已达上限（/.test(ui8));""",
u"""    check('v89.156：限制性信息行（目标区 exp-limits + 唯一出口 expLimitsHTML；v89.86 野地上限并入）',
      ui8.indexOf('id="exp-limits"') >= 0 && /ui\\.expLimitsHTML = function/.test(ui8)
      && /ui\\.updateExpLimits = function/.test(ui8)
      && /野地已达上限（/.test(ui8) && ui8.indexOf('id="exp-wildcap"') < 0);""",
'③ 野地上限→限制行', [u'v89.156：限制性信息行（目标区 exp-limits'])

# ---------- ④ §89.117 层级栈⑥：openModal 守卫正则升级 ----------
rep(
u"""        && /if \\(title && curTitle && title !== curTitle\\) \\{/.test(u97);""",
u"""        && /if \\(title && curTitle && title !== curTitle && !o\\.sameAs && !ui\\._liveRedraw\\) \\{/.test(u97);""",
'④ 层级栈⑥ 守卫', [u"!o\\.sameAs && !ui\\._liveRedraw"])

# ---------- ⑤ §154 采集段：列表不出直接执行键（-arm/-do 都不在列表） ----------
rep(
u"""        out.noArmInList = html.indexOf('wild-abandon-arm') < 0;""",
u"""        out.noArmInList = html.indexOf('wild-abandon-arm') < 0 && html.indexOf('wild-abandon-do') < 0;""",
'⑤a §154 列表判据', [u"html.indexOf('wild-abandon-do') < 0"])

rep(
u"""        out.hasAsk = html.indexOf('data-action="wild-abandon-arm"') >= 0 && html.indexOf('不可撤销') >= 0;""",
u"""        out.hasAsk = html.indexOf('data-action="wild-abandon-do"') >= 0 && html.indexOf('不可撤销') >= 0;""",
'⑤b §154 hasAsk', [u"""out.hasAsk = html.indexOf('data-action="wild-abandon-do"')"""])

rep(
u"""    check('§154④ ask 弹窗：上膛按钮（wild-abandon-arm）+ 明写「不可撤销」',
      R154.hasAsk, R154.askHtml ? R154.askHtml.slice(0, 80) : '(空)');""",
u"""    check('§154④ ask 弹窗：一击执行键（wild-abandon-do · v89.156）+ 明写「不可撤销」',
      R154.hasAsk, R154.askHtml ? R154.askHtml.slice(0, 80) : '(空)');""",
'⑤c §154④ 名称', [u'一击执行键（wild-abandon-do · v89.156）'])

# ---------- ⑥ §154⑤ 实测：上膛 → 一击执行 ----------
OLD6 = u"""    check('§154⑤ 实测：放弃野地上膛式（第一次只上膛 / 第二次才执行 / 执行后标志清零）', (function () {
      var st = G.state;
      var keep = { wilds: st.wilds, gathers: st.gathers };
      var ok = false, dbg = '';
      try {
        st.wilds = st.wilds.concat([{ x: 920, y: 920, type: 'forest', level: 2, day: 0, startDay: 0 }]);
        var el = { dataset: { x: '920', y: '920' }, innerHTML: '确定放弃' };
        G.ui._wildArm154 = null;
        G.action('wild-abandon-arm', el);
        var arm1 = /再点一次/.test(el.innerHTML) && G.ui._wildArm154 === '920,920' && !!G.map.wildAt(920, 920);
        G.action('wild-abandon-arm', el);
        var arm2 = !G.map.wildAt(920, 920) && G.ui._wildArm154 === null
          && st.wilds.filter(function (w) { return w.x === 920; }).length === 0;
        ok = arm1 && arm2;
        dbg = 'arm1=' + arm1 + ' arm2=' + arm2;
      } catch (e) { dbg = String(e && e.message); }
      finally { st.wilds = keep.wilds; st.gathers = keep.gathers; }
      return ok;
    })());
    check('§154⑤ 打开 ask 即复位上膛标志（关窗重开必须重新上膛）',
      /ui\\._wildArm154 = null;      \\/\\* v89\\.154：打开即复位/.test(u154));"""
NEW6 = u"""    check('§154⑤ 实测：放弃野地——窗内红键**一击执行**（v89.156：上膛式退役）', (function () {
      var st = G.state;
      var keep = { wilds: st.wilds, gathers: st.gathers };
      var ok = false, dbg = '';
      try {
        st.wilds = st.wilds.concat([{ x: 920, y: 920, type: 'forest', level: 2, day: 0, startDay: 0 }]);
        var el = { dataset: { x: '920', y: '920' }, innerHTML: '确定放弃' };
        G.action('wild-abandon-do', el);
        var done = !G.map.wildAt(920, 920)
          && st.wilds.filter(function (w) { return w.x === 920; }).length === 0;
        ok = done;
        dbg = 'done=' + done;
      } catch (e) { dbg = String(e && e.message); }
      finally { st.wilds = keep.wilds; st.gathers = keep.gathers; }
      return ok;
    })());
    check('§154⑤ 上膛机制整条退役（v89.156：_wildArm154 零执行残留 · -arm 无 case）',
      u154.indexOf('_wildArm154 =') < 0 && u154.indexOf('_wildArm154 !==') < 0
      && u154.indexOf('wild-abandon-arm') < 0
      && m154.indexOf('_wildArm154 =') < 0 && m154.indexOf("case 'wild-abandon-arm'") < 0);"""
rep(OLD6, NEW6, '⑥ §154⑤ 实测', [u'窗内红键**一击执行**（v89.156：上膛式退役）'])

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke patch E done, len', orig, '->', len(s))
