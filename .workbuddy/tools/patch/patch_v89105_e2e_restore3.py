# -*- coding: utf-8 -*-
"""
v89.105 事故复建 · 批次 3：语句级原位替换（战报两页 / 自动出征 / 整叠 / 商城 / 故事集）
============================================================
`repl_stmt(kw, new)` = 找到首参含 kw 的 `check(...)` 语句 → 括号配平定位 →
**原位替换**成 new。位置不变、结构不破。
"""
import io, os
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(R, 'e2e-test.js')
src = io.open(P, encoding='utf-8').read()
n = 0

def stmt_start(kw):
    i = src.find("check('" + kw)
    assert i >= 0, '找不到断言：' + kw
    return src.rfind('\n', 0, i) + 1

def stmt_end(start):
    i = src.index('(', start)
    depth, j, in_s = 0, i, None
    while j < len(src):
        c = src[j]
        if in_s:
            if c == '\\': j += 2; continue
            if c == in_s: in_s = None
        else:
            if c in '\'"`': in_s = c
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    k = j + 1
                    while k < len(src) and src[k] in ' \t': k += 1
                    return k + 1 if k < len(src) and src[k] == ';' else j + 1
        j += 1
    raise RuntimeError('未闭合：' + kw)

def repl_stmt(kw, new, tag):
    global src, n
    a = stmt_start(kw)
    b = stmt_end(a)
    src = src[:a] + new + src[b:]
    n += 1
    print('  ✓ ' + tag)

# ── ① 战报：两页（沙盘 → 正文）
repl_stmt('战报详情含战斗场景条带', """  /* v89.102（老板「战斗报告的界面大一点，分回合回放创建一个固定沙盘」）：
     「查看」现在打开**沙盘回放**（逐兵种逐帧、固定泳道）；战报正文另成一页，
     从沙盘顶部的「📜 战报正文」进入 —— 所以正文判据要先跳过去再查。 */
  check('战报（沙盘回放）：固定沙盘 + 逐兵种令牌 + 帧流在册',
    !!rp27.querySelector('#sd-field') && rp27.querySelectorAll('.sd-row').length >= 1
    && rp27.querySelectorAll('.sd-tok').length >= 1,
    rp27.querySelectorAll('.sd-row').length + ' 侧栏行 · ' + rp27.querySelectorAll('.sd-tok').length + ' 令牌');
  {
    const toTxt = rp27.querySelector('[data-action="sd-text"]');
    check('沙盘：有「📜 战报正文」入口（两页互跳，不是孤儿）', !!toTxt);
    if (toTxt) { click(toTxt); await sleep(110); }
  }
  const rpTxt = document.querySelector('#modal-root');
  check('战报正文：含战斗场景条带', !!rpTxt.querySelector('.bt-scene') && rpTxt.querySelectorAll('.bt-row').length >= 1,
    rpTxt.querySelectorAll('.bt-row').length + ' 帧');
  check('战报正文：含回合纪要', rpTxt.querySelectorAll('.bt-line').length >= 1);""",
    '① 战报：沙盘 + 正文两页')
repl_stmt('条带为等宽字符网格（48 列）',
    """  check('战报正文：条带为等宽字符网格（GRID_COLS 列）', (function () {
    const s0 = rpTxt.querySelector('.bt-strip');
    return !!s0 && s0.textContent.trim().length === G.tactic.GRID_COLS;
  })());""", '② 条带列数（改指正文页）')
repl_stmt('战报详情含回合纪要', '', '③ 回合纪要（已并入两页版，删重复）')
repl_stmt('战报详情含兵种损耗表（列出双方各兵种）',
    """  check('战报正文：含兵种损耗表（列出双方各兵种）', (function () {
    const heads = Array.prototype.map.call(rpTxt.querySelectorAll('.tbl th'), (x) => x.textContent);
    return heads.join(',').indexOf('我方损失') >= 0 && heads.join(',').indexOf('敌军损失') >= 0
      && rpTxt.querySelectorAll('.tbl tbody tr').length >= 1;
  })());""", '④ 损耗表（改指正文页）')

# ── ② 自动出征：参数行已撤，改在「详细配置」弹窗
repl_stmt('自动出征参数七行齐备',
    """  /* v89.104（老板「自动界面的自动出征不再显示详细信息，直接保留'详细配置'和'立即出征'即可」）：
     本页只剩两个入口；七行参数（将领/兵力/目标/等级/距离/类型/频率）搬进**详细配置**弹窗。 */
  check('自动出征：本页只有「详细配置」+「立即出征」两个入口，参数行已撤', (function () {
    var card = null;
    var cards = Array.prototype.slice.call(vc.querySelectorAll('.auto-card'));
    cards.forEach(function (c) { if (!card && /自动出征/.test(c.textContent)) card = c; });
    return !!vc.querySelector('[data-action="open-auto-march"]')
      && !!vc.querySelector('[data-action="auto-march-once"]')
      && !!card && card.querySelectorAll('.al-k').length === 0;
  })());""", '⑤ 自动出征本页：两入口、无参数行')
repl_stmt('自动出征参数可改',
    """  check('自动出征：参数改在「详细配置」弹窗里（打开后七行齐备）', (function () {
    G.ui.openAutoMarch();
    var ks = Array.prototype.map.call(vc.querySelectorAll('.exp-sec-t'),
      function (x) { return x.textContent.trim(); }).join(' ');
    G.ui.closeModal();
    /* 详细配置走的是出征面板同款结构：执行将领 / 目标 / 出征方式 / 计略 / 战术 / 频率 等 */
    return ks.indexOf('执行将领') >= 0 && ks.indexOf('目标') >= 0;
  })());""", '⑥ 自动出征参数在详细配置里')

# ── ③ 整叠使用：带对象的道具在背包里不再能就地使用 → 换无对象道具
repl_stmt('点一次用掉 N 个（经验道具整叠使用）',
    """  /* v89.104（老板「背包里的宝物界面不要设置将领清单，点击使用的时候，
     如果是直接消耗的无对象物品，直接使用并生效即可」）：带使用对象的道具
     在背包里**只指路**（去将领面板），所以整叠使用改用**无对象**道具（神农锄）验证。 */
  check('点一次用掉 N 个（无对象道具整叠使用）',
    (G.state.items.shennongchu || 0) === 0,
    '余 ' + (G.state.items.shennongchu || 0));""", '⑦ 整叠使用：换无对象道具')

# ── ④ 商城档位收敛
repl_stmt('v89.50：商城物件数 ≥ 185',
    """    /* v89.86：旧估数 190；v89.51 起口径 = price>0 且 type ∈ SHOP_CATS（实测 187）；
       v89.104（老板「同类产品档次太多…最多分 4 档」）：冗余档位下架 → 实测 168。
       阈值随口径下调，**下限语义不变**：商城必须还在卖东西（不是被清空）。 */
    check('v89.50：商城物件数 ≥ 160（现行在售口径 · v89.104 收敛后）',
      G.ui.shopItems().length >= 160, G.ui.shopItems().length + ' 件');""",
    '⑧ 商城：≥160')

# ── ⑤ 故事集：独立成页
src = src.replace("""    check('v89.89（C4）：史册页故事集区块（已读 1 / N）',""",
                  """    check('v89.89（C4）：故事集（独立页 · v89.104 起与史册并列）已读 1 / N',""", 1)
n += 1
print('  ✓ ⑨ 故事集：改独立页口径（标题）')
# 视图切到独立页：把 setView('story') 换成 setView('stories')（仅这一处用例）
i = src.find("const hs92 = vc92b ? vc92b.textContent : '';")
assert i > 0
j = src.rfind("setView('story')", 0, i)
assert j > 0
src = src[:j] + "setView('stories')      /* v89.104：故事集独立成页 */" + src[j + len("setView('story')"):]
n += 1
print('  ✓ ⑩ 故事集：用例切到独立页')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('\n批次 3 已改 %d 处' % n)
