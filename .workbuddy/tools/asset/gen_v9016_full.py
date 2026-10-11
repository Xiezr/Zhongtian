# -*- coding: utf-8 -*-
"""v90.16 完整重生成：18 套 × 19 件，**每件都给六维加成**（按侧重分配），
   每档套装总六维 = 500/750/1125/1688/2531/3797（凡品500，逐档×1.5）。
   另给武器(攻)/装甲(防)少量战斗属性。SETS 档位给 攻/防 增量（六维已由件提供，不重复）。"""
SLOTS = ['head','chest','waist','arm_up_l','arm_up_r','arm_low_l','arm_low_r',
         'thigh_l','thigh_r','shin_l','shin_r','foot_l','foot_r',
         'weapon','mount','back','ring','pendant','neck']
SLOT_ZH = {'head':'观瞄','chest':'动力','waist':'平衡','arm_up_l':'左驱动臂','arm_up_r':'右驱动臂',
 'arm_low_l':'左操作臂','arm_low_r':'右操作臂','thigh_l':'左承载腿','thigh_r':'右承载腿',
 'shin_l':'左支撑腿','shin_r':'右支撑腿','foot_l':'左抓地足','foot_r':'右抓地足',
 'weapon':'右武装','mount':'机动','back':'左披风','ring':'右披风','pendant':'左武装','neck':'辐射清除'}
TIERS = [('coarse','粗劣',1),('fine','优良',2),('prime','精品',3),
         ('rare','稀有',4),('legend','传奇',5),('divine','机神',6)]
NAMES = {1:{'zhan':'拾荒','zhi':'补丁','ti':'铁皮'},2:{'zhan':'巡逻','zhi':'工坊','ti':'装卸'},
 3:{'zhan':'猎杀','zhi':'中枢','ti':'重装'},4:{'zhan':'战团','zhi':'议会','ti':'壁垒'},
 5:{'zhan':'诸神','zhi':'智囊','ti':'不朽'},6:{'zhan':'天罚','zhi':'神谕','ti':'机体'}}
TOTAL = [500, 750, 1125, 1688, 2531, 3797]
W = {'zhan':{'yw':0.40,'tong':0.20,'spd':0.15,'sta':0.15,'zm':0.05,'nz':0.05},
     'zhi':{'nz':0.40,'zm':0.20,'tong':0.10,'sta':0.15,'yw':0.05,'spd':0.10},
     'ti':{'sta':0.45,'tong':0.15,'nz':0.15,'yw':0.10,'zm':0.10,'spd':0.05}}
SIX = ['tong','nz','yw','zm','spd','sta']
# 攻/防基准（每档单件，供武器/装甲）
ATK = [10, 32, 90, 240, 620, 1500]
DEF = [9, 30, 85, 230, 590, 1430]

def six_of(focus, total):
    d = {}
    acc = 0
    for k in SIX:
        v = int(round(total * W[focus].get(k, 0)))
        if v: d[k] = v; acc += v
    main = max(W[focus], key=W[focus].get)
    d[main] = d.get(main, 0) + (total - acc)
    return d

def piece(q, slot, focus, tid):
    total_share = round(TOTAL[q - 1] / 19.0)
    st = six_of(focus, total_share)
    if slot == 'weapon':
        st['atk'] = ATK[q - 1]
    elif slot == 'mount':
        st['spd'] = st.get('spd', 0) + ATK[q - 1] // 2
    elif slot in ('head','chest','waist','arm_up_l','arm_up_r','arm_low_l','arm_low_r',
                  'thigh_l','thigh_r','shin_l','shin_r','foot_l','foot_r'):
        st['def'] = DEF[q - 1]
    return st

eq = []; sets = []
for tid, tname, q in TIERS:
    for fid in ['zhan', 'zhi', 'ti']:
        sid = '%s_%s' % (tid, fid)
        sname = NAMES[q][fid] + '套'
        for slot in SLOTS:
            pid = '%s_%s' % (sid, slot)
            nm = NAMES[q][fid] + SLOT_ZH[slot]
            st = piece(q, slot, fid, tid)
            parts = ', '.join('%s: %d' % (k, v) for k, v in st.items())
            eq.append("    %s: { id: '%s', name: '%s', set: '%s', slot: '%s', q: %d, %s }," %
                      (pid, pid, nm, sid, slot, q, parts))
        # 档位攻/防（六维已由件给，此处只补攻/防）
        eff = {}; txt = {}
        for i, th in enumerate([3,5,7,11,15,19]):
            k = 1 + i * 0.5
            eff[th] = {'atk': int(ATK[q-1] * 2 * k), 'def': int(DEF[q-1] * 2 * k)}
            txt[th] = '攻+%s　防+%s' % (format(eff[th]['atk'], ','), format(eff[th]['def'], ','))
        e = '{' + ', '.join('%d: %s' % (th, '{' + ', '.join('%s: %d' % (kk, vv) for kk, vv in eff[th].items()) + '}') for th in [3,5,7,11,15,19]) + '}'
        b = '{' + ', '.join("%d: '%s'" % (th, txt[th]) for th in [3,5,7,11,15,19]) + '}'
        sets.append("    %s: { name: '%s', bonus: %s, eff: %s }," % (sid, sname, b, e))

blk = ["  /* v90.16：18 套 × 19 件 —— **每件都给六维**（按侧重分配），每档套装总六维 =",
       "     500/750/1125/1688/2531/3797（凡品 500，逐档 ×1.5）；武器给攻、装甲给防。 */",
       "  DATA.EQUIP = {"] + eq + ["  };", "  DATA.SETS = {"] + sets + ["  };"]
open(r"E:/Deepseekdb/.workbuddy/tmp/v9016_equip.js", "w", encoding="utf-8", newline='').write('\n'.join(blk))
print('pieces', len(eq), 'sets', len(sets))
print(eq[0]); print(sets[0][:180])
