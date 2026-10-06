# -*- coding: utf-8 -*-
"""v89.203 批次B：爵位管理城池数（平民 9 · 每级 +1 · 封顶 30）
—— data.js（RANK.city 9..30 + 注释）· state.js（cap=本档 · msg）· systems.js（门槛=打满本档）
   ui.js（爵位面板四处）· smoke（§89 段按新口径重写 —— 行内子串锚点，无缩进依赖）"""
import io, re

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

p_data, p_st, p_sys, p_ui, p_smoke = R + 'js/data.js', R + 'js/state.js', R + 'js/systems.js', R + 'js/ui.js', R + 'smoke-test.js'

# ============================================================
# B1 · data.js：RANK.city 1..22 → 9..30（+8）· 表后注释
# ============================================================
s = rd(p_data)
if s.count('city 字段语义 = **本档可管理城池数**') >= 1:
    print('[skip] B1 RANK.city')
else:
    i0 = s.index('  DATA.RANK = [')
    i1 = s.index('  ];', i0) + len('  ];')
    blk = s[i0:i1]
    n_city = blk.count('city: ')
    assert n_city == 22, 'ranks=' + str(n_city)
    def bump(m):
        n = int(m.group(1))
        assert 1 <= n <= 22
        return 'city: ' + str(n + 8)
    nblk = re.sub(r"city: (\d+)", bump, blk)
    s = s[:i0] + nblk + s[i1:]
    anchor = "  /* v79：爵位加成曲线"
    assert s.count(anchor) == 1
    NOTE = ("  /* ⛔ v89.203（老板 4）：「列出各级爵位能管理的城池数，建议为平民 9 座，随爵位每升\n"
            "     一级增加一座」—— city 字段语义 = **本档可管理城池数**（平民 9 → 每晋一档 +1 → 封顶 30）。\n"
            "     上限出口 `cityCapOf` 读**本档值**；晋爵城池门槛 = **打满本档上限**（同名同值，天然不死锁）。\n"
            "     （v89.108 旧口径 1..22「下一档门槛」随本轮退役 —— 详见 state.js cityCapOf。） */\n")
    s = s.replace(anchor, NOTE + anchor)
    wr(p_data, s)
    print('[ok] B1 RANK.city（22 档 +8 → 9..30）')

# ============================================================
# B2 · state.js：cityCapOf 注释 + 函数体（本档值）
# ============================================================
rep('B2a cityCapOf 注释', p_st,
    "   * 老板原话：「限制城池数量，参考爵位和主城等级设置，\n"
    "   *   可建造控制的城池数量随爵位解封」。\n"
    "   * 口径：上限 = **下一档爵位的城池要求**（平民 2 座 → 每晋一档 +1 → 封顶 22 座）。\n"
    "   *   为什么不取本档值：晋升门槛要求城池数 ≥ next.city —— 若上限 = 本档值\n"
    "   *   （平民 1 座），就永远凑不齐晋「公士」所需的 2 座 → **死锁**。\n"
    "   *   取下一档 = 「爵位允许你把地盘扩到够格觐爵的规模」：打满上限的那一刻，\n"
    "   *   正好是该求晋爵的时候 —— 门槛与上限天然合一，不另立第二张表\n"
    "   *   （同 v89.102 主城解锁的写法：也读 DATA.RANK，也是\"每档 +1\"）。",
    "   * 老板原话（v89.108）：「限制城池数量，参考爵位和主城等级设置，\n"
    "   *   可建造控制的城池数量随爵位解封」。\n"
    "   * ⛔ v89.203（老板 4）口径变更：「各级爵位能管理的城池数 —— 平民 9 座，随爵位每升\n"
    "   *   一级增加一座」。上限 = **本档值**（RANK[i].city，9..30）；\n"
    "   *   晋爵城池门槛 = **打满本档上限**（同名同值 —— 打满的那一刻正是该求晋爵的时候，\n"
    "   *   门槛与上限天然合一，不另立第二张表）。\n"
    "   *   （v89.108 取\"下一档\"是为避开\"本档值=平民1座\"的死锁；本档值上调至 9 起后\n"
    "   *    门槛同步改为\"打满本档\"，死锁不复存在 —— 两处一起读 DATA.RANK，仍是一张表。）",
    "v89.203（老板 4）口径变更：「各级爵位能管理的城池数")

rep('B2b cityCapOf 函数体', p_st,
    "    var i = Math.max(0, Math.min(s.rank | 0, DATA.RANK.length - 1));\n"
    "    var nx = DATA.RANK[i + 1];\n"
    "    return nx ? nx.city : DATA.RANK[i].city;\n"
    "  };",
    "    var i = Math.max(0, Math.min(s.rank | 0, DATA.RANK.length - 1));\n"
    "    return DATA.RANK[i].city;   /* v89.203：本档管理数（平民 9 → 每档 +1 → 封顶 30） */\n"
    "  };",
    "v89.203：本档管理数（平民 9")

rep('B2c cityCapChk msg', p_st,
    "    } else if (nx) {\n"
    "      var nn = DATA.RANK[i + 2];\n"
    "      msg = '领地上限 ' + cap + ' 座（' + cur.name + '）—— 晋爵「' + nx.name +\n"
    "        '」可扩至 ' + (nn ? nn.city : cap) + ' 座';",
    "    } else if (nx) {\n"
    "      /* v89.203：晋爵后的新上限 = 下一档的本档值（nx.city） */\n"
    "      msg = '领地上限 ' + cap + ' 座（' + cur.name + '）—— 晋爵「' + nx.name +\n"
    "        '」可扩至 ' + nx.city + ' 座';",
    "晋爵后的新上限 = 下一档的本档值")

# ============================================================
# B3 · systems.js：canPromote 门槛 = 打满本档
# ============================================================
rep('B3 canPromote', p_sys,
    "    if (s.rep < next.rep) return { ok: false, msg: '声望不足（需 ' + U.fmt(next.rep) + '）' };\n"
    "    if (s.cities.length < next.city) return { ok: false, msg: '需要 ' + next.city + ' 座城池' };",
    "    if (s.rep < next.rep) return { ok: false, msg: '声望不足（需 ' + U.fmt(next.rep) + '）' };\n"
    "    /* v89.203（老板 4）：城池门槛 = **打满本档领地上限**（= 本档管理数；与 cap 同值）。 */\n"
    "    var _cur203 = DATA.RANK[s.rank] || DATA.RANK[0];\n"
    "    if (s.cities.length < _cur203.city) {\n"
    "      return { ok: false, msg: '需要 ' + _cur203.city + ' 座城池（打满本档领地上限）' };\n"
    "    }",
    "城池门槛 = **打满本档领地上限**")

# ============================================================
# B4 · ui.js：爵位面板四处
# ============================================================
rep('B4a condTitle', p_ui,
    "+ '　城池 ' + s.cities.length + '/' + next.city",
    "+ '　城池 ' + s.cities.length + '/' + cur.city      /* v89.203：门槛=本档上限 */",
    "城池 ' + s.cities.length + '/' + cur.city")

rep('B4b 城池行', p_ui,
    "'<div class=\"res-line\"><span class=\"lbl\">城池（领地上限）</span><span class=\"val\" style=\"color:' + (s.cities.length >= next.city ? 'var(--green-ok)' : 'inherit') + ';\">' + s.cities.length + '/' + next.city + '</span></div>' +",
    "'<div class=\"res-line\"><span class=\"lbl\">城池（领地上限）</span><span class=\"val\" style=\"color:' + (s.cities.length >= cur.city ? 'var(--green-ok)' : 'inherit') + ';\">' + s.cities.length + '/' + cur.city + '</span></div>' +",
    "s.cities.length >= cur.city ? 'var(--green-ok)'")

rep('B4c 表头', p_ui,
    "<th>爵位</th><th>城池</th><th>声望</th>",
    "<th>爵位</th><th>管理城池</th><th>声望</th>",
    "<th>爵位</th><th>管理城池</th>")

rep('B4d note 文案', p_ui,
    "'<b>领地上限随爵位解封</b>：打满上限（= 下一档的城池要求）即达晋爵门槛 —— 平民 2 座起，每晋一档 +1，封顶 22 座。</div>' +",
    "'<b>领地上限随爵位解封</b>：管理城池数 = 平民 9 座，每晋一档 +1（封顶 30 座）—— 打满本档上限即达晋爵门槛。</div>' +",
    "管理城池数 = 平民 9 座，每晋一档 +1")

# ============================================================
# B5 · smoke §89 段：行内子串锚点（无缩进依赖 · 全部计数断言）
# ============================================================
s = rd(p_smoke)
if s.count('v89.203：逐档核验「上限 = 本档管理数') >= 1:
    print('[skip] B5 smoke §89 段')
else:
    def sub1(tag, old, new, cnt=1):
        global s
        c = s.count(old)
        assert c == cnt, tag + ' count=' + str(c)
        s = s.replace(old, new)
        print('[ok] ' + tag)

    # 段头注释
    sub1('B5a 段头①', '· 上限 = **下一档的城池要求**（平民 2 → 每晋一档 +1 → 封顶 22）。',
         '· ⛔ v89.203（老板 4）口径变更：上限 = **本档管理数**（RANK[i].city，9..30 · 平民 9 起）；\n   *     晋爵城池门槛 = **打满本档上限**（同值）—— 旧口径"下一档门槛（平民 2 座起）"随本轮退役。')
    sub1('B5a 段头②', '是因为晋升门槛要求城池 ≥ next.city —— 取本档会**死锁**；',
         '是因为旧口径下"门槛=下一档"（本档值曾为平民 1 座，取本档会死锁）；\n   *     本档值上调至 9 起后，门槛同步改为"打满本档"，死锁不复存在；')
    sub1('B5a 段头③', '这条下界性质逐档核验；',
         '这条性质逐档核验（门槛=上限，天然合一）；')

    # log 段名
    sub1('B5b log', '89. v89.108 领地上限（随爵位解封）', '89. v89.108/v203 领地上限（随爵位解封 · 平民 9 起）')

    # ① 口径
    sub1('B5c ①标题', 'v89.108：逐档核验「上限 = 下一档门槛」（≥ 门槛，不死锁）',
         'v89.203：逐档核验「上限 = 本档管理数（平民 9 · 每级 +1 · 封顶 30）」')
    sub1('B5c ①注释', '/* ---- ① 口径：逐档 = 下一档门槛（≥ 门槛，不死锁），且封顶 22 ---- */',
         '/* ---- ① 口径（v89.203）：逐档 = 本档管理数（9..30），门槛=打满本档 ---- */')
    sub1('B5c ①want', 'var want = DATA.RANK[i + 1] ? DATA.RANK[i + 1].city : DATA.RANK[i].city;',
         'var want = DATA.RANK[i].city;      /* v89.203：本档管理数 */')
    sub1('B5c ①need', 'var need = DATA.RANK[i + 1] ? DATA.RANK[i + 1].city : 0;',
         'var need = DATA.RANK[i].city;')
    sub1('B5c ①need注释', '/* 晋升门槛 */', '/* v89.203：门槛=打满本档（与 cap 同值） */')
    sub1('B5c ①判据', "if (cap !== want || cap < need) bad.push(i + ':' + cap + '/' + want);",
         "if (cap !== want || want !== 9 + i) bad.push(i + ':' + cap + '/' + want);")
    sub1('B5c ①封顶', "if (G.cityCapOf() !== 22) bad.push('封顶=' + G.cityCapOf());",
         "if (G.cityCapOf() !== 30) bad.push('封顶=' + G.cityCapOf());")

    # ②③⑥ 摆城数（行内子串 · 按序计数）
    sub1('B5d <2→9', 'while (st89.cities.length < 2) {', 'while (st89.cities.length < 9) {', 3)
    sub1('B5d >2→9', 'while (st89.cities.length > 2) st89.cities.pop();', 'while (st89.cities.length > 9) st89.cities.pop();', 2)
    sub1('B5d 平民注释', '/* 平民：cap = 2 */', '/* 平民：cap = 9（v89.203） */')
    sub1('B5e 公士注释', '/* 晋「公士」：cap = 3 */', '/* 晋「公士」：cap = 10 */')
    sub1('B5e 用例文案', "'平民 2 座：拦 · 晋公士：放行'", "'平民 9 座：拦 · 晋公士：放行'")
    sub1('B5g 簪袅注释', '/* 簪袅：cap = 5 */', '/* 簪袅：cap = 12（v89.203） */')

    # ④ 老档超编
    sub1('B5h <5→10', 'while (st89.cities.length < 5) {', 'while (st89.cities.length < 10) {')
    sub1('B5h n0', "cc.ok === false && /超编/.test(cc.msg || '') && n0 === 5", "cc.ok === false && /超编/.test(cc.msg || '') && n0 === 10")
    sub1('B5h ret', '&& st89.cities.length === 5 && r1.ok === false;', '&& st89.cities.length === 10 && r1.ok === false;')
    sub1('B5h 文案', "'5 座 > 上限 2：城还在、增不了'", "'10 座 > 上限 9：城还在、增不了'")

    wr(p_smoke, s)
    print('[ok] B5 smoke §89 段（%d 处子串替换）' % 16)

print('批次B 完成')
