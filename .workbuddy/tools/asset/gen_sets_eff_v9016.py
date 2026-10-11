# -*- coding: utf-8 -*-
"""v90.16 套装六维重算：每级(件数档)总六维 = 凡品 500，逐级 ×1.5。
  档位 3/5/7/11/15/19 → 500 / 750 / 1125 / 1688 / 2531 / 3797。
  按侧重分配到六维（指挥/治理/武力/谋略/速度/体力）。"""
TIERS = [3, 5, 7, 11, 15, 19]
BASE = 500
TOT = [round(BASE * (1.5 ** i)) for i in range(6)]   # 500,750,1125,1688,2531,3797
# 侧重权重（和为 1）
W = {
 'zhan': {'yw': 0.40, 'tong': 0.20, 'spd': 0.15, 'sta': 0.15, 'zm': 0.05, 'nz': 0.05},
 'zhi':  {'nz': 0.40, 'zm': 0.20, 'tong': 0.10, 'sta': 0.15, 'yw': 0.05, 'spd': 0.10},
 'ti':   {'sta': 0.45, 'tong': 0.15, 'nz': 0.15, 'yw': 0.10, 'zm': 0.10, 'spd': 0.05},
}
MIAN = {'tong': '指挥', 'nz': '治理', 'yw': '武力', 'zm': '谋略', 'spd': '速度', 'sta': '体力'}
ORDER = ['tong', 'nz', 'yw', 'zm', 'spd', 'sta']   # 输出顺序

def dist(focus, total):
    """把 total 按焦点权重分到六维，整数化（余数补到主项）。"""
    w = W[focus]
    out = {}
    acc = 0
    for k in ORDER:
        v = int(round(total * w.get(k, 0)))
        out[k] = v; acc += v
    # 余数补到主项
    main = max(w, key=w.get)
    out[main] += (total - acc)
    for k in list(out):
        if out[k] == 0: del out[k]
    return out

NAMES = {1:{'zhan':'拾荒','zhi':'补丁','ti':'铁皮'},2:{'zhan':'巡逻','zhi':'工坊','ti':'装卸'},
 3:{'zhan':'猎杀','zhi':'中枢','ti':'重装'},4:{'zhan':'战团','zhi':'议会','ti':'壁垒'},
 5:{'zhan':'诸神','zhi':'智囊','ti':'不朽'},6:{'zhan':'天罚','zhi':'神谕','ti':'机体'}}
TNAME = {1:'coarse',2:'fine',3:'prime',4:'rare',5:'legend',6:'divine'}
lines = []
for q in range(1, 7):
    tid = TNAME[q]
    for fid in ['zhan', 'zhi', 'ti']:
        sid = '%s_%s' % (tid, fid)
        sname = NAMES[q][fid] + '套'
        eff = {}; txt = {}
        for i, th in enumerate(TIERS):
            d = dist(fid, TOT[i])
            eff[th] = d
            txt[th] = '　'.join('%s+%s' % (MIAN[k], format(v, ',')) for k, v in d.items())
        e = '{' + ', '.join('%d: %s' % (th, '{' + ', '.join('%s: %d' % (k, v) for k, v in eff[th].items()) + '}') for th in TIERS) + '}'
        b = '{' + ', '.join("%d: '%s'" % (th, txt[th]) for th in TIERS) + '}'
        lines.append("    %s: { name: '%s', bonus: %s, eff: %s }," % (sid, sname, b, e))
open(r"E:/Deepseekdb/.workbuddy/tmp/sets_eff_v9016.js", "w", encoding="utf-8", newline='').write('\n'.join(lines))
print('totals', TOT)
print(lines[0][:200])
