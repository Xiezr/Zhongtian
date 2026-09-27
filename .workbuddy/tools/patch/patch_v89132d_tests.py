# -*- coding: utf-8 -*-
"""v89.132 补丁 D：测试断言更新（smoke + e2e）
- smoke：5 条既有断言按新落点升级 + 新增 §113 段（三项需求守护）
- e2e：2 段（军务总览两营 → 军务处两营；五段 → 四段）
跑：python .workbuddy/tools/patch/patch_v89132d_tests.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

# ============================================================
# smoke-test.js
# ============================================================
sm = rd('smoke-test.js')

# A. 军务总览五段 → 四段
old_a = (
    "  /* v89.117（老板「还是没有俘虏营…要让玩家看得到」）：⑤ 段由「伤兵」扩为\n"
    "     「两营（伤兵 · 俘虏）」—— 军务的**默认页签**上就要看得见两营。 */\n"
    "  check('军务总览五段就位（城内 / 驻守野地 / 采集队 / 行军 / **两营**）',\n"
    "    /① 城内/.test(uS31) && /② 驻守野地/.test(uS31) && /③ 采集队/.test(uS31)\n"
    "    && /④ 行军/.test(uS31) && /⑤ 两营/.test(uS31)\n"
    "    && /campCard\\('wounded', \\{ compact: true \\}\\)/.test(uS31)\n"
    "    && /campCard\\('captive', \\{ compact: true \\}\\)/.test(uS31));\n"
)
new_a = (
    "  /* v89.132（老板「军务总览里边，不需要两营这个菜单，只在军务处即可」）：\n"
    "     ⑤ 两营区退役 —— 总览四段；两营收进军务处（camp-cards 左右分列）。 */\n"
    "  check('军务总览四段就位（城内 / 驻守野地 / 采集队 / 行军）· 两营区已退役',\n"
    "    /① 城内/.test(uS31) && /② 驻守野地/.test(uS31) && /③ 采集队/.test(uS31)\n"
    "    && /④ 行军/.test(uS31) && uS31.indexOf('⑤ 两营') < 0\n"
    "    && /camp-cards/.test(uS31));\n"
)
sm = rep1(sm, old_a, new_a, 'A 五段→四段')

# B. 总览两营紧凑卡 → 军务处左右分列
old_b = (
    "  /* v89.117：军务总览的 ⑤ 段改走**两营紧凑卡**（伤兵 + 俘虏并列），\n"
    "     不再是单独的 woundedBlock('view') —— 唯一落点仍在军务处 full 卡。 */\n"
    "  check('行军视图（军务总览）含两营紧凑卡',\n"
    "    /campCard\\('wounded', \\{ compact: true \\}\\)/.test(uS34)\n"
    "    && /campCard\\('captive', \\{ compact: true \\}\\)/.test(uS34));\n"
)
new_b = (
    "  /* v89.132（老板）：两营从\"总览紧凑卡\"改为\"军务处左右分列\"（camp-cards）。 */\n"
    "  check('军务处两营左右分列（camp-cards · 唯一组件 campCard 单参形态）',\n"
    "    /class=\"camp-cards\"/.test(uS34)\n"
    "    && /ui\\.campCard\\('wounded'\\) \\+ ui\\.campCard\\('captive'\\)/.test(uS34));\n"
)
sm = rep1(sm, old_b, new_b, 'B 两营落点')

# C. 校场面板口径：MARCH_MEN_PER_LV → marchCapOf
old_c = (
    "    check('① 界面口径：校场面板写「人马」且不再写「人口」上限', (function () {\n"
    "      var _fs = require('fs'), _p = require('path');\n"
    "      var src = _fs.readFileSync(_p.join(__dirname, 'js/ui.js'), 'utf8');\n"
    "      var key = '出征'\n"
    "        + String.fromCharCode(0x5175) + String.fromCharCode(0x529b) + String.fromCharCode(0x4e0a) + String.fromCharCode(0x9650);\n"
    "      return src.indexOf(key) >= 0 && src.indexOf('MARCH_MEN_PER_LV') >= 0;\n"
    "    })());\n"
)
new_c = (
    "    check('① 界面口径：校场面板写「人马」且走唯一出口 marchCapOf', (function () {\n"
    "      var _fs = require('fs'), _p = require('path');\n"
    "      var src = _fs.readFileSync(_p.join(__dirname, 'js/ui.js'), 'utf8');\n"
    "      var key = '出征'\n"
    "        + String.fromCharCode(0x5175) + String.fromCharCode(0x529b) + String.fromCharCode(0x4e0a) + String.fromCharCode(0x9650);\n"
    "      /* v89.132：口径收口 —— 建筑面板 / 校场面板都读 marchCapOf（节钺扩编才跟得上） */\n"
    "      return src.indexOf(key) >= 0 && src.indexOf('marchCapOf') >= 0;\n"
    "    })());\n"
)
sm = rep1(sm, old_c, new_c, 'C 校场口径')

# D. campCard 两档密度 → 单形态
old_d = (
    "    check('① 两营收成**唯一组件** ui.campCard（full / compact 两档密度）',\n"
    "      /ui\\.campCard = function \\(kind, opts\\)/.test(u97)\n"
    "      && /ui\\.campCard\\('wounded'\\) \\+ ui\\.campCard\\('captive'\\)/.test(u97)\n"
    "      && /ui\\.campCard\\('wounded', \\{ compact: true \\}\\)/.test(u97));\n"
)
new_d = (
    "    /* v89.132（老板）：军务处两营左右分列 —— 组件收成单形态（camp-card），\n"
    "       compact 档随总览 ⑤ 区一并退役（不留第二个形态 = 不留第二个出口）。 */\n"
    "    check('① 两营唯一组件 ui.campCard（单形态 · 军务处 camp-cards 两列）',\n"
    "      /ui\\.campCard = function \\(kind\\) \\{/.test(u97)\n"
    "      && /ui\\.campCard\\('wounded'\\) \\+ ui\\.campCard\\('captive'\\)/.test(u97)\n"
    "      && /class=\"camp-cards\"/.test(u97));\n"
)
sm = rep1(sm, old_d, new_d, 'D campCard 单形态')

# E. 总览列两营 → 只在军务处
old_e = (
    "    check('① 军务总览（默认页签）就列出两营 —— 不必先切页签',\n"
    "      (function () {\n"
    "        var h = G.ui.marchesHTML();\n"
    "        return h.indexOf('伤兵营') >= 0 && h.indexOf('俘虏营') >= 0;\n"
    "      })());\n"
)
new_e = (
    "    /* v89.132（老板「只在军务处即可」）：总览不再列两营 —— 落点是军务处（marchAffairsHTML）。 */\n"
    "    check('① 两营只在军务处（总览无两营；军务处两列并排）', (function () {\n"
    "      var keepTab = G.ui._marchTab;\n"
    "      try {\n"
    "        G.ui._marchTab = 'over';\n"
    "        var hOver = G.ui.marchesHTML();\n"
    "        var hAf = G.ui.marchAffairsHTML();\n"
    "        return hOver.indexOf('伤兵营') < 0 && hOver.indexOf('俘虏营') < 0\n"
    "          && hAf.indexOf('伤兵营') >= 0 && hAf.indexOf('俘虏营') >= 0;\n"
    "      } finally { G.ui._marchTab = keepTab; }\n"
    "    })());\n"
)
sm = rep1(sm, old_e, new_e, 'E 只在军务处')

# F. 新增 §113 段
anchor_f = (
    "    G.state = keep111;\n"
    "  })();\n"
    "\n"
    "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');\n"
)
sec113 = r'''    G.state = keep111;
  })();

  /* ═══════════════════════════════════════════════════════════
   * §113（v89.132 · 老板 4 条）：军务处 / 缩略地图 / 节钺开拓
   *   ① 军务处两营左右分列（camp-cards）+ 均列逐兵种；总览两营区退役；
   *      「兵源与征募」「军心」两卡退役；
   *   ② 缩略图：城名去 bold、我城红点（大号档）、我城名称层、波纹 + 底部闪烁；
   *   ③ 节钺开拓：三族扩编（city/xc/gen）真调 + 上限 + 前置 + 余额 + 面板渲染。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs113 = require('fs'), path113 = require('path');
    var uS113 = fs113.readFileSync(path113.join(__dirname, 'js', 'ui.js'), 'utf8');
    var hS113 = fs113.readFileSync(path113.join(__dirname, 'index.html'), 'utf8');
    var mS113 = fs113.readFileSync(path113.join(__dirname, 'js', 'main.js'), 'utf8');
    var keep113 = G.state;

    console.log('\n===== 113. v89.132：军务处 · 缩略地图 · 节钺开拓 =====');
    var st113 = G.newGame({ name: '测', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    G.state = st113;
    if (!st113.map.grid) G.map.generate();
    var c113 = st113.cities[0];
    G.ui._cityId = c113.id;

    /* ---------- ① 军务处 ---------- */
    console.log('  --- ① 军务处（两营左右分列 / 总览不要两营 / 兵源军心不要）---');
    st113.wounded = 15; st113.woundedArmy = { yibing: 12, gongjian: 3 };
    st113.captives = { qingji: 5, changqiang: 8 };
    check('§113① 军务处两营**左右分列**（camp-cards）且各列逐兵种', (function () {
      var h = G.ui.marchAffairsHTML();
      return h.indexOf('class="camp-cards"') >= 0
        && (h.match(/class="camp-card"/g) || []).length === 2
        && h.indexOf('义兵') >= 0 && h.indexOf('弓箭手') >= 0
        && h.indexOf('轻骑兵') >= 0 && h.indexOf('长枪兵') >= 0;
    })());
    check('§113① 「兵源与征募」「军心」两卡退役（军务处只剩两营）', (function () {
      var h = G.ui.marchAffairsHTML();
      return h.indexOf('兵源与征募') < 0 && h.indexOf('军心') < 0;
    })());
    check('§113① 军务总览不再列两营（四段齐 · 无 ⑤ 区 · 统计行无伤兵项）', (function () {
      var keepTab = G.ui._marchTab;
      try {
        G.ui._marchTab = 'over';
        var h = G.ui.marchesHTML();
        return h.indexOf('⑤ 两营') < 0 && h.indexOf('伤兵营') < 0 && h.indexOf('俘虏营') < 0
          && h.indexOf('① 城内') >= 0 && h.indexOf('② 驻守野地') >= 0
          && h.indexOf('③ 采集队') >= 0 && h.indexOf('④ 行军') >= 0
          && h.indexOf('　·　伤兵 ') < 0;
      } finally { G.ui._marchTab = keepTab; }
    })());
    check('§113① campCard 单形态（compact 档整条退役、无残留）', (function () {
      return /ui\.campCard = function \(kind\) \{/.test(uS113)
        && uS113.indexOf('compact: true') < 0;
    })());

    /* ---------- ② 缩略地图 ---------- */
    console.log('  --- ② 缩略图（字细 / 我城红点 / 当前城波纹 · 底部闪烁）---');
    check('§113② 城名层去 bold + 描边减细（0.12fs）', (function () {
      return uS113.indexOf("'bold ' + fs + 'px sans-serif'") < 0
        && uS113.indexOf("'normal ' + fs + 'px sans-serif'") >= 0
        && uS113.indexOf('fs * 0.12') >= 0;
    })());
    var FAKE113 = function () {
      var rec = { arcs: [], strokes: 0, fills: [] };
      return {
        rec: rec,
        set fillStyle(v) { rec.lastFill = v; }, get fillStyle() { return rec.lastFill; },
        set strokeStyle(v) { }, set lineWidth(v) { }, set globalAlpha(v) { },
        set font(v) { }, set textAlign(v) { }, set textBaseline(v) { },
        beginPath: function () { }, arc: function (x, y, r) { rec.arcs.push([x, y, r, rec.lastFill]); },
        fill: function () { rec.fills.push(rec.lastFill); }, stroke: function () { rec.strokes++; },
        fillRect: function () { }, clearRect: function () { }, drawImage: function () { },
        strokeText: function () { }, fillText: function () { }, save: function () { },
        restore: function () { }, ellipse: function () { }
      };
    };
    check('§113② 我城红点（miniMeDot）：小档 r=size/100、底部小图大号 r≥3×', (function () {
      var f = FAKE113();
      G.ui.miniMeDot(f, 100, 100, 1000, false);
      G.ui.miniMeDot(f, 100, 100, 1000, true);
      var rs = f.rec.arcs[0][2], rb = f.rec.arcs[1][2];
      var isRed = String(f.rec.arcs[0][3] || '').toLowerCase() === '#ff3a2a';
      return rb > rs * 3 && isRed;
    })());
    check('§113② 波纹（miniMeWave）真画 2 圈；动画层（paintMiniPulse + mini-pulse 画布 + 自灭）', (function () {
      var f = FAKE113();
      G.ui.miniMeWave(f, 100, 100, 1000, 500);
      var two = f.rec.arcs.length === 2 && f.rec.strokes === 2;
      return two && typeof G.ui.paintMiniPulse === 'function'
        && uS113.indexOf("id=\"mini-pulse\"") >= 0
        && uS113.indexOf('ui._miniPulseTimer = null') >= 0
        && mS113.indexOf('ui.paintMiniBottom();') >= 0
        && uS113.indexOf('{ meBig: true, meBlink: true }') >= 0;
    })());
    check('§113② 我城名称层（miniMeLabels）· 图例「我城」色改红（同源）', (function () {
      return typeof G.ui.miniMeLabels === 'function'
        && uS113.indexOf('ui.miniMeLabels(ctx, size, v, _win)') >= 0
        && hS113.indexOf('--lg-me: #ff3a2a') >= 0;
    })());

    /* ---------- ③ 节钺开拓 ---------- */
    console.log('  --- ③ 节钺开拓（三族扩编 city/xc/gen）---');
    var C113 = DATA.JIEYUE;
    check('§113③ 数据表新增 xcMax / genMax（各 2 次）', C113.xcMax === 2 && C113.genMax === 2);
    var preX113 = G.jieyueExpandOf(c113, 'xc');
    var preG113 = G.jieyueExpandOf(c113, 'gen');
    check('§113③ 前置：无校场 / 无招贤馆 → 拒（提示点名前置）',
      preX113.ok === false && preX113.msg.indexOf('校场') >= 0
      && preG113.ok === false && preG113.msg.indexOf('招贤馆') >= 0,
      'xc=「' + preX113.msg + '」gen=「' + preG113.msg + '」');
    var put113 = function (bid) {
      var idx = -1;
      (c113.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
      c113.cells[idx] = { build: { id: bid, lvl: 2 } };
    };
    put113('xiaochang'); put113('zhaoxianguan');
    st113.jieyue = 10;
    var capA113 = G.battle.marchCapOf(c113);
    var rx1_113 = G.jieyueExpand('xc', c113.id);
    var capB113 = G.battle.marchCapOf(c113);
    check('§113③ 校场扩编：真调 OK 且出征容量真涨（≥ +1 万，等效校场 +1 级）',
      rx1_113.ok === true && rx1_113.used === 0 && (capB113 - capA113) >= 10000,
      U.fmt(capA113) + ' → ' + U.fmt(capB113) + '（差 ' + U.fmt(capB113 - capA113) + '）');
    var slA113 = G.genSlotsOf(c113);
    var rg1_113 = G.jieyueExpand('gen', c113.id);
    check('§113③ 招贤纳士：真调 OK 且席位真 +1',
      rg1_113.ok === true && G.genSlotsOf(c113) === slA113 + 1,
      slA113 + ' → ' + G.genSlotsOf(c113));
    G.jieyueExpand('xc', c113.id); G.jieyueExpand('gen', c113.id);
    var capC113 = G.battle.marchCapOf(c113), slB113 = G.genSlotsOf(c113);
    var rx3_113 = G.jieyueExpand('xc', c113.id);
    var rg3_113 = G.jieyueExpand('gen', c113.id);
    check('§113③ 上限：各至多 2 次（第 3 次被拒 · 容量/席位不再涨）',
      rx3_113.ok === false && rx3_113.msg.indexOf('上限') >= 0
      && rg3_113.ok === false && rg3_113.msg.indexOf('上限') >= 0
      && G.battle.marchCapOf(c113) === capC113 && G.genSlotsOf(c113) === slB113,
      '第3次 xc=「' + rx3_113.msg + '」');
    st113.jieyue = 0;
    var rb113 = G.jieyueExpand('city', c113.id);
    check('§113③ 余额不足 → 拒且不改状态（三种 kind 同源判据）',
      rb113.ok === false && rb113.msg.indexOf('节钺不足') >= 0
      && (c113.jieyueSlots || 0) === 0);
    st113.jieyue = 1;
    var bs0_113 = G.buildSlots(c113);
    var rc113 = G.jieyueExpand('city', c113.id);
    check('§113③ 城建扩编（旧链）走同一出口：建造位 +1',
      rc113.ok === true && G.buildSlots(c113) === bs0_113 + 1);
    check('§113③ 三项入口按钮真渲染（校场 / 招贤馆面板 + 节钺行可点）', (function () {
      var hx = '', hz = '', hl = '';
      try {
        G.ui.closeAllModals();
        G.ui.openXiaochang();
        hx = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        G.ui.closeAllModals();
        G.ui.openHostel();
        hz = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        G.ui.closeAllModals();
        G.ui.openLordInfo();
        hl = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        G.ui.closeAllModals();
      } catch (e) { hx = hz = hl = 'ERR:' + e.message; }
      return hx.indexOf('data-action="jieyue-xc"') >= 0
        && hz.indexOf('data-action="jieyue-gen"') >= 0
        && hl.indexOf('data-action="open-jieyue"') >= 0
        && hx.indexOf('校场扩编') >= 0 && hz.indexOf('招贤纳士') >= 0;
    })());
    check('§113③ openJieyue 面板：余额 + 来源 + 四用途 + 全境进度（真渲染）', (function () {
      var t = '';
      try {
        G.ui.closeAllModals();
        G.ui.openJieyue();
        t = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        G.ui.closeAllModals();
      } catch (e) { t = 'ERR:' + e.message; }
      return t.indexOf('节钺') >= 0 && t.indexOf('首占名城') >= 0 && t.indexOf('问鼎天授') >= 0
        && t.indexOf('校场扩编') >= 0 && t.indexOf('招贤纳士') >= 0 && t.indexOf('全境扩编') >= 0;
    })());

    G.state = keep113;
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
'''
sm = rep1(sm, anchor_f, sec113, 'F 新增§113')
wr('smoke-test.js', sm)

# ============================================================
# e2e-test.js
# ============================================================
e = rd('e2e-test.js')

old_e1 = (
    "  G.ui.setView('marches');\n"
    "  await sleep(80);\n"
    "  const marches21_v21 = vc.innerHTML;\n"
    "  /* v89.117（老板「还是没有俘虏营或者降兵营…要让玩家看得到」）：\n"
    "     军务总览 ⑤ 段改**两营并列紧凑卡**（不再是单独 woundedBlock 的 data-heal-host=\"view\"）——\n"
    "     判据随容器变：两营都在 + 治疗键在（信息与操作一个不少）。 */\n"
    "  check('行军视图渲染**两营**（伤兵营 + 俘虏营）',\n"
    "    marches21_v21.indexOf('伤兵营') >= 0 && marches21_v21.indexOf('俘虏营') >= 0\n"
    "    && marches21_v21.indexOf('data-action=\"heal-wounded\"') >= 0\n"
    "    && marches21_v21.indexOf('camp-card') >= 0);\n"
    "  check('行军视图给出数量与治疗费（信息型）',\n"
    "    marches21_v21.indexOf('777') >= 0 && marches21_v21.indexOf('7,770') >= 0);\n"
)
new_e1 = (
    "  /* v89.132（老板「军务总览里边，不需要两营这个菜单，只在军务处即可」）：\n"
    "     两营落点改到**军务处页签**（camp-cards 左右分列）—— 判据随落点走。 */\n"
    "  G.ui._marchTab = 'over';\n"
    "  G.ui.setView('marches');\n"
    "  await sleep(80);\n"
    "  const marches21_v21 = vc.innerHTML;\n"
    "  check('军务总览四段齐、不再列两营（⑤ 区已退役）',\n"
    "    marches21_v21.indexOf('① 城内') >= 0 && marches21_v21.indexOf('④ 行军') >= 0\n"
    "    && marches21_v21.indexOf('伤兵营') < 0);\n"
    "  G.ui._marchTab = 'affairs';\n"
    "  G.ui.setView('marches');\n"
    "  await sleep(80);\n"
    "  const affairs21_v21 = vc.innerHTML;\n"
    "  check('军务处页签渲染**两营左右分列**（伤兵营 + 俘虏营 + 治疗键）',\n"
    "    affairs21_v21.indexOf('伤兵营') >= 0 && affairs21_v21.indexOf('俘虏营') >= 0\n"
    "    && affairs21_v21.indexOf('data-action=\"heal-wounded\"') >= 0\n"
    "    && affairs21_v21.indexOf('camp-cards') >= 0);\n"
    "  check('军务处给出数量与治疗费（信息型）',\n"
    "    affairs21_v21.indexOf('777') >= 0 && affairs21_v21.indexOf('7,770') >= 0);\n"
    "  G.ui._marchTab = 'over';\n"
)
e = rep1(e, old_e1, new_e1, 'e2e A 两营落点')

old_e2 = (
    "      check('v89.86（P-20）：军务总览五段齐（城内 / 驻守野地 / 采集队 / 行军 / **两营**）',\n"
    "        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') >= 0 && mv86.indexOf('③ 采集队') >= 0\n"
    "        && mv86.indexOf('④ 行军') >= 0 && mv86.indexOf('⑤ 两营') >= 0\n"
    "        && mv86.indexOf('伤兵营') >= 0 && mv86.indexOf('俘虏营') >= 0);\n"
)
new_e2 = (
    "      /* v89.132（老板）：两营区自总览退役（只在军务处）—— 总览四段齐。 */\n"
    "      check('v89.132：军务总览四段齐（城内 / 驻守野地 / 采集队 / 行军）· 两营不在总览',\n"
    "        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') >= 0 && mv86.indexOf('③ 采集队') >= 0\n"
    "        && mv86.indexOf('④ 行军') >= 0 && mv86.indexOf('⑤ 两营') < 0);\n"
)
e = rep1(e, old_e2, new_e2, 'e2e B 五段→四段')
wr('e2e-test.js', e)

print('OK · smoke-test.js', len(sm), '· e2e-test.js', len(e))
