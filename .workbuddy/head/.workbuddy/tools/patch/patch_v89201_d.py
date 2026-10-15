# -*- coding: utf-8 -*-
"""v89.201 批次D：smoke§201 + e2e§201 插入 + e2e 措辞升级 + 档案补录"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

D = 'E:/Deepseekdb/'
S = D + 'smoke-test.js'
E = D + 'e2e-test.js'
A = D + '需求档案.md'

# ══════════ D1 · smoke：§201 段插入（'结果：' 锚前） ══════════
s = rd(S)
if '§201④ 侦查单页信息零缺失' in s:
    print('[skip] D1 smoke §201 段')
else:
    sec = rd(D + '.workbuddy/tmp/sec201.js')
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c == 1, 'D1 anchor=' + str(c)
    s = s.replace(anchor, sec.rstrip('\n') + "\n\n" + anchor)
    wr(S, s)
    print('[ok] D1 smoke §201 段')

# ══════════ D2 · e2e：§201 段插入（'return finish();' 锚前） ══════════
e = rd(E)
if '§201① 侦查真跑成功' in e:
    print('[skip] D2 e2e §201 段')
else:
    sec2 = rd(D + '.workbuddy/tmp/sec201e2e.js')
    anchor2 = "\n\n  return finish();"
    c2 = e.count(anchor2)
    assert c2 == 1, 'D2 anchor=' + str(c2)
    e = e.replace(anchor2, "\n" + sec2.rstrip('\n') + anchor2)
    wr(E, e)
    print('[ok] D2 e2e §201 段')

# ══════════ D3 · e2e：侦查面板「两段」措辞升级为单页口径 ══════════
e = rd(E)
o3 = """  check('侦查面板分「敌情 / 可图之利」两段',
    sm27.textContent.indexOf('敌情') >= 0 && sm27.textContent.indexOf('可图之利') >= 0);"""
n3 = """  /* v89.201（老板 1）：面板单页化 —— 「两段」升级为「四板块同页」判据 */
  check('侦查面板单页四板块（敌情 / 城中虚实 / 可图之利 同页）',
    sm27.textContent.indexOf('敌情') >= 0 && sm27.textContent.indexOf('可图之利') >= 0
    && sm27.querySelectorAll('[data-action="scout-page"]').length === 0);"""
if o3 in e:
    e = e.replace(o3, n3)
    wr(E, e)
    print('[ok] D3 e2e 措辞升级')
else:
    print('[skip] D3 或已升级')

# ══════════ D4 · 档案补录（总览行 + 明细段，幂等） ══════════
a = rd(A)
if u'| v89.201 |' in a:
    print('[skip] D4 档案总览行')
else:
    # 找 v89.200 总览行尾，插其后
    lines = a.split('\n')
    idx = -1
    for i, ln in enumerate(lines):
        if ln.startswith(u'| v89.200 '):
            idx = i; break
    assert idx >= 0, 'D4 v89.200 行未找到'
    row = (u'| v89.201 | 2026-10-05 | 3 | '
           u'**侦查单页化（去分页四板块 + 编制三栏点验网格）· 铁匠铺多选一次打造 · '
           u'百炼强化专属界面 + 滚动回顶修复**'
           u'（老板：「侦查报告直接一页显示，不用额外点一个分层。内容划分好板块，不要缺失，也不要重复」'
           u'「铁匠铺打造套装可以多选套件，一次性打造」'
           u'「百炼强化应该参考打造界面或背包装备界面，一个专属界面进行强化操作。'
           u'而且目前点一次，滚动条就自动回到顶部，又得手动滚动下来」） | '
           u'已完成（详见 docs/v89201-侦查单页与多选打造.md） |')
    lines.insert(idx + 1, row)
    wr(A, '\n'.join(lines))
    print('[ok] D4a 档案总览行')

a = rd(A)
if u'## v89.201' in a:
    print('[skip] D4b 档案明细段')
else:
    detail = u'''

---

## v89.201（2026-10-05）侦查单页化 · 铁匠铺多选打造 · 百炼强化专属界面

**需求（老板原文）**：
1. 「侦查报告直接一页显示，不用额外点一个分层。内容划分好板块，不要缺失，也不要重复」
2. 「铁匠铺打造套装可以多选套件，一次性打造」
3. 「百炼强化应该参考打造界面或背包装备界面，一个专属界面进行强化操作。而且目前点一次，滚动条就自动回到顶部，又得手动滚动下来」

**交付**：
- ① 侦查面板**单页四板块**（敌情 / 城中虚实 / 可图之利 / 顺手所得）——两页签机制四件（SCOUT_PAGES / scout-page case / 页号 / 翻页锚点）整体退役；
  编制由两列表格改**三栏点验网格**（单页装不下的最大块：9 兵种 375px → ~130px）；档位改 xxl+tall。
  实机：9 兵种与 18 兵种极端载荷 over 均 = 0；信息零缺失（六层各自有落点、逐字段核对）。
- ② 打造**多选一次打造**：选中从单值升级为保序数组（`_forgeSelList`）；点选 toggle、底键「打造 N 件」、
  ✕ 清空、⚑ 全选（toggle、作用域=当前筛选池）；`GAME.doForge` 无参取选集**逐件结算**
  （能造的造出、缺料的留下并汇报）；实机真点两张卡 → 一次入包 2 件。
- ③ 百炼强化**专属界面**：xxl 档 + 筛选（全部/未满/满级）+ 3 列网格卡片（品阶图/名称·序号/大号 +N/下级成本）+
  点选 + 底部唯一强化键（「点选 + 底键」形态照打造面板）+ 分页（15/页）。
  **滚动回顶修复**：真因 = live 快照清单漏了真滚动容器 `.m-body`（`.inner-shell` 是 overflow:hidden，
  滚动发生在其中的 m-body —— 历史注释与实际 DOM 不符）→ 补进唯一清单 + 新增 `ui.reopenKeepScroll`
  通用出口（doEnhance / enhPick / doForge 三处接线）。
  实机实证：33 件造可滚场景 → scrollTop 300 → 点选触发重开 → **仍 300**（修前必为 0）。
- **顺带（机制级收益）**：所有 live 面板的 `.m-body` 滚动位自本轮起都被保留（不止百炼）。

**由需求引出的真 bug**：
- `ui._liveSnap / _liveRestore` 的滚动容器清单没有 `.m-body`（真滚动容器）——
  所有"操作后重开 / live 重绘"的弹窗滚动位都无法保留（百炼强化"点一次回顶部"的真因）。

**验证与复现**：见 docs/v89201-侦查单页与多选打造.md
'''
    wr(A, a.rstrip('\n') + detail + '\n')
    print('[ok] D4b 档案明细段')

print('批次D 完成')
