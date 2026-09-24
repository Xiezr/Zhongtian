# -*- coding: utf-8 -*-
"""v89.116 §96 断言修正（五处）：剥注释取 CSS / 篇名计数 / 快购用途判据 / autoHeal 出口 / 退役判据"""
import io, os, sys

P2 = 'E:/Deepseekdb/smoke-test.js'
t = io.open(P2, encoding='utf-8').read()

FIX = [
    # 1+2) 字号判据：先剥注释再取 CSS 块（新说明里就写了 .sg-t / .btn.xs）
    ("""      var t = cssBlock(h96, '.sg-cell .sg-t');
      var b = cssBlock(h96, '.btn.xs');
      var fsOf = function (blk) {
        var m = blk.match(/font-size:\\s*var\\(--(fs-[a-z0-9]+)\\)/);
        if (!m) return 0;
        var v = h96.match(new RegExp('--' + m[1] + ':\\\\s*(\\\\d+)px'));
        return v ? Number(v[1]) : 0;
      };""",
     """      /* ⚠️ 必须先剥注释再取 CSS 块：新写的说明里就提到了 `.sg-t` 与 `.btn.xs`，
         不剥的话 indexOf 命中的是注释里那几个字（本项目踩过四次的坑）。 */
      var hc = stripComment(h96);
      var t = cssBlock(hc, '.sg-cell .sg-t');
      var b = cssBlock(hc, '.btn.xs');
      var fsOf = function (blk) {
        var m = blk.match(/font-size:\\s*var\\((--fs-[a-z0-9]+)\\)/);
        if (!m) return 0;
        var v = hc.match(new RegExp(m[1] + ': (\\\\d+)px'));
        return v ? Number(v[1]) : 0;
      };"""),
    # 3) 篇名计数：title 属性 + 正文各一份 → 只数正文那一份
    ("""        var lit1 = (h1.match(/第\\d+篇逸闻/g) || []).length;""",
     """        /* 篇名在 `title=` 属性与正文各出现一次 → 只数**书名号里的正文**那一份 */
        var lit1 = (h1.match(/《第\\d+篇逸闻》/g) || []).length;"""),
    ("""        var lit2 = (h2.match(/第\\d+篇逸闻/g) || []).length;""",
     """        var lit2 = (h2.match(/《第\\d+篇逸闻》/g) || []).length;"""),
    # 4) 快购用途判据（train 实测 6 件，不止韩信两件）
    ("""      var t = G.ui.qbScopeItemsOf('boost', 'train');
      var b = G.ui.qbScopeItemsOf('boost', 'build');
      var all = G.ui.qbScopeItemsOf('boost', null);
      return t.length === 2 && t.every(function (x) { return x.target === 'train'; })
        && t[0].id === 'hanxin_sanpian' && t[1].id === 'hanxin_dianbing'
        && b.every(function (x) { return x.target === 'build'; })
        && all.length > t.length && all.length >= 8;""",
     """      var tr = G.ui.qbScopeItemsOf('boost', 'train');
      var bd = G.ui.qbScopeItemsOf('boost', 'build');
      var all = G.ui.qbScopeItemsOf('boost', null);
      var ids = tr.map(function (x) { return x.id; });
      /* 正向判据：训练两件宝物在列；**没有一件**是别的用途混进来 */
      return tr.length >= 2 && tr.every(function (x) { return x.target === 'train'; })
        && ids.indexOf('hanxin_sanpian') >= 0 && ids.indexOf('hanxin_dianbing') >= 0
        && ids.indexOf('luban_canye') < 0 && ids.indexOf('mojia_canjuan') < 0
        && ids.indexOf('jixingjunling') < 0
        && bd.length >= 3 && bd.every(function (x) { return x.target === 'build'; })
        && bd.every(function (x) { return ids.indexOf(x.id) < 0; })
        && all.length > tr.length + bd.length && all.length >= 8;"""),
    # 5) 触发记录：由 autoHeal 落，不是 battle.heal
    ("""        var r = GAME.battle.heal();
        var log = s.autoHealLog || [];
        var rec = log[0] || {};
        var his = G.ui.autoHealLogHTML();
        return r.ok && r.back === 800 && r.backBy && r.backBy.yibing === 500 && r.backBy.gongjian === 300
          && log.length === 1 && rec.n === 800 && rec.by.yibing === 500 && /义兵/.test(his) && /弓/.test(his);""",
     """        var r = GAME.autoHeal();     /* ← 记录由 autoHeal 落（battle.heal 只管"治"那半） */
        var log = s.autoHealLog || [];
        var rec = log[0] || {};
        var his = G.ui.autoHealLogHTML();
        return !!r && r.ok && r.back === 800 && r.backBy && r.backBy.yibing === 500
          && r.backBy.gongjian === 300
          && log.length === 1 && rec.n === 800 && rec.by.yibing === 500
          && /义兵/.test(his) && /弓/.test(his) && /800/.test(his);"""),
    # 6) 退役判据：墓碑注释里写了 ui.btCmdHTML → 先剥注释
    ("""        && u96.indexOf('ui.btCmdHTML') < 0            /* 旧"逐兵种指令"块整条退役 */""",
     """        /* 旧"逐兵种指令"块整条退役 —— 判据先剥注释（墓碑注释里写了这个名字） */
        && stripComment(u96).indexOf('ui.btCmdHTML') < 0"""),
]

for i, (old, new) in enumerate(FIX):
    n = t.count(old)
    if n != 1:
        print('!! 修正 %d 匹配 %d 次 → 中止' % (i + 1, n))
        sys.exit(1)
    t = t.replace(old, new, 1)
    print('  ✓ §96 修正 %d' % (i + 1))

b = io.open('E:/Deepseekdb/.workbuddy/backup/v89116/smoke-test.js', encoding='utf-8').read()
d0 = (t.count('{') - t.count('}')) - (b.count('{') - b.count('}'))
if d0 != 0:
    print('!! 花括号净变化 %+d（§96 自身应配平；整文件口径待核）' % d0)
tmp = P2 + '.tmp116s'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(t)
os.replace(tmp, P2)
print('  → 落盘 smoke-test.js')
