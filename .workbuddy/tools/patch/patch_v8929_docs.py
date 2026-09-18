# -*- coding: utf-8 -*-
"""v89.29 文档补录：README（入口改版）/ 需求档案 / 设计规范 / 工作备忘 / 工作记忆"""
import io
import os
import sys

R = r'E:\Deepseekdb'
MEM = r'C:\Users\18811\WorkBuddy\2026-09-17-02-19-29\.workbuddy\memory\2026-09-18.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, src):
    tmp = p + '.tmp8929'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, p)


def norm(text, src):
    eol = '\r\n' if ('\r\n' in src[:4000]) else '\n'
    if eol == '\r\n':
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    return text


def edit(p, pairs, tag):
    src = read(p)
    for old, new, name in pairs:
        n = src.count(old)
        if n != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, n))
            sys.exit(1)
        src = src.replace(old, norm(new, src), 1)
    write(p, src)
    back = read(p)
    for _, new, name in pairs:
        assert norm(new, back) in back, '%s / %s' % (tag, name)
    print('OK  ' + tag)


def append(p, text):
    src = read(p)
    if not src.endswith('\n'):
        src += '\r\n' if ('\r\n' in src[:4000]) else '\n'
    write(p, src + norm(text, src))
    back = read(p)
    print('OK  append ' + os.path.basename(p))


# ============================================================ README
README = os.path.join(R, 'story', 'README.md')

ROW_SMOKE_OLD = u'| `smoke-test.js` | §81 三十八条断言（数据 / 壁画库 / 入口块 / 推进 / 入档 / 负赏赐 / 接线 / 壁画接线 / 卷 02 / 逸闻块脱三元 / 卷 03~05 / 卷 06 / 卷 07 / 卷 08 / 卷 09~18 / 卷 19~22 / 卷 23~26 / 卷 27~30 / 卷 31 / **城外建筑入口**） |'
ROW_SMOKE_NEW = u'| `smoke-test.js` | §81 四十条断言（数据 / 壁画库 / **概率奇遇引擎（候选池 · 掷骰 · 冷却 · 空池）** / 推进 / 入档 / 负赏赐 / 接线（v89.29 入口挂点） / 叠层语义 / 壁画接线 / 逐卷断言（卷 02 ~ 题材线）） |'

ROW_E2E_OLD = u'| `e2e-test.js` | §81 真实 DOM：入口 → 清单 → 阅读器（段进度 + 壁画两层）→ 走满 → 结局 → 收起 → 卷 02 民房 → 卷 03~05 锚点 → 卷 06~08 新篇 → 卷 09~30 新篇 → **卷 31 新篇（野地弹窗 / 城池面板 / 城外建筑弹窗 三处真实点击）** → 空态 |'
ROW_E2E_NEW = u'| `e2e-test.js` | §81 真实 DOM：**概率奇遇链路（点建筑命中 → 开卷 → 叠层回面板 → 冷却 → 默认不触发 → 空池 → 点地块触发）** + **逐卷直开**（阅读器 / 走满 / 入档 / 掩卷 · VOL89 表 14 篇） |'

ENTRY_OLD = u'''**入口（依附锚点）**：城内建筑弹窗 · 城外建筑弹窗 · 野地弹窗（**已占 / 未占两个分支都有**）· 城池面板。
**无故事的锚点整块不出现**（不给空壳）。'''
ENTRY_NEW = u'''**入口（依附锚点 · v89.29 概率奇遇）**：点击 **城内建筑 / 城外建筑 / 地块（野地 · 已占未占两分支） / 城池** 时掷骰 ——
命中则从该锚点的故事池**随机抽一篇完整故事**（每篇 = 一份独立资产），在面板之上直接开卷；掩卷后回到原面板。
口径（`GAME.SG.TRIG`，可调）：**有未读 35% / 读毕重读 12% / 冷却 60 秒**；抽取优先「还有未读结局的」。'''

TOT_OLD = u'**合计 227 / 500 篇（45.4%）** · 门禁：`node audit.js` 全 0 · smoke **2285/0**（§81 四十条）· e2e **874/0**（§81 新增题材线真实点击 5 条）'
TOT_NEW = u'**合计 227 / 500 篇（45.4%）** · 门禁：`node audit.js` 全 0 · smoke **2285/0** · e2e **840/0**（§81 概率奇遇链路 + 逐卷直开）'

WAY_OLD = u'- 入口：建筑 / 城外建筑 / 野地 / 城池弹窗 →「逸闻 · 此地故事」→「📖 听一段故事」→ 逐段选择 → 走到结局领赏'
WAY_NEW = u'- 入口（v89.29 概率奇遇）：点击建筑 / 城外建筑 / 地块 / 城池 → **掷骰命中即随机抽一篇完整故事直接开卷** → 逐段选择 → 走到结局领赏 → 掩卷回面板'

TODO_OLD = u'| 15 | ⛔ `misc/any`（世事 40 篇）**仍无 UI 入口**（本轮复查 `ui.SG_BLOCK` 挂点 = `building`/`ext`/`city`/`wild`×2）—— 入口需老板拍板（建议：城池面板加「世事」按钮） | ⚠ 待拍板 |'
TODO_NEW = TODO_OLD + u'''
| 16 | **逸闻入口改版（v89.29）**：列表菜单 → **概率奇遇**（点建筑/地块掷骰，命中随机抽一篇完整故事直接开卷 · 叠层语义 · 60 秒冷却 · 读毕转低概率重读）；引擎 `GAME.SG.TRIG / candidates / roll`（`pin` / `rng` 测试钩子）；移除入口块 / 清单弹窗 / story-list · story-open 动作；smoke 四块对位改写 + e2e §81 整段重写（触发链 + VOL89 逐卷直开） | ✅ 已交付 |'''

edit(README, [
    (ROW_SMOKE_OLD, ROW_SMOKE_NEW, 'smoke 行'),
    (ROW_E2E_OLD, ROW_E2E_NEW, 'e2e 行'),
    (ENTRY_OLD, ENTRY_NEW, '入口段'),
    (TOT_OLD, TOT_NEW, '合计行'),
    (WAY_OLD, WAY_NEW, '可玩路径入口'),
    (TODO_OLD, TODO_NEW, '待办'),
], 'README')
print()

# ============================================================ 需求档案
append(os.path.join(R, u'需求档案.md'), u'''
### v89.29 · 逸闻入口改版：列表菜单 → 概率奇遇（2026-09-18 · 老板「完整的一个故事作为一个独立asset，入口改为概率触发，点击建筑/地块时随机选择其中一个」）

**落地**
- 每篇故事 = 一份独立资产：点击建筑 / 城外建筑 / 地块 / 城池时**掷骰**，命中即从该锚点池随机抽一篇，**直接在面板之上开卷**（叠层语义：掩卷后回面板 · 弹窗不关）。
- 概率口径（`GAME.SG.TRIG`，可调）：有未读 35% ／ 全部读毕后重读 12% ／ 冷却 60 秒；抽取优先「还有未读结局的」；运行态 `_lastAt` 不入档。
- 入口挂点：`openBuildModal` / `openExtModal` 函数尾部掷骰；城池 / 地块在 `handleCanvasClick` 点击处掷骰（操作后的面板重开不掷，避免刷屏）。
- 移除旧入口：入口块 / 清单弹窗 / `story-list` · `story-open` 动作整体收敛（audit 死函数 0 / 孤儿按钮 0）。
- 阅读器：`openStory(sid, keepModal)` 支持保留弹窗；`ui.sgTryTrigger(kind, id)` 命中即开卷。
- 测试钩子：`TRIG.pin`（指定必中篇目）/ `TRIG.rng`（注入随机）；两套测试默认「随机永不触发」，防用例被打断。

**验证**：check.py 全绿（227 篇）· audit 全 0 · smoke **2285/0**（§81 四块对位改写：引擎矩阵 / 接线 / 叠层 / ext）· e2e **840/0**（§81 整段重写：触发链 7 条 + 逐卷直开 28 条 · 无页面运行时错误）。
- 细则：`docs/设计规范.md` §43；`docs/AI工作备忘.md` §50；`story/README.md` §八。
''')
print()

# ============================================================ 设计规范
append(os.path.join(R, 'docs', u'设计规范.md'), u'''
## 43. v89.29 逸闻入口：列表菜单 → 概率奇遇（2026-09-18 · 老板「一个故事一个独立asset，概率触发，点击随机选择」）

**① 引擎（state.js）**
- `GAME.SG.TRIG = { chance: 0.35, chanceDone: 0.12, cooldownMs: 60e3, rng, pin, _lastAt }`；
- `GAME.SG.candidates(kind, id)`：池 = fresh（还有未读结局，优先）∪ done（已读全，重读用）；
- `GAME.SG.roll(kind, id, at)`：返回 `{ fire, why, sid }`，why ∈ empty / cool / roll / pin-miss；
  冷却与掷骰都走这里 —— 入口只调这一个出口（单点可测）。

**② 入口（ui / main）**
- `ui.sgTryTrigger(kind, id)`：掷骰命中 → `ui.openStory(sid, keepModal=true)` 在面板之上开卷；
- 挂点：`openBuildModal` / `openExtModal`（函数尾部）；`handleCanvasClick` 的城池 / 地块分支；
  **操作后的面板重开不掷**（避免"点完采集又弹故事"的刷屏感）。
- 叠层语义：story-fx z=1500 > 弹窗 1000 < toast 2000；掩卷只收阅读器，面板原样保留（`refreshAll` 不触碰 `#modal-root`，此为前置条件）。

**③ 旧入口收敛**：入口块 / 清单弹窗 / `story-list` · `story-open` 动作整体移除；`ui.SG_KIND` 保留（阅读器横幅用）。

**④ 测试口径**
- 默认：`TRIG.rng` 恒 0.999（永不触发）——两套测试 boot 时设置，防随机打断既有用例；
- 触发链专测：`TRIG.pin = sid`（指定必中）+ `_lastAt = 0`（清冷却）→ 走真实 UI 点击；
- 逐卷覆盖：e2e §81 块 E「VOL89 表」直开代表篇目（走满 / 入档 / 掩卷）——**新卷只需在表里加一行**。
''')
print()

# ============================================================ 工作备忘
append(os.path.join(R, 'docs', u'AI工作备忘.md'), u'''
### 50. v89.29 · 入口改版（概率奇遇）与「测试确定性」三板斧（工程视角）

1. **改入口 = 改测试面**：入口从「列表」改「概率」，e2e 曾有 14 块用例都在点旧列表入口；
   与其逐块修补，不如**整段重写** §81 故事区（旧 ~760 行 → 新 ~200 行）：
   触发链 7 条（强制命中 / 叠层 / 冷却 / 默认不触发 / 空池 / 地块触发 / 掩卷回面板）+ 逐卷直开 28 条（VOL89 表循环）。
   → 规则：**入口/链路的测试归「通用块」（一次写全），逐卷的测试归「数据表」（一行一条）** ——
   两者解耦后，新卷接线的测试成本从 ~40 行降到 1 行。
2. **随机系统的测试确定性三板斧**：
   ① boot 时把 `rng` 钉成常数（永不触发）—— 既有用例不被随机打断；
   ② 专测用 `pin` 指定必中篇目 —— 断言从"某篇"升级为"指定篇"（强断言，池序变化也不误伤）；
   ③ 冷却用「先真实触发、再紧接重掷」验证 `why='cool'` —— 不需要假时钟。
3. **刷新不动弹窗 = 叠层可信**：先确认 `GAME.refreshAll` 只刷 header/side/view/log、不碰 `#modal-root`，
   叠层语义（掩卷后回面板）才有了「零额外代码」的实现 —— 若 refreshAll 会重建弹窗，就要额外重开面板。
4. **命中计数**：smoke **2285/0**（旧 4 块一一对位改写，总数不变）；e2e **874/0 → 840/0**（旧块含大量 skip 占位，新区更实）；
   audit 死函数 0 / 孤儿按钮 0（入口移除后零残留引用——含把注释里出现的旧名一并清掉，防静态断言误伤）。
''')
print()

# ============================================================ 工作记忆
append(MEM, u'''
---

## 逸闻入口改版（概率奇遇）· v89.29 · 老板「一个故事一个独立asset，概率触发，点击随机选择」

- **改动**：入口从「列表菜单」→「概率奇遇」：点建筑/城外/地块/城池掷骰，命中随机抽一篇完整故事直接开卷；叠层语义（掩卷回面板）。
- **口径**：35%（有未读）/ 12%（读毕重读）/ 冷却 60s；`GAME.SG.TRIG.pin / rng` 为测试钩子；操作后重开面板不掷。
- **收敛**：入口块 / 清单弹窗 / story-list · story-open 全撤（audit 死函数 0）。
- **门禁数字**：check 227 全绿 · audit 全 0 · smoke **2285/0**（§81 四块对位改写）· e2e **840/0**（§81 整段重写：触发链 + VOL89 逐卷直开）· 无运行时错误
- **产物**：`js/state.js`（TRIG/candidates/roll）· `js/ui.js`（sgTryTrigger / openStory(keepModal) / 挂点）· `js/main.js`（城池/地块挂点 · 撤动作）· 测试两套 · 补丁 `patch_v8929_engine/smoke/e2e.py`
- **下一批**：自动续批恢复（题材线轮换）；新卷测试接线成本降低（e2e 只需往 VOL89 表加一行）
''')
print('ALL OK')
