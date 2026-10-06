# -*- coding: utf-8 -*-
"""v89.204：SKILL 沉淀追加 §116"""
import io

P = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

SEC = """

## §116. 「口径改制」的连锁清单 / 体验红线字段 / 切片边界依赖（v89.204 民心占领）

### 116.1 ⛔ 「体验红线」字段：老板推翻时改"字段+注释+断言"三连
`DATA.INVASION.loseCity: false // ⛔ 体验红线：输了不丢城` —— 这类字段的注释里**载明了
设计意图**。老板提新需求（"别的城池将会被敌方占领"）即红线撤销：字段改 `true` +
注释改写成"撤销依据与保护对象（主城）" + 断言改 `=== true`（标题注明规则变更）。
**改前先 grep 该字段的全部消费点**（本轮=1 处判定 + 1 条断言）。

### 116.2 ⛔ 「口径改制」（守备值 → 民心）的连锁面清单（照单核对）
给一个既有概念改名/改语义（本轮：hold=守备 → 民心），改动面 = **8 处**：
① 数据表（`DATA.SIEGE` 新键 + 旧键退役）；② 域出口（chip 计算改固定 —— 出口签名变，`length` 断言随动）；
③ 战斗落账（**判定条件也变了**：本轮"不论胜负都推进"→"仅胜推进"——这是语义变更不是改名）；
④ 玩家侧新概念（战争创伤出口组 + 失城处置）；⑤ 结算接线（invasionResolve）；⑥ 文案全清
（战报/日志/面板 `grep 旧词` 逐个改）；⑦ 显示消费点（侧栏/官府/税收/预警）；⑧ 测试面
（本轮 7 条升级 + 新段）。**"改名"与"改语义"要分开汇报**——前者是体力活，后者会打穿行为断言。

### 116.3 ⛔ 删函数会**静默改"切片边界"**（本轮抓出 2 处）
smoke 里常见 `s2 = u.slice(u.indexOf('ui.openForge = function'),
u.indexOf('ui.openForgeSetInfo = function'))` —— 后者是**边界标记**不是断言对象！
删 openForgeSetInfo 后 `indexOf === -1` → `slice(0, -1)` **静默吞掉最后一个字符**（不报错、
内容近似）→ 判据可能假绿/假红。**删函数前 grep 全仓该函数名，逐处判断"是消费还是边界"**；
边界替换成"下一个稳定标记"（本轮= `ui.ENH_PER_PAGE`，它在 openForge 之后的注释里首次出现）。

### 116.4 ⛔ "状态显示"改"按实体"时：消费点四查（显示/结算/公式/预警）
s.hearts（全境派生）→ cityHeartsOf（按城）后，**四处必须同查**：
① 显示（侧栏/官府 —— 改按城 + 悬停分解）；② 结算公式（税收 `cityProdPerSec` 逐城改按城）；
③ 分账公式（`prodBreakdown` 与结算**同源**——只改一处就是"显示与结算两本账"，v89.162 的老坑）；
④ 预警/判定（invasion 文案与失城闸）。
**grep 旧读取面（`s.hearts`）拿到全部行**，逐处分派"跟/不跟"并写注释。

### 116.5 分页条"页码居中"= 三栏 grid（可抄）
```css
.pager { display: grid; grid-template-columns: 1fr auto 1fr; width: 100%; ... }
.pager .pg-side.l { justify-content: flex-start; }   /* 前导：首页/上页/数字页 */
.pager .pg-side.r { justify-content: flex-end; }     /* 后导：下页/末页 */
.pager .pg-info { text-align: center; white-space: nowrap; }   /* 中=页码（恒定居中） */
.pager > .pg-info:only-child { grid-column: 2; }     /* 单元素态（暂无记录/共 N 项） */
```
- `width:100%` 必须有（弹窗 foot / 底栏都是 flex 容器；否则 grid 收缩到内容宽、居中失效）；
- 底栏（`.bottombar`）另留右 margin 52px（缩略图绝对定位 right:10+40px —— 实测间隙 14px）；
- 实机判据 = **页码中点与条中点之差 ≤2px**（rect 中点差 **÷k** 后比 —— offsetParent 链不可靠）。

### 116.6 小坑三枚
- **卡片成本行改悬停**：`.ec-cost` 删净（CSS + 两处卡面）+ title 并成本 + **卡高不变**
  （84px 由图决定）—— 实机判据：`.ec-cost` 节点数 0 + title 含成本 + 卡高 84±3。
- **"巡环版本号"断言**：smoke §199④ 写死 `v89.NNN` 正则 —— **每轮改版本号必须同步它**
  （本轮差点被门禁拦下：smoke 3541/1 的红单就是它）。
- **实机底栏重叠判据方向**：`overlap = pager.right − mini.left`，**`< 0` 才是不相交**
  （首版写 `> 0` 当场假红）。
"""

s = rd(P)
if '§116' in s:
    print('[skip] SKILL §116')
else:
    wr(P, s.rstrip() + SEC)
    print('[ok] SKILL §116')

print('skill done')
