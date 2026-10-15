# -*- coding: utf-8 -*-
"""v90.14 套装重设：6 档 × 3 侧重 = 18 套 · 每套 19 件。去散件。"""
SLOTS = ['head','chest','waist','arm_up_l','arm_up_r','arm_low_l','arm_low_r',
         'thigh_l','thigh_r','shin_l','shin_r','foot_l','foot_r',
         'weapon','mount','back','ring','pendant','neck']
SLOT_ZH = {'head':'观瞄','chest':'动力','waist':'平衡','arm_up_l':'左驱动臂','arm_up_r':'右驱动臂',
 'arm_low_l':'左操作臂','arm_low_r':'右操作臂','thigh_l':'左承载腿','thigh_r':'右承载腿',
 'shin_l':'左支撑腿','shin_r':'右支撑腿','foot_l':'左抓地足','foot_r':'右抓地足',
 'weapon':'右武装','mount':'机动','back':'左披风','ring':'右披风','pendant':'左武装','neck':'辐射清除'}
DEF_SLOTS = ['head','chest','waist','arm_up_l','arm_up_r','arm_low_l','arm_low_r',
             'thigh_l','thigh_r','shin_l','shin_r','foot_l','foot_r']
SIX_SLOTS = ['back','ring','pendant','neck']
TH = [3,5,7,11,15,19]

TIERS = [('coarse','粗劣',1),('fine','优良',2),('prime','精品',3),
         ('rare','稀有',4),('legend','传奇',5),('divine','机神',6)]
BASE = {1:{'sta':140,'def':90,'six':7,'atk':70,'spd':14},
        2:{'sta':260,'def':300,'six':16,'atk':260,'spd':34},
        3:{'sta':470,'def':580,'six':30,'atk':600,'spd':62},
        4:{'sta':760,'def':920,'six':48,'atk':1050,'spd':98},
        5:{'sta':1080,'def':1320,'six':72,'atk':1700,'spd':150},
        6:{'sta':1500,'def':1900,'six':105,'atk':2600,'spd':220}}
FOCUS = [('zhan','占','tong','atk'),('zhi','治','nz','def'),('ti','体','nz','sta')]
FZH = {'zhan':'占','zhi':'治','ti':'体'}
SETNAME = {1:{'zhan':'拾荒','zhi':'补丁','ti':'铁皮'},2:{'zhan':'巡逻','zhi':'工坊','ti':'装卸'},
 3:{'zhan':'猎杀','zhi':'中枢','ti':'重装'},4:{'zhan':'战团','zhi':'议会','ti':'壁垒'},
 5:{'zhan':'诸神','zhi':'智囊','ti':'不朽'},6:{'zhan':'天罚','zhi':'神谕','ti':'机体'}}

def piece_stats(q, slot, fkey, fkey2):
    b = BASE[q]; st = {}
    if slot in DEF_SLOTS:
        st['def'] = int(b['def'] * (1.25 if fkey2=='def' else (0.9 if fkey2=='atk' else 1.0)))
        st['sta'] = int(b['sta'] * (1.05 if fkey2=='sta' else 0.45))
    elif slot == 'weapon':
        st['atk'] = int(b['atk'] * (1.3 if fkey2=='atk' else 0.85))
        st['sta'] = int(b['sta'] * 0.4)
    elif slot == 'mount':
        st['spd'] = int(b['spd'] * (1.2 if fkey2=='def' else 1.0))
        st['sta'] = int(b['sta'] * 0.4)
    else:  # SIX_SLOTS
        st[fkey] = int(b['six'] * (1.7 if fkey2 in ('atk','def') else 1.2))
        st['sta'] = int(b['sta'] * 0.35)
    return st

def set_eff(q, fkey2):
    b = BASE[q]
    out = {}
    if fkey2 == 'atk':
        vals = [{3:{'tong':int(b['six']*3),'atk':int(b['atk']*2)}},
                {5:{'yw':int(b['six']*3)}},
                {7:{'atk':int(b['atk']*4),'spd':int(q*2)}},
                {11:{'tong':int(b['six']*6),'atk':int(b['atk']*6)}},
                {15:{'atk':int(b['atk']*10)}},
                {19:{'tong':int(b['six']*10),'atk':int(b['atk']*14),'spd':int(q*4)}}]
    elif fkey2 == 'def':
        vals = [{3:{'nz':int(b['six']*3),'def':int(b['def'])}},
                {5:{'zm':int(b['six']*3)}},
                {7:{'def':int(b['def']*2),'nz':int(b['six']*4)}},
                {11:{'def':int(b['def']*3)}},
                {15:{'nz':int(b['six']*8)}},
                {19:{'nz':int(b['six']*10),'def':int(b['def']*4),'zm':int(b['six']*5)}}]
    else:
        vals = [{3:{'sta':int(b['sta']),'def':int(b['def']*0.6)}},
                {5:{'sta':int(b['sta']*0.8)}},
                {7:{'sta':int(b['sta']*1.2)}},
                {11:{'sta':int(b['sta']*2)}},
                {15:{'sta':int(b['sta']*3)}},
                {19:{'sta':int(b['sta']*4),'nz':int(b['six']*6)}}]
    for i, th in enumerate(TH):
        out[th] = vals[i][th]
    return out

lines = []; sets = []; meta = []
for tid, tname, q in TIERS:
    for fid, fzh, fkey, fkey2 in FOCUS:
        sid = '%s_%s' % (tid, fid); sname = SETNAME[q][fid] + '套'
        meta.append((sid, sname, q, fzh))
        for slot in SLOTS:
            pid = '%s_%s' % (sid, slot)
            nm = SETNAME[q][fid] + SLOT_ZH[slot]
            st = piece_stats(q, slot, fkey, fkey2)
            parts = ', '.join('%s: %d' % (k, v) for k, v in st.items())
            lines.append("    %s: { id: '%s', name: '%s', set: '%s', slot: '%s', q: %d, %s }," %
                         (pid, pid, nm, sid, slot, q, parts))
        eff = set_eff(q, fkey2)
        def txt(d):
            M = {'tong':'指挥','nz':'治理','zm':'谋略','yw':'武力','atk':'攻','def':'防','spd':'速度','sta':'体力'}
            return '　'.join('%s+%d' % (M.get(k,k), v) for k,v in d.items())
        bonus = '{' + ', '.join("%d: '%s'" % (th, txt(eff[th])) for th in TH) + '}'
        effs = '{' + ', '.join("%d: %s" % (th, '{' + ', '.join('%s: %d'%(k,v) for k,v in eff[th].items()) + '}') for th in TH) + '}'
        sets.append("    %s: { name: '%s', bonus: %s, eff: %s }," % (sid, sname, bonus, effs))

out = []
out.append("  /* v90.14（老板）：套装重设 —— 6 档（粗劣/优良/精品/稀有/传奇/机神）× 3 侧重（占/治/体）")
out.append("     = 18 套 · 每套 19 件（覆盖全部机甲槽）。**散件退役**（锻造间只造套装件）。")
out.append("     老 7 套整体替换；数值参照旧套同品质量级。 */")
out.append("  DATA.SET_RANKS = [")
for tid, tname, q in TIERS:
    out.append("    { id: '%s', name: '%s', q: %d }," % (tid, tname, q))
out.append("  ];")
out.append("  DATA.SET_TIERS = [3, 5, 7, 11, 15, 19];")
out.append("  DATA.EQUIP = {")
out.extend(lines)
out.append("  };")
out.append("  DATA.SETS = {")
out.extend(sets)
out.append("  };")

open(r"E:/Deepseekdb/.workbuddy/tmp/v9014_sets.js", "w", encoding="utf-8").write('\n'.join(out))
print("sets:", len(meta), "pieces:", len(lines))
for m in meta: print(m)
