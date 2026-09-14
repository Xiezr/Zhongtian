# -*- coding: utf-8 -*-
"""v61 破坏测试：注入 10 类 bug，验证护栏逐条变红。"""
import io, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = os.path.join(ROOT, 'js')

CASES = [
    ('① 军营只放 1 座（老板要 2 座）', 'data.js',
     "    order: ['junying', 'junying',",
     "    order: ['junying',"),

    ('② 余格不再铺民房（留空）', 'state.js',
     "      var bid = n < restOrder.length ? restOrder[n] : P.filler;",
     "      if (n >= restOrder.length) return;\n      var bid = restOrder[n];"),

    ('③ 布局改成随等级随机（不再固定）', 'state.js',
     "    var cx = (col - 1) / 2, cy = (row - 1) / 2;",
     "    var cx = Math.random() * col, cy = Math.random() * row;"),

    ('④ 官府落位不再与玩家城同公式（改成左上角）', 'state.js',
     "    var gc = col - 2, gr = Math.max(0, Math.floor((row - 2) / 2));",
     "    var gc = 0, gr = 0;"),

    ('⑤ 格数不再随等级变（一律 8×6）', 'data.js',
     "    sizeByLevel: [[6, 4], [6, 4], [8, 4], [8, 4], [8, 4], [8, 5], [8, 5], [8, 6], [8, 6], [8, 6]],",
     "    sizeByLevel: [[8, 6], [8, 6], [8, 6], [8, 6], [8, 6], [8, 6], [8, 6], [8, 6], [8, 6], [8, 6]],"),

    ('⑥ 人口上限改吃玩家侧加成（污染派生值）', 'state.js',
     "    var per = (DATA.BUILDINGS.minfang.pop || [])[plan.level - 1] || 0;\n    var n = 0;",
     "    var per = Math.round(((DATA.BUILDINGS.minfang.pop || [])[plan.level - 1] || 0)\n      * (1 + GAME.mastery('popPct', null)));\n    var n = 0;"),

    ('⑦ 野外城池不再带布局（面板看不到城内）', 'battle.js',
     "        fort: f, garrison: fg, def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),",
     "        fort: f, garrison: fg, def: GAME.fortDefOf(f),"),

    ('⑧ 野外城池城防回到写死算式（绕过唯一出口）', 'battle.js',
     "        fort: f, garrison: fg, def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),",
     "        fort: f, garrison: fg, def: 10 + f.level * 4, plan: GAME.fortPlanOf(f),"),

    ('⑨ 攻占后 col/row 不跟着 cells 换（行列错乱）', 'battle.js',
     "    newCity.col = sh.col;                 // ⚠️ col/row 必须跟着 cells 一起换！\n    newCity.row = sh.row;",
     "    /* 注入：故意不设 col/row */"),

    ('⑩ 布局呈现不再被弹窗调用（孤儿呈现）', 'ui.js',
     "      ui.planHTML(plan) +",
     "      '' +"),

    ('⑪ 野外城池被当成名城（蹭档位加成）', 'state.js',
     "    return !!(city && city.type && city.type !== 'self' && city.type !== 'fort'\n      && DATA.CITY_PERK[city.type]);",
     "    return !!(city && city.type && city.type !== 'self' && DATA.CITY_PERK[city.type]);"),

    ('⑫ 未占据名城不再用统一布局（改回固定 8×6）', 'state.js',
     "    var plan = GAME.cityPlanOf(lv);\n    var cells = plan.cells.map(function (c) {",
     "    var plan = GAME.cityPlanOf(8);\n    var cells = plan.cells.map(function (c) {"),
]


def run_smoke():
    p = subprocess.run(['node', 'smoke-test.js'], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (p.stdout or '') + (p.stderr or '')
    fails = re.findall(r'^\s*❌ (.*)$', out, re.M)
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    return fails, (int(m.group(2)) if m else -1)


def main():
    print('== 基线 ==')
    _, base = run_smoke()
    print('   基线失败 %d 条' % base)
    if base != 0:
        print('   ⚠️ 基线不是全绿，先修完再来做破坏测试')
        return 1

    orig, red = {}, []
    for name, f, old, new in CASES:
        path = os.path.join(JS, f)
        if path not in orig:
            orig[path] = io.open(path, encoding='utf-8').read()
        src = orig[path]
        if src.count(old) != 1:
            print('%-44s ⚠️ 锚点命中 %d 次，跳过' % (name, src.count(old)))
            continue
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new))
        fails, total = run_smoke()
        io.open(path, 'w', encoding='utf-8', newline='').write(src)
        red.append((name, total, fails))
        print('%-44s 变红 %d 条' % (name, total))
        for x in fails[:3]:
            print('        · ' + x)
        if total == 0:
            print('        ⚠️⚠️ 一条都没红 —— 这批改动没有护栏守着！')

    print('\n== 汇总 ==')
    zero = [n for n, t, _ in red if t == 0]
    print('   注入 %d 类，变红 %d 条断言，零反应 %d 类' %
          (len(red), sum(t for _, t, _ in red), len(zero)))
    for n in zero:
        print('   ❗ ' + n)
    return 1 if zero else 0


if __name__ == '__main__':
    sys.exit(main())
