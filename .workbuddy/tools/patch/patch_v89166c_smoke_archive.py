# -*- coding: utf-8 -*-
"""v89.166c：smoke §166（源码级顺序断言）+ 需求档案补录。
   运行：python .workbuddy/tools/patch/patch_v89166c_smoke_archive.py"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


# ═══════════ ① smoke 插入 §166 ═══════════
sp = 'smoke-test.js'
s = rd(sp)
if '§166① 城池面板·进入城池' in s:
    print('  [skip] smoke §166 已插')
else:
    ANCHOR = "\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(ANCHOR) == 1, 'smoke 锚点=%d' % s.count(ANCHOR)
    NEW = '''
  /* ============================================================
   * §166（v89.166）：进入城池 = 菜单全关 + 直接显示城内大界面
   * 老板原话：「地图上点击我方城市，点击进入城池，城市菜单界面应关闭，直接显示城内大界面」
   * 改前取证：case 'city-enter' 关闭调用 **0 次**（弹窗盖着城内视图）；君主面板为 1 次（对照）。
   * ============================================================ */
  (function () {
    var fs166 = require('fs'), p166 = require('path');
    var m166 = fs166.readFileSync(p166.join(__dirname, 'js', 'main.js'), 'utf8');
    var segA166 = m166.slice(m166.indexOf("case 'city-enter'"), m166.indexOf("case 'city-transport'"));
    var segB166 = m166.slice(m166.indexOf("case 'lord-city-enter'"), m166.indexOf("case 'lord-promote'"));

    console.log('\\n===== §166 进入城池（菜单全关） =====');
    check('§166① 城池面板·进入城池 → closeAllModals 在 setCity 之前（先关菜单再切城）',
      segA166.indexOf('ui.closeAllModals();') >= 0
      && segA166.indexOf('ui.closeAllModals();') < segA166.indexOf('ui.setCity('));
    check('§166② 君主面板·进入城池 → 同一出口 closeAllModals（两入口统一）',
      segB166.indexOf('ui.closeAllModals();') >= 0);
    check('§166③ 负向：两段无裸 closeModal（单层出口退役）',
      segA166.indexOf('ui.closeModal();') < 0 && segB166.indexOf('ui.closeModal();') < 0);

    var arc166 = fs166.readFileSync(p166.join(__dirname, '需求档案.md'), 'utf8');
    check('§166④ 需求档案在册（v89.166 · 老板原文关键句逐字）',
      arc166.indexOf('v89.166') >= 0
      && arc166.indexOf('城市菜单界面应关闭，直接显示城内大界面') >= 0);
  })();
'''
    s = s.replace(ANCHOR, NEW + ANCHOR)
    wr(sp, s)
    print('  [ ok ] smoke §166 已插 · 新长度', len(s))

# ═══════════ ② 需求档案 ═══════════
ap = '需求档案.md'
a = rd(ap)
if 'v89.166' in a:
    print('  [skip] 档案 v89.166 已在')
else:
    anchor = '| v89.165 | 2026-09-27 | 1 |'
    i = a.find(anchor)
    assert i >= 0, '找不到 v89.165 总览行'
    j = a.find('\n', i)
    row = ('\n| v89.166 | 2026-09-27 | 1 | **进入城池 = 菜单全关 + 城内大界面**'
           '（老板：「城市菜单界面应关闭，直接显示城内大界面」）—— 改前 `case \'city-enter\'` '
           '**关闭调用 0 次**（城池面板盖着城内视图，玩家还得手动再关）；补 `closeAllModals` '
           '（清栈 + 完整关闭 · 与「种田秘境关闭键 / 开校场」同款出口）并**两入口统一**'
           '（君主面板 closeModal → closeAllModals） | 已完成（详见 docs/v89166-进入城池菜单全关.md） |')
    a = a[:j] + row + a[j:]

    detail = '''

---

## v89.166（进入城池 = 菜单全关 · 老板 1 条）

> **老板原文（逐字）**：
> 地图上点击我方城市，点击进入城池，城市菜单界面应关闭，直接显示城内大界面

### ① 病根（取证）

地图点我方城 → 弹「城池面板」（v60 起的城市菜单）→ 点「进入城池」。
`case 'city-enter'`（main.js）里只有 `setCity + setView('city') + refreshAll` ——
**没有任何关闭调用**（改前取证：`closeModal/closeAllModals` 计数 = **0**）→
弹窗继续盖在城内视图上，玩家看不出"进去了"，还得手动再关一次。
**对照**：君主面板的「进入」（`lord-city-enter`）有 1 次 `closeModal` —— 同语义两入口，一个接了一个没接（§79.1 同款结构）。

### ② 修法（两入口统一出口）

| 入口 | 改前 | 改后 |
|---|---|---|
| 城池面板 · 进入城池（老板报的） | 无关闭调用 | `ui.closeAllModals();` **在 setCity 之前**（先关菜单、再切城切视图） |
| 君主面板 · 进入（对照统一） | `ui.closeModal();`（有上级时只弹一层） | `ui.closeAllModals();` |

出口说明：`closeAllModals` = 清栈 + 完整关闭（与 v89.135「种田秘境关闭键」、v89.130「开校场」
同款既有出口）—— "进入城池"的语义 = **离开全部菜单回主界面**，单层/多层栈都关干净。

### ③ 实测证据

- **探针**（`probe_v89166_enter.js` · 8/0）：两段源码顺序 ✓（closeAllModals 在 setCity 之前）；
  动作序列真调：`openCityPanel` 后面板在（_maskEl=el）→ `closeAllModals` 后
  `_maskEl=null · _liveReopen=null · 栈空` → `setCity+setView` 后 `view=city · 当前城=新城2`。
- **e2e**（真 DOM · 点真按钮 · 7 条全过）：造第二城（江陵）→ 打开城池面板（真渲染含按钮）→
  **点「进入城池」** → 菜单全关（modal=false · stack=0）· `view=city` · 当前城=江陵 ·
  城内大界面真渲染（`.city-iso` 在）。
- **实机**（真浏览器 · 图 2 张）：面板态 → 点击后城内大界面（见 ④）。

### ④ 产物

- 图：`.workbuddy/shots/v89166-city-panel.png`（城池面板 · 进入城池键）·
  `.workbuddy/shots/v89166-city-entered.png`（点击后 · 城内大界面无弹窗）
- 补丁：`patch_v89166a_enter.py`（核心）· `patch_v89166b_e2e.py` · `patch_v89166c_smoke_archive.py`
- 探针：`probe_v89166_enter.js` ｜ 实机：`shot_v89166_enter.js` ｜ 体检：`check_v89166_shots.js`

### ⑤ 诚实缺口

- "进入城池"的两入口现在只有**城池面板**与**君主面板**两处（已全量清点 `setCity` 全部 4 个调用点：
  顶栏切换器 = 切城不切视图（无菜单上下文）· `chip-set after='city'` = 城内 chip 切城（留在弹窗是对的）——
  均无需关闭动作）；
- 城池面板打开时的"概率奇遇"叠层（v89.29）现在也会被 `closeAllModals` 一并关掉 ——
  语义正确（进入城池=离开全部菜单）。
'''
    a = a.rstrip('\n') + detail
    wr(ap, a)
    print('  [ ok ] 档案已补 · 新长度', len(a))
