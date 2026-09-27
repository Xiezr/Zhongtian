# -*- coding: utf-8 -*-
"""v89.132 补丁 E：补丁 D 漏掉的三处（smoke 实测抓出）
- §98 节钺：G.jieyueExpandCity（已删）→ G.jieyueExpand('city', …) —— 4 处调用
- §31 四段断言：'⑤ 两营' 的源码注释命中 → 判据改查完整标题串 + compact 调用串
- 缩略图两条字体断言：'bold NNpx' → 'normal NNpx'（v89.132 去 bold）
跑：python .workbuddy/tools/patch/patch_v89132e_fix.py
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

sm = rd('smoke-test.js')

# 1) §98 节钺扩编调用点（4 处）
old98 = (
    "      var r1 = G.jieyueExpandCity(c95.id);\n"
    "      var b1 = G.buildSlots(c95);\n"
    "      G.jieyueExpandCity(c95.id);\n"
    "      var b2 = G.buildSlots(c95);\n"
    "      var r3 = G.jieyueExpandCity(c95.id);        /* 第 3 次应被上限拦下 */\n"
)
new98 = (
    "      /* v89.132：扩编族收成唯一出口 jieyueExpand(kind, cityId) —— 旧名 jieyueExpandCity 退役 */\n"
    "      var r1 = G.jieyueExpand('city', c95.id);\n"
    "      var b1 = G.buildSlots(c95);\n"
    "      G.jieyueExpand('city', c95.id);\n"
    "      var b2 = G.buildSlots(c95);\n"
    "      var r3 = G.jieyueExpand('city', c95.id);    /* 第 3 次应被上限拦下 */\n"
)
sm = rep1(sm, old98, new98, '1 §98 调用点')

# 2) 四段断言判据（避开源码注释里的 '⑤ 两营'）
old31 = (
    "    && /④ 行军/.test(uS31) && uS31.indexOf('⑤ 两营') < 0\n"
    "    && /camp-cards/.test(uS31));\n"
)
new31 = (
    "    && /④ 行军/.test(uS31) && uS31.indexOf('⑤ 两营（伤兵 · 俘虏）') < 0\n"
    "    && uS31.indexOf(\"campCard('wounded', { compact: true })\") < 0\n"
    "    && /camp-cards/.test(uS31));\n"
)
sm = rep1(sm, old31, new31, '2 四段判据')

# 3) 字体断言一（16340 段）
old_f1 = (
    "    return tier && a.ctx.font === 'bold 20px sans-serif' && b.ctx.font === 'bold 18px sans-serif'\n"
)
new_f1 = (
    "    /* v89.132（老板「笔画太厚」）：bold → normal（字号分级不变） —— 判据钉住 normal */\n"
    "    return tier && a.ctx.font === 'normal 20px sans-serif' && b.ctx.font === 'normal 18px sans-serif'\n"
)
sm = rep1(sm, old_f1, new_f1, '3 字体断言一')

# 4) 字体断言二（16350 段）
old_f2 = (
    "    return keys.length === 3\n"
    "      && keys[0] === 'bold 20px sans-serif' && keys[1] === 'bold 23px sans-serif'\n"
    "      && keys[2] === 'bold 27px sans-serif'\n"
    "      && fonts['bold 27px sans-serif'] === 1;          /* 都城只有一座（洛阳） */\n"
)
new_f2 = (
    "    return keys.length === 3\n"
    "      && keys[0] === 'normal 20px sans-serif' && keys[1] === 'normal 23px sans-serif'\n"
    "      && keys[2] === 'normal 27px sans-serif'            /* v89.132：去 bold（同一档字号） */\n"
    "      && fonts['normal 27px sans-serif'] === 1;          /* 都城只有一座（洛阳） */\n"
)
sm = rep1(sm, old_f2, new_f2, '4 字体断言二')

assert sm.count('G.jieyueExpandCity(') == 0, 'jieyueExpandCity 调用残留'
wr('smoke-test.js', sm)
print('OK · smoke-test.js', len(sm))
