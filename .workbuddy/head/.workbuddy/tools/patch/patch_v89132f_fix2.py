# -*- coding: utf-8 -*-
"""v89.132 补丁 F：§113 两条断言口径修正（smoke 实测抓出）
- domain.jieyueExpand 成功返回补 used/max（界面与测试可读，不另算）
- smoke：红点断言改查 fill 时的色（fillStyle 在 arc 之后设置）；
  校场扩编断言 used === 1（第一次扩编后的计数）
跑：python .workbuddy/tools/patch/patch_v89132f_fix2.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

# 1) domain.js：返回带 used/max
dm = rd('js/domain.js')
old_d = (
    "    GAME.log('🪓 ' + msg);\n"
    "    return { ok: true, msg: msg };\n"
    "  };\n"
)
new_d = (
    "    GAME.log('🪓 ' + msg);\n"
    "    return { ok: true, used: c[K.field], max: chk.max, msg: msg };\n"
    "  };\n"
)
dm = rep1(dm, old_d, new_d, '1 jieyueExpand 返回')
wr('js/domain.js', dm)

# 2) smoke：红点断言（fill 时取色）
sm = rd('smoke-test.js')
old_r = (
    "    check('§113② 我城红点（miniMeDot）：小档 r=size/100、底部小图大号 r≥3×', (function () {\n"
    "      var f = FAKE113();\n"
    "      G.ui.miniMeDot(f, 100, 100, 1000, false);\n"
    "      G.ui.miniMeDot(f, 100, 100, 1000, true);\n"
    "      var rs = f.rec.arcs[0][2], rb = f.rec.arcs[1][2];\n"
    "      var isRed = String(f.rec.arcs[0][3] || '').toLowerCase() === '#ff3a2a';\n"
    "      return rb > rs * 3 && isRed;\n"
    "    })());\n"
)
new_r = (
    "    check('§113② 我城红点（miniMeDot）：小档 r=size/100、底部小图大号 r≥3× · 色为朱红', (function () {\n"
    "      var f = FAKE113();\n"
    "      G.ui.miniMeDot(f, 100, 100, 1000, false);\n"
    "      G.ui.miniMeDot(f, 100, 100, 1000, true);\n"
    "      var rs = f.rec.arcs[0][2], rb = f.rec.arcs[1][2];\n"
    "      /* ⚠️ fillStyle 在 arc **之后**才设置 —— 取色要看 fill 那一刻（fills） */\n"
    "      var isRed = String(f.rec.fills[0] || '').toLowerCase() === '#ff3a2a';\n"
    "      return rb > rs * 3 && isRed;\n"
    "    })());\n"
)
sm = rep1(sm, old_r, new_r, '2 红点断言')

# 3) smoke：校场扩编 used 口径
old_u = (
    "    check('§113③ 校场扩编：真调 OK 且出征容量真涨（≥ +1 万，等效校场 +1 级）',\n"
    "      rx1_113.ok === true && rx1_113.used === 0 && (capB113 - capA113) >= 10000,\n"
)
new_u = (
    "    check('§113③ 校场扩编：真调 OK 且出征容量真涨（≥ +1 万，等效校场 +1 级）',\n"
    "      rx1_113.ok === true && rx1_113.used === 1 && rx1_113.max === 2 && (capB113 - capA113) >= 10000,\n"
)
sm = rep1(sm, old_u, new_u, '3 used 口径')
wr('smoke-test.js', sm)
print('OK')
