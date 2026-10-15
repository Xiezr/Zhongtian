# -*- coding: utf-8 -*-
"""v26 批九：smoke 第 39 节 —— v26 五项需求的防回退断言
风格与既有各节一致：结构断言 + **真跑逻辑**的行为断言，能测行为就不测字符串。
"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SECTION = r'''
  /* ============================================================
   * 39. v26：将领经验可操作 / 将领详情五维 / 天时入顶栏 /
   *          地图观察框 12×8 / 城内城外入顶栏
   * ============================================================ */
  console.log('\n===== 39. v26 经验·五维·天时·观察框·城内外 =====');
  var fs39 = require('fs'), path39 = require('path');
  var rd39 = function (f) { return fs39.readFileSync(path39.join(__dirname, f), 'utf8'); };
  var uS39 = rd39('js/ui.js'), hS39 = rd39('index.html'), mS39 = rd39('js/main.js');
  var dS39 = rd39('js/domain.js'), bS39 = rd39('js/battle.js');
  var sS39 = rd39('js/state.js'), syS39 = rd39('js/systems.js');

  /* ---- 需求 1：经验可操作 ---- */
  console.log('  --- ① 将领经验 ---');
  check('升级所需经验只有一处口径（GAME.expNeedOf）',
    /GAME\.expNeedOf = function/.test(dS39)
    && GAME.expNeedOf({ level: 1 }) === 100 && GAME.expNeedOf({ level: 4 }) === 1600,
    'Lv1=' + GAME.expNeedOf({ level: 1 }) + ' Lv4=' + GAME.expNeedOf({ level: 4 }));
  check('获取经验只有一个入口（gainExp），源码里没有裸加 exp', (function () {
    var all = bS39 + '|' + dS39 + '|' + syS39;
    /* 注释里会提到旧写法，先剥掉行注释再找 */
    var code = all.split('\n').map(function (l) { return l.replace(/\/\*[\s\S]*?\*\//g, '').split('//')[0]; }).join('\n');
    return /GAME\.battle\.gainExp = function/.test(bS39) && !/\.exp \+=/.test(code);
  })());
  check('实测：gainExp 加经验并按等级²×100 自动升级', (function () {
    var g = { level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, rank: 'fan', style: 'balance', equip: {}, perm: {} };
    var r = G.battle.gainExp(g, 250, '单测');
    /* Lv1 需 100 → 升到 2 级，余 150；Lv2 需 400 不够 */
    return r && r.gain === 250 && g.level === 2 && g.exp === 150 && r.up === 1;
  })());
  check('实测：一次给足经验会连升多级', (function () {
    var g = { level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, rank: 'fan', style: 'balance', equip: {}, perm: {} };
    var r = G.battle.gainExp(g, 100 + 400 + 900, '单测');
    return g.level === 4 && g.exp === 0 && r.up === 3;
  })());
  check('三处战斗经验都走 gainExp（入侵/侦察/攻占）',
    (bS39.match(/GAME\.battle\.gainExp\(gen/g) || []).length >= 3
    && /'侦察 '/.test(bS39) && /'攻占 '/.test(bS39));
  check('战报正文体现经验（含连升提示）',
    /result\.expInfo/.test(bS39) && /经验：/.test(bS39) && /连升 /.test(bS39));
  check('将领详情给经验进度条 + 距升级差额',
    /gd-expbar/.test(uS39) && /距 Lv/.test(uS39) && /g\.exp \|\| 0/.test(uS39));
  check('将领详情列出背包经验道具，可「用 1 个 / 用到升级」',
    /data-action="gen-exp-item"/.test(uS39) && /data-mode="one"/.test(uS39)
    && /data-mode="till"/.test(uS39));
  check('批量使用经验道具的实现存在（gainExpByItem）',
    /S\.gainExpByItem = function/.test(syS39) && /mode === 'till'/.test(syS39));
  check('gen-exp-item 动作已注册且原地重开面板', /case 'gen-exp-item'/.test(mS39)
    && /ui\.openGenDetail\(el\.dataset\.gen\)/.test(mS39));
  check('批量使用不刷屏（useItem 支持 silent）', /opts\.silent/.test(syS39)
    && /silent: true/.test(syS39));
  check('实测：「用到升级」只消耗够用的数量', (function () {
    var st = G.state, g = st.generals[0];
    var bk = { lv: g.level, exp: g.exp, items: JSON.stringify(st.items || {}) };
    g.level = 1; g.exp = 0;
    st.items = st.items || {};
    st.items.lianbing_jingyan = 3;           // 每个 +3000，Lv1 只需 100
    var r = G.systems.gainExpByItem('lianbing_jingyan', g.id, 'till');
    var ok = r.ok && r.used === 1 && st.items.lianbing_jingyan === 2 && g.level >= 2;
    g.level = bk.lv; g.exp = bk.exp;
    st.items = JSON.parse(bk.items);
    return ok;
  })());
  check('实测：「用 1 个」严格只扣 1 个', (function () {
    var st = G.state, g = st.generals[0];
    var bk = { lv: g.level, exp: g.exp, items: JSON.stringify(st.items || {}) };
    g.level = 1; g.exp = 0;
    st.items = st.items || {};
    st.items.bingfa_xinde = 5;
    var r = G.systems.gainExpByItem('bingfa_xinde', g.id, 'one');
    var ok = r.ok && r.used === 1 && r.gain === 30000 && st.items.bingfa_xinde === 4;
    g.level = bk.lv; g.exp = bk.exp;
    st.items = JSON.parse(bk.items);
    return ok;
  })());
  check('实测：背包没有该道具时明确拒绝，不静默', (function () {
    var st = G.state, g = st.generals[0];
    var bk = JSON.stringify(st.items || {});
    st.items = st.items || {};
    delete st.items.zhijun_zhidao;
    var r = G.systems.gainExpByItem('zhijun_zhidao', g.id, 'till');
    st.items = JSON.parse(bk);
    return r.ok === false && /没有/.test(r.msg);
  })());

  /* ---- 需求 2：将领详情（左头像 · 右五维）---- */
  console.log('  --- ② 五维与丹药 ---');
  check('五维定义 5 项且第 5 维是速度', (function () {
    var D = G.ui.GEN_DIMS;
    return D.length === 5 && D[4].k === 'spd' && D[4].n === '速度'
      && D[0].k === 'tong' && D[1].k === 'yw' && D[2].k === 'zm' && D[3].k === 'nz';
  })());
  check('「作用」一律写「每点…」，不含会随装备变动的计算值',
    G.ui.GEN_DIMS.every(function (d) { return /^每点/.test(d.use) && !/%\d|=\s*\d/.test(d.use); }),
    G.ui.GEN_DIMS.map(function (d) { return d.n + ':' + d.use; }).join(' | ').slice(0, 90));
  check('速度的作用写明「行军速度与战斗速度 1 点」（求和口径）',
    /每点增加全军行军速度与战斗速度 1 点/.test(G.ui.GEN_DIMS[4].use));
  check('实测：丹药不再被算两次（perm 已写进基础，genAttrs 不再叠加）', (function () {
    var g = { level: 1, tong: 50, yw: 50, zm: 50, nz: 50, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance',
      perm: { tong: 5, nz: 0, yw: 0, zm: 0 } };
    /* 旧实现 = 50 + 5 = 55（用户抱怨"嗑药的怎么就不基础了"，就是这里） */
    return G.genAttrs(g).tong === 50;
  })());
  check('实测：吃一颗永久丹药只 +1（不是 +2）', (function () {
    var st = G.state;
    var g = G.makeGeneral('丹药测试', 1, 'idle', null, true, 'fan', 'balance');
    var base = g.tong;
    var bk = JSON.stringify(st.items || {});
    st.items = st.items || {};
    st.items.fengwang_migao = 1;
    G.systems.useItem('fengwang_migao', g.id);
    var attrs = G.genAttrs(g);
    st.items = JSON.parse(bk);
    return g.tong === base + 1 && attrs.tong === base + 1;
  })());
  check('实测：速度按「求和」计入战斗先手（线性相加，非乘算）', (function () {
    var base = { yibing: 1000 };
    var g1 = { level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance', perm: {} };
    var g2 = JSON.parse(JSON.stringify(g1)); g2.speed = 410;
    /* 己方速度高到一定程度就该抢到先手；速度完全不影响时两者结果相同 */
    return G.battle.firstStrike(base, base, g1, null) === false ||
      G.battle.firstStrike(base, base, g2, null) === true
      ? /if \(atkGen\) a \+= \(GAME\.genAttrs\(atkGen\)\.spd \|\| 0\)/.test(bS39)
      : false;
  })());
  check('实测：速度确实加快行军（此前将领速度对行军毫无作用＝死属性）', (function () {
    var army = { yibing: 200 };
    var slow = { level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance', perm: {} };
    var fast = JSON.parse(JSON.stringify(slow)); fast.speed = 310;
    var t1 = G.march.travelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, army, null, slow);
    var t2 = G.march.travelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, army, null, fast);
    var noGen = G.march.travelTime({ x: 0, y: 0 }, { x: 10, y: 0 }, army);
    return t2 < t1 && t1 > 0 && noGen > 0;
  })(), '慢将 / 快将的抵达时间应不同');
  check('公式注释与实现一致（a += spd，不再是 ×(1+spd/200)）',
    !/a \*= \(1 \+ \(GAME\.genAttrs\(atkGen\)\.spd \|\| 0\) \/ 200\)/.test(bS39));
  check('详情为两栏（左头像 · 右属性）', /class="gd-hero"/.test(uS39)
    && /class="gd-face"/.test(uS39) && /class="gd-side"/.test(uS39));
  check('五维表只有一个数值列', (function () {
    var i = uS39.indexOf('<th>五维</th>');
    var head = i < 0 ? '' : uS39.slice(i, uS39.indexOf('</thead>', i));
    return (head.match(/<th/g) || []).length === 3 && /作用（每点）/.test(head)
      && head.indexOf('合计') < 0 && head.indexOf('装备/丹') < 0;
  })());
  check('计算值集中在「当前效果」一栏', /gd-effect/.test(uS39) && /当前效果/.test(uS39));
  check('实测：详情渲染出 5 行五维、速度为真值（不再是恒 0）', (function () {
    var st = G.newGame({ name: '五维' });
    var g = st.generals[0];
    G.ui.openGenDetail(g.id);
    var h = global.document.querySelector('#modal-root').innerHTML;
    var rows = (h.match(/gd-v">(\d+)</g) || []);
    var ok = rows.length === 5 && G.genAttrs(g).spd > 0 && h.indexOf('速度') > 0;
    G.ui.closeModal();
    return ok;
  })());
  check('速度有出身值（GEN_BASE.speed 不再是 0）', DATA.GEN_BASE.speed > 0, 'speed=' + DATA.GEN_BASE.speed);
  check('实测：速度随等级成长（每级 +1，派生而不写存档）', (function () {
    var g = { level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance', perm: {} };
    var a1 = G.genAttrs(g).spd;
    g.level = 11;
    return G.genAttrs(g).spd === a1 + 10;
  })());

  /* ---- 需求 3：天时入顶栏 ---- */
  console.log('  --- ③ 天时入顶栏 ---');
  check('顶栏有天时元素（在「设置」与「存档」之间）', (function () {
    var i = hS39.indexOf('class="topnav"');
    var nav = hS39.slice(i, hS39.indexOf('id="screen-game"') > i
      ? hS39.indexOf('</div>', hS39.indexOf('data-action="new-game"')) : i + 4000);
    var iSky = nav.indexOf('id="nav-sky"');
    var iSet = nav.indexOf('data-view="settings"');
    var iSave = nav.indexOf('data-action="save"');
    return iSky > 0 && iSet >= 0 && iSave >= 0 && iSet < iSky && iSky < iSave;
  })());
  check('天时推到偏右（margin-left:auto）', /\.nav-sky \{[\s\S]{0,120}margin-left: auto/.test(hS39));
  check('侧栏城池属性里不再有天时',
    !/sky-line/.test(uS39) && !/天时<\/span>/.test(uS39));
  check('.sky-line 样式已随元素一起删除（不留死样式）', !/\.sky-line/.test(hS39));
  check('顶栏天时随 syncHeader 刷新', /var sky = \$\('#nav-sky'\)/.test(uS39)
    && /story\.skyLine/.test(uS39));
  check('实测：syncHeader 真的把天时写进顶栏', (function () {
    var el = DC['#nav-sky'];
    if (!el) return false;
    G.ui.syncHeader();
    var want = G.story ? G.story.skyLine() : '';
    return want && el.innerHTML.indexOf(want) > 0;
  })());

  /* ---- 需求 4：地图观察框 12×8 ---- */
  console.log('  --- ④ 观察框 12×8 ---');
  check('观察框常量为 12×8、格距 52',
    /MAP_SPAN_X = 12, MAP_SPAN_Y = 8, MAP_CELL = 52/.test(uS39));
  check('render 支持 spanX / spanY（宽高可不等）',
    /opts\.spanX \|\| opts\.span/.test(rd39('js/map.js')) && /opts\.spanY/.test(rd39('js/map.js')));
  check('实测：渲染后记录 spanX / spanY，画布 12×8 格',
    (function () {
      var cv = global.document.createElement('canvas');
      G.map.render(cv, { vx: 10, vy: 20, spanX: 12, spanY: 8, cell: 52 });
      var v = G.map._view;
      return v.spanX === 12 && v.spanY === 8 && v.cvW === 624 && v.cvH === 416;
    })());
  check('实测：越界钳制按宽高各用各的上限', (function () {
    var cv = global.document.createElement('canvas');
    G.map.render(cv, { vx: 99999, vy: 99999, spanX: 12, spanY: 8, cell: 52 });
    var v = G.map._view;
    return v.vx === DATA.MAP_W - 12 && v.vy === DATA.MAP_H - 8;
  })());
  check('实测：纵向只有 8 格，第 9 行拾取为空（不会越界取格）', (function () {
    var cv = global.document.createElement('canvas');
    G.map.render(cv, { vx: 0, vy: 0, spanX: 12, spanY: 8, cell: 52 });
    var old = cv.getBoundingClientRect;
    cv.getBoundingClientRect = function () {
      return { left: 0, top: 0, width: cv.width, height: cv.height };
    };
    var inside = G.map.pick(cv, 52 * 5 + 26, 52 * 7 + 26);
    var outside = G.map.pick(cv, 52 * 5 + 26, 52 * 8 + 26);
    cv.getBoundingClientRect = old;
    return inside && inside.x === 5 && inside.y === 7 && outside === null;
  })());
  check('浮标让位随画布变矮一起收窄', /padding-bottom: 78px/.test(hS39));

  /* ---- 需求 5：城内 / 城外 入顶栏 ---- */
  console.log('  --- ⑤ 城内城外入顶栏 ---');
  check('顶栏含「城池」与「城外」两个平级菜单',
    /data-view="city"[\s\S]{0,90}城池/.test(hS39) && /data-view="ext"[\s\S]{0,90}城外/.test(hS39));
  check('子页签与 city-sub 动作链已彻底移除',
    !/id="subtabs"/.test(hS39) && !/data-action="city-sub"/.test(hS39)
    && !/case 'city-sub'/.test(mS39) && !/ui\.setCitySub/.test(uS39) && !/_citySub/.test(uS39));
  check('renderView 把 city / ext 当同一类场景（侧栏都保留）',
    /var isCity = \(v === 'city' \|\| v === 'ext'\)/.test(uS39));
  check('「城外」有顶栏图标', /'ext'/.test(rd39('js/icons.js')) || /ext: '</.test(rd39('js/icons.js')));
  check('实测：setView("ext") 渲染出城外棋盘且顶栏高亮跟着走', (function () {
    var bk = UI.view;
    UI.setView('ext');
    var el = DC['#view-container'];
    var ok = UI.view === 'ext' && el && /city-iso/.test(el.innerHTML);
    UI.setView(bk || 'city');
    return ok;
  })());
'''

p = 'smoke-test.js'
s = open(p, encoding='utf-8').read()
anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert s.count(anchor) == 1
s = s.replace(anchor, SECTION + '\n' + anchor, 1)
open(p, 'w', encoding='utf-8').write(s)
print('smoke-test.js：已追加第 39 节（v26）')
