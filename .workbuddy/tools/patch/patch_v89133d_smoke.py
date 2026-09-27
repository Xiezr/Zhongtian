# -*- coding: utf-8 -*-
"""v89.133 补丁 P3：smoke 断言更新（10 处）+ 下拉白名单 + 新增 §114
跑：python .workbuddy/tools/patch/patch_v89133d_smoke.py
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

sm = rd('smoke-test.js')

# ============ 0) ui.js：两个新 select 加 class（样式 + 白名单双保险）============
ui = rd('js/ui.js')
ui = rep1(ui, '\'<select data-action="exp-act-target">\'',
          '\'<select class="city-select" data-action="exp-act-target">\'', 'ui exp-act-target')
ui = rep1(ui, '\'<select data-action="xc-gen-pick">\'',
          '\'<select class="city-select" data-action="xc-gen-pick">\'', 'ui xc-gen-pick')
wr('js/ui.js', ui)

# ============ 1) 白名单：data-action 的 select 视为在册 ============
old_wl = ("        || /^<select id=\"' \\+ id \\+ '\">$/.test(tag);     /* openAutoMarch 的参数化构造器（其余九项） */\n")
new_wl = ("        || /^<select id=\"' \\+ id \\+ '\">$/.test(tag)     /* openAutoMarch 的参数化构造器（其余九项） */\n"
          "        /* v89.133：带 data-action 的 select（走全局 change 委托 → GAME.action）——\n"
          "           动作表受 audit「孤儿按钮」兜底（无 case 即红），比只登记 id 更严。 */\n"
          "        || /data-action=\"[a-z-]+\"/.test(tag);\n")
sm = rep1(sm, old_wl, new_wl, '1 白名单')

# ============ 2) 攻击/防御合计口径 → 构成进悬停 ============
old_a = ("  check('攻击/防御走合计口径（攻值/防值 = 属性 + 装备，并报出全军百分比）', (function () {\n"
         "    var seg = codeOf(uiS, 'ui.genPane = function');\n"
         "    var i = seg.indexOf('gd-line\\\">攻击');\n"
         "    var line = seg.slice(i, seg.indexOf('</div>', i));\n"
         "    return /a\\.atkVal/.test(line) && /a\\.atk\\b/.test(line) && /atkShow/.test(line)\n"
         "      && /a\\.yw \\* GAME\\.ATK_PER_YW/.test(line);\n"
         "  })());\n")
new_a = ("  /* v89.133（老板）：「'勇武 18,890 ＋ 装备 685'这个备注不要」——\n"
         "     构成（勇武×系数 ＋ 装备）移入 **title 悬停**，行上只留总数 + 全军加成。 */\n"
         "  check('攻击/防御走合计口径（攻值/防值 = 属性 + 装备；构成进悬停 · v89.133）', (function () {\n"
         "    var seg = codeOf(uiS, 'ui.genPane = function');\n"
         "    var i = seg.indexOf('title=\"攻击 ');\n"
         "    var line = seg.slice(i, seg.indexOf('</div>', i));\n"
         "    return /a\\.atkVal/.test(line) && /atkShow/.test(line)\n"
         "      && /a\\.yw \\* GAME\\.ATK_PER_YW/.test(line)     /* 构成仍在（title 里） */\n"
         "      && line.indexOf('gd-hint\\\">勇武') < 0;          /* 但不再占行面（v89.133 老板撤除） */\n"
         "  })());\n")
sm = rep1(sm, old_a, new_a, '2 攻防口径')

# ============ 3) 校场面板三条 + host ===
old_x1 = ("  check('校场面板含伤兵营',\n"
          "    /ui\\.openXiaochang = function/.test(uS34) && /woundedBlock\\('xiaochang'\\)/.test(uS34));\n")
new_x1 = ("  /* v89.133（v89.128 第二批第 10 条 · 老板）：「校场不要现在的界面功能，点击建筑功能\n"
          "     直接进入'军务'界面」—— 面板退役；伤兵营落点仍是军务处，练兵迁「出征战术」页尾。 */\n"
          "  check('校场面板退役（演武/阅兵迁「出征战术」页尾 · 伤兵营仍在军务处）',\n"
          "    !/ui\\.openXiaochang = function/.test(uS34)\n"
          "    && /ui\\.trainBlockHTML = function/.test(uS34)\n"
          "    && /ui\\.woundedBlock = function \\(host\\)/.test(uS34));\n")
sm = rep1(sm, old_x1, new_x1, '3a 校场面板')

old_x2 = ("  check('校场入口指向校场面板（v89.80 标签补「练兵」）',\n"
          "    /xiaochang: \\{ label: \"🏹 出征 · 练兵 · 伤兵\", act: \"open-xiaochang\" \\}/.test(uS34)\n"
          "    && !/act: \"open-panel\", view: \"map\"/.test(uS34));\n")
new_x2 = ("  check('校场入口指向军务（v89.133 标签：进入军务）',\n"
          "    /xiaochang: \\{ label: \"🏹 进入军务（出征 · 练兵 · 伤兵）\"/.test(uS34)\n"
          "    && !/act: \"open-panel\", view: \"map\"/.test(uS34));\n")
sm = rep1(sm, old_x2, new_x2, '3b 校场入口')

old_x3 = ("  check('open-xiaochang 动作已注册',\n"
          "    /case 'open-xiaochang': ui\\.openXiaochang\\(\\);/.test(mS34) && /case 'xiaochang-exp':/.test(mS34));\n")
new_x3 = ("  check('open-xiaochang 动作 = 跳军务视图（校场面板退役；出兵地图随面板退场）',\n"
          "    /case 'open-xiaochang': ui\\.setView\\('marches'\\); ui\\._marchTab = 'over';/.test(mS34)\n"
          "    && mS34.indexOf(\"case 'xiaochang-exp'\") < 0);\n")
sm = rep1(sm, old_x3, new_x3, '3c open-xiaochang')

old_h = ("  check('治疗后重绘弹窗（否则「点了没反应」）',\n"
         "    /data-heal-host/.test(uS34) && /else if \\(k === 'marches'\\) ui\\.openMarches\\(\\);/.test(mS34));\n")
new_h = ("  check('治疗后重绘弹窗（host 只剩行军队列弹窗；xiaochang 宿主随面板退役）',\n"
         "    /data-heal-host/.test(uS34) && /if \\(k === 'marches'\\) ui\\.openMarches\\(\\);/.test(mS34)\n"
         "    && mS34.indexOf(\"k === 'xiaochang'\") < 0);\n")
sm = rep1(sm, old_h, new_h, '3d doHeal')

# ============ 4) 烽火指路行（两处）============
old_b1 = ("      check('⑥ 烽火页精简为「预警 + 布防」（规则块与流水已迁走，留指路行）',\n"
          "        pgB92.indexOf('自动化 · 外敌来犯') >= 0\n"
          "        && pgB92.indexOf('来犯 · 触发与规则') < 0\n"
          "        && pgB92.indexOf('bb-line beacon') < 0);\n")
new_b1 = ("      /* v89.133（v89.128 第二批第 15 条 · 老板）：「军方的烽火，去掉这种备注行」——\n"
          "         连指路行一并撤除（规则与流水仍在「自动化 · 外敌来犯」）。 */\n"
          "      check('⑥ 烽火页精简为「预警 + 布防」（规则块与流水已迁走；指路行也已撤）',\n"
          "        pgB92.indexOf('自动化 · 外敌来犯') < 0\n"
          "        && pgB92.indexOf('来犯 · 触发与规则') < 0\n"
          "        && pgB92.indexOf('bb-line beacon') < 0);\n")
sm = rep1(sm, old_b1, new_b1, '4a 烽火行(92)')

old_b2 = ("    check('③ 规则块与烽火流水在自动化面板；军务·烽火只剩预警与布防（留指路行）', (function () {\n")
new_b2 = ("    check('③ 规则块与烽火流水在自动化面板；军务·烽火只剩预警与布防（v89.133 指路行亦撤）', (function () {\n")
sm = rep1(sm, old_b2, new_b2, '4b 烽火行标题')

old_b3 = ("          && page.indexOf('bb-line beacon') < 0\n"
          "          && page.indexOf('自动化 · 外敌来犯') >= 0\n"
          "          && page.indexOf('策略布防') >= 0;\n")
new_b3 = ("          && page.indexOf('bb-line beacon') < 0\n"
          "          && page.indexOf('自动化 · 外敌来犯') < 0      /* v89.133：指路行撤除 */\n"
          "          && page.indexOf('策略布防') >= 0;\n")
sm = rep1(sm, old_b3, new_b3, '4c 烽火行判据')

# ============ 5) 校场面板写人马 → 出征页写容量 ============
old_c = ("    check('① 界面口径：校场面板写「人马」且走唯一出口 marchCapOf', (function () {\n"
         "      var _fs = require('fs'), _p = require('path');\n"
         "      var src = _fs.readFileSync(_p.join(__dirname, 'js/ui.js'), 'utf8');\n"
         "      var key = '出征'\n"
         "        + String.fromCharCode(0x5175) + String.fromCharCode(0x529b) + String.fromCharCode(0x4e0a) + String.fromCharCode(0x9650);\n"
         "      /* v89.132：口径收口 —— 建筑面板 / 校场面板都读 marchCapOf（节钺扩编才跟得上） */\n"
         "      return src.indexOf(key) >= 0 && src.indexOf('marchCapOf') >= 0;\n"
         "    })());\n")
new_c = ("    /* v89.133：校场面板退役 —— 口径落点改「军务 · 出征」页（容量行 + 节钺扩编入口）。 */\n"
         "    check('① 界面口径：出征页写「出征容量」且走唯一出口 marchCapOf', (function () {\n"
         "      var _fs = require('fs'), _p = require('path');\n"
         "      var src = _fs.readFileSync(_p.join(__dirname, 'js/ui.js'), 'utf8');\n"
         "      var key = '出征'\n"
         "        + String.fromCharCode(0x5BB9) + String.fromCharCode(0x91CF);\n"
         "      return src.indexOf(key) >= 0 && src.indexOf('marchCapOf') >= 0\n"
         "        && /ui\\.marchActHTML = function/.test(src);\n"
         "    })());\n")
sm = rep1(sm, old_c, new_c, '5 校场口径')

# ============ 6) §113③ 三入口（校场面板 → 出征页）============
old_s = ("    check('§113③ 三项入口按钮真渲染（校场 / 招贤馆面板 + 节钺行可点）', (function () {\n"
         "      var hx = '', hz = '', hl = '';\n"
         "      try {\n"
         "        G.ui.closeAllModals();\n"
         "        G.ui.openXiaochang();\n"
         "        hx = (global.document.querySelector('#modal-root') || {}).innerHTML || '';\n"
         "        G.ui.closeAllModals();\n")
new_s = ("    check('§113③ 三项入口按钮真渲染（出征页 / 招贤馆面板 + 节钺行可点）', (function () {\n"
         "      var hx = '', hz = '', hl = '';\n"
         "      var keepTab113 = G.ui._marchTab;\n"
         "      try {\n"
         "        G.ui.closeAllModals();\n"
         "        /* v89.133：校场面板退役 —— 节钺·校场扩编入口改在「军务 · 出征」页 */\n"
         "        G.ui._marchTab = 'act';\n"
         "        G.ui.setView('marches');\n"
         "        hx = (global.document.querySelector('#view-container') || {}).innerHTML || '';\n"
         "        G.ui.closeAllModals();\n")
sm = rep1(sm, old_s, new_s, '6a §113 三入口')

old_s2 = ("      } catch (e) { hx = hz = hl = 'ERR:' + e.message; }\n"
          "      return hx.indexOf('data-action=\"jieyue-xc\"') >= 0\n"
          "        && hz.indexOf('data-action=\"jieyue-gen\"') >= 0\n"
          "        && hl.indexOf('data-action=\"open-jieyue\"') >= 0\n"
          "        && hx.indexOf('校场扩编') >= 0 && hz.indexOf('招贤纳士') >= 0;\n"
          "    })());\n")
new_s2 = ("      } catch (e) { hx = hz = hl = 'ERR:' + e.message; }\n"
          "      finally { G.ui._marchTab = keepTab113; }\n"
          "      return hx.indexOf('data-action=\"jieyue-xc\"') >= 0\n"
          "        && hz.indexOf('data-action=\"jieyue-gen\"') >= 0\n"
          "        && hl.indexOf('data-action=\"open-jieyue\"') >= 0\n"
          "        && hx.indexOf('校场扩编') >= 0 && hz.indexOf('招贤纳士') >= 0;\n"
          "    })());\n")
sm = rep1(sm, old_s2, new_s2, '6b §113 三入口尾')

# ============ 7) 新增 §114 ============
anchor114 = ("    G.state = keep113;\n"
             "  })();\n"
             "\n"
             "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');\n")
sec114 = r'''    G.state = keep113;
  })();

  /* ═══════════════════════════════════════════════════════════
   * §114（v89.133）：v89.128 第二批 9/10/11/13/14/15（军务重构一）
   *   ＋ 老板本轮将领面板三行压缩。
   *   ① 页签体系（出征 / 出征战术 / 防守战术）；② 出征页 = 军事行动入口；
   *   ③ 出征战术两列下拉（无 chip / 无在途）；④ 防守双小页；
   *   ⑥ 校场面板退役（练兵迁出征战术页尾）；⑦ 将领面板三行。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs114 = require('fs'), path114 = require('path');
    var uS114 = fs114.readFileSync(path114.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mS114 = fs114.readFileSync(path114.join(__dirname, 'js', 'main.js'), 'utf8');
    var keep114 = G.state;

    console.log('\n===== 114. v89.133：军务重构一（出征页 / 出征战术 / 防守战术 / 校场）+ 将领面板 =====');
    var st114 = G.newGame({ name: '测', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    G.state = st114;
    if (!st114.map.grid) G.map.generate();
    var c114 = st114.cities[0];
    G.ui._cityId = c114.id;

    /* ---------- ① 页签体系 ---------- */
    console.log('  --- ① 页签体系（第 9 条）---');
    check('§114① 军务六页签 · 出征/防守战术改名 · 顺序（总览→出征→出征战术→防守战术→烽火→军务处）', (function () {
      var t = G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|');
      return t === '军务总览|出征|出征战术|防守战术|烽火|军务处';
    })(), G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|'));

    /* ---------- ② 出征页（act） ---------- */
    console.log('  --- ② 出征页 = 一切军事行动的入口（第 9/11 条）---');
    st114.wilds = st114.wilds || [];
    st114.wilds.push({ x: c114.x + 2, y: c114.y + 2, type: 'plain', level: 1, garrison: null });
    check('§114② 出征页：我方野地进目标列表（全境）+ 目标下拉 + 进入行动键', (function () {
      var arr = G.ui.actTargetsOf(c114);
      var h = G.ui.marchActHTML();
      return arr.length >= 1 && arr[0].tg.kind === 'wild'
        && h.indexOf('data-action="exp-act-target"') >= 0
        && h.indexOf('data-action="exp-act-go"') >= 0;
    })(), '目标 ' + G.ui.actTargetsOf(c114).length + ' 项');
    check('§114② 目标范围写清楚（全境 / 同县 / 14 格内 / 地图点选）', (function () {
      var h = G.ui.marchActHTML();
      return h.indexOf('全境') >= 0 && h.indexOf('同县') >= 0
        && h.indexOf('14 格内') >= 0 && h.indexOf('地图点选') >= 0;
    })());
    check('§114② 节钺·校场扩编入口随面板迁到出征页（入口不丢）', (function () {
      var h = G.ui.marchActHTML();
      return h.indexOf('data-action="jieyue-xc"') >= 0 && h.indexOf('校场扩编') >= 0
        && h.indexOf('marchCapOf') < 0;    /* 走 jieyueExpandOf / marchCapOf 出口（界面不自己算） */
    })());
    check('§114②「进入军队行动」→ openExpModal 原样引用（不另造编队界面）', (function () {
      return /ui\.openExpModal\(_at\.tg\)/.test(mS114);
    })());

    /* ---------- ③ 出征战术（两列下拉 · 无在途） ---------- */
    console.log('  --- ③ 出征战术：两列下拉（第 13 条）---');
    check('§114③ 出征战术：两列网格 + 逐兵种「动作 / 目标」下拉；无 chip、无在途队列', (function () {
      var h = G.ui.marchExpHTML();
      var nSel = (h.match(/class="city-select tl-sel"/g) || []).length;
      return h.indexOf('class="tac-grid"') >= 0 && nSel >= 2
        && h.indexOf('class="chip') < 0 && h.indexOf('🚩 在途') < 0;
    })(), '下拉 ' + ((G.ui.marchExpHTML().match(/class="city-select tl-sel"/g) || []).length) + ' 个');
    check('§114③ 出征战术页含「练兵」块（校场面板退役后演武/阅兵的新家）', (function () {
      var put = function (bid) {
        var idx = -1;
        (c114.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
        c114.cells[idx] = { build: { id: bid, lvl: 2 } };
      };
      put('xiaochang');
      var h = G.ui.marchExpHTML();
      return h.indexOf('练兵') >= 0 && h.indexOf('data-action="xc-spar"') >= 0
        && h.indexOf('data-action="xc-review"') >= 0 && h.indexOf('data-action="xc-gen-pick"') >= 0;
    })());
    check('§114③ 战术下拉变更 → 真调 setTactic（select 路径可用）', (function () {
      var g = G.state.generals[0];
      var before = JSON.stringify(GAME.tacticsOf('atk')['yibing'] || {});
      GAME.setTactic('atk', 'yibing', { s: 'hold' });
      var mid = (GAME.tacticsOf('atk')['yibing'] || {}).s;
      GAME.setTactic('atk', 'yibing', { s: 'advance' });
      var back = (GAME.tacticsOf('atk')['yibing'] || {}).s;
      return mid === 'hold' && back === 'advance';
    })(), 'hold → advance');

    /* ---------- ④ 防守双小页 ---------- */
    console.log('  --- ④ 防守战术：两小页（第 14 条）---');
    check('§114④ 防守页两小页：全境防御（城池清单）/ 防守战术（下拉 + 出城勾选）', (function () {
      var keepSub = G.ui._defSub;
      try {
        G.ui._defSub = 'over';
        var h1 = G.ui.marchDefHTML();
        G.ui._defSub = 'tac';
        var h2 = G.ui.marchDefHTML();
        return h1.indexOf('全境防御') >= 0 && h1.indexOf('class="tbl"') >= 0
          && h1.indexOf('tac-grid') < 0
          && h2.indexOf('防守战术') >= 0 && h2.indexOf('tac-grid') >= 0
          && h2.indexOf('tl-sortie') >= 0 && h2.indexOf('class="tbl"') < 0;
      } finally { G.ui._defSub = keepSub; }
    })());
    check('§114④ 全境防御改名（不再是「全境体检」）', (function () {
      return uS114.indexOf('全境体检') < 0 || /全境体检/.test(uS114) === false;
    })());

    /* ---------- ⑥ 校场 ---------- */
    console.log('  --- ⑥ 校场面板退役（第 10 条）---');
    check('§114⑥ open-xiaochang = 跳军务视图；xiaochang-exp / openXiaochang 全退场', (function () {
      return /case 'open-xiaochang': ui\.setView\('marches'\)/.test(mS114)
        && mS114.indexOf("case 'xiaochang-exp'") < 0
        && uS114.indexOf('ui.openXiaochang') < 0;
    })());

    /* ---------- ⑦ 将领面板三行 ---------- */
    console.log('  --- ⑦ 将领面板三行压缩（本轮老板需求 2）---');
    check('§114⑦ 体力行：`体力 当前/上限` + 悬停（全军生命 / 上限构成 / 回复规则）', (function () {
      var g114 = st114.generals[0];
      var h = G.ui.genPane(g114);
      var iS = h.indexOf('体力 <b>');
      if (iS < 0) return false;
      var sS = h.slice(Math.max(0, iS - 320), iS + 220);
      return /体力 <b>[\d,]+<\/b>\/[\d,]+/.test(sS)     /* 当前/上限 两数连写 */
        && sS.indexOf('当前 ') < 0                      /* 「当前 5,673」备注已撤 */
        && /全军生命 \+/.test(sS);                      /* 加成在 title（悬停）里 */
    })());
    check('§114⑦ 攻击/防御行：去「勇武/智谋 X ＋ 装备 Y」；构成进悬停；全军加成仍在行上', (function () {
      var g114 = st114.generals[0];
      var h = G.ui.genPane(g114);
      var iA = h.indexOf('攻击 <b>'), iD = h.indexOf('防御 <b>');
      if (iA < 0 || iD < 0) return false;
      var sA = h.slice(iA, iA + 260), sD = h.slice(iD, iD + 260);
      return sA.indexOf('全军攻击') >= 0 && sA.indexOf('＋ 装备') < 0
        && sD.indexOf('全军防御') >= 0 && sD.indexOf('＋ 装备') < 0
        && /title="攻击 [\d,.]+ = 勇武 /.test(h) && /title="防御 [\d,.]+ = 智谋 /.test(h);
    })());

    G.state = keep114;
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
'''
sm = rep1(sm, anchor114, sec114, '7 §114')
wr('smoke-test.js', sm)
print('OK · smoke-test.js', len(sm))
