# -*- coding: utf-8 -*-
"""v86 · 文档补丁：设计规范 §27 / 备忘 §二十九 / 需求档案 v86 段。"""
import io
import sys

SPEC = r'E:\Deepseekdb\docs\设计规范.md'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
ARCH = r'E:\Deepseekdb\需求档案.md'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== D1. 设计规范 §27 ==')
patch(
    SPEC,
    """- 复核另确认：固定画布（`--app-w: 1440×900`，v74）下三档分辨率内部几何一致属
  预期；点击映射闭环（点画布中心 = 视野中心格）；底部条 56px 让位无重叠。
""",
    """- 复核另确认：固定画布（`--app-w: 1440×900`，v74）下三档分辨率内部几何一致属
  预期；点击映射闭环（点画布中心 = 视野中心格）；底部条 56px 让位无重叠。


## 27. v86：计谋 / 锦囊（老板「按计划进行」· 第四轮 G1）

### 27.1 八计三门（DATA.SCHEMES）
- **attack（出征携带）**：妖言惑众（守军规模 −15%）／火烧粮草（城防值 −30%）／
  挑拨离间（守将忠诚 −25 · 对同一城每日一次）／趁火打劫（掠夺 +30%）；
- **march（出征携带）**：千里奔袭（本次行军 +30%）／金蝉脱壳（战败保全：阵亡 35% 转伤兵）；
- **defense（城池布防）**：空城计（6 小时内下一次来犯**不战而退**·一次性）／
  坚壁清野（8 小时内被来犯损失 −40%）。
- 效果**全部作用于战斗/入侵结算的入参**（零引擎改动）：见 `battle.js` expedition 段、
  `state.js` invasion 段；消耗 = 精力（施计将领）+ 锦囊（商城 1500 金/个，`type:'talis'`）。

### 27.2 唯一出口组（state.js 尾部）
`schemeOf` / `schemeKeyOf`（`npc:id` / `fort:id` / `w:x,y`；防御计独立前缀 `my:<cityId>`）/
`schemePrepare`（统一校验：精力·锦囊·野地挑拨拒绝·每日锁）/ `schemeUse`（扣费 + 记标记）/
`schemeMarksOf` / `schemeDefOf` / `schemeDefSet` / `schemeDefConsume`。
- 状态 `s.schemes = { key: { sid: { n, day, until } } }` **入档**（运行中会变）；
  挑拨忠诚 = 100 − 25 × n（n≥2 加成减半、n≥3 战胜 50% 归降，roll 走 `invasionRoll` 可复现）。

### 27.3 UI —— ⚠️ 面板内选择一律「内联区」，禁用子弹窗
- **弹窗是单根系统**（`ui.openModal` 直接替换 innerHTML，无栈）——从出征面板打开
  子弹窗会**销毁出征面板**，关闭后不回来（e2e 实测抓到）。计略选择做成
  `#exp-scheme-box` 内联展开区（复用 `.exp-body` 滚动样式，未新增 CSS）。
- 出征面板「计略」行（标签 + 选择）→ 内联区（六计卡片 + 选中态 + 逐计不可用原因）；
  城池面板「🎴 计略布防」行 → 布防弹窗（防御计 + 施计将领 genChips）。

### 27.4 战报与可见性
- `result.schemeNote` 进战报【计谋】行；施计/布防/空城计奏效即时 `GAME.log`；
  城池面板常显布防剩余时长（输出值可被看见——项目规矩）。

### 27.5 守卫
- smoke §71 九条：含「11 个 eff 键在逻辑模块有字面读取点」**死数据守卫**（写进表而无
  消费＝死数据，本项目经典失效模式）；e2e v86 七条（真实 DOM 全链路）。
""",
    'D1 规范 27',
    probe='## 27. v86：计谋 / 锦囊',
)

print()
print('== D2. 备忘 §二十九 ==')
patch(
    MEMO,
    """- 复核脚手架：`_shot_v85_review.js`（三档几何 / 点击闭环 / 底部布局 / 像素抽查）
  + `_probe_v85_review.js`（错位审计 + 州心完整性）——真机与 headless 双轨。
""",
    """- 复核脚手架：`_shot_v85_review.js`（三档几何 / 点击闭环 / 底部布局 / 像素抽查）
  + `_probe_v85_review.js`（错位审计 + 州心完整性）——真机与 headless 双轨。


## 二十九、v86：计谋工程的三条硬经验

### 29.1 弹窗是单根系统 —— 面板内交互一律「内联区」（血泪）
- 症状：e2e 抓到"选计后出征面板消失"——`ui.openModal` 直接替换 innerHTML（无栈），
  从出征面板打开计略子弹窗 = 销毁面板，关闭后不回来。
- 定式：**面板内的次级选择做成内联展开区**（toggle `hidden` + 原地刷新 innerHTML），
  ⛔ 不用 openModal 叠子弹窗。复用 `.exp-body` 滚动样式 = 零新 CSS（避开"硬编码色 ≤8"守卫）。
- 存量同类（未动）：出征面板的「战术调整」也是子弹窗（点了丢面板）——老板未提，待议。

### 29.2 写测试段先对接口惯例（v86 连踩两坑）
- e2e 用 `G` 别名（jsdom 全局），**没有 `GAME` 裸名**——写了就 "GAME is not defined" 全段中断；
- e2e 是 **jsdom**：没有 `page.evaluate`（那是真机 Playwright 脚本的 API）；
- 测试段找野地前先保障 `map.grid` 已生成（smoke 场景不保证；`if (!grid) GAME.map.generate()`，
  放在**最后一节**无副作用）；城里兵也不保证存在——测试前自行授兵。

### 29.3 补丁探针必须指向"最新形态"（U4 复插事故）
- U4 的幂等探针指向 `ui.openExpScheme`（之后被 ui2 删除）→ 重跑误判"未改过"，
  把旧版整段**又插了一遍**（旧 `doExpSchemePick` 覆盖新版 → 选计行为退化回弹窗版）。
- 定式：**改/删函数时，同步把相关补丁的 probe 指到"现存最新标记"**；收尾做一次
  "全补丁幂等复查"（输出应全为"已改过（跳过）"才算过）。
""",
    'D2 备忘 29',
    probe='## 二十九、v86：计谋工程的三条硬经验',
)

print()
print('== D3. 需求档案 v86 段 ==')
patch(
    ARCH,
    """- 细节：`docs/设计规范.md` §26.3；`docs/AI工作备忘.md` §28.5。
""",
    """- 细节：`docs/设计规范.md` §26.3；`docs/AI工作备忘.md` §28.5。


### v86 · 2 项（**原文**）

> 1.按计划进行
> 2.为各类野地设计专属弹窗场景，山地（绿林豪杰、门派？珍宝……），湖泊钓鱼？沼泽寻宝？荒漠地宫探险？森林？草原？

**落地（第 1 条 · 第四轮 G1 计谋 + G12 珠宝复核）**：
- G1 计谋/锦囊：八计三门（attack 4 / march 2 / defense 2）；效果全走战斗/入侵结算入参
  （零引擎改动）；精力 + 锦囊双消耗；出征面板内联区选计、城池面板布防；
  战报【计谋】行。补丁 patch_v86_{data,state,battle,ui,ui2,tests}.py。
- G12 珠宝复核：九品（珍珠…夜明珠）+ 赏赐/爵位双消费点**基线已完整**，无需开发。
- 第 2 条（野地专属场景）转入 v87 实施。
- 测试：smoke **2172/0** · e2e **742/0**（新 §71[9 条] + e2e v86[7 条]）· 真机 7 项
  （截图 `_v86_shots/`）。踩坑：单根弹窗→内联区、e2e 的 G 别名/jsdom、补丁探针指向事故。
- 细节：`docs/设计规范.md` §27；`docs/AI工作备忘.md` §二十九。
""",
    'D3 档案 v86',
    probe='### v86 · 2 项',
)

print()
print('全部完成。')
