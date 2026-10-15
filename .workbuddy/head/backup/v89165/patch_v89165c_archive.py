# -*- coding: utf-8 -*-
"""v89.165c：需求档案补录（总览行 + 明细段）。
   运行：python .workbuddy/tools/patch/patch_v89165c_archive.py"""
import io

R = 'E:/Deepseekdb/'
p = R + '需求档案.md'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

if 'v89.165' in s:
    print('  [skip] v89.165 已在档案')
    raise SystemExit(0)

# ── ① 总览行：插在 v89.164 行之后 ──
anchor = '| v89.164 | 2026-09-27 | 3 |'
i = s.find(anchor)
assert i >= 0, '找不到 v89.164 总览行'
j = s.find('\n', i)
assert j > 0
row = ('\n| v89.165 | 2026-09-27 | 1 | **实时读秒全量排查**（老板：「指挥战斗界面的行军为啥读秒和进度条不动的？'
       '…查看所有类似实时读秒设置」）—— 递归 3 层清点器逐弹窗核对「含硬时序特征 × 有无 live」，抓出 '
       '**5 处漏网**：指挥战斗清单 / 提速小窗（+完成即关）/ 通用面板 troops·tech / 神器供奉值 / 军务烽火页（来袭剩余）；'
       '全部接入每秒刷新 · 建立常驻清点器 `audit_v89165_live.js`（漏网=0 才退 0） | '
       '已完成（详见 docs/v89165-实时读秒全量排查.md） |')
s = s[:j] + row + s[j:]

# ── ② 明细段：追加到文件尾 ──
detail = '''

---

## v89.165（实时读秒全量排查 · 老板 1 条）

> **老板原文（逐字）**：
> 指挥战斗界面的行军为啥读秒和进度条不动的？应该是有在实际计时，但没有实时显示。查看所有类似实时读秒设置

### ① 根因（老板报的那处）

`ui.openBattleList`（底栏「⚔ 指挥战斗」清单）的行军段含 `pbar` 进度条 + 「42% · 53:20」读秒，
但**从未接入 live**（每秒重开）——渲染只发生在"打开那一刻"，之后界面不再更新。
`GAME.march.progressOf` 一直在算（`march.tick` 每秒推进 elapsed），所以呈现为"实际在计时、显示不动"。
**对照**：「行军队列」（openMarches）早在 v89.135 就接了 live —— 两处**同一份数据、两套刷新**，漏网正出在这里。

### ② 全量排查（老板第 2 句「查看所有类似实时读秒设置」）

- **清点口径**：硬时序特征 = 真调用 `GAME.march.progressOf` / `durExact(` / `class="pbar|qbar"` /
  `data-*-progress|bar|left` —— **文案词（"剩余/倒计时"）不算**（首版把说明文字全误报过一遍）。
- **扫描深度**：弹窗 → 子 → 孙（3 层 BFS；首版 1 层 → 漏掉 openBattleList 这种"两级渲染"）。
- **递归 live 判定**：`openTroops → openPanel` 的 live 算已覆盖；设施函数（openModal 等）不进入（防特征传染）。
- **工具**：`.workbuddy/tools/audit/audit_v89165_live.js`（漏网 ≠ 0 退 1 · 可重跑 · 豁免表逐条写理由）。

| 分类 | 项 | 处置 |
|---|---|---|
| 已有 live | openMarches / openBuildModal / openCityPanel / openWilds / openForge / openInn / openSect / openMarket / openLandModal | 保持 |
| attr 细粒度（updateProgress 每秒原地刷） | 城内/城外格子施工条 · 城外地块面板 · 种田（data-farm-left/bar · 成熟自动换收获键） | 保持 |
| 视图逐秒（主循环） | 军务总览 over · 将领视图 · 公文正文 · 城池/城外视图 · 底栏/侧栏/顶栏 | 保持 |
| **漏网（本轮修）** | ① openBattleList ② openTrainBoost ③ openPanel（troops/tech/ext）④ openArtifacts ⑤ 军务烽火页 | **全部接入** |
| 豁免（逐条写明理由） | openExpModal / openAutoMarch（**出发前静态预估**，非读秒）· openExtModal / openFarm（attr 覆盖）· openEquipPanel / openItemsPanel（静态分支被 openPanel 分发器带出） | 保持 |

### ③ 五处修法

| # | 落点 | 修法 |
|---|---|---|
| ① | `ui.openBattleList` | `{ size:'md', live: () => ui.openBattleList() }` —— 与行军队列同口径 |
| ② | `ui.openTrainBoost` | live：`queueDone138(bIdx)` → `closeModal()`，否则重开 —— "剩余变短看得见"（上文既有承诺）+ **完成即关窗**（v89.138 原意闭环） |
| ③ | `ui.openPanel` | `troops`/`tech`/`ext` 三子视图接 live（equip/rank/story 保持静态，不白重建） |
| ④ | `ui.openArtifacts` | live（供奉值 3 点/游戏小时 → 120× 下约每 10 秒 +1 点） |
| ⑤ | `main.js` 主循环 | 军务逐秒名单 `'over'` → `['over','beacon']`（烽火页「来袭剩余」是现实时间分钟级读秒） |

### ④ 实测证据（探针 17/0 · 快照）

- 清单：首屏 `16% · 1:10:00` → 推进 120000 游戏秒 → live 重开交付的 HTML 已是 `36% · 53:20`（旧读秒零残留）；
- 提速小窗：未完成 → 重开不关窗；`elapsed` 顶满 → live 自动关窗（`_maskEl = null`）；
- 通用面板：`openPanel('troops')` 带 live · `openPanel('equip')` **对照不带**；神器面板带 live。

### ⑤ 复现与验证

```bash
node .workbuddy/tools/audit/audit_v89165_live.js     # 清点器：漏网 = 0（exit 0）
node .workbuddy/tools/probe/probe_v89165_live.js     # 探针：17/0
node smoke-test.js                                    # §165 共 12 条（含真调七条）
```

### ⑥ 诚实缺口

- 供奉值涨速低于秒级（约 10 秒 +1 点）——数字不变的那些秒是白重建（成本可忽略）；
- 出征/自动出征面板的「预计行军时长」是**出发前静态预估**，非读秒（故意不接）；
- 军务烽火页的逐秒刷新依赖主循环（视图页不在弹窗 live 体系内），守卫与 over 页同款（悬停/输入时让位）。

### ⑦ 附带发现（待老板定夺）

audit 的「仅测试引用（生产代码未用，可考虑收敛）」清单 9 项：
`GAME.genFreeOf` / `GAME.autoPickTroops` / `GAME.expBlocked` / `GAME.map.artCount` /
`GAME.battle.armySpeedOf` / `GAME.battle.attackCity` / `GAME.battle.applyWounded` /
`STORY.chronicleText` / `ui.queueBody`。
其中 `ui.queueBody`（队列汇总组件）是 v89.135「在办事项整块退役」时**有意保留**的（注释写"军务/营造总览用"），
但至今无产品调用 —— **建议：删**（老板 v89.135 已明说"在办事项…不需要，已有专门菜单"，保留即死代码；
删了就一并清 smoke 引用，成本一条补丁）。其余 8 项属各自模块的内部函数，**建议保留**（有测试在验、便于后续接线）。
'''
s = s.rstrip('\n') + detail
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  [ ok ] 档案已补（总览行 + 明细段）· 新长度', len(s))
