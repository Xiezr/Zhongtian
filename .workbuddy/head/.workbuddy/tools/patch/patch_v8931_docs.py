# -*- coding: utf-8 -*-
"""v89.31 文档补录：README §八/§九 + 需求档案 + 设计规范 §45 + 工作备忘 §52 + 工作记忆"""
import io
import os
import sys

R = r'E:\Deepseekdb'
MEM = r'C:\Users\18811\WorkBuddy\2026-09-17-02-19-29\.workbuddy\memory\2026-09-18.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, src):
    tmp = p + '.tmp8931d'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, p)


def nl_of(src):
    return '\r\n' if '\r\n' in src[:4000] else '\n'


def edit(p, pairs, tag):
    src = read(p)
    nl = nl_of(src)
    for old, new, name in pairs:
        o2 = old.replace('\n', nl)
        n2 = new.replace('\n', nl)
        c = src.count(o2)
        if c != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, c))
            sys.exit(1)
        src = src.replace(o2, n2, 1)
    write(p, src)
    back = read(p)
    for old, new, name in pairs:
        assert new.replace('\n', nl) in back, '%s / %s 回查失败' % (tag, name)
    print('OK  ' + tag)


def append(p, text, tag):
    src = read(p)
    nl = nl_of(src)
    if not src.endswith('\n'):
        src += nl
    write(p, src + text.replace('\n', nl))
    back = read(p)
    head = text.strip().split('\n')[0]
    assert head in back, tag + ' 回查失败'
    print('OK  ' + tag)


# ============ 1. story/README.md ============
edit(R + r'\story\README.md', [
    # 1.1 入口段后追加动作触发段
    ("""口径（`GAME.SG.TRIG`，可调）：**有未读 35% / 读毕重读 12% / 冷却 60 秒**；抽取优先「还有未读结局的」。""",
     """口径（`GAME.SG.TRIG`，可调）：**有未读 35% / 读毕重读 12% / 冷却 60 秒**；抽取优先「还有未读结局的」。

**入口（动作触发 · v89.31 因果线）**：动作结算后也可偶遇逸闻 —— 覆盖 **14 个动作键**：
战事（出征胜 / 出征败 / 占领城池 / 据守野地）· 营造（建造升级完成（含城外与城墙）/ 迁址 / 筑城）·
民生（训练完成 / 治疗伤兵 / 市易 / 采集归来）· 成长（研习完成 / 招贤 / 爵位晋升）。
每键配「相关建筑池」（`GAME.SG.ACT`）：静态数组或按 ctx 动态解析 —— 战事 → 军营 / 校场 / 城墙 / 烽火台 / 马厩 / 驿站；
占城 → 该档城池 + 官府 + 鸿胪寺；营造 → 所建建筑（或城墙 / 城外）+ 工匠作坊；研习 → 书院 + 招贤馆；市易 → 市场 + 仓库…
口径：**chance 8%~60%（按动作频度分档）/ 同类冷却 3~5 分钟**；池内未读优先；战事两键用 `prefer` 标签收窄（军伍/军务/城防/烽燧/马政/驿传/边务…）。
挂点：引擎侧 tick 完成（营造 / 训练 / 研习）经 `GAME.onActionDone` → `ui.sgTryAct`；界面侧动作在 `main.js` 各 doXxx 内直调。""",
     '入口·动作触发段'),
    # 1.2 合计行
    ("""**合计 263 / 500 篇（52.6%）** · 门禁：`node audit.js` 全 0 · smoke **2287/0** · e2e **852/0**（§81 概率奇遇链路 + 逐卷直开）""",
     """**合计 263 / 500 篇（52.6%）** · 门禁：`node audit.js` 全 0 · smoke **2289/0** · e2e **857/0**（§81 概率奇遇链路 + 动作触发 + 逐卷直开）""",
     '合计行'),
    # 1.3 待办 17
    ("""| 16 | **逸闻入口改版（v89.29）**：列表菜单 → **概率奇遇**（点建筑/地块掷骰，命中随机抽一篇完整故事直接开卷 · 叠层语义 · 60 秒冷却 · 读毕转低概率重读）；引擎 `GAME.SG.TRIG / candidates / roll`（`pin` / `rng` 测试钩子）；移除入口块 / 清单弹窗 / story-list · story-open 动作；smoke 四块对位改写 + e2e §81 整段重写（触发链 + VOL89 逐卷直开） | ✅ 已交付 |""",
     """| 16 | **逸闻入口改版（v89.29）**：列表菜单 → **概率奇遇**（点建筑/地块掷骰，命中随机抽一篇完整故事直接开卷 · 叠层语义 · 60 秒冷却 · 读毕转低概率重读）；引擎 `GAME.SG.TRIG / candidates / roll`（`pin` / `rng` 测试钩子）；移除入口块 / 清单弹窗 / story-list · story-open 动作；smoke 四块对位改写 + e2e §81 整段重写（触发链 + VOL89 逐卷直开） | ✅ 已交付 |
| 17 | **逸闻动作触发（v89.31 因果线）**：动作结算后偶遇逸闻 —— 14 个动作键（战事 胜/败/占城/据地 · 营造 建造/迁址/筑城 · 民生 训练/治疗/市易/采集 · 成长 研习/招贤/晋升），每键配「相关建筑池」（`GAME.SG.ACT`，静态或按 ctx 动态）；挂点 = `GAME.onActionDone` 桥（营造×4/训练/研习）+ main.js 七处动作 + 战事四态（onMarchArrive）；smoke +2 / e2e +5 | ✅ 已交付（2026-09-18） |""",
     '待办 17'),
], 'story/README.md')

# ============ 2. 需求档案.md ============
append(R + r'\需求档案.md', """
### v89.31 · 逸闻动作触发（因果线 · 14 动作键）（2026-09-18 · 老板「找相关建筑，或某个动作后触发，比如出征胜利/失败」）

**落地**
- 触发面从「点击建筑/地块」扩到**动作结算**，全量盘点后取 14 键、覆盖四条线：
  战事（battle-win / battle-lose / occupy-city / occupy-wild）· 营造（build-done / move-city / build-city）·
  民生（train-done / heal-wounded / market-trade / gather-done）· 成长（tech-done / recruit-hero / promote）。
- **相关建筑池**（`GAME.SG.ACT`）：战事 → 军营/校场/城墙/烽火台/马厩/驿站；占城 → 该档城池 + 官府 + 鸿胪寺；
  营造 → 所建建筑（或城墙 / 城外）+ 工匠作坊；研习 → 书院 + 招贤馆；招贤 → 招贤馆 + 客栈；市易 → 市场 + 仓库；
  治疗 → 军营 + 民房；迁址/筑城/晋升 → 官府 + 民房 + 工匠作坊 + 城墙（晋升另含鸿胪寺）。
- 口径：chance 0.08~0.60 按频度分档 · 同类冷却 3~5 分钟（`TRIG._actAt`，运行态不入档）· 池内未读优先 ·
  战事两键 `prefer` 标签收窄（pin 指定时绕过）；与点击触发共用 `rng` / `pin` 测试钩子。
- 挂点：state.js `applyBuildDone`×4 / `applyTrainDone` / `applyTechDone` → `GAME.onActionDone`（main.js 桥）；
  main.js `onMarchArrive`（战事四态）+ doHeal / doInnRecruit / doMarketTrade / doFinishGather / doCityMove / doLordPromote / build-city 七处。

**验证**：check.py 全绿（263 篇未动）· audit 全 0 · smoke **2289/0**（+2：动作触发引擎 · 动作接线）· e2e **857/0**（+5：真实行军抵达 → 相关建筑池开卷（《空额》）· 掩卷；研习完成 → 书院池开卷 · 掩卷 · 默认阈值不打扰）。
- 细则：`docs/设计规范.md` §45；`docs/AI工作备忘.md` §52；`story/README.md` §八。
""", '需求档案 v89.31')

# ============ 3. docs/设计规范.md ============
append(R + r'\docs\设计规范.md', """
## 45. v89.31 逸闻动作触发（因果线 · 14 动作键）（2026-09-18）

**① 动作清单（发掘口径）** —— 从 main.js 动作分发表（~230 case）+ domain.js/systems.js 出口全量盘点，
取「有结算完成点」的动作：
  · 战事：行军抵达（`onMarchArrive`）—— 胜 / 败 / 占领城池 / 据守野地（互斥四态，占城/据地优先于胜败）；
  · 营造：`applyBuildDone`（tick）—— 城内建造升级 / 城外建造升级 / 城墙；`moveCityTo`（迁址）；`buildCityAt`（筑城）；
  · 民生：`applyTrainDone`（训练）· `battle.heal`（治疗伤兵）· `marketTrade`（市易）· `finishGather`（采集）；
  · 成长：`applyTechDone`（研习）· `innRecruit`（招贤）· `systems.promote`（爵位晋升）。

**② 触发口径（`GAME.SG.ACT` / `actPool` / `preferRows` / `rollAct`）**
  · 池：`anchors`（静态数组或按 ctx 动态解析）→ 合并去重 → `fresh`（有未读结局）优先，读毕转低概率重读；
  · 概率：chance 按频度分档（战事 30~35% · 占城 50% · 迁址/筑城 60% · 营造 20% · 研习 35% · 招贤 50% · 晋升 50% · 治疗 25% · 训练 10% · 采集 10% · 市易 8%）；
  · 冷却：同类动作 `cd` 3~5 分钟（`TRIG._actAt[key]`，运行态）；与点击触发各记各的冷却；
  · `prefer`：战事两键按标签收窄（只收窄不缩空）；`pin` 指定时绕过 prefer（保测试确定性）；
  · 测试钩子：与点击触发共用 `TRIG.rng` / `TRIG.pin`。

**③ 测试口径**：smoke 两条（引擎：14 键 + 相关建筑齐备 + 动态池按 ctx 解析 + pin/冷却/空池三态 + prefer 收窄；
  接线：回调×6 / 桥 / 挂点×10 源码计数）；e2e 五条（真实行军抵达 → 开卷 → 掩卷 ×2；研习完成 → 书院池 → 开卷 → 掩卷 ×2；
  默认阈值（rng 恒 0.999）不打扰 ×1）。战事 pin 取「胜/败两池交集」——杜绝胜负抖动导致的假红。

**验证**：audit 全 0 · smoke **2289/0** · e2e **857/0** · check 263 篇未动。
""", '设计规范 §45')

# ============ 4. docs/AI工作备忘.md ============
append(R + r'\docs\AI工作备忘.md', """
### 52. v89.31 · 逸闻动作触发（因果线）—— 挂点考古与测试确定性（工程视角）

1. **挂点考古法**：先把「玩家能做的动作」全量盘出来（main.js 动作分发表 ~230 个 case + domain.js/systems.js 出口），
   再按「有结算完成点」筛出 14 个可挂动作 —— 比从需求倒推更全，避免漏掉迁址/筑城/晋升这类低频大动作。
   挂点分两类：
   · **界面动作**（有 doXxx 包装）→ 直接在 main.js 包装内挂（UI 层，天然有 `r.ok` 与 ctx）；
   · **tick 完成**（营造/训练/研习在引擎内结算）→ 引擎回调 `GAME.onActionDone(key, ctx)`（沿用
     `GAME.onMarchArrive` 既有先例：引擎发回调、main.js 落实现，state.js 保持 0 个 `ui.` 引用）。
2. **动态池按 ctx 解析**：占城要取「该档城池」的故事（county/jun/zhou/capital），营造要取「所建的那座建筑」——
   `anchors` 写成函数 `(ctx) => [[kind, id], ...]`，把「相关建筑」的口径沉淀在数据表里，挂点只传上下文。
3. **pin 绕过 prefer，测试才稳**：prefer 会让池子收窄，若 pin 的篇目恰被收窄掉 → pin-miss → 假红。
   定口径：`pin` 指定 = 显式覆盖、跳过 prefer（只用原始合并池）。e2e 里还多做一层 —— 战事 pin 取
   「胜/败两池交集」，杜绝胜负抖动导致的假红（本次实测命中《空额》bld-junying-01）。
4. **tick 完成会撞测试随机**：测试默认 `rng` 恒 0.999 → 动作触发在既有用例中天然静默；
   专测时才 pin。保证「营造/训练完成」在 e2e 长流程里不会突然弹阅读器打断后续断言。
5. **门禁数字**：check 263 篇（未动内容）· audit 死函数 0 / 孤儿按钮 0 · smoke **2289/0**（本批 +2）·
   e2e **857/0**（本批 +5）。
""", 'AI工作备忘 §52')

# ============ 5. 工作记忆 ============
append(MEM, """
## 逸闻动作触发（因果线 · v89.31）（2026-09-18 深夜）

- **发掘**：全量动作盘点（main.js ~230 case + domain/systems 出口）→ 14 个可挂动作键、四条线：
  战事（胜/败/占城/据地）· 营造（建造完成/迁址/筑城）· 民生（训练/治疗/市易/采集）· 成长（研习/招贤/晋升）。
- **机制**：`GAME.SG.ACT`（动作→相关建筑池，静态或按 ctx 动态）+ `actPool / preferRows / rollAct`；
  chance 8%~60% 分档 · 同类冷却 3~5 分钟 · 未读优先 · 战事按标签收窄；与点击触发共用 rng/pin。
- **挂点**：state.js（营造×4/训练/研习）→ `GAME.onActionDone` 桥（main.js）；main.js 七处界面动作 +
  onMarchArrive 战事四态；`ui.sgTryAct` 叠层开卷。
- **门禁**：audit 全 0 · smoke **2289/0**（+2）· e2e **857/0**（+5，真实行军抵达命中《空额》）· check 263 篇未动。
- **产物**：`js/state.js` + `js/ui.js` + `js/main.js` · 补丁 `patch_v8931_engine.py / patch_v8931_tests.py` ·
  README §八 / 需求档案 v89.31 / 设计规范 §45 / 备忘 §52。
""", '工作记忆 v89.31')

print('ALL OK')
