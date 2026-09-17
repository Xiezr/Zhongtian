# -*- coding: utf-8 -*-
"""
v89.7 文档补录（2026-09-17）
- 需求档案.md        : 追加 v89.7 条目（CRLF）
- docs/设计规范.md   : 追加 §37（CRLF）
- docs/AI工作备忘.md : 追加 §39（LF）
"""
import io, sys

ROOT = r'E:\Deepseekdb'


def append(p, text, crlf):
    full = ROOT + '\\' + p
    src = io.open(full, encoding='utf-8', newline='').read()
    if 'v89.7' in src:
        print('SKIP（已含 v89.7）：' + p)
        return
    block = text.replace('\n', '\r\n') if crlf else text
    if not src.endswith('\n'):
        src += '\r\n' if crlf else '\n'
    out = src + block
    io.open(full, 'w', encoding='utf-8', newline='').write(out)
    back = io.open(full, encoding='utf-8', newline='').read()
    assert 'v89.7' in back and back.endswith(block[-3:]), '落盘回查失败：' + p
    print('OK  ' + p)


# ---------------- 需求档案.md（CRLF） ----------------
REQ = '''
### v89.7 · 头像可更换 + 供奉公文静默（2026-09-17 · 老板「头像可更换；供奉+1这个公文不要显示」）

**落地**
- 头像可更换：`GAME.setLordAvatar(idx)` —— 只改 `s.ruler.portraitSeed` 一处，**两处同源**
  （顶栏立绘 + 君主将领的脸，同改名口径）；顶栏头像本身成为入口（`data-action` 挂外层，
  `syncHeader` 每秒重绘不丢），君主面板新增「头像」行（现脸缩略图 + 更换）。
  更换面板 `ui.openAvatarPick`：与创建界面同一头像池（按性别 20 张），5×4 一屏点选即换、
  高亮跟走、越界拒绝；「完成」回君主面板。
- 供奉公文静默：`GAME.artGain` 两条规则 —— ① 只有「有缘由」的入账（占城 / 晋升）写公文，
  时长累积一律静默（升阶报喜保留）；② 小数寄存 `s.artifacts.frac` 攒整 ——
  修前 120× 下每秒 0.1 被 `Math.round` 整段吃掉（**供奉永远不涨**），600× 下每秒刷一条
  「供奉 +1」公文（老板所见）；修后各倍率口径一致：3 点 / 游戏小时。

**验证**：smoke 2251/0（§82 四条）· e2e 806/0（§82 四条真实点击）· audit 全 0 ·
探针（120× 15 秒 = +1 且零公文；600× 10 秒零公文；事件入账照写；越界拒绝且不动 seed）。
- 细节：`docs/设计规范.md` §37；`docs/AI工作备忘.md` §39。
'''

# ---------------- docs/设计规范.md（CRLF） ----------------
SPEC = '''
## 37. v89.7 头像可更换 + 供奉公文静默（2026-09-17 · 老板「头像可更换；供奉+1这个公文不要显示」）

**① 头像可更换（唯一事实源 = `s.ruler.portraitSeed`）**
- `GAME.setLordAvatar(idx)`：按性别取池（m / f 各 20 张），越界一律拒绝（不动任何字段）；
  一处改、**两处同源** —— 顶栏 `#lord-avatar`（`syncHeader` 读 rulerSeed）与君主将领
  （`makeLordGeneral` 写入的 `g.portraitSeed`）同时换脸（v70「同脸」口径）。
- 入口两个：① 顶栏头像（`data-action` 挂在**外层 div** —— syncHeader 每秒只换内部立绘，
  动作不丢）；② 君主面板「头像」行（`.lord-av-mini` 缩略图 + 更换按钮）。
- `ui.openAvatarPick`：`.modal-lg` + `noClose`（底部「完成」自管：回君主面板，同改名流程）；
  网格 `.av-grid` 5×4（`.av-cell` 96px · `aspect-ratio: 1/1` · 当前脸 `.cur` 高亮）；
  点选即换并**原地重绘**（高亮跟走）。
- 存档：只存 seed（几字节），老档免迁移；换脸不写公文、只 toast。

**② 供奉公文静默（`GAME.artGain` 两条规则）**
- 写公文的条件 = **有缘由**（`why` 非空：占城 `开疆拓土 · X` / 晋升 `爵位晋升 · X`）；
  时长累积（`artTick` 传空 why）一律静默 —— 升阶那条报喜保留。
- 小数寄存 `s.artifacts.frac`（入档）：`add = floor(n)`，小数攒入 frac、满 1 进位。
  ⚠️ 修前 120× 每秒 n=0.1 被 `Math.round` 吃掉 → 供奉**永远不涨**；600× 每秒 n=0.5 →
  每秒一条「供奉 +1」公文（老板所见）。修后各倍率 / 在线离线口径一致：**3 点 / 游戏小时**。
- 边界：`pts` 永远整数（界面与门槛判定不动）；frac ∈ [0,1)；`artGain` 返回**实际入账**整数。

**验证**：smoke 2251/0（§82 四条）· e2e 806/0（§82 四条真实点击）· audit 全 0 ·
探针（120× 15s → +1 且零公文 · 120× 120s → +11（名义 12）零公文 · 600× 10s → +5 零公文 ·
事件 +500 照写公文 · `setLordAvatar` 越界拒绝且不动 seed）。
'''

# ---------------- docs/AI工作备忘.md（LF） ----------------
NOTE = '''
### 39. v89.7 · 头像可更换 + 供奉公文静默（工程视角）

1. **「不要显示某条公文」先查它从哪来**：供奉刷屏有三个候选来源（时长链 / 占城 / 晋升），
   实测定位到根因是**取整吃掉小数** —— 120× 每秒 n=0.1 被 `Math.round` 归零（"供奉永远不涨"
   的真 bug，老板从未见过，只见过 600× 的刷屏）。修法不是"把日志删掉"，而是
   **小数寄存 + 入账条件收紧**：一个改动同时解决刷屏与不涨两个症状。
2. **补丁往字符串拼接链里插 IIFE，收尾三件套是高频雷**：`;` `})()` `+ 尾部串` 的顺序
   本轮栽两次（缺 `})() +` / 悬空 `+`），全靠 `node --check` 当场抓住。
   **改完立即语法检查，不跑测试先跑 check**（check 秒级，测试分钟级）。
3. **"挂外层"是每秒重绘节点的唯一稳定接线点**：`#lord-avatar` 内层 innerHTML 每秒被
   `syncHeader` 重写 —— `data-action` 必须挂外层 div（委托用 `closest` 向上找）。
   往这类节点加交互时，先问"谁在重写它的孩子"。
4. **一处事实源 = 全部消费点同更**：`portraitSeed` 有两个消费点（顶栏 / 君主将领），
   换脸动作像改名一样**两处一起写**；只写一处 → 顶栏换了、将领页还是旧脸。
5. **e2e 断言"高亮跟走"**：点选后面板原地重绘 —— 断言 `seed 变 + .cur 落位 + 顶栏 img 换源`
   三件事同时成立才算"接线正确"；只断言 seed 变会漏掉重绘链路。
'''

append('需求档案.md', REQ, crlf=True)
append('docs/设计规范.md', SPEC, crlf=True)
append('docs/AI工作备忘.md', NOTE, crlf=False)
print('ALL OK · 三处文档已补录')
