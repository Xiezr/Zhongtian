# -*- coding: utf-8 -*-
"""
v90.87 复核补丁 #4 · 两个 audit 工具的加载清单补 'sphere'

问题（同类历史遗留）：`js/map.js` 自 v90.69 起把地形/据点判据的唯一出口交给球面内核
`GAME.sphere`；`js/battle.js / domain.js / state.js / ui.js` 亦有引用。
下列工具**在门禁/审计链内**却没加载 sphere → 跑在与产品不一致的降级环境里：
  ① .workbuddy/tools/audit/audit_v89229b_troopchain.js  （**在 gate 常跑**，验 ⑤ map.fortGarrison 被引）
  ② .workbuddy/tools/audit/audit_v89121_inventory.js    （宝物盘点，含 fortAt 相关盘点）
`map3d.js` 需 three.js/WebGL（渲染层）→ 维持不加载。

纪律：先备份 → 锚点计数断言 → 原子落盘 → 写后自检。
"""
import io, os, sys, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TARGETS = [
    (os.path.join(ROOT, '.workbuddy', 'tools', 'audit', 'audit_v89229b_troopchain.js'),
     u"""['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons',
    'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {""",
     u"""/* v90.87（复核修复）：加载清单与 index.html 同源 —— v90.69 起 map.js 地形/据点判据
       唯一出口是球面内核 GAME.sphere，漏它则本工具跑在降级环境（口径不一致）。
       map3d.js 需 three.js/WebGL（渲染层·逻辑不依赖）→ 维持不加载。 */
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'sphere', 'battle', 'tactic', 'icons', 'gicons',
    'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {"""),

    (os.path.join(ROOT, '.workbuddy', 'tools', 'audit', 'audit_v89121_inventory.js'),
     u"""['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});""",
     u"""/* v90.87（复核修复）：与 index.html 同源（v90.69 起 map.js 地形/据点判据走 GAME.sphere）。 */
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'sphere', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});"""),
]

for TARGET, A1, A1_NEW in TARGETS:
    if not os.path.isfile(TARGET):
        sys.exit('❌ 目标不存在：' + TARGET)
    BACKUP = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.87', os.path.basename(TARGET))
    if not os.path.isfile(BACKUP):
        os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
        shutil.copy2(TARGET, BACKUP)
        print('🗂  已备份 →', BACKUP)

    with io.open(TARGET, 'r', encoding='utf-8') as f:
        s = f.read()
    orig = s
    if s.count(A1) == 0:
        if s.count("'sphere'") == 1:
            print('⏭  %s 已打过（sphere 在册）→ 跳过' % os.path.basename(TARGET))
            continue
        sys.exit('❌ %s 锚点缺失且无 sphere —— 文件已被改动，请人工核对' % os.path.basename(TARGET))
    n = s.count(A1)
    assert n == 1, '❌ %s 锚点命中 %d 次（应为 1）' % (os.path.basename(TARGET), n)
    s = s.replace(A1, A1_NEW, 1)
    if s == orig:
        sys.exit('❌ 无改动：' + TARGET)

    tmp = TARGET + '.tmp9087d'
    with io.open(tmp, 'w', encoding='utf-8') as f:
        f.write(s)
    os.replace(tmp, TARGET)

    # 自检：① sphere 条目数 ② 未误加 map3d ③ 括号计数相对改动前**增量一致**（源文件可能
    #       天生含字面量括号 → 用绝对配平会误报，故比对 delta）
    with io.open(TARGET, 'r', encoding='utf-8') as f:
        ck = f.read()
    problems = []
    if ck.count("'sphere'") != 1:
        problems.append("sphere 条目数 = %d" % ck.count("'sphere'"))
    if ck.count("'map3d'") != 0:
        problems.append('误加了 map3d')
    for op, cl in (('{', '}'), ('(', ')')):
        d0 = orig.count(op) - orig.count(cl)
        d1 = ck.count(op) - ck.count(cl)
        if d0 != d1:
            problems.append('括号差量变了 %s%s: %d → %d' % (op, cl, d0, d1))
    if problems:
        print('❌ 自检失败 %s：%s' % (os.path.basename(TARGET), ' · '.join(problems)))
        sys.exit(1)
    print('✅ %s 已写入 · 自检通过（括号差量守恒）' % os.path.basename(TARGET))
