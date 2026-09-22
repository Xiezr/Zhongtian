# -*- coding: utf-8 -*-
"""v89.95 Patch B2b —— genAttrs（domain.js）与 addFreePoint（state.js）分开打。"""
import io, subprocess

# ---------- domain.js：genAttrs 速度派生 1/5 级 ----------
P3 = 'js/domain.js'
s3 = io.open(P3, encoding='utf-8').read()
o3 = s3
OLD3 = """      spd: Math.round((g.speed || 0) + Math.max(0, (g.level || 1) - 1) + b.spd + (g.spdAdd || 0)),"""
NEW3 = """      /* v89.95（B2）：等级成长改 **每 SPD_CAP.perLevels 级 +1**（原来是每级 +1）。
         仍是**派生**（不写进 g.speed）→ 老档不迁移也立刻对上；自由点 spdAdd 照旧相加。 */
      spd: Math.round((g.speed || 0)
        + Math.floor(Math.max(0, (g.level || 1) - 1) / (((DATA.SPD_CAP || {}).perLevels || 5)))
        + b.spd + (g.spdAdd || 0)),"""
if 'SPD_CAP.perLevels 级 +1' in s3:
    print('SKIP: genAttrs 已改')
else:
    assert OLD3 in s3, 'MISS genAttrs'
    s3 = s3.replace(OLD3, NEW3, 1)
    io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
    print('PATCHED domain.js: genAttrs')

# ---------- state.js：addFreePoint 速度投放上限 ----------
P2 = 'js/state.js'
s2 = io.open(P2, encoding='utf-8').read()
o2 = s2
OLD4 = """    g.freePts -= n;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + n;"""
NEW4 = """    /* v89.95（B2）：**速度的投放上限** = base + floor(等级 / perLevels)（与自然成长同口径）——
       防止"把上千点自由点全砸速度"把速度变成决定性属性（老板点名的那条链）。 */
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
if '速度的投放上限' in s2:
    print('SKIP: addFreePoint 已改')
else:
    assert OLD4 in s2, 'MISS addFreePoint'
    s2 = s2.replace(OLD4, NEW4, 1)
    io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
    print('PATCHED state.js: addFreePoint 上限')

for f in ['js/domain.js', 'js/state.js']:
    r = subprocess.run(['node', '--check', f], capture_output=True, cwd='E:/Deepseekdb')
    print(f + ' check: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300]))
