# -*- coding: utf-8 -*-
"""v89.226 复核 · 需求档案补录：
① 总览表插 v89.226 行（锚：v89.225 行尾）
② v89.225 明细段的挂账② 标注"已由 v89.226 清掉"
③ 文件尾追加 v89.226 明细段
幂等：v89.226 标记存在即跳过对应段。
"""
import io, os

BASE = 'E:/Deepseekdb/'
p = '需求档案.md'
s = io.open(BASE + p, encoding='utf-8', newline='').read()

if '\r\n' in s:
    s = s.replace('\r\n', '\n')
    print('[note] 归一 LF')

# ---------- ① 总览行 ----------
if '| v89.226 |' in s:
    print('[skip] 总览行')
else:
    anchor = '| 已完成（详见 docs/v89225-族旗退役与地块染色.md） |'
    assert s.count(anchor) == 1, 'row anchor x%d' % s.count(anchor)
    row = ('| v89.226 | 2026-10-07 | 0 | **全面复核（v89.225 交付独立取证 + 全库工具卫生 · 零产品改动）**：'
           '① 15 项声称逐项独立复算（CSS↔data 全量 32/32 · 素材三证 · 管线门禁 16/16 · 门禁/实机全量重跑）'
           '② 抓真缺口 7 项并修（两条退役工具墓碑守卫位置错误 · batches note 过时指引 · 标签/注释/草稿标注四处卫生）'
           '③ 清掉挂账②：补 smoke §225③b（三主题逐字节 24/24）（老板原文：「全面复核」） | '
           '已完成（复核交付，详见 docs/v89226-全面复核.md） |')
    s = s.replace(anchor, anchor + '\n' + row)
    print('[ok] 总览行')

# ---------- ② 挂账② 标注 ----------
old2 = '② 其余三主题色值未做逐字节断言（存在性+8×4 已验，全量矩阵已实测）。'
if '已由 v89.226 复核清掉' in s:
    print('[skip] 挂账标注')
else:
    assert s.count(old2) == 1, 'annot anchor x%d' % s.count(old2)
    s = s.replace(old2, '② 其余三主题色值未做逐字节断言（存在性+8×4 已验，全量矩阵已实测）→ **已由 v89.226 复核清掉**（smoke §225③b · 24/24 逐值对齐）。')
    print('[ok] 挂账标注')

# ---------- ③ 明细段 ----------
if '### v89.226' in s:
    print('[skip] 明细段')
else:
    sec = '''

### v89.226

**需求（老板原文 · 逐字）**：

> 全面复核

**交付**：v89.225 交付**独立取证复核**（不采信上轮自述）+ 全库工具卫生复查 —— **零产品改动**（GAME.VERSION 维持 v89.225）。文档：`docs/v89226-全面复核.md`。

**复核（逐项 · 独立复算）**：
- 数据/样式：SERIES 8 族 plot 齐备 · flag 可执行形态零残留 · 8 规则 + 32 变量在册；**CSS↔data 逐字节 = 独立 Python 路径全量复验 32/32**（含舍入模式对比 0 差）。
- 素材：16 图标无旗普查（带旗旧版 4806px/张 vs 现行 ≤15px）· apply 完整性（md5 stage vs UI 全同）· 切分确定性（95872 差异**全部**在旗几何内、区外=0）。
- 管线/工具：`wasteland_batch.py --check` 复跑 16/16 · 退役工具逐一试运行 · 门禁与实机全量重跑。
- 门禁：smoke **3584/0**（§225×7）· audit 全 0 · e2e **1132/0** · `gate.py --full` ✓ · 实机 **11/0**（8 族色 ±0）。

**抓真缺口 7 项并修（全在工具/守卫层）**：
① `flag_bldg_icons.py` 墓碑守卫在文件末尾、晚于模块级解析 → 运行即 AssertionError 崩（退役防线名存实亡）→ 早退守卫前移；
② `check_v89121_flags_on_screen.py`（旗时代一次性检查器）未退役 → 补墓碑（守卫置于依赖导入之前 · 双 python 验证）；
③ `wasteland_batches.json` note「必贴族旗」→ 改「不贴旗」；④ `probe_v89225k` 输出标签修正；⑤ `verify_v89106_screen.js` 注释更新；⑥ `design_v89225_plot.py` 标注「v1 草稿 · 最终值以应用面为准」；
⑦ **挂账②清掉**：补 smoke §225③b（light/bamboo/dark2 逐值对齐 · 24/24）。

**未完成清单（复核后）**：① 训练/防御是否再分家（**需老板拍板** · 建议维持）② 批次二（材料 24 名 + use 文案 + 百炼/藏珍阁专名 · 可执行）③ 批次三（docs 活文档同步 · 可执行）④ 黄金/人口更名评估（随批次二）。
'''
    s = s.rstrip('\n') + sec
    print('[ok] 明细段')

tmp = BASE + p + '.tmp226'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, BASE + p)

# ---------- 自检 ----------
c = io.open(BASE + p, encoding='utf-8', newline='').read()
assert '| v89.226 |' in c and '### v89.226' in c and '已由 v89.226 复核清掉' in c
assert c.count('| v89.226 |') == 1 and c.count('### v89.226') == 1
print('自检通过：v89.226 行 x1 · 明细段 x1 · 挂账标注 x1')
