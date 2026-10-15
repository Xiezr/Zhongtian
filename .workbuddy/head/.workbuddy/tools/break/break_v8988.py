# -*- coding: utf-8 -*-
"""v89.88 破坏测试：对「野外城池改造 + 地图悬浮」的 §88/§⑦ 断言逐一注入，确认**变红**。
跑法：python .workbuddy/tools/break/break_v8988.py
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

DA = os.path.join(ROOT, 'js', 'data.js')
MA = os.path.join(ROOT, 'js', 'map.js')
BA = os.path.join(ROOT, 'js', 'battle.js')
ST = os.path.join(ROOT, 'js', 'state.js')
UI = os.path.join(ROOT, 'js', 'ui.js')
MJ = os.path.join(ROOT, 'js', 'main.js')


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
    # ---- 需求 1~3：据点改造 ----
    ('分布①：高档占比 30% → 20%（配额失效）', DA,
     "levelDist: { high: [8, 9, 10], highPct: 0.30, lowPct: 0.10 },",
     "levelDist: { high: [8, 9, 10], highPct: 0.20, lowPct: 0.10 },",
     'v89.88（据点）：全图配额精确成立（Lv8/9/10 各 30.0% · 1~7 合计 10%）'),
    ('守军①：×10 回退（500 → 50）', DA,
     "    garrisonBase: 500,",
     "    garrisonBase: 50,",
     'v89.88（据点）：守军 ×10（Lv1=500）且**每一级**都 ≥ 同级野地上限'),
    ('上限①：等级上限 10 → 8', DA,
     "    levelMin: 1, levelMax: 10,",
     "    levelMin: 1, levelMax: 8,",
     'v89.88（据点）：上限 10 · 分布配置（8/9/10 各 30% · 低档 10%）'),
    ('满配①：布局等级被钳到 8（Lv9/10 掉档）', ST,
     """  GAME.fortPlanOf = function (fort) {
    if (!fort) return null;
    var lv = Math.max(1, Math.min(DATA.CITY_PLAN.maxLevel, fort.level || 1));""",
     """  GAME.fortPlanOf = function (fort) {
    if (!fort) return null;
    var lv = Math.max(1, Math.min(8, fort.level || 1));""",
     'v89.88（据点）：Lv8/9/10 建筑·城墙·人口·城防全到级（满配）'),
    ('资源①：满配曲线退化（1.35 → 1）', BA,
     "    if (tier === 'fort') mult *= Math.pow(1.35, (c.lv || c.level || 1) - 1);",
     "    if (tier === 'fort') mult *= 1;",
     'v89.88（据点）：战利品满配曲线（Lv1→Lv10 ≈15× · 档位次序不破）'),
    ('资源②：侦查口径退回 wildResMul（虚报 2.4×）', BA,
     "      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.cityResMul && DATA.EXPEDITION.cityResMul.raid) || 0.5;",
     "      var mul = 1.2;",
     'v89.88（据点）：侦查「掠夺可得」= 实际掠夺基准（cityResMul.raid · 不再虚报 2.4×）'),
    ('哈希①：内联实现漂移（a = h || 1 → a = (h ^ 1) || 1）', MA,
     """    var h = (x * 73856093 ^ y * 19349663 ^ ((GAME.state.map.seed || 1) * 2654435761) ^ (salt * 83492791)) >>> 0;
    var a = h || 1;""",
     """    var h = (x * 73856093 ^ y * 19349663 ^ ((GAME.state.map.seed || 1) * 2654435761) ^ (salt * 83492791)) >>> 0;
    var a = (h ^ 1) || 1;""",
     'v89.88（据点）：_fortHash 内联版与 U.rng 逐位等价（防两处实现漂移）'),
    ('逐日①：排序盐去掉「日」（每日重掷失效）', MA,
     "      return { k: k, r: GAME.map._fortHash(k % W, (k / W) | 0, 9001 + day) };",
     "      return { k: k, r: GAME.map._fortHash(k % W, (k / W) | 0, 9001) };",
     'v89.88（据点）：逐日重掷 —— 次日分布同样成立（配额不靠运气）'),
    # ---- 需求 4：地图悬浮 ----
    ('悬浮①：浮层丢掉坐标行', UI,
     "    line('📍 坐标 <b>(' + hit.x + ', ' + hit.y + ')</b>'",
     "    line('坐标 (' + hit.x + ', ' + hit.y + ')'",
     'v89.88（悬浮）：四类地块浮层齐备（坐标 + 等级 · 走唯一出口）'),
    ('悬浮②：主循环 mousemove 接线失效', MJ,
     "    var _mapHoverKey = null;\n    document.addEventListener('mousemove', function (e) {",
     "    var _mapHoverKey = null;\n    document.addEventListener('mousemove-x', function (e) {",
     'v89.88（悬浮）：主循环接线（mapCanvas mousemove · 按格节流 · 移出收起）'),
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
