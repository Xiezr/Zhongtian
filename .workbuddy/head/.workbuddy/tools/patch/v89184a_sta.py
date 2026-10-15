# -*- coding: utf-8 -*-
"""v89184a —— 方案A 落地：体力→生命曲线改「分段」（前段双曲 + 后段线性续增）
四处：data.js（表值+注释）/ domain.js（staHpPct 分段）/ ui.js（六维文案）/ smoke（断言升级）
纪律：newline='' 写盘；幂等 guard（hpKnee 已在 = 已落盘）；写后自检 + node --check。
"""
import io, sys

def read(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def write(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def patch(path, pairs):
    s = read(path)
    for tag, old, new in pairs:
        assert s.count(old) == 1, path + ' | ' + tag + ' | count=' + str(s.count(old))
        s = s.replace(old, new)
    write(path, s)
    print('OK', path)

# ---------------- 0. 幂等 guard ----------------
guard = read('js/data.js')
if 'hpKnee' in guard:
    print('ALREADY DONE (hpKnee present) — skip all')
    sys.exit(0)

# ---------------- 1. data.js ----------------
patch('js/data.js', [
('D1 头部注释 ③ 段',
'''   *   ③ 生命加成用双曲函数而非硬上限，避免"到某个等级后加成恒定"的断崖：
   *        bonus = hpCap × 体力 / (体力 + hpK)
   *      体力 100（1 级）→ +8.9%　体力 500 → +30.8%　体力 1400 → +51%，渐近 80%。''',
'''   *   ③ 生命加成（v89.184 方案A：**分段** —— 前段双曲 + 后段线性续增）：
   *        bonus（≤ hpKnee·前段）= hpCap × 体力 / (体力 + hpK)   ← 与旧曲线逐点相同
   *           体力 100（1 级）→ +8.9%　500 → +30.8%　1400 → +51%　4000 → +66.7%
   *        bonus（> hpKnee·后段）= 拐点值 + (体力−4000)/1000 × 2.5%　← 永不熄火
   *           8000 → +76.7%　12000 → +86.7%　15395 → +95.2%
   *      沿革：v89.183 老板指出「渐近曲线顶部平缓 → 后期提升无用」，实证满配
   *      （体力 15395）再堆 +12000 战场损失分毫不变（probe_v89183a）；
   *      v89.184 拍板方案A —— 前段新手手感零变化、后段边际为旧曲线的 10 倍（2.5% vs 0.23%）。'''),
('D2 表值注释 + 新参数',
'''       渐近上限 +80% 留出丹药与未来成长空间。 */
    perLevel: 1.0,
    nzDiv: 1000,      // 内政影响：内政 1000 使成长量翻倍
    hpCap: 0.8,       // 全军生命加成的渐近上限
    hpK: 800,         // 半程常数：体力 = hpK 时达到上限的一半
  };''',
'''       前段按双曲递增、后段线性续增（v89.184 方案A，见上方 ③ 与 GAME.staHpPct）。 */
    perLevel: 1.0,
    nzDiv: 1000,      // 内政影响：内政 1000 使成长量翻倍
    hpCap: 0.8,       // **前段**渐近上限（仅作用于 ≤ hpKnee 段；后段可超过它）
    hpK: 800,         // 半程常数：体力 = hpK 时达到前段上限的一半
    /* v89.184（老板拍板「方案A」）：后段线性续增的参数 ——
       拐点 4000：此处双曲侧斜率 2.78%/1000，与线性侧 2.50%/1000 自然衔接（折角无感）；
       后段每 1000 体力 +2.5% 全军生命、无硬上限（体力来源本身有限：满配约 1.6 万）。 */
    hpKnee: 4000,     // 分段拐点：≤ 此值走双曲（前段）
    hpTail: 0.025,    // 后段斜率：每 1000 体力 +2.5% 全军生命
  };'''),
])

# ---------------- 2. domain.js ----------------
patch('js/domain.js', [
('M1 staHpPct 分段',
'''  /* 体力 → 全军生命加成（双曲，渐近 +80%，永不硬顶出断崖）。
     拆成"按池子取值"的纯函数，界面要算"装备带来多少全军生命"时直接复用它，
     不必再让将领对象跑一遍。 */
  GAME.staHpPct = function (pool) {
    var S = DATA.STAMINA;
    var s = Math.max(0, pool || 0);
    return S.hpCap * s / (s + S.hpK);
  };''',
'''  /* 体力 → 全军生命加成（v89.184 方案A：**分段** —— 前段双曲、后段线性续增）。
     ------------------------------------------------------------
     v89.183（老板）：「渐近值（上限）曲线顶部趋于平缓 → 后期将领再提升属性
     在战役中是不是没用了」——实证成立：满配体力 15395 时再堆 +12000（+78%），
     战场损失分毫不变（probe_v89183a/b：5837 → 5835）。
     修法（方案A，老板拍板）：
       · 前段（≤ hpKnee）：双曲 hpCap×s/(s+hpK) —— 与旧曲线**逐点相同**（新手/老档零变化）；
       · 后段（> hpKnee）：拐点值 + (s−hpKnee)/1000 × hpTail —— 每 1000 体力 +2.5%，永不熄火。
     实测：满配 +76.0% → +95.2%；临界局（1 万 vs 5.75 万守军）从"全灭"变"险胜"；
     后段无硬上限（体力来源有限，满配实际约 1.6 万）。
     拆成"按池子取值"的纯函数，界面要算"装备带来多少全军生命"时直接复用它，
     不必再让将领对象跑一遍。 */
  GAME.staHpPct = function (pool) {
    var S = DATA.STAMINA;
    var s = Math.max(0, pool || 0);
    if (s <= S.hpKnee) return S.hpCap * s / (s + S.hpK);
    var atKnee = S.hpCap * S.hpKnee / (S.hpKnee + S.hpK);
    return atKnee + (s - S.hpKnee) / 1000 * S.hpTail;
  };'''),
])

# ---------------- 3. ui.js ----------------
patch('js/ui.js', [
('U1 六维文案',
"""      use: '生命渐近 +80% · 上限随等级/资质/内政/装备' },""",
"""      use: '生命前段渐近 +80%、高体力段线性续增（每 1000 +2.5%）· 上限随等级/资质/内政/装备' },"""),
])

# ---------------- 4. smoke-test.js ----------------
patch('smoke-test.js', [
('S1 断言升级',
"""check('体力直接放大全军生命（渐近且不硬顶）', (function () {
  var lo = G.staHpBonus({ level: 1, nz: 50, rank: 'fan', stamina: 100 });
  var hi = G.staHpBonus({ level: 240, nz: 120, rank: 'tian', stamina: 3000 });
  return lo > 0 && hi > lo && hi < DATA.STAMINA.hpCap;
})());""",
"""check('体力直接放大全军生命（前段渐近、后段线性续增 · v89.184 方案A）', (function () {
  var lo = G.staHpBonus({ level: 1, nz: 50, rank: 'fan', stamina: 100 });
  var hi = G.staHpBonus({ level: 240, nz: 120, rank: 'tian', stamina: 3000 });
  /* 前段（≤ hpKnee）：仍渐近且不硬顶（与旧曲线逐点相同） */
  if (!(lo > 0 && hi > lo && hi < DATA.STAMINA.hpCap)) return false;
  /* 后段（> hpKnee）：线性续增 —— 拐点连续 / 值 / 边际 / 可超旧上限 四判据
     （期望值 = probe_v89183b 预演表：8000 → +76.7%）。 */
  var K = DATA.STAMINA;
  var atKnee = K.hpCap * K.hpKnee / (K.hpKnee + K.hpK);
  var a = G.staHpPct(8000), b = G.staHpPct(9000);
  return Math.abs(G.staHpPct(K.hpKnee) - atKnee) < 1e-9
    && Math.abs(a - (atKnee + (8000 - K.hpKnee) / 1000 * K.hpTail)) < 1e-9
    && Math.abs((b - a) - K.hpTail) < 1e-9
    && a > K.hpCap;
})());"""),
])

# ---------------- 5. 写后自检 ----------------
d = read('js/data.js'); dm = read('js/domain.js'); u = read('js/ui.js'); sm = read('smoke-test.js')
assert 'hpKnee: 4000' in d and 'hpTail: 0.025' in d, 'data values'
assert 'S.hpKnee' in dm and 'S.hpTail' in dm and 'atKnee' in dm, 'domain impl'
assert '高体力段线性续增' in u, 'ui copy'
assert '后段线性续增 · v89.184 方案A' in sm and 'K.hpTail' in sm, 'smoke assert'
# 旧文案零残留（可执行形态）
import re
assert "use: '生命渐近 +80%" not in u, 'old ui copy remains'
assert "check('体力直接放大全军生命（渐近且不硬顶）'" not in sm, 'old smoke title remains'   # 可执行形态（防撞新注释 §72.4）
print('SELF-CHECK PASS')
