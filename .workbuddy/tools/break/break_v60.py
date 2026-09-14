# -*- coding: utf-8 -*-
"""v60 破坏测试：往生产代码注入 15 类 bug，验证新护栏**逐条变红**。
用法：python .workbuddy/tmp/break_v60.py
"""
import io, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = os.path.join(ROOT, 'js')

# 每项：(名字, 文件, 原文, 替换)
CASES = [
    ('① s.res 不再跟随当前城（改回固定首城）', 'state.js',
     "    var c = city || GAME.currentCity();\n    if (!c) return GAME._orphanRes || (GAME._orphanRes = GAME.emptyRes());",
     "    var c = city || (GAME.state && GAME.state.cities[0]);\n    if (!c) return GAME._orphanRes || (GAME._orphanRes = GAME.emptyRes());"),

    ('② 结算改回"全境一份"（逐城逻辑废除）', 'state.js',
     "    s.cities.forEach(function (ct) {\n      var p = GAME.cityProdPerSec(ct);\n      var cap = GAME.storeCapOf(ct);",
     "    s.cities.slice(0, 1).forEach(function (ct) {\n      var p = GAME.productionPerSec();\n      var cap = GAME.storeCapOf(ct);"),

    ('③ 运输不抽损耗（白送资源）', 'domain.js',
     "    var loss = GAME.transportLossOf(from, to);\n    var R2 = GAME.res(to);",
     "    var loss = 0;\n    var R2 = GAME.res(to);"),

    ('④ 运输无视仓容（静默丢弃）', 'domain.js',
     "    var ship = qty;\n    if (room !== Infinity) {",
     "    var ship = qty;\n    if (false) {"),

    ('⑤ 守将可被直接派遣（加成挂错城）', 'domain.js',
     "    if (g.status === 'guard') {\n      var fc = GAME.cityById(g.cityId);\n      return { ok: false, msg: '需先解除 ' + g.name + ' 在' + (fc ? fc.name : '原城') + '的守将职务' };\n    }",
     "    if (false) { }"),

    ('⑥ NPC 库存改随机（同城两次不一样）', 'state.js',
     "    var rng = U.rng(GAME.npcHash(city.id, 0x51ed) + lv);\n    var out = GAME.emptyRes();",
     "    var rng = Math.random;\n    var out = GAME.emptyRes();"),

    ('⑦ NPC 建筑留空（不再"默认全满"）', 'state.js',
     "    slots.forEach(function (idx, n) {\n      var bid = n < can.length ? can[n] : can[n % can.length];\n      cells[idx].build = { id: bid, lvl: lv };\n    });",
     "    slots.forEach(function (idx, n) {\n      if (n % 2) return;\n      var bid = n < can.length ? can[n] : can[n % can.length];\n      cells[idx].build = { id: bid, lvl: lv };\n    });"),

    ('⑧ 攻占后清空建筑（回到"空城"）', 'battle.js',
     "    newCity.cells = sh.cells.map(function (c) {",
     "    sh.cells.forEach(function (c) { if (!c.official) c.build = null; });\n    newCity.cells = sh.cells.map(function (c) {"),

    ('⑨ 名城产量优势不生效（perk 成死属性）', 'state.js',
     "    var perkProd = 1 + GAME.perkNum(city, 'prodPct');",
     "    var perkProd = 1;"),

    ('⑩ 装备栏加回「带装总数」行', 'ui.js',
     "          '<div class=\"eq-gain\">装备提供</div>' +",
     "          '<div class=\"eq-sum\">统<b>x</b></div>' +\n          '<div class=\"eq-gain\">装备提供</div>' +"),

    ('⑪ 全境汇总加回「丙 · 满级专精」', 'ui.js',
     "      ui.lgSec('乙 · 在外') +",
     "      ui.lgSec('丙 · 满级专精') + ui.lgRow('x', 'y') +\n      ui.lgSec('乙 · 在外') +"),

    ('⑫ 出征目标不带守将（NPC 守将白设）', 'battle.js',
     "        npc: npc, garrison: npc.garrison, def: npc.def, guard: ng,",
     "        npc: npc, garrison: npc.garrison, def: npc.def,"),

    ('⑬ 存档写入顶层 res（破坏"不入存档"）', 'state.js',
     "        enumerable: false,\n        configurable: true,",
     "        enumerable: true,\n        configurable: true,"),

    ('⑭ 全境人口改回直读当前城', 'state.js',
     "    return (s.cities || []).reduce(function (a, c) { return a + (GAME.res(c).pop || 0); }, 0);",
     "    return (GAME.res(s.cities[0]).pop || 0);"),

    ('⑮ 防御动作改成"本回合不攻击"', 'tactic.js',
     "        var stance = u.stance || 'advance';\n        if (stance === 'advance' && free > 0 && !onWall) {",
     "        var stance = u.stance || 'advance';\n        if (stance === 'hold') return;\n        if (stance === 'advance' && free > 0 && !onWall) {"),

    ('⑯ 掠夺量不再来自该城库存（回到凭空生成）', 'state.js',
     "    var base = GAME.npcCityRes(city);\n    var out = {};\n    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {\n      var v = Math.round((base[k] || 0) * pct);",
     "    var base = { grain: 12345, wood: 12345, stone: 12345, iron: 12345, gold: 12345 };\n    var out = {};\n    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {\n      var v = Math.round((base[k] || 0) * pct);"),
]


def run_smoke():
    p = subprocess.run(['node', 'smoke-test.js'], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (p.stdout or '') + (p.stderr or '')
    fails = re.findall(r'^\s*❌ (.*)$', out, re.M)
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    total = int(m.group(2)) if m else -1
    return fails, total, out


def main():
    print('== 基线 ==')
    base_fails, base_total, _ = run_smoke()
    print('   基线失败 %d 条' % base_total)
    if base_total != 0:
        print('   ⚠️ 基线不是全绿，先修完再来做破坏测试')
        return 1

    orig = {}
    red = []
    for name, f, old, new in CASES:
        path = os.path.join(JS, f)
        if path not in orig:
            orig[path] = io.open(path, encoding='utf-8').read()
        src = orig[path]
        # 版本 2 的用例可能依赖前一次的注入，这里一律从**原始内容**出发
        if src.count(old) != 1:
            print('%-46s ⚠️ 锚点命中 %d 次，跳过' % (name, src.count(old)))
            continue
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new))
        fails, total, _ = run_smoke()
        io.open(path, 'w', encoding='utf-8', newline='').write(src)   # 立刻还原
        red.append((name, total, fails))
        print('%-46s 变红 %d 条' % (name, total))
        for x in fails[:4]:
            print('        · ' + x)
        if total == 0:
            print('        ⚠️⚠️ 一条都没红 —— 这批改动没有护栏守着！')

    print('\n== 汇总 ==')
    zero = [n for n, t, _ in red if t == 0]
    print('   注入 %d 类，变红 %d 条断言，零反应 %d 类' %
          (len(red), sum(t for _, t, _ in red), len(zero)))
    if zero:
        for n in zero:
            print('   ❗ ' + n)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
