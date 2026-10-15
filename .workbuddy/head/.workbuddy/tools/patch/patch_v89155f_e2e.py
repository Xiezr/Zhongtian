# -*- coding: utf-8 -*-
"""v89.155 e2e 补丁：① MSG_PER 断言升级（铺满）② 末尾追加 §155 用例（召回三态真点击 + 商城排序）。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

P = 'e2e-test.js'
s = rd(P)
done = []

# ---- ① MSG_PER 断言升级 ----
A1 = u"""  check('v43：消息流按页显示（每页 ≤ ' + G.ui.MSG_PER + ' 条，翻页看更多）',
    lines21 > 0 && lines21 <= G.ui.MSG_PER, lines21 + ' 行 / 每页 ' + G.ui.MSG_PER);"""
N1 = u"""  /* v89.155（老板 1）：每页条数 = docPerOf（按高度铺满 · 旧固定 15 = 下方空一截） */
  const per21 = G.ui.docPerOf('sys');
  check('v43/v89.155：消息流按页显示（每页按高度铺满 = ' + per21 + ' 条，旧固定 ' + G.ui.MSG_PER + '）',
    lines21 > 0 && lines21 <= per21 && per21 > G.ui.MSG_PER,
    lines21 + ' 行 / 每页 ' + per21);"""
if u'v89.155：消息流按页显示' in s:
    done.append('1 skip')
else:
    assert s.count(A1) == 1, '1 anchor'
    s = s.replace(A1, N1)
    done.append('1 OK')

# ---- ② 追加 §155 用例（return finish(); 之前） ----
SEC = u"""
  /* ============================================================
   * v89.155（老板 2/4）：召回三态（黄→执行→绿 · 2 秒回落）+ 商城排序标号
   * ============================================================ */
  await (async function () {
    const s = G.state;
    const c155 = G.currentCity();
    const keepW155 = s.wilds.slice(), keepG155 = (s.gathers || []).slice();
    const gen155 = s.generals[0];
    const keepGen155 = { status: gen155.status, cityId: gen155.cityId };
    try {
      /* ---- ① 召回三态（真 DOM 点击） ---- */
      s.wilds = [
        { x: 961, y: 961, type: 'lake', level: 5, day: 0, startDay: 0 },
        { x: 962, y: 962, type: 'lake', level: 5, day: 0, startDay: 0 }
      ];
      s.gathers = [];
      gen155.status = 'garrison';
      s.wilds[0].garrison = { troops: { changqiang: 3000 }, cityId: c155.id, genId: gen155.id };
      s.wilds[1].garrison = { troops: { changqiang: 3000 }, cityId: c155.id, genId: gen155.id };
      G.ui.closeAllModals();
      G.ui.openWilds();
      await sleep(160);
      /* §65.2：live 会逐秒重绘 —— 每次操作前重查节点 */
      const btnOf155 = (x) => document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="' + x + '"]');
      check('v89.155②：有驻军 = 红按钮（🏳️ 召回）', (function () {
        const b = btnOf155(961);
        return !!b && b.classList.contains('red') && b.textContent.indexOf('召回') >= 0;
      })(), String((btnOf155(961) || {}).className));
      if (btnOf155(961)) btnOf155(961).click();
      await sleep(130);
      check('v89.155②：第一次点击变黄（上膛 · 文案「再点一次」）', (function () {
        const b = btnOf155(961);
        return !!b && b.classList.contains('gold') && /再点一次/.test(b.textContent);
      })(), String((btnOf155(961) || {}).textContent));
      check('v89.155②：上膛不改数据（驻军仍在）', !!G.map.wildAt(961, 961).garrison);
      /* 2 秒超时 → 回红 */
      await sleep(2200);
      const bt155 = btnOf155(961);
      check('v89.155②：2 秒无点击自动回落红色', !!bt155 && bt155.classList.contains('red') && !bt155.classList.contains('gold'),
        bt155 ? bt155.className : '(无)');
      /* 连点两次 → 执行（不弹地块面板 · 按钮变绿） */
      if (btnOf155(961)) btnOf155(961).click();
      await sleep(130);
      if (btnOf155(961)) btnOf155(961).click();
      await sleep(280);
      check('v89.155②：连点两次执行召回（驻军清空 · 不弹地块面板）', (function () {
        const w = G.map.wildAt(961, 961);
        const root = document.querySelector('#modal-root');
        const gone = !w || !w.garrison || G.wildGarrisonTotal(w.garrison) === 0;
        const noLand = root && root.innerHTML.indexOf('op-zone-t">地块操作') < 0;
        return gone && noLand;
      })());
      const bt2_155 = btnOf155(961);
      check('v89.155②：召回后按钮变绿（无驻军态 · disabled）',
        !!bt2_155 && bt2_155.classList.contains('green') && bt2_155.disabled === true,
        bt2_155 ? bt2_155.className : '(无 · 列表可能已刷新)');
      G.ui.closeAllModals();
      await sleep(80);

      /* ---- ② 商城排序标号（真 DOM 顺序） ---- */
      G.ui._shopCat = 'military_buff';
      G.ui.setView('shop');
      await sleep(180);
      const order155 = Array.from(document.querySelectorAll('#view-container [data-action="shop-buy"]'))
        .map(function (b) { return b.dataset.item; });
      const idx155 = function (id) { return order155.indexOf(id); };
      check('v89.155④：商城同功能相邻升序（攻击四鼓 + 复合件自成一组）', (function () {
        const a = ['xianzhenzhangu', 'pozhengu', 'xuezhanqi', 'mieguogu'].map(idx155);
        const c1 = ['gongshou_fu', 'quanjun_ling', 'wanquan_ce', 'tianshi_ling'].map(idx155);
        const okA = a.every(function (v, i) { return i === 0 ? v >= 0 : v === a[i - 1] + 1; });
        const okC = c1.every(function (v, i) { return i === 0 ? v >= 0 : v === c1[i - 1] + 1; });
        return okA && okC;
      })(), order155.slice(0, 10).join(','));
    } finally {
      s.wilds = keepW155; s.gathers = keepG155;
      gen155.status = keepGen155.status; gen155.cityId = keepGen155.cityId;
      G.ui.closeAllModals();
      G.ui.setView('city');
      G.ui._shopCat = null;
    }
  })();
"""
ANCH = u"  return finish();\n}"
if u'v89.155（老板 2/4）：召回三态' in s:
    done.append('2 skip')
else:
    assert s.count(ANCH) == 1, '2 anchor'
    s = s.replace(ANCH, SEC + u"\n  return finish();\n}")
    done.append('2 OK')

wr(P, s)
s2 = rd(P)
_bk = io.open(R + 'backup/v89155/e2e-test.js.before', encoding='utf-8', newline='').read()
assert (s2.count(u'{') - s2.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace'
print('e2e done:', done, 'len', len(_bk), '->', len(s2))
