# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119g_report_dedup.py — 战报正文页去重与收高（v89.119）
# ----------------------------------------------------------------
# 实机量测（1800×1000 视口 / 13 回合 / 7 兵种载荷）：
#   .inner-panel 内容 1059px vs 可见 840px → **溢出 219px**（既有载荷问题，非本轮文本改动引入）。
#   逐段：按钮 37 · 标题 35 · 时间 16 · **简报 251** · seal 17 · 条带 62 · 回放控件 26+15 ·
#         seal 17 · 纪要 235+分页 44 · seal 17 · 损耗表 169
# 可压的重复：简报里由 battle.js 写出的「【兵种损耗】…」文本段（7 兵种 ≈ 110~150px）
#   与下方**结构化表 rp-tbl** 是同一份信息的两次呈现 → 渲染时剥文本版。
#   `report.body` 本体不动（列表摘要 / 旧档照旧）；唯一出口 `ui.stripBodyDup`。
# 另：回合纪要每页 5 → 4 行（12/13 回合 → 3~4 页，省一条长行的高度）。
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
BAK = R + '.workbuddy/backup/v89119/'
files = {}


def load(rel):
    p = R + rel
    files[p] = io.open(p, encoding='utf-8').read()
    return files[p]


def sub(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点 %d 次 → 中止' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ ' + tag)


def pc(s):
    return s.count('{') - s.count('}')


load('js/ui.js')

# ① 在 viewReportText 前插入唯一出口 stripBodyDup
sub(R + 'js/ui.js',
    "  ui.viewReportText = function (i) {",
    """  /* v89.119：战报正文页的**去重** —— 简报里由 battle.js 写出的「【兵种损耗】…」
     段，与下方结构化表（rp-tbl）是同一份信息的两次呈现（实机量：251px 的简报里
     约 110~150px 是它，而整页在 13 回合 / 7 兵种的载荷下溢出 200px+）。
     这里只在**渲染时**剥掉文本版；`report.body` 本体不动 ——
     列表摘要 / 旧存档等其它入口照旧能看到损耗。 */
  ui.stripBodyDup = function (body) {
    var s = String(body || '');
    var i = s.indexOf('【兵种损耗】');
    if (i < 0) return s;
    var head = s.slice(0, i).replace(/<br>\\s*$/, '');   /* 去掉引出它的那个 <br> */
    var lines = s.slice(i).split('<br>');
    var k = 1;
    /* 损耗段 = 「【兵种损耗】」+ 后续**不以【开头**的行（"我军 …" / "敌军 …"） */
    while (k < lines.length && (lines[k] || '').indexOf('【') !== 0) k++;
    var tail = lines.slice(k).join('<br>');
    return head + (tail ? '<br>' + tail : '');
  };

  ui.viewReportText = function (i) {""",
    '① 插入 ui.stripBodyDup')

# ② 简报渲染走剥离
sub(R + 'js/ui.js',
    """      '<div style="background:rgba(var(--sh-rgb),.3);border-radius:6px;padding:12px;font-size:var(--fs-lead);line-height:1.8;">' +
        r.body + '</div>';""",
    """      '<div style="background:rgba(var(--sh-rgb),.3);border-radius:6px;padding:12px;font-size:var(--fs-lead);line-height:1.8;">' +
        ui.stripBodyDup(r.body) + '</div>';   /* v89.119：损耗文本段在下方有结构化表，这里去重 */""",
    '② 简报渲染走剥离')

# ③ 回合纪要每页 5 → 4 行
sub(R + 'js/ui.js',
    "      var pgL = ui.modalPage('rlog', rlog, 5, function () { ui.viewReportText(i); });",
    "      var pgL = ui.modalPage('rlog', rlog, 4, function () { ui.viewReportText(i); });",
    '③ 纪要每页 5→4 行')

# ④ smoke §100 加 ⑩ 断言
load('smoke-test.js')
sub(R + 'smoke-test.js',
    "    /* ⑨ 兜底：找不到宿主的孤立 counter 独立成格（不静默丢事件） */",
    """    /* ⑩ 战报正文页去重：简报里的【兵种损耗】文本段被剥离（结构化表仍在） */
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
    check('⑩ 战报正文页去重：剥离简报里的【兵种损耗】文本段（结构化表仍在）', c10.ok, c10.dbg);

    /* ⑨ 兜底：找不到宿主的孤立 counter 独立成格（不静默丢事件） */""",
    '④ §100 加 ⑩ 断言')

# 落盘
print('\n落盘：')
for p, s in files.items():
    if '<<<<<<<' in s or '>>>>>>>' in s:
        print('!! 冲突标记：%s' % p); sys.exit(1)
    bak = BAK + os.path.basename(p)
    if os.path.exists(bak):
        b = io.open(bak, encoding='utf-8').read()
        print('  → %s（相对备份净 { } = %+d）' % (os.path.basename(p), pc(s) - pc(b)))
    tmp = p + '.tmp119g'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
print('补丁 G 完成')
