# -*- coding: utf-8 -*-
"""v89.40 补丁 3/3：文档层（需求档案 / 设计规范 / 工作备忘 / 工作记忆）"""
import io, os, sys

FILES = [
    (r'E:\Deepseekdb\需求档案.md', 'crlf'),
    (r'E:\Deepseekdb\docs\设计规范.md', 'crlf'),
    (r'E:\Deepseekdb\docs\AI工作备忘.md', 'lf'),
    (r'C:\Users\18811\WorkBuddy\2026-09-17-02-19-29\.workbuddy\memory\2026-09-19.md', 'lf'),
]

REQ = u'''
### v89.40 · 一次加点（数量框批量）+ 君主忠诚定案（2026-09-19 · 老板「1.将领属性增加自由属性点时，可以输入计划增加的自由属性点数量，一点一点加太慢了 2.君主既然不会掉忠诚，可以直接不要忠诚度那一行设定」）

**落地**
- **一次加点**：加点弹窗的「＋1」升级为「数量框 + 加点」——默认 1（单点仍一键），可填数或点「最多」；
  `GAME.addFreePoint(g, stat, qty)` 支持批量（qty 缺省 1；超余额按余额截断、回报实加数），
  动作分发经 `data-qty-from` 透传数量（复用 ui.qtyInput / ui.qtyValueOf 既有部件，零新样式）。
- **君主忠诚定案**：君主**永不掉忠** —— 出征战败挫伤豁免君主（`battle` 战败分支以 `isLordGeneral` 守卫，
  与「不可解雇 / 绝不离去」同源）；详情页与悬停浮层对君主**整体不出忠诚行 / 忠诚字样**
  （赏赐入口随忠诚行一并收起），普通将领一切照旧。
- 注：核查发现在此之前**君主出征战败确实会掉忠**（实测 80 → 72）——本版守卫把「君主不会掉忠诚」
  从设定声明变为事实，先立守卫、再删显示行，两件事一起做才自洽。

**验证**：smoke **2305/0**（+6：批量单元 / 批量结构 / 守卫源码 / 君主战败运行时对照 / 档案 / 浮层）·
e2e **946/0**（+6：真实点击——一次加 10 点全链 + 君主档案无忠诚行）· audit 全 0。
- 细节：`docs/设计规范.md` §54；`docs/AI工作备忘.md` §61。
'''

SPEC = u'''
## 54. v89.40 一次加点（批量）+ 君主忠诚定案（2026-09-19）

- **一次加点（批量）**：唯一出口 `GAME.addFreePoint(g, stat, qty)` —— qty 缺省 1（单点口径与旧版完全一致）；
  超余额按余额截断（回报实加数）。弹窗 UI：「数量框（− / 输入 / ＋ / 最多）+ 加点」按钮，
  `data-qty-from` 从按钮透传数量（复用 `ui.qtyInput` / `ui.qtyValueOf`）。
- **君主忠诚定案**：
  ① `battle` 战败分支：`isLordGeneral(gen)` 豁免忠诚扣减（含"忠诚 -N"负日志）；
  ② `ui.genPane` / `ui.genRow`：君主不出忠诚行与赏赐入口、悬停不带忠诚（`isLordGen` 单点判定）。
- **口径**：忠诚对君主是死设定（恒 100）——不显示、不扣减、不参与一切判定；普通将领全链不变。

**验证**：smoke 2305/0 · e2e 946/0 · audit 全 0。
'''

NOTE = u'''
### 61. v89.40 · 一次加点 + 君主忠诚（工程视角）

1. **「升级按钮」优先于「加新控件」**：老板嫌"一点一点加太慢"——解法不是新开批量面板，而是把原「＋1」按钮
   就地升级为「数量框 + 加点」（复用 ui.qtyInput / ui.qtyValueOf 既有部件，零新样式）；
   默认 1 保住单点一键的手感，批量走填数或「最多」。
2. **先验证用户前提，再动手**：老板说「君主既然不会掉忠诚」——探针一跑，发现当时**确实会掉**（战败 80→72）。
   于是两件事一起做：先让守卫落地（使前提为真）、再删显示行；否则只是把矛盾从界面挪进代码。
3. **「删一行」按行级判据断言**：君主 pane 里还留着「帐下不离…不会因忠诚低下离去」的特权说明（合理保留）——
   断言用 `gd-line">忠诚`（行级）而不是裸「忠诚」二字，避免把合理文案误伤为回归。
4. **测试环境的前置状态要用诊断兜底**：运行时断言一度"缺对象跳过"——加诊断后发现是套件早段用例
   （S18.generals.length = 1）截掉了君主，不是产品 bug。修法：断言自足构造（现场补临时君主 / 对照将、打完移除），
   并保留"缺对象"的显式分支（不许静默放空）。
'''

MEM = u'''
## 第四轮 · v89.40 一次加点（批量）+ 君主忠诚定案

- **一次加点**：加点弹窗「＋1」→「数量框 + 加点」（默认 1；可填数 / 最多）；`addFreePoint(g, stat, qty)` 批量、
  超余额按余额截断；main 分发经 `data-qty-from` 透传（复用 ui.qtyInput / qtyValueOf）。
- **君主永不掉忠**：battle 战败守卫豁免君主（此前实测会掉 80→72——前提核查抓到的真差异）；
  详情 / 悬停对君主整体不出忠诚行（赏赐入口同收起）；普通将领照旧。
- 门禁：check 500 全绿 · smoke **2305/0** · e2e **946/0** · audit 全 0。
- 产物：`js/state|ui|main|battle.js` · 测试两套 · 补丁 `patch_v8940_points_loyalty.py` / `patch_v8940_tests.py` ·
  文档三处同步（需求档案 v89.40 · 设计规范 §54 · 备忘 §61）。
'''

for path, eol in FILES:
    src = io.open(path, encoding='utf-8', newline='').read()
    blocks = {'需求档案': REQ, '设计规范': SPEC, 'AI工作备忘': NOTE, '2026-09-19': MEM}
    key = [k for k in blocks if k in path][0]
    block = blocks[key]
    if u'v89.40' in src:
        print('SKIP  %s（已含 v89.40）' % key)
        continue
    nl = '\r\n' if eol == 'crlf' else '\n'
    body = block.replace('\n', nl)
    out = src.rstrip('\r\n') + nl + nl + body
    io.open(path, 'w', encoding='utf-8', newline='').write(out)
    back = io.open(path, encoding='utf-8', newline='').read()
    assert u'v89.40' in back, '落盘回查失败：' + path
    print('OK    %s ← %s' % (key, os.path.basename(path)))

print('\nALL DONE（4 处）')
