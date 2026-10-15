# -*- coding: utf-8 -*-
"""v90.94：把门禁终跑数字回填档案与交付文档（并销掉两条已完成的挂账）。"""
import io
import os

ROOT = r'E:\Deepseekdb'
F_ARC = os.path.join(ROOT, '需求档案.md')
F_LED = os.path.join(ROOT, 'docs', '需求台账-v9012-13.md')
F_DOC = os.path.join(ROOT, 'docs', '_史料', '交付', 'v9094-练功移位与突破门槛.md')


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, subs):
    s = rd(p)
    n0 = len(s)
    for old, new in subs:
        c = s.count(old)
        assert c == 1, '%s 锚点计数 %d：%s' % (os.path.basename(p), c, old[:40])
        s = s.replace(old, new, 1)
    wr(p, s)
    print('[OK] %-28s %d -> %d' % (os.path.basename(p), n0, len(s)))


# ① 需求档案：v90.94 详细章节的验证行
edit(F_ARC, [(
    "**验证**：audit 全 0 · smoke 全绿 · e2e 全绿 · tables 四查全过 · dataset 全绿 · 兵种链 0 · gate --full **✓ 通过**。",
    "**验证**：audit.js 全 0 · smoke **3567/0**（v90.93 基线 3565 + §199⑤/§199⑥ 两条新守卫）·\n"
    "e2e **1094/0**（v90.93 基线 1093 + 练功真 DOM 用例 1 条）· tables 四查全过 · dataset 56/0 · 兵种链 0 ·\n"
    "gate --full **✓ 通过**（2026-10-13 实测 · 改动 27 文件）。",
)])

# ② 台账：v90.94 条目补一行封样
edit(F_LED, [(
    "  `§199④` 按先例放宽为格式锁。版本 v89.240 → **v90.94** · BUILD 9172 → **9173**。",
    "  `§199④` 按先例放宽为格式锁。版本 v89.240 → **v90.94** · BUILD 9172 → **9173**。\n"
    "- **封样**：audit 全 0 · smoke **3567/0** · e2e **1094/0** · tables 四查全过 · dataset 56/0 · 兵种链 0 ·\n"
    "  gate --full **✓ 通过**（改动 27 文件）。",
)])

# ③ 交付文档：封样数字 + 销挂账
edit(F_DOC, [
    (
        "`gate.py --full` **✓ 通过** —— audit 全 0 · smoke 全绿 · e2e 全绿 ·\n"
        "`audit_v89134_tables` 四查全过 · `audit_v89179c_dataset_refs` 全绿 · `audit_v89229b_troopchain` 兵种链错误 0。",
        "`gate.py --full` **✓ 通过**（2026-10-13 实测 · 改动 27 文件）：\n\n"
        "| 项 | 结果 |\n|---|---|\n"
        "| audit.js 死函数 / 孤儿 / 重复 / 零引用 | 全 0 |\n"
        "| smoke-test.js | **3567 通过 / 0 失败**（v90.93 基线 3565 + §199⑤ / §199⑥ 两条新守卫） |\n"
        "| e2e-test.js | **1094 通过 / 0 失败**（v90.93 基线 1093 + 练功真 DOM 用例 1 条） |\n"
        "| audit_v89134_tables | 四查全过（跨文件写 / 重复定义 / 孤儿 / 悬空） |\n"
        "| audit_v89179c_dataset_refs | **56 / 0** |\n"
        "| audit_v89229b_troopchain | 兵种链错误 **0**（14 兵种 × 依赖 / 被引） |",
    ),
    (
        "1. **口径待确认**：爵位 = **威望档**？（若非此意可整体回退）\n"
        "2. **活文档同步**：`设计规范.md` / `AI工作备忘.md` 仍写旧脚本路径 `.workbuddy/tmp/cachebust.js`（已登记为迁移待办）。\n"
        "3. **e2e 补一条**真 DOM 练功/突破用例（smoke 已覆盖，e2e 仍是零断言）。",
        "1. **口径待确认**：爵位 = **威望档**？（若非此意可整体回退）\n"
        "2. ~~活文档同步~~ → **已完成**：`设计规范.md §92.3` 命令块与 `AI工作备忘.md §100 / §102` 的脚本路径\n"
        "   已指向 `.workbuddy/tools/patch/bump_version.py`，并新增 `AI工作备忘.md §111 v90.94 版本三连治理` 条目。\n"
        "3. ~~e2e 补练功用例~~ → **已完成**：`e2e v90.94` 一条真 DOM 用例（位置自证「练功在突破考验之后」+\n"
        "   造局后真点一次、体力与净水**双严格下降**）。",
    ),
])
print('全部回填完成。')
