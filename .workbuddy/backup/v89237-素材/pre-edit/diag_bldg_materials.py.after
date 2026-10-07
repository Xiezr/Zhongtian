# -*- coding: utf-8 -*-
"""诊断：原图（_gold_backup）与现图，各自的**图内色相结构** ——
判据不是"哪个色相"，而是"这一幅画里有没有材质层次"。
一栋真实建筑（木/瓦/石/墙/彩绘）在色相上应该散开；若整幅只有一个色相，
那不管染成什么颜色，看起来都像"单色剪影" —— 这才是"颜色不对劲"的硬证据。
"""
import os, sys, math, colorsys
from PIL import Image

R = r'E:/Deepseekdb/assets/icons/ui'
BAK = os.path.join(R, '_gold_backup')

# v89.237：_gold_backup 已随素材清理移出（可恢复）——本诊断需要“原图 vs 现图”，缺原图即无意义。
if not os.path.isdir(BAK):
    sys.exit('[v89.237] _gold_backup 不在素材区（17:41 清理移出），无原图可对比。\n'
             '  恢复：git checkout HEAD -- assets/icons/ui/_gold_backup'
             '（或 .workbuddy/backup/v89237-素材/gold_backup/）')
IDS = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'cangku', 'shichang',
       'zhaoxianguan', 'kezhan', 'tiejiangpu', 'majiu', 'yizhan', 'honglusi',
       'gongjiangzuofang', 'fenghuotai', 'chengqiang']


def stats(path, step=6):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    bins = [0] * 12                       # 30° 一档
    sats, lums, n = [], [], 0
    hues = []
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b, a = px[x, y]
            if a <= 32:
                continue
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            n += 1
            sats.append(ss); lums.append(ll)
            if ss > 0.12:
                hues.append(hh * 360)
                bins[int(hh * 360 / 30) % 12] += 1
    if not hues:
        return None
    # 色相离散度：单位向量合成长度 → 圆标准差（0 = 完全一致，大 = 散开）
    sx = sum(math.cos(math.radians(h)) for h in hues) / len(hues)
    sy = sum(math.sin(math.radians(h)) for h in hues) / len(hues)
    Rl = math.hypot(sx, sy)
    spread = math.degrees(math.sqrt(max(0.0, -2 * math.log(max(Rl, 1e-9)))))
    # 有意义的档数（占比 ≥8% 的 30° 档）
    tot = sum(bins)
    real = sum(1 for b in bins if b / tot >= 0.08)
    return dict(n=n, spread=spread, bins=bins, hues=len(hues),
                sat=sum(sats) / len(sats), lum=sum(lums) / len(lums),
                colored=len(hues) / n, real=real)


print('%-17s %-28s %s' % ('建筑', '原图（旧币版）', '现图（v89.106 定稿）'))
print('%-17s %-28s %s' % ('', '色散° 彩像素% 实档', '色散° 彩像素% 实档'))
rows = []
for bid in IDS:
    a = stats(os.path.join(BAK, 'ai_%s.png' % bid))
    b = stats(os.path.join(R, 'ai_%s.png' % bid))
    rows.append((bid, a, b))
    print('%-17s %5.0f° %5.0f%% %4d        %5.0f° %5.0f%% %4d'
          % (bid, a['spread'], a['colored'] * 100, a['real'], b['spread'], b['colored'] * 100, b['real']))

sp_a = sum(x[1]['spread'] for x in rows) / len(rows)
sp_b = sum(x[2]['spread'] for x in rows) / len(rows)
ca = sum(x[1]['colored'] for x in rows) / len(rows)
cb = sum(x[2]['colored'] for x in rows) / len(rows)
ra = sum(x[1]['real'] for x in rows) / len(rows)
rb = sum(x[2]['real'] for x in rows) / len(rows)
print('\n平均：原图 色散 %.0f° · 彩像素 %.0f%% · 有效色档 %.1f 档'
      % (sp_a, ca * 100, ra))
print('      现图 色散 %.0f° · 彩像素 %.0f%% · 有效色档 %.1f 档'
      % (sp_b, cb * 100, rb))
print('\n判读：色散 < 25° 或 有效色档 ≤ 2 → 这一幅基本是"单色剪影"（材质层次没有被画出来）。')
print('      一张图如果只有一个色相，那么染成任何颜色，都只会是"染过色的单色块"。')
