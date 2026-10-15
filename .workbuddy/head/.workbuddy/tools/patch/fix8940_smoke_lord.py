# -*- coding: utf-8 -*-
"""修正 smoke 的君主运行时断言：现场补临时君主/对照将（打完移除），保证不放空。"""
import io, os, sys

p = r'E:\Deepseekdb\smoke-test.js'
src = io.open(p, encoding='utf-8', newline='').read()

START = u"    /* v89.40（老板）：「君主不会掉忠诚」—— 同一构造的必败之战："
END = u"    gGu.loyalty = 30;   // 守将忠诚低于 warnAt(50)"
i = src.find(START)
j = src.find(END, i)
if i < 0 or j < 0:
    print('FAIL 定位 %d / %d' % (i, j)); sys.exit(1)

NEW = u"""    /* v89.40（老板）：「君主不会掉忠诚」—— 同一构造的必败之战：
       君主忠诚不动，普通将领照扣（守卫只豁免君主，不是把机制关掉）。
       注：本套件早段用例截过名单（S18.generals.length = 1 把君主截掉了），
       故现场补一位临时君主/对照将、打完移除，保证断言不被"缺对象"放空。 */
    (function () {
      var s40 = G.state, tmp40 = [];
      var lord40 = G.lordGeneralOf();
      if (!lord40) {
        lord40 = G.makeLordGeneral({ name: '试验君主' }, 7, (s40.cities[0] || {}).id);
        lord40.id = 'test-lord-40';
        s40.generals.push(lord40); tmp40.push(lord40);
      }
      var gN40 = null;
      (s40.generals || []).forEach(function (x) { if (!gN40 && !G.isLordGeneral(x)) gN40 = x; });
      if (!gN40) {
        gN40 = G.makeGeneral('试验将', 1, 'idle', (s40.cities[0] || {}).id);
        s40.generals.push(gN40); tmp40.push(gN40);
      }
      var c40 = GAME.currentCity() || s40.cities[0];
      var bkArmy40 = JSON.stringify(c40.army || {});
      c40.army = c40.army || {};
      c40.army.yibing = Math.max(c40.army.yibing || 0, 200);
      s40.res.gold += 1e6;
      var mkTgt = function (n) {
        return { id: 'nt' + n, name: '测试坚城' + n, x: 1, y: 1, garrison: { tieji: 900000 }, def: 999, type: 'jun' };
      };
      lord40.loyalty = 80; lord40.stamina = 100; lord40.energy = 100;
      var rtL = G.battle.attackCity(mkTgt(1), { yibing: 50 }, lord40.id);
      var lOK = !!(rtL && rtL.ok && rtL.result && rtL.result.winner === 'def')
        && Math.abs(lord40.loyalty - 80) < 1e-9;
      gN40.loyalty = 80; gN40.stamina = 100; gN40.energy = 100;
      var rtN = G.battle.attackCity(mkTgt(2), { yibing: 50 }, gN40.id);
      var nOK = !!(rtN && rtN.ok && rtN.result && rtN.result.winner === 'def') && gN40.loyalty < 80;
      gN40.loyalty = 90;
      c40.army = JSON.parse(bkArmy40);               /* 复原军力，不打乱后续用例 */
      if (tmp40.length) s40.generals = s40.generals.filter(function (x) { return tmp40.indexOf(x) < 0; });
      check('v89.40：君主战败不掉忠（对照：普通将领仍照扣）', lOK && nOK,
        '君主 ' + lord40.loyalty + ' · 普通 ' + gN40.loyalty + (tmp40.length ? '（现场补的对象已移除）' : ''));
    })();
"""

out = src[:i] + NEW + src[j:]
io.open(p, 'w', encoding='utf-8', newline='').write(out)
back = io.open(p, encoding='utf-8', newline='').read()
assert u'现场补一位临时君主' in back and back.count(u'试验君主') == 1
print('OK  运行时断言已改为自足构造')
