# -*- coding: utf-8 -*-
"""v89.230 批次 C：活工具同步（兵种 id 换代）——
audit/chains · audit/modals · audit/diag_overflow · audit/ladder · play/lifecycle ·
playtest ×6 · gen/gen_gicons · show/shot_v89150b。史档（probe/旧 show/asset gallery）不动。
"""

import io

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []

def rep(path, tag, old, new, cnt=1):
    s = rd(path)
    if new in s and s.count(old) == 0:
        REPORT.append('[skip] %s' % tag)
        return
    c = s.count(old)
    assert c == cnt, '%s :: %s count=%d（期望 %d）' % (path, tag, c, cnt)
    wr(path, s.replace(old, new))
    REPORT.append('[ok] %s' % tag)

# ============ 1. audit_v89105_chains.js ============
P1 = '.workbuddy/tools/audit/audit_v89105_chains.js'
rep(P1, 'chains.army', "A.army = { yibing: 9000, gongjian: 3000, qingji: 1500, minfu: 1200 };",
    "A.army = { buxingji: 9000, daodanche: 3000, fujiche: 1500, banche: 1200 };")
rep(P1, 'chains.c1', '搬运工是', '板车是')
rep(P1, 'chains.c2', '这里要**保留搬运工**：调运链在后，靠它挑担子', '这里要**保留板车**：调运链在后，靠它拉货')
rep(P1, 'chains.title', "step('募兵 · 民兵 ×2000（受校场人马上限约束）'", "step('募兵 · 步行机 ×2000（受校场人马上限约束）'")
rep(P1, 'chains.t1', "G.train('yibing', 2000, A.id, ARMY_IDX)", "G.train('buxingji', 2000, A.id, ARMY_IDX)")
rep(P1, 'chains.n1', "'民兵 +2000（存量 '", "'步行机 +2000（存量 '")
rep(P1, 'chains.t2', "G.train('yibing', 2000000, A.id, ARMY_IDX)", "G.train('buxingji', 2000000, A.id, ARMY_IDX)")
rep(P1, 'chains.d1', "var men0 = (A.army.yibing || 0);", "var men0 = (A.army.buxingji || 0);")
rep(P1, 'chains.d2', "G.disbandAt(A.id, 'yibing', 500)", "G.disbandAt(A.id, 'buxingji', 500)")
rep(P1, 'chains.d3', "var men1 = (A.army.yibing || 0);", "var men1 = (A.army.buxingji || 0);")
rep(P1, 'chains.n2', "'民兵 ' + men0 + ' → ' + men1", "'步行机 ' + men0 + ' → ' + men1")
rep(P1, 'chains.a2', "var army = { qingji: 1200, gongjian: 800 };", "var army = { fujiche: 1200, daodanche: 800 };")
rep(P1, 'chains.a3', "A.army = { qingji: 4000, gongjian: 3000, yibing: 3000, minfu: 1200 };",
    "A.army = { fujiche: 4000, daodanche: 3000, buxingji: 3000, banche: 1200 };")
rep(P1, 'chains.a4', "{ qingji: 4000, gongjian: 3000, yibing: 3000 }, st.generals[0].id)",
    "{ fujiche: 4000, daodanche: 3000, buxingji: 3000 }, st.generals[0].id)")
rep(P1, 'chains.tf', "G.doTransferCargo(A.id, B.id, { minfu: 200 }, st.generals[1].id, { grain: 30000 })",
    "G.doTransferCargo(A.id, B.id, { banche: 200 }, st.generals[1].id, { grain: 30000 })")
rep(P1, 'chains.c3', "200 搬运工 × 200 = 4 万", "200 板车 × 500 = 10 万")

# ============ 2. audit_v89105_modals.js ============
P2 = '.workbuddy/tools/audit/audit_v89105_modals.js'
_s = rd(P2)
_changed = False
for tok, nw in [('gongjian', 'daodanche'), ('qingji', 'fujiche'), ('daodun', 'dunwei'), ('minfu', 'banche')]:
    c = _s.count(tok)
    if c == 0:
        continue                        # 幂等：已换代
    assert c == 1, 'modals.%s count=%d' % (tok, c)
    _s = _s.replace(tok, nw)
    _changed = True
if _changed:
    wr(P2, _s)
REPORT.append('[ok] modals.tokens（幂等）')
rep(P2, 'modals.l44', "c.army = { yibing: 12000, daodanche: 4200, fujiche: 1800, dunwei: 900, changqiang: 2600 };",
    "c.army = { buxingji: 14600, daodanche: 4200, fujiche: 1800, dunwei: 900 };   /* v89.230：旧 yibing+changqiang 合并相加 */")
rep(P2, 'modals.l74', "st.woundedArmy = { yibing: 3600, changqiang: 1600 };",
    "st.woundedArmy = { buxingji: 5200 };")
rep(P2, 'modals.l77a', "loss: { atkStart: { yibing: 12000 }, atkLoss: { yibing: 420 }, defStart: { yibing: 3200 }, defLoss: { yibing: 3200 } } });",
    "loss: { atkStart: { buxingji: 12000 }, atkLoss: { buxingji: 420 }, defStart: { buxingji: 3200 }, defLoss: { buxingji: 3200 } } });")
rep(P2, 'modals.l137a', "army:{yibing:1200}", "army:{buxingji:1200}")
rep(P2, 'modals.l137b', "army:{yibing:3000,banche:200}", "army:{buxingji:3000,banche:200}")

# ============ 3. audit/diag_v89105_overflow.js ============
P3 = '.workbuddy/tools/audit/diag_v89105_overflow.js'
rep(P3, 'diag.army', "c.army = { yibing: 12000, gongjian: 4200, qingji: 1800 };",
    "c.army = { buxingji: 12000, daodanche: 4200, fujiche: 1800 };")
rep(P3, 'diag.wound', "st.woundedArmy = { yibing: 3600 };", "st.woundedArmy = { buxingji: 3600 };")

# ============ 4. audit/ladder_audit.js ============
P4 = '.workbuddy/tools/audit/ladder_audit.js'
rep(P4, 'ladder.head', " * 退出码：0 阶梯可攀 / 1 存在跨度过大的坑",
    " * 退出码：0 阶梯可攀 / 1 存在跨度过大的坑\n * v89.230：兵种 id 随兵种重构换代（yibing→buxingji · tieji→zhuzhan）；数值与判据未动。")
rep(P4, 'ladder.mix', "const FORT_MIX = { yibing: .35, changqiang: .25, daodun: .2, gongjian: .2, qingji: .1 };",
    "/* v89.230：权重**与 map.fortGarrison 同步**（旧 .35+.25 两兵合并相加 → buxingji .6）。 */\nconst FORT_MIX = { buxingji: .6, dunwei: .2, daodanche: .2, fujiche: .1 };")
rep(P4, 'ladder.lv4', "(k === 'qingji' && lv < 4 ? 0 : FORT_MIX[k])", "(k === 'fujiche' && lv < 4 ? 0 : FORT_MIX[k])")
rep(P4, 'ladder.cap', "capOf[g] = { tiles, grain, yibing: Math.floor(grain / 3), tieji: Math.floor(grain / 35) };",
    "capOf[g] = { tiles, grain, buxingji: Math.floor(grain / 3), zhuzhan: Math.floor(grain / 35) };   /* ÷3 / ÷35 = v28 军粮口径的代理值（非当前 cost.grain）—— 本表定位节奏参考 */")
rep(P4, 'ladder.th', "可养民兵   可养装甲战车", "可养步兵   可养重装")
rep(P4, 'ladder.row', "${pad(fmt(c.yibing), 9)}   ${pad(fmt(c.tieji), 9)}", "${pad(fmt(c.buxingji), 9)}   ${pad(fmt(c.zhuzhan), 9)}")
rep(P4, 'ladder.t3', "以单城官府 Lv${GOV_MAX} 的民兵产能为一把尺", "以单城官府 Lv${GOV_MAX} 的步兵产能为一把尺")
rep(P4, 'ladder.one', "const one = capOf[GOV_MAX].yibing;", "const one = capOf[GOV_MAX].buxingji;")
rep(P4, 'ladder.t4', "单城满级可出民兵：", "单城满级可出步兵：")
rep(P4, 'ladder.t5', "单城满级可出 ${fmt(one)} 民兵，最高档", "单城满级可出 ${fmt(one)} 步兵，最高档")

# ============ 5. play/lifecycle_v89121.js ============
P5 = '.workbuddy/tools/play/lifecycle_v89121.js'
rep(P5, 'life.yibing', "'yibing'", "'buxingji'", cnt=3)

# ============ 6. playtest ×6 ============
PT = '.workbuddy/tools/playtest/'
AR1 = "['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing']"
AR1N = "['zhuzhan', 'fujiche', 'buxingji', 'dunwei', 'daodanche']"
AR2 = "['qingji', 'tieji', 'changqiang', 'daodun', 'gongjian', 'yibing']"
AR2N = "['fujiche', 'zhuzhan', 'buxingji', 'dunwei', 'daodanche']"
AR3 = "['minfu', 'yibing', 'changqiang', 'daodun', 'gongjian', 'qingji']"
AR3N = "['banche', 'buxingji', 'dunwei', 'daodanche', 'fujiche']"
for f in ['play_600x.js', 'play_farm2_600x.js', 'play_gold_600x.js', 'play_rush_1x.js', 'play_strat_600x.js', 'play_v89118.js']:
    p = PT + f
    s = rd(p)
    if AR1 in s:
        s = s.replace(AR1, AR1N)
    if AR2 in s:
        s = s.replace(AR2, AR2N)
    if AR3 in s:
        s = s.replace(AR3, AR3N)
    # 余下 token（单点用法）
    for tok, nw in [('chihou', 'zhencha'), ('yibing', 'buxingji'), ('qingji', 'fujiche')]:
        if tok in s:
            s = s.replace(tok, nw)
    wr(p, s)
    REPORT.append('[ok] playtest.%s' % f)
rep(PT + 'play_rush_1x.js', 'rush.span-comment', '/* v89.101：城流跨越以摩托游骑为主力 */',
    '/* v89.101：城流跨越以伏击车为主力（原「摩托游骑」） */')

# ============ 7. gen/gen_gicons.js：兵种名册换代 ============
P7 = '.workbuddy/tools/gen/gen_gicons.js'
rep(P7, 'gen.troop',
"""  troop: {
    minfu: ['farmer', 'cloth'], yibing: ['swordman', 'metal'], chihou: ['spy', 'cloth'],
    changqiang: ['pikeman', 'metal'], daodun: ['checked-shield', 'metal'],
    gongjian: ['archer', 'wood'], qingji: ['cavalry', 'wood'], tieji: ['mounted-knight', 'metal'],
    zhouche: ['boat-fishing', 'wood'], chuangnu: ['crossbow', 'wood'],
    chongche: ['siege-tower', 'wood'], toudan: ['slingshot', 'wood'],
    qingzhoubing: ['guards', 'metal'], tengjiabing: ['spiked-armor', 'jade'],
    tuqibing: ['mounted-knight', 'metal'], hubaoqi: ['tiger', 'red'],
    xiliangtieqi: ['cavalry', 'red'], nanjiangxiangbing: ['elephant', 'metal'],
  },""",
"""  troop: {
    /* v89.230：随兵种重构 18→14 换代（与 js/gicons.js 现行名册逐项一致；
       未继承的 3 个键 swordman / siege-tower / guards 随之退出 needed 集合）。 */
    banche: ['farmer', 'cloth'], fujiche: ['cavalry', 'wood'], zhencha: ['spy', 'cloth'],
    yunshu: ['boat-fishing', 'wood'], buxingji: ['pikeman', 'metal'],
    dunwei: ['checked-shield', 'metal'], daodanche: ['archer', 'wood'],
    wuzhi: ['mounted-knight', 'metal'], zhuzhan: ['cavalry', 'red'],
    kuanglie: ['tiger', 'red'], dianci: ['spiked-armor', 'jade'],
    huopao: ['slingshot', 'wood'], wuren: ['crossbow', 'wood'], taitan: ['elephant', 'metal'],
  },""")

# ============ 8. show/shot_v89150b_troopfield.js ============
P8 = '.workbuddy/tools/show/shot_v89150b_troopfield.js'
rep(P8, 'shot.h1', "   ① 兵牌外框三档（步兵窄 / 骑兵中 / 器械维持）",
    "   ① 兵牌外框三档（徒步窄 / 机车中 / 器械维持 · v89.230 类名同步）\n   活体回归：兵种 id 与形态类名随换代同步（可用即复跑）。")
rep(P8, 'shot.city', "cityName: '许都'", "cityName: '灰岗'")
rep(P8, 'shot.army', "    /* 三形态齐备（步/骑/器械）+ 12 队载荷（触发 dense 档） */\n    c.army = { changqiang: 20000, daodun: 8000, gongjian: 6000, qingji: 5000, tieji: 4000, chuangnu: 3000 };",
    "    /* 三形态齐备（徒步/机车/器械）+ 多队载荷（触发 dense 档） */\n    c.army = { buxingji: 20000, dunwei: 8000, daodanche: 6000, fujiche: 5000, zhuzhan: 4000, wuren: 3000 };")
rep(P8, 'shot.exp', "{ changqiang: 12000, qingji: 5000, chuangnu: 3000 }, g.id, {});",
    "{ buxingji: 12000, fujiche: 5000, wuren: 3000 }, g.id, {});")
rep(P8, 'shot.shapes', "['inf', 'cav', 'siege'].forEach(function (sh) {", "['walk', 'ride', 'craft'].forEach(function (sh) {")
rep(P8, 'shot.chk1', "  chk('① 三档齐备（inf/cav/siege 都在场上）',\n    !!m1.units.inf && !!m1.units.cav && !!m1.units.siege, Object.keys(m1.units).join('/'));\n  if (m1.units.inf && m1.units.cav && m1.units.siege) {\n    var wi = m1.units.inf.w, wc = m1.units.cav.w, ws = m1.units.siege.w;\n    chk('① 步兵窄（28px ±2）', Math.abs(wi - 28) <= 2, wi + 'px');\n    chk('① 骑兵比步兵宽、比器械窄（32px ±2）', Math.abs(wc - 32) <= 2 && wc > wi && wc < ws, wi + ' < ' + wc + ' < ' + ws);\n    chk('① 器械维持方块（36px ±2 = 改前尺寸）', Math.abs(ws - 36) <= 2, ws + 'px');\n    chk('① 图标大小三档一致（26px —— 变的是框的留白，不是图标）',\n      m1.units.inf.ico === m1.units.cav.ico && m1.units.cav.ico === m1.units.siege.ico,\n      [m1.units.inf.ico, m1.units.cav.ico, m1.units.siege.ico].join('/'));\n  }",
    "  chk('① 三档齐备（walk/ride/craft 都在场上）',\n    !!m1.units.walk && !!m1.units.ride && !!m1.units.craft, Object.keys(m1.units).join('/'));\n  if (m1.units.walk && m1.units.ride && m1.units.craft) {\n    var wi = m1.units.walk.w, wc = m1.units.ride.w, ws = m1.units.craft.w;\n    chk('① 徒步窄（28px ±2）', Math.abs(wi - 28) <= 2, wi + 'px');\n    chk('① 机车比徒步宽、比器械窄（32px ±2）', Math.abs(wc - 32) <= 2 && wc > wi && wc < ws, wi + ' < ' + wc + ' < ' + ws);\n    chk('① 器械维持方块（36px ±2 = 改前尺寸）', Math.abs(ws - 36) <= 2, ws + 'px');\n    chk('① 图标大小三档一致（26px —— 变的是框的留白，不是图标）',\n      m1.units.walk.ico === m1.units.ride.ico && m1.units.ride.ico === m1.units.craft.ico,\n      [m1.units.walk.ico, m1.units.ride.ico, m1.units.craft.ico].join('/'));\n  }")

for line in REPORT:
    print(line)
print('批次 C 完成')
