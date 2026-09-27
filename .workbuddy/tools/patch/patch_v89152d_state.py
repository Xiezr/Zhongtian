# -*- coding: utf-8 -*-
# v89.152d：state.js —— 两处调用点（loadGame 之后 + tickOnce 兜底）
import io

P = 'E:/Deepseekdb/js/state.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

# ① loadGame 后
A_OLD = u"""      if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();
      if (!st.forged) st.forged = [];   // 铁匠铺已打造记录（用于图鉴）"""
A_NEW = u"""      if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();
      /* v89.152：珠宝体系重设 —— 老档旧珠宝等值换算（幂等 · 详见 GAME.migrateJewels152） */
      if (GAME.migrateJewels152) GAME.migrateJewels152();
      if (!st.forged) st.forged = [];   // 铁匠铺已打造记录（用于图鉴）"""
if u'migrateJewels152' not in s:
    assert s.count(A_OLD) == 1, 'A count=' + str(s.count(A_OLD))
    s = s.replace(A_OLD, A_NEW)
    print('A: loadGame hook')
else:
    print('A: skip (already)')

# ② tickOnce 兜底
B_OLD = u"""    /* v89.136：老档采集队迁移兜底（幂等 · 正常已被 loadGame 处理） */
    if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();"""
B_NEW = u"""    /* v89.136：老档采集队迁移兜底（幂等 · 正常已被 loadGame 处理） */
    if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();
    /* v89.152：老档珠宝换算兜底（幂等 · 同款双保险） */
    if (GAME.migrateJewels152) GAME.migrateJewels152();"""
assert s.count(B_OLD) == 1, 'B count=' + str(s.count(B_OLD))
if u'老档珠宝换算兜底' not in s:
    s = s.replace(B_OLD, B_NEW)
    print('B: tickOnce fallback')
else:
    print('B: skip (already)')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.migrateJewels152()') == 2, 'hook count=' + str(chk.count(u'GAME.migrateJewels152()'))
print('OK len %d -> %d' % (orig, len(chk)))
