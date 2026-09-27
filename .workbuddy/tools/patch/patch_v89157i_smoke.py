# -*- coding: utf-8 -*-
# v89.157 补丁 I：smoke-test.js —— 9 处升级 + 新增 §157 节
import io
P = 'E:/Deepseekdb/smoke-test.js'

def rd():
    return io.open(P, encoding='utf-8', newline='').read()

def rep(tag, old, new, marks=()):
    s = rd()
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
        print(tag + ' OK')
        return True
    for mk in marks:
        if mk in s:
            print(tag + ' skip（已落盘）')
            return False
    raise AssertionError(tag + ' anchor missing')

# ---------- ① 开工率：加法口径 ----------
rep('I1-开工率',
    u"""  check('开工率100%→50%粮食产量减半', Math.abs(prodHalf.grain - prodFull.grain / 2) < 0.001,
    prodFull.grain.toFixed(3) + ' → ' + prodHalf.grain.toFixed(3));""",
    u"""  /* v89.157（老板 4）：加成改"各自作用于基础再相加"—— 开工率 50% = 基础 ×(−0.5)，
     不再是"总量减半"（连乘口径已退役）。判据 = 差值恰为 基础×0.5。 */
  check('开工率100%→50%：粮食按"基础 ×（−50%）"下降（v89.157 加法口径）',
    Math.abs((prodFull.grain - prodHalf.grain) - (G.prodBasePerHour().grain || 0) * 0.5 / 3600 * G.timeScale()) < 0.001,
    prodFull.grain.toFixed(3) + ' → ' + prodHalf.grain.toFixed(3));""",
    [u'v89.157 加法口径）'])

# ---------- ② 产量分解总值：加法口径 ----------
rep('I2-总值',
    u"""  check('产量重构后总值未变（prodFactors 与旧口径一致）', (function () {
    var s = G.state;
    var out = G.productionPerSec();
    /* 基础产量 × 各因子连乘 = 输出值（抽因子不得改变结果） */
    var base = G.prodBasePerHour();
    var ts = G.timeScale();
    var okAll = true;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (r) {
      var m = 1;
      G.prodFactors(r).forEach(function (f) { m *= (1 + f.d); });
      var expect = (base[r] || 0) * m / 3600 * ts;
      if (Math.abs(expect - (out[r] || 0)) > 1e-6) okAll = false;
    });
    return okAll;
  })());""",
    u"""  check('产量总值 = 基础 ×（1 + Σ各因子）（v89.157 加法口径 · 单一来源）', (function () {
    var s = G.state;
    var out = G.productionPerSec();
    /* v89.157（老板 4）：加成**各自作用于基础产量再相加**（旧连乘口径已退役） */
    var base = G.prodBasePerHour();
    var ts = G.timeScale();
    var okAll = true;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (r) {
      var m = 0;
      G.prodFactors(r).forEach(function (f) { m += (f.d || 0); });
      var expect = (base[r] || 0) * Math.max(0, 1 + m) / 3600 * ts;
      if (Math.abs(expect - (out[r] || 0)) > 1e-6) okAll = false;
    });
    return okAll;
  })());""",
    [u'v89.157 加法口径 · 单一来源'])

# ---------- ③ §108④ 城墙门槛摆前置 ----------
rep('I3-108',
    u"""    if (g108 >= 0) c108.cells[g108].build.lvl = 11;
    st108.queues.build.length = 0;""",
    u"""    if (g108 >= 0) c108.cells[g108].build.lvl = 11;
    /* v89.157：升官府需城墙 ≥ 目标−2（11→12 需 Lv10）—— 本用例测的是时间曲线，先给墙 */
    G.wallSlotOf(c108).build = { id: 'chengqiang', lvl: 10 };
    st108.queues.build.length = 0;""",
    [u"G.wallSlotOf(c108).build"])

# ---------- ④ 官府硬顶：同样先给墙 ----------
rep('I4-硬顶',
    u"""      setGov54(12);
      var gu2 = G.upgradeAt(c54.id, govIdx54);""",
    u"""      setGov54(12);
      /* v89.157：新门槛（升官府需城墙 ≥ 目标−2）—— 本用例测"官府自己的硬顶"，先给足墙 */
      G.wallSlotOf(c54).build = { id: 'chengqiang', lvl: 12 };
      var gu2 = G.upgradeAt(c54.id, govIdx54);""",
    [u"G.wallSlotOf(c54).build"])

# ---------- ⑤ §153① 主题数 4 → 7 ----------
rep('I5-153',
    u"""        && GAME.msgFeedOf && GAME.msgSubOf && DATA.MSG_SUBS.length === 4;""",
    u"""        && GAME.msgFeedOf && GAME.msgSubOf && DATA.MSG_SUBS.length === 7;   /* v89.157：+ 人事/内政/市易 */""",
    [u'DATA.MSG_SUBS.length === 7'])

# ---------- ⑥ §155① 每页条数 ----------
rep('I6-155num',
    u"""    check('§155① 实测：每页条数按高度铺满（sys 21 / 单标签 25 / war 18 · 旧固定 15/10）', (function () {
      var bk = G.ui._msgTag;
      G.ui._msgTag = 'gather';
      var a = G.ui.docPerOf('sys');
      G.ui._msgTag = bk;
      var b = G.ui.docPerOf('sys'), c = G.ui.docPerOf('war');
      return a === 25 && b === 21 && c === 18 && G.ui.MSG_PER === 15 && G.ui.DOC_PER === 10;
    })());""",
    u"""    check('§157① 实测：每页条数按高度铺满（sys 24 / 单标签 28 / war 21 · v89.157 布局 px 修正，旧 21/25/18）', (function () {
      var bk = G.ui._msgTag;
      G.ui._msgTag = 'gather';
      var a = G.ui.docPerOf('sys');
      G.ui._msgTag = bk;
      var b = G.ui.docPerOf('sys'), c = G.ui.docPerOf('war');
      return a === 28 && b === 24 && c === 21 && G.ui.MSG_PER === 15 && G.ui.DOC_PER === 10;
    })());""",
    [u'sys 24 / 单标签 28 / war 21'])

rep('I7-155const',
    u"""    check('§155① 行高/头高常量 = 实测量（改版式后重量更新的锚点）',
      G.ui.DOC_LINE_H.sys > 24 && G.ui.DOC_LINE_H.sys < 26 && G.ui.DOC_HEAD_H === 127
        && G.ui.DOC_TASK_H === 104 && G.ui.DOC_FOOT_H === 28);""",
    u"""    check('§157① 行高/头高常量 = 实测量（布局 px；v89.157 与 clientHeight 同尺）',
      G.ui.DOC_LINE_H.sys === 22.4 && G.ui.DOC_LINE_H.war === 30.0
        && G.ui.DOC_HEAD_H === 114 && G.ui.DOC_TASK_H === 93 && G.ui.DOC_FOOT_H === 19
        && G.ui.DOC_GUARD_H === 18);""",
    [u'G.ui.DOC_HEAD_H === 114'])

# ---------- ⑧ §156④ 参数表 regex + 标题 ----------
rep('I8-156reg',
    u"""    check('§156④ 参数表在 DATA（唯一旋钮 · 数据驱动）',
      /DATA\\.SCOUT_RULE = \\{ base: 0\\.85, perLv: 0\\.015, perStar: 0\\.05, lo: 0\\.40, hi: 0\\.97 \\};/.test(d156));""",
    u"""    check('§157② 侦察参数表（老板 2：基础 50% + 余下按资质/等级差匹配）',
      /DATA\\.SCOUT_RULE = \\{ base: 0\\.50, perLv: 0\\.02, perStar: 0\\.08, lo: 0\\.10, hi: 0\\.95 \\};/.test(d156));""",
    [u'base: 0\\.50, perLv: 0\\.02'])

rep('I8b-156title',
    u"""    check('§156④ 侦察成功率：同资质同等级 85% / 弱将下限 / 无守将必成（唯一出口）', (function () {""",
    u"""    check('§156④/§157② 侦察成功率：同资质同等级 = base（现 50%）/ 弱将下限 / 无守将必成（唯一出口）', (function () {""",
    [u'同资质同等级 = base（现 50%）'])

# ---------- ⑨ §156③ 升级：station 也隐三块 ----------
rep('I9-station',
    u"""        ok = html.indexOf('exp-a-est') < 0 && html.indexOf('派驻上限') >= 0 && html.indexOf('exp-a-cargo') < 0;
        if (!ok) _why156 = 'html.len=' + html.length + ' est=' + html.indexOf('exp-a-est');""",
    u"""        /* v89.157（老板 1）：station 也**不接战** → 接战三块（计略/方案/出征战术）一并隐 */
        ok = html.indexOf('exp-a-est') < 0 && html.indexOf('派驻上限') >= 0 && html.indexOf('exp-a-cargo') < 0
          && html.indexOf('exp-a-tactic') < 0 && html.indexOf('exp-a-plan') < 0 && html.indexOf('exp-a-tacmenu') < 0
          && html.indexOf('exp-a-modes') >= 0 && html.indexOf('exp-a-items') >= 0;
        if (!ok) _why156 = 'html.len=' + html.length + ' est=' + html.indexOf('exp-a-est')
          + ' tactic=' + html.indexOf('exp-a-tactic');""",
    [u'station 也**不接战**'])

print('I 段完成')
