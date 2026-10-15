# -*- coding: utf-8 -*-
"""v89.211 补丁 B：state.js
   B1 lingPowerOf 读 eqLingMulOf（乘数唯一出口）
   B2 读档迁移"城墙格释放"→ 补建民房（新口径）
   B3 loadFrom 迁移链挂载 migrateWallCell211
"""
import io

R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('js/state.js')

# ---------------- B1: lingPowerOf ----------------
if 'GAME.eqLingMulOf ? GAME.eqLingMulOf(inst) : 1' in s:
    print('[skip] B1 lingPowerOf 已收敛')
else:
    old = """    var bag = g.lingEquip || {}, t = 0;
    var perLv = (DATA.LING_TEMPER && DATA.LING_TEMPER.perLv) || 0.08;
    for (var slot in bag) {
      var inst = bag[slot];
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!it || !it.lingv) continue;
      t += it.lingv * (1 + (GAME.eqEnhOf ? GAME.eqEnhOf(inst) : 0) * perLv);
    }"""
    new = """    var bag = g.lingEquip || {}, t = 0;
    for (var slot in bag) {
      var inst = bag[slot];
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!it || !it.lingv) continue;
      /* v89.211：蕴养乘数收敛到 GAME.eqLingMulOf（唯一出口；装备描述 equipDescOf 同源） */
      t += it.lingv * (GAME.eqLingMulOf ? GAME.eqLingMulOf(inst) : 1);
    }"""
    s = sub1(s, old, new, 'B1')
    wr('js/state.js', s)
    print('[ok] B1 lingPowerOf')

# ---------------- B2: 迁移释放补建民房 ----------------
s = rd('js/state.js')
if 'v89.211（老板 2）' in s and 'x.build = { id: \'minfang\'' in s:
    print('[skip] B2 迁移释放已改补建')
else:
    old = """        c.cells.forEach(function (x, i) {
          if (!x.build || x.build.id !== 'chengqiang') return;
          if ((x.build.lvl || 0) > wlv128) wlv128 = x.build.lvl;
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId === c.id && q.gridIndex === i && q.buildId === 'chengqiang') q.gridIndex = 'wall';
          });
          x.build = null; x.pending = null;
        });"""
    new = """        c.cells.forEach(function (x, i) {
          if (!x.build || x.build.id !== 'chengqiang') return;
          if ((x.build.lvl || 0) > wlv128) wlv128 = x.build.lvl;
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId === c.id && q.gridIndex === i && q.buildId === 'chengqiang') q.gridIndex = 'wall';
          });
          /* v89.211（老板 2）：释放格**补建民房**（同等级）—— 原样留空会让"满配城"
             缺一块（老板实测"第五行第六格未建造"即此格）；同口径见 battle.js onConquer。 */
          x.build = { id: 'minfang', lvl: x.build.lvl || 1 };
          x.pending = null;
        });"""
    s = sub1(s, old, new, 'B2')
    wr('js/state.js', s)
    print('[ok] B2 迁移释放补建')

# ---------------- B3: loadFrom 挂载 ----------------
s = rd('js/state.js')
if 'GAME.migrateWallCell211) GAME.migrateWallCell211(st);' in s:
    print('[skip] B3 迁移挂载已在册')
else:
    old = """      /* v89：修炼线君主专属 —— 旧档里非君主身上的灵气装备归还背包、归位军装 */
      if (GAME.migrateLordLing) GAME.migrateLordLing(st);"""
    new = """      /* v89：修炼线君主专属 —— 旧档里非君主身上的灵气装备归还背包、归位军装 */
      if (GAME.migrateLordLing) GAME.migrateLordLing(st);
      /* v89.211（老板 2）：占城"城墙格释放成空格"的存量补齐（紧签名 · 一次性） */
      if (GAME.migrateWallCell211) GAME.migrateWallCell211(st);"""
    s = sub1(s, old, new, 'B3')
    wr('js/state.js', s)
    print('[ok] B3 迁移挂载')

print('DONE')
