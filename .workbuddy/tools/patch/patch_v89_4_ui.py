# -*- coding: utf-8 -*-
"""v89.4 UI —— js/ui.js：jianghuHTML 按 (x,y) 取分布 + 荒僻空态 + 等级收益行"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()
applied = 0

def rep(old, new, tag):
    global d, applied
    if new in d:
        print('SKIP', tag, '（已落）')
        return
    c = d.count(old)
    if c != 1:
        raise SystemExit('!! %s 锚点异常（出现 %d 次）' % (tag, c))
    d = d.replace(old, new, 1)
    applied += 1
    print('OK', tag)

# ① 分布取值（x,y）+ 去掉「无活动即隐藏」的早退
rep(
r"""    var acts = GAME.jianghuActsAt(tile.terrain);
    if (!acts.length) return '';""",
r"""    var acts = GAME.jianghuActsAt(x, y);   /* v89.4：逐地分布（同格恒同貌） */""",
'① 分布取值')

# ② 标题下加「等级 · 难度 × · 收益 ×」行
rep(
r"""    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 每事每日一次 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">江湖诸事皆由君主亲历：讨伐切磋、采药静修、拜访奇人——点开即入全屏剧情，精华用于蕴养修炼装备。</div>';""",
r"""    /* v89.4：野地生态 —— 逐地随缘（荒僻 / 1~3 事）· 等级联动（难度 / 收益） */
    var lv4 = GAME.map.wildLevelNow(x, y);
    var sp4 = DATA.JH_SPREAD || {};
    var lvN4 = 1 + lv4 * (sp4.lvNeed || 0), lvR4 = 1 + lv4 * (sp4.lvRew || 0);
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 逐地随缘而生 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">野地 Lv' + lv4 +
        ' · 难度 ×' + lvN4.toFixed(1) + ' · 收益 ×' + lvR4.toFixed(1) +
        '　—— 江湖诸事随缘而现，精华用于蕴养修炼装备</div>';""",
'② 等级收益行')

# ③ 荒僻空态（无活动不再隐藏区块）
rep(
r"""    if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">君主不在此城 —— 江湖之事，需君主亲至。</div>';
    } else {""",
r"""    if (!acts.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0;">此处野地荒僻，暂无江湖之事 —— 野地之事随缘而现，换一处看看。</div>';
    } else if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">君主不在此城 —— 江湖之事，需君主亲至。</div>';
    } else {""",
'③ 荒僻空态')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('ui.js 完成：应用 %d 处' % applied)
