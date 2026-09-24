# -*- coding: utf-8 -*-
"""patch_v89115f_bag_tests.py — 背包四类 → 两类（装备/宝物）+ 二级分类的测试升级"""
import io, os, sys
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()
E = []

E.append((
"""    check('背包分装备/材料/宝物/图纸四类', /BAG_TABS/.test(uiSrc24) && /\\['bp', '图纸'\\]/.test(uiSrc24));""",
"""    check('背包分装备/宝物两大类（v89.115 老板令：宝物按商城分类检索）', /BAG_TABS/.test(uiSrc24)
      && /\\['equip', '装备'\\]/.test(uiSrc24) && /\\['treasure', '宝物'\\]/.test(uiSrc24)
      && /bagSubChipsHTML/.test(uiSrc24));"""))

E.append((
"""  check('背包四页签（装备/材料/宝物/图纸）', /BAG_TABS = \\[\\['equip'/.test(uiS) && /\\['bp', '图纸'\\]/.test(uiS));
  check('每个页签有独立排序项', /equip: \\[\\['q'/.test(uiS) && /mat: \\[\\['series'/.test(uiS)
    && /item: \\[\\['type'/.test(uiS) && /bp: \\[\\['val'/.test(uiS));""",
"""  check('背包两类页签（装备/宝物）', /BAG_TABS = \\[\\['equip', '装备'\\], \\['treasure', '宝物'\\]\\]/.test(uiS));
  check('装备/宝物各有排序项（宝物含 类型/系列/品阶/价值/数量）', /equip: \\[\\['q'/.test(uiS)
    && /treasure: \\[\\['type'/.test(uiS) && /series', '系列'/.test(uiS) && /tier', '品阶'/.test(uiS));"""))

E.append((
"""check('背包装备/材料/图纸/宝物四页都分页', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return ['bag-equip', 'bag-mat', 'bag-bp', 'bag-item'].every(function (k) {
    return new RegExp("ui\\\\.page(?:Bag|Rows)\\\\('" + k + "'").test(u);
  }) && /ui\\.pageRows = function/.test(u);
})());""",
"""check('背包装备/宝物各二级分类都分页（分页 key 随分类区分）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  /* v89.115：宝物页顶层仍走 bag-item-<分类>（材料 bag-mat / 图纸 bag-bp 专属渲染） */
  return ['bag-equip', 'bag-mat', 'bag-bp', 'bag-item'].every(function (k) {
    return new RegExp("ui\\\\.page(?:Bag|Rows)\\\\('" + k).test(u);
  }) && /ui\\.pageRows = function/.test(u)
    && /'bag-item-' \\+ \\(onlyType/.test(u);
})());"""))

for i, (old, new) in enumerate(E):
    n = s.count(old)
    if n != 1:
        print('!! 段 %d 匹配 %d 次\n   首行: %s' % (i + 1, n, old.split('\n')[0][:80])); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ 段 %d' % (i + 1))
tmp = P + '.tmp115f'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('DONE')
