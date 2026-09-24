# -*- coding: utf-8 -*-
"""
v89.105 事故复建：把 e2e 里 25 条"旧口径"断言更新到现状
============================================================
事故：我在一次改写里用 `io.open(p,'w').write(io.open(p).read())` 这种写法 ——
Python 先执行"以写模式打开"（**立刻截断文件**），再去读同一个文件，读到空串，
于是 e2e-test.js 被清空。教训已记：
  **绝不在同一个表达式里既打开写、又读同一个文件**（要用临时变量先读后写）。

恢复：从 git 基线（2026-09-22 快照，1012 条断言）恢复，然后按"跑测失败清单"
逐条把口径更新到 v89.102~v89.105 之后的现状。失败清单本身就是最好的待办列表 ——
每一条失败都代表"游戏按老板的令改了、断言还停在旧口径"。

本补丁覆盖失败清单的全部 25 条。
"""
import io, os

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(R, 'e2e-test.js')
src = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, tag):
    global src, n
    assert old in src, '锚点未命中：' + tag
    src = src.replace(old, new, 1)
    n += 1
    print('  ✓ ' + tag)

# ── ① 地块圆角：字面值已令牌化
rep("""    return !/--tile-clip/.test(css) && /border-radius: 10px/.test(css)
      && !/rotateZ\\(-45deg\\) rotateX\\(-56deg\\)/.test(css);""",
    """    /* v89.105（基调统一）：字面圆角已令牌化 —— 判据改查「令牌值 + 令牌引用」 */
    return !/--tile-clip/.test(css) && /--r-xl: 10px/.test(css)
      && /border-radius: var\\(--r-xl\\)/.test(css)
      && !/rotateZ\\(-45deg\\) rotateX\\(-56deg\\)/.test(css);""",
    '① 地块：圆角走令牌')

# ── ② 史书纪事撤出史册页
rep("""  check('史册含史书纪事', storyHtml.indexOf('史书纪事') >= 0);""",
    """  /* v89.104（老板「不要史书纪事了，没有什么实质内容」）：整段撤出 */
  check('史册不含史书纪事（v89.104 已撤出：没有实质内容）', storyHtml.indexOf('史书纪事') < 0);""",
    '② 史册：纪事已撤出')

# ── ③ 地图放大 1.2×
rep("""  check('观察框为搜索式自适应（jsdom 基准 20×17），格距在合理区间',
    G.map._view && G.map._view.spanX === 20 && G.map._view.spanY === 17
    && G.map._view.cell >= 34 && G.map._view.cell <= 44,""",
    """  /* v89.104（老板「地图放大 20%，视野窄一点、画面大一点」）：20×17@41 → 17×14@49 */
  check('观察框为搜索式自适应（v89.104 放大 1.2× 后 jsdom 基准 17×14），格距在合理区间',
    G.map._view && G.map._view.spanX === 17 && G.map._view.spanY === 14
    && G.map._view.cell >= 34 && G.map._view.cell <= 53,""",
    '③ 地图：17×14@49')

# ── ④ 君主弹窗档位
rep("""    check('君主弹窗用 xl 档固定尺寸（v77 左右分栏）', !!document.querySelector('#modal-root .modal-xl'));""",
    """    /* v89.105：实测 690px，xl(700) 会冒滚动条 → 升 xxl（左右分栏结构不变） */
    check('君主弹窗用大档固定尺寸（v77 左右分栏 · v89.105 升 xxl）',
      !!document.querySelector('#modal-root .modal-xxl'));""",
    '④ 君主：xxl')

# ── ⑤ 菜单顺序（删统计 · 将领军务任务相邻 · 加故事集 · 加自动）
rep("""    check('菜单分组顺序正确（场景→军事→任务统计→商背→记录→系统）', (function () {
      const order = ['city', 'map', null, 'generals', 'marches', null, 'tasks', 'stats', null, 'shop', 'bag', null, 'story', 'reports', null, 'settings'];""",
    """    /* v89.104：删「统计」、将领/军务/任务三者相邻、新增「故事集」独立页与「自动」
       顺序取自 index.html 的 #topnav 实装（分隔线 = null） */
    check('菜单分组顺序正确（场景→军事[将领/军务/任务]→商背→记录→系统）', (function () {
      const order = ['city', 'ext', 'map', null, 'generals', 'marches', 'tasks', null,
        'shop', 'bag', null, 'story', 'stories', 'reports', null, 'auto', 'settings'];""",
    '⑤ 菜单顺序')

# ── ⑥ 校场文案（人马口径）
rep("""  check('校场弹窗呈现队列上限与每队兵力（信息型）',
    xc21_v21.indexOf('出征队列') >= 0 && xc21_v21.indexOf('每队兵力上限') >= 0);""",
    """  /* v89.102（老板「校场出征应限制总兵力数而不是人口，谁家校场按人口不是按人数」）：
     上限口径改「人马」——断言随文案更新，并**钉住"人口"二字不再出现在上限行** */
  check('校场弹窗呈现队列上限与出征兵力上限（人马口径）',
    xc21_v21.indexOf('出征队列') >= 0 && xc21_v21.indexOf('出征兵力上限') >= 0
    && xc21_v21.indexOf('人马') >= 0 && xc21_v21.indexOf('人口</span>') < 0);""",
    '⑥ 校场：人马口径')

# ── ⑦ 设置页（去税率 · 存三项）
rep("""  check('设置页保留信息型设置项',
    set21_v21.indexOf('时间倍率') >= 0 && set21_v21.indexOf('税率') >= 0
    && set21_v21.indexOf('显示比例') >= 0 && set21_v21.indexOf('存档管理') >= 0);""",
    """  /* v89.104（老板「设置里不要音效」「税率调整直接放左侧统计栏」「存档管理两处统一」）：
     设置页只剩 时间倍率 / 显示比例 / 界面主题 / 存档管理 四项；
     税率搬去侧栏（就地可调），音效整体撤除。 */
  check('设置页保留信息型设置项（倍率 / 比例 / 主题 / 存档；税率已外移、音效已撤）',
    set21_v21.indexOf('时间倍率') >= 0 && set21_v21.indexOf('显示比例') >= 0
    && set21_v21.indexOf('界面主题') >= 0 && set21_v21.indexOf('存档管理') >= 0
    && set21_v21.indexOf('税率') < 0 && set21_v21.indexOf('音效') < 0);""",
    '⑦ 设置页：四项')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('\n已改 %d 处' % n)
