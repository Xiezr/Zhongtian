# -*- coding: utf-8 -*-
# v89.136 批2-a：ui.js 三行同构（体力/精力/忠诚）+ index.html CSS（数值列固定 · 进度条等长）
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

u = rd('js/ui.js')

# ============================================================
# ① 体力行：只显示当前值 + 数值列定宽
# ============================================================
old1 = """        + '\\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）">体力 <b>'
        + U.numText(staNow, 0) + '</b>/' + U.numText(staMx, 0) + bar(staPct, '#6a9a4a') +"""
new1 = """        + '\\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）">体力 <b class="gd-num">'
        + U.numText(staNow, 0) + '</b>' + bar(staPct, '#6a9a4a') +"""
assert u.count(old1) == 1, '体力行锚点 = ' + str(u.count(old1))
u = u.replace(old1, new1)

# ============================================================
# ② 精力行：只显示当前值 + 数值列定宽 + 悬停补当前/上限
# ============================================================
old2 = """      '<div class="gd-line" title="' + U.escape(energyTip) + '">精力 <b>' + U.numText(enNow, 0) + '</b>/' +
        U.numText(enMx, 0) +
        bar(enNow / Math.max(1, enMx) * 100, '#4a9be0') +"""
new2 = """      '<div class="gd-line" title="' + U.escape('精力 ' + U.numText(enNow, 0) + ' / ' + U.numText(enMx, 0)
        + '（当前 / 上限）\\n' + energyTip) + '">精力 <b class="gd-num">' + U.numText(enNow, 0) + '</b>' +
        bar(enNow / Math.max(1, enMx) * 100, '#4a9be0') +"""
assert u.count(old2) == 1, '精力行锚点 = ' + str(u.count(old2))
u = u.replace(old2, new2)

# ============================================================
# ③ 忠诚行：同构（＋ 替 🎁 赏赐 · 数值定宽 · 悬停说明）
# ============================================================
old3 = """      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>');"""
new3 = """      /* v89.136（老板 3）：「体力，精力和忠诚的进度条按钮等长，位置统一，加号显示在最右端」——
         忠诚行与另两行完全同构：数值定宽 + 条等长 + 右端「＋」（原「🎁 赏赐」收进悬停说明）。 */
      '<div class="gd-line" title="忠诚 ' + loy + ' / 100（当前 / 上限）\\n赏赐珠宝可提升忠诚'
        + (loy < DATA.LOYALTY.warnAt ? '；当前偏低，谨防离心' : '') + '">忠诚 <b class="gd-num" style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm gd-plus' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">＋</button></div>');"""
assert u.count(old3) == 1, '忠诚行锚点 = ' + str(u.count(old3))
u = u.replace(old3, new3)

# 顶部注释更新（三行同构说明 · 放在体力行注释处）
old4 = """         v89.133（老板）：「将领的生命，体力行压缩成 1 行，只显示数值 XX/XX 和加号，
         '当前 5,673'这个备注不要，'全军生命 +70%'这个备注悬停显示」——
         主数字改「当前 / 上限」（实机实测：旧形态 h=46px 折成两行 → 现单行），
         两个文字备注全部进悬停（上限构成 + 全军生命 + 回复规则）。 */"""
new4 = """         v89.133（老板）：「将领的生命，体力行压缩成 1 行」；v89.136（老板 3）：
         「体力精力**只显示当前值**，进度条和加号按钮 —— 体力、精力和忠诚的进度条按钮等长，
         位置统一（不因数值变化而变化，给数值预留足够位置），加号显示在最右端」——
         定稿形态 = 三行同构：`标签 [当前值·定宽 60px] [进度条·定长 132px] …… [＋·贴右]`，
         上限/构成/全军生命/回复规则全部在悬停（.gd-num / .gd-line .gd-bar 见 index.html）。 */"""
assert u.count(old4) == 1, '注释锚点 = ' + str(u.count(old4))
u = u.replace(old4, new4)

# ---------- 写后自检 ----------
for sent in ['体力 <b class="gd-num">', '精力 <b class="gd-num">',
             '忠诚 <b class="gd-num"', '>＋</button></div>']:
    assert u.count(sent) >= 1, '丢失哨兵: ' + sent
assert "</b>/' + U.numText(staMx" not in u, '体力行 XX/XX 残留'
assert '🎁 赏赐</button>' not in u, '赏赐旧形态残留'

wr('js/ui.js', u)
print('OK · ui.js', len(u))

# ============================================================
# ④ index.html CSS
# ============================================================
h = rd('index.html')
old5 = """  .gd-bar i { display: block; height: 100%; border-radius: var(--r-sm); transition: width .3s; }"""
new5 = """  .gd-bar i { display: block; height: 100%; border-radius: var(--r-sm); transition: width .3s; }
  /* v89.136（老板 3）：体力/精力/忠诚三行同构 —— 数值列固定宽（位数变化不挪位）、
     进度条等长（132px）；按钮贴右沿用既有 .gd-line .gd-plus（margin-left:auto）。 */
  .gd-line .gd-num { flex: none; width: 60px; }
  .gd-line .gd-bar { flex: none; width: 132px; }"""
assert h.count(old5) == 1, 'gd-bar CSS 锚点 = ' + str(h.count(old5))
h = h.replace(old5, new5)
wr('index.html', h)
print('OK · index.html', len(h))
