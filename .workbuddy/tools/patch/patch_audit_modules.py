# -*- coding: utf-8 -*-
"""audit.js 的两份模块清单改从 js/modules.json 读（单一来源）。

顺带修掉一个**一直存在的假绿**：MODULES 里漏了
  gltf / bitmaps / gicons / portraits / tactic
这 6 个模块的函数从来没有被死函数检查扫过 —— 索引第一次对账就抓到了。
"""
import io
import re

P = 'audit.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

if 'js/modules.json' in s:
    print('SKIP：已经改过')
    raise SystemExit(0)

# ---------- MODULES ----------
pat1 = re.compile(r"const MODULES = \[[\s\S]*?\];")
assert pat1.search(s), 'MODULES 没找到'
NEW1 = '''/* v156.28：**从 js/modules.json 读**（唯一权威清单）。
   历史上这里是手抄的数组，结果漏了 gltf / bitmaps / gicons / portraits / tactic
   —— 那 6 个模块的函数从来没进过死函数扫描（索引对账第一次跑就抓到了）。
   现在清单只有一份，改模块只需要改 modules.json 的 layout.order。 */
const MODULES = require('./js/modules.json').order;'''
s = pat1.sub(lambda m: NEW1, s, count=1)

# ---------- REF_MODULES ----------
pat2 = re.compile(r"const REF_MODULES = \[[\s\S]*?\];")
assert pat2.search(s), 'REF_MODULES 没找到'
NEW2 = '''/* v156.28：同上，与 MODULES 共用唯一来源。原先这份漏 gltf / duel3d —— 于是
   `GAME.gltf.xxx` 被报成"引用了不存在的成员"（判据A 的假红就是这类漏收造成的）。 */
const REF_MODULES = MODULES;'''
s = pat2.sub(lambda m: NEW2, s, count=1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ audit.js：MODULES / REF_MODULES 改读 js/modules.json')
