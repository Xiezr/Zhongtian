# -*- coding: utf-8 -*-
"""
v90.87 复核补丁 #2 · lifecycle_v89121.js 模块加载清单对齐 index.html

问题：探针加载清单漏 `sphere`。而 `js/map.js` 自 v90.69 起把地形判据的**唯一出口**
      交给了球面内核（GAME.sphere，见 map.js:57~66、179、246、390、524…），
      `js/battle.js / domain.js / state.js / ui.js` 亦有引用。
      → 探针在 `GAME.sphere === undefined` 的**降级环境**里跑，与产品环境不一致，
        属"工具口径未跟随产品"（同一类历史遗留，本轮一并修）。
      `map3d.js` 虽有引用但需 three.js/WebGL（渲染层）→ 维持不加载（逻辑不依赖它）。

纪律：先备份 → 锚点计数断言 → 原子落盘 → 写后自检。
"""
import io, os, sys, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TARGET = os.path.join(ROOT, '.workbuddy', 'tools', 'play', 'lifecycle_v89121.js')
BACKUP = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.87', 'lifecycle_v89121.pre_loadlist.js')

if not os.path.isfile(TARGET):
    sys.exit('❌ 目标不存在：' + TARGET)
if not os.path.isfile(BACKUP):
    os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
    shutil.copy2(TARGET, BACKUP)
    print('🗂  已备份 →', BACKUP)

with io.open(TARGET, 'r', encoding='utf-8') as f:
    s = f.read()
orig = s

A1 = u"""['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {"""
A1_NEW = u"""/* v90.87（复核修复）：加载清单与 index.html 同源 —— v90.69 起 map.js 的地形判据
   唯一出口是球面内核 GAME.sphere（map.js:57~66 等），battle/domain/state/ui 亦有引用；
   漏它会让探针跑在降级环境里（功能"完好"的结论就不成立）。
   map3d.js 需 three.js/WebGL（渲染层·逻辑不依赖）→ 维持不加载。 */
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'sphere', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {"""
assert s.count(A1) == 1, '❌ 锚点命中 %d 次（应为 1）' % s.count(A1)
s = s.replace(A1, A1_NEW, 1)

if s == orig:
    sys.exit('❌ 无改动')

tmp = TARGET + '.tmp9087b'
with io.open(tmp, 'w', encoding='utf-8') as f:
    f.write(s)
os.replace(tmp, TARGET)
print('✅ 已写入', TARGET)

with io.open(TARGET, 'r', encoding='utf-8') as f:
    ck = f.read()
problems = []
if ck.count("'sphere'") != 1:
    problems.append("sphere 条目数 = %d" % ck.count("'sphere'"))
if ck.count("'map3d'") != 0:
    problems.append("误加了 map3d")
if ck.count('{') != ck.count('}'):
    problems.append('花括号不配平')
if ck.count('(') != ck.count(')'):
    problems.append('圆括号不配平')
if problems:
    print('❌ 自检失败：' + ' · '.join(problems)); sys.exit(1)
print('🔎 自检通过：sphere 已入列 · 未引入 map3d · 括号配平')
