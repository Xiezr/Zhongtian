# -*- coding: utf-8 -*-
"""v65 破坏测试（带备份与完整性校验）。

规矩沿用 v64（那次被 bash 超时 SIGTERM 打断，`finally` 没跑到 → 注入残留在工作区）：
  1. 跑之前把要动的文件**备份**到 .workbuddy/tmp/bak_v65/；
  2. 启动时若发现备份存在 → 先**还原**（上一次是崩的）；
  3. 每个用例结束后从备份还原；
  4. 全部跑完（或中途异常）用 md5 比对确认工作区与开跑前完全一致；
  5. 跑前**锚点预检**（每类注入的原文必须恰好出现 1 次，否则拒跑）。
"""
import hashlib, io, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
ENV = dict(os.environ)
ENV['NODE_PATH'] = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
BAK = '.workbuddy/tmp/bak_v65'
FILES = ['js/data.js', 'js/state.js', 'js/domain.js', 'js/battle.js', 'js/ui.js', 'js/main.js']


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
    # ---------- 需求 6：缺粮 24h 后哗变、每 24h 逃 20% ----------
    ('1 缺粮立刻哗变（宽限期 24h → 1h）', 'js/state.js',
     "    var need = (DATA.STARVE && DATA.STARVE.hours) || 24;",
     "    var need = 1;", 'smoke'),
    ('2 每次逃 20% → 50%', 'js/data.js',
     "    mutinyPct: 0.2,     // 每次哗变各兵种逃离当前数量的比例",
     "    mutinyPct: 0.5,     // 注入", 'smoke'),
    ('3 粮接上后**不清零**（断续缺粮会攒够 24h）', 'js/state.js',
     "      if (city.starveHours) city.starveHours = 0;      // 粮接上 → 清零重计",
     "      /* 注入：不清零 */", 'smoke'),
    ('4 哗变按"初始数量"算（不是当前剩余）', 'js/state.js',
     "        var d = Math.floor(n * pct);",
     "        var d = Math.floor((c._initN || (c._initN = n)) * pct);", 'smoke'),
    ('5 离线补算不走 starveStep（两套口径）', 'js/state.js',
     "        var stepOff = GAME.starveStep(ct, true, ts / 3600 * secReal);",
     "        var stepOff = { lost: 0 };   /* 注入：离线干脆不哗变 */", 'smoke'),

    # ---------- 需求 4：统一 8×6 + 名城满级 ----------
    ('6 格数退回按等级分档（8×4）', 'js/data.js',
     "    size: [8, 6],",
     "    size: [8, 4],", 'smoke'),
    ('7 名城建筑按"自身等级"（不再默认满级）', 'js/state.js',
     """    var base = GAME.isFamousCity(city)
      ? lvlCap
      : Math.max(1, Math.min(lvlCap, city.level || 1));""",
     """    var base = Math.max(1, Math.min(lvlCap, city.level || 1));""", 'smoke'),
    ('8 城外地块的等级不跟上限（只用城等级）', 'js/state.js',
     "    for (var k = 0; k < ecap; k++) ext.push({ id: 'e' + (k + 1), type: kinds[k % kinds.length], lv: bl });",
     "    for (var k = 0; k < ecap; k++) ext.push({ id: 'e' + (k + 1), type: kinds[k % kinds.length], lv: lv });", 'smoke'),
    ('9 cityPlanOf 无视 buildLv（建筑等级退回城等级）', 'js/state.js',
     "    var bl = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(buildLv) || lv));",
     "    var bl = lv;   /* 注入 */", 'smoke'),
    ('10 官府改到左侧居中（不再靠右）', 'js/state.js',
     "    var gc = col - 2, gr = Math.max(0, Math.floor((row - 2) / 2));",
     "    var gc = 0, gr = Math.max(0, Math.floor((row - 2) / 2));", 'smoke'),

    # ---------- 需求 1：情报分层 ----------
    ('11 scoutTarget 忽略分层（一次全给）', 'js/battle.js',
     "    out.roster = showRoster ? roster : [];",
     "    out.roster = roster;   /* 注入 */", 'smoke'),
    ('12 intelTiersOf 恒解锁（分层失效）', 'js/battle.js',
     "      return { id: t.id, name: t.name, unlock: t.unlock, hint: t.hint, unlocked: lv >= t.unlock };",
     "      return { id: t.id, name: t.name, unlock: t.unlock, hint: t.hint, unlocked: true };", 'smoke'),
    ('13 情报层数少一层（少报"可图之利"）', 'js/data.js',
     "    { id: 'spoils', unlock: 10, name: '可图之利',",
     "    { id: 'spoils_x', unlock: 10, name: '可图之利',", 'smoke'),
    ('14 侦查面板不分页（两页合并）', 'js/main.js',
     "    if (page === 0) {",
     "    if (true) {", 'e2e'),
    ('15 expedition 不把 gNum 带出来（面板显示 undefined）', 'js/battle.js',
     "        intelTiers: sc.intel, totalExact: sc.totalExact, gNum: sc.gNum,",
     "        intelTiers: sc.intel, totalExact: sc.totalExact,", 'e2e'),
    ('16 新侦查不回到第 1 页（沿用上次页签）', 'js/main.js',
     "      ui.openScoutResult({ kind: m.kind, name: m.name }, r, 0);",
     "      ui.openScoutResult({ kind: m.kind, name: m.name }, r);", 'smoke'),

    # ---------- 需求 2/3/5 + 官府收口 ----------
    ('17 属性不取整（回到 2751.5）', 'js/domain.js',
     "      tong: Math.round((g.tong || 0) + b.tong),",
     "      tong: (g.tong || 0) + b.tong,", 'smoke'),
    ('18 六维作用文案放长（撑高表格）', 'js/ui.js',
     "      use: '攻击值 +10 · 每 10 攻值→全军攻 +1%',",
     "      use: '每点折 10 攻击值；每 10 攻击值增全军攻击 1%（这一句故意写得非常长）',", 'smoke'),
    ('19 资源短写阈值降到千（1000 → 1.0千 视觉变差）', 'js/state.js',
     "    else if (v >= 1e4) { num = (v / 1e4).toFixed(1); unit = '万'; }",
     "    else if (v >= 1e3) { num = (v / 1e3).toFixed(1); unit = '千'; }", 'smoke'),
    ('20 资源栏退回千分位（短写失效）', 'js/ui.js',
     "          '<span class=\"amt\" title=\"' + U.escape(amtTip) + '\">' + U.amtHTML(val) + '</span>' +",
     "          '<span class=\"amt\" title=\"' + U.escape(amtTip) + '\">' + U.numHTML(val, 0) + '</span>' +", 'smoke'),
    ('21 驻军标题加回城名与总数', 'js/ui.js',
     "      '<span>⚔ 驻军</span>' +",
     "      '<span>⚔ ' + U.escape(c.name) + ' · 驻军</span><span>' + U.numText(total, 0) + '</span>' +", 'smoke'),
    ('22 官府面板不限队列条数', 'js/ui.js',
     "      ui.queueBody(4) + '</div>';",
     "      ui.queueBody() + '</div>';", 'smoke'),
    ('23 官府面板退回默认档（装不下）', 'js/ui.js',
     "      '<div class=\"modal-foot\"><button class=\"btn\" data-action=\"close-modal\">关闭</button></div>',\n      { size: 'xl' });",
     "      '<div class=\"modal-foot\"><button class=\"btn\" data-action=\"close-modal\">关闭</button></div>');", 'smoke'),
    ('24 特产说明退回正文（官府面板又变高）', 'js/ui.js',
     "          ui.help('如何收集本城特产：\\n' +",
     "          '<span style=\"display:none\">' + ('如何收集本城特产：\\n' +", 'smoke'),
]

missing = []
for name, f, old, new, which in CASES:
    n = rd(f).count(old)
    if n != 1:
        missing.append('%s -> %s（锚点 %d 次）' % (name, f, n))
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
zero = []
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
                zero.append(name)
            print('%s %s\n     失败 %d -> %d（%+d）' % ('OK' if delta > 0 else 'X ', name, base[1], got[1], delta))
            for nm in re.findall(r'❌ (.+)', out)[:4]:
                print('     - ' + nm[:72])
        finally:
            restore_all('用例结束')
finally:
    diff = [f for f in FILES if md5(f) != BEFORE[f]]
    print('\n===== 汇总 =====')
    print('注入 %d 类，其中「零反应」%d 类' % (len(CASES), bad))
    if zero:
        print('零反应清单：')
        for z in zero:
            print('   - ' + z)
    print('完整性：' + ('OK 工作区与开跑前一致' if not diff else 'X 这些文件变了：' + ', '.join(diff)))
sys.exit(1 if (bad or diff) else 0)
