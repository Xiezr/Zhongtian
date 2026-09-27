# -*- coding: utf-8 -*-
"""v89.163 补丁 B：smoke 加 §163 段"""
import io

R = 'E:/Deepseekdb/'
p = 'smoke-test.js'
s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if '163. v89.163（指挥战斗含行军' in s:
    print('skip：§163 已在')
    raise SystemExit(0)

ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

NEW = """  /* ============================================================
   * §163. v89.163（老板 2）：
   *   ①「指挥战斗」清单加「行军中的军队」（召回宿主跟走 · 幽灵行防护）
   *   ② 征兵时长压缩：步兵 ≤1 分 / 骑兵 ≤5 分（单兵耗时 · 游戏秒）
   * ============================================================ */
  console.log('\\n===== 163. v89.163（指挥战斗含行军 · 征兵时长压缩） =====');
  (function () {
    var fs163 = require('fs'), p163 = require('path');
    var uS163 = fs163.readFileSync(p163.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mS163 = fs163.readFileSync(p163.join(__dirname, 'js', 'main.js'), 'utf8');
    var dS163 = fs163.readFileSync(p163.join(__dirname, 'js', 'data.js'), 'utf8');

    check('§163 征兵时长：步兵（inf）全部 ≤ 60 秒（1 分钟）', (function () {
      var bad = [];
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'inf' && t.time > 60) bad.push(t.name + '=' + t.time);
      });
      return bad.length === 0;
    })(), '义兵 ' + DATA.TROOPS.yibing.time + ' · 弓箭手 ' + DATA.TROOPS.gongjian.time);
    check('§163 征兵时长：骑兵（cav）全部 ≤ 300 秒（5 分钟）', (function () {
      var bad = [];
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'cav' && t.time > 300) bad.push(t.name + '=' + t.time);
      });
      return bad.length === 0;
    })(), '突骑 ' + DATA.TROOPS.tuqibing.time + ' · 象兵 ' + DATA.TROOPS.nanjiangxiangbing.time);
    check('§163 器械（craft：床弩/冲车/投石车）时间未动（仍 ≥1000）', (function () {
      return DATA.TROOPS.chuangnu.time >= 1000 && DATA.TROOPS.chongche.time >= 1000
        && DATA.TROOPS.toudan.time >= 1000;
    })());
    check('§163 排序保持 + 卡面显示（义兵「10秒」/ 弓箭手「1分」/ 象兵「5分」）', (function () {
      var inf = ['yibing', 'minfu', 'chihou', 'qingzhoubing', 'changqiang', 'tengjiabing', 'daodun', 'gongjian'];
      for (var i = 1; i < inf.length; i++) if (DATA.TROOPS[inf[i]].time < DATA.TROOPS[inf[i - 1]].time) return false;
      var cav = ['tuqibing', 'hubaoqi', 'qingji', 'zhouche', 'xiliangtieqi', 'tieji', 'nanjiangxiangbing'];
      for (var j = 1; j < cav.length; j++) if (DATA.TROOPS[cav[j]].time < DATA.TROOPS[cav[j - 1]].time) return false;
      return U.dur(DATA.TROOPS.yibing.time) === '10秒' && U.dur(DATA.TROOPS.gongjian.time) === '1分'
        && U.dur(DATA.TROOPS.nanjiangxiangbing.time) === '5分';
    })());
    check('§163 ★ 批量换算 @当前倍速：100 弓箭手 ≤1 分钟现实 · 100 铁骑 ≤5 分钟现实', (function () {
      var ts = G.timeScale();
      var a = DATA.TROOPS.gongjian.time * 100 / ts;
      var b = DATA.TROOPS.tieji.time * 100 / ts;
      return a <= 60 && b <= 300;
    })());

    check('§163 ★ 清单两段：战斗 1 + 行军 1 → 两段实体行（行军行含召回/进度/war-list）', (function () {
      var st = G.state, bkB = st.battles, bkM = st.marches;
      try {
        st.battles = [{ id: 'S163', state: 'live', side: 'atk', modeId: 'raid', target: { name: '荒野·甲' } }];
        st.marches = [{ id: 'm163', cityId: st.cities[0].id, genId: '', modeId: 'raid',
          target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·乙', kind: 'wild',
          army: { yibing: 100 }, elapsed: 50, totalTime: 100, scheme: null, ops: 'assault', cargo: null }];
        var h = G.ui.battleListHTML();
        return h.indexOf('⚔ 战斗待指挥（1）') >= 0 && h.indexOf('🛫 行军中的军队（1）') >= 0
          && h.indexOf('data-action="bt-open"') >= 0
          && h.indexOf('data-action="march-recall" data-id="m163"') >= 0 && h.indexOf('50%') >= 0
          && h.indexOf('class="war-list"') >= 0;
      } finally { st.battles = bkB; st.marches = bkM; }
    })());
    check('§163 ★ 两段都空 → openBattleList 只 toast 不弹（未开着时）', (function () {
      var st = G.state, bkB = st.battles, bkM = st.marches;
      var toasts = [], bk = G.ui.toast;
      try {
        st.battles = []; st.marches = [];
        G.ui.toast = function (m) { toasts.push(m); };
        var threw = false;
        try { G.ui.openBattleList(); } catch (e) { threw = true; }
        return !threw && toasts.length === 1 && /没有待指挥的战斗与行军中军队/.test(toasts[0]);
      } finally { st.battles = bkB; st.marches = bkM; G.ui.toast = bk; }
    })());
    check('§163 幽灵行防护：已开着（.war-list 在）时两段全空也原地重绘', (function () {
      return /document\\.querySelectorAll\\('#modal-root \\.war-list'\\)\\.length > 0/.test(uS163)
        && /&& !opened/.test(uS163);
    })());
    check('§163 召回宿主跟走（querySelectorAll 口径 · 不再硬编码 openMarches）', (function () {
      return /document\\.querySelectorAll\\('#modal-root \\.war-list'\\)\\.length\\) ui\\.openBattleList\\(\\)/.test(mS163)
        && /else ui\\.openMarches\\(\\)/.test(mS163);
    })());
    check('§163 底栏「指挥战斗」title 写明"与行军中的军队" · 数据表注释写明口径', (function () {
      return /查看正在进行的战斗与行军中的军队/.test(uS163)
        && /步兵1分钟以内，骑兵5分钟以内/.test(dS163);
    })());
    check('§163④ 需求档案在册（v89.163 · 老板原文关键句逐字）', (function () {
      var arc = fs163.readFileSync(p163.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.163') >= 0
        && arc.indexOf('将行军中的军队也显示在这个菜单中') >= 0
        && arc.indexOf('步兵1分钟以内，骑兵5分钟以内') >= 0;
    })());
  })();

"""

assert s.count(ANCHOR) == 1, '锚点数=%d' % s.count(ANCHOR)
s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('§163 已插入 · 新长度', len(s))
