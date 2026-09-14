# -*- coding: utf-8 -*-
"""v63 破坏测试：逐条注入 bug，确认新护栏**真的会红**（而不是恒真装饰）。

判据：注入后 smoke（必要时含 e2e）的失败数必须上升；「变红 0 条」= 该断言守不住。
⚠️ 运行「变红 -N 条」要当"注入本身崩了"查（v61 的教训）。
"""
import io, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
ENV = dict(os.environ)
ENV['NODE_PATH'] = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=ENV, shell=True)
    out = (p.stdout or '') + (p.stderr or '')
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    if not m:
        return None, out
    return (int(m.group(1)), int(m.group(2))), out

def rd(p):
    return io.open(p, encoding='utf-8').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

BASE_SMOKE = run(NODE + ' smoke-test.js')[0]
BASE_E2E = run(NODE + ' e2e-test.js')[0]
print('基线：smoke %s / e2e %s\n' % (BASE_SMOKE, BASE_E2E))

CASES = [
    ('① 格数档位改回旧版（5 级仍 32 格）', 'js/data.js',
     "sizeByLevel: [[6, 4], [6, 4], [8, 4], [8, 4], [8, 5], [8, 5], [8, 6], [8, 6], [8, 6], [8, 6]],",
     "sizeByLevel: [[6, 4], [6, 4], [8, 4], [8, 4], [8, 4], [8, 5], [8, 6], [8, 6], [8, 6], [8, 6]],",
     'smoke'),
    ('② 名城建筑等级退回"与城同级"', 'js/state.js',
     "    return Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, lv + GAME.cityBuildBonus(city)));",
     "    return lv;",
     'smoke'),
    ('③ 名城兵力倍数 10 → 1', 'js/data.js',
     "    garrisonMul: 10,", "    garrisonMul: 1,",
     'smoke'),
    ('④ NPC 守军也吃粮（把 map.cities 并入耗粮口径 + 读 garrison）', 'js/state.js',
     "    var list = city ? [city] : s.cities;",
     "    var list = city ? [city] : s.cities.concat((s.map && s.map.cities) || []);",
     'smoke'),
    ('④b NPC 守军也吃粮（只改兵源，不改城列表）', 'js/state.js',
     "      for (var id in (ct.army || {})) {",
     "      for (var id in Object.assign({}, ct.army || {}, ct.garrison || {})) {",
     'smoke'),
    ('⑤ 去掉每日掠夺拦截', 'js/battle.js',
     """    if (!opts.arrived && mode.id === 'raid' && t.kind === 'fort'
        && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.x, t.y)) {
      return { ok: false, msg: '此据点今日已被掠夺（每日每处限一次），明日再来' };
    }""",
     "    /* 注入：拦截被删 */",
     'smoke'),
    ('⑥ 掠夺失败也计数（mark 提到 win 之前）', 'js/battle.js',
     "    if (win) {\n      /* v63（老板）：「野外城每天只能被掠夺一次」",
     "    if (t.kind === 'fort' && mode.id === 'raid' && GAME.map.markFortRaided) GAME.map.markFortRaided(t.x, t.y);\n    if (win) {\n      /* v63（老板）：「野外城每天只能被掠夺一次」",
     'smoke'),
    ('⑦ 掠夺记录不按日失效（永久锁死）', 'js/map.js',
     "    return (s.fortRaids || {})[x + ',' + y] === day;",
     "    return (s.fortRaids || {})[x + ',' + y] != null;",
     'smoke'),
    ('⑧ 产量守将加成改回全境求和', 'js/state.js',
     "    var gbProd = GAME.guardBonus ? GAME.guardBonus(city) : { prod: 0 };",
     "    var gbProd = (function () { var o = { prod: 0 }; ((GAME.state || {}).cities || []).forEach(function (c) { o.prod += GAME.guardBonus(c).prod; }); return o; })();",
     'smoke'),
    ('⑨ 建造加速忽略城池、取全境守将', 'js/domain.js',
     "    var gb = GAME.guardBonus(city);",
     "    var gb = (function () { var o = { build: 0 }; ((GAME.state || {}).cities || []).forEach(function (c) { o.build += GAME.guardBonus(c).build; }); return o; })();",
     'smoke'),
    ('⑩ 空地建造图标退回 emoji', 'js/ui.js',
     "        var ic = GAME.icons.forBuilding(bid) || b.icon;",
     "        var ic = b.icon;",
     'e2e'),
    ('⑫ 据点一览取消分页（靠弹窗滚动条）', 'js/ui.js',
     "      var pgF = ui.modalPage('forts', rowList, 6, function () { ui.openForts(); });",
     "      var pgF = { slice: rowList, pager: '', page: 1, maxPage: 1 };",
     'smoke'),
    ('⑬ 建造选择弹窗退回 lg（正文会超 18px）', 'js/ui.js',
     "        size: 'xl',\n        body: '<div class=\"troop-grid\" style=\"grid-template-columns:repeat(3,1fr);\">' + pgB.slice.join('') + '</div>' + pgB.pager,",
     "        size: 'lg',\n        body: '<div class=\"troop-grid\" style=\"grid-template-columns:repeat(3,1fr);\">' + pgB.slice.join('') + '</div>' + pgB.pager,",
     'smoke'),
    ('⑪ 费用重新写回卡片正文', 'js/ui.js',
     "          (lockMsg ? '<div class=\"tstat\" style=\"color:var(--red-light);\">' + lockMsg + '</div>' : '') + '</div>';",
     "          (lockMsg ? '<div class=\"tstat\" style=\"color:var(--red-light);\">' + lockMsg + '</div>' : '') + '<div class=\"tstat\">' + cost + '</div></div>';",
     'smoke'),
]

def red_names(out):
    return re.findall(r'❌ (.+)', out)

bad = 0
for name, f, old, new, which in CASES:
    src = rd(f)
    if src.count(old) != 1:
        print('⚠️  %s —— 锚点出现 %d 次，跳过（注入本身不合法）' % (name, src.count(old)))
        bad += 1
        continue
    wr(f, src.replace(old, new))
    try:
        if which == 'e2e':
            got, out = run(NODE + ' e2e-test.js')
            base = BASE_E2E
        else:
            got, out = run(NODE + ' smoke-test.js')
            base = BASE_SMOKE
            # 同时确认 e2e 没被连带打死（只跑 smoke 的注入不强制）
        if got is None:
            print('❌ %s —— 跑不起来（注入把语法搞崩了？）' % name)
            print('   ' + out.strip().splitlines()[-1][:160] if out.strip() else '')
            bad += 1
            continue
        delta = got[1] - base[1]
        names = red_names(out)
        mark = '✅' if delta > 0 else '❌'
        if delta <= 0:
            bad += 1
        print('%s %s\n     失败 %d → %d（+%d）' % (mark, name, base[1], got[1], delta))
        for nm in names[:6]:
            print('     • ' + nm[:70])
        if len(names) > 6:
            print('     … 另 %d 条' % (len(names) - 6))
    finally:
        wr(f, src)

print('\n===== 汇总 =====')
print('注入 %d 类，其中「零反应」%d 类' % (len(CASES), bad))
sys.exit(1 if bad else 0)
