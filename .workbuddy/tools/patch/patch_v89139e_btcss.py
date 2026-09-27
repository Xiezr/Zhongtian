# -*- coding: utf-8 -*-
"""v89.139 批四-2：index.html —— 战场两侧 2 列网格 CSS + 列宽调整"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'index.html')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① bt-board 列宽 + 2 列网格 ──
rep("""  /* ---- 上部分三段：左我军（1/4）· 中战场（1/2）· 右敌军（1/4） ---- */
  /* v89.117（老板「左右分别六分之一作为兵种设置区域，让中间战斗界面尽量大」）：
     1fr : 4fr : 1fr = 1/6 : 2/3 : 1/6（原先 1:2:1 = 各 1/4、中间 1/2）。 */
  .bt-board { display: grid; grid-template-columns: 1fr 4fr 1fr; gap: var(--sp-2); align-items: start; }
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
  .bt-side-h { font-size: var(--fs-cap); color: var(--text-dim); padding: 0 var(--sp-1) var(--sp-0); }
  .bt-rrow { display: flex; align-items: center; gap: var(--sp-1); padding: var(--sp-0) var(--sp-1);
    border-radius: var(--r-md); background: rgba(var(--sh-rgb), .26); border: 1px solid var(--line);
    min-width: 0; }
  .bt-side.mine .bt-rrow { border-color: rgba(var(--gold-soft-rgb), .38); }
  .bt-side.foe .bt-rrow { border-color: rgba(var(--foe-rgb), .34); }
  .bt-rrow.dead { opacity: .38; }""",
"""  /* ---- 上部分三段：左我军 · 中战场 · 右敌军 ---- */
  /* v89.117（老板「左右分别六分之一作为兵种设置区域，让中间战斗界面尽量大」）：
     1fr : 4fr : 1fr = 1/6 : 2/3 : 1/6（原先 1:2:1 = 各 1/4、中间 1/2）。
     v89.139（老板 1）：两侧列表改**每侧 2 列**（全兵种列出）→ 侧栏需更宽：
     1.5fr : 3fr : 1.5fr，实测每侧 ~290px、每格 ~142px。 */
  .bt-board { display: grid; grid-template-columns: 1.5fr 3fr 1.5fr; gap: var(--sp-2); align-items: start; }
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
  .bt-side-h { font-size: var(--fs-cap); color: var(--text-dim); padding: 0 var(--sp-1) var(--sp-0); }
  /* v89.139（老板 1）：「压缩战场界面兵种显示，内容更紧凑，默认兵种全部列出呈 2 列，
     本次包含的兵种亮色，没有的兵种图标灰暗」——
     每格 = 上"图标+数量+名称"、下"动作/目标下拉"（两行），2 列排布。 */
  .bt-cards { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-0); align-content: start; }
  .bt-card { display: flex; flex-direction: column; gap: 1px; padding: 1px var(--sp-1);
    border-radius: var(--r-md); background: rgba(var(--sh-rgb), .26); border: 1px solid var(--line);
    min-width: 0; }
  .bt-card .bt-ric { flex-direction: row; align-items: center; gap: var(--sp-0); width: auto; }
  .bt-card .bt-ico svg, .bt-card .bt-ico img { width: 16px; height: 16px; vertical-align: middle; }
  .bt-card .bt-rnm { max-width: none; flex: 1 1 auto; }
  .bt-u2 { display: flex; gap: 2px; min-width: 0; }
  .bt-u2 .bt-sel { flex: 1 1 0; min-width: 0; height: 19px; padding: 0 2px; font-size: var(--fs-cap); }
  .bt-u2 .bt-ro { flex: 1 1 0; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bt-side.mine .bt-card { border-color: rgba(var(--gold-soft-rgb), .38); }
  .bt-side.foe .bt-card { border-color: rgba(var(--foe-rgb), .34); }
  .bt-card.dead { opacity: .38; }
  /* 未参战：图标与名称**灰暗**（老板原话「没有的兵种图标灰暗」） */
  .bt-card.off { opacity: .32; filter: grayscale(.55); }""",
    'bt-board 2 列 CSS')

assert '\r\n' not in s
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '.bt-cards' in chk and '.bt-card.off' in chk and '1.5fr 3fr 1.5fr' in chk, '落盘校验失败'
print('✅ index.html：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
