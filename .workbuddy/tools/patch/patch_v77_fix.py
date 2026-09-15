# -*- coding: utf-8 -*-
"""v77 · 修复补丁：SHOP_CATS 补新货 / §62 转义修正 / 六处守卫收窄。
A. ui.js：SHOP_CATS 补三类新货（宝箱/秘籍/政令）；月俸 title 去掉"四维 "字样
   （e2e 两条 v75 旧断言以「四维 」为哨兵，标题文案踩线）
B. smoke：§62 双反斜杠转义修正（raw 块里多打了一层）+ 6 处守卫收窄
"""
import io, sys

UI = r'E:\Deepseekdb\js\ui.js'
SMOKE = r'E:\Deepseekdb\smoke-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    old_c = old.replace('\n', '\r\n'); new_c = new.replace('\n', '\r\n')
    if old in t:
        if t.count(old) != 1:
            print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old))); sys.exit(1)
        t = t.replace(old, new, 1)
    elif old_c in t:
        if t.count(old_c) != 1:
            print('  ✗ %s：锚点(CRLF)命中 %d 次' % (tag, t.count(old_c))); sys.exit(1)
        t = t.replace(old_c, new_c, 1)
    elif (new in t) or (new_c in t):
        print('  · %s：已改过（跳过）' % tag); return
    else:
        print('  ✗ %s：锚点不匹配' % tag); sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s' % tag)


# =====================================================================
# A1 · ui.js：SHOP_CATS 补三类新货
# =====================================================================
patch(UI,
"""  ui.SHOP_CATS = {
    material: '材料', jewel: '珠宝', attr_buff: '符类', prod_buff: '生产',
    military_buff: '军事', boost: '加速', exp: '经验', stamina: '体力',
    perm: '丹药', mount_buff: '坐骑', blueprint: '图纸',
  };""",
"""  ui.SHOP_CATS = {
    material: '材料', jewel: '珠宝', attr_buff: '符类', prod_buff: '生产',
    military_buff: '军事', boost: '加速', exp: '经验', stamina: '体力',
    perm: '丹药', mount_buff: '坐骑', blueprint: '图纸',
    /* v77（老板「丰富商场道具」）：宝箱 / 内功秘籍 / 政令（徭役令）三类新货 */
    chest: '宝箱', neigong: '秘籍', corvee: '政令',
  };""",
'A1 SHOP_CATS')

# =====================================================================
# A2 · ui.js：月俸列的 title 去掉「四维 」字样
#   （e2e 两条 v75 旧断言以「四维 」为"资质一览已撤"的哨兵串）
# =====================================================================
patch(UI,
"""        '<td class="num" title="每 7 游戏日结算一次（等级 + 四维 + 资质定价）">' +""",
"""        '<td class="num" title="每 7 游戏日结算一次（按等级、属性与资质定价）">' +""",
'A2 月俸 title')

# =====================================================================
# B1 · smoke：v77 城池切换检查（去掉已退役的 after: 'city'）
# =====================================================================
patch(SMOKE,
"""  check('v77：城池切换走下拉框 + 君主面板「进入」按钮（v22 chips 退役）',
    /city-select/.test(uS16) && /after: 'city'/.test(uS16) && /after === 'city'/.test(mS16)
    && /lord-city-enter/.test(uS16) && /lord-city-enter/.test(mS16));""",
"""  check('v77：城池切换走下拉框 + 君主面板「进入」按钮（v22 chips 退役）',
    /data-action="switch-city"/.test(uS16) && /after === 'city'/.test(mS16)
    && /lord-city-enter/.test(uS16) && /lord-city-enter/.test(mS16));""",
'B1 v77 切换检查')

# =====================================================================
# B2 · smoke：v45 下拉框计数（1 → 2）
# =====================================================================
patch(SMOKE,
"""  check('下拉框依然只有城池切换那一处（v45 定向例外未扩大）', (function () {
    var strip = function (s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''); };
    return (strip(uS40 + hS40 + mS40).match(/<select/g) || []).length === 1;
  })());""",
"""  check('下拉框两处且在册：城池切换 + 附属野地（v77 二次定向例外）', (function () {
    var strip = function (s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''); };
    var all = strip(uS40 + hS40 + mS40);
    return (all.match(/<select/g) || []).length === 2
      && /data-action="switch-city"/.test(all) && /data-action="wild-pick"/.test(all);
  })());""",
'B2 v45 计数')

# =====================================================================
# B3 · smoke：v29 数量输入框检查（下拉计数 1 → 2）
# =====================================================================
patch(SMOKE,
"""    /* 数量仍走输入框；ui.js 里唯一的下拉框只允许是城池下拉框。
       v53：**先剥注释再计数** —— 注释里解释".map 会把下拉框换掉"时写了标签名，
       计数就会多出 1（第 7 次踩同一个坑）。 */
    && (u.match(/<select/g) || []).length === 1
    && /class="city-select"/.test(u) && !/ui\\.qtyBar = function/.test(u);""",
"""    /* 数量仍走输入框；ui.js 的下拉框只允许两处：城池切换 + 附属野地（v77 在册）。
       v53：**先剥注释再计数** —— 注释里解释".map 会把下拉框换掉"时写了标签名，
       计数就会多出 1（第 7 次踩同一个坑）。 */
    && (u.match(/<select/g) || []).length === 2
    && /class="city-select"/.test(u) && /wild-select/.test(u) && !/ui\\.qtyBar = function/.test(u);""",
'B3 v29 计数甲')

patch(SMOKE,
"""    && (u.match(/<select/g) || []).length === 1 && /class="city-select"/.test(u);""",
"""    && (u.match(/<select/g) || []).length === 2 && /class="city-select"/.test(u)
    && /wild-select/.test(u);""",
'B4 v29 计数乙')

# =====================================================================
# B5 · smoke：城池名单一取值口（短名 2 → 1 处）
# =====================================================================
patch(SMOKE,
"""    /* v71（老板）：侧栏两处走短名（只显城池命名）；下拉框选项 = 全称 + 坐标 —— 防回退 */
    && (u.match(/ui\\.cityLabelHTML\\(c, true\\)/g) || []).length >= 2;""",
"""    /* v71：侧栏走短名（城池属性标题）；v77 资源区「本城」表头退役（改附属野地下拉框），
       短名仅剩一处 —— 判据随之收窄，防回退的意图不变。 */
    && (u.match(/ui\\.cityLabelHTML\\(c, true\\)/g) || []).length >= 1;""",
'B5 短名计数')

# =====================================================================
# B6 · smoke §62：raw 块里多打的一层反斜杠（\\. → \.）整段修正
# =====================================================================
t = io.open(SMOKE, encoding='utf-8', newline='').read()
i = t.find('===== 62. v77 老板八条')
j = t.find("console.log('结果：'", i)
if i < 0 or j < 0:
    print('  ✗ B6 找不到 §62 区域'); sys.exit(1)
seg = t[i:j]
n_double = seg.count('\\\\')
seg2 = seg.replace('\\\\', '\\')
t = t[:i] + seg2 + t[j:]
io.open(SMOKE, 'w', encoding='utf-8', newline='').write(t)
print('  ✓ B6 §62 转义修正（%d 处双反斜杠 → 单）' % n_double)

print('\nv77 修复补丁执行完毕。')
