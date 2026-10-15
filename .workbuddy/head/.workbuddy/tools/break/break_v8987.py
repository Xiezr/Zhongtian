# -*- coding: utf-8 -*-
"""v89.87 破坏测试：对四需求（快购/派兵统一/战斗规则/观战）的 §87 断言逐一注入，
   确认**变红**（可翻转）。
   跑法：python .workbuddy/tools/break/break_v8987.py
"""
import io
import os
import re
import subprocess
import sys
import hashlib

ROOT = r'E:\Deepseekdb'
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
SMOKE = os.path.join(ROOT, 'smoke-test.js')

UI = os.path.join(ROOT, 'js', 'ui.js')
DO = os.path.join(ROOT, 'js', 'domain.js')
BA = os.path.join(ROOT, 'js', 'battle.js')
TA = os.path.join(ROOT, 'js', 'tactic.js')
MA = os.path.join(ROOT, 'js', 'main.js')


def md5(p):
    return hashlib.md5(io.open(p, 'rb').read()).hexdigest()


def run_smoke():
    env = dict(os.environ)
    env['NODE_PATH'] = NODE_PATH
    r = subprocess.run([NODE, 'smoke-test.js'], cwd=ROOT, capture_output=True, env=env, timeout=900)
    out = r.stdout.decode('utf-8', 'replace')
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    return r.returncode, (m.groups() if m else None), re.findall(r'❌ (.+)', out)


INJECTIONS = [
    # ---- 需求 1：快购 ----
    ('快购①：打造补货按钮退化（qb-item → noop）', UI,
     "data-action=\"qb-item\" data-item=\"' + mk +",
     "data-action=\"noop-item\" data-item=\"' + mk +",
     'v89.87（快购）：组件 + 六接入点 + 四动作齐备'),
    ('快购②：种子页签删除（开售失效）', UI,
     "    seed: '种子',\n  };",
     "  };",
     'v89.87（快购）：弹窗渲染（锦囊）+ 种子开售（页签）'),
    # ---- 需求 2：派兵统一走行军 ----
    ('派兵①：调兵改回瞬时入城（不走行军）', DO,
     """    var d = GAME.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', army, gen.id);
    if (!d.ok) return d;
    return { ok: true, msg: '大军开拔：' + U.fmt(moved) + ' 兵 → ' + to.name + '（' + d.msg + '）' };""",
     """    for (var cc in army) {
      var mm = Math.floor(army[cc] || 0);
      if (mm <= 0) continue;
      from.army[cc] -= mm;
      to.army[cc] = (to.army[cc] || 0) + mm;
    }
    return { ok: true, msg: '已派驻 ' + U.fmt(moved) + ' 兵 至 ' + to.name };""",
     'v89.87（派兵）：调兵走行军'),
    ('派兵②：采集改回瞬时（不走行军）', DO,
     """    var d = GAME.march.dispatch({ kind: 'wild', x: x, y: y }, 'gather', army, gen.id);
    if (!d.ok) return d;
    return { ok: true, msg: '采集队开拔：' + U.fmt(troops) + ' 兵（' + d.msg + '）' };""",
     """    return { ok: true, msg: '（破坏注入：不走行军）' };""",
     'v89.87（派兵）：采集走行军'),
    # ---- 需求 3：战斗规则 ----
    ('战斗①：溅射系数归零（30% 失效）', TA,
     'T.SPLASH_PCT = 0.30;',
     'T.SPLASH_PCT = 0;',
     'v89.87（战斗）：主目标吃满 + 溢出 30% 溅射'),
    ('战斗②：单目标分支失效（退回多目标溢散）', TA,
     '      if (ctx.single && pool.length) {',
     '      if (false && pool.length) {',
     'v89.87（战斗）：主目标吃满 + 溢出 30% 溅射'),
    ('战斗③：反击调用移除（不限次失效）', TA,
     """            res.hits.forEach(function (h) {
              counterStrike(u, h, enemyUnits, ownGen, enemyGen, events);
            });""",
     """            res.hits.forEach(function (h) {
              void h;
            });""",
     'v89.87（战斗）：反击不限次'),
    # ---- 需求 4：观战 ----
    ('观战①：挂起闸门恒关（不进会话）', BA,
     """  GAME.battle._needWatch = function (opts) {
    var s = GAME.state;""",
     """  GAME.battle._needWatch = function (opts) {
    return false;
    var s = GAME.state;""",
     'v89.87（观战）：挂起 → 步进 → 自动结算（军账闭合）'),
    ('观战②：步进失效（stepBattle 空转）', BA,
     """  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];""",
     """  GAME.battle.stepBattle = function (id) {
    if (1) return null;
    var ses = GAME._bsess && GAME._bsess[id];""",
     'v89.87（观战）：挂起 → 步进 → 自动结算（军账闭合）'),
    ('观战③：bt-done 动作注销（接不了）', MA,
     "      case 'bt-done': (function () {",
     "      case 'bt-done-x': (function () {",
     'v89.87（观战）：引擎会话 API + 界面组件齐备'),
]


def main():
    smoke_src = io.open(SMOKE, encoding='utf-8', newline='').read()
    missing = []
    for name, _, _, _, watch in INJECTIONS:
        if watch not in smoke_src:
            missing.append((name, watch))
    if missing:
        print('✗ 部分断言不在 smoke-test.js（先同步断言清单）：')
        for n, w in missing:
            print('   -', n, '→', w)
        return 2
    print('① 断言在位校验：%d 条全部命中 ✅' % len(INJECTIONS))

    files = sorted({t for _, t, _, _, _ in INJECTIONS})
    base = {p: md5(p) for p in files}
    origin = {p: io.open(p, encoding='utf-8', newline='').read() for p in files}
    print('② 基线 md5：%d 个文件已记\n' % len(files))

    results = []
    for name, target, old, new, watch in INJECTIONS:
        print('── %s ──' % name)
        try:
            n = origin[target].count(old)
            if n != 1:
                print('   ✗ 锚点出现 %d 次（要求 1 次），未注入\n' % n)
                results.append((name, False, '锚点 %d 次' % n))
                continue
            io.open(target, 'w', encoding='utf-8', newline='').write(
                origin[target].replace(old, new, 1))
            rc, counts, fails = run_smoke()
            red = any(watch in f for f in fails)
            print('   smoke 退出码 %s  计数 %s  失败行 %d' % (rc, counts, len(fails)))
            if counts is None:
                print('   ⚠️ 判据失效：拿不到标准汇总行（疑似中断）')
            for f in [x for x in fails if watch in x][:2]:
                print('   ❌ ' + f.strip()[:78])
            print('   目标断言变红：%s' % ('✅ 是' if red else '❌ 否（零反应！）'))
            results.append((name, red, '失败 %s' % (counts[1] if counts else '?')))
        finally:
            io.open(target, 'w', encoding='utf-8', newline='').write(origin[target])
        print()

    print('=' * 62)
    for name, ok, note in results:
        print(('  ✅ ' if ok else '  ❌ ') + name + '  (' + note + ')')
    allok = all(ok for _, ok, _ in results)
    same = all(md5(p) == base[p] for p in files)
    print('=' * 62)
    print('破坏测试：%d/%d 变红' % (sum(1 for _, ok, _ in results if ok), len(results)))
    print('还原核验：%s' % ('✅ 全部文件与注入前逐字节一致' if same else '❌ 未还原干净！'))
    return 0 if (allok and same) else 1


if __name__ == '__main__':
    sys.exit(main())
