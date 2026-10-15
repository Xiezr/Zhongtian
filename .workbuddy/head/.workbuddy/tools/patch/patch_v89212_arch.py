# -*- coding: utf-8 -*-
# v89.212：需求档案补录 + 版本号（main.js）+ 版本断言随轮升级（smoke §199④）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark=None, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

ARCH = 'E:/Deepseekdb/需求档案.md'
MAIN = 'E:/Deepseekdb/js/main.js'
SM = 'E:/Deepseekdb/smoke-test.js'

# ---------------- 总览行 ----------------
rep(ARCH, '总览行 v89.212',
    "| 已完成（详见 docs/v89211-强化链修复与占城补齐与器械工位.md · 另 docs/v89211b-换世界观参考-时代背景与故事方案.md） |",
    "| 已完成（详见 docs/v89211-强化链修复与占城补齐与器械工位.md · 另 docs/v89211b-换世界观参考-时代背景与故事方案.md） |\n"
    "| v89.212 | 2026-10-06 | 2 | **城外堆场按资源分账（农田只堆粮 / 林场只堆木 / 石场只堆石 / 矿场只堆铁 ——「地块多的存的多」；"
    "五处业务消费点按资源封顶：tickOnce / 离线 / 逾溢 / 入账 / 运输）· 出征行序按老板令重排（目标→主将→出征方式→方案→战术→计略→可用道具）**"
    "（老板：「城外资源建筑并未提供准确储存上限，目前可以看到，各资源地块数量不同，但是最终储存上限一样，应该是地块多的存的多吧」"
    "「出征界面左侧排序：目标，主将，出征方式，出征方案，出征战术，出征计略，可用道具」） | 已完成（详见 docs/v89212-堆场分账与出征行序.md） |",
    '| v89.212 |')

# ---------------- 明细段（追加） ----------------
detail = """

---

## v89.212 —— 城外堆场按资源分账 + 出征行序（老板 2 条 · 2026-10-06）

**老板原文**：
> 1. 城外资源建筑并未提供准确储存上限，目前可以看到，各资源地块数量不同，但是最终储存上限一样，应该是地块多的存的多吧
> 2. 出征界面左侧排序：目标，主将，出征方式，出征方案，出征战术，出征计略，可用道具

### ① 城外堆场按资源分账（v89.212 老板 1）

- 病根：`extStoreCapOf` 把 Σ(所有地块等级) 摊给**四种资源共用** —— 农田多不多、林场多不多，
  四类上限都一样（老板原话「最终储存上限一样」；改前实证：4田1木 与 1田4木 两城四资源全等）。
- 改后（唯一出口组）：
  · `GAME.extStoreCapByResOf(city)` → { grain, wood, stone, iron }（农田只堆粮 / 林场只堆木 /
    石场只堆石 / 矿场只堆铁；逐类在"该类等级和"上取整一次 —— 合计 = Σ分账，账目自洽）；
  · `GAME.extStoreCapOf(city[, key])` → 无 key = 四类合计；带 key = 该类；
  · `GAME.storePartsOf` 增 `extByRes` / `capByRes`（capByRes[k] = base + extByRes[k]）；
  · `GAME.storeCapOf(city[, key])` → 带 key 按资源（业务判定）、不带 key 合计（展示/兼容）。
- 五处业务消费点全按资源：tickOnce / 离线 bulk / simulateOfflineOverflow（三处循环）·
  overflowRotOf（逾溢）· addResCapped（入账）· transportPlanOf（运输）· systems._openChest（开箱）。
- UI 同步：资源栏悬停（本资源上限 +「· 城外堆场（本类地块）：+X」）· 仓库面板（四行各显各的上限，
  空仓库提示按资源列账）· 建造面板（本城上限四资源）· 城外面板（「另加<归属资源>上限」）·
  选建悬停（"每级另加<资源>上限"）。
- 首城实测（2田1木1石1铁）：粮 266.7万 > 木/石/铁 233.3万 ——「地块多的存的多」成立。

### ② 出征行序（v89.212 老板 2）

- 改前：目标 → 主将 → **计略** → 出征方式 → 方案 → 战术 → 可用道具；
- 改后（老板令）：目标 → 主将 → **出征方式 → 方案 → 战术 → 计略** → 可用道具；
- 块体一字未动（仅换位置）；调运/驻守不接战三块同隐的语义保留（v89.156/157）。

**验证**：audit 0 · smoke 3587/0（§212×7）· e2e 1274/0（§212e×2）· 实机 N/0 · 像素 N/N ·
探针 2 支（a 14/0 · b 4/0 · 均带改前基线）· 官方门禁全绿。（数字收尾回填）

**复现命令**：
```bash
node .workbuddy/tools/probe/probe_v89212a_ext.js
node .workbuddy/tools/probe/probe_v89212b_order.js
node .workbuddy/tools/show/shot_v89212_gates.js
node .workbuddy/tools/asset/check_v89212_shots.js
node smoke-test.js && node e2e-test.js && node audit.js
```
"""

s = rd(ARCH)
if '## v89.212' in s:
    print('[skip] 明细段 v89.212')
else:
    wr(ARCH, s.rstrip() + detail)
    print('[ok] 明细段 v89.212')

# ---------------- 版本号 ----------------
rep(MAIN, '版本号 v89.212',
    "  GAME.VERSION = 'v89.211';",
    "  GAME.VERSION = 'v89.212';")

# ---------------- 版本断言随轮升级 ----------------
rep(SM, '§199④ 版本断言升级',
    "      return /GAME\\.VERSION = 'v89\\.211'/.test(mS199)   /* v89.211：版本号每轮迭代更新（本条随轮升级） */",
    "      return /GAME\\.VERSION = 'v89\\.212'/.test(mS199)   /* v89.212：版本号每轮迭代更新（本条随轮升级） */",
    "/GAME\\.VERSION = 'v89\\.212'/")

print('--- 档案/版本 完成 ---')
