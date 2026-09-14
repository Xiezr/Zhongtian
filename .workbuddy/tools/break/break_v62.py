# -*- coding: utf-8 -*-
"""v62 破坏测试：注入 9 类 bug，验证护栏逐条变红。"""
import io, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = os.path.join(ROOT, 'js')

CASES = [
    ('① 作坊上限不生效（想造多少造多少）', 'domain.js',
     "    return lv * TW_T().buildMaxPerLv;",
     "    return 9999;"),

    ('② 造箭塔不加守备力（造了没用）', 'domain.js',
     "    return GAME.cityDefenseBase(city) + GAME.towersBuiltOf(city) * TW_T().homeDef;",
     "    return GAME.cityDefenseBase(city);"),

    ('③ 总座数漏掉自建那部分', 'domain.js',
     "    return GAME.towersFromDef(city) + GAME.towersBuiltOf(city);",
     "    return GAME.towersFromDef(city);"),

    ('④ 城防把箭塔也折进去（滚雪球循环）', 'domain.js',
     "    return GAME.cityDefenseBase(city) + GAME.towersBuiltOf(city) * TW_T().homeDef;",
     "    return GAME.cityDefenseBase(city) + GAME.towerCountOf(city) * TW_T().homeDef;"),

    ('⑤ 超上限不拦（天花板形同虚设）', 'domain.js',
     "    var room = GAME.towerRoomOf(city);\n    if (room <= 0) {",
     "    var room = 9999;\n    if (false) {"),

    ('⑥ 资源不足直接报错、不自动下调', 'domain.js',
     "    if (affordable <= 0) {",
     "    if (true) {"),

    ('⑦ 扣当前城的资源（跨城扣错）', 'domain.js',
     "    var R = GAME.res(city);\n    var unit = TW_T().buildCost;",
     "    var R = GAME.res();\n    var unit = TW_T().buildCost;"),

    ('⑧ 战斗侧不再传自建箭塔（回到只按城防折）', 'battle.js',
     "        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null });",
     "        towers: null });"),

    ('⑨ 引擎忽略 opts.towers（只认城防折出）', 'tactic.js',
     "    var towerStart = T.towerCountOfArg(defVal, opts.towers);",
     "    var towerStart = T.wallTowerCount(defVal);"),

    ('⑩ 作坊入口藏起来（孤儿功能）', 'ui.js',
     "    gongjiangzuofang: { label: \"🛠️ 器械与工事\", act: \"open-workshop\", withIdx: true },",
     "    gongjiangzuofang: { label: \"🛠️ 器械与工事\", act: \"open-siege\" },"),
]


def run_smoke():
    p = subprocess.run(['node', 'smoke-test.js'], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (p.stdout or '') + (p.stderr or '')
    fails = re.findall(r'^\s*❌ (.*)$', out, re.M)
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    return fails, (int(m.group(2)) if m else -1), out


def main():
    print('== 基线 ==')
    _, base, _ = run_smoke()
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
            print('%-42s ⚠️ 锚点命中 %d 次，跳过' % (name, src.count(old)))
            continue
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new))
        fails, total, out = run_smoke()
        io.open(path, 'w', encoding='utf-8', newline='').write(src)
        red.append((name, total, fails))
        extra = ''
        if total < 0:
            extra = '  ← 测试崩溃（不是"断言守不住"，先查注入能不能跑）'
        print('%-42s 变红 %d 条%s' % (name, total, extra))
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
