# -*- coding: utf-8 -*-
"""v89.229c14b：修复 §229c 段（引号转义 + 简化 ④ + BITMAPS 取全局）
手法：定位 '§229c（v89.229 · 兵种重构' 到 '  })();\n\n  console.log(' 结果行' 之间，整段替换。
"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'smoke-test.js')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []
s = rd(P)
i = s.index('  /* ============================================================\n   * §229c（v89.229 · 兵种重构')
tail = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
j = s.index(tail)
old = s[i:j]
LOG.append('旧段长度 %d' % len(old))

NEW = r'''  /* ============================================================
   * §229c（v89.229 · 兵种重构 18→14）——回归哨兵
   * ------------------------------------------------------------
   * 老板（v89.229 需求 2）：「兵种重构，不再按步兵骑兵区分，合并，按分页显示，
   *   缩减兵种数量，保留可增加框架」+ 给定 14 兵种三分组表。
   * 本段守四类"重构最容易漏的地方"（本轮**真的漏了两处**，见 ⑤/⑥）：
   *   ① 表结构（id/grp/ab 齐备 · 三组 4/5/5 · cat 退役 · 器械并入组 3）
   *   ② 退役 id 的产品侧零残留（**运行时派生表**最易漏 —— 本轮 fortGarrison 就漏在这儿）
   *   ③ 老档迁移表齐备 + 真调幂等
   *   ④ 位图/gicons/分页三条派生链随换代
   * ============================================================ */
  console.log('\n===== §229c 兵种重构（18→14 · 三分组分页）=====');
  (function () {
    var fs229 = require('fs'), path229 = require('path');
    var m229 = fs229.readFileSync(path229.join(__dirname, 'js', 'main.js'), 'utf8');
    var u229 = fs229.readFileSync(path229.join(__dirname, 'js', 'ui.js'), 'utf8');
    var g229 = fs229.readFileSync(path229.join(__dirname, 'js', 'gicons.js'), 'utf8');
    var self229 = fs229.readFileSync(path229.join(__dirname, 'smoke-test.js'), 'utf8');
    var a229 = fs229.readFileSync(path229.join(__dirname, '需求档案.md'), 'utf8');
    function strip229(x) { return x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
    var Q229 = String.fromCharCode(34) + String.fromCharCode(39);   /* " 与 ' 两个引号字符 */
    var RETIRED = ['minfu', 'yibing', 'chihou', 'changqiang', 'daodun', 'gongjian', 'qingji', 'tieji',
      'zhouche', 'chuangnu', 'chongche', 'toudan', 'qingzhoubing', 'tengjiabing', 'tuqibing',
      'hubaoqi', 'xiliangtieqi', 'nanjiangxiangbing'];

    /* ① 表结构：14 兵种 · 三组 4/5/5 · cat 退役 · 器械并入组 3 */
    check('§229c① 表结构：14 兵种 · 三组 4/5/5 · 键与 id 一致 · cat 字段退役 · 器械并入组 3', (function () {
      var T = DATA.TROOPS, ids = Object.keys(T), cnt = {}, bad = [];
      if (ids.length !== 14) bad.push('n=' + ids.length);
      ids.forEach(function (id) {
        var t = T[id];
        if (t.id !== id) bad.push('键非id:' + id);
        if (!(t.grp === 1 || t.grp === 2 || t.grp === 3)) bad.push('grp:' + id);
        if ('cat' in t) bad.push('cat未退役:' + id);
        if (!t.name || !t.ab || t.ab.length !== 1) bad.push('名或简称:' + id);
        cnt[t.grp] = (cnt[t.grp] || 0) + 1;
      });
      return bad.length === 0 && cnt[1] === 4 && cnt[2] === 5 && cnt[3] === 5
        && T.huopao.craft === true && T.wuren.craft === true
        && T.huopao.grp === 3 && T.wuren.grp === 3;
    })());

    /* ② 退役 id 的**产品侧零残留**（剥注释 · 只查"可执行形态"：对象键 / 字符串字面量）
       —— 本轮真漏点：map.js 的 fortGarrison 五键全是退役 id → 据点守军整支为空。 */
    check('§229c② 退役 id 产品侧零残留（剥注释 · 除 state.js 迁移表外无键/字面量）', (function () {
      var files = ['data', 'domain', 'map', 'battle', 'tactic', 'systems', 'ui', 'questdata', 'icons', 'main'];
      var bad = [], base = 0;
      files.forEach(function (f) {
        var src = strip229(fs229.readFileSync(path229.join(__dirname, 'js', f + '.js'), 'utf8'));
        RETIRED.forEach(function (id) {
          var reKey = new RegExp('[\\{\\s,][' + Q229 + ']?' + id + '[' + Q229 + ']?\\s*:');
          var reStr = new RegExp('[' + Q229 + ']' + id + '[' + Q229 + ']');
          if (reKey.test(src) || reStr.test(src)) bad.push(f + ':' + id);
        });
      });
      /* 迁移表必须**逐项齐全**（正向基数自证：18 条全在 → 防"表被删空也全绿"） */
      var MAP = GAME.TROOP_MAP_229 || {};
      RETIRED.forEach(function (id) { if (MAP[id]) base++; });
      if (base !== 18) bad.push('迁移表缺项 ' + base + '/18');
      if (bad.length) window.__r229c2 = bad.slice(0, 6).join(',');
      return bad.length === 0;
    })(), window.__r229c2 || '');

    /* ③ 老档迁移真调：合并相加 + 幂等（不重复加） */
    check('§229c③ 老档迁移真调：旧 id 相加并入新 id · 幂等标记 · 二次调用不再变', (function () {
      var keep = GAME.state, ok = false, dbg = '';
      try {
        var st = G.newGame({ name: '迁移', cityName: '灰岗' });
        GAME.state = st;
        var c = st.cities[0];
        c.army = { yibing: 300, changqiang: 200, chongche: 5, zhouche: 2 };
        GAME.migrateTroops229(st);
        var a1 = JSON.parse(JSON.stringify(c.army));
        GAME.migrateTroops229(st);                       /* 幂等：再来一次不应变化 */
        var a2 = JSON.parse(JSON.stringify(c.army));
        dbg = JSON.stringify(a1) + ' → ' + JSON.stringify(a2);
        ok = a1.buxingji === 500 && a1.huopao === 5 && a1.yunshu === 2
          && a1.yibing === undefined && a1.changqiang === undefined && a1.chongche === undefined
          && JSON.stringify(a1) === JSON.stringify(a2) && st.troopMig229 === true
          && Object.keys(a1).length === 3;
      } catch (e) { dbg = 'ERR:' + e.message; ok = false; }
      finally { GAME.state = keep; }
      window.__r229c3 = dbg;
      return ok;
    })(), window.__r229c3 || '');

    /* ④ 分页链：grp 驱动 + 白名单四页 + 单参入口 + 退役字段零赋值 */
    check('§229c④ 分页链：troopsHTML 按 grp 过滤 · main.js 白名单四页 · openTroops 单参', (function () {
      return /DATA\.TROOPS\[id\]\.grp === grpN/.test(u229)
        && /\['que', 'g1', 'g2', 'g3'\]/.test(m229)
        && /ui\.openTroops = function \(idx\)/.test(u229)
        && !/ui\._trainFilter = /.test(u229);
    })());

    /* ⑤ 派生表随换代（**本轮真 bug 的回归守卫**）：据点守军逐级键必须都在 DATA.TROOPS */
    check('§229c⑤ 派生表键全部合法：fortGarrison 逐级键 ∈ DATA.TROOPS 且总数 > 0', (function () {
      var bad = [], lv1 = 0, lv8 = 0;
      for (var lv = 1; lv <= 10; lv++) {
        var g = GAME.map.fortGarrison(lv), tot = 0;
        for (var k in g) {
          if (!DATA.TROOPS[k]) bad.push('Lv' + lv + ':' + k);
          tot += g[k];
        }
        if (tot <= 0) bad.push('Lv' + lv + ' 空守军');
        if (lv === 1) lv1 = tot;
        if (lv === 8) lv8 = tot;
      }
      if (bad.length) window.__r229c5 = bad.slice(0, 6).join(',');
      return bad.length === 0 && lv1 > 0 && lv8 > lv1;
    })(), window.__r229c5 || '');

    /* ⑥ 位图链随换代（**第二个真 bug 的回归守卫**）：14 兵种都要有 ai_<id>.png */
    check('§229c⑥ 位图链：14 兵种 ai_<id>.png 全在（BITMAPS.fileOf 非空）', (function () {
      var B = (typeof global.BITMAPS === 'object') ? global.BITMAPS : null;
      if (!B) return false;
      var ids = Object.keys(DATA.TROOPS);
      var miss = ids.filter(function (id) { return !B.fileOf('troop', id); });
      if (miss.length) window.__r229c6 = miss.join(',');
      return miss.length === 0 && ids.length === 14;
    })(), window.__r229c6 || '');

    /* ⑦ gicons 矢量化名册同源（回退层也要跟换代） */
    check('§229c⑦ gicons 兵种名册同源：14 键齐备 · 退役 id 零残留', (function () {
      var i2 = g229.indexOf('"troop": {');
      if (i2 < 0) return false;
      var seg = g229.slice(i2, g229.indexOf('"mat": {', i2));
      var ids = Object.keys(DATA.TROOPS);
      var miss = ids.filter(function (id) { return seg.indexOf('"' + id + '":') < 0; });
      var left = RETIRED.filter(function (id) { return seg.indexOf('"' + id + '":') >= 0; });
      if (miss.length || left.length) window.__r229c7 = 'miss=' + miss.join(',') + ' left=' + left.join(',');
      return miss.length === 0 && left.length === 0;
    })(), window.__r229c7 || '');

    /* ⑧ 版本与档案在册（本段自证 · 防"段被删空也全绿"） */
    check('§229c⑧ 版本与档案在册（v89.229 · 老板原话关键句逐字）', (function () {
      var self2 = self229.slice(0, self229.indexOf('§229c'));
      return /GAME\.VERSION = 'v89\.229'/.test(m229)
        && a229.indexOf('v89.229') >= 0 && a229.indexOf('兵种重构') >= 0
        && a229.indexOf('泰坦机甲') >= 0 && self2.length > 100000;
    })());
  })();

'''

s = s[:i] + NEW + s[j:]
wr(P, s)
LOG.append('新段长度 %d' % len(NEW))


def strip_js(x):
    x = re.sub(r'/\*[\s\S]*?\*/', '', x)
    x = re.sub(r'//[^\n]*', '', x)
    x = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", x)
    x = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', x)
    x = x.replace('\\{', '').replace('\\}', '')
    return x


cur = strip_js(s)
LOG.append('剥离后花括号差值 = %d' % (cur.count('{') - cur.count('}')))

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c14b_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
