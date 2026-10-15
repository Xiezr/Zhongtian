# -*- coding: utf-8 -*-
"""v89.226 复核 · 工作记忆 + 技能 §136 沉淀。"""
import io, os

MEM = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-10-07.md'
SK = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'

mem_entry = """

## v89.226 全面复核（v89.225 交付独立取证 · 零产品改动 · ~02:40~03:05）
- 独立复算：CSS↔data 全量 32/32（反推 v4 主题变换 = light s×0.95/l×1.15cap85 · bamboo s×0.88/l×1.19cap85 · dark2 l×0.76；Py/JS 双舍入 0 差）；素材三证（md5 stage=UI 全同 · 切分确定性区外=0 · 无旗普查 4806→≤15px）；管线 --check 16/16。
- 门禁全量重跑：smoke 3584/0（新增 §225③b，清挂账②）· audit 0 · e2e 1132/0 · gate --full ✓ · 实机 11/0。
- 抓真缺口 7 项（全工具/守卫层）：①flag_bldg_icons 墓碑守卫晚于模块级解析→运行即崩（前移）②check_v89121_flags_on_screen 旗时代检查器未退役（补墓·守卫置第三方导入前·双 python 验证）③batches note「必贴族旗」过时 ④probe_v89225k 标签 ⑤verify_v89106 注释 ⑥design_v89225 标注 v1 草稿 ⑦§225③b。
- 教训：墓碑守卫必须早退到「模块级代码/第三方依赖」之前；复核轮固定动作 = 逐一试运行已退役工具（判据=输出是退役说明而非报错）+ 独立复算换实现路径 +「可补」挂账当场清 + 工具卫生扫语义词。
"""

sk_sec = """

## §136 复核轮的"墓碑守卫早退"与三件套（v89.226 实战）

复核"已完成"轮次时，除门禁全量重跑外，**逐一试运行全部已退役工具** —— 判据 =
"运行输出是该工具的退役说明"，不是退出码、更不是"文件在就行"。本轮实抓两个反例：

1. **墓碑守卫晚于模块级代码 = 名存实亡**：`flag_bldg_icons.py` 的 sys.exit 在文件末尾，
   模块级解析（读已删字段 `SERIES[].flag`）在其之前 → 运行报 AssertionError、永远到不了退役说明。
   修法 = 守卫**前移到一切解析/绘图代码之前**。
2. **守卫晚于第三方依赖导入 = 环境相关崩溃**：`check_v89121_flags_on_screen.py` 守卫在
   `from PIL import Image` 之后 → 缺 PIL 的 python 先崩在 import。修法 = 守卫放在
   **所有第三方导入之前**（只依赖 sys）；验证 = **双 python 各跑一遍**，输出都须是退役说明。

复核轮三件套（在既有流程上补）：
- **① 独立复算换实现路径**：颜色/数值"对齐"声称用**不同语言/算法**重算
  （本轮 Python colorsys vs smoke 的 JS rgbOfHsl），并对比**舍入模式**
  （Python round 银行家 vs JS Math.round —— 先证 0 差，再把 Math.round 写进断言）。
- **② "可补"型挂账当场清**：复核先验证成立（反推 + 全量），成立即**当场补断言**清账
  （本轮 §225③b：三主题变换反推 → 32/32 复现 → 24/24 断言）；验证不成立才留挂账。
- **③ 工具卫生扫"语义词"**：feature 退役后 grep 工具目录**不能只扫符号名**
  （`.flag:` / `load_series`），要扫**语义词**（"族旗"/"带旗"/"必贴"）——本轮据此抓出 3 处
  会误导的残留（一次性检查器 / batches note / probe 标签）。
- **④ 设计草稿防误读**：迭代期 `design_*.py` 常停在早期候选 —— 复核时给它头部标注
  "vN 草稿；最终值以应用面为准 + 变换公式 + 锁定断言位置"。
"""

# ---- 记忆 ----
s = io.open(MEM, encoding='utf-8', newline='').read() if os.path.exists(MEM) else '# 2026-10-07 工作日志\n'
if 'v89.226' in s:
    print('[skip] 记忆已含 v89.226')
else:
    tmp = MEM + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s.rstrip('\n') + mem_entry)
    os.replace(tmp, MEM)
    print('[ok] 记忆已追加')

# ---- 技能 ----
k = io.open(SK, encoding='utf-8', newline='').read()
if '§136' in k:
    print('[skip] 技能已含 §136')
else:
    tmp = SK + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(k.rstrip('\n') + sk_sec)
    os.replace(tmp, SK)
    print('[ok] 技能 §136 已追加')

# ---- 自检 ----
m2 = io.open(MEM, encoding='utf-8', newline='').read()
k2 = io.open(SK, encoding='utf-8', newline='').read()
assert 'v89.226' in m2 and '§136' in k2
print('自检通过：记忆 v89.226 在册 · 技能 §136 在册')
