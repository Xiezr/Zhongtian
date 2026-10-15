# -*- coding: utf-8 -*-
"""v89.209 · 补丁 D：需求档案（总览行 + 明细段）
   总览行插在 v89.207 行之后；明细段追加到文件尾（幂等 guard）。"""
import io

P = 'E:/Deepseekdb/需求档案.md'

with io.open(P, 'r', encoding='utf-8', newline='') as f:
    s = f.read()
n0 = len(s)

# ── D1 总览行 ──
if '| v89.209 |' in s:
    print('[skip] D1 总览行已在')
else:
    anchor = '） | 已完成（详见 docs/v89207-快赢与离线纪要.md） |\n'
    c = s.count(anchor)
    assert c == 1, 'D1 anchor count=' + str(c)
    row = ('| v89.209 | 2026-10-06 | 4（修复 2 · 规划 2 未实施） | '
           '**v89.208 评估缺陷链修复：存档形状抽检（saveShapeChk 唯一出口 · importText/adoptState 双闸）· '
           'adoptState 原子回滚（失败不留半迁移态）· syncSeq/nextGenId 守卫（坏档不再锁死「新游戏」）**'
           '（老板：评估报告「建议立即修」两条 + 「⛔3」连锁守卫）；**规划（未实施 · 待拍板）**：'
           '数字键扩到全部 14 页签 + 弹窗 Tab/Enter 导航 · 环境型系统「状态条」'
           ' | 已完成（详见 docs/v89209-坏档导入与原子读档.md） |\n')
    s = s.replace(anchor, anchor + row, 1)
    print('[ok] D1 总览行已插入')

# ── D2 明细段（追加到文件尾） ──
if '## v89.209 ·' in s:
    print('[skip] D2 明细段已在')
else:
    SEC = u"""
## v89.209 · 2026-10-06 · 存档缺陷链修复（形状抽检 / 原子读档 / seq 守卫）

**来源**：v89.208 评估（并发会话 · `docs/v89208-实证评估-新发现.md`）的三个缺陷 + 老板「建议立即修 / 建议规划」。

**需求（老板转述的评估报告 · 逐字节选）**：
> ⛔1 importText 只验 cities 是非空数组，不验元素结构。[{}]/[null]/[5000个{}]/generals:'oops' 全部放行 —— 坏档能导入
> ⛔2 adoptState 第一行就 GAME.state = st，非原子；中途抛错时内存已是半迁移态，而 loadFrom 把异常吞了返回 null —— 静默坏状态被当正常档用
> ⛔3 nextGenId `((s&&s.generals)…`（坏档连锁：连「新游戏」都开不了）
> 建议立即修：importText 加结构抽检…… adoptState 改原子……
> 建议规划（非缺陷）：3. 数字键扩到全部 14 页签 + 弹窗内 Tab/Enter 导航（键盘流闭环）。4. 环境型系统加"状态条"提升可发现性。

**交付（修复 · 已实施）**：

| # | 改动 | 落点 |
|---|---|---|
| ① | `GAME.saveShapeChk` 形状抽检（唯一出口）：数组类型 + 元素必填字段（id/name；城池另有 x/y 坐标）—— `importText` 与 `adoptState` **双闸** | state.js |
| ② | `adoptState` **原子化**：先存 prev → 挂新档跑迁移链 → 异常回滚 prev 再抛（迁移链助手读全局 `GAME.state`，"赋值挪到最后一步"行不通——已在代码注释写明）；成功路径零变化 | state.js |
| ③ | `syncSeq` / `nextGenId` 非数组守卫（`Array.isArray` 归位 + 元素防 null） | state.js |
| ④ | 版本号 v89.207 → v89.209（v89.208 编号已被并发评估轮占用，避免混号） | main.js |

**改前 / 改后对照**（同一支探针 `probe_v892209_import.js` 跑两遍）：
- 改前：**3 通过 / 14 失败** —— 坏档 10 发全被接受 · ③b `sameRef=false leaked=true`（半迁移实证）· ④ `generals.forEach is not a function` · ⑥ 新游戏连锁崩
- 改后：**17 / 0 全绿**

**并发评估探针复跑**（`probe_v89208_robust.js` · 未改动其源码）：
- ① 畸形包 7 接受 → **5 类全拒**（cities[{}] / [null] / 5000×{} / generals:'oops' / map:null 各报明确原因）；另 2 条按设计保留（省略 _check · __proto__ 无风险）
- ② 半迁移 → **「✅ 未观察到半迁移」**（首城 col=8 复原）
- ③ 往返保真 0 差异 · ⑦ 性能谱线不变

**规划（未实施 · 待拍板）**：键盘流闭环（14 页签键位 + 弹窗 Tab/Enter）与环境状态条 —— 设计稿见 `docs/v89209b-键盘流与状态条规划.md`。

**诚实缺口**：
1. 全仓 36 处 `(x || []).method()` 同族写法**未全量兜底** —— 评估报告口径「修门比修 36 处划算」；修门后残余风险窗口 = "手改 localStorage 塞非数组"，且 adoptState 原子回滚兜底（深链坏 → 回滚不崩）。
2. 规划两项仅设计稿，未实施。

**复现命令**：
```bash
node .workbuddy/tools/probe/probe_v892209_import.js
NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/probe/probe_v89208_robust.js
python .workbuddy/tools/git/gate.py --full
```
"""
    s = s.rstrip() + '\n' + SEC + '\n'
    print('[ok] D2 明细段已追加')

with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('需求档案：%d -> %d 字符' % (n0, len(s)))

# 写后自检
with io.open(P, 'r', encoding='utf-8', newline='') as f:
    chk = f.read()
assert chk.count('| v89.209 |') == 1
assert chk.count('## v89.209 ·') == 1
assert 'saveShapeChk' in chk
print('写后自检 OK')
