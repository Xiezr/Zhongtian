# -*- coding: utf-8 -*-
"""v84 · 文档：设计规范 §25 / AI工作备忘 §二十七 / 需求档案 v84。

数字：smoke 2151/0 · e2e 730/0（首跑 728/2 为存量 flake，复跑+修复后 730/0）。
"""
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


SEC25 = """## 25. v84：兵种卡去「拥有」行 / 步骑分类对调（老板两条）

### 25.1 兵种卡卡面（troop-card）
- 卡面 `.tstat` 只剩**一行**（血 / 攻 / 防 / 射 / 速）——「拥有：N」行整行退役（v84），
  `own` 读数一并退役。`.tcard-tip` 悬停浮层仍是成本 / 人口 / 耗粮 / 耗时 /
  **未解锁原因**的唯一承载处（卡面不再挂锁定红字）。
- ⚠️ 动卡面结构（增删任何一行）先回扫：smoke 有一条断言逐卡会计 `.tstat` 行数
  （v37 起 3→2→1，现为 **1**），新增行必须同步该判据（备忘 §二十七）。

### 25.2 步骑分类（DATA.TROOPS[].cat）
- `cat` 只决定**募兵分页归属**：`inf` → 步兵页 / `cav` → 骑兵页，**与战场定位无关**。
- v84 对调：**斥候**（侦察）cav → inf；**辎重车**（后勤货运）inf → cav。
- 消费方只有一处：`ui.troopsHTML` 的分页过滤；测试全是动态读值 —— 改分类不连坐。
"""

SEC27 = """## 二十七、v84：卡面行结构受闸 & 随机种子地图下的固定坐标假红

### 27.1 「渲染即断言」回扫清单再添一条：卡面行数
- v37 起 smoke 逐卡会计 `.troop-card` 卡面 `.tstat` 行数（3→2）；v84 删「拥有」行
  打到 **1** —— 老判据 `stats.length === 2` 必然红，同步改判 + 顺带断言「卡面无『拥有』」（防回潮）。
- 与 §24.1「改默认页先回扫渲染即断言」同一张清单：**动卡面结构 = 先 grep `tstat`**。

### 27.2 交换分类值之前：先把消费方数一遍
- `cat` 全仓消费方只有分页过滤一处，其余测试全动态读 `DATA.TROOPS[].cat` ——
  先 grep 确认无硬编码断言再动手（改完 smoke/e2e 零翻转）。
- 反向教训（v80）：`data-tab` 看似只是显示属性，却撞 audit 的隐式分发约定 ——
  「只是显示字段」要由消费方清单背书，不由直觉背书。

### 27.3 幂等判定的第三种纠缠：注释新增型（old 是 new 子串）
- 在锚点前插注释（new = 注释 + 原行）时，old（原行）永远是 new 子串 —— 二跑会重复插入；
  而「new in t 判幂等」在删除型（new 是 old 子串）又会首跑误跳过。
- 定式：**幂等探针与 old/new 解耦** —— 显式 probe（改过后必定成立/不成立的独特判据：
  新增注释片段 / 被删整行消失），签名 `patch(..., probe, must_exist)`（本版三个补丁脚本已用）。

### 27.4 随机种子地图 + 写死坐标 = 假红源（第二个独立 flake）
- 症状：e2e 第 23 节「出征弹窗行军预估」两条假红，复跑即绿（730/0）。
- 根因：地图种子 = `U.now() % 100000`（每跑都不同），夹具却把出征目标写死在
  `c23.x+3 / c23.y+3` —— 该格是城池 / 越界时 resolveTarget 拒绝、弹窗不开。
- 修法：ring 搜索合法野地当靶子（换标的、不放宽判据）—— 与 §26.2 同一处置定式。
- 推论：**夹具引用地图坐标一律先验合法性**（tile 非空 + 非城），别赌出生点附近。
"""

SEC_ARCH = """### v84 · 2 项（**原文**）

> 1.募兵界面兵种底下不要"拥有：0"这个提示
> 2.辎重车是骑兵吧，斥候是步兵

**落地**：
- ① 兵种卡第二行「拥有：N」整行退役（`own` 读数一并退役）；未解锁红字不再挂卡面，
  悬停浮层（.tcard-tip）照旧给出 —— 信息不丢。smoke 卡面行数判据 2 → **1**。
- ② 分类对调：斥候 `cat cav → inf`、辎重车 `inf → cav`（`cat` 仅决定募兵分页归属，
  与战场定位无关；消费方只有 `ui.troopsHTML` 分页过滤一处）。
- 顺手修存量 flake：e2e 第 23 节出征弹窗夹具改 ring 搜索合法野地（原写死 c23.x+3/y+3，
  随机种子地图下撞城池/越界即假红，首跑实测命中；定位见备忘 §二十七）。
- 测试：smoke **2151/0** · e2e **730/0**（smoke 改判 1 处 + 新增第 69 节 5 条；e2e 新增 v84 段 3 条）。
- 细节：`docs/设计规范.md` §25；`docs/AI工作备忘.md` §二十七。
"""

print('== D1. 设计规范 §25 ==')
patch(
    SPEC,
    '  与「单场封顶」同一原则：不写会被当成算漏了。\n',
    '  与「单场封顶」同一原则：不写会被当成算漏了。\n\n\n' + SEC25,
    'D1 设计规范 §25',
    probe='## 25. v84：兵种卡去「拥有」行',
)

print()
print('== D2. 备忘 §二十七 ==')
patch(
    MEMO,
    '  定式：**补丁脚本一律用文件（Write 工具）落盘再执行**，不在命令行内联中文锚点。\n',
    '  定式：**补丁脚本一律用文件（Write 工具）落盘再执行**，不在命令行内联中文锚点。\n\n\n' + SEC27,
    'D2 备忘 §二十七',
    probe='## 二十七、v84',
)

print()
print('== D3. 需求档案 v84 ==')
patch(
    ARCH,
    '- 细节：`docs/设计规范.md` §24；`docs/AI工作备忘.md` §二十六。\n',
    '- 细节：`docs/设计规范.md` §24；`docs/AI工作备忘.md` §二十六。\n\n\n' + SEC_ARCH,
    'D3 需求档案 v84',
    probe='### v84 · 2 项',
)

print()
print('全部完成。')
