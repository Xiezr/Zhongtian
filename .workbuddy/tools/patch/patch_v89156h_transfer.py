# -*- coding: utf-8 -*-
# v89.156 patch H：调运（transfer · 不接战）不渲染接战专属三块 —— 修"本境调运面板溢出 141px"
#   modals 审计实锤：左列 目标76+主将79+quad439+道具98+罐重223 ≈ 915 > 840。
#   语义：transfer 是"兵力押运、不接战"（方式说明原文），计略/阵位/配置无用途。
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

if u'v89.156：调运（transfer · 不接战）**不渲染接战专属三块**' in s:
    print('skip（已落盘）')
else:
    def wrap(a_mark, b_mark, tag):
        """把 a_mark 到 b_mark 之间的段整体包进 if (!ui._expOwn) { ... }（缩进 +2）。"""
        global s
        a = s.index(a_mark)
        b = s.index(b_mark, a) if b_mark else s.index(u"\n    html += '</div>';  /* /.exp-quad */", a) + len(u"\n    html += '</div>';  /* /.exp-quad */") + 1
        seg = s[a:b]
        assert u'exp-sec' in seg, tag + ' seg check'
        # 缩进 +2（保留空行）
        ind = u'\n'.join([(u'  ' + l if l.strip() else l) for l in seg.split(u'\n')])
        NEW = (u"    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（%s）——\n"
               u"       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；\n"
               u"       语义也正：transfer 是\"兵力押运、不接战\"，计略/阵位/阵型配置无用途。 */\n"
               u"    if (!ui._expOwn) {\n" + ind + u"    }\n") % tag
        s = s[:a] + NEW + s[b:]
        print(tag + ' wrapped')

    wrap(u"    /* ⑤ 计略（2×2 左上）", u"    /* ④ 出征方式（2×2 右上）", u'计略')
    wrap(u"    /* ⑦ 方案（2×2 左下 · v89.59 需求 6）", u"    /* ⑧ 出征战术（2×2 右下 · v89.59 需求 6）", u'方案')
    wrap(u"    /* ⑧ 出征战术（2×2 右下 · v89.59 需求 6）", None, u'出征战术')
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('patch H done, len', orig, '->', len(s))

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'if (!ui._expOwn) {') >= 3, 'wrap count=' + str(chk.count(u'if (!ui._expOwn) {'))
assert u'/* /.exp-quad */' in chk
print('SELF-CHECK PASS')
