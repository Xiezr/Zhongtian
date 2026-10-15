# -*- coding: utf-8 -*-
"""v89.112c · 弹窗整改收尾：装备 -217 / 战报 -67 的最后一轮压缩"""
import io, os, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:70])
    return s.replace(a, b, 1)

# ---------- CSS ----------
hp = os.path.join(R, 'index.html')
h = io.open(hp, encoding='utf-8').read()

a = """  .chips.gen-chips.wide { grid-template-columns: repeat(4, minmax(0, 1fr)); }"""
b = """  .chips.gen-chips.wide { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .chips.gen-chips.wide .chip { padding: 2px var(--sp-2); }   /* v89.112c：行高再收 4px */
  /* v89.112c：**只有弹窗内**才做这几处收紧 —— 视图里的行距保持原样 */
  .modal .res-line { padding: 2px var(--sp-1); }
  .modal .seal-h { margin: var(--sp-3) 0 var(--sp-2); }
  .modal .troop-card { padding: var(--sp-2); }"""
h = sub_txt(h, a, b, 'c-css')

shutil.copy2(hp, os.path.join(BK, 'index.v89112b.html'))
io.open(hp + '.tmp', 'w', encoding='utf-8', newline='').write(h)
os.replace(hp + '.tmp', hp)
print('A. index.html：3 条紧凑规则已落盘')

# ---------- JS ----------
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()

# 装备 chips：24 → 16（4 列 4 行）
a = """          per: 24, modal: true, key: 'gchips_eq', wide: true }) + '</div>' +"""
b = """          per: 16, modal: true, key: 'gchips_eq', wide: true }) + '</div>' +"""
u = sub_txt(u, a, b, 'chips16')

# 宝物 chips：24 → 16（同款）
a = """            per: 24, key: 'gchips_item', wide: true }) + '</div>'"""
b = """            per: 16, key: 'gchips_item', wide: true }) + '</div>'"""
u = sub_txt(u, a, b, 'chips16b')

# 战报回合纪要：6 → 5 行/页
a = """      var pgL = ui.modalPage('rlog', rlog, 6, function () { ui.viewReportText(i); });"""
b = """      var pgL = ui.modalPage('rlog', rlog, 5, function () { ui.viewReportText(i); });"""
u = sub_txt(u, a, b, 'rlog5')

shutil.copy2(up, os.path.join(BK, 'ui.v89112b.js'))
io.open(up + '.tmp', 'w', encoding='utf-8', newline='').write(u)
os.replace(up + '.tmp', up)
print('B. js/ui.js：3 处已落盘')
