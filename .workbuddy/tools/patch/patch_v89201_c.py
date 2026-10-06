# -*- coding: utf-8 -*-
"""v89.201 批次C：百炼强化专属界面（网格卡 + 筛选 + 底键）+ 滚动回顶修复"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

D = 'E:/Deepseekdb/'
U = D + 'js/ui.js'
M = D + 'js/main.js'
H = D + 'index.html'

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    wr(path, s.replace(old, new)); print('[ok] ' + tag)

# ══════════ C1 · ui.js：百炼强化注释块 + openEnhance 区间替换 ══════════
s = rd(U)
C1_START = "  /* ============================================================\n   * 百炼强化（v77 · 老板「铁匠铺加入装备强化系统，装备可进行强化」）"
if 'ui.ENH_PER_PAGE' in s:
    print('[skip] C1 openEnhance 专属界面')
else:
    a = s.index(C1_START)
    C1_END = "  /* ============================================================\n   * v88 · 蕴养（修炼装备强化 —— 与百炼强化平行的独立面板）"
    b = s.index(C1_END, a)
    frag = rd(D + '.workbuddy/tmp/frag201_enh.txt')
    s = s[:a] + frag.rstrip('\n') + '\n\n' + s[b:]
    wr(U, s)
    print('[ok] C1 openEnhance 专属界面（区间替换）')

# ══════════ C2 · main.js：case 增加 + doEnhance 保留滚动 ══════════
rep(M, 'C2a case 增加',
    "      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;",
    """      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;
      /* v89.201（老板 3）：百炼强化专属界面 —— 点选 / 筛选 */
      case 'enh-pick': ui.enhPick(el.dataset.key); break;
      case 'enh-filter': ui.setEnhFilter(el.dataset.k); break;""",
    "case 'enh-pick': ui.enhPick(el.dataset.key); break;")

rep(M, 'C2b doEnhance 保留滚动',
    """  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openEnhance(); }
  };""",
    """  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    ui.toast(r.msg);
    /* v89.201（老板 3）：重开走 reopenKeepScroll ——
       改前是裸 ui.openEnhance()，弹窗重建、scrollTop 归零（"点一次就回到顶部"）。 */
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openEnhance); }
  };""",
    'ui.reopenKeepScroll(ui.openEnhance)')

# ══════════ C3 · index.html：.enh-rows / .enh-card CSS ══════════
rep(H, 'C3 enh 网格卡 CSS',
    "  .enh-cost { color: var(--text-dim); font-size: var(--fs-sub); }",
    """  .enh-cost { color: var(--text-dim); font-size: var(--fs-sub); }
  /* v89.201（老板 3）：百炼强化专属界面 —— 3 列网格卡片（点选 + 底部唯一强化键）。
     卡高 84px = 品阶图 68px + 上下 padding 各 8px（垂直居中由 align-items:center 保证）。 */
  .enh-rows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-4);
    grid-auto-rows: 84px; align-content: start; }
  .enh-card { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--panel-bg);
    cursor: pointer; min-width: 0; }
  .enh-card:hover { border-color: var(--gold-dark); }
  .enh-card.on { border-color: rgba(var(--gold-soft-rgb), .85);
    box-shadow: 0 0 0 1px rgba(var(--gold-soft-rgb), .45), 0 0 14px rgba(var(--gold-soft-rgb), .22); }
  .enh-card .ec-art { flex: none; }
  .enh-card .ec-mid { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .enh-card .ec-nm { display: flex; align-items: baseline; gap: var(--sp-2); min-width: 0; }
  .enh-card .ec-nm b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .enh-card .ec-tag { font-size: var(--fs-cap); color: var(--text-dim); font-style: normal; flex: none; }
  .enh-card .ec-lv { font-size: var(--fs-num); font-weight: 700; color: var(--gold-light); line-height: var(--lh-1); }
  .enh-card .ec-lv i { font-size: var(--fs-cap); color: var(--text-dim); font-weight: 400; font-style: normal; }
  .enh-card .ec-cost { font-size: var(--fs-sub); color: var(--text-dim); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }""",
    '.enh-card .ec-cost')

print('批次C 完成')
