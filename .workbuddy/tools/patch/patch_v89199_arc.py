# -*- coding: utf-8 -*-
"""v89.199 需求档案补录：总览行 + 明细段"""
import io

P = 'E:/Deepseekdb/需求档案.md'
def rd(): return io.open(P, 'r', encoding='utf-8', newline='').read()
def wr(s): io.open(P, 'w', encoding='utf-8', newline='').write(s)

s = rd()
changed = False

# ── 总览行（插在 v89.198 行后） ──
ROW = u"| v89.199 | 2026-10-05 | 2 | **息屏补偿加固（loopPulse 唯一出口 + 唤醒通道 + 版本标识）· 自动征兵输入撑宽修复（wrap-ok 换行 + grid minmax）**（老板：「1.没有离线补偿，或者说离线补偿在电脑息屏时不生效，真离线了反而可以」「2.自动征兵的目标列，多个空格逐个输入数字后整个页面逐渐放大」）；门禁全绿[audit 0 · smoke 3502/0 · e2e 1205/0 · 四查过] + 实机 8/0 + 像素 2/2 | 已完成（详见 docs/v89199-息屏补偿加固与输入撑宽修复.md） |"
if u'| v89.199 |' in s:
    print('[skip] 总览行已落')
else:
    lines = s.split(u'\n')
    idx = -1
    for i, ln in enumerate(lines):
        if ln.startswith(u'| v89.198 |'):
            idx = i
            break
    assert idx >= 0, '未找到 v89.198 总览行'
    lines.insert(idx + 1, ROW)
    s = u'\n'.join(lines)
    changed = True
    print('[ok] 总览行')

# ── 明细段（文件尾追加） ──
SEC = u"""
---

## v89.199（2026-10-05）息屏补偿加固 · 自动征兵输入撑宽修复

> 1.没有离线补偿，或者说离线补偿在电脑息屏时不生效，真离线了反而可以
> 2.自动征兵的目标列，多个空格逐个输入数字后整个页面逐渐放大

**需求 ② 病根（真机复现 + 元素级定位）**：不是输入框/重绘问题 —— 自动征兵面板下部「各城栏位与缺口」的
「待补」清单**逐项累积**（每参与兵种一项），而 `.res-line .val` 是全站通用 `white-space: nowrap`
→ 行的 min-content 撑到 2076px → `.auto-grid` 的 `1fr 2fr` 被 min-content 撑开（v89.132 老坑）
→ `ui-page`/`#view-container` **整页被撑宽**。实测 1408 → 2383px（第 16 框起逐次 +117/框）。
**修法（三级 · 真机注入验证后定稿）**：① 待补行/触发记录行挂 `.res-line.wrap-ok`（换行许可 ·
min-content 2076→878）；② `.auto-grid` 改 `minmax(0,·)` + `.auto-pane { min-width: 0 }`
（**与 ① 成对生效** —— 单用 ② 会让内容溢出更糟 2589）；③ `.view-box` 加 `overflow-x: auto`
全站兜底（横向溢出不再撑破祖先）。修复后全量 32 框输入 vcSW 恒 1408、溢出元素 0，待补 15 项俱在且折行（val 高 65px）。

**需求 ① 取证（两轮探针）+ 加固**：
- **补算链本身完好**：复杂状态（多队列+行军+自动征兵）拨钟 8h → catchup 无异常、world +3,456,384（8h×120 精确）、
  募兵队列补完 —— "过夜回来看到完成"的核心机制是通的。
- **收窄出两个真实风险面**：**A 唤醒时机**（setInterval 在睡眠/冻结时停摆，恢复要等下一拍）、
  **B 旧会话代码**（页面长开不刷新 = 一直跑打开那一刻的 JS；关页面重开会加载新代码 ——
  与老板"真离线可以、息屏不行"的分野吻合，为当前最高嫌疑）。
- **加固**：`GAME.loopPulse(checkVisible)` = 时间推进**唯一出口**（记账+决策+补算），双通道 =
  setInterval 每秒 + **visibilitychange/focus 唤醒立即检查**（幂等：先到先消费）；补算异常
  **回退锚点 60 秒**（不再"异常一次吃掉整段"）；`GAME.VERSION='v89.199'` + 设置页「🧩 运行版本」行
  + **Ctrl+F5 指引**（老板自查"是否需要刷新"）。
- **实机实证**：刻意等到"距上次主循环拍 <80ms"（此后 900ms 无 interval 拍）→ 拨钟 8h + focus 事件
  → **260ms 内补算完成（Δ=3,456,000）** —— 唤醒通道独立生效的确定性证据。

**由需求引出的系统性发现**：**「旧会话代码」问题** —— file:// 页面不刷新永远跑旧 JS，
更新文件后旧标签不换代码（历史上"改完却说没变"的观感可能同源）。处置 = 版本行 + 每轮交付提醒强制刷新。

**验证**：audit 0 · smoke 3502/0（§193 升级 + §199 新增 4 条）· e2e 1205/0 · 实机 8/0 · 像素 2/2。

**复现命令**：
```bash
export PATH="/usr/bin:/bin:/c/Users/18811/.workbuddy/binaries/PortableGit/versions/1.2.0/bin:$PATH"; cd /e/Deepseekdb
node .workbuddy/tmp/diag199d_zoom.js                # 全量输入逐次量 vcSW（复现撑宽/验证修复）
node .workbuddy/tmp/diag199f_sleep.js               # 冻结恢复 + 8h 拨钟（复杂状态补算）
node .workbuddy/tools/show/shot_v89199_gates.js     # 实机 8/0（撑宽修复 + 唤醒通道 + 版本行）
python .workbuddy/tools/git/gate.py --full          # audit 0 · smoke 3502/0 · e2e 1205/0
```
"""
if u'## v89.199' in s:
    print('[skip] 明细段已落')
else:
    s = s.rstrip() + u'\n' + SEC
    changed = True
    print('[ok] 明细段')

if changed:
    wr(s)
    print('档案已更新')
else:
    print('无改动')
