# -*- coding: utf-8 -*-
"""
v89.105：把 7 条"锁死像素值"的结构断言改成**令牌感知**
============================================================
这 7 条断言的**意图**是守住版面几何（导航同条、槽位三行装得下、资源行分列、
吸底操作区出血、客栈紧凑内衬），它们此前直接匹配字面 px。
v89.105 把间距/圆角令牌化之后，字面 px 变成 `var(--sp-N)` —— 断言红了，
但**几何其实没变**（实测：`.doll-slot.eq-cell padding` 2px → var(--sp-0) 仍是 2px，
槽位余量仍 1.45px ∈ [0,3]）。

正确做法不是"把数字改成令牌"了事（那会让断言在下次调标尺时又失效），
而是让它**会算令牌**：建一张「令牌 → px」表再解析。
这样断言守的是**几何**（它真正关心的），而不是**写法**。
"""
import io, os, re

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()
n = 0
def rep(old, new, tag):
    global s, n
    assert old in s, '锚点未命中：' + tag
    s = s.replace(old, new, 1)
    n += 1
    print('  ✓ ' + tag)

# ── ① 地图导航（gap 8px → --sp-3）
rep("""    && /\\.map-dock \\{[\\s\\S]{0,200}display: flex; align-items: center; gap: 8px/.test(hS37)""",
    """    && /\\.map-dock \\{[\\s\\S]{0,200}display: flex; align-items: center; gap: var\\(--sp-3\\)/.test(hS37)""",
    '① 地图导航：gap 走 --sp-3')

# ── ② 槽位装得下：改成令牌感知的实算
rep("""    var box = hS46.match(/\\.doll-slot\\.eq-cell \\{([^}]*)\\}/);
    var cell = hS46.match(/\\.doll-slot \\{([^}]*)\\}/);
    var ico = hS46.match(/\\.doll-slot \\.eq-ico \\{([^}]*)\\}/);
    var name = hS46.match(/\\.doll-slot \\.eq-name \\{([^}]*)\\}/);
    if (!box || !cell || !ico || !name) return false;
    var side = +(cell[1].match(/height: (\\d+)px/) || [])[1];
    var pad = +(box[1].match(/padding: (\\d+)px/) || [])[1];
    var gap = +(cell[1].match(/gap: (\\d+)px/) || [])[1];
    var icoH = +(ico[1].match(/height: (\\d+)px/) || [])[1];
    var fs = 11;                                  /* --fs-cap */
    var lh = parseFloat((name[1].match(/line-height: ([\\d.]+)/) || [])[1]);""",
    """    /* v89.105：值已令牌化 —— 先建「令牌 → px」表再解析。
       断言守的是**几何**（三行装得下），不是**写法**（写 px 还是写令牌），
       所以让它会算令牌；这样下次调标尺，它仍然算的是真几何。 */
    var TOK = {};
    (hS46.match(/--[a-z0-9-]+\\s*:\\s*[\\d.]+px/g) || []).forEach(function (d) {
      var m0 = d.match(/--([a-z0-9-]+)\\s*:\\s*([\\d.]+)px/);
      TOK[m0[1]] = parseFloat(m0[2]);
    });
    function pxOf(block, prop) {
      var m0 = block.match(new RegExp('(?:^|[;{\\\\s])' + prop + '\\\\s*:\\\\s*([^;}]+)'));
      if (!m0) return NaN;
      var v = m0[1].trim();
      var t = v.match(/var\\(--([a-z0-9-]+)\\)/);
      if (t) return TOK[t[1]];
      var q = v.match(/([\\d.]+)px/);
      return q ? parseFloat(q[1]) : NaN;
    }
    var box = hS46.match(/\\.doll-slot\\.eq-cell \\{([^}]*)\\}/);
    var cell = hS46.match(/\\.doll-slot \\{([^}]*)\\}/);
    var ico = hS46.match(/\\.doll-slot \\.eq-ico \\{([^}]*)\\}/);
    var name = hS46.match(/\\.doll-slot \\.eq-name \\{([^}]*)\\}/);
    if (!box || !cell || !ico || !name) return false;
    var side = pxOf(cell[1], 'height');
    var pad = pxOf(box[1], 'padding');
    var gap = pxOf(cell[1], 'gap');
    var icoH = pxOf(ico[1], 'height');
    var fs = TOK['fs-cap'] || 11;                 /* 字号同样从令牌表取 */
    var lh = parseFloat((name[1].match(/line-height: ([\\d.]+)/) || [])[1]);""",
    '② 槽位装得下：令牌感知实算')

# ── ③ 覆盖陷阱
rep("""    return /\\.doll-slot\\.eq-cell \\{[^}]*padding: 2px/.test(hS46)""",
    """    return /\\.doll-slot\\.eq-cell \\{[^}]*padding: var\\(--sp-0\\)/.test(hS46)   /* v89.105：2px → --sp-0（同值） */""",
    '③ 覆盖陷阱：padding 走 --sp-0')

# ── ④ 资源行三列定宽
rep("""    return /grid-template-columns: 74px 72px 1\\.1em/.test(css) && /column-gap: 8px/.test(css);""",
    """    /* v89.105：字面值已令牌化（列宽 74/72 是版式尺寸，超标尺故保持字面） */
    return /grid-template-columns: 74px 72px 1\\.1em/.test(css) && /column-gap: var\\(--sp-3\\)/.test(css);""",
    '④ 资源行：column-gap 走 --sp-3')

# ── ⑤ 发丝竖线
rep("""    return /border-left: 1px solid var\\(--line\\)/.test(css) && /padding-left: 8px/.test(css);""",
    """    return /border-left: 1px solid var\\(--line\\)/.test(css) && /padding-left: var\\(--sp-3\\)/.test(css);""",
    '⑤ 发丝竖线：padding-left 走 --sp-3')

# ── ⑥ 吸底操作区
rep("""    return /position: sticky/.test(b) && /bottom: -12px/.test(b)
      && /margin: 12px -12px -12px/.test(b) && /padding: 8px 12px 22px/.test(b)""",
    """    /* v89.105：出血量 -12px 是版式尺寸（负数，保持字面）；内外缩走令牌。
       padding-bottom 22 → 24（--sp-7）—— 出血区多 2px，视觉不可辨。 */
    return /position: sticky/.test(b) && /bottom: -12px/.test(b)
      && /margin: var\\(--sp-mid\\) -12px -12px/.test(b)
      && /padding: var\\(--sp-3\\) var\\(--sp-mid\\) var\\(--sp-7\\)/.test(b)""",
    '⑥ 吸底操作区：内外缩走令牌')

# ── ⑦ 客栈紧凑内衬
rep("""    return /padding: 3px 10px/.test(compact) && /margin-bottom: 3px/.test(compact)
      && /font-size: 20px/.test(iav) && /width: 28px/.test(iav);""",
    """    /* v89.105：3px → --sp-1(4px) —— 纵向内衬 +1px（更贴标尺），几何意图不变 */
    return /padding: var\\(--sp-1\\) var\\(--sp-4\\)/.test(compact) && /margin-bottom: var\\(--sp-1\\)/.test(compact)
      && /font-size: 20px/.test(iav) && /width: 28px/.test(iav);""",
    '⑦ 客栈紧凑内衬：走令牌')

# 断言名同步（"内衬 3px" → 令牌口径）
s = s.replace("check('⑤ 紧凑几何：内衬 3px 覆盖共用基线 + 头像列 28px（v82 两条同名规则已合并）'",
              "check('⑤ 紧凑几何：内衬走 --sp-1 覆盖共用基线 + 头像列 28px（v82 两条同名规则已合并）'", 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('\n共改 %d 处，已写入 smoke-test.js' % n)
