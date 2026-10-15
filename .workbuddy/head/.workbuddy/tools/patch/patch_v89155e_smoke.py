# -*- coding: utf-8 -*-
"""v89.155 smoke 补丁：① 5 处旧断言升级 ② 文件末尾插 §155 节（先数清闭合层数，插完 node --check）。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
def strip_js(t):
    t = t.replace('\\(', '').replace('\\)', '').replace('\\{', '').replace('\\}', '')
    t = re.sub(r'/\*[\s\S]*?\*/', '', t)
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)
    t = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return t

P = 'smoke-test.js'
s = rd(P)
done = []
def seg(tag, old, new, guard):
    global s
    if guard in s:
        done.append(tag + ' skip'); return
    assert s.count(old) == 1, tag + ' anchor count=' + str(s.count(old))
    s = s.replace(old, new)
    done.append(tag + ' OK')

# ---- ① 采集入口收敛（地块面板召回走出口） ----
seg('1',
    u"""      && /data-action="wild-garrison-gather"/.test(land)
      && /data-action="gather-finish"/.test(land)
      && /data-action="wild-withdraw"/.test(land);""",
    u"""      && /data-action="wild-garrison-gather"/.test(land)
      && /data-action="gather-finish"/.test(land)
      /* v89.155（老板 2）：召回按钮走唯一出口（三态渲染 + 就地重绘），不再内联 data-action */
      && /ui\\.wildWdBtnHTML\\(x, y/.test(land);""",
    u'ui\\.wildWdBtnHTML\\(x, y/')

# ---- ② ⑨-7 分页每页数 ----
seg('2',
    u"""    check('⑨-7 分页每页数已定义（DOC_PER 曾未定义 → 战报翻页条从未登记过）', (function () {
      return G.ui.DOC_PER === 10 && /if \\(total > per\\) ui\\.pagerHTML\\('doc' \\+ id, total, per\\)/.test(u4)
        && /ui\\.pageOf\\('docwar', hit\\.length, ui\\.DOC_PER\\)/.test(u4);
    })());""",
    u"""    check('⑨-7 分页每页数已定义（DOC_PER 兜底 + v89.155 按高度铺满 docPerOf）', (function () {
      return G.ui.DOC_PER === 10 && /if \\(total > per\\) ui\\.pagerHTML\\('doc' \\+ id, total, per\\)/.test(u4)
        && /ui\\.pageOf\\('docwar', hit\\.length, ui\\.docPerOf\\('war'\\)\\)/.test(u4);
    })());""",
    u"pageOf\\('docwar', hit\\.length, ui\\.docPerOf\\('war'\\)\\)")

# ---- ③ §118④ 操作列五按钮 ----
seg('3',
    u"        && seg.indexOf('data-action=\"wild-withdraw\"') >= 0",
    u"        && seg.indexOf('ui.wildWdBtnHTML(w.x, w.y') >= 0   /* v89.155：召回走唯一出口（三态） */",
    u"seg.indexOf('ui.wildWdBtnHTML(w.x, w.y')")

# ---- ④ §119⑤ 召回统一 ----
seg('4',
    u"""    check('§119⑤ 召回统一：三处入口全走 wild-withdraw（撤回驻军 = 兵将回城）+ 两段确认', (function () {
      var n = (uc.match(/data-action="wild-withdraw"/g) || []).length;
      return n >= 3
        && uc.indexOf('data-action="gather-abandon-ask"') < 0
        && !/ui\\.openGatherAbandonAsk = function/.test(uc)
        && !/GAME\\.doAbandonGather = function/.test(mc)
        && /_wdArm138/.test(mc) && /再点一次 —— 撤军回城/.test(mc);
    })());""",
    u"""    check('§119⑤ 召回统一：全走 wild-withdraw 出口（兵将回城）+ 上膛三态（v89.155）', (function () {
      /* v89.155（老板 2）：召回按钮走唯一出口（三态渲染 + 就地重绘）——
         出口 1 处定义 + 2 处消费（列表 / 地块面板）；上膛改「变黄 + 2 秒超时回落」。 */
      var n = (uc.match(/ui\\.wildWdBtnHTML\\(/g) || []).length;
      return n >= 3
        && (uc.match(/data-action="wild-withdraw"/g) || []).length >= 1
        && uc.indexOf('data-action="gather-abandon-ask"') < 0
        && !/ui\\.openGatherAbandonAsk = function/.test(uc)
        && !/GAME\\.doAbandonGather = function/.test(mc)
        && /_wdArm138/.test(mc) && /_wdArmTimer155/.test(mc)
        && /'⚠️ 再点一次'/.test(uc);
    })());""",
    u"_wdArmTimer155\\)/.test\\(mc\\)")

# ---- ⑤ 插 §155 节（文件末尾；两行 })(); 之间插） ----
SEC = u"""
  /* ============================================================
   * 155. v89.155（公文铺满 / 召回三态 / 采集归位 / 排序标号 / 容量显式）
   * ============================================================ */
  console.log('\\n===== 155. v89.155（公文铺满 / 召回三态 / 排序标号 / 容量显式） =====');
  (function () {
    var fs155 = require('fs'), p155 = require('path');
    var u155 = fs155.readFileSync(p155.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m155 = fs155.readFileSync(p155.join(__dirname, 'js', 'main.js'), 'utf8');
    var d155 = fs155.readFileSync(p155.join(__dirname, 'js', 'domain.js'), 'utf8');

    /* ---- ① 公文铺满（老板 1） ---- */
    check('§155① docPerOf：出口唯一 + 正文三处消费 + 分页登记同源（共 5 引用）', (function () {
      return (u155.match(/ui\\.docPerOf = function/g) || []).length === 1
        && (u155.match(/ui\\.docPerOf\\(/g) || []).length === 5;
    })());
    check('§155① 实测：每页条数按高度铺满（sys 21 / 单标签 25 / war 18 · 旧固定 15/10）', (function () {
      var bk = G.ui._msgTag;
      G.ui._msgTag = 'gather';
      var a = G.ui.docPerOf('sys');
      G.ui._msgTag = bk;
      var b = G.ui.docPerOf('sys'), c = G.ui.docPerOf('war');
      return a === 25 && b === 21 && c === 18 && G.ui.MSG_PER === 15 && G.ui.DOC_PER === 10;
    })());
    check('§155① 行高/头高常量 = 实测量（改版式后重量更新的锚点）',
      G.ui.DOC_LINE_H.sys > 24 && G.ui.DOC_LINE_H.sys < 26 && G.ui.DOC_HEAD_H === 127
        && G.ui.DOC_TASK_H === 104 && G.ui.DOC_FOOT_H === 28);

    /* ---- ② 采集消息归位（老板 1·后半：「重合，整合区分」） ---- */
    check('§155② 自动采集/收获归「采集收获」（原误落军情）+ 老档迁移归系统', (function () {
      return /\\('🌾 自动采集\\/收获：' \\+ msg, 'sys', 'gather'\\)/.test(d155)
        && /原地开工）', 'sys'\\)/.test(d155)
        && G.msgSubOf({ k: 'sys', s: 'gather' }) === 'gather';
    })());

    /* ---- ③ 召回三态（老板 2） ---- */
    check('§155③ 召回按钮唯一出口（三态）+ 两处消费（列表/地块面板）同源', (function () {
      return (u155.match(/ui\\.wildWdBtnHTML = function/g) || []).length === 1
        && (u155.match(/ui\\.wildWdBtnHTML\\(/g) || []).length === 3
        && u155.indexOf('data-lbl=') < 0;      /* lbl 走 WD_LABELS 表（不写进 DOM 重复文本） */
    })());
    check('§155③ 实测：三态 HTML（红 / 黄 / 绿-disabled）+ 坐标齐备（禁用态也给）', (function () {
      var bk = G.ui._wdArm138;
      var red = G.ui.wildWdBtnHTML(999, 999, { hasGar: true });
      G.ui._wdArm138 = '999,999';
      var gold = G.ui.wildWdBtnHTML(999, 999, { hasGar: true });
      G.ui._wdArm138 = bk;
      var green = G.ui.wildWdBtnHTML(999, 999, { hasGar: false });
      return red.indexOf('btn red') >= 0 && red.indexOf('🏳️ 召回') >= 0
        && gold.indexOf('btn gold') >= 0 && gold.indexOf('再点一次') >= 0
        && green.indexOf('btn green') >= 0 && green.indexOf('disabled') >= 0
        && green.indexOf('data-x="999"') >= 0;
    })());
    check('§155③ main：上膛超时回落（WD_ARM_MS）+ 执行后不弹面板 + 无长 toast', (function () {
      var i = m155.indexOf("case 'wild-withdraw': {");
      var seg = m155.slice(i, i + 2000);
      return i >= 0 && seg.indexOf('ui._wdArmTimer155 = setTimeout') >= 0
        && seg.indexOf('ui.wdRepaint(_wx155, _wy155)') >= 0
        && seg.indexOf('openLandModal') < 0
        && seg.indexOf('兵与将随之回城，采集进度作废') < 0
        && DATA.WD_ARM_MS === 2000;
    })());

    /* ---- ④ 内置排序标号（老板 4） ---- */
    check('§155④ 标号：族 = 效果维度（单键 ×10 / 复合 ×10+1）· 无效果按 price · 手写 ord 优先', (function () {
      var a = null, b = null, m1 = null, m2 = null, j = null, ordIt = { id: 'zz_ord', ord: 7 };
      DATA.ITEMS.forEach(function (x) {
        if (x.id === 'xianzhenzhangu') a = x;      /* atk 单键 0.1 */
        if (x.id === 'mieguogu') b = x;            /* atk 单键 0.35 */
        if (x.id === 'gongshou_fu') m1 = x;        /* atk+def 复合 */
        if (x.id === 'junqi') m2 = x;              /* cap 单键 */
        if (x.id === 'bengzhu') j = x;             /* 无 eff → price 当档位 */
      });
      return G.ui.itemFamOf(a) === 1010 && G.ui.itemFamOf(m1) === 1011 && G.ui.itemFamOf(m2) === 1040
        && G.ui.itemFamOf(j) === 5010 && G.ui.itemPowOf(a) === 100
        && G.ui.itemOrdOf(b) > G.ui.itemOrdOf(a) && G.ui.itemOrdOf(j) === 5010002
        && G.ui.itemOrdOf(ordIt) === 7;
    })());
    check('§155④ 实测：商城同功能相邻升序（粮食三件 / 攻击四鼓 / 复合件自成一组）', (function () {
      var bk = G.ui._shopCat, order = [], html = '', mm;
      var re = /data-action="shop-buy" data-item="([a-z_0-9]+)"/g;
      G.ui._shopCat = 'prod_buff'; html = G.ui.shopHTML();
      re.lastIndex = 0;
      while ((mm = re.exec(html))) order.push(mm[1]);
      var g1 = ['shennongchu', 'shennongling', 'houji'].map(function (id) { return order.indexOf(id); });
      var okG = g1[0] >= 0 && g1[1] === g1[0] + 1 && g1[2] === g1[1] + 1;
      order = []; G.ui._shopCat = 'military_buff'; html = G.ui.shopHTML();
      re.lastIndex = 0;
      while ((mm = re.exec(html))) order.push(mm[1]);
      var a1 = ['xianzhenzhangu', 'pozhengu', 'xuezhanqi', 'mieguogu'].map(function (id) { return order.indexOf(id); });
      var okA = a1.every(function (v, i) { return i === 0 ? v >= 0 : v === a1[i - 1] + 1; });
      var c1 = ['gongshou_fu', 'quanjun_ling', 'wanquan_ce', 'tianshi_ling'].map(function (id) { return order.indexOf(id); });
      var okC = c1.every(function (v, i) { return i === 0 ? v >= 0 : v === c1[i - 1] + 1; });
      G.ui._shopCat = bk;
      return okG && okA && okC;
    })());

    /* ---- ⑤ 容量显式化（老板 5） ---- */
    check('§155⑤ 单块堆场出口（lv×BASE/DIV）· 面板「另加仓储上限」· 悬停「其中城外堆场」· tip 无 undefined', (function () {
      var st = G.state, c = G.currentCity(), grid = G.extGridOf(c);
      var keep = grid[3] ? JSON.parse(JSON.stringify(grid[3])) : null;
      grid[3] = { id: 'e4', type: 'quarry', lv: 3 };
      var one = G.extStoreCapOneOf(grid[3]);
      var expect = Math.round(3 * DATA.BASE_STORE / DATA.EXT_STORE_DIV);
      var html = '';
      var _om = G.ui.openModal; G.ui.openModal = function (h) { html = h; };
      try { G.ui.openExtModal(3); } catch (e) { html = 'ERR:' + e.message; }
      G.ui.openModal = _om;
      grid[3] = keep;
      return one === expect && G.extStoreCapOneOf({ type: null, lv: 0 }) === 0
        && html.indexOf('另加仓储上限') >= 0 && html.indexOf(U.fmt(one)) >= 0
        && u155.indexOf('其中城外堆场 +') >= 0
        && u155.indexOf("'｜每级另加仓储上限 +'") >= 0
        && DATA.EXT_BUILDINGS.quarry.desc === '凿山取石，石料产地';
    })());

    /* ---- ⑥ 需求档案在册 ---- */
    check('§155⑥ 需求档案在册（v89.155 · 老板原文关键句逐字）', (function () {
      var md = fs155.readFileSync(p155.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.155') >= 0
        && md.indexOf('公文的显示没界面底部到底，没铺满界面就分页了') >= 0
        && md.indexOf('第一次点击变黄色，第二次点击执行召回并变回无驻军的绿色') >= 0
        && md.indexOf('产量是否受时间倍率影响') >= 0
        && md.indexOf('内置排序标号') >= 0
        && md.indexOf('感觉资源建筑没加容量上限呢') >= 0;
    })());
  })();
"""
ANCH = u"  })();\n\n  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
if u'155. v89.155（公文铺满' in s:
    done.append('5 skip')
else:
    assert s.count(ANCH) == 1, '5 anchor count=' + str(s.count(ANCH))
    NEW = u"  })();\n" + SEC + u"\n  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    s = s.replace(ANCH, NEW)
    done.append('5 OK')

wr(P, s)
s2 = rd(P)
_bk = strip_js(io.open(R + 'backup/v89155/smoke-test.js.before', encoding='utf-8', newline='').read())
_sa = strip_js(s2)
assert (_sa.count(u'{') - _sa.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace'
assert (_sa.count(u'(') - _sa.count(u')')) == (_bk.count(u'(') - _bk.count(u')')), 'paren'
print('smoke done:', done)
