# -*- coding: utf-8 -*-
"""v89.86 · 文档同步：开发整改清单（状态）/ 试玩测评报告（banner）/ 需求档案 /
   设计规范 §98 / AI工作备忘 §106 / 门派系统规则 §十七"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    assert new in read(p), '落盘回查失败：' + tag
    print('OK  ' + tag)


def append(p, text, tag):
    src = read(p)
    if text.strip() in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    if not src.endswith('\n'):
        src += '\n'
    write(p, src + text)
    assert text.strip() in read(p), '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============ ① 开发整改清单：头部状态 + 执行结果 ============
CL = os.path.join(ROOT, 'docs', '开发整改清单.md')
edit(CL, r"""> **状态**：待开发方确认排期 · 北辰 · 2026-09-20""",
     r"""> **状态**：✅ **已执行（v89.86 · 2026-09-20）** —— P0/P1/P2 共 21 条全部落地 +
> 门派 P1 被动加成实装（老板拍板）；P-22 江湖复挂**保持剥离**、P-14 野地曲线本轮不动。
> 执行明细与验收见 `docs/v8986改动说明.md`；逐条落点见本文件 §六「执行结果」表。""",
     '整改清单 · 状态')
append(CL, """

---

## 六、执行结果（v89.86 · 2026-09-20）

| # | 状态 | 落点摘要 |
|---|---|---|
| P-12 | ✅ 已修 | 科技按钮 `cost.grain`→黄金短写 + title 全价（`ui.techHTML`） |
| P-13 | ✅ 已修 | 采集面板采力口径 + `gatherYield` 真尺子估算（`ui.openGatherModal`） |
| P-25 | ✅ 已修 | `_expArmySettled` 军账标记 + arrive 兜底折返 + 侦查归城 + 异常兜底（`battle.js`） |
| P-24 | ✅ 已修 | 据点「拔除据点」文案三处（按钮/出征注/数据 desc） |
| P-23 | ✅ 已修 | 战力比 < 0.5 二次确认（`ui.expPowerOf` 唯一出口 + `doExpConfirm` 闸门） |
| P-19 | ✅ 已修 | `GAME.trainLimitOf` 归因（人口/资源）+ 面板显示 |
| P-05 | ✅ 已修 | 募兵面板「每兵占人口 N（可用 X）」常驻 |
| P-04 | ✅ 已修 | `GAME.pendingUpgradeOf` + 「X 升级中（剩余 T）」两处接线 |
| P-16 | ✅ 已修 | 出征面板 `#exp-wildcap` 出兵前预警 |
| P-11 | ✅ 已修 | Lv0 野地「无驻军位」动态文案（弹窗 + 派驻面板） |
| P-02 | ✅ 已修 | data-URI favicon（0 外部文件） |
| P-15 | ✅ 已修 | 客栈空位升级引导（含官府压顶两步链）+ 按钮 title |
| P-26 | ✅ 已修 | `ui.openNewCityNotice` 守备提示 + 从主城调兵（复用 openTroopMove） |
| P-18 | ✅ 已修 | `GAME.autoBudgetCheck` 预算闸门（默认 5%）+ 自动研究上限 |
| P-21 | ✅ 已修 | `GAME.doSectTaskBulk` 连做 ×10 / 一键做完 |
| P-17 | ✅ 已修 | 离线推进上限（默认 7 日）+ `simulateOfflineOverflow` 五折折算 |
| P-20 | ✅ 已修 | 军务总览五段（全境口径）· 顶栏更名「军务」 |
| P-06 | ✅ 已修 | 故事待阅（`SG.defer/pending/takePending`）+ 史册徽标 + 阅读/忽略 |
| P-03 | ✅ 已修 | 任务「🧭 前往」（建筑类定位 + 其余切视图） |
| P-08 | ✅ 已修 | `GAME.questReachable` 可达性过滤（含 sub 对齐真 bug 修复） |
| P-07 | ✅ 已修 | 建造/科技队列花金提速（20% × 剩余比例） |
| P-22 | ⏸ 按拍板保持剥离 | 老板裁定：本轮不动（复挂入口与资产完好） |
| P-14 | ⏸ 本轮不动 | 老板裁定：野地曲线不改 |
| 门派 P1 | ✅ 加做 | 六派被动实装（`GAME.sectBonus` 唯一出口 × 六个既有消费链） |

**验证**：audit 全 0 · smoke 2451/0 · e2e 1007/0 · 破坏测试 12/12 变红 · 探针 13 组全绿。
""", '整改清单 · 执行结果')

# ============ ② 试玩测评报告：banner ============
RP = os.path.join(ROOT, 'docs', '试玩测评报告.md')
edit(RP, r"""> **本文档为活文档**，随试玩持续推进更新。""",
     r"""> **本文档为活文档**，随试玩持续推进更新。
>
> ⚠️ **整改进度（2026-09-20 · v89.86）**：本报告配套的《开发整改清单》已**全量执行**——
> P0/P1/P2 共 21 条落地 + 门派 P1 被动实装；P-22（江湖复挂）与 P-14（野地曲线）按老板裁定维持现状。
> 执行明细见 `docs/v8986改动说明.md`；回归基线：smoke 2451/0 · e2e 1007/0。""",
     '测评报告 · 整改 banner')

# ============ ③ 需求档案：表行 + 章节 ============
DA = os.path.join(ROOT, '需求档案.md')
edit(DA, r"""| v89.43 | 2026-09-19 | 3 | ① 地形集中走势（同类成片·高等级偏中心）② 城池贴图（四档位图铺菱形顶面）③ 经验曲线重标定（240 级累计 100 万） | 已完成 |""",
     r"""| v89.43 | 2026-09-19 | 3 | ① 地形集中走势（同类成片·高等级偏中心）② 城池贴图（四档位图铺菱形顶面）③ 经验曲线重标定（240 级累计 100 万） | 已完成 |
| v89.86 | 2026-09-20 | 22 | 《开发整改清单》执行：P0/P1/P2 共 21 条 + 门派 P1 被动实装（P-22 保持剥离 · P-14 不动） | 已完成 |""",
     '需求档案 · 表行')
append(DA, """

### v89.86 · 开发整改清单执行（2026-09-20 · 老板「P0+P1+P2 全做 + 门派 P1」）

**来源**：`docs/开发整改清单.md`（试玩测评 26 条问题的施工化整理）。

**P0 三条**
- P-12 科技面板「研究(NaN粮)」：v16 改黄金口径后仍读 `cost.grain` → 按钮改
  `研究(黄金 X)` + title 全价（`GAME.costString` 唯一渲染口）。
- P-13 采集面板「有效兵力上限 undefined」：v29 采力口径后仍读不存在的 `G.troopCap` →
  有效上限改按 `autoPickTroops` 取兵顺序采力到达 `powerCap` 所需兵力；估算走
  `GAME.gatherYield` **真尺子**（与结算同函数，逐值对拍一致）。
- P-25 600× 行军「军账守恒」：探针复现出真根因 —— 抵达时目标熄灭（据点当日被拔除）
  则 `prepare` 失败返回，dispatch 已扣的兵**无归还路径**（凭空消失）。修法：
  `_expArmySettled` 军账标记 + arrive 失败兜底折返 + 侦查随行归城 + 结算异常兜底；
  探针四场景全绿。

**P1 十条**：P-24 据点「拔除据点」文案三处 · P-23 兵力悬殊（<0.5）二次确认
（战力比唯一出口 `ui.expPowerOf`）· P-19 募兵上限归因（`GAME.trainLimitOf`）·
P-05 每兵占人口常驻 · P-04 前置「X 升级中（剩余 T）」（`GAME.pendingUpgradeOf`）·
P-16 野地上限出兵前预警 · P-11 Lv0「无驻军位」动态文案 · P-02 data-URI favicon ·
P-15 客栈空位升级引导（含官府压顶两步链）· P-26 新城守备提示 + 一键调兵。

**P2 八条**：P-18 自动化预算闸门（`GAME.autoBudgetCheck`，默认保留 5% + 自动研究上限）·
P-21 门派任务连做（`GAME.doSectTaskBulk`）· P-17 离线推进上限（默认 7 游戏日，
超出五折折算资源/供奉；`GAME.offlineCapDays` + `simulateOfflineOverflow`）·
P-20 军务总览五段（全境口径；顶栏「行军」→「军务」）· P-06 故事待阅
（触发不再全屏；`SG.defer/pending/takePending` + 史册徽标 + 阅读/忽略）·
P-03 任务「前往」（`ui.questJumpOf/doQuestGo`）· P-08 随机任务可达性过滤
（`GAME.questReachable`）· P-07 建造/科技队列花金提速（`GAME.queueRushCost/Pay`）。

**加做 · 门派 P1**：六派被动（行军+8% / 攻击+6% / 伤兵+15% / 攻城+8% / 器械-15% / 坐骑+20%），
全部落既有消费链；唯一出口 `GAME.sectBonus`；无门派时各链与今日逐字节一致。

**顺手修复（真 bug）**：① 任务 sub 与兵种 id 对不上（r07/r09/g22，三条任务永远做不完）；
② `ui.openTacticModal` 同名覆盖（逐兵种编辑器打不开 → 预设管理更名 `ui.openTacticSets`）；
③ audit 注释字面量误报清零。

**验证**：audit 全 0 · smoke **2451/0** · e2e **1007/0** · 破坏测试 **12/12 变红** ·
探针 13 组全绿；e2e 存量 30 处失败（v89.42~85 遗留）一并修复。
""", '需求档案 · v89.86 章节')

print('DONE')
