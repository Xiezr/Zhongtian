# -*- coding: utf-8 -*-
"""v89.211 档案补丁：总览行 + 明细段"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('需求档案.md')
if '| v89.211 |' in s:
    print('[skip] 总览行已在册')
else:
    old = "| v89.210 | 2026-10-06 | 4 |"
    i = s.index(old)
    j = s.index('\n', i)
    row210 = s[i:j]
    row211 = ("| v89.211 | 2026-10-06 | 4 | **强化数值链显示收敛（乘数唯一出口 eqEnhMulOf/eqLingMulOf · "
        "按件描述 equipDescOf 接入 5 处展示点 · equipScore 按件计入）· 占城空格补齐（原墙格补建民房 · "
        "存量修复 migrateWallCell211 紧签名）· 器械工位归一（open-siege 用本作坊 idx · openTroops 入场归一 · "
        "doTrain/域侧防御回落 · 无作坊城提示准确）· 换世界观参考（6 套候选 + 映射字典 · 纯设计未码）**"
        "（老板：「强化后装备属性似乎并未真实增加。务必排查所有数值链」「占领了一个县城，发现城内地块有一块未建造，"
        "猜测是仓库（第五行第六格）？」「工匠作坊点击造投石车提示：本城暂无工匠作坊……提示与实际情况应当相符」"
        "「换背景，提供一些可参考的时代背景和故事参考」） | 已完成（详见 docs/v89211-强化链修复与占城补齐与器械工位.md · "
        "另 docs/v89211b-换世界观参考-时代背景与故事方案.md） |")
    s = s[:j + 1] + row211 + '\n' + s[j + 1:]
    wr('需求档案.md', s)
    print('[ok] 总览行')

s = rd('需求档案.md')
if '## v89.211 ·' in s:
    print('[skip] 明细段已在册')
else:
    detail = """

## v89.211 · 强化数值链显示收敛 + 占城空格补齐 + 器械工位归一（2026-10-06）

老板四条：①「强化后装备属性似乎并未真实增加。务必排查所有数值链」；
②「占领了一个县城，发现城内地块有一块未建造，猜测是仓库（第五行第六格）？」；
③「在工匠作坊点击造投石车发现提示：本城暂无工匠作坊……提示与实际情况应当相符」；
④「给整个故事换个背景，根据本游戏元素（玩法元素），提供可参考的时代背景和故事参考」。

### ① 强化数值链（结论：数值链通 · 断在展示/决策链 —— 乘数收敛为唯一出口）

| 链 | 改前 | 处置 |
|---|---|---|
| 写回 inst.enh（百炼/蕴养） | ✅ 通 | — |
| genEquipBonus 六维乘链（×1.08^N） | ✅ 通 | 乘数收敛 `GAME.eqEnhMulOf` |
| genAttrs（atk/atkPct/staMax） | ✅ 通 | — |
| 战斗消费（tactic A/B） | ✅ 通（+10 vs +0：我损 382→202） | — |
| 装备描述/卡面/悬停 | ❌ 读原值 | 新增 `GAME.equipDescOf`（按件描述唯一出口）· 5 处接入 |
| equipScore（一键最优） | ❌ 忽略强化 | 兼容实例并计入（六维走 eqEnhMulOf、灵力走 eqLingMulOf） |
| lingPowerOf（灵力） | ✅ 通 | 乘数收敛 `GAME.eqLingMulOf` |
| 存档持久化 | ✅ 通 | — |

### ② 占城空格（r5c6 = idx37 = 城墙原格；仓库 4 座一座不缺）

- 新规：v89.128 城墙入环城槽后，释放的原墙格**补建民房（同等级）** ——
  onConquer（battle.js）与读档迁移（state.js）同步改；
- 存量档修复 `GAME.migrateWallCell211`（紧签名＝origId＋恰一格空在墙位＋城墙在槽；一次性）；
  负例保护：自建城 / 空格≥2 / 在建格一律不碰。

### ③ 器械工位（病根：显示有回落、提交直传陈旧军营格）

- `open-siege` 改传本作坊自己的 idx（按钮自带 data-idx）；`ui.openTroops` 入场归一；
  `GAME.doTrain` 读解析后工位；`GAME.train` 域侧防御回落 —— 真无作坊的城仍准确拒绝。

### ④ 换世界观参考（纯设计）

→ docs/v89211b-换世界观参考-时代背景与故事方案.md（6 套候选：仙侠宗门/星际拓殖/蒸汽煤铁纪/
废土余烬/西幻列王/山海万邦 + 机制映射 + 故事参考 + 三层换皮落地建议 + 资产映射字典）。

**验证**：audit 0 · smoke **3580/0**（§211×8）· e2e **1271/0**（§211e×4）· 实机 **10/0** ·
像素 **6/6** · 探针 3 支（A 16/0 · B 32/0 · C 11/0 · 均带改前基线）· 官方门禁全绿。

**复现命令**：
```bash
node .workbuddy/tools/probe/probe_v89211a_plan.js
node .workbuddy/tools/probe/probe_v89211b_enh.js
node .workbuddy/tools/probe/probe_v89211c_train.js
node .workbuddy/tools/show/shot_v89211_gates.js
node .workbuddy/tools/asset/check_v89211_shots.js
node smoke-test.js && node e2e-test.js && node audit.js
```
"""
    s = s.rstrip('\n') + detail
    wr('需求档案.md', s)
    print('[ok] 明细段')

print('DONE')
