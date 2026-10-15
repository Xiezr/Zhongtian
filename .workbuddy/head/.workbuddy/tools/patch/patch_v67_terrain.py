# -*- coding: utf-8 -*-
"""收口：退役最后一张地形位图 ai_terrain_city.png + 重生成注册表 + 收紧断言。

不变量（写进 smoke）：**`ai_terrain_*.png` 一张都不该再有** ——
地图地形自 v67 起全部走程序化绘制（老板删掉这批素材的正当后果）。
留着任何一张都会变成"某几种地形是贴图、其余手绘"的不一致状态。
"""
import io, os, re, subprocess
from send2trash.win.legacy import send2trash as trash

ROOT = r'E:\Deepseekdb'
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
UI = os.path.join(ROOT, 'assets', 'icons', 'ui')

# ① 删最后一张
t = os.path.join(UI, 'ai_terrain_city.png')
if os.path.exists(t):
    try:
        trash(os.path.normpath(t))
    except Exception as e:
        print('   接口抛 %s（判据只看文件在不在）' % type(e).__name__)
    assert not os.path.exists(t), '删除失败'
    print('① → 回收站 ai_terrain_city.png')
else:
    print('① （已不在）')
left = [f for f in os.listdir(UI) if f.startswith('ai_terrain_')]
print('   ai_terrain_* 残留：', left or '无')

# ② 重生成注册表
r = subprocess.run([NODE, '.workbuddy/tools/gen_bitmaps.js'], cwd=ROOT,
                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
print('② 注册表：', r.stdout.decode('utf-8', 'replace').strip().replace('\n', ' | '))
b = io.open(os.path.join(ROOT, 'js', 'bitmaps.js'), encoding='utf-8', newline='').read()
if '.workbuddy/tmp/gen_bitmaps.js' in b:
    b = b.replace('.workbuddy/tmp/gen_bitmaps.js', '.workbuddy/tools/gen_bitmaps.js')
    io.open(os.path.join(ROOT, 'js', 'bitmaps.js'), 'w', encoding='utf-8', newline='').write(b)
    print('   表头路径已改 tools/')
reg = set(re.findall(r'F\["([^"]+)"\]', b))
disk = set(f for f in os.listdir(UI) if f.endswith('.png'))
print('   注册表 %d · 磁盘 %d · 缺失 %d · 孤儿 %d' % (len(reg), len(disk), len(reg - disk), len(disk - reg)))
assert not (reg - disk) and not (disk - reg)

# ③ 收紧 smoke 断言：不变量 = 地形组不再有位图
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, encoding='utf-8', newline='').read()
old = """  check('已按决定删除：12 张未接线图标不再存在于 ui/',
    ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));"""
new = """  check('不变量：地形位图一张都不剩（地形全走程序化绘制，不留一半贴图一半手绘）', (function () {
    var ui = path.join(__dirname, 'assets', 'icons', 'ui');
    var left = fs.readdirSync(ui).filter(function (f) { return f.indexOf('ai_terrain_') === 0; });
    return left.length === 0;
  })());
  check('已按决定删除：地图/城池那 12 个 key 都没有素材文件',
    ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));"""
assert s.count(old) == 1, s.count(old)
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('③ smoke 断言已收紧（地形组必须为空 + 12 key 无素材）')
