# -*- coding: utf-8 -*-
"""
v90.87 复核补丁 #3 · lifecycle_v89121.js —— A2 军装：锻造间等级按产品最高阶读取

问题（复核发现的 57 条假红断链）：
  A2「军装全生命周期」报 342 件可打造 · 通过 285 · 断链 57，
  57 条**全是同一句**：`打造失败:锻造间等级不足（打造机神需 Lv9）`。
  根因：探针 `buildScene()` 把建筑钉死在 `Math.max(lvl, 8)` = Lv8；
  而产品 `DATA.FORGE.tierLv = [1,3,5,7,8,9]`（6 阶），第 6 阶（神装 q=6）需 **Lv9**。
  → 探针根本够不到最高阶，"全生命周期"没跑完；这是**探针钉魔法数**，不是产品缺陷。

修法（跟随产品口径 · 不新增第二套判据）：
  A2 段按产品自己的表取最高阶所需等级 `DATA.FORGE.tierLv[last]`（=9），
  把锻造间（tiejiangpu）写到该等级 —— 与"满配城市"的场景意图一致，且不再钉死数字。
  只用 `--part=A2|ALL` 生效范围限定在 A2（其余分部场景不变，零回归面）。

纪律：先备份 → 锚点计数断言 → 原子落盘 → 写后自检。
"""
import io, os, sys, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TARGET = os.path.join(ROOT, '.workbuddy', 'tools', 'play', 'lifecycle_v89121.js')
BACKUP = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.87', 'lifecycle_v89121.pre_forgelv.js')

if not os.path.isfile(TARGET):
    sys.exit('❌ 目标不存在：' + TARGET)
if not os.path.isfile(BACKUP):
    os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
    shutil.copy2(TARGET, BACKUP)
    print('🗂  已备份 →', BACKUP)

with io.open(TARGET, 'r', encoding='utf-8') as f:
    s = f.read()
orig = s

A1 = u"""  var sc2 = buildScene();
  var st2 = sc2.st, A2 = sc2.A;
  var gen2 = st2.generals[0];
"""
A1_NEW = u"""  var sc2 = buildScene();
  var st2 = sc2.st, A2 = sc2.A;
  var gen2 = st2.generals[0];
  /* v90.87（复核修复）：探针原把建筑钉在 Lv8，够不到产品最高阶 ——
     `DATA.FORGE.tierLv = [1,3,5,7,8,9]` 第 6 阶（神装）需 Lv9，
     导致 57 件神装全被"锻造间等级不足"拦下（假红）。
     改按产品自己的表取最高阶所需等级，不钉魔法数。 */
  (function () {
    var needLv = (DATA.FORGE && DATA.FORGE.tierLv && DATA.FORGE.tierLv.length)
      ? DATA.FORGE.tierLv[DATA.FORGE.tierLv.length - 1] : 9;
    var hit = 0;
    A2.cells.forEach(function (c) { if (c.build && c.build.id === 'tiejiangpu') { c.build.lvl = needLv; hit++; } });
    if (!hit) throw new Error('A2 场景找不到锻造间（tiejiangpu）—— 探针场景构造过期');
  })();
"""
assert s.count(A1) == 1, '❌ 锚点命中 %d 次（应为 1）' % s.count(A1)
s = s.replace(A1, A1_NEW, 1)

if s == orig:
    sys.exit('❌ 无改动')

tmp = TARGET + '.tmp9087c'
with io.open(tmp, 'w', encoding='utf-8') as f:
    f.write(s)
os.replace(tmp, TARGET)
print('✅ 已写入', TARGET)

with io.open(TARGET, 'r', encoding='utf-8') as f:
    ck = f.read()
problems = []
if ck.count('DATA.FORGE.tierLv[DATA.FORGE.tierLv.length - 1]') != 1:
    problems.append('最高阶读取缺失/重复')
if ck.count("c.build.id === 'tiejiangpu'") != 1:
    problems.append('锻造间定位异常')
if ck.count('{') != ck.count('}'):
    problems.append('花括号不配平')
if ck.count('(') != ck.count(')'):
    problems.append('圆括号不配平')
if problems:
    print('❌ 自检失败：' + ' · '.join(problems)); sys.exit(1)
print('🔎 自检通过：A2 锻造间按产品最高阶（tierLv[-1]）设定 · 括号配平')
