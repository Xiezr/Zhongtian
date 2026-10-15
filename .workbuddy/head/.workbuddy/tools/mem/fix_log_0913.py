# -*- coding: utf-8 -*-
"""回填蒸馏误删的 4 行 + 用**实测结论**替换那个错误的说明头。

事实：判据"只删 docs 里已有同一行"在 09-13 日志上只命中 **4 行 / 2325 行**（0.05%）
→ 蒸馏的收益接近于零、而风险是丢现场，**结论是不蒸馏**。
我上一轮"内容已在 docs 里"的说法是**估计，不是实测**，这里如实订正。
"""
import io, os

P = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\2026-09-13.md'
s = io.open(P, encoding='utf-8', newline='').read()

# ---------- ① 去掉那个错误的说明头 ----------
bad = ('> **v67 蒸馏说明**：本日志只做了一次"去重"——删掉 **在 `docs/` 里已有同一行**的\n'
       '> 逐条改动明细（那些内容完整保留在 `docs/_史料/历轮改动说明.md`、`docs/_史料/设计史.md`、\n'
       '> `docs/AI工作备忘.md` 里）。**所有"踩坑/根因/判断/决定/口径/实测"的现场一律保留**，\n'
       '> 在 docs 里找不到的行也一律保留。原始 82KB 未删任何独有信息。\n')
assert s.count(bad) == 1, s.count(bad)
s = s.replace(bad, '')

# ---------- ② 代码块原位回填 ----------
old_code = ('```js\n'
            '  get: function () { return GAME.res(); },   // 当前城的 res\n'
            '  enumerable: false,                          // 存档里不出现顶层 res\n'
            '});\n'
            '```')
new_code = ('```js\n'
            '  Object.defineProperty(st, \'res\', {\n'
            '  get: function () { return GAME.res(); },   // 当前城的 res\n'
            '  enumerable: false,                          // 存档里不出现顶层 res\n'
            '  configurable: true,\n'
            '  });\n'
            '```')
assert s.count(old_code) == 1, s.count(old_code)
s = s.replace(old_code, new_code)

# ---------- ③ 另 2 行：位置不可考，明确标出并回填 ----------
NOTE = ('\n> **v67 补记（蒸馏实验的误删回填）**\n'
        '> 本轮做过一次"日志蒸馏"实验，判据是"只删在 `docs/` 里能找到同一行的内容"。\n'
        '> **实测全篇 2325 行只命中 4 行（0.05%）** → 收益近零、风险是丢现场，**结论：不蒸馏**。\n'
        '> 被该实验删掉的 4 行已全部回填：2 行代码回了原处；下面 2 行**位置不可考，内容一字不差**：\n'
        '> - `- smoke **1630** / e2e **606** / audit **0**。`\n'
        '> - `- 老板：「将领，人口，资源等是归属于城池的数据，切换城池时，只统计、呈现当前的数据即可」`\n')
i = s.index('\n\n', s.index('# 2026-09-13 工作日志'))
s = s[:i] + '\n' + NOTE + s[i:]

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('① 错误说明头已撤销')
print('② 代码块已原位回填 2 行')
print('③ 另 2 行已明确标注回填')
print('   现 %d 字符 / %d 行（原 82245 / 2325）' % (len(s), s.count('\n') + 1))
