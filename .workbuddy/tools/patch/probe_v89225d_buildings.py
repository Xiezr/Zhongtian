# -*- coding: utf-8 -*-
# v89.225 探针 D：建筑 series 归属全表 + ser- 消费点 + 旗/图标素材现状
import io, re, os, time

def rd(p):
    return io.open('E:/Deepseekdb/' + p, encoding='utf-8', newline='').read()

d = rd('js/data.js')

print('=== DATA.SERIES_OF 段 ===')
i = d.find('DATA.SERIES_OF =')
print(d[i:i+500])

print()
print('=== 建筑表：id / name / series 全量 ===')
i = d.find('DATA.BUILDINGS = {')
j = d.find('\n};', i)
seg = d[i:j]
# 建筑条目形态可能是 id: { name: '...', series: '...' 或多字段
for m in re.finditer(r"(\w+):\s*\{[^}]*?name:\s*'([^']+)'[^}]*?series:\s*'(\w+)'", seg):
    print('  %-14s %-10s %s' % (m.group(1), m.group(3), m.group(2)))
print()
print('  建筑总数: %d' % len(re.findall(r"^\s{4}(\w+):\s*\{", seg, re.M)))

print()
print('=== ui.js 里 ser- 的消费点 ===')
u = rd('js/ui.js')
for i2, ln in enumerate(u.split('\n'), 1):
    if 'ser-' in ln or "'ser'" in ln or 'series' in ln:
        print('  L%d %s' % (i2, ln.strip()[:180]))

print()
print('=== index.html 里 ser- 全量（含注释） ===')
h = rd('index.html')
for i2, ln in enumerate(h.split('\n'), 1):
    if 'ser-' in ln:
        print('  L%d %s' % (i2, ln.strip()[:180]))
print('  (count=%d)' % h.count('ser-'))

print()
print('=== 素材管线现状（mtime） ===')
for p in ['assets/icons/ui', '.workbuddy/tools/asset/flag_bldg_icons.py']:
    fp = 'E:/Deepseekdb/' + p
    if os.path.isdir(fp):
        files = os.listdir(fp)
        print('%s: %d 个文件' % (p, len(files)))
        # 最近 mtime
        latest = sorted(files, key=lambda f: os.path.getmtime(os.path.join(fp, f)), reverse=True)[:6]
        for f in latest:
            mt = time.strftime('%m-%d %H:%M', time.localtime(os.path.getmtime(os.path.join(fp, f))))
            print('   %s  %s' % (mt, f))
    elif os.path.isfile(fp):
        mt = time.strftime('%m-%d %H:%M', time.localtime(os.path.getmtime(fp)))
        print('%s: exists, mtime %s' % (p, mt))
    else:
        print('%s: NOT FOUND' % p)

print()
print('=== js 与 assets 最近改动（近 6 小时） ===')
now = time.time()
for root in ['js', 'assets/icons/ui', '.']:
    fp = 'E:/Deepseekdb/' + root
    try:
        for f in os.listdir(fp):
            f2 = os.path.join(fp, f)
            if os.path.isfile(f2) and now - os.path.getmtime(f2) < 6 * 3600:
                mt = time.strftime('%m-%d %H:%M', time.localtime(os.path.getmtime(f2)))
                print('   %s  %s/%s' % (mt, root, f))
    except Exception as e:
        pass
