# -*- coding: utf-8 -*-
"""v64 破坏测试（带备份与完整性校验）。

WARNING 上一版被 bash 超时 SIGTERM 打断，`finally` 没跑到 → **js/ui.js 带着注入留在工作区**
（表现为"当前基线自己就红了 1 条"）。所以这一版：
  1. 跑之前把要动的文件**备份**到 .workbuddy/tmp/bak_v64/；
  2. 启动时若发现备份存在 → 先**还原**（上一次是崩的）；
  3. 每个用例结束后从备份还原；
  4. 全部跑完（或中途异常）用 md5 比对确认工作区与开跑前完全一致。
"""
import hashlib, io, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
ENV = dict(os.environ)
ENV['NODE_PATH'] = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
BAK = '.workbuddy/tmp/bak_v64'
FILES = ['js/domain.js', 'js/battle.js', 'js/ui.js']

def md5(p):
    return hashlib.md5(io.open(p, 'rb').read()).hexdigest()

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=ENV, shell=True)
    out = (p.stdout or '') + (p.stderr or '')
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    return (int(m.group(1)), int(m.group(2))) if m else None, out

def rd(p):
    return io.open(p, encoding='utf-8').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def restore_all(tag):
    for f in FILES:
        src = os.path.join(BAK, f.replace('/', '__'))
        if os.path.exists(src):
            shutil.copyfile(src, f)
    print('（%s）已从备份还原 %d 个文件' % (tag, len(FILES)))

os.makedirs(BAK, exist_ok=True)
if any(os.path.exists(os.path.join(BAK, f.replace('/', '__'))) for f in FILES):
    restore_all('上次未正常结束')

for f in FILES:
    shutil.copyfile(f, os.path.join(BAK, f.replace('/', '__')))
BEFORE = {f: md5(f) for f in FILES}

CASES = [
    ('1 自动升级不再考虑城墙', 'js/domain.js',
     """    (s.cities || []).forEach(function (ct) {
      var wlv = ct.wallLv || 0;""",
     """    [].forEach(function (ct) {
      var wlv = ct.wallLv || 0;""", 'smoke'),
    ('2 城墙施工中仍重复排队（同一级付几份料）', 'js/domain.js',
     "      if (GAME.wallPendingOf(ct.id)) return;",
     "      /* 注入：去掉施工中检查 */", 'smoke'),
    ('3 同级排序把城墙排到最前（抢城内建筑）', 'js/domain.js',
     "    var KIND_ORD = { city: 0, wall: 1, ext: 2 };",
     "    var KIND_ORD = { city: 1, wall: 0, ext: 2 };", 'smoke'),
    ('4 席位改回"按当前城"（全境共用一个数）', 'js/domain.js',
     """  GAME.genSlotsOf = function (city) {
    if (!city) return 0;""",
     """  GAME.genSlotsOf = function (city) {
    city = GAME.currentCity() || city;
    if (!city) return 0;""", 'smoke'),
    ('5 canRecruitGeneral 拿全境人数比本城席位', 'js/domain.js',
     "    var cap = GAME.genSlotsOf(city), used = GAME.generalsIn(city).length;",
     "    var cap = GAME.genSlotsOf(city), used = GAME.state.generals.length;", 'smoke'),
    ('6 派遣不校验目标城席位', 'js/domain.js',
     "    var slotsT = GAME.genSlotsOf(to), usedT = GAME.generalsIn(to).length;",
     "    var slotsT = 1e9, usedT = 0;", 'smoke'),
    ('7 招募把新将挂到"当前城"', 'js/domain.js',
     "idle', city.id, false, cnd.rank, cnd.style);",
     "idle', GAME.currentCity().id, false, cnd.rank, cnd.style);", 'smoke'),
    ('8 招募扣"当前城"的金（不是目标城）', 'js/domain.js',
     "    var R = GAME.res(city);\n    if ((R.gold || 0) < cnd.cost)",
     "    var R = GAME.res(GAME.currentCity());\n    if ((R.gold || 0) < cnd.cost)", 'smoke'),
    ('9 读档不再归一化将领归属', 'js/domain.js',
     "      if (!g.cityId || !ids[g.cityId]) { g.cityId = home; n++; }",
     "      /* 注入：不归一化 */", 'smoke'),
    ('10 降将不带出发城（回到"无主之将"）', 'js/battle.js',
     "    if (home) g.cityId = home.id;",
     "    /* 注入：不给归属城 */", 'smoke'),
    ('11 将领页用全境席位当本城上限', 'js/ui.js',
     "    var cap = (scope === 'all') ? GAME.genSlotsTotal() : GAME.genSlotsOf(cur);",
     "    var cap = GAME.genSlotsTotal();", 'e2e'),
    ('12 派遣面板不标空位（退回"现有 N 人"）', 'js/ui.js',
     "            + (free > 0 ? '（空 ' + free + '）' : '（已满）') + '</i>',",
     "            + ' 人</i>',", 'e2e'),
    ('13 招贤馆面板不写"本城席位"', 'js/ui.js',
     "'<div class=\"attr\"><span class=\"k\">房间（本城将领席位）</span><span class=\"v\">' +",
     "'<div class=\"attr\"><span class=\"k\">房间（将领容量）</span><span class=\"v\">' +", 'e2e'),
]

missing = []
for name, f, old, new, which in CASES:
    if rd(f).count(old) != 1:
        missing.append('%s -> %s（锚点 %d 次）' % (name, f, rd(f).count(old)))
if missing:
    print('预检失败，工作区可能已被注入污染：')
    for m in missing:
        print('   - ' + m)
    restore_all('预检失败')
    sys.exit(2)
print('预检通过：%d 类注入锚点齐全\n' % len(CASES))

BASE = {}
for key, cmd in (('smoke', NODE + ' smoke-test.js'), ('e2e', NODE + ' e2e-test.js')):
    BASE[key] = run(cmd)[0]
print('基线：smoke %s / e2e %s\n' % (BASE['smoke'], BASE['e2e']))

bad = 0
diff = []
try:
    for name, f, old, new, which in CASES:
        src = rd(f)
        wr(f, src.replace(old, new))
        try:
            if which == 'e2e':
                got, out = run(NODE + ' e2e-test.js'); base = BASE['e2e']
            else:
                got, out = run(NODE + ' smoke-test.js'); base = BASE['smoke']
            if got is None:
                print('X %s -- 跑不起来（注入把脚本搞崩了？）' % name)
                if out.strip():
                    print('   ' + out.strip().splitlines()[-1][:150])
                bad += 1
                continue
            delta = got[1] - base[1]
            if delta <= 0:
                bad += 1
            print('%s %s\n     失败 %d -> %d（%+d）' % ('OK' if delta > 0 else 'X ', name, base[1], got[1], delta))
            for nm in re.findall(r'❌ (.+)', out)[:5]:
                print('     - ' + nm[:70])
        finally:
            restore_all('用例结束')
finally:
    diff = [f for f in FILES if md5(f) != BEFORE[f]]
    print('\n===== 汇总 =====')
    print('注入 %d 类，其中「零反应」%d 类' % (len(CASES), bad))
    print('完整性：' + ('OK 工作区与开跑前一致' if not diff else 'X 这些文件变了：' + ', '.join(diff)))
sys.exit(1 if (bad or diff) else 0)
