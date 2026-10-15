# -*- coding: utf-8 -*-
"""v87 · 文档补丁：设计规范 §28 / 备忘 §三十 / 需求档案 v87 段。"""
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


print('== E1. 设计规范 §28 ==')
patch(
    SPEC,
    """- smoke §71 九条：含「11 个 eff 键在逻辑模块有字面读取点」**死数据守卫**（写进表而无
  消费＝死数据，本项目经典失效模式）；e2e v86 七条（真实 DOM 全链路）。
""",
    """- smoke §71 九条：含「11 个 eff 键在逻辑模块有字面读取点」**死数据守卫**（写进表而无
  消费＝死数据，本项目经典失效模式）；e2e v86 七条（真实 DOM 全链路）。


## 28. v87：野地专属场景（老板「为各类野地设计专属弹窗场景」）

### 28.1 六地形六场景（DATA.WILD_SCENES）
- **山地 · 绿林探访**（好汉赠金 / 山寨存货 / 豪杰来投 / 珠宝 / 遇袭负伤）；
- **湖泊 · 垂钓**（鱼获充粮 / 沉物锦囊 / 珠宝 / 空竿而归）；
- **沼泽 · 寻宝**（珠宝 / 军资 / 旧钱 / 木盒 / 瘴气负伤）；
- **荒漠 · 地宫探险**（三层递增：旧钱 → 遗藏 → 图纸 / 珠宝 / 塌方负伤）；
- **森林 · 狩猎**（皮毛药材 / 野味充粮 / 失物锦囊 / 空手）；
- **草原 · 牧马**（马市得资 / 牧马辎具 / 良马马鞭 / 风尘仆仆）。
- 平原除外（主战场与筑城地）；每处野地**每日一次**；消耗将领精力 + 体力；
  风险 = 将领负伤（体力损失，⛔ 不损兵——不与出征体系抢平衡）。

### 28.2 唯一出口（state.js）
`wildSceneOf(terrain)` / `wildSceneCheck(x, y, genId)`（统一校验：地形 · 精力 · 体力 ·
每日锁）/ `wildSceneDo(x, y, genId)`（扣费 + 锁 + 种子化抽结果 + 发奖 + 日志）。
- 锁存 `s.wildScenes = { 'x,y': day }`（**游戏日**，入档）；
- **结果种子化**（`invasionRoll('ws|x,y|day|…')`）——同一天同一地结果稳定，
  测试断言可精确复现（`===` 级）。

### 28.3 产出与 UI
- 产出**全走现有体系**：资源（粮/金）入当前城；材料走 `WILD_MATERIAL` 地形池
  （同 id 合并）；珠宝取低四档；道具 jinang / chest / mabian / bp_mingjiang；
  绿林豪杰走 `makeHero`（重名兜底换珍珠）。
- UI：`ui.wildSceneHTML(x, y)` 内嵌野地弹窗**两分支**（未占·出兵弹窗 / 已占·管理面板）；
  genChips 选带队将领；执行后**原地重开**弹窗回显结果与「今日已探」态。

### 28.4 守卫
- smoke §72 五条（含「权重定向 · 豪杰必出」的确定性测试）；e2e v87 四条；真机 4 图。
""",
    'E1 规范 28',
    probe='## 28. v87：野地专属场景',
)

print()
print('== E2. 备忘 §三十 ==')
patch(
    MEMO,
    """- 定式：**改/删函数时，同步把相关补丁的 probe 指到"现存最新标记"**；收尾做一次
  "全补丁幂等复查"（输出应全为"已改过（跳过）"才算过）。
""",
    """- 定式：**改/删函数时，同步把相关补丁的 probe 指到"现存最新标记"**；收尾做一次
  "全补丁幂等复查"（输出应全为"已改过（跳过）"才算过）。


## 三十、v87：野地场景工程要点

### 30.1 复用点清单（新系统先找"现有地基"）
- 复用：地形表 / 材料池（WILD_MATERIAL）/ 物品体系 / 将领取名池（NPC_GUARD_*）/
  makeHero / invasionRoll（种子化）/ genChips / setStaNow / op-zone 样式 ——
  **零新物品、零新 CSS**（后者直接避开"硬编码色 ≤8"守卫）。
- 风险设计原则：**惩罚走"软成本"**（将领体力负伤）而非损兵 —— 不触碰出征平衡。

### 30.2 测试的两条定式（v87 新增）
- **"清锁再跑"**：每日一次类系统，测试第二步前必须先清锁（前一段可能已探过 →
  否则"二跑必拒"的断言反而被'已被锁'状态误伤）；
- **"权重定向"**：概率事件（豪杰来投）做确定性验证 —— 测试内临时把目标 outcome
  权重设 100、其余 0，跑完还原（与"打桩"同族）。

### 30.3 结果种子化 = 可复现（与 v68 invasionRoll 同源）
- 同日同地同结果（`'ws|x,y|day|salt'`）；清锁重跑两次结果字符串完全一致 ——
  断言直接用 `===`（对照：Math.random 路线只能做"有产出/无产出"级别的松断言）。
""",
    'E2 备忘 30',
    probe='## 三十、v87：野地场景工程要点',
)

print()
print('== E3. 需求档案 v87 段 ==')
patch(
    ARCH,
    """- 细节：`docs/设计规范.md` §27；`docs/AI工作备忘.md` §二十九。
""",
    """- 细节：`docs/设计规范.md` §27；`docs/AI工作备忘.md` §二十九。


### v87 · 落地（v86 段的第 2 条）

> 为各类野地设计专属弹窗场景，山地（绿林豪杰、门派？珍宝……），湖泊钓鱼？沼泽寻宝？荒漠地宫探险？森林？草原？

**落地**：
- 六地形专属场景（`DATA.WILD_SCENES`）：山地·绿林探访 / 湖泊·垂钓 / 沼泽·寻宝 /
  荒漠·地宫探险 / 森林·狩猎 / 草原·牧马；每地每日一次；将领精力 + 体力消耗；
  负伤（体力损）不损兵。结果**种子化**可复现；产出全走现有体系（零新物品）；
  豪杰来投走 makeHero（重名兜底换珍珠）。
- 野地弹窗两分支（未占·出兵弹窗 / 已占·管理面板）内嵌场景区块（`ui.wildSceneHTML`）。
- 测试：smoke **2177/0** · e2e **746/0**（§72 五条 + e2e v87 四条）· 真机 4 图
  （截图 `_v87_shots/`）。踩坑：每日锁测试先清锁、"权重定向"做确定性事件测试。
- 细节：`docs/设计规范.md` §28；`docs/AI工作备忘.md` §三十。
""",
    'E3 档案 v87',
    probe='### v87 · 落地（v86 段的第 2 条）',
)

print()
print('全部完成。')
