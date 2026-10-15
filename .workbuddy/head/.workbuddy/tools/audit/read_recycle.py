# -*- coding: utf-8 -*-
"""解析 E: 回收站的 $I 元数据，列出"刚刚被删的原始路径"。
$I 结构（Win10）：8B 头 + 8B 文件大小 + 8B 删除时间(FILETIME) + 4B 路径长度 + UTF-16LE 路径 + \\0
"""
import os, time, struct

rb = 'E:' + os.sep + '$RECYCLE.BIN'
now = time.time()
rows = []
for sid in os.listdir(rb):
    sp = os.path.join(rb, sid)
    if not os.path.isdir(sp):
        continue
    for f in os.listdir(sp):
        if not f.startswith('$I'):
            continue
        fp = os.path.join(sp, f)
        try:
            b = open(fp, 'rb').read()
        except OSError:
            continue
        if len(b) < 28:
            continue
        size = struct.unpack('<Q', b[8:16])[0]
        ft = struct.unpack('<Q', b[16:24])[0]
        try:
            when = ft / 1e7 - 11644473600
        except Exception:
            when = 0
        plen = struct.unpack('<I', b[24:28])[0]
        raw = b[28:28 + plen * 2]
        path = raw.decode('utf-16-le', 'replace').rstrip('\x00')
        rows.append((when, size, path, sp, f))

rows.sort(reverse=True)
print('可解析条目: %d' % len(rows))
print()
print('=== 近 6 小时被删的原始路径 ===')
n = 0
for when, size, path, sp, f in rows:
    if now - when > 6 * 3600:
        continue
    n += 1
    print('   %s  %9s  %s' % (time.strftime('%m-%d %H:%M', time.localtime(when)) if when > 0 else '??',
                              ('%.0fKB' % (size / 1024)) if size else 'DIR/0',
                              path))
print()
print('近 6 小时合计: %d 项' % n)
print()
print('=== 与本次要删的 19 项对照 ===')
want = ['_gold_backup', '_old_iso', '_old_terra', '_old_terra_v46', '_old_terra_v47',
        '_old_terra_v48', '_old_terra_v49', 'ai_city_capital.png', 'ai_city_county.png',
        'ai_city_jun.png', 'ai_city_zhou.png', 'ai_fort.png', 'ai_terrain_caoyuan.png',
        'ai_terrain_desert.png', 'ai_terrain_forest.png', 'ai_terrain_hill.png',
        'ai_terrain_lake.png', 'ai_terrain_meadow.png', 'ai_terrain_zhaoze.png']
paths = [r[2] for r in rows if now - r[0] <= 6 * 3600]
for w in want:
    hit = [p for p in paths if p.endswith(w) or (os.sep + w + os.sep) in p]
    print('   %-26s %s' % (w, hit[0] if hit else '— 未被删'))
