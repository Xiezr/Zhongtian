# -*- coding: utf-8 -*-
"""v89.137 补丁 I：ui.js 专精行 tier0 文案 + smoke 实测断言升级（三档两态）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

# ══════════ ① ui.js：tier 0 时不显示"下一档"（"Lv12 起"已是目标，别重复） ══════════
p1 = os.path.join(ROOT, 'js', 'ui.js')
s1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
n1 = len(s1)

old = """          + (t137 < tiers137.length
              ? '<span style="color:var(--text-dim);">（下一档 Lv' + tiers137[t137] + ' → ×' + (t137 + 1) + '）</span>'
              : '<span style="color:var(--text-dim);">（已满档 ×' + tiers137.length + '）</span>')
          + '</span></div>';"""
new = """          /* tier 0 时"Lv12 起"本身已是目标，不再重复一条"下一档"；已到档才给"下一档/已满档" */
          + (t137 > 0
              ? (t137 < tiers137.length
                  ? '<span style="color:var(--text-dim);">（下一档 Lv' + tiers137[t137] + ' → ×' + (t137 + 1) + '）</span>'
                  : '<span style="color:var(--text-dim);">（已满档 ×' + tiers137.length + '）</span>')
              : '')
          + '</span></div>';"""
if s1.count(old) != 1:
    print('❌ ui 锚点命中 %d 次' % s1.count(old)); sys.exit(1)
s1 = s1.replace(old, new)
assert '\r\n' not in s1, '行尾混入 CRLF'
tmp = p1 + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s1)
os.replace(tmp, p1)
chk1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
assert 't137 > 0' in chk1, '未落盘'
ok.append('ui 专精行 tier0')
print('✅ ui.js：%d → %d 字节' % (n1, len(chk1)))

# ══════════ ② smoke：实测断言 → 两态（tier0 目标 / tier1 下一档） ══════════
p2 = os.path.join(ROOT, 'smoke-test.js')
s2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
n2 = len(s2)

old2 = """      /* v89.137：三档形态 —— 标题 + 逐档门槛 + "下一档"提示（1 级民房 = 档 0 时） */
      return html.indexOf('建筑专精') >= 0
        && html.indexOf('Lv12') >= 0 && html.indexOf('下一档 Lv24') >= 0;"""
new2 = """      /* v89.137：三档形态两态量测 ——
         ① 1 级民房（档 0）：标题 + 逐档门槛 + "Lv12 起"目标；
         ② 把该格抬到 Lv12（档 1）：出现"下一档 Lv24 → ×2"。 */
      var okA = html.indexOf('建筑专精') >= 0 && html.indexOf('Lv12') >= 0
        && html.indexOf('Lv12 起') >= 0;
      var cell = c.cells[idx];
      if (!cell.build) return false;
      var lvBak = cell.build.lvl;
      cell.build.lvl = DATA.MASTERY_TIERS[0];
      G.ui.openBuildModal(idx);
      var htmlB = (document.querySelector('#modal-root') || {}).innerHTML || '';
      cell.build.lvl = lvBak;
      return okA && htmlB.indexOf('下一档 Lv24') >= 0 && htmlB.indexOf('×1') >= 0;"""
if os.environ.get('SKIP_SMOKE') == '1' or 'htmlB.indexOf' in s2:
    print('⏭  smoke 段跳过（SKIP_SMOKE=1 或已落盘）')
else:
  if s2.count(old2) != 1:
    print('❌ smoke 锚点命中 %d 次' % s2.count(old2)); sys.exit(1)
  s2 = s2.replace(old2, new2)
  assert '\r\n' not in s2, '行尾混入 CRLF'
  tmp = p2 + '.tmp137'
  io.open(tmp, 'w', encoding='utf-8', newline='').write(s2)
  os.replace(tmp, p2)
  chk2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
  assert '下一档 Lv24' in chk2, 'smoke 未落盘'
  ok.append('smoke 两态断言')
  print('✅ smoke-test.js：%d → %d 字节' % (n2, len(chk2)))
print('完成：' + ' / '.join(ok))
