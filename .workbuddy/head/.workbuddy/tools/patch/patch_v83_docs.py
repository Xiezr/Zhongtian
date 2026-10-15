# -*- coding: utf-8 -*-
"""v83 · 文档补丁：设计规范 §24 / 备忘 §二十六 / 需求档案 v83。"""
import io

SPEC = r'E:\Deepseekdb\docs\设计规范.md'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
ARCH = r'E:\Deepseekdb\需求档案.md'


def detect_eol(path):
    t = io.open(path, encoding='utf-8', newline='').read()
    return '\r\n' if t.count('\r\n') and t.count('\r\n') == t.count('\n') else '\n'


def append(path, text, tag):
    eol = detect_eol(path)
    t = io.open(path, encoding='utf-8', newline='').read()
    marker = next((ln for ln in text.split('\n') if ln.strip()), text[:40])
    if marker in t:
        print('  · %s：已追加过（跳过）' % tag)
        return
    io.open(path, 'w', encoding='utf-8', newline='').write(t + eol + text.replace('\n', eol))
    print('  ✓ %s（eol=%s）' % (tag, 'CRLF' if eol == '\r\n' else 'LF'))


SPEC24 = """
## 24. v83：野地经验惩罚（每 12 级一个台阶）

### 24.1 口径
- 掠夺 / 占领**野地**时，把将领等级折算成「该吃满的野地等级」：
  `need = min(10, ceil(level / 12))`；野地 0 级按 1 级对待。
- 野地等级 ≥ 台阶 → **吃满**（系数 1，不设超额加成）；每低一档 ×0.65，地板 0.03。
- 只作用于野地出征结算口；城池 / 野外城池的歼灭经验口径不变。
- 数值全在 `DATA.EXP_PENALTY = { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 }`（四个数）。
- 唯一出口：`GAME.battle.expTierOf / expPenaltyOf`（smoke §68 结构守卫盯着）。
- 战报与公文都要写明打折原因（`越级惩罚 ×0.65：Lv84 宜打 7 级野地`）——
  与「单场封顶」同一原则：不写会被当成算漏了。
"""
append(SPEC, SPEC24, '设计规范 §24')

MEMO26 = """
## 二十六、v83：打桩复刻法 & 存量 flake 的定位

### 26.1 出征全链路的确定性测试：打桩「守军 + 等级」而不是赌地图
- 野地守军/等级是（坐标, 现实日）派生的随机值 —— 直接拉真实野地做断言会 flaky。
- 定式：`G.map.wildLevelNow / G.wildDefenseAt` 双打桩（固定 Lv2 / 30 义兵），
  `expedition` 走真实链路（解析 → 结算 → gainExp），断言打折系数；finally 还原。
- 期望值示例：30 义兵 × 230 资源 = 6900 → 经验 14；Lv48（4 档）打 2 级 → 14×0.65² = 6。

### 26.2 存量 flake 定位法（smoke 4 连假红 → 2~3% 概率）
- 症状随机、判据看似无关（任务顶块四条）→ 先查**夹具的随机性**：复刻夹具 20 连跑，
  列举每跑抽中的对象与失败与否，命中「r18 广厦之谋」时必红。
- 根因：夹具打桩口按 (metric, sub) 拦截，r18 与 g01/g02 同指标（bldCount/minfang），
  无法对同一组指标返回两个值 → 修法是**跳过冲突类**（换打桩对象，判据不放宽）。
- 附带：`withState57` 是新档（base 固定 = 2），所以是"抽中才红"的 2~3%，不是每日漂移。

### 26.3 内联 heredoc 传中文锚点的编码坑
- Git Bash heredoc 传含中文的 Python 源码偶发编码错乱（锚点命中 0 次）——
  定式：**补丁脚本一律用文件（Write 工具）落盘再执行**，不在命令行内联中文锚点。
"""
append(MEMO, MEMO26, '备忘 §二十六')

ARCH83 = """
### v83 · 1 项（**原文**）

> 1.形成经验惩罚机制，掠夺、占领野地时，1-10级野地，以12级一个台阶，将领小于等于12级，打1级野地可以吃满经验，大于12级但小于等于24级，打2级野地可以吃满经验，类推。大于120级将领，均可通过打10级野地吃满经验

**落地**：
- `DATA.EXP_PENALTY = { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 }`；
  `GAME.battle.expTierOf / expPenaltyOf` 唯一出口；只挂野地出征结算口（非野地不适用）。
- 台阶 `need = min(10, ceil(level/12))`：≤12→1 级、13~24→2 级、…、>120→10 级；
  野地 0 级按 1 级；打低于台阶每差一档 ×0.65（地板 0.03）；打折后保底 1 点。
- 战报与公文注明（`越级惩罚 ×0.65：Lv84 宜打 7 级野地`）。
- 顺手修存量 flake：smoke §57 任务夹具跳过 bldCount/minfang 冲突类（r18）——
  2~3% 概率随机假红，定位过程见备忘 §二十六。
- 测试：smoke **2146/0** · e2e **727/0**（smoke 新增第 68 节 9 条；e2e 新增 v83 段 3 条）。
- 细节：`docs/设计规范.md` §24；`docs/AI工作备忘.md` §二十六。
"""
append(ARCH, ARCH83, '需求档案 v83')

print()
print('完成。')
