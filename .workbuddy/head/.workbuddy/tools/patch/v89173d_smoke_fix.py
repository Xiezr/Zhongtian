# -*- coding: utf-8 -*-
"""v89.173d · 修 smoke 六处：v83 惩罚旧数值断言随 decay 0.8 升级 + 出口断言改 three-points + §173⑤c 收窄
红名单来源：smoke 首跑 6 红（4×v83 数值 / 1×出口结构 / 1×自撞 btn sm dim）"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

print('== smoke-test.js（六处） ==')

# D1. 三消费点断言：界面处由 openExpPick 改 setExpItem（v89.173 选择窗正常分支不再逐档问闸）
edit('smoke-test.js', 'D1 三消费点出口断言',
  r'''  check('结构：三个消费点都先问同一个出口（v89.171：资质上限 + 培养上限 = expItemGrantOf）', (function () {
    var use = codeOf(syS66, 'S.useItem = function');
    var batch = codeOf(syS66, 'S.gainExpByItem = function');
    var panel = codeOf(uS66, 'ui.openExpPick = function');
    return /expItemGrantOf/.test(use) && /expItemGrantOf/.test(batch) && /expItemGrantOf/.test(panel)
      && use.length > 200 && batch.length > 200 && panel.length > 200;
  })());''',
  r'''  check('结构：三个消费点都先问同一个出口（v89.173：单用/批量/界面选择 = expItemGrantOf）', (function () {
    var use = codeOf(syS66, 'S.useItem = function');
    var batch = codeOf(syS66, 'S.gainExpByItem = function');
    var pick = codeOf(uS66, 'ui.setExpItem = function');
    return /expItemGrantOf/.test(use) && /expItemGrantOf/.test(batch) && /expItemGrantOf/.test(pick)
      && use.length > 200 && batch.length > 200;
  })());''')

# D2. 每低一档 ×0.65 → ×0.8
edit('smoke-test.js', 'D2 惩罚系数断言',
  r'''    check('惩罚：每低一档 ×0.65（低1档 0.65 / 低6档 0.65⁶）', (function () {
      var p1 = G.battle.expPenaltyOf(20, 1);
      var p6 = G.battle.expPenaltyOf(73, 1);
      return Math.abs(p1.mul - 0.65) < 1e-9 && Math.abs(p6.mul - Math.pow(0.65, 6)) < 1e-9
        && p1.need === 2 && p6.need === 7 && p6.wl === 1;
    })());''',
  r'''    check('惩罚：每低一档 ×0.8（v89.173 放宽 · 低1档 0.8 / 低6档 0.8⁶）', (function () {
      var p1 = G.battle.expPenaltyOf(20, 1);
      var p6 = G.battle.expPenaltyOf(73, 1);
      return Math.abs(p1.mul - 0.8) < 1e-9 && Math.abs(p6.mul - Math.pow(0.8, 6)) < 1e-9
        && p1.need === 2 && p6.need === 7 && p6.wl === 1;
    })());''')

# D3. 地板断言：改为"不低于地板"（0.8 口径下 gap 最深 9 → 0.134，地板为防御性保底）
edit('smoke-test.js', 'D3 地板断言',
  r'''    check('地板：极深越级不低于 0.03（不至于归零）',
      Math.abs(G.battle.expPenaltyOf(200, 1).mul - 0.03) < 1e-9);''',
  r'''    check('地板：极深越级不低于 0.03（v89.173 后 gap 最深 9 → 0.134，地板为防御性保底）',
      G.battle.expPenaltyOf(200, 1).mul >= DATA.EXP_PENALTY.minMul
      && Math.abs(G.battle.expPenaltyOf(200, 1).mul - Math.pow(0.8, 9)) < 1e-9);''')

# D4. 野地 0 级断言：0.65 → 0.8
edit('smoke-test.js', 'D4 0 级野地断言',
  r'''    check('野地 0 级按 1 级对待（尚未长成不比 1 级更差）',
      G.battle.expPenaltyOf(5, 0).mul === 1 && Math.abs(G.battle.expPenaltyOf(13, 0).mul - 0.65) < 1e-9);''',
  r'''    check('野地 0 级按 1 级对待（尚未长成不比 1 级更差）',
      G.battle.expPenaltyOf(5, 0).mul === 1 && Math.abs(G.battle.expPenaltyOf(13, 0).mul - 0.8) < 1e-9);''')

# D5. 数值全在 DATA 断言：decay 0.65 → 0.8
edit('smoke-test.js', 'D5 数值断言',
  r'''    check('数值全在 DATA.EXP_PENALTY（改一处即可调平衡）',
      DATA.EXP_PENALTY.tier === 12 && DATA.EXP_PENALTY.maxLv === 10
      && DATA.EXP_PENALTY.decay === 0.65 && DATA.EXP_PENALTY.minMul === 0.03);''',
  r'''    check('数值全在 DATA.EXP_PENALTY（改一处即可调平衡 · v89.173 decay 0.8）',
      DATA.EXP_PENALTY.tier === 12 && DATA.EXP_PENALTY.maxLv === 10
      && DATA.EXP_PENALTY.decay === 0.8 && DATA.EXP_PENALTY.minMul === 0.03);''')

# D6. §173⑤c 收窄到选择窗段（btn sm dim 是主城标记/存档槽的通用样式，全文件查会撞）
edit('smoke-test.js', 'D6 §173⑤c 收窄',
  r'''      check('§173⑤c ui.js：旧上限文案零残留（最多至 / 只服务前期 / dim 态）',
        !/最多至 Lv|只服务前期|btn sm dim/.test(uS));''',
  r'''      var pickS173 = codeOf(uS, 'ui.openExpPick = function');
      check('§173⑤c 选择窗内旧上限文案零残留（最多至 / 只服务前期 / dim 态）',
        !/最多至|只服务前期|btn sm dim/.test(pickS173));''')

print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

r = subprocess.run(['node', '--check', os.path.join(ROOT, 'smoke-test.js')], capture_output=True, text=True)
print(('  PASS ' if r.returncode == 0 else '  FAIL ') + (r.stderr.strip()[:200] if r.returncode else ''))
sys.exit(0 if r.returncode == 0 else 1)
