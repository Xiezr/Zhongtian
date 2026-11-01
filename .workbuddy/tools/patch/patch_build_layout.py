# -*- coding: utf-8 -*-
"""让 build_bundle.py 从 js/modules.json 的 layout 读顺序与分包。

这是「索引必须被消费」那一步：否则 modules.json 只是第 9 份清单。
打破循环的做法写在 gen_index.js 顶部 —— layout 首次从本脚本迁移，之后以 json 为准。
"""
import io
import os
import re
import sys

P = '.workbuddy/tools/patch/build_bundle.py'
s = io.open(P, encoding='utf-8', newline='\n').read()

if '_load_layout' in s:
    print('SKIP：已经改过')
    sys.exit(0)

NEW = '''# ============================================================
# v156.28：模块顺序 / 分包**不再写在这个脚本里** —— 从 js/modules.json 的 layout 读。
# ------------------------------------------------------------
# 以前"这个项目有哪些模块"在仓库里有 8 份副本（构建 / audit / smoke ×2 /
#   审计子脚本 ×6），加一个模块要改 8 处，漏一处就假红或假绿
#   （ui.js 拆分那次，smoke 一度掉到 3754 通过 / 658 失败）。
# 现在：**layout 是唯一手改处**，改 js/modules.json 的 layout.order 即可，
#   索引生成器与构建器共用同一份，不会再各自漂移。
# 加模块 = 新建 js/x.js + 在 layout.order 里插一行（其余自动跟上）。
# ============================================================
LAYOUTF = os.path.join(JS, 'modules.json')
# ui 分包的"两端固定成员"：story/ui 是 UI 层开头，duel3d..main 是结尾（main 是入口，必须最后）
_UI_EDGE = ('story', 'ui', 'duel3d', 'map3d', 'scene3d', 'main')


def _load_layout():
    import json
    if not os.path.exists(LAYOUTF):
        sys.exit('\\u2717 js/modules.json \\u4e0d\\u5b58\\u5728\\u3002\\u5148\\u8dd1\\uff1a'
                 'node .workbuddy/tools/map/gen_index.js')
    with open(LAYOUTF, encoding='utf-8') as f:
        d = json.load(f)
    lay = d.get('layout') or {}
    order = lay.get('order') or d.get('order') or []
    war = lay.get('war') or []
    ui_split = lay.get('uiSplit') or []
    if not order:
        sys.exit('\\u2717 js/modules.json \\u91cc\\u6ca1\\u6709 layout.order')
    ui = [n for n in order if n in _UI_EDGE or n in ui_split]
    return order, war, ui_split, ui


ORDER, WAR, UI_SPLIT, UI = _load_layout()
'''

# ---------- A. 替换 ORDER 定义（连同上面那句"与 main.js 一致"的注释） ----------
pat_order = re.compile(
    r"# 与 js/main\.js 的 import 列表逐条一致[^\n]*\nORDER = \[[\s\S]*?'main'\]\n")
assert pat_order.search(s), 'ORDER 定义没找到'
s = pat_order.sub(lambda m: NEW, s, count=1)

# ---------- B. 删掉 WAR 定义（分包归属已在 layout 里） ----------
pat_war = re.compile(r"^WAR = \[[^\n]*\]\n", re.M)
assert pat_war.search(s), 'WAR 定义没找到'
s = pat_war.sub('', s, count=1)

# ---------- C. 删掉 UI_SPLIT 与 UI 的定义 ----------
pat_ui = re.compile(
    r"# v156\.27：ui\.js 按功能域拆成 19 个文件[^\n]*\n"
    r"# 顺序 = 原来的行序[^\n]*\n"
    r"UI_SPLIT = \[[\s\S]*?\]\n"
    r"UI = \[[^\n]*\n")
if pat_ui.search(s):
    s = pat_ui.sub('', s, count=1)
    print('  已删除 UI_SPLIT / UI 定义')
else:
    print('  ⚠ UI_SPLIT 定义形态变了，未删除 —— 请人工检查')

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ build_bundle.py 改从 js/modules.json 读 ORDER/WAR/UI_SPLIT')
