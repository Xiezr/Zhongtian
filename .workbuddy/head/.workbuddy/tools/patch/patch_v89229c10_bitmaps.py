# -*- coding: utf-8 -*-
"""v89.229c10：兵种位图随 18→14 换代（原型继承 · 一次性搬运 + 登记表重生成）

背景：`assets/icons/ui/ai_<troopId>.png` 与 `js/bitmaps.js` 都按**旧 id** 命名 →
兵种重构后 14 个新 id 全部查不到位图 → 静默回退矢量层（观感退化 + ① 俘虏营明细断言翻红）。
做法：按 `GAME.TROOP_MAP_229` 的**原型**把旧 PNG 复制为新 id（每个新 id 取它的数值原型那张），
      旧 PNG 整批备份后移除（不留第二份死素材），登记表按目录重生成（保持原头部/尾部）。
"""
import io, os, shutil, sys, re

ROOT = r'E:\Deepseekdb'
UI = os.path.join(ROOT, 'assets', 'icons', 'ui')
BAK = os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9', 'troop_png')
BM = os.path.join(ROOT, 'js', 'bitmaps.js')
os.makedirs(BAK, exist_ok=True)

# 新 id ← 原型（数值原型的旧 id）
PROTO = {
    'banche': 'minfu', 'fujiche': 'qingji', 'zhencha': 'chihou', 'yunshu': 'zhouche',
    'buxingji': 'changqiang', 'dunwei': 'daodun', 'daodanche': 'gongjian', 'wuzhi': 'tuqibing',
    'zhuzhan': 'xiliangtieqi', 'kuanglie': 'hubaoqi', 'dianci': 'tengjiabing',
    'huopao': 'toudan', 'wuren': 'chuangnu', 'taitan': 'nanjiangxiangbing',
}
OLD = ['minfu', 'yibing', 'chihou', 'changqiang', 'daodun', 'gongjian', 'qingji', 'tieji',
       'zhouche', 'chuangnu', 'chongche', 'toudan', 'qingzhoubing', 'tengjiabing',
       'tuqibing', 'hubaoqi', 'xiliangtieqi', 'nanjiangxiangbing']

LOG = []
# ① 备份旧图（全部 18 张）
for o in OLD:
    src = os.path.join(UI, 'ai_%s.png' % o)
    if os.path.exists(src) and not os.path.exists(os.path.join(BAK, 'ai_%s.png' % o)):
        shutil.copy2(src, os.path.join(BAK, 'ai_%s.png' % o))
LOG.append('备份旧兵种图 %d 张 → %s' % (len(OLD), BAK))

# ② 复制原型 → 新 id
made = 0
for new, old in PROTO.items():
    s = os.path.join(UI, 'ai_%s.png' % old)
    d = os.path.join(UI, 'ai_%s.png' % new)
    if not os.path.exists(s):
        LOG.append('!!! 缺原型图 ' + s); continue
    if not os.path.exists(d):
        shutil.copy2(s, d); made += 1
LOG.append('新增新 id 图 %d 张' % made)

# ③ 移除旧图（只删兵种类，保留 ai_city_*/ai_item_* 等）
rm = 0
for o in OLD:
    p = os.path.join(UI, 'ai_%s.png' % o)
    if os.path.exists(p):
        os.remove(p); rm += 1
LOG.append('移除旧 id 图 %d 张（已备份）' % rm)

# ④ 重生成 js/bitmaps.js 的 F 表（保留头部注释与 PREFIX 段）
with io.open(BM, 'r', encoding='utf-8', newline='') as f:
    s = f.read()
files = sorted([x for x in os.listdir(UI) if x.endswith('.png')])
head_end = s.index('  var F = {};') + len('  var F = {};')
tail_start = s.index('  var PREFIX = {')
new_f = '\n' + ''.join('  F["%s"] = 1;\n' % x for x in files)
s2 = s[:head_end] + new_f + s[tail_start:]
s2 = re.sub(r'count: \d+,', 'count: %d,' % len(files), s2)
with io.open(BM, 'w', encoding='utf-8', newline='') as f:
    f.write(s2)
LOG.append('登记表重生成：目录 %d 张图（原表末行 count 已同步）' % len(files))

# ⑤ 自检
with io.open(BM, 'r', encoding='utf-8', newline='') as f:
    s3 = f.read()
miss = [x for x in PROTO if ('F["ai_%s.png"] = 1;' % x) not in s3]
left = [x for x in OLD if ('F["ai_%s.png"] = 1;' % x) in s3]
if miss:
    LOG.append('!!! 新 id 未入表：' + ','.join(miss))
if left:
    LOG.append('!!! 旧 id 仍在表：' + ','.join(left))
LOG.append('自检：新 14 全在册' if not miss else '自检失败')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c10_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
