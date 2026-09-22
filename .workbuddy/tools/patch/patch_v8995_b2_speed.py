# -*- coding: utf-8 -*-
"""v89.95 Patch B2 —— 速度受控成长：每 5 级 +1（自然成长）+ 自由点投放上限。
① data.js  DATA.SPD_CAP
② state.js applyLevelGrowth：速度按 1/5 级成长（写 spdGrow，不污染基础值）
③ domain.js genAttrs：和式里改用"每 5 级 +1"；addFreePoint：速度投放上限。
"""
import io

# ---------- ① data.js ----------
P = 'js/data.js'
s = io.open(P, encoding='utf-8').read()
orig = s
if 'DATA.SPD_CAP' in s:
    print('SKIP: DATA.SPD_CAP')
else:
    anchor = "  DATA.SIEGE = {"
    assert anchor in s
    block = u"""  /* ============================================================
   * v89.95（B2 · 老板「将领每 5 级升高 1 点六维的速度」）：**速度的成长总闸**
   * ------------------------------------------------------------
   * 病根（实测）：速度曾是"每级 +1 + 自由点想投多少投多少"——
   *   240 级天授把自由点全砸速度 → spd ≈ 60+239+1920+装备 ≈ 2400，
   *   进战斗后单位速度 ×(1+spd/300) = **9 倍** → 轻骑 1000×9 = 9000/回合，
   *   一步贴脸、先手打光、溅射收场（老板点名的那条链）。
   * 现在两条闸：
   *   ① 自然成长 = **每 perLevels 级 +1**（默认 5 级 1 点，240 级共 +47）；
   *   ② 自由点投放上限 = base + floor(等级 / perLevels)（另有装备/坐骑一条独立来源）。
   * ⚠️ 装备与坐骑的速度不动（那是"收集"的回报）；这里管的是**无上限的成长**。
   * ============================================================ */
  DATA.SPD_CAP = { perLevels: 5, base: 10 };

"""
    s = s.replace(anchor, block + anchor, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED data.js: DATA.SPD_CAP')

# ---------- ② state.js ----------
P2 = 'js/state.js'
s2 = io.open(P2, encoding='utf-8').read()
o2 = s2
OLD = """    g.freePts = (g.freePts == null ? 0 : g.freePts) + step;"""
NEW = """    g.freePts = (g.freePts == null ? 0 : g.freePts) + step;
    /* v89.95（B2）：速度**不再随级 +1**，改为每 SPD_CAP.perLevels 级 +1（见 genAttrs 的和式）。
       这里只累一个"已满几档"的计数（spdGrow）—— 派生式成长让老档免迁移。 */
    var _spc = (DATA.SPD_CAP || {}).perLevels || 5;
    g.spdLvAcc = (g.spdLvAcc || 0) + 1;
    if (g.spdLvAcc >= _spc) {
      g.spdLvAcc -= _spc;
      g.spdGrow = (g.spdGrow || 0) + 1;
    }"""
assert OLD in s2
s2 = s2.replace(OLD, NEW, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('PATCHED state.js: applyLevelGrowth 速度 1/5 级')

# ---------- ③ domain.js ----------
P3 = 'js/domain.js'
s3 = io.open(P3, encoding='utf-8').read()
o3 = s3
OLD3 = """      spd: Math.round((g.speed || 0) + Math.max(0, (g.level || 1) - 1) + b.spd + (g.spdAdd || 0)),"""
NEW3 = """      /* v89.95（B2）：等级成长改 **每 SPD_CAP.perLevels 级 +1**（原来是每级 +1）。
         仍是**派生**（不写进 g.speed）→ 老档不迁移也立刻对上；自由点 spdAdd 照旧相加。 */
      spd: Math.round((g.speed || 0)
        + Math.floor(Math.max(0, (g.level || 1) - 1) / (((DATA.SPD_CAP || {}).perLevels || 5)))
        + b.spd + (g.spdAdd || 0)),"""
assert OLD3 in s3
s3 = s3.replace(OLD3, NEW3, 1)

OLD4 = """    g.freePts -= n;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + n;"""
NEW4 = """    /* v89.95（B2）：**速度的投放上限** = base + floor(等级 / perLevels)（与自然成长同口径）——
       防止"把 1900 点自由点全砸速度"把速度变成决定性属性（老板点名的那条链）。 */
    if (stat === 'spd') {
      var _sc2 = DATA.SPD_CAP || { perLevels: 5, base: 10 };
      var _lim = (_sc2.base || 0) + Math.floor((g.level || 1) / (_sc2.perLevels || 5));
      var _have = (g.spdAdd || 0);
      if (_have + n > _lim) {
        n = Math.max(0, _lim - _have);
        if (n <= 0) {
          return { ok: false, msg: '速度已达上限 ' + _lim + '（每 ' + (_sc2.perLevels || 5)
            + ' 级 +1；更高速度请靠装备与坐骑）' };
        }
      }
    }
    g.freePts -= n;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + n;"""
assert OLD4 in s3
s3 = s3.replace(OLD4, NEW4, 1)
io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
print('PATCHED domain.js: genAttrs 1/5 级 + 速度投放上限')

for f in [P, P2, P3]:
    import subprocess
    r = subprocess.run(['node', '--check', f], capture_output=True, cwd='E:/Deepseekdb')
    print(f + ' check: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300]))
