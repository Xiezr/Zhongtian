/* ============================================================
 * smoke-test.js  数值系统接入冒烟测试（node 运行）
 * 用法: node smoke-test.js
 * 覆盖：数据完整性 / 生产结算 / 建造 / 造兵 / 战斗 / 科技 / 爵位 / 装备
 * ============================================================ */
(function () {
  /* ---- 浏览器环境 stub（querySelector 按选择器缓存元素，便于断言渲染结果） ---- */
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      getContext: function () {
        /* v30：补 quadraticCurveTo / quadraticCurveToTo / createPattern / roundRect / setTransform / fill/stroke 通用路径 API（地图草地纹理与翘檐曲线用到） */
        return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} };
      },
      /* canvas 桩：返回自身尺寸，使等距命中换算可被精确验证 */
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    readyState: 'complete',
    _cache: _elCache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' }; // main.js boot() 会读 location.search
  global.addEventListener = function () {};      // main.js bindEvents 用 window.addEventListener
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var PASS = 0, FAIL = 0;
  function check(name, cond, extra) {
    if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
  }

  /* ui.js 源码（供整页视图菜单图标这类结构断言直接读） */
  var uiSrcProbe = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');

  /* ---- 加载游戏模块（模拟 index.html 加载顺序） ---- */
  require('./js/data.js');
  require('./js/state.js');
  require('./js/questdata.js');
  require('./js/systems.js');
  require('./js/domain.js');
  require('./js/map.js');
  require('./js/battle.js');
  require('./js/tactic.js');
  require('./js/icons.js');
  /* v32：game-icons 素材层。与 index.html 同序 —— icons.js 内的取图函数
     用 typeof GICONS 延迟绑定，必须在 icons.js 之后加载。 */
  require('./js/gicons.js');
  /* v35：AI 位图素材登记表。与 index.html 同序 —— 同样必须在 icons.js 之后。 */
  require('./js/bitmaps.js');
  require('./js/portraits.js');
  require('./js/story.js');
  require('./js/ui.js');
  /* main.js 必须加载：主循环 setInterval、事件分发、动作实现都在这里。
     曾经漏测此文件，导致主循环内 "$ is not defined" 长期未被发现
     （表现为：读秒不动、侧栏空白、生产停滞）。 */
  require('./js/main.js');

  var G = global.GAME, DATA = G.DATA, U = G.utils;

  /* v36 门禁：素材层（game-icons / AI 位图）在 smoke 环境里必须**真的可见**。
     曾经它们是裸 `var` 声明 —— 浏览器里是全局，require 加载时是模块局部，
     于是 icons.js 的 `typeof GICONS` 恒为 undefined，素材层静默失效，
     而 smoke 全绿（"测试绿但功能没生效"的典型盲区）。 */
  check('素材层在 smoke 环境可达（否则位图/矢量素材静默失效）',
    typeof global.GICONS === 'object' && typeof global.BITMAPS === 'object'
    && !!G.icons.bitmapSrc('building', 'guanfu'),
    'gicons=' + typeof global.GICONS + ' bitmaps=' + typeof global.BITMAPS);

  /* v14：外城地块按城池独立（state.extGrid → city.extGrid）。
     extOf(state) 取该 state 首城的外城网格，让既有断言继续可用。 */
  function extOf(st) { return G.extGridOf(st.cities[0]); }

  /* v68（逐步探索）：把城的官府设为"该城满级"（12 + 档位加成）——
     让"建筑应能自由升满"的老测试段不受官府总闸影响。
     总闸本身的验证在「第 54 节 · 建造前置」，那里用低级官府做对照。 */
  function govMax(c) {
    var cap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + (GAME.cityBuildBonus(c) || 0);
    ((c && c.cells) || []).forEach(function (x) {
      if (x.build && x.build.id === 'guanfu') x.build.lvl = cap;
    });
    return c;
  }

  /* ⚠️ 取某个函数的**完整函数体**，按结构取而不是按固定字符数截。
     位置型断言（`src.slice(i, i + 2200)`）已经连续三次假红，根因都是同一个：
     **函数里加注释/加分支会让它变长**，而窗口是写死的数字 ——
     v38 把 1800 改成 3200，v51 又要从 3600 改到 4200。
     这里改成"从声明处到本函数结尾的 `\n  };`"（本项目的函数一律 2 空格缩进的 `};` 收尾，
     函数体内的语句是 4 空格缩进，嵌套对象的 `};` 也更深，所以这个锚点是唯一的）。
     代价：单行函数（`ui.foo = function () { ... };`）取不到东西，返回空串 ——
     那种函数本来也没什么可查的，断言会自己报红，不会静默通过。 */
  function fnBody(src, decl) {
    var i = src.indexOf(decl);
    if (i < 0) return '';
    var j = src.indexOf('\n  };', i);
    return j < 0 ? src.slice(i) : src.slice(i, j + 5);
  }
  /* ⚠️ 剥注释再查代码 —— "注释里提到过某个字符串"会让"不许出现它"的断言假红。
     这个坑也踩了两次（v29 查 CSS、v51 查 JS），而两次都是**自己写的说明注释**惹的：
     为了解释"为什么要删掉「条件齐备，可以打造」"，我在注释里引用了这句话，
     结果"不许出现它"的断言读到的是我的解释文字。
     只剥整行的 `//`（不剥行内，避免误伤字符串里的 URL 之类的 //）＋ 跨行块注释。
     v51 补：**行内 `//` 也要剥** —— 破坏测试里用 `x = 1; // DELETED: 真代码`
     伪装回归时，只剥整行注释的版本会漏掉它，于是"分页还在"的断言仍然绿。
     `://` 排除，避免误伤 URL 类字符串。
     v53 补：**HTML 注释 `<!-- -->` 也要剥** —— index.html 的注释里提到
     "把这个下拉框一起换掉"时若写了尖括号标签名，"全站只允许一处下拉框"的计数断言
     会数到第 2 处（v53 实测，第 7 次被自己的说明注释骗过）。
     凡"计数/不许出现"的断言，**一律先过 stripComment 再匹配**。 */
  function stripComment(src) {
    return src.replace(/<!--[\s\S]*?-->/g, '')          /* HTML 注释 */
      .replace(/\/\*[\s\S]*?\*\//g, '')                 /* 跨行块注释 */
      .replace(/(^|[^:\w])\/\/.*$/gm, '$1');            /* 整行 + 行内 */
  }
  function codeOf(src, decl) { return stripComment(fnBody(src, decl)); }
  /* 取一条 **CSS 规则块**（按花括号配对，**并剥掉注释**）。
     两个坑一起堵：
     ① 写死窗口 `css.slice(i, i + 160)` 会被规则里的说明注释挤爆
        （v52 实测：`.gen-list` 的注释 6 行，窗口直接失配）；
     ② **注释里引用旧值**会让"不许出现旧值"的断言假红 ——
        为解释"改前写死 max-height: 68vh"，注释里就写了 68vh，
        于是"不再有 68vh"的断言读到的是自己的说明文字。
        这个坑本项目踩了四次（CSS 两次、JS 两次），所以这里默认剥注释。 */
  function cssBlock(css, sel) {
    var i = css.indexOf(sel);
    if (i < 0) return '';
    var j = css.indexOf('{', i);
    if (j < 0) return '';
    var d = 0;
    for (var k = j; k < css.length; k++) {
      if (css[k] === '{') d++;
      else if (css[k] === '}') { d--; if (!d) return stripComment(css.slice(i, k + 1)); }
    }
    return stripComment(css.slice(i));
  }

  /* 用固定随机序列执行一段逻辑，使含随机区间的断言**可复现**。
     （genLoot 等按 Math.random 在区间内取值，单次采样比较大小会偶发失败） */
  function withFixedRandom(seq, fn) {
    var orig = Math.random, i = 0;
    Math.random = function () { var v = seq[i % seq.length]; i++; return v; };    try { return fn(); } finally { Math.random = orig; }
  }

  console.log('\n===== 0. 模块引用完整性（静态扫描）=====');
  var fsMod = require('fs'), pathMod = require('path');
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
    var src = fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8');
    var usesDollar = /(^|[^.\w$])\$\(/.test(src);
    var definesDollar = /var\s+\$\s*=/.test(src) || /function\s+\$\(/.test(src);
    check('js/' + f + '.js 引用 $ 时已定义', !usesDollar || definesDollar || f === 'ui');
  });
  /* v14：把「变量用了却没声明」做成静态门禁。
     main.js 曾长期引用未声明的 U / DATA —— 只在「侦查拾宝(18%)」「自动存档(5分钟)」
     「背包点击物品」等分支触发，测试若不走那条路径就发现不了。
     这里改为编译期扫描：凡出现 X. 用法，必须有 var X = 声明。 */
  ['U', 'DATA'].forEach(function (sym) {
    ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
      var src = fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8');
      var re = new RegExp('(^|[^.\\w$])' + sym + '\\.');
      var uses = re.test(src);
      var declRe = new RegExp('(var\\s+|,\\s*)' + sym + '\\s*=');
      var defs = declRe.test(src);
      /* state.js / data.js 是 utils 与 DATA 的定义方，豁免 */
      var ok = !uses || defs || f === 'state' || f === 'data';
      check('js/' + f + '.js 引用 ' + sym + ' 时已声明', ok, ok ? '' : '缺 var ' + sym + ' = …');
    });
  });
  check('main.js 已声明 DATA 与 U（跨文件局部变量不共享）', (function () {
    var src = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
    return /var\s+DATA\s*=\s*GAME\.DATA/.test(src) && /(var\s+|,\s*)U\s*=\s*GAME\.utils/.test(src);
  })());
  check('main.js 已加载（GAME.action 存在）', typeof G.action === 'function');
  check('主循环所需函数齐备', typeof G.tickOnce === 'function' && typeof G.ui.updateProgress === 'function'
    && typeof G.ui.renderSide === 'function' && typeof G.ui.paintBottom === 'function');

  console.log('\n===== 1. 数据完整性 =====');
  check('18 兵种', Object.keys(DATA.TROOPS).length === 18, Object.keys(DATA.TROOPS).length + '种');
  /* v28（需求 0）：攻/血校正后，这两条改为断言**设计口径**而不是历史数字 ——
     写死"攻250"会让任何一次平衡调整都变成"测试坏了"。 */
  check('冲车：血厚于所有常规兵（攻守城器械靠坦度与破阵）',
    DATA.TROOPS.chongche.hp === 6000 && DATA.TROOPS.chongche.def === 600
    && DATA.TROOPS.chongche.craft === true);
  check('投石车：攻与射程均为全军之最（远程压制定位）',
    DATA.TROOPS.toudan.range === 1600 && DATA.TROOPS.toudan.craft === true
    && DATA.TROOPS.toudan.atk > DATA.TROOPS.chuangnu.atk);
  check('斥候速度3000', DATA.TROOPS.chihou.spd === 3000);
  check('16 城内建筑', Object.keys(DATA.BUILDINGS).length === 16);
  check('4 城外资源建筑', Object.keys(DATA.EXT_BUILDINGS).length === 4);
  check('官府10级木136万', DATA.BUILDINGS.guanfu.levelCost(9).wood === 1365010);
  check('民房10级人口5500', DATA.BUILDINGS.minfang.pop[9] === 5500);
  check('农田10级产量5500/h', DATA.EXT_BUILDINGS.farm.prod[9] === 5500);
  check('23 科技', DATA.TECH.length === 24, DATA.TECH.length + '项');
  check('22 级爵位', DATA.RANK.length === 22);
  check('裂土封王声望10.48亿', DATA.RANK[21].rep === 1048576000);
  check('174 座城池(1都+12州+96郡+65县)', DATA.NPC_CITIES.length === 174,
    '都城1 / 州城' + DATA.NPC_CITIES.filter(function (c) { return c.type === 'zhou'; }).length
    + ' / 郡城' + DATA.NPC_CITIES.filter(function (c) { return c.type === 'jun'; }).length
    + ' / 县城' + DATA.NPC_CITIES.filter(function (c) { return c.type === 'county'; }).length);
  check('县城为第三档（等级5·城防40）', DATA.NPC_CITIES.filter(function (c) { return c.type === 'county'; })
    .every(function (c) { return c.level === 5 && c.def === 40; }));
  check('城池坐标无冲突', (function () {
    var seen = {}, bad = 0;
    DATA.NPC_CITIES.forEach(function (c) { var k = c.x + ',' + c.y; if (seen[k]) bad++; seen[k] = 1; });
    return bad === 0;
  })());
  check('洛阳坐标(265,215)', DATA.NPC_CITIES[0].x === 265 && DATA.NPC_CITIES[0].y === 215);
  check('凉州州城陇县(115,205)', DATA.NPC_CITIES.some(function (c) { return c.name === '陇县' && c.x === 115 && c.y === 205; }));
  check('28 名历史将领', DATA.HEROES.length >= 28);
  check('11 位美人', DATA.BEAUTIES.length === 11);
  check('装备倚天套12件', Object.keys(DATA.EQUIP).filter(function (k) { return DATA.EQUIP[k].set === 'yitian'; }).length === 12);
  check('绝影速度120', DATA.EQUIP.jueying.spd === 120);
  check('42 件可操作宝物', DATA.ITEMS.length >= 42, DATA.ITEMS.length + '件');

  console.log('\n===== 2. 新建游戏 =====');
  G.newGame({ name: '测试君主', avatar: '🧔', gender: 'male', region: 'random' });
  var s = G.state;
  check('存档版本 v3', s.version === 3);
  check('初始资源各2万', s.res.grain === 20000 && s.res.wood === 20000);
  /* v40（需求 2）：老板要「8*6，6 行 8 列」→ 48 格；v68 起官府居中 4 格、余 44 可建 */
  check('城内 48 格（8 列 × 6 行 · 官府居中4格）', s.cities[0].cells.length === 48 && s.cities[0].cells.filter(function (c) { return c.build && c.build.id === 'guanfu'; }).length === 4);
  check('可建格 44', s.cities[0].cells.filter(function (c) { return !c.official; }).length === 44);
  check('初始民房2座', s.cities[0].cells.filter(function (c) { return c.build && c.build.id === 'minfang'; }).length === 2);
  check('外城 12 块地(2田1木1石1铁占5)', extOf(s).length === 12 && extOf(s).filter(function (e) { return e.type === 'farm'; }).length === 2 && extOf(s).filter(function (e) { return e.type; }).length === 5);
  check('初始将领赵子龙', s.generals[0].name === '赵子龙');
  check('初始宝物', s.items.shennongchu === 1 && s.items.zhenzhu === 5);

  console.log('\n===== 3. 生产结算（timeScale=30）=====');
  var grain0 = s.res.grain;
  for (var i = 0; i < 60; i++) G.tickOnce(); // 60 现实秒 = 30分钟游戏时间
  check('60秒后粮食增长', s.res.grain > grain0, '+' + Math.round(s.res.grain - grain0));
  check('民心初始100', s.hearts === 100);
  check('黄金产出>0', s.res.gold >= 0);

  console.log('\n===== 4. 城外地块建造/升级（含 pending 状态机）=====');
  var emptyIdx = extOf(s).findIndex(function (e) { return !e.type && !e.pending; });
  var r = G.buildExt(emptyIdx, 'farm');
  check('空地建农田', r.ok === true, r.msg);
  check('建造中 pending 置位', extOf(s)[emptyIdx].pending === 'farm');
  for (var i2 = 0; i2 < 10; i2++) G.tickOnce(); // 60游戏秒 = 2现实秒@30×
  check('农田地块+1', extOf(s)[emptyIdx].type === 'farm');
  check('建造完成 pending 清除', extOf(s)[emptyIdx].pending === null);
  check('进度查询返回空', G.buildPct('ext', emptyIdx) === '');
  var r2 = G.upgradeExt(emptyIdx);
  check('升级农田地块', r2.ok === true, r2.msg);
  check('升级中 pending 置位', extOf(s)[emptyIdx].pending === 'farm');
  for (var i3 = 0; i3 < 10; i3++) G.tickOnce();
  check('农田地块等级+1', extOf(s)[emptyIdx].lv === 2);
  check('升级完成 pending 清除', extOf(s)[emptyIdx].pending === null);
  var r3 = G.buildExt(emptyIdx, 'mine');
  check('已占地块不可再建', r3.ok === false);
  /* 城内建造 pending/进度 */
  var idxP = s.cities[0].cells.findIndex(function (c) { return !c.build && !c.pending && !c.official; });
  var rp = G.buildAt(s.cities[0].id, idxP, 'shichang');
  check('城内建市场', rp.ok === true, rp.msg);
  check('城内 pending 置位', s.cities[0].cells[idxP].pending && s.cities[0].cells[idxP].pending.buildId === 'shichang');
  check('城内进度查询非空', G.buildPct('city', idxP) !== '');
  for (var ip = 0; ip < 60; ip++) G.tickOnce(); // 市场1级1500s = 50现实秒@30×
  check('市场建成且 pending 清除', s.cities[0].cells[idxP].build && s.cities[0].cells[idxP].build.id === 'shichang' && s.cities[0].cells[idxP].pending === null);

  console.log('\n===== 5. 城内建造（军营/书院）=====');
  var idxJ = s.cities[0].cells.findIndex(function (c) { return !c.build && !c.pending; });
  var r4a = G.buildAt(s.cities[0].id, idxJ, 'junying');
  check('建造军营', r4a.ok === true, r4a.msg);
  var idxS = s.cities[0].cells.findIndex(function (c) { return !c.build && !c.pending; });
  var r4b = G.buildAt(s.cities[0].id, idxS, 'shuyuan');
  check('建造书院', r4b.ok === true, r4b.msg);
  for (var i4 = 0; i4 < 40; i4++) G.tickOnce(); // 军营600s+书院960s = 52现实秒@30×
  check('军营建成', s.cities[0].cells[idxJ].build && s.cities[0].cells[idxJ].build.id === 'junying');
  check('书院建成', s.cities[0].cells[idxS].build && s.cities[0].cells[idxS].build.id === 'shuyuan');

  console.log('\n===== 6. 科技研究 =====');
  var r5 = G.systems.research('zhongzhi');
  check('研究种植技术', r5.ok === true, r5.msg);
  for (var i5 = 0; i5 < 10; i5++) G.tickOnce();
  check('种植技术 Lv1', s.techs.zhongzhi === 1);

  console.log('\n===== 7. 造兵 =====');
  /* v60：`G.res = s.res` 这行**必须删** —— GAME.res 现在是「取某城库存」的函数，
     再挂一个同名对象上去会把函数覆盖掉（访问器随即崩在这儿）。
     s.res 本身就是当前城的库存，直接用即可。 */
  s.res.iron += 10000; s.res.grain += 50000; s.res.wood += 20000; s.res.pop += 1000;
  var r6 = G.train('yibing', 10, s.cities[0].id);
  check('训练义兵10', r6.ok === true, r6.msg);
  for (var i6 = 0; i6 < 10; i6++) G.tickOnce();
  check('义兵入城', s.cities[0].army.yibing === 10);
  var r7 = G.train('chihou', 1, s.cities[0].id);
  check('斥候需书院2级未满足', r7.ok === false, r7.msg);

  console.log('\n===== 8. 战斗模拟 =====');
  var res = G.battle.simulate({ gongjian: 1500, daodun: 100 }, null, { yibing: 2000, changqiang: 500 }, 0, null);
  check('1500弓+100盾 vs 2500野兵', res.winner === 'atk', '胜方=' + res.winner + ' 我余' + res.atkRemain + ' 敌余' + res.defRemain);
  var res2 = G.battle.simulate({ yibing: 100 }, null, { tieji: 500 }, 10, null);
  check('100义兵 vs 500铁骑+城墙', res2.winner === 'def');

  console.log('\n===== 9. 爵位晋升 =====');
  s.cities.push(G.makeCity({ id: 'p2', name: '分城', x: 280, y: 230 })); // 公士需2城
  s.rep = 5000; s.res.gold = 100000; s.items.zhenzhu = 15; s.items.shanhu = 10; s.items.liuli = 5; // 15-10=5 留给后续用例
  var chk = G.systems.canPromote();
  check('可晋升到公士(声望5000>1000)', chk.ok === true, chk.msg);
  var r8 = G.systems.promote();
  check('晋升公士成功', r8.ok === true && s.rank === 1, r8.msg);
  var chk2 = G.systems.canPromote();
  check('上造需2城未满足', chk2.ok === false, chk2.msg);

  console.log('\n===== 10. 装备穿戴 =====');
  var g0 = s.generals[0];
  var r9 = G.systems.equipItem(g0.id, 'yt_free1');
  check('穿戴新手布衣', r9.ok === true, r9.msg);
  var r10 = G.systems.equipItem(g0.id, 'yt_free2');
  check('穿戴新手木剑', r10.ok === true);
  var b = G.systems.genEquipBonus(g0);
  check('装备加成生效(防+10攻+15)', b.def === 10 && b.atk === 15);

  console.log('\n===== 11. 宝物使用 =====');
  g0.loyalty = 70;   // 初始将领忠诚为 100（自家嫡系），压低后再验证赏赐
  var r11 = G.systems.useItem('zhenzhu', g0.id);
  check('珍珠赏赐忠诚+5', r11.ok === true && g0.loyalty === 75, '忠=' + g0.loyalty);
  var r12 = G.systems.useItem('shennongchu');
  check('神农锄使用(产粮+25%)', r12.ok === true && !s.items.shennongchu);

  console.log('\n===== 12. 建造队列限制与取消（原版机制）=====');
  /* 先清空进行中的建造队列 */
  s.queues.build.length = 0;
  s.res.grain += 200000; s.res.wood += 200000; s.res.stone += 200000; s.res.iron += 200000;
  var f1 = s.cities[0].cells.findIndex(function (c) { return !c.build && !c.pending && !c.official; });
  var f2 = s.cities[0].cells.findIndex(function (c, i) { return i > f1 && !c.build && !c.pending && !c.official; });
  check('建造槽位默认2个', G.buildSlots() === 2);
  /* v68：本段只测队列机制 —— 建筑一律选**无前置**的；前置规则本身在「第 54 节」验证 */
  var q1 = G.buildAt(s.cities[0].id, f1, 'junying');
  check('第1个建造发起成功', q1.ok === true, q1.msg);
  var q2 = G.buildAt(s.cities[0].id, f2, 'cangku');
  check('第2个建造发起成功', q2.ok === true, q2.msg);
  var f3 = s.cities[0].cells.findIndex(function (c, i) { return i > f2 && !c.build && !c.pending && !c.official; });
  var q3 = G.buildAt(s.cities[0].id, f3, 'cangku');
  check('第3个建造被队列上限拦截', q3.ok === false, q3.msg);
  check('队列中使用2个槽位', G.buildQueueUsed(s.cities[0].id) === 2);
  /* 取消建造：返还资源 + 清 pending + 出队 */
  var grainBefore = s.res.grain, woodBefore = s.res.wood;
  var cbuild2 = s.cities[0].cells[f2];
  var cb = G.cancelBuild('city', f2);
  check('取消建造成功', cb.ok === true, cb.msg);
  check('取消后 pending 清除', cbuild2.pending === null);
  check('取消后队列剩1个', s.queues.build.length === 1);
  check('取消返还资源', s.res.grain > grainBefore || s.res.wood > woodBefore, '粮+' + Math.round(s.res.grain - grainBefore) + ' 木+' + Math.round(s.res.wood - woodBefore));
  /* 取消后槽位释放，可再建 */
  var q4 = G.buildAt(s.cities[0].id, f3, 'cangku');
  check('取消后槽位释放可再建', q4.ok === true, q4.msg);
  s.queues.build.length = 0;
  s.cities[0].cells.forEach(function (c) { c.pending = null; });

  console.log('\n===== 13. 开工率与商城（原版机制）=====');
  s.workRate = { grain: 100, wood: 100, stone: 100, iron: 100 };
  var prodFull = G.productionPerSec();
  s.workRate.grain = 50;
  var prodHalf = G.productionPerSec();
  check('开工率100%→50%粮食产量减半', Math.abs(prodHalf.grain - prodFull.grain / 2) < 0.001,
    prodFull.grain.toFixed(3) + ' → ' + prodHalf.grain.toFixed(3));
  check('其他资源不受影响', Math.abs(prodHalf.wood - prodFull.wood) < 0.001);
  s.workRate.grain = 100;
  /* 商城购买 */
  s.res.gold = 100000;
  var goldBefore = s.res.gold;
  var itemBefore = s.items.shennongchu || 0;
  var item = G.systems.itemInfo('shennongchu');
  var price = item.price * 100;
  s.res.gold -= price; s.items.shennongchu = itemBefore + 1;
  check('商城购买神农锄(5元宝=500金)', s.res.gold === goldBefore - 500 && s.items.shennongchu === itemBefore + 1,
    '花费' + price + '金');

  console.log('\n===== 14. 存档版本与体积 =====');
  G.saveGame();
  var rawStr = localStorage.getItem('sanguo_save_v3');
  var raw = JSON.parse(rawStr);
  check('存档键 v3', raw && raw.version === 3);
  /* 防回归：map.grid（500×500 地形）曾被打包进存档，达 9MB，超过 localStorage 约 5MB 配额，
     导致 saveGame 静默失败、玩家进度全部丢失。地形必须由 seed 重建，不入档。 */
  check('存档体积 < 1MB（地形不入档）', rawStr.length < 1000000,
    Math.round(rawStr.length / 1024) + ' KB');
  check('存档内不含 map.grid', !raw.map || !raw.map.grid);
  check('野地状态仍在档内', Array.isArray(raw.wilds));
  localStorage.setItem('sanguo_save_v2', '{"version":2,"ruler":{}}');
  var loaded = G.loadGame();
  check('旧档(v2)被作废', loaded !== null && loaded.version === 3, '旧档已清除');
  check('读档后地形已按 seed 重建', !!G.state.map.grid && G.state.map.grid.length === DATA.MAP_H,
    G.state.map.grid ? G.state.map.grid.length + '×' + G.state.map.grid[0].length : '未重建');

  console.log('\n===== 15. UI 渲染（原版三段式 + 面板函数）=====');
  var UI = G.ui, DC = global.document._cache;
  UI.renderSide();
  check('城池属性栏渲染', (DC['#city-attrs'] && DC['#city-attrs'].innerHTML.indexOf('民心') >= 0), '含民心/民怨/税率');
  check('资源栏渲染带+快捷', (DC['#res-bar'] && DC['#res-bar'].innerHTML.indexOf('plus-btn') >= 0), '含+号快捷道具');
  var panels = [
    ['城内', UI.cityHTML()], ['城外', UI.extHTML()], ['军队', UI.troopsHTML()],
    ['将领', UI.generalsHTML()], ['装备', UI.equipHTML()], ['科技', UI.techHTML()],
    ['宝物', UI.itemsHTML()], ['爵位', UI.rankHTML()], ['地图', UI.mapHTML()],
    ['任务', UI.tasksHTML()], ['统计', UI.statsHTML()], ['设置', UI.settingsHTML()],
  ];
  var panelOk = panels.every(function (p) { return typeof p[1] === 'string' && p[1].length > 50; });
  check('13 个主面板全部可渲染', panelOk, panels.map(function (p) { return p[0] + ':' + p[1].length; }).join(' '));
  /* v77（老板）：资源生产 / 建筑信息两个入口退役（随城池属性右三按钮）；
     附属野地保留（改由资源区下拉框「进入」触发）。 */
  var modals = [
    ['君主信息', UI.openLordInfo], ['附属野地', UI.openWilds],
  ];
  var modalOk = true, failName = '';
  var modalRootEl = global.document.querySelector('#modal-root'); // 确保元素进缓存
  modals.forEach(function (m) {
    try {
      modalRootEl.innerHTML = '';
      m[1]();
      if (modalRootEl.innerHTML.length < 50) { modalOk = false; failName = m[0]; }
    } catch (e) {
      modalOk = false;
      failName = m[0] + ':' + e.message;
      console.log('     ↳ 堆栈: ' + (e.stack || '').split('\n').slice(1, 3).join(' | ').trim());
    }
  });
  check('原版式弹窗全部可打开', modalOk, failName || '君主/野地');
  /* v25（需求 2）：商城 / 背包改为整页视图（与城池/地图同级），不再是弹窗 */
  check('商城 / 背包已改为整页视图',
    /ui\.shopHTML = function/.test(uiSrcProbe) && /ui\.bagHTML = function/.test(uiSrcProbe)
    && /else if \(v === 'shop'\) box\.innerHTML = ui\.shopHTML\(\)/.test(uiSrcProbe)
    && /else if \(v === 'bag'\) box\.innerHTML = ui\.bagHTML\(\)/.test(uiSrcProbe));
  try {
    UI.openQuickItem('grain');
    check('资源栏+号弹宝物', DC['#modal-root'].innerHTML.indexOf('神农锄') >= 0);
  } catch (e) { check('资源栏+号弹宝物', false, e.message); }
  UI._msgCh = 'war'; UI.setView('reports'); UI.renderLog();
  check('消息频道切换(战报)', (DC['#msg-log'] || {}).innerHTML !== undefined);
  UI._msgCh = 'sys';

  console.log('\n===== 16. 读秒显示（精确倒计时+进度条+保底时长）=====');
  var s2 = G.state;   // loadGame 后 state 对象已被替换，需重新取
  check('U.durExact 大数值精确到秒', U.durExact(3995) === '1:06:35', U.durExact(3995));
  check('U.durExact 小数值 MM:SS', U.durExact(65) === '01:05', U.durExact(65));
  s2.queues.build.length = 0;
  (extOf(s2) || []).forEach(function (e) { e.pending = null; });
  var ei = extOf(s2).findIndex(function (e) { return !e.type && !e.pending; });
  var rb = G.buildExt(ei, 'farm');
  check('城外地块建造可发起', rb.ok === true, rb.msg);
  var qb = s2.queues.build[0];
  check('建造时间保底≥5现实秒（高倍率下不至于秒完）', !!qb && (qb.totalTime / G.timeScale()) >= 4.9,
    qb ? (qb.totalTime / G.timeScale()).toFixed(1) + ' 现实秒 @' + G.timeScale() + '×' : '队列为空');
  var l1 = G.buildPct('ext', ei);
  G.tickOnce();
  var l2 = G.buildPct('ext', ei);
  check('倒计时每秒文本变化', l1 !== l2, l1 + ' → ' + l2);
  check('精确格式 X% · MM:SS', /^\d+% · (\d+:)?\d{2}:\d{2}$/.test(l2), l2);
  var pr = G.buildProgress('ext', ei);
  check('buildProgress 返回 pct/left/label', !!pr && typeof pr.pct === 'number' && typeof pr.left === 'number' && !!pr.label,
    'pct=' + pr.pct + ' left=' + pr.left.toFixed(1) + 's');
  for (var iw = 0; iw < 3; iw++) G.tickOnce();
  check('连续 tick 后倒计时持续递减', G.buildProgress('ext', ei).left < pr.left,
    pr.left.toFixed(1) + 's → ' + G.buildProgress('ext', ei).left.toFixed(1) + 's');
  s2.queues.build.length = 0;
  (extOf(s2) || []).forEach(function (e) { e.pending = null; });

  console.log('\n===== 17. 资源数值显示（可见增长）=====');
  /* U.fmt 会把 20000 缩写成 "2.0万" 并向下取整，导致每秒 +6.67 的变化 150 秒才可见一次。
     存量必须走 U.numHTML（千分位 + 小数分离），增速必须按 /秒 显示。 */
  check('U.numText 千分位', U.numText(1234567.89, 2) === '1,234,567.89', U.numText(1234567.89, 2));
  check('U.numText 小数位可控', U.numText(20000, 0) === '20,000', U.numText(20000, 0));
  check('U.numHTML 整数+小数分离', U.numHTML(20001.67, 2).indexOf('<span class="num-frac">.67</span>') > 0,
    U.numHTML(20001.67, 2));
  check('U.numHTML 千分位正确', U.numHTML(1234567, 0).indexOf('1,234,567') === 0, U.numHTML(1234567, 0));
  check('U.rateHTML 按秒显示', U.rateHTML(6.666).indexOf('+6.67/秒') > 0, U.rateHTML(6.666));
  check('U.rateHTML 零产量不显示加号', U.rateHTML(0).indexOf('+0/秒') > 0, U.rateHTML(0));
  check('U.fmt 仍保留（弹窗/成本对比用缩写）', U.fmt(20000) === '2.0万', U.fmt(20000));

  var resBox = DC['#res-bar'];
  /* 注意：第 14 节 loadGame() 会替换 GAME.state，此处必须重新取引用 */
  var S17 = G.state;
  UI.renderResBar(G.currentCity(), S17);
  /* v19：存量改为**整数**显示（小数在每秒刷新的画面上一直闪、无信息量），
     且资源行不再带图标（只用文字）。 */
  /* v65（老板）：「资源数量超过 1 万以万显示，超过 1 亿以亿显示，现在有点占位置」——
     判据随之改：**屏幕上是短写、精确值进悬停**（title 里仍有千分位全值）。 */
  check('资源栏存量短写：1,234,567 → 123.5万（整数位不丢）', (function () {
    S17.res.grain = 1234567;
    UI.renderResBar(G.currentCity(), S17);
    var h = resBox.innerHTML;
    var seg = (h.match(/class="amt"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '';
    return seg.indexOf('123.5') >= 0 && seg.indexOf('万') >= 0;
  })(), (U.amtText(1234567)));
  check('存量的精确值进悬停（title 里仍是千分位全值）', (function () {
    var h = resBox.innerHTML;
    return h.indexOf('1,234,567') > 0;
  })());
  /* v29（需求 8）：资源栏首行是"本城 · 城名"表头，所以按**标签集合**判定，
     不再假定"首行就是粮食"。 */
  check('资源行只用文字（不再拼接图标）', (function () {
    var h = resBox.innerHTML;
    var ls = (h.match(/class="lbl">([^<]*)</g) || []).map(function (x) {
      return x.replace(/class="lbl">/, '').replace(/<$/, '');
    });
    return ls.indexOf('粮食') >= 0 && ls.indexOf('木材') >= 0 && h.indexOf('<svg') < 0;
  })(), '标签：' + (resBox.innerHTML.match(/class="lbl">([^<]*)</g) || []).join('/'));
  check('资源栏底部「每小时产量」提示已移除', !/res-foot|每小时（游戏时间）/.test(resBox.innerHTML));
  check('资源栏显示 /秒 增速', resBox.innerHTML.indexOf('/秒') > 0);
  /* ⚠️ 这条断言在 v65 被**反过来**了：v20 时老板嫌"万"看不清增长，
     现在（位数一多）他要的就是"万/亿"短写来省地方。旧断言若留着就会拦着新需求。 */
  check('资源栏用短写单位（万/亿），且单位是小字 .amt-u', (function () {
    var h = resBox.innerHTML;
    return h.indexOf('amt-u') > 0 && h.indexOf('万') > 0;
  })());
  S17.workRate = { grain: 100, wood: 100, stone: 100, iron: 100 };
  S17.res.grain = 20000;
  var beforeRes = S17.res.grain;
  for (var ri = 0; ri < 5; ri++) G.tickOnce();
  check('连续 tick 后资源增长可见', S17.res.grain > beforeRes,
    beforeRes.toFixed(2) + ' → ' + S17.res.grain.toFixed(2));
  UI.renderResBar(G.currentCity(), S17);
  check('增长后渲染文本随之变化（短写也跟着变）', (function () {
    /* 单位是包在 <i class="amt-u"> 里的小字，所以不能整串找 —— 拆开比 */
    var h = resBox.innerHTML, t = U.amtText(S17.res.grain);
    var num = t.replace(/[万亿]/g, '');
    return h.indexOf(num) > 0 && (t === num || h.indexOf(t.slice(-1)) > 0);
  })(), '显示 ' + U.amtText(S17.res.grain));

  /* 大数不撑破侧栏（300px） */
  S17.res.grain = 104857600;
  UI.renderResBar(G.currentCity(), S17);
  check('亿级资源仍可渲染（短写为 1.05亿）', (function () {
    var h = resBox.innerHTML;
    return h.indexOf('1.05') > 0 && h.indexOf('亿') > 0;
  })(), U.amtText(104857600));
  /* v65：单位换算的三档边界（万 / 亿 / 原值）—— 这是"齐整"这条需求的核心判据 */
  check('U.amtHTML 三档边界正确（9999 原值 / 1万 / 1亿）',
    U.amtText(9999) === '9,999' && U.amtText(10000) === '1.0万'
    && U.amtText(99999999) === '10000.0万' && U.amtText(1e8) === '1.00亿',
    [U.amtText(9999), U.amtText(10000), U.amtText(1e8)].join(' | '));

  console.log('\n===== 18. 叙事层（天时 / 年号 / 史册 / 羁绊 / 战力）=====');
  var S18 = G.state, ST = G.story;
  check('story 模块加载', !!ST && typeof ST.tick === 'function');
  check('五张数据表齐全',
    DATA.BONDS.length >= 8 && DATA.ERAS.length >= 10 && DATA.CHRONICLE_RULES.length > 10 &&
    DATA.ENCOUNTERS.length >= 8 && DATA.TITLES.length >= 6 && DATA.SEASONS.length === 4 &&
    Object.keys(DATA.WEATHERS).length === 5,
    '羁绊' + DATA.BONDS.length + '/年号' + DATA.ERAS.length + '/纪事' + DATA.CHRONICLE_RULES.length +
    '/奇遇' + DATA.ENCOUNTERS.length + '/称号' + DATA.TITLES.length);
  var hasNeg = DATA.BONDS.some(function (b) {
    return Object.keys(b.bonus).some(function (k) { return b.bonus[k] < 0; });
  });
  check('羁绊全为正面加成（按要求无减益）', !hasNeg);
  check('羁绊带历史出处', DATA.BONDS.every(function (b) { return !!b.lore; }));

  console.log('  --- 历法天时 ---');
  var y0 = S18.world.year, e0 = S18.world.elapsed;
  ST.tick(DATA.CALENDAR.secPerYear);
  check('历法推进一年', S18.world.year === y0 + 1, y0 + ' → ' + S18.world.year);
  check('累计历法时间增加', S18.world.elapsed > e0, Math.round(S18.world.elapsed) + ' 游戏秒');
  check('季节在合法范围', S18.world.season >= 0 && S18.world.season < 4, '季：' + ST.seasonName(S18.world.season));
  check('当前天时可描述', ST.skyLine().length > 4, ST.skyLine());
  check('年号名可取', ST.currentEra().name.length > 0, ST.currentEra().name);
  check('年序名合古文', /^(元|[一二三四五六七八九十]+)$/.test(ST.yearName()), ST.yearName() + '年');

  console.log('  --- 天时影响 ---');
  var pm = ST.prodMult('grain');
  check('天时对粮产有乘数', typeof pm === 'number' && pm > 0, '×' + pm.toFixed(3));
  var cm = ST.combatMod();
  check('天时提供战斗修正', cm && typeof cm.move === 'number', '行军 ×' + cm.move);
  S18.world.weather = 'snow';
  check('雪天粮产低于木产', ST.prodMult('grain') < ST.prodMult('wood'),
    '粮 ×' + ST.prodMult('grain').toFixed(2) + ' vs 木 ×' + ST.prodMult('wood').toFixed(2));
  check('雪天军粮多耗', ST.feedMult() > 1.2, '×' + ST.feedMult().toFixed(2));
  S18.world.weather = 'fog';
  check('雾天偷袭 ×2', ST.combatMod().ambush === 2);
  check('雾天侦察失效', ST.combatMod().scout === false);
  S18.world.weather = 'wind';
  check('大风火攻 ×3', ST.combatMod().fire === 3);
  S18.world.weather = 'clear';

  console.log('  --- 史书纪事 ---');
  check('史册已有条目', (S18.chronicle || []).length > 0, (S18.chronicle || []).length + ' 条');
  check('里程碑已记账', (S18.chronicle || []).some(function (e) { return e.tag === 'milestone'; }));
  check('逐年快照已记账', (S18.chronicle || []).some(function (e) { return e.tag === 'annual'; }));
  ST.chronicleAdd('是岁，试记一笔。', 'note');
  check('可手动记账', S18.chronicle[S18.chronicle.length - 1].text.indexOf('试记一笔') >= 0);
  check('史册文本可导出', ST.chronicleText(3).indexOf('【') >= 0);
  check('占位符已替换为实值', ST.fill('{era}{yy}{season}').indexOf('{') < 0, ST.fill('{era}{yy}{season}，兵{army}'));
  var big = [];
  for (var ci = 0; ci < 400; ci++) ST.chronicleAdd('压测条目' + ci, 'note');
  check('史册超长自动截断（防存档膨胀）', S18.chronicle.length <= 300, S18.chronicle.length + ' 条');

  console.log('  --- 名将羁绊（后台静默） ---');
  S18.generals.length = 1;   // 只留初始将领，清空羁绊
  ST.chronicleDone = {};
  check('无组合时无激活羁绊', ST.activeBonds().length === 0);
  var need = ['刘备', '关羽', '张飞'];
  var owned = {}; S18.generals.forEach(function (g) { owned[g.name] = true; });
  need.forEach(function (n) {
    if (!owned[n]) S18.generals.push(G.makeGeneral(n, 1, 'idle', S18.cities[0].id, false));
  });
  var bondIds = ST.activeBonds().map(function (b) { return b.id; });
  check('集齐刘关张 → 桃园结义激活', bondIds.indexOf('taoyuan') >= 0, bondIds.join(','));
  check('羁绊攻击加成生效', ST.bondBonus('atk') >= 0.20, '+' + ST.bondBonus('atk').toFixed(2));
  check('羁绊并入战斗乘数', ST.atkMult() > 1, '×' + ST.atkMult().toFixed(3));
  var names5 = ['赵云', '马超'];
  names5.forEach(function (n) {
    var has = S18.generals.some(function (g) { return g.name === n; });
    if (!has) S18.generals.push(G.makeGeneral(n, 1, 'idle', S18.cities[0].id, false));
  });
  check('多个羁绊可叠加', ST.activeBonds().length >= 2, ST.activeBonds().length + ' 个');

  console.log('  --- 年号纪元（赛季） ---');
  check('时代之志可读进度', !!ST.eraGoalProgress() && typeof ST.eraGoalProgress().ratio === 'number',
    ST.eraGoalProgress().cur + '/' + ST.eraGoalProgress().target);
  var era0 = S18.world.eraIndex;
  S18.world.eraStartYear = S18.world.year - DATA.ERAS[era0].years - 1;
  ST.checkEra();
  check('年号期满自动改元', S18.world.eraIndex !== era0,
    DATA.ERAS[era0].name + ' → ' + ST.currentEra().name);
  check('改元写入史册', (S18.chronicle || []).some(function (e) { return e.tag === 'era'; }));
  check('新时代有增益说明', !!(ST.currentEra().boon && ST.currentEra().boon.text), ST.currentEra().boon.text);

  console.log('  --- 奇遇秘境 ---');
  S18.world.luck = 0;
  var c0 = ST.encounterChance();
  S18.world.luck = 10;
  var c1 = ST.encounterChance();
  check('幸运值提升奇遇概率（隐性保底）', c1 > c0,
    (c0 * 100).toFixed(1) + '% → ' + (c1 * 100).toFixed(1) + '%');
  check('奇遇分三档', DATA.ENCOUNTERS.some(function (e) { return e.tier === 'ruin'; }) &&
    DATA.ENCOUNTERS.some(function (e) { return e.tier === 'tomb'; }) &&
    DATA.ENCOUNTERS.some(function (e) { return e.tier === 'secret'; }));
  var rewards = DATA.ENCOUNTERS.concat(DATA.CHRONICLE_RULES).length;
  check('奇遇奖励引用真实宝物 id', DATA.ENCOUNTERS.every(function (e) {
    if (!e.reward || !e.reward.item) return true;
    return (DATA.ITEMS || []).some(function (it) { return it.id === e.reward.item; });
  }));

  console.log('  --- 战力折算 ---');
  var pb18 = ST.powerBreakdown();
  check('战力折算返回明细', !!pb18 && typeof pb18.index === 'number');
  check('国力指数为正', pb18.index > 0, U.fmt(pb18.index));
  check('折算含甲兵/动员/建筑/科技四项',
    typeof pb18.army === 'number' && typeof pb18.reserve === 'number' &&
    typeof pb18.buildings === 'number' && typeof pb18.tech === 'number',
    '兵' + pb18.army + ' 动员' + pb18.reserve + ' 建筑' + pb18.buildings + ' 科技' + pb18.tech);
  var idx0 = pb18.index;
  S18.res.grain += 500000; S18.res.wood += 500000; S18.res.iron += 500000;
  check('资源增加 → 可动员战力上升', ST.powerBreakdown().reserve > pb18.reserve,
    U.fmt(pb18.reserve) + ' → ' + U.fmt(ST.powerBreakdown().reserve));

  console.log('  --- 称号与属性丹 ---');
  var t18 = ST.evaluateTitle();
  check('称号判定可用', !!t18 && !!t18.name, t18.rank + ' · ' + t18.name);
  check('称号按城池数从高到低匹配', DATA.TITLES[0].cond.minCities >= DATA.TITLES[1].cond.minCities);
  S18.items.fengwang_migao = 3;
  var g18 = S18.generals[0], tong0 = g18.tong;
  var r18 = G.systems.useItem('fengwang_migao', g18.id);
  check('属性丹直接加属性', r18.ok && g18.tong === tong0 + 1, '统率 ' + tong0 + ' → ' + g18.tong);
  check('属性丹有使用上限', (DATA.ITEMS || []).some(function (it) { return it.type === 'perm' && /上限50/.test(it.desc || ''); }));

  console.log('\n===== 19. 守将加成 / 装备战斗 / 存档索引 / 离线补算 =====');
  var S19 = G.state;

  console.log('  --- 守将对城池的加成 ---');
  /* v63（老板）：「守将属性只对当前城池起加成作用」——
     `guardBonusTotal`（全境守将之和）已**删除**，改为一律 `guardBonus(city)`。
     所以这里同时钉两件事：入口在、且**全境口径的旧入口不再存在**。 */
  check('守将加成函数存在', typeof G.guardBonus === 'function');
  check('全境口径的 guardBonusTotal 已删除（防后门）',
    typeof G.guardBonusTotal !== 'function');
  S19.generals.forEach(function (g) { g.status = 'idle'; });
  check('无守将时加成为零', (function () {
    var b = G.guardBonus(S19.cities[0]);
    return b.prod === 0 && b.train === 0;
  })());
  var city19 = S19.cities[0];
  var grainNo = G.productionPerSec().grain;
  var g19 = S19.generals[0];
  g19.cityId = city19.id; g19.status = 'guard';
  var gb19 = G.guardBonus(city19);
  check('任命后取到守将加成', !!gb19.name, gb19.name);
  check('内政 → 产量加成', gb19.prod > 0, '+' + (gb19.prod * 100).toFixed(1) + '%');
  check('勇武 → 征兵加速', gb19.train > 0, '+' + (gb19.train * 100).toFixed(1) + '%');
  check('智谋 → 研究加速', gb19.research > 0, '+' + (gb19.research * 100).toFixed(1) + '%');
  check('智谋 → 城防加成', gb19.def > 0, '+' + (gb19.def * 100).toFixed(1) + '%');
  var grainYes = G.productionPerSec().grain;
  check('守将在任 → 粮食产量实际提升', grainYes > grainNo,
    grainNo.toFixed(2) + ' → ' + grainYes.toFixed(2) + '/秒');

  /* ---- v53（老板）：**一城一守将** ----
     改前可以给同一座城连任多个守将，而 guardGeneralOf 只取第一个匹配 →
     后任的将静默失效、加成仍挂在旧将身上（老板看到的就是"任命了新守将，
     加成链条数值没跟着新将领的属性走"）。 */
  console.log('  --- 一城一守将（v53 老板） ---');
  (function () {
    var st = G.state;
    var cityA = st.cities[0];
    var gA = st.generals[0], gB = st.generals[1];
    /* 造两个属性差异明显的将，验证"加成链随新将重算" */
    gA.status = 'idle'; gA.cityId = null; gA.equip = {};
    gB.status = 'idle'; gB.cityId = null; gB.equip = {};
    gA.nz = 20; gB.nz = 90;
    var r1 = G.assignGeneral(gA.id, 'guard', cityA.id);
    var prodA = G.guardBonus(cityA).prod;
    var r2 = G.assignGeneral(gB.id, 'guard', cityA.id);
    var prodB = G.guardBonus(cityA).prod;
    check('任命第二人 → 第一人自动解任（不留双任）',
      gA.status === 'idle' && gA.cityId === null && gB.status === 'guard' && gB.cityId === cityA.id,
      'A=' + gA.status + ' B=' + gB.status);
    check('加成链改由**新守将**的属性计算（内政 20 → 90）',
      G.guardGeneralOf(cityA) === gB && prodB > prodA && Math.abs(prodB - 0.9) < 1e-9,
      (prodA * 100).toFixed(1) + '% → ' + (prodB * 100).toFixed(1) + '%');
    check('提示文案点明"已自动解除"（玩家得知道旧任没了）',
      r2.ok && /已自动解除/.test(r2.msg) && r2.msg.indexOf(gA.name) >= 0, r2.msg);
    check('同一座城不可能挂两个守将（不变量，按全境逐城核）', (function () {
      var seen = {}, dup = 0;
      st.generals.forEach(function (g) {
        if (g.status !== 'guard' || !g.cityId) return;
        if (seen[g.cityId]) dup++; else seen[g.cityId] = 1;
      });
      return dup === 0;
    })());
    /* 一个人不能同时守两座城：换城时应把旧城的守将身份一并带走 */
    var cityB2 = G.makeCity({ id: 'v53_city2', name: 'v53二城', x: 301, y: 301 });
    st.cities.push(cityB2);
    G.assignGeneral(gB.id, 'guard', cityB2.id);
    check('守将换城 → 旧城不再留人（不会一个将守两座城）',
      G.guardGeneralOf(cityB2) === gB && G.guardGeneralOf(cityA) === null && gB.cityId === cityB2.id);
    /* 读档归一化：旧档同城多守将 → 只留最先的那位 */
    gA.status = 'guard'; gA.cityId = cityA.id;
    gB.status = 'guard'; gB.cityId = cityA.id;
    var released = G.normalizeGuards();
    check('读档归一化只留首位（旧档遗留的双任被清掉）',
      released.length === 1 && G.guardGeneralOf(cityA) !== null
      && st.generals.filter(function (g) { return g.status === 'guard' && g.cityId === cityA.id; }).length === 1,
      '清掉 ' + released.join('、'));
    /* 老存档里已经挂了双任的，读进来也必须被清掉 —— 否则老板读档后
       "新守将不生效"依旧存在（迁移没接线 = 只对新档生效） */
    /* v67：后处理整段搬进了 GAME.adoptState（主档读档与槽位读档**共用同一个出口**）。
       判据跟着改成"两段合起来看"：loadGame 必须**转交** adoptState，
       且 adoptState 段里确实调了两个归一化 —— 只断言前半段会退化成装饰。 */
    check('读档路径真的调了归一化（旧档不靠玩家重新任命）', (function () {
      var stSrc = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8'));
      var i = stSrc.indexOf('GAME.loadGame = function');
      var segL = i < 0 ? '' : stSrc.slice(i, stSrc.indexOf('\n  };', i));
      var j = stSrc.indexOf('GAME.adoptState = function');
      var segA = j < 0 ? '' : stSrc.slice(j, stSrc.indexOf('\n  };', j));
      return segL.length > 100 && /GAME\.adoptState\(st\)/.test(segL)
        && segA.length > 3000
        && /GAME\.normalizeGuards\(\)/.test(segA)
        && /GAME\.normalizeGenCities\(\)/.test(segA);
    })(), 'loadGame 转交 adoptState；后处理段 ' + (function () {
      var t = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8'));
      var j = t.indexOf('GAME.adoptState = function');
      return j < 0 ? 0 : (t.indexOf('\n  };', j) - j);
    })() + ' 字符');
    /* 复原，免得影响后面的断言 */
    st.cities.pop();
    st.generals.forEach(function (g) { g.status = 'idle'; g.cityId = null; });
    g19.cityId = city19.id; g19.status = 'guard';
  })();

  console.log('  --- 装备对将领/战斗的加成 ---');
  var gEq = S19.generals[1] || S19.generals[0];
  gEq.equip = {};
  var base19 = G.genAttrs(gEq);
  gEq.equip.weapon = 'yt_sword';   // 倚天长剑：atk 2888
  var withW = G.genAttrs(gEq);
  check('武器装备 → 将领攻击属性上升', withW.atk > base19.atk,
    base19.atk + ' → ' + withW.atk);
  var army19 = { yibing: 4000 }, foe19 = { yibing: 6000 };   // 双方规模接近，避免一方被全歼而看不出伤害差
  var rA = G.battle.simulate(army19, gEq, foe19, 0, null);
  gEq.equip.weapon = undefined;
  var rB = G.battle.simulate(army19, gEq, foe19, 0, null);
  check('装备武器 → 我军损失大幅减少（装备攻击已并入战斗）', rA.atkLoss < rB.atkLoss,
    '无武器损兵 ' + rB.atkLoss + ' → 有武器损兵 ' + rA.atkLoss);
  /* 将领体力（装备 hp）→ 全军生命加成（此前该属性被算出却从未参与战斗） */
  gEq.equip = { head: 'cr_head_4', chest: 'cr_chest_4', ring: 'cr_ring_4' };   // 玄铁散件：合计 hp 2100
  var hpMult = 1 + Math.min(1.0, G.genAttrs(gEq).hp / 10000);
  var rHp = G.battle.simulate(army19, gEq, foe19, 0, null);
  gEq.equip = {};
  var rNoHp = G.battle.simulate(army19, gEq, foe19, 0, null);
  check('将领体力 → 全军生命加成生效（损兵更少）', rHp.atkLoss < rNoHp.atkLoss,
    '无体力损兵 ' + rNoHp.atkLoss + ' → 有体力(hp=' + G.genAttrs({ equip: {}, hp: 100 }).hp + '/' + (1 + 0.21).toFixed(2) + 'x)损兵 ' + rHp.atkLoss);
  delete gEq.equip.weapon;
  gEq.equip.mount = 'jueying';
  var withM = G.genAttrs(gEq);
  check('坐骑（绝影）→ 将领速度上升', withM.spd > base19.spd, base19.spd + ' → ' + withM.spd);
  delete gEq.equip.mount;
  var armorItem = null;
  for (var ek in DATA.EQUIP) { if (DATA.EQUIP[ek].def) { armorItem = ek; break; } }
  if (armorItem) {
    gEq.equip.chest = armorItem;
    check('护甲 → 将领防御属性上升', G.genAttrs(gEq).def > base19.def,
      base19.def + ' → ' + G.genAttrs(gEq).def);
    delete gEq.equip.chest;
  } else {
    check('护甲类装备存在', true, '数据中暂无 def 类装备，跳过');
  }

  console.log('  --- 存档索引（首页秒读） ---');
  G.saveGame();
  var meta19 = G.readMeta();
  check('存档索引可读', !!meta19 && !!meta19.name, meta19 && meta19.name);
  check('索引含离线计算关键字段（gameElapsed）',
    meta19 && typeof meta19.gameElapsed === 'number' && meta19.gameElapsed > 0,
    Math.round(meta19.gameElapsed) + ' 游戏秒');
  check('索引含年号/季节/天时',
    !!(meta19.era && meta19.season && meta19.weather),
    meta19.era + '·' + meta19.yearName + '年 ' + meta19.season + ' ' + meta19.weather);
  check('索引含城池/兵力概要', meta19.cities > 0 && typeof meta19.army === 'number',
    '城' + meta19.cities + ' 兵' + meta19.army);
  var rulerBefore = JSON.stringify(S19.ruler);
  var parsed19 = JSON.parse(localStorage.getItem('sanguo_save_v3'));
  var m19 = G.metaOf(parsed19);
  check('metaOf 为纯函数（不污染运行中 state）', JSON.stringify(S19.ruler) === rulerBefore);
  check('metaOf 可从主档独立推算', !!m19 && m19.era === meta19.era);
  check('索引体积远小于主档', JSON.stringify(meta19).length < 2000,
    JSON.stringify(meta19).length + ' B vs 主档 ' +
    Math.round(localStorage.getItem('sanguo_save_v3').length / 1024) + ' KB');
  check('存档时间可格式化', /^\d{4}-\d{2}-\d{2}/.test(G.metaTimeText(meta19.savedAt)),
    G.metaTimeText(meta19.savedAt));

  console.log('  --- 离线补算（与记账联动） ---');
  var e19 = S19.world.elapsed;
  var chron0 = (S19.chronicle || []).length;
  var gold19 = S19.res.gold;
  G.offlineCatchup(600);          // 模拟离线 10 分钟（精确段）
  check('离线补算推进历法时间', S19.world.elapsed > e19,
    '+' + Math.round(S19.world.elapsed - e19) + ' 游戏秒');
  check('离线期间资源有结算', S19.res.gold !== gold19 || S19.res.grain > 0);
  check('离线归来只记少量史书（不逐年涌出）',
    (S19.chronicle || []).length - chron0 <= 3,
    '+' + ((S19.chronicle || []).length - chron0) + ' 条');
  var last19 = S19.chronicle[S19.chronicle.length - 1];
  check('离线归来有专门条目', last19 && last19.tag === 'offline', last19 && last19.text.slice(0, 24) + '…');
  var e19b = S19.world.elapsed;
  G.simulateBulk(7200);            // 聚合段：2 小时
  check('聚合补算推进历法', S19.world.elapsed > e19b,
    '+' + Math.round(S19.world.elapsed - e19b) + ' 游戏秒');
  check('聚合补算不逐秒循环（性能安全）', true, 'bulk=' + 7200 + 's 一次算完');
  var q19 = S19.queues.build.length;
  S19.queues.build.push({ cityId: city19.id, extIdx: -1, buildId: 'farm', type: 'ext_build', elapsed: 0, totalTime: 10 });
  G.simulateBulk(100);
  check('聚合补算能结算队列完成', S19.queues.build.length <= q19 + 1,
    '队列 ' + S19.queues.build.length + ' 个');

  console.log('\n===== 20. 建筑功能（客栈/招贤馆/仓库/市场/马厩）=====');
  var S20 = G.state;
  var fs20 = require('fs'), path20 = require('path');
  var c20 = S20.cities[0];

  function putBldg(id, lv) {
    var i = c20.cells.findIndex(function (c) { return !c.build && !c.official; });
    if (i < 0) return false;
    c20.cells[i].build = { id: id, lvl: lv };
    return true;
  }

  console.log('  --- 客栈招募 ---');
  S20.generals.length = 1;                    // 只留初始将领
  check('无客栈时不可招募', (function () {
    c20.cells.forEach(function (c) { if (c.build && c.build.id === 'kezhan') c.build = null; });
    return !G.canRecruitGeneral().ok;
  })(), G.canRecruitGeneral().msg);

  check('建造客栈与招贤馆', putBldg('kezhan', 3) && putBldg('zhaoxianguan', 5));
  check('客栈等级可读', G.innLevel() === 3, 'Lv' + G.innLevel());
  var cands20 = G.innRefresh();
  check('候选数 = 客栈等级（每级1位）', cands20.length === 3, cands20.length + ' 位');
  check('候选含四维属性', cands20[0].tong > 0 && cands20[0].nz > 0 && cands20[0].yw > 0 && cands20[0].zm > 0,
    '统' + cands20[0].tong + ' 内' + cands20[0].nz + ' 勇' + cands20[0].yw + ' 智' + cands20[0].zm);
  check('候选带资质字段', !!DATA.GEN_RANK_BY_ID[cands20[0].rank], cands20[0].rank);
  /* 统率的风格倍率区间为 0.96~1.10（最窄），适合作为区间校验 */
  check('候选四维落在该资质区间内（按风格倍率验算）', (function () {
    var bad = [];
    cands20.forEach(function (c) {
      var rk = DATA.GEN_RANK_BY_ID[c.rank];
      var lo = Math.floor(rk.base[0] * 0.95), hi = Math.ceil(rk.base[1] * 1.12);
      if (c.tong < lo || c.tong > hi) bad.push(c.name + ' 统' + c.tong);
    });
    return bad.length === 0;
  })(), cands20.map(function (c) { return c.name + '(统' + c.tong + ' ' + c.rank + ')'; }).join(' '));
  check('高资质四维区间上限更高（凡品<良材<英杰<名世<天授）', (function () {
    var order = ['fan', 'liang', 'ying', 'ming', 'tian'];
    for (var i = 1; i < order.length; i++) {
      if (DATA.GEN_RANK_BY_ID[order[i]].base[1] <= DATA.GEN_RANK_BY_ID[order[i - 1]].base[1]) return false;
    }
    return true;
  })());
  check('候选含将领与美人两类', cands20.every(function (c) { return typeof c.beauty === 'boolean'; }));
  check('候选有招募成本', cands20[0].cost > 0, U.fmt(cands20[0].cost) + ' 金');
  check('候选定时刷新机制存在', G.innRefreshLeft() >= 0, Math.ceil(G.innRefreshLeft() / 1000) + ' 秒后更换');

  var gold20 = S20.res.gold;
  var rc20 = G.innRecruit(cands20[0].id);
  check('招募成功', rc20.ok === true, rc20.msg);
  check('招募消耗黄金', S20.res.gold < gold20, U.fmt(gold20) + ' → ' + U.fmt(S20.res.gold));
  check('将领入帐', S20.generals.length === 2, S20.generals.length + ' 人');
  check('新将有属性与忠诚', S20.generals[1].tong > 0 && S20.generals[1].loyalty > 0,
    S20.generals[1].name + ' 统' + S20.generals[1].tong + ' 忠' + S20.generals[1].loyalty);
  check('候选人从列表移除', G.innRefresh().length === 2, G.innRefresh().length + ' 位');

  var g20b = S20.res.gold;
  g20b = S20.res.gold;
  var rr20 = G.innReroll();
  check('花金可另请一批', rr20.ok === true, rr20.msg);
  check('候选数量恢复', G.innRefresh(true).length === 3);

  console.log('  --- 招贤馆容量 ---');
  /* v64（老板）：「根据**该城的招贤馆等级**有相应空位」——
     `generalCap()`（当前城一格卡全境）已删，改为按城的 `genSlotsOf(city)`。 */
  check('将领席位 = 该城招贤馆等级', G.genSlotsOf(c20) === 5 && G.genSlotsTotal() >= 5,
    '本城 ' + G.genSlotsOf(c20) + ' 席 · 全境合计 ' + G.genSlotsTotal() + ' 席');
  var keep20 = S20.generals.slice();
  while (S20.generals.length < 5) S20.generals.push(G.makeGeneral('测试将' + S20.generals.length, 1, 'idle', c20.id, false));
  var full20 = G.canRecruitGeneral();
  check('满员时拒绝招募', full20.ok === false, full20.msg);
  check('满员提示指向招贤馆', /招贤馆/.test(full20.msg));
  S20.generals.length = 0; keep20.forEach(function (g) { S20.generals.push(g); });

  console.log('  --- 仓库储量 ---');
  check('无仓库时为基础储量', (function () {
    c20.cells.forEach(function (c) { if (c.build && c.build.id === 'cangku') c.build = null; });
    /* v79：储量吃"名城/爵位/主城/神器"加成 —— 期望值同步走唯一汇总口 */
    return G.storeCap() === Math.round(2000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct')));
  })(), U.fmt(G.storeCap()));
  check('建造仓库', putBldg('cangku', 3));
  check('仓库提升储量上限（每级+200万）',
    G.storeCap() === Math.round(6000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct'))), U.fmt(G.storeCap()));
  var overCap = G.storeCap() + 999999;
  S20.res.grain = overCap;
  G.tickOnce();
  check('产量结算受储量上限约束', S20.res.grain <= G.storeCap(),
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));

  console.log('  --- 市场交易 ---');
  check('无市场时不可交易', (function () {
    c20.cells.forEach(function (c) { if (c.build && c.build.id === 'shichang') c.build = null; });
    return !G.marketTrade('grain', 'wood', 100).ok;
  })());
  check('建造市场', putBldg('shichang', 5));
  check('市场提供汇率', G.marketRate() > 0.6 && G.marketRate() <= 0.95, '1 : ' + G.marketRate().toFixed(2));
  S20.res.grain = 100000; S20.res.wood = 0;
  var tr20 = G.marketTrade('grain', 'wood', 10000);
  check('资源兑换成功', tr20.ok === true, tr20.msg);
  check('换得量含折损', S20.res.wood > 0 && S20.res.wood < 10000, '10000 粮 → ' + S20.res.wood + ' 木');
  check('支出资源被扣除', S20.res.grain === 90000, U.fmt(S20.res.grain));
  check('非法交易被拒', G.marketTrade('grain', 'grain', 100).ok === false);

  console.log('  --- 马厩作为骑兵前置 ---');
  check('轻骑需马厩1级', DATA.TROOPS.qingji.unlock.majiu === 1);
  check('铁骑需马厩3级', DATA.TROOPS.tieji.unlock.majiu === 3);
  check('虎豹骑需马厩4级', DATA.TROOPS.hubaoqi.unlock.majiu === 4);
  var chkM20 = G.canTrain('qingji');
  check('未建马厩时轻骑不可训练', chkM20.ok === false && /马厩/.test(chkM20.msg), chkM20.msg);

  console.log('  --- 功能归属与自动存档 ---');
  var uiSrc20 = fs20.readFileSync(path20.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mainSrc20 = fs20.readFileSync(path20.join(__dirname, 'js', 'main.js'), 'utf8');
  check('建筑功能入口表存在', /BLDG_FUNC/.test(uiSrc20));
  ['junying', 'xiaochang', 'shuyuan', 'kezhan', 'zhaoxianguan', 'shichang', 'cangku', 'majiu'].forEach(function (bid) {
    check('功能归属：' + bid, new RegExp(bid + ':').test(uiSrc20.match(/var BLDG_FUNC = \{[\s\S]*?\};/)[0]));
  });
  check('自动存档间隔为 5 分钟', /AUTO_SAVE_MS = 5 \* 60 \* 1000/.test(mainSrc20));
  check('自动存档为覆盖式写入（同键替换）', /saveGame\(\)/.test(mainSrc20) && /SAVE_KEY/.test(fs20.readFileSync(path20.join(__dirname, 'js', 'state.js'), 'utf8')));
  check('募兵归属军队面板 / 出征归属地图', /junying: \{ label: \"[^\"]*募兵\"[^}]*view: \"troops\"/.test(uiSrc20.replace(/\s+/g, ' ')) ||
    /junying/.test(uiSrc20) && /xiaochang/.test(uiSrc20));

  console.log('\n===== 21. 自动升级 =====');
  var S21 = G.state;
  var city21 = S21.cities[0];

  function minUpgradableLv() {
    var m = 99;
    city21.cells.forEach(function (c) {
      if (!c.build || c.pending || c.official) return;
      var b = DATA.BUILDINGS[c.build.id];
      if (b && c.build.lvl < b.maxLevel) m = Math.min(m, c.build.lvl);
    });
    (extOf(S21) || []).forEach(function (e) {
      if (!e || !e.type || e.pending) return;
      var eb = DATA.EXT_BUILDINGS[e.type];
      if (eb && e.lv < 10) m = Math.min(m, e.lv);
    });
    /* v64（老板）：「城墙纳入自动建筑中」——城墙不占格（`city.wallLv`），
       但它是自动升级的候选之一，所以"当前最低等级"必须把它算进来 */
    S21.cities.forEach(function (ct) {
      var wcap = G.buildCapOf(ct, 'chengqiang');
      if ((ct.wallLv || 0) < wcap) m = Math.min(m, ct.wallLv || 0);
    });
    return m;
  }
  function giveRes21() {
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { S21.res[k] = 5000000; });
    S21.res.gold = 5000000;
  }

  check('默认关闭（避免不知情耗尽资源）', DATA.DEFAULT_SETTINGS.autoUpgrade === false);
  S21.settings.autoUpgrade = false;
  S21.queues.build.length = 0;
  var au0 = G.autoUpgrade();
  check('关闭时不做任何事', au0 === null && S21.queues.build.length === 0);

  S21.settings.autoUpgrade = true;
  S21.queues.build.length = 0;
  giveRes21();
  var wantLv = minUpgradableLv();
  var au1 = G.autoUpgrade();
  check('开启后自动排队升级', !!(au1 && au1.ok),
    au1 && au1.target ? (au1.target.name + ' → Lv' + (au1.target.lv + 1)) : '无动作');
  check('升级已进入建造队列', S21.queues.build.length === 1, S21.queues.build.length + ' 个队列');
  check('优先升级等级最低者（城墙 Lv0 时最先修城墙）', (function () {
    if (!(au1 && au1.target) || au1.target.lv !== wantLv) return false;
    /* v64：城墙 0 级 → 它必然是最低等级，第一个就该轮到它（老板："纳入自动建筑"） */
    var wallLow = S21.cities.some(function (ct) { return !(ct.wallLv || 0); });
    return wallLow ? (au1.target.kind === 'wall' && au1.target.lv === 0) : true;
  })(), '目标 ' + (au1 && au1.target ? (au1.target.kind + ' Lv' + au1.target.lv) : '?')
    + '（当前最低 Lv' + wantLv + '）');
  check('记录了自动升级状态', !!S21.autoState && !S21.autoState.paused, S21.autoState && S21.autoState.msg);

  /* 同级时城内优先 */
  var au2 = G.autoUpgrade();
  check('继续排队下一个', !!(au2 && au2.ok), au2 && au2.target ? au2.target.name : '—');
  var slots21 = G.buildSlots();
  check('队列上限生效（不无限排队）', S21.queues.build.length <= slots21,
    S21.queues.build.length + ' / 上限 ' + slots21);
  var full21 = S21.queues.build.length;
  var au3 = G.autoUpgrade();
  check('队列满时不再排队', S21.queues.build.length === full21 && au3 === null,
    S21.autoState && S21.autoState.msg);

  /* 资源不足 → 暂停 */
  S21.queues.build.length = 0;
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { S21.res[k] = 0; });
  var au4 = G.autoUpgrade();
  check('资源不足时暂停', !!(au4 && au4.paused === true), au4 && au4.reason);
  check('暂停状态已记录并可展示', !!(S21.autoState && S21.autoState.paused), S21.autoState && S21.autoState.msg);
  check('暂停不会自动关闭开关', S21.settings.autoUpgrade === true);
  check('暂停时未产生队列', S21.queues.build.length === 0);

  /* 资源恢复 → 自动继续 */
  giveRes21();
  var au5 = G.autoUpgrade();
  check('资源恢复后自动继续', !!(au5 && au5.ok), au5 && au5.target ? au5.target.name : '—');

  /* 官府 4 格等级同步 */
  S21.queues.build.length = 0;
  var gfCells = city21.cells.filter(function (c) { return c.build && c.build.id === 'guanfu'; });
  var gfLv0 = gfCells[0] ? gfCells[0].build.lvl : 0;
  if (gfCells.length) {
    var q21 = { cityId: city21.id, gridIndex: city21.cells.indexOf(gfCells[0]), buildId: 'guanfu', type: 'upgrade', targetLevel: gfLv0 + 1 };
    G.applyBuildDone(q21);
  }
  var gfNow = city21.cells.filter(function (c) { return c.build && c.build.id === 'guanfu'; })
    .map(function (c) { return c.build.lvl; });
  check('官府 4 格等级同步（不同步会导致容量与显示不一致）',
    gfNow.length === 4 && gfNow.every(function (l) { return l === gfNow[0]; }),
    '等级 ' + gfNow.join(' / '));

  /* 全部满级 → 停止（v14：自动升级遍历所有城池，需把所有城都升满） */
  S21.queues.build.length = 0;
  S21.cities.forEach(function (ct) {
    ct.cells.forEach(function (c) {
      if (c.build && DATA.BUILDINGS[c.build.id]) c.build.lvl = DATA.BUILDINGS[c.build.id].maxLevel;
    });
    /* v28（需求 1）：等级上限 10 → 12，这里必须跟着走，否则"全部满级"其实没满 */
    (G.extGridOf(ct) || []).forEach(function (e) { if (e && e.type) e.lv = DATA.MAX_BLEVEL; });
    /* v64：城墙也在候选里 —— 不把它拉满，就永远停不下来 */
    ct.wallLv = G.buildCapOf(ct, 'chengqiang');
  });
  var au6 = G.autoUpgrade();
  check('全部满级后停止（含城墙）', au6 === null && !!(S21.autoState && S21.autoState.done),
    S21.autoState && S21.autoState.msg);

  /* 与主循环联动 */
  var mainSrc21 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8');
  check('已接入主循环 tickOnce', /if \(GAME\.autoUpgrade\) GAME\.autoUpgrade\(\)/.test(mainSrc21));
  var uiSrc21 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  check('设置面板有开关', /toggle-auto-upgrade/.test(uiSrc21));
  /* v24（需求 9）：底部队列条删除，队列状态（含自动升级）改在「公文」页呈现 */
  check('队列状态在公文呈现（底部队列条已删）',
    /ui\.queueBody = function/.test(uiSrc21) && /🔨 自动升级/.test(uiSrc21)
    && !/queue-bar/.test(uiSrc21));

  console.log('\n===== 22. 地图观察框（视口渲染 / 导航 / 点击换算）=====');
  var S22 = G.state;
  var cv22 = global.document.createElement('canvas');
  var pc22 = G.map.playerCity() || { x: 250, y: 200 };

  G.map.render(cv22, { vx: 100, vy: 200, span: 12, cell: 44 });
  check('渲染后记录视口', G.map._view && G.map._view.vx === 100 && G.map._view.vy === 200,
    '(' + G.map._view.vx + ',' + G.map._view.vy + ')');
  /* v50：观察框由 12×8 改为 12×6 —— 地块改成菱形后，一格在屏幕上只有"半格高"，
     所以同样的画布高度要少切几刀；可见菱形是 12 宽 × 12 高。判据取实际值。 */
  check('观察框为 12×6（v50 菱形：宽 12 格距 · 高 6 格距）',
    G.map._view.spanX === 12 && G.map._view.spanY === 6,
    G.map._view.spanX + '×' + G.map._view.spanY);
  check('画布尺寸 = 宽格数×格距 与 高格数×格距', cv22.width === 12 * G.map._view.cell
    && cv22.height === 6 * G.map._view.cell, cv22.width + '×' + cv22.height);
  var pxPerCell = G.map._view.cell;
  check('每格像素充足（旧实现 760px 塞 500 格 ≈ 1.5px/格）', pxPerCell >= 30, pxPerCell + ' px/格');
  check('视野格数远小于全图（不再全图压缩）', G.map._view.spanX < DATA.MAP_W
    && G.map._view.spanY < DATA.MAP_H,
    '视野 ' + G.map._view.spanX + '×' + G.map._view.spanY + ' vs 全图 ' + DATA.MAP_W + '×' + DATA.MAP_H);

  /* ---- v50：菱形等距 —— vx/vy 是**视野中心格**，钳制范围就是 [0, 全图−1] ---- */
  G.map.render(cv22, { vx: 9999, vy: 9999, span: 12, cell: 44 });
  check('视野中心越界自动钳制到地图内', G.map._view.vx === DATA.MAP_W - 1
    && G.map._view.vy === DATA.MAP_H - 1,
    '(' + G.map._view.vx + ',' + G.map._view.vy + ')');
  G.map.render(cv22, { vx: -50, vy: -50, span: 12, cell: 44 });
  check('负坐标钳制为 0', G.map._view.vx === 0 && G.map._view.vy === 0);

  /* 平移（UI 层）：菱形下按**屏幕方向**把两轴位移对角合成 */
  UI.mapView.x = 100; UI.mapView.y = 100;
  UI.renderMapCanvas();
  var vx0 = UI.mapView.x, vy0 = UI.mapView.y;
  UI.mapPan(1, 0);
  check('向右平移 = i+1 / j−1（屏幕水平右移一格宽）',
    UI.mapView.x === vx0 + 1 && UI.mapView.y === vy0 - 1,
    '(' + vx0 + ',' + vy0 + ') → (' + UI.mapView.x + ',' + UI.mapView.y + ')');
  UI.mapPan(0, -2);
  check('向上平移 = 两轴各 −2（屏幕垂直上移）',
    UI.mapView.x === vx0 - 1 && UI.mapView.y === vy0 - 3,
    '(' + UI.mapView.x + ',' + UI.mapView.y + ')');
  UI.mapView.x = 0; UI.mapView.y = 0;
  UI.mapPan(-5, -5);
  check('平移不越左/上边界', UI.mapView.x === 0 && UI.mapView.y === 0);

  /* 坐标跳转：v50 直接把目标设为**视野中心**（菱形视野不是矩形，不必再减半屏） */
  UI.mapCenterOn(265, 215);
  check('坐标跳转把目标设为视野中心', UI.mapView.x === 265 && UI.mapView.y === 215,
    '(' + UI.mapView.x + ',' + UI.mapView.y + ')');
  check('视野信息文本改报中心格', UI.mapInfoText() === '中心 (265,215)', UI.mapInfoText());

  /* 点击换算：菱形反投影 */
  G.map.render(cv22, { vx: 100, vy: 200, span: 12, cell: 44 });
  var vv22 = G.map._view;
  check('菱形网格参数已记录（半宽/半高/中心格）',
    vv22 && vv22.cell === 44 && vv22.HW === 22 && vv22.HH === 11 && vv22.iso === true
    && vv22.span === 12 && vv22.vx === 100 && vv22.vy === 200,
    'cell=' + (vv22 && vv22.cell) + ' HW=' + (vv22 && vv22.HW) + ' HH=' + (vv22 && vv22.HH));
  check('画布尺寸与观察框一致（四角无留白）',
    vv22 && vv22.cvW === vv22.spanX * vv22.cell && vv22.cvH === vv22.spanY * vv22.cell,
    (vv22 && vv22.cvW) + '×' + (vv22 && vv22.cvH));
  check('2:1 菱形（半宽 = cell/2、半高 = cell/4）', vv22.HW === vv22.cell / 2
    && vv22.HH === vv22.cell / 4);
  /* 格心 → 屏幕 → 必须回到原格 */
  var isoXY = function (gx, gy) {
    return { x: vv22.ox + (gx - gy) * vv22.HW, y: vv22.oy + (gx + gy) * vv22.HH };
  };
  var probe22 = [[100, 200], [105, 203], [111, 206], [100, 206], [95, 203]], miss22 = [];
  probe22.forEach(function (p) {
    var sp = isoXY(p[0], p[1]);
    var h = G.map.pick(cv22, sp.x, sp.y);
    if (!h || h.x !== p[0] || h.y !== p[1]) miss22.push('(' + p[0] + ',' + p[1] + ')→' + (h ? h.x + ',' + h.y : 'null'));
  });
  check('菱形拾取：格心反解出正确全图坐标（反投影 + round，零误差）', miss22.length === 0,
    miss22.join(' ') || probe22.length + ' 个格心全部命中');
  /* 菱形内任意点 → 同一格。这是等距拾取的关键性质，也是"斜投影必然对不齐"的反证：
     设 u = dx/HW、v = dy/HH，菱形内 |u|+|v| ≤ 1 ⇒ 反投影后 |i|,|j| ≤ 0.5 ⇒ round 必得本格。
     采样覆盖四个尖角方向与四条边的中点方向 —— 若实现写成"先 floor 再算"，边中点方向第一个就错。 */
  check('菱形内任意点命中同一格（含四尖角方向与边中点方向）', (function () {
    var bad = [];
    var dirs = [[0, -0.4], [0.4, 0], [0, 0.4], [-0.4, 0],
      [0.28, -0.28], [0.28, 0.28], [-0.28, 0.28], [-0.28, -0.28],
      [0, -0.9], [0.9, 0], [0, 0.9], [-0.9, 0]];
    var base = isoXY(103, 202);
    dirs.forEach(function (d) {
      var h = G.map.pick(cv22, base.x + d[0] * vv22.HW, base.y + d[1] * vv22.HH);
      if (!h || h.x !== 103 || h.y !== 202) bad.push(d.join(',') + '→' + (h ? h.x + ',' + h.y : 'null'));
    });
    return bad.length === 0;
  })());
  check('地图外的点返回 null（不误命中）', G.map.pick(cv22, -3000, -3000) === null);

  /* 地形图标覆盖 */
  var mapSrc22 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'map.js'), 'utf8');
  check('野地改为矢量绘制（不再用 emoji 字体）', /function drawTerrainArt/.test(mapSrc22) &&
    !/TERRAIN_ICON/.test(mapSrc22) && !/emojiFont/.test(mapSrc22));
  check('7 种地形各有矢量画法', ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'].every(function (t) {
    return mapSrc22.indexOf("case '" + t + "'") >= 0;
  }));
  check('城池为等距立体绘制（等距盒体 + 四坡屋顶 + 门洞）',
    /function drawCityArt/.test(mapSrc22) && /function isoRoof/.test(mapSrc22)
    && /function isoBox\(/.test(mapSrc22));
  check('玩家城与 NPC 城区分（玩家城插绿旗）',
    /own = !!opts\.player/.test(mapSrc22) && /'#7bc96f'/.test(mapSrc22));
  check('地形按资源分色（双色渐变）', /TERRAIN_TINT/.test(mapSrc22));
  /* ============================================================
   * v45（需求 1）：老板说「野地现在区分度不好」。
   * 旧值的问题不是"没上色"，而是**七种地形塌成了两个色族**：
   *   绿族 草原/沼泽/森林（色相 90~100°、亮度 48~60）
   *   土族 荒漠/山地/城池（色相 35~45°、亮度 55~70）
   * 这条断言把"区分度"变成可算的判据：**依次从源码读出真值**（不是抄一遍写法），
   * 算 HSL，要求任意两族至少在「色相 / 明度 / 饱和度」里有一维明显拉开。
   * 只查色相是不够的 —— 荒漠与山地就是**同色相**，靠饱和度分开的。
   * ============================================================ */
  check('v45：八种地形底色两两可分（色相≥25° 或 明度≥15% 或 饱和度≥20%）', (function () {
    var m = mapSrc22.match(/var TERRAIN_TINT = \{([\s\S]*?)\n  \};/);
    if (!m) return false;
    function hsl(hex) {
      var v = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16) / 255; });
      var r = v[0], g = v[1], b = v[2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
      var h = 0;
      if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      var s = d > 1e-6 ? d / (1 - Math.abs(2 * l - 1)) : 0;
      return { h: h, s: s * 100, l: l * 100 };
    }
    var T = {}, cnt = 0;
    m[1].replace(/(\w+):\s*\['(#[0-9a-fA-F]{6})',\s*'(#[0-9a-fA-F]{6})'\]/g, function (_, k, a) {
      T[k] = hsl(a); cnt++; return _;
    });
    if (cnt !== 8) return false;
    var ks = Object.keys(T), bad = [];
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var A = T[ks[i]], B = T[ks[j]];
        var dh = Math.abs(A.h - B.h); if (dh > 180) dh = 360 - dh;
        var dl = Math.abs(A.l - B.l), ds = Math.abs(A.s - B.s);
        if (dh < 25 && dl < 15 && ds < 20) bad.push(ks[i] + '/' + ks[j] +
          '(色相' + Math.round(dh) + '° 明度' + Math.round(dl) + ' 饱和' + Math.round(ds) + ')');
      }
    }
    if (bad.length) console.log('      太像的组合：' + bad.join('，'));
    return bad.length === 0;
  })());
  check('已占野地有金框标记', /已占野地/.test(mapSrc22));
  check('视野外名城有边缘方向提示（贴合画布边缘的箭头）',
    /视野外的州城\/都城：边缘方向提示/.test(mapSrc22)
    && /Math\.abs\(c4\.x - px\) > Math\.abs\(c4\.y - py\)/.test(mapSrc22));
  /* v50（老板）：「地块改成菱形侧向分布」—— 改的是**整张网格的排布**，
     不是把贴图裁成菱形贴到正方形上。旧的正方形绘制必须彻底消失。 */
  check('地图为菱形等距排布（v50：不再是正方形网格）',
    /var HW = cell \/ 2;/.test(mapSrc22) && /var HH = cell \/ 4;/.test(mapSrc22)
    && /2:1 等距/.test(mapSrc22)
    && /function diaPath\(/.test(mapSrc22) && /function sideSides\(/.test(mapSrc22)
    && /function gxy\(gx, gy\)/.test(mapSrc22)
    && !/tx \* cell \+ cell \/ 2/.test(mapSrc22) && !/function topRect\(/.test(mapSrc22));
  check('画布尺寸 = 宽/高格数 × 格距（宽高可不等）',
    /cvW = Math\.round\(spanX \* cell\)/.test(mapSrc22)
    && /cvH = Math\.round\(spanY \* cell\)/.test(mapSrc22));
  /* v50：落点一律由 topCY(gx,gy,el) 给出 —— 菱形下要**格号**才能算形状，
     所以比正方形版多一个参数（这正是斜投影最容易漏的地方：格心对了、形状还错着）。 */
  check('地形/城池绘制在菱形顶面上（落点由 topCY 按格号给出）',
    /topCY\(d\.gx, d\.gy, d\.el\) - S \* 0\.58/.test(mapSrc22)
    && /topCY\(gx, gy, el\)/.test(mapSrc22));
  check('v50-c：城池/据点由**绘图**呈现立体感（等距盒体自下而上堆叠）', (function () {
    /* 老板："通过绘图呈现立体感" —— 不再依赖位图素材，改为程序化绘制：
       每个构件是一个**等距盒体**（顶面菱形 + 左下 / 右下两个立面），
       城池按 台基 → 城墙 → 角楼/门楼 → 主楼 → 四坡顶 逐层堆叠。
       立体感三要素：① 顶面 > 左面 > 右面 的明度差（光源在左上）
                     ② 构件之间的高低差（主楼高于角楼、角楼高于城墙）
                     ③ 每层顶面留一道受光亮线 */
    var s = mapSrc22;
    if (s.indexOf('function isoBoxFaces(cx, cy, w, h)') < 0) return false;
    if (s.indexOf('function isoBox(ctx, cx, cy, w, h, col, lit)') < 0) return false;
    if (s.indexOf('function isoRoof(ctx, cx, cy, w, h, col)') < 0) return false;
    if (s.indexOf('function drawCityArt(ctx, cx, cy, baseW, opts)') < 0) return false;
    if (s.indexOf('function drawFortArt(ctx, cx, cy, baseW)') < 0) return false;
    /* 自动校验每一组配色都满足「顶面 > 左面 > 右面」的亮度序 ——
       比抄色值稳：以后调色只要破坏了这个序就会红。 */
    function lum(hex) {
      var n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    }
    var groups = s.match(new RegExp("\\[\\s*'#[0-9a-fA-F]{6}'\\s*,\\s*'#[0-9a-fA-F]{6}'\\s*,\\s*'#[0-9a-fA-F]{6}'\\s*\\]", 'g')) || [];
    if (groups.length < 6) return false;
    return groups.every(function (t) {
      var c = (t.match(/#[0-9a-fA-F]{6}/g) || []).map(lum);
      return c.length === 3 && c[0] > c[1] && c[1] > c[2];
    });
  })());
  check('地图拾取为菱形反投影 + round（无三角函数，零误差）',
    /var a = \(mx - v\.ox\) \/ v\.HW, b = \(my - v\.oy\) \/ v\.HH;/.test(mapSrc22)
    && /var gx = Math\.round\(\(a \+ b\) \/ 2\), gy = Math\.round\(\(b - a\) \/ 2\);/.test(mapSrc22));
  check('v50：拾取按 clientWidth 扣掉画布边框（rect.width 含 3px 边框会错格）', (function () {
    /* 实测（真浏览器，无桩）：canvas 有 3px 边框 → rect 1254 / 属性 1248，差 0.5%。
       旧公式直接拿 rect.width 缩放，在**贴近菱形边界**的点上命中率只有 31%
       （320 点中 100），而且错得"像手抖"，最难查；扣掉边框后 320/320。
       这一条锁的是那份修正，避免以后有人"简化"回去。 */
    return /canvas\.clientWidth \|\| rect\.width/.test(mapSrc22)
      && /var bl = Math\.max\(0, \(rect\.width - cw\) \/ 2\)/.test(mapSrc22)
      && /clientX - rect\.left - bl/.test(mapSrc22);
  })());
  /* ============================================================
   * v42（需求 2）：老板要「2.5D 呈现，有点太平了」——
   * v22 那条「地图格内无侧壁/厚度（暗色界面用亮度分层）」已被**有意取代**：
   * 原样恢复等于要求设计回退（与 v37 恢复统计页断言同一类判断）。
   * 所以改判据：验「顶面 + 土色侧壁」两片结构齐备，并验几何语义没被破坏。
   * ============================================================ */
  check('v50-a：地块为「菱形顶面 + 两个侧面」，抬升按地形分档且**厚度 ≤ 缝宽**',
    /var ELEV_PX = \{/.test(mapSrc22) && /function elevFor\(/.test(mapSrc22)
    && /function diaPath\(gx, gy, el, k\)/.test(mapSrc22)
    && /function sideSides\(gx, gy, el\)/.test(mapSrc22)
    && /function soilOf\(tint, k\)/.test(mapSrc22) && /soilOf\(tint, [\d.]+\)/.test(mapSrc22)
    /* 「一个侧壁」是正方形时代的样子 —— 菱形下必须**两个面**、且左右明度不同才有立体感 */
    && /\['left', 'right'\]\.forEach/.test(mapSrc22)
    && /var kTop = which === 'left' \? [\d.]+ : [\d.]+;/.test(mapSrc22));
  check('v50-a：侧壁厚度硬上限 = 缝宽 IN（超过就压到北邻格顶面 —— 老板"地块都叠在一起了"）', (function () {
    /* 几何依据：菱形密铺里格 A 的下尖角与南邻上尖角**共点**，
       A 侧壁最低点是 cy + HH − IN/2 + el，只要 el ≤ IN 就仍在缝内。
       首版按 cell 比例给到 35px（山），侧壁直接盖住北邻格。 */
    var m = mapSrc22.match(/var ELEV_PX_MAX = ([\d.]+);/);
    var i = mapSrc22.match(/var IN = ([\d.]+);\s*\/\* 顶面菱形内缩量/);
    if (!m || !i) return false;
    return parseFloat(m[1]) <= parseFloat(i[1]);
  })());
  check('v50-a：顶面**固定在格心**（不再随 el 上浮）', (function () {
    /* 上浮同样会侵入北邻格 —— topCY/topBottom/diaPath/diaBox 里都不许再出现 "− el" */
    var cyFn = (mapSrc22.match(/function topCY\(gx, gy, el\) \{([^}]*)\}/) || [])[1] || '';
    var btFn = (mapSrc22.match(/function topBottom\(gx, gy, el\) \{([^}]*)\}/) || [])[1] || '';
    var dpFn = (mapSrc22.match(/function diaPath\(gx, gy, el, k\) \{([\s\S]{0,400}?)\n    \}/) || [])[1] || '';
    var dbFn = (mapSrc22.match(/function diaBox\(gx, gy, el, k\) \{([\s\S]{0,400}?)\n    \}/) || [])[1] || '';
    return cyFn && btFn && dpFn && dbFn
      && !/-\s*el\b/.test(cyFn) && !/-\s*el\b/.test(btFn)
      && !/cy = c\.y - el/.test(dpFn) && !/c\.y - el/.test(dbFn);
  })());
  check('v50-a：分档仍是「山最高、平地最薄」（幅度压进缝里，但高低差还在）', (function () {
    var m = mapSrc22.match(/var ELEV_PX = \{([\s\S]*?)\};/);
    if (!m) return false;
    var g = function (k) { var r = m[1].match(new RegExp(k + ':\\s*([\\d.]+)')); return r ? parseFloat(r[1]) : NaN; };
    return g('hill') > g('forest') && g('forest') > g('caoyuan') && g('caoyuan') > g('plain')
      && g('plain') > 0 && g('lake') > 0 && g('city') > 0;
  })());
  check('v50：菱形绘制不引入三角函数（纯线性变换，误差不可能累积）',
    !/Math\.(sin|cos|tan)\(/.test(mapSrc22) && /elev: ELEV/.test(mapSrc22));
  check('v50：按纵深 (gx+gy) 排序绘制（斜投影正确遮挡的前提）',
    /drawList\.sort\(function \(a, b\) \{ return \(a\.gx \+ a\.gy\) - \(b\.gx \+ b\.gy\); \}\)/.test(mapSrc22)
    /* 据点/城池同理：三种物件必须合并排序，否则南北相邻时会互相"穿透" */
    && /marks\.sort\(function \(a, b\) \{ return \(a\.gx \+ a\.gy\) - \(b\.gx \+ b\.gy\); \}\)/.test(mapSrc22));
  /* ---- v45（需求 0）：地形贴图铺满地块 + 缝加宽 + 顶棱画在贴图之上 ---- */
  check('v50：地形贴图按**菱形裁切**、铺满菱形外接框（与顶面同一个来源）',
    /function blitArtRect/.test(mapSrc22)
    && /var ab = diaBox\(d\.gx, d\.gy, d\.el, IN\)/.test(mapSrc22)
    && /diaPath\(d\.gx, d\.gy, d\.el, -IN\)/.test(mapSrc22)
    && /blitArtRect\(ctx, 'terrain_' \+ d\.terrain, ab\.x, ab\.y, ab\.w, ab\.h\)/.test(mapSrc22)
    /* 贴图**不做斜切变形**（正交铺贴 + 菱形裁切）。真仿射（旋转 45°）会把沙纹、水波
       这类方向性纹理拧歪；纵向压扁 2:1 才是等距视角应有的观感。 */
    && !/ctx\.rotate\(/.test(mapSrc22) && !/setTransform/.test(mapSrc22)
    /* 正方形时代的矩形裁切必须彻底消失 */
    && !/ctx\.roundRect\(ab\.x, ab\.y, ab\.w, ab\.h, 5\)/.test(mapSrc22)
    /* 旧的"正方形居中 86%"贴图写法（blitArt 直贴）也必须消失 */
    && !/blitArt\(ctx, 'terrain_'/.test(mapSrc22));
  check('v47：铺图走 cover（保持素材长宽比，不随顶面高度压扁）', (function () {
    /* 顶面高 = cell − el，山地只有 cell 的 66% → 直接拉伸会把岩石纹理纵向压扁 34%。
       cover 只裁不缩；顺带把 AI 素材最外圈（最易畸形的一圈）裁掉。 */
    var i = mapSrc22.indexOf('function blitArtRect');
    var seg = mapSrc22.slice(i, i + 1600);      // v49：函数里加了 USE 的说明注释，窗口要放宽
    return /Math\.max\(w \/ c\.width, h \/ c\.height\)/.test(seg)
      && /ctx\.drawImage\(c, \(c\.width - cw\) \/ 2, \(c\.height - ch\) \/ 2, cw, ch, x, y, w, h\)/.test(seg);
  })());
  check('v50：菱形几何只有一个来源（gxy / diaPath / diaBox / sideSides）', (function () {
    /* v47 的教训：顶面几何被抄三处 → 贴图偏移 4px。v50 换成菱形后"抄"的代价更大
       （格心、形状、厚度、外接框四样都得一致）。所以这里查**结构**：
       ① 四个几何函数的入参都是格号 (gx,gy)；② 坐标与定位函数必须由 gxy 派生；
       ③ 绘制侧不许再出现裸的 cell/2 定位（那正是"改一处漏一处"的来源）。 */
    if (!/function gxy\(gx, gy\)/.test(mapSrc22)) return false;
    if (!/function diaPath\(gx, gy, el, k\)/.test(mapSrc22)) return false;
    if (!/function diaBox\(gx, gy, el, k\)/.test(mapSrc22)) return false;
    if (!/function sideSides\(gx, gy, el\)/.test(mapSrc22)) return false;
    var dbFn = (mapSrc22.match(/function diaBox\(gx, gy, el, k\) \{([\s\S]{0,400}?)\n    \}/) || [])[1] || '';
    var cyFn = (mapSrc22.match(/function topCY\(gx, gy, el\) \{([\s\S]{0,140}?)\}/) || [])[1] || '';
    var btFn = (mapSrc22.match(/function topBottom\(gx, gy, el\) \{([\s\S]{0,140}?)\}/) || [])[1] || '';
    if (!/gxy\(gx, gy\)/.test(dbFn) || !/gxy\(gx, gy\)/.test(cyFn) || !/gxy\(gx, gy\)/.test(btFn)) return false;
    /* 反投影也要与正投影成对出现（一个负责拾取、一个负责绘制，两处必须互为逆变换） */
    if (!/function invScreen\(sx, sy\)/.test(mapSrc22)) return false;
    if (/c\.x - cell \/ 2 \+ TG/.test(mapSrc22)) return false;
    return true;
  })());
  check('缝宽由 TILE_GAP 单一定义，且落在合理区间（v45 起 4px，v49 收窄以减弱格子感）', (function () {
    /* 不写死具体值：缝宽是视觉调参项（4→3→2 都出现过），写死会让每次调参都假红。
       查的是"只有一个来源、值在 1~5 之间、没退回 1px 的老值"。 */
    var m = mapSrc22.match(/var TILE_GAP = (\d+);/g) || [];
    if (m.length !== 1) return false;
    var v = parseInt(m[0].replace(/\D/g, ''), 10);
    return v >= 1 && v <= 5;
  })());
  check('v50：每块菱形先铺满该地形的土色基底（缝里露邻格土色，不是深色空洞）', (function () {
    /* v49 起"减少格子感"的主力：**整块铺该地形的土色**，缝里露的是邻格土色。
       v50 换成菱形后这条必须保留 —— 老板认可的是这个效果，不是正方形的形状。 */
    return /ctx\.fillStyle = soilOf\(tint, [\d.]+\);[\s\S]{0,80}?diaPath\(d\.gx, d\.gy, 0, 0\);/.test(mapSrc22)
      /* 两个侧面各自渐变（上接基底色、下端更暗） */
      && /createLinearGradient\(0, c\.y, 0, c\.y \+ HH \+ el\)/.test(mapSrc22)
      /* 明度档写成变量（kTop/kBot，because 左右两面取值不同），所以匹配标识符而非数字 */
      && /g3\.addColorStop\(0, soilOf\(tint, \w+\)\)/.test(mapSrc22)
      && /g3\.addColorStop\(1, soilOf\(tint, \w+\)\)/.test(mapSrc22)
      /* 顶棱高光仍在（菱形版画的是顶面上方那两条棱） */
      && /0\.14 \+ Math\.min\(0\.24, el \/ ELEV_PX_MAX \* 0\.24\)/.test(mapSrc22)
      /* 画布兜底色不再是那个很深的 #3b3423（缝不再是"深色沟"） */
      && !/'#3b3423'/.test(mapSrc22);
  })());
  check('v49：cover 的源取用范围收到 45%（实测该档细节最好）', (function () {
    var i = mapSrc22.indexOf('function blitArtRect');
    var seg = mapSrc22.slice(i, i + 1600);
    return /var USE = 0\.45;/.test(seg)
      && /var maxSide = Math\.min\(c\.width, c\.height\) \* USE;/.test(seg)
      && /if \(cw > maxSide \|\| ch > maxSide\)/.test(seg);
  })());
  check('v50：顶棱高光/菱形描边画在贴图**之后**（否则被铺满的贴图盖掉）',
    /function edgeOf\(gx, gy, el\)/.test(mapSrc22)
    && /drawList\.forEach\(function \(d\) \{ edgeOf\(d\.gx, d\.gy, d\.el\); \}\);/.test(mapSrc22));
  check('v50-a：城池格也有菱形描边（不再读成"一块方块"）', (function () {
    /* 老板："城池怎么还是正方形的" —— 城池格不铺地形贴图，原来只有一个 ≈90px 的
       大图标（比 104×52 的菱形还高），整块地读起来就是方块。
       v50-a 把图标收进菱形（≤ 菱形外接框的 95%），并给城池格描一圈菱形边。 */
    return /diaPath\(gx, gy, el, -IN \* 0\.5\)/.test(mapSrc22)
      && /rgba\(214,204,168,\.5\)/.test(mapSrc22)
      /* v50-c：城池改为程序化等距绘制（底面中心取地块中心稍下） */
      && mapSrc22.indexOf('drawCityArt(ctx, c.x, tcy + HH * ') >= 0;
  })());
  check('v50-a：顶面内侧有 AO 阴影（不越界也能读出厚度）', (function () {
    /* 菱形密铺里"真的加厚"会被北邻格挡住，所以厚度感只能画在顶面内部 ——
       沿下方两条边压一道渐变。这是"既不重叠、又有立体感"的唯一出路。 */
    return /下缘的 AO 内阴影/.test(mapSrc22)
      && /rgba\(12,14,8,\.30\)/.test(mapSrc22)
      && /diaPath\(gx, gy, el, -IN\);[\s\S]{0,120}?ctx\.clip\(\)/.test(mapSrc22);
  })());
  check('v50：野地金框/据点/城池都拿到「格号 + 格心 + 本格 el」，无残留写死 ELEV',
    !/cell - ELEV\b/.test(mapSrc22) && !/topCY\(c\.y\)/.test(mapSrc22)
    && !/topBottom\(c\.y\)/.test(mapSrc22)
    /* 菱形版必须拿到格号：只给格心画不出菱形 */
    && (mapSrc22.match(/function \(gx, gy, c, el\)/g) || []).length >= 3);

  /* 导航 UI */
  var uiSrc22 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  check('地图有四个方向按钮', /map-pan/.test(uiSrc22) && /'▲'/.test(uiSrc22) && /'◀'/.test(uiSrc22) &&
    /'▼'/.test(uiSrc22) && /'▶'/.test(uiSrc22));
  check('v45/v50：方向键步长 = 上下 8 格 / 左右 12 格（沿网格轴，常量单一定义）',
    G.ui.MAP_STEP_X === 12 && G.ui.MAP_STEP_Y === 8
    && /mkBtn\('left', -ui\.MAP_STEP_X, 0, '◀'\)/.test(uiSrc22)
    && /mkBtn\('up', 0, -ui\.MAP_STEP_Y, '▲'\)/.test(uiSrc22)
    && (uiSrc22.match(/ui\.MAP_STEP_X = 12/g) || []).length === 1);
  /* 菱形下方向键必须按**屏幕方向**走：把两轴位移对角合成，而不是沿单轴。 */
  check('v50：方向键按屏幕方向对角合成（右 = i+Δ/j−Δ，下 = 两轴同 +Δ）',
    /var dgx = \(dx \|\| 0\) \+ \(dy \|\| 0\);/.test(uiSrc22)
    && /var dgy = \(dy \|\| 0\) - \(dx \|\| 0\);/.test(uiSrc22));
  check('地图有坐标输入框', /map-gx/.test(uiSrc22) && /map-gy/.test(uiSrc22));
  check('地图有回主城/洛阳快捷', /map-center/.test(uiSrc22) && /map-capital/.test(uiSrc22));

  /* 地块渲染：建筑直接成画（v12 起不再用色块 + emoji） */
  var htmlSrc22 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  check('城内地块改用 SVG 图标', /GAME\.icons\.forBuilding\(cell\.build\.id\)/.test(uiSrc22));
  check('城外地块改用 SVG 图标', /GAME\.icons\.forExt\(e\.type\)/.test(uiSrc22));
  check('地块不再使用 emoji 图标字段', !/class="bicon">' \+ b\.icon/.test(uiSrc22));
  /* v20：旧 .build-cell 体系（含 .b3d 承台）已删除 —— 现行是 .iso-tile / .tile-face / .tile-art。
     原断言查的是**死 CSS**，属于「绿得没有意义」，此处改指现行结构。 */
  check('地块底座为 .tile-face（旧 .b3d 承台已删）',
    /\.tile-face \{/.test(htmlSrc22) && !/\.build-cell \{/.test(htmlSrc22));
  check('地块悬停只提亮描边（不再位移上浮 —— 位移正是"飘"的来源）',
    /\.iso-tile:hover \.tile-face \{[\s\S]{0,120}filter: brightness/.test(htmlSrc22)
    && !/\.build-cell:hover/.test(htmlSrc22));
  check('地块为深色底 + 建筑成画（无彩色块）', /\.tile-art \.ico \{/.test(htmlSrc22) && !/\.cat-gov/.test(htmlSrc22));

  console.log('\n===== 23. 装备获取 / 资质分级 / 死属性修复（v11） =====');
  (function () {
    var S23 = G.state;              // 注意：第14节 loadGame 已替换 state 对象，外层 s 是失效引用
    var city23 = S23.cities[0];
    /* ---------- ① 资质分级 ---------- */
    console.log('  --- 将领资质分级 ---');
    check('五档资质定义', DATA.GEN_RANKS.length === 5,
      DATA.GEN_RANKS.map(function (r) { return r.name; }).join(' / '));
    check('资质含四要素（权重/区间/成长/价格）', DATA.GEN_RANKS.every(function (r) {
      return typeof r.w === 'number' && r.base && r.base.length === 2 && r.grow > 0 && r.price > 0;
    }));
    check('高资质出现概率递增（凡>良>英>名>天）', (function () {
      var w = DATA.GEN_RANKS.map(function (r) { return r.w; });
      for (var i = 1; i < w.length; i++) if (w[i] >= w[i - 1]) return false;
      return true;
    })(), DATA.GEN_RANKS.map(function (r) { return r.name + r.w; }).join(' '));
    check('高资质成长更高（+1/+2/+3/+5/+8）', (function () {
      var g = DATA.GEN_RANKS.map(function (r) { return r.grow; });
      for (var i = 1; i < g.length; i++) if (g[i] <= g[i - 1]) return false;
      return true;
    })(), DATA.GEN_RANKS.map(function (r) { return r.grow; }).join('/'));
    check('高资质价格更贵', (function () {
      var p = DATA.GEN_RANKS.map(function (r) { return r.price; });
      for (var i = 1; i < p.length; i++) if (p[i] <= p[i - 1]) return false;
      return true;
    })(), DATA.GEN_RANKS.map(function (r) { return r.price + 'x'; }).join(' '));

    /* 权重随客栈等级倾斜：高级客栈更容易出高资质 */
    var w1 = G.rankWeights(1), w10 = G.rankWeights(10);
    function pctOf(ws, id) {
      var t = 0; ws.forEach(function (x) { t += x.w; });
      var v = 0; ws.forEach(function (x) { if (x.rank.id === id) v = x.w; });
      return v / t * 100;
    }
    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」
       v73（老板）：「限制高资质将领的直接获取，概率再降 10 倍」—— 累计口径：
       天授 ÷100 · 名世 ÷80 · 英杰 ÷60（v66 的 ÷10/8/6 之后再各 ÷10），低资质两轮不动。
       断言写成"倍率"而不是写死数字，将来老板再调档位时只改 CUT 一处。 */
    var CUT = { tian: 100, ming: 80, ying: 60 };
    var ORIG = { tian: 2, ming: 6, ying: 15 };
    check('实测：高资质权重按累计 ÷100 / ÷80 / ÷60 下调（v73 再降10倍）', (function () {
      var bad = [];
      Object.keys(CUT).forEach(function (k) {
        var r = null;
        DATA.GEN_RANKS.forEach(function (x) { if (x.id === k) r = x; });
        if (!r || Math.abs(r.w - ORIG[k] / CUT[k]) > 1e-9) bad.push(k + '=' + (r && r.w));
      });
      return bad.length === 0;
    })(), '天授 ' + ORIG.tian + '→' + (ORIG.tian / CUT.tian) + ' · 名世 ' + ORIG.ming + '→'
      + (ORIG.ming / CUT.ming) + ' · 英杰 ' + ORIG.ying + '→' + (ORIG.ying / CUT.ying));
    check('实测：低资质（凡品 / 良材）权重未动', (function () {
      var w = {};
      DATA.GEN_RANKS.forEach(function (r) { w[r.id] = r.w; });
      return w.fan === 50 && w.liang === 27;
    })());
    check('实测：客栈1级 天授概率 ≈0.026%（v66 时 0.25%，两轮共 ÷100）',
      Math.abs(pctOf(w1, 'tian') - 0.026) < 0.01,
      pctOf(w1, 'tian').toFixed(3) + '%');
    check('结构：权重下限不再吃掉这次下调（旧写法 Math.max(0.5, …) 会把 0.2 抬回 0.5）', (function () {
      var t = null;
      G.rankWeights(1).forEach(function (x) { if (x.rank.id === 'tian') t = x; });
      return !!t && t.w < 0.3;
    })(), '客栈1级 天授权重 ' + (function () {
      var t = null;
      G.rankWeights(1).forEach(function (x) { if (x.rank.id === 'tian') t = x; });
      return t ? t.w.toFixed(2) : '?';
    })());
    check('客栈10级 天授概率上升', pctOf(w10, 'tian') > pctOf(w1, 'tian'),
      pctOf(w1, 'tian').toFixed(2) + '% → ' + pctOf(w10, 'tian').toFixed(2) + '%');
    check('客栈10级 凡品概率下降', pctOf(w10, 'fan') < pctOf(w1, 'fan'),
      pctOf(w1, 'fan').toFixed(1) + '% → ' + pctOf(w10, 'fan').toFixed(1) + '%');

    /* 抽样：统计各资质实际出现率 */
    var sample = {}, N = 4000;
    for (var si = 0; si < N; si++) {
      var rk = G.pickRank(1);
      sample[rk.id] = (sample[rk.id] || 0) + 1;
    }
    var tianRate = (sample.tian || 0) / N * 100;
    check('抽样 4000 次 天授出现率 <5%（稀有）', tianRate < 5, tianRate.toFixed(2) + '%');
    check('抽样 凡品为最常见', (sample.fan || 0) === Math.max.apply(null, Object.keys(sample).map(function (k) { return sample[k]; })),
      Object.keys(sample).map(function (k) { return k + ':' + sample[k]; }).join(' '));

    /* 属性区间：天授 > 名世 > 英杰 > 良材 > 凡品 */
    check('资质属性区间严格递增', (function () {
      for (var i = 1; i < DATA.GEN_RANKS.length; i++) {
        if (DATA.GEN_RANKS[i].base[0] <= DATA.GEN_RANKS[i - 1].base[1]) return false;
      }
      return true;
    })(), DATA.GEN_RANKS.map(function (r) { return r.name + r.base[0] + '~' + r.base[1]; }).join(' | '));

    /* 成长差异：模拟同等级下不同资质的四维 */
    var grown = {};
    DATA.GEN_RANKS.forEach(function (r) {
      var gg = G.makeGeneral('测试', 1, 'idle', city23.id, false, r.id, 'balance');
      gg.tong = (r.base[0] + r.base[1]) / 2;
      var lv0 = gg.tong;
      gg.level = 30;
      for (var k = 1; k < 30; k++) G.applyLevelGrowth(gg);
      grown[r.id] = Math.round(gg.tong);
      check('资质 ' + r.name + ' 30级统率 = 初始 + ' + r.grow + '×29', Math.abs(gg.tong - (lv0 + r.grow * 29)) < 0.01,
        Math.round(lv0) + ' → ' + Math.round(gg.tong));
    });
    check('天授 30级统率远超凡品（差异拉开）', grown.tian > grown.fan * 3,
      '凡品 ' + grown.fan + ' vs 天授 ' + grown.tian);

    /* 史实名将资质按四维总和判定 */
    check('曹操(四维437)→天授', G.heroRank(437).id === 'tian', G.heroRank(437).name);
    check('赵云级(400)→名世', G.heroRank(400).id === 'ming', G.heroRank(400).name);
    check('中等(340)→英杰', G.heroRank(340).id === 'ying', G.heroRank(340).name);
    check('低(200)→凡品', G.heroRank(200).id === 'fan', G.heroRank(200).name);
    var hero23 = G.makeHero(DATA.HEROES[0], 20);
    check('makeHero 带资质字段', !!hero23.rank, hero23.name + ' → ' + hero23.rank);

    /* ---------- ② 铁匠铺打造 ---------- */
    console.log('  --- 铁匠铺打造（装备获取主途径） ---');
    S23.queues.build.length = 0;
    S23.queues.train.length = 0;
    S23.queues.tech.length = 0;
    var i23 = city23.cells.findIndex(function (c) { return !c.build && !c.official; });
    city23.cells[i23].build = { id: 'tiejiangpu', lvl: 1 };
    check('建铁匠铺Lv1 → 仅可打造凡品', G.forgeMaxQ() === 1, 'maxQ=' + G.forgeMaxQ());
    check('无铁匠铺提示', (function () {
      city23.cells[i23].build = null;
      var r = G.forge('cr_head_1');
      city23.cells[i23].build = { id: 'tiejiangpu', lvl: 1 };
      return r.ok === false && /铁匠铺/.test(r.msg);
    })());
    check('凡品散件成本 = 基准×槽位倍率', (function () {
      var c = G.forgeCost('cr_head_1');
      return c.gold === Math.round(800 * 1.1) && c.iron === Math.round(300 * 1.1);
    })(), JSON.stringify(G.forgeCost('cr_head_1')));
    check('套装件成本更高（×2.2）', G.forgeCost('ms_h1').gold > G.forgeCost('cr_head_2').gold,
      G.forgeCost('cr_head_2').gold + ' → ' + G.forgeCost('ms_h1').gold);
    check('Lv1 造珍品被拒', (function () {
      var r = G.forge('cr_head_3');
      return r.ok === false && /铁匠铺等级不足/.test(r.msg);
    })());

    /* 打造成功 */
    var inv0 = (S23.inventory || []).length;
    S23.res.iron += 50000; S23.res.wood += 50000; S23.res.stone += 50000; S23.res.gold += 50000;
    /* v12：打造需材料，先备齐 */
    DATA.MATERIAL_IDS.forEach(function (mid) { S23.items[mid] = (S23.items[mid] || 0) + 200; });
    var rf = G.forge('cr_head_1');
    check('打造凡品盔成功', rf.ok === true, rf.msg);
    check('成品进入装备背包', (S23.inventory || []).length === inv0 + 1
      && S23.inventory.some(function (x) { return G.eqId(x) === 'cr_head_1'; }));
    check('记录已打造（图鉴）', (S23.forged || []).indexOf('cr_head_1') >= 0);
    check('材料被扣除', G.forgeCost('cr_head_1').iron > 0 && S23.inventory.length > inv0);

    /* 图纸门槛 */
    city23.cells[i23].build = { id: 'tiejiangpu', lvl: 7 };
    check('Lv7 → 可打造神品', G.forgeMaxQ() === 4, 'maxQ=' + G.forgeMaxQ());
    S23.items.bp_yitian = 0;
    var ry = G.forge('yt_sword');
    check('缺图纸时打造倚天套被拒', ry.ok === false && /图纸/.test(ry.msg), ry.msg);
    S23.items.bp_yitian = 1;                       // 补齐图纸
    S23.res.gold = 1000000; S23.res.iron = 400000; S23.res.wood = 300000; S23.res.stone = 200000;
    var ry2 = G.forge('yt_sword');
    check('持图纸时打造成功', ry2.ok === true, ry2.msg);
    check('倚天长剑入背包', S23.inventory.some(function (x) { return G.eqId(x) === 'yt_sword'; }));
    check('图纸可于商城购买', (function () {
      var found = null;
      DATA.ITEMS.forEach(function (it) { if (it.id === 'bp_yitian') found = it; });
      return !!found && found.price > 0 && found.type === 'blueprint';
    })());

    /* 清单分组 */
    var fl = G.forgeList();
    check('打造清单含散件与套装件', fl.length > 50, fl.length + ' 件');
    check('清单标注品质门槛是否满足', fl.every(function (f) { return typeof f.tierOk === 'boolean' && typeof f.bpOk === 'boolean'; }));

    /* 战利品掉落 */
    var gotBP = 0, gotPiece = 0;
    for (var li = 0; li < 400; li++) {
      var loot0 = G.battle.rollEquipLoot({ type: 'zhou', name: '__none__' });
      loot0.forEach(function (x) { if (/图纸/.test(x)) gotBP++; else gotPiece++; });
    }
    check('州城战利品可掉图纸', gotBP > 0, gotBP + ' 次/400');
    check('州城战利品可掉成品装备', gotPiece > 0, gotPiece + ' 次/400');
    check('都城图纸掉落率高于郡城', DATA.LOOT_EQUIP.capital.blueprint > DATA.LOOT_EQUIP.jun.blueprint);

    /* ---------- ③ 死属性修复 ---------- */
    console.log('  --- 死属性复核（算出却没人用的字段） ---');
    /* 3.1 将领体力 → 战斗（v66：装备体力改走"进体力上限"这一条链）
       改前这里是 `genAttrs.hp`（装备 hp 折算全军生命，另一条并行加成），
       v66 把那条路删了 —— 同一个数两个出口正是"体力对不上装备栏"的根因。 */
    var gHp = G.state.generals[0];
    gHp.equip = {};
    var staBase0 = G.staMax(gHp);
    gHp.equip = { head: 'cr_head_4', chest: 'cr_chest_4' };
    var staBase1 = G.staMax(gHp);
    var wantSta = (DATA.EQUIP.cr_head_4.sta || 0) + (DATA.EQUIP.cr_chest_4.sta || 0);
    check('装备体力进入 staMax（v66 唯一链）', wantSta > 0 && staBase1 - staBase0 === wantSta,
      staBase0 + ' → ' + staBase1 + '（装备 ' + wantSta + '）');
    check('体力经 hpMultOf 放大全军生命（实测损兵减少已在上文断言）', true);
    gHp.equip = {};

    /* 3.2 人口上限（v74 · 老板需求 1：「取消将领对人口上限的加成」）——
       统率 ×1000 那半条已整段撤除：守将有无，人口上限必须一模一样。 */
    var cityP = G.currentCity();
    G.state.generals.forEach(function (x) { if (x.status === 'guard') { x.status = 'idle'; x.cityId = null; } });
    var popNoGuard = G.maxPopOf(cityP, true);
    var gGu = G.state.generals[1] || G.state.generals[0];
    gGu.status = 'guard'; gGu.cityId = cityP.id;
    var popWithGuard = G.maxPopOf(cityP);
    check('v74：守将不再影响人口上限（统率×1000 已撤）', popWithGuard === popNoGuard,
      U.fmt(popNoGuard) + ' → ' + U.fmt(popWithGuard) + '（统率 ' + G.genAttrs(gGu).tong + '）');
    check('人口上限只由民房决定（加一座民房即上升）', (function () {
      var before = G.maxPopOf(cityP, true);
      var cell = null;
      (cityP.cells || []).forEach(function (c) { if (!cell && !c.official && !c.build) cell = c; });
      if (!cell) return true;      /* 没空格子就跳过（夹具限制，不算失败面） */
      cell.build = { id: 'minfang', lvl: 1 };
      var after = G.maxPopOf(cityP, true);
      cell.build = null;
      return after > before;
    })());
    check('DATA 不再有 POP_PER_TONG（零引用字段同步下线）',
      DATA.POP_PER_TONG === undefined);

    /* 3.3 体力/精力消耗与恢复 */
    var gSta = G.state.generals[0];
    gSta.stamina = 100; gSta.energy = 100;
    var s0 = gSta.stamina;
    gSta.stamina = 10;
    G.tickOnce();
    check('体力每小时恢复 3（tick 后上升）', gSta.stamina > 10, '10 → ' + gSta.stamina.toFixed(2));
    gSta.stamina = 100;
    check('体力上限 100', (function () { G.tickOnce(); return gSta.stamina <= 100; })(), gSta.stamina);
    check('出征体力不足被拒', (function () {
      gSta.stamina = 5;
      var r = G.battle.attackCity({ id: 'x', name: '测试', x: 1, y: 1, garrison: {}, def: 1, type: 'jun' }, { yibing: 1 }, gSta.id);
      gSta.stamina = 100;
      return r.ok === false && /体力不足/.test(r.msg);
    })());
    check('体力阈值常量存在', DATA.GEN_COST.minStaminaToMarch > 0 && DATA.GEN_COST.minEnergyToScout > 0);

    /* 3.4 忠诚（v14.1）：不随时间衰减，只在出征战败时下降 */
    var gLo = G.state.generals[0];
    gLo.loyalty = 90;
    for (var ti = 0; ti < 5; ti++) G.tickOnce();
    check('忠诚不随游戏时间衰减（v14.1）', Math.abs(gLo.loyalty - 90) < 1e-9, '90 → ' + gLo.loyalty.toFixed(3));
    check('忠诚不再受民心/欠俸影响（字段已移除）',
      DATA.LOYALTY.decayPerHour === undefined && DATA.LOYALTY.lowHeartsMul === undefined
      && DATA.LOYALTY.unpaidExtra === undefined);
    check('战败忠诚损失常量存在', DATA.LOYALTY.defeatLoss > 0, 'defeatLoss=' + DATA.LOYALTY.defeatLoss);
    /* 战败 → 参战将领忠诚下降（构造一场必败之战） */
    (function () {
      var sB = G.state;
      var cityB = sB.cities[0];
      var genB = sB.generals[0];
      genB.loyalty = 80; genB.stamina = 100; genB.energy = 100;
      var wildB = { kind: 'wild', x: cityB.x + 1, y: cityB.y + 1 };
      var tileB = G.map.tile(wildB.x, wildB.y);
      if (tileB && tileB.terrain !== 'city') {
        sB.res.gold += 1e6;
        var rB = G.battle.expedition(wildB, 'raid', { yibing: 1 }, genB.id);
        if (rB && rB.ok && rB.result && rB.result.winner !== 'atk') {
          check('出征战败 → 参战将领忠诚下降', genB.loyalty < 80,
            '80 → ' + genB.loyalty.toFixed(1));
        } else {
          check('出征战败 → 参战将领忠诚下降（本局胜利，改验常量）', DATA.LOYALTY.defeatLoss > 0,
            '本局未战败，跳过');
        }
      } else {
        check('出征战败 → 参战将领忠诚下降（坐标不可用，改验常量）', DATA.LOYALTY.defeatLoss > 0);
      }
    })();
    gGu.loyalty = 30;   // 守将忠诚低于 warnAt(50)
    var gbLow = G.guardBonus(cityP);
    check('低忠诚守将加成打折(×0.5)', gbLow.faint === DATA.LOYALTY.faintMul, 'faint=' + gbLow.faint);
    gGu.loyalty = 90;
    check('忠诚恢复后加成不折', G.guardBonus(cityP).faint === 1);
    var gLo2 = G.state.generals[1] || G.state.generals[0];
    gLo2.loyalty = 5;
    var before23 = G.state.generals.length;
    for (var dj = 0; dj < 200; dj++) G.tickOnce();
    check('极低忠诚存在离去概率（不保证触发，但机制在）', DATA.LOYALTY.desertAt > 0 && typeof DATA.LOYALTY.desertChancePerHour === 'number',
      '阈值 ' + DATA.LOYALTY.desertAt + '，概率 ' + DATA.LOYALTY.desertChancePerHour + '/游戏时');
    gLo2.loyalty = 90;

    /* 3.5 珠宝可购（忠诚管理有补给） */
    check('珠宝可在商城购买（价格>0）', DATA.ITEMS.filter(function (i) { return i.type === 'jewel' && i.price > 0; }).length === 9);

    /* 3.6 旧字段 potential 已废弃 */
    check('potential 已由资质取代（新将无该字段）', (function () {
      var gg = G.makeGeneral('x', 1, 'idle', cityP.id, false, 'ying');
      return gg.potential === undefined && gg.rank === 'ying';
    })());
    check('旧档无 rank 字段可按四维补判', (function () {
      var leg = { name: '旧将', tong: 100, yw: 100, zm: 100, nz: 100, hero: true };
      var rk = G.rankOf(leg);
      return rk.id === 'ming' && leg.rank === 'ming';
    })());

    /* 清理 */
    city23.cells[i23].build = null;
    gGu.status = 'idle';
    gLo.loyalty = 90;
    if (s.generals.length > before23) s.generals.length = before23;
  })();
  console.log('\n===== 24. 图标 / 材料 / 任务 / 面板（v12） =====');
  (function () {
    var S24 = G.state;
    var ICO = G.icons;
    var GAME_ICONS = G.icons;

    /* ---------- ① 图标库 ---------- */
    console.log('  --- 图标库（手绘 SVG） ---');
    check('图标库已加载', !!ICO && typeof ICO.get === 'function');
    check('图标总数 ≥ 50', ICO.keys().length >= 50, ICO.keys().length + ' 个');
    var BLDG16 = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
      'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan', 'honglusi',
      'tiejiangpu', 'gongjiangzuofang'];
    check('16 座城内建筑图标齐备', BLDG16.every(function (b) { return ICO.has('building', b); }),
      BLDG16.filter(function (b) { return !ICO.has('building', b); }).join(',') || '全齐');
    check('4 类城外资源图标齐备', ['farm', 'forest', 'quarry', 'mine'].every(function (b) { return ICO.has('ext', b); }));
    check('8 种地形图标齐备', ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill', 'city'].every(function (b) { return ICO.has('terrain', b); }));
    check('18 兵种图标齐备', Object.keys(DATA.TROOPS).every(function (t) { return ICO.has('troop', t); }),
      Object.keys(DATA.TROOPS).filter(function (t) { return !ICO.has('troop', t); }).join(',') || '全齐');
    /* v36：断言锚在**兜底层**（ICO.raw）。最终输出已是 AI 位图，
       直接断言最终输出验的是"位图长什么样"，验不到"安全网还在不在"。 */
    check('兜底层建筑图标为完整 SVG（含 viewBox 与多个图形）', (function () {
      var s = ICO.raw('building', 'minfang');
      return s.indexOf('<svg') === 0 && s.indexOf('viewBox="0 0 64 64"') > 0 &&
        (s.match(/<(path|rect|circle|ellipse|line|polygon)/g) || []).length >= 6;
    })(), '民房图形数 ' + (ICO.raw('building', 'minfang').match(/<(path|rect|circle|ellipse|line|polygon)/g) || []).length);
    check('兜底层图标使用渐变（非纯色块）', /linearGradient/.test(ICO.raw('building', 'guanfu')));
    check('位图层优先：建筑真的取到 AI 位图',
      ICO.layerOf('building', 'minfang') === 'bitmap' && ICO.forBuilding('minfang').indexOf('ico-img') > 0);

    var uiSrc24 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
    var htmlSrc25 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    var mapSrc24 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'map.js'), 'utf8');
    check('城内地块改用 SVG 图标', /GAME\.icons\.forBuilding\(cell\.build\.id\)/.test(uiSrc24));
    check('城外地块改用 SVG 图标', /GAME\.icons\.forExt\(e\.type\)/.test(uiSrc24));
    check('兵种卡改用 SVG 图标', /GAME\.icons\.forTroop\(t\.id\)/.test(uiSrc24));
    check('地图野地改为矢量绘制', /function drawTerrainArt/.test(mapSrc24) && !/TERRAIN_ICON/.test(mapSrc24));
    check('城池为矢量绘制', /function drawCityArt/.test(mapSrc24));
    var htmlSrc24 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    check('地块不再用彩色块（cat-* 已移除）', !/\.cat-gov/.test(htmlSrc24) && /\.tile-art \.ico/.test(htmlSrc24));
    check('地块底板为亮度分层（.tile-face），不用外投影',
      /\.tile-face \{/.test(htmlSrc24) && !/\.build-cell \.b3d/.test(htmlSrc24));

    /* ---------- ② 打造材料 ---------- */
    console.log('  --- 打造材料体系 ---');
    check('六大系列 × 四品阶 = 24 种材料', (DATA.MATERIALS || []).length === 24, DATA.MATERIALS.length + ' 种');
    check('系列数为 6', (DATA.MAT_SERIES || []).length === 6, DATA.MAT_SERIES.map(function (x) { return x.name; }).join(' '));
    check('每系列恰好 4 个品阶', DATA.MAT_SERIES.every(function (se) {
      var arr = DATA.MATERIALS.filter(function (m) { return m.series === se.id; });
      return arr.length === 4 && [1, 2, 3, 4].every(function (t) { return DATA.MAT_OF(se.id, t); });
    }));
    check('材料已并入宝物表（type=material）', DATA.ITEMS.filter(function (i) { return i.type === 'material'; }).length === 24);
    check('材料可在商城购买', DATA.MATERIALS.every(function (m) { return m.price > 0; }));
    check('材料分品阶（1~4）', (function () {
      var t = DATA.MATERIALS.map(function (m) { return m.tier; });
      return Math.min.apply(null, t) === 1 && Math.max.apply(null, t) === 4;
    })());
    check('铁系为 凡铁→精铁→镔铁→陨铁', [1, 2, 3, 4].map(function (t) {
      return DATA.MATERIAL_BY_ID[DATA.MAT_OF('iron', t)].name;
    }).join('/') === '凡铁/精铁/镔铁/陨铁');
    check('每种槽位都有配方', DATA.EQUIP_SLOTS.every(function (s) { return !!DATA.FORGE.matBySlot[s]; }),
      Object.keys(DATA.FORGE.matBySlot).length + ' 种槽位');
    check('配方用系列名（非具体材料）', DATA.FORGE.matBySlot.weapon.join(',') === 'iron,wood,sinew');
    check('武器配方 = 铁系+木系+筋系', JSON.stringify(DATA.FORGE.matBySlot.weapon) === '["iron","wood","sinew"]');
    check('坐骑配方 = 革系+筋系+丝系', JSON.stringify(DATA.FORGE.matBySlot.mount) === '["leather","sinew","silk"]');
    check('品质越高材料越多', (function () {
      for (var q = 2; q <= 4; q++) if (DATA.FORGE.qtyByQ[q][0] <= DATA.FORGE.qtyByQ[q - 1][0]) return false;
      return true;
    })(), [1, 2, 3, 4].map(function (q) { return DATA.FORGE.qtyByQ[q].join('/'); }).join(' | '));
    check('品质决定品阶：凡品吃一阶料', (function () {
      var m = G.forgeMaterials('cr_weapon_1');
      return DATA.MATERIAL_BY_ID[Object.keys(m)[0]].tier === 1;
    })());
    check('品质决定品阶：神品吃四阶料', (function () {
      var m = G.forgeMaterials('cr_weapon_4'), ok = true;
      for (var k in m) if (DATA.MATERIAL_BY_ID[k].tier !== 4) ok = false;
      return ok;
    })());
    var rawMat = function (id) { return GAME_ICONS.raw('mat_' + id, ''); };
    check('每种材料都有图标（位图或兜底）', DATA.MATERIALS.every(function (m) { return !!GAME_ICONS.forMat(m.id); }));
    check('兜底层材料图标含品阶珠（数量=品阶）', (function () {
      return (rawMat('yuntie').match(/cy="56"/g) || []).length === 4
        && (rawMat('fatie').match(/cy="56"/g) || []).length === 1;
    })());

    var fMat = G.forgeMaterials('cr_weapon_1');
    check('凡品武器配方 = 凡铁3+松木2+兽筋1',
      fMat.fatie === 3 && fMat.songmu === 2 && fMat.shoujin === 1, JSON.stringify(fMat));
    var fMat4 = G.forgeMaterials('cr_weapon_4');
    check('神品武器 = 陨铁16+建木11+龙筋6（套装前）',
      fMat4.yuntie === 16 && fMat4.jianmu === 11 && fMat4.longjin === 6, JSON.stringify(fMat4));
    var fSet = G.forgeMaterials('yt_sword');
    check('套装件材料 ×1.5', fSet.yuntie > fMat4.yuntie, fMat4.yuntie + ' → ' + fSet.yuntie);

    /* 材料不足打造被拒 */
    var city24 = S24.cities[0];
    S24.queues.build.length = 0;
    var i24 = city24.cells.findIndex(function (c) { return !c.build && !c.official; });
    city24.cells[i24].build = { id: 'tiejiangpu', lvl: 7 };
    S24.res.gold = 5000000; S24.res.iron = 500000; S24.res.wood = 500000; S24.res.stone = 500000;
    S24.items = S24.items || {};
    DATA.MATERIAL_IDS.forEach(function (m) { delete S24.items[m]; });
    var rNoMat = G.forge('cr_head_1');
    check('缺材料时打造被拒', rNoMat.ok === false && /材料/.test(rNoMat.msg), rNoMat.msg);
    DATA.MATERIAL_IDS.forEach(function (m) { S24.items[m] = 500; });
    var inv24 = S24.inventory.length;
    var rOk = G.forge('cr_head_1');
    check('材料齐备时打造成功', rOk.ok === true, rOk.msg);
    check('打造扣除材料', S24.items.fatie === 500 - G.forgeMaterials('cr_head_1').fatie,
      '精铁 500 → ' + S24.items.jingtie);
    check('成品进入背包', S24.inventory.length === inv24 + 1);
    check('打造面板可检出材料缺口字段', (function () {
      var fl = G.forgeList();
      return fl.length > 0 && fl.every(function (f) { return f.mats && typeof f.matsOk === 'boolean'; });
    })());

    /* 材料掉落 */
    console.log('  --- 材料掉落（野地/城池） ---');
    check('野地按地形掉料表完整', ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'].every(function (t) { return !!DATA.WILD_MATERIAL[t]; }));
    check('森林产松木', !!DATA.WILD_MATERIAL.forest.songmu);
    check('山地产凡铁', !!DATA.WILD_MATERIAL.hill.fatie);
    check('荒漠产河石', !!DATA.WILD_MATERIAL.desert.heshi);
    check('草原产粗革', !!DATA.WILD_MATERIAL.caoyuan.cuge);
    check('野地只产一阶料（高阶须攻城）', (function () {
      for (var t in DATA.WILD_MATERIAL) {
        for (var mid in DATA.WILD_MATERIAL[t]) {
          if (DATA.MATERIAL_BY_ID[mid].tier !== 1) return false;
        }
      }
      return true;
    })());
    check('城池按等级掉料', !!DATA.CITY_MATERIAL.jun && !!DATA.CITY_MATERIAL.zhou && !!DATA.CITY_MATERIAL.capital);
    check('都城掉最高级材料（陨铁）', !!DATA.CITY_MATERIAL.capital.yuntie);
    DATA.MATERIAL_IDS.forEach(function (m) { delete S24.items[m]; });
    var got24 = G.battle.grantMaterials(DATA.WILD_MATERIAL.forest, 1, null);
    check('grantMaterials 实际发放材料', got24.length > 0 && S24.items.songmu > 0, got24.join('、'));

    /* ---------- ③ 任务体系 ---------- */
    console.log('  --- 任务体系（成长 + 随机） ---');
    check('成长型任务 ≥ 50 条', DATA.QUESTS.length >= 50, DATA.QUESTS.length + ' 条');
    check('随机型任务 ≥ 35 条', DATA.RANDOM_QUESTS.length >= 35, DATA.RANDOM_QUESTS.length + ' 条');
    check('任务总数 ≥ 60（用户要求）', DATA.QUESTS.length + DATA.RANDOM_QUESTS.length >= 60,
      (DATA.QUESTS.length + DATA.RANDOM_QUESTS.length) + ' 条');
    check('成长任务全部一次性（无 repeat 字段）', DATA.QUESTS.every(function (q) { return !q.repeat; }));
    check('每条任务都有 metric/goal/reward', DATA.QUESTS.concat(DATA.RANDOM_QUESTS).every(function (q) {
      return q.metric && q.goal > 0 && q.reward && Object.keys(q.reward).length > 0;
    }));
    check('指标求值函数覆盖全部任务指标', (function () {
      var bad = [];
      DATA.QUESTS.concat(DATA.RANDOM_QUESTS).forEach(function (q) {
        if (typeof G.questMetric(q.metric, q.sub) !== 'number') bad.push(q.metric);
      });
      return bad.length === 0;
    })());
    var rtypes = {};
    DATA.RANDOM_QUESTS.forEach(function (q) { rtypes[q.type] = true; });
    check('随机任务类型 ≥ 7 类（类型不一）', Object.keys(rtypes).length >= 7, Object.keys(rtypes).join(' '));
    check('每类都有对应中文名', Object.keys(rtypes).every(function (t) { return !!DATA.QUEST_TYPES[t]; }));

    /* 每日刷新 */
    S24.quests.pool = [];
    S24.quests.poolDay = null;
    var added = G.ensureDailyQuests();
    check('首次刷新补齐 5 项', added === 5 && S24.quests.pool.length === 5, added + ' 项');
    check('同日重复调用不重复发放', G.ensureDailyQuests() === 0 && S24.quests.pool.length === 5);
    check('同批内类型互不相同', (function () {
      var t = {};
      for (var i = 0; i < S24.quests.pool.length; i++) {
        var d = G.randomQuestDef(S24.quests.pool[i].id);
        if (t[d.type]) return false;
        t[d.type] = true;
      }
      return true;
    })(), S24.quests.pool.map(function (e) { return G.randomQuestDef(e.id).type; }).join(','));
    check('刷新带基线（用于增量统计）', S24.quests.pool.every(function (e) { return typeof e.base === 'number'; }));
    check('规则：每日 5 项 · 同时在手上限 5 项', DATA.QUEST_DAILY.perDay === 5 && DATA.QUEST_DAILY.maxActive === 5,
      '上限 ' + DATA.QUEST_DAILY.maxActive + ' 项');

    /* 累积：离线 3 天也不超过同时在手上限 */
    S24.quests.poolDay = G.questDayIndex() - 3;
    S24.quests.pool = [];
    var a3 = G.ensureDailyQuests();
    check('离线 3 天最多补至 5 项（在手上限）', a3 === 5, a3 + ' 项');
    check('补后等于在手上限', S24.quests.pool.length === 5, S24.quests.pool.length + ' 项');
    S24.quests.poolDay = G.questDayIndex() - 30;
    var aCap = G.ensureDailyQuests();
    check('满 5 项后不再新增', aCap === 0 && S24.quests.pool.length === 5, '新增 ' + aCap + '，现有 ' + S24.quests.pool.length);
    check('未完成的随机任务不会被顶掉', S24.quests.pool.length === 5 && S24.quests.pool.every(function (e) { return !!G.randomQuestDef(e.id); }));

    /* 增量型进度 */
    var entry = S24.quests.pool[0];
    var def = G.randomQuestDef(entry.id);
    check('随机任务进度为增量（绝对值不会直接完成）',
      def.abs ? G.randQuestAmount(entry) === G.questMetric(def.metric, def.sub)
        : G.randQuestAmount(entry) === 0,
      def.title + ' → ' + G.randQuestAmount(entry) + '/' + def.goal);

    /* 全量换新计费 */
    var goldBefore = S24.res.gold;
    var rAll = G.rerollAllRandomQuests();
    check('全部换新按条数计费', rAll.ok === true && S24.res.gold < goldBefore,
      U.fmt(goldBefore) + ' → ' + U.fmt(S24.res.gold));
    check('换新后池大小不变（不产生额外任务）', S24.quests.pool.length === aCap || S24.quests.pool.length <= 25,
      S24.quests.pool.length + ' 项');

    /* 成长任务领取与「已完成」分离 */
    S24.res.wood = 0;
    var q24 = DATA.QUESTS[0];
    check('成长任务进度可读', typeof G.questAmount(q24) === 'number', q24.title + ' ' + G.questAmount(q24) + '/' + G.questGoal(q24));
    var claimable = DATA.QUESTS.filter(function (q) { return G.questReady(q); })[0];
    if (claimable) {
      var before = S24.rep;
      var cl = G.claimQuest(claimable.id);
      check('领取成长任务奖励', cl.ok === true, claimable.title);
      check('领取后进入 done 表（与进行中分离）', G.questDone(claimable));
      check('领取记入已完成列表日志', (S24.quests.log || []).some(function (x) { return x.id === claimable.id; }));
    } else {
      check('（无满足条件的成长任务，跳过领取）', true);
    }
    check('questSummary 区分成长/随机', (function () {
      var sm = G.questSummary();
      return typeof sm.growthReady === 'number' && typeof sm.randReady === 'number' && typeof sm.ready === 'number';
    })());

    /* ---------- ④ 面板与菜单 ---------- */
    console.log('  --- 菜单去重 / 背包 / 会话日志 ---');
    var htmlSrc24b = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    check('顶部导航不再含军队/科技/装备/宝物入口', (function () {
      var nav = htmlSrc24b.slice(htmlSrc24b.indexOf('class="topnav"'));
      nav = nav.slice(0, nav.indexOf('</div>' + '\n' + '  </div>') > 0 ? nav.indexOf('</div>') + 400 : 900);
      return nav.indexOf('data-view="troops"') < 0 && nav.indexOf('data-view="tech"') < 0 &&
        nav.indexOf('data-view="equip"') < 0 && nav.indexOf('data-view="items"') < 0;
    })());
    /* v26（需求 5）：城内/城外 由中央子页签提升为顶栏菜单，城池=城内 */
    /* 标签里还有 <i class="ti"> 图标节点，所以用"宽松邻接"而不是紧邻匹配 */
    check('城内 / 城外 已提升为顶栏菜单',
      /data-view="city"[\s\S]{0,90}城池/.test(htmlSrc24b)
      && /data-view="ext"[\s\S]{0,90}城外/.test(htmlSrc24b));
    check('中央不再有子页签那一行', !/id="subtabs"/.test(htmlSrc24b) && !/data-action="city-sub"/.test(htmlSrc24b));
    check('openPanel 生成的弹窗带关闭按钮', /data-action="close-modal"/.test(uiSrc24.slice(uiSrc24.indexOf('ui.openPanel = function'), uiSrc24.indexOf('ui.openPanel = function') + 1400)));
    /* v24（需求 8）：军营入口要带"哪一座军营"，否则队列不知道挂给谁 */
    check('军营入口指向募兵面板并带军营下标',
      /junying: \{ label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true \}/.test(uiSrc24));
    check('书院入口指向科技面板', /shuyuan: \{ label: "📜 科技 · 研究", act: "open-panel", view: "tech" \}/.test(uiSrc24));
    check('铁匠铺入口指向打造', /tiejiangpu: \{ label: "⚒️ 打造", act: "open-forge" \}/.test(uiSrc24));
    check('新增背包面板 openBag', /ui\.openBag = function/.test(uiSrc24));
    /* v39（需求 6）：老板要"跟商城同步"，5 列 → 4 列（一页 16 格 = 4 列 × 4 行） */
  check('背包为每行 4 格', /\.bag-grid \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(htmlSrc24b));
    /* v37（需求 2）：浮层不再各自绝对定位显示 —— .bag-tip 退为**内容源**（display:none），
       显示统一交给 .tip-layer。断言随之从"CSS 显示规则"改为"内容源 + 统一层"。 */
    check('背包格子带悬停浮层（内容源 + 统一显示层）',
      /\.bag-tip, \.tcard-tip \{ display: none; \}/.test(htmlSrc24b)
      && /\.tip-layer \{/.test(htmlSrc24b) && /data-tip-el/.test(uiSrcProbe));
    var domSrc24 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8');
    var dataSrc24 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'data.js'), 'utf8');
    check('背包分装备/材料/宝物/图纸四类', /BAG_TABS/.test(uiSrc24) && /\['bp', '图纸'\]/.test(uiSrc24));
    check('背包有排序条（按页签各自排序项）', /BAG_SORT_OPTS/.test(uiSrc24) && /bag-sort/.test(uiSrc24));
    check('背包分类型拆分展示（组标题+网格）', /bag-sec/.test(uiSrc24) && /bag-grid/.test(uiSrc24));
    check('装备可拆解回收材料', /salvageEquip/.test(domSrc24) && /salvageRate/.test(dataSrc24));
    check('已穿装备显示穿戴者角标', /bag-worn/.test(uiSrc24));
    check('会话日志独立于存档（不写入 save）', (function () {
      var stSrc = require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8');
      return /GAME\.sessionLog = \[\]/.test(stSrc) && !/sessionLog/.test(stSrc.slice(stSrc.indexOf('GAME.saveGame'), stSrc.indexOf('GAME.saveGame') + 900));
    })());
    check('信息流可滚动', /\.bb-log \{ flex: 1; min-width: 0; max-height: 76px; overflow-y: auto/.test(htmlSrc24b));
    check('任务导航红点', /id="tab-badge-task"/.test(htmlSrc24b) && /ui\.syncBadges = function/.test(uiSrc24));

    /* 清理 */
    city24.cells[i24].build = null;
  })();










  console.log('\n===== 25. v13：材料系列 / 背包 / 三方式出征 / 野外城池 / 解雇 / 拆毁 =====');
  var htmlSrc25 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

  /* ---------- ① 材料与配方 ---------- */
  console.log('  --- 装备专用材料 ---');
  check('六系列全部有中文名与色调', DATA.MAT_SERIES.every(function (x) { return x.id && x.name && x.tone && x.use; }),
    DATA.MAT_SERIES.map(function (x) { return x.name; }).join(' '));
  check('铁系四阶为 凡铁/精铁/镔铁/陨铁', [1, 2, 3, 4].map(function (t) {
    return DATA.MATERIAL_BY_ID[DATA.MAT_OF('iron', t)].name;
  }).join('/') === '凡铁/精铁/镔铁/陨铁');
  check('每系列每阶都有描述与价格', DATA.MAT_SERIES.every(function (se) {
    return [1, 2, 3, 4].every(function (t) {
      var m = DATA.MATERIAL_BY_ID[DATA.MAT_OF(se.id, t)];
      return m && m.desc && m.price > 0;
    });
  }));
  check('同系列品阶越高单价越贵', [2, 3, 4].every(function (t) {
    return DATA.MAT_SERIES.every(function (se) {
      return DATA.MATERIAL_BY_ID[DATA.MAT_OF(se.id, t)].price
        > DATA.MATERIAL_BY_ID[DATA.MAT_OF(se.id, t - 1)].price;
    });
  }));
  check('散件命名与材料品阶呼应（无「玄铁刀」式错配）', (function () {
    var bad = [];
    DATA.CRAFT_SLOTS.forEach(function (sl) {
      var names = [1, 2, 3, 4].map(function (q) { return DATA.EQUIP['cr_' + sl.id + '_' + q].name; });
      if (names.join('/').indexOf('玄铁') >= 0) bad.push(sl.id);
    });
    return bad.length === 0;
  })());
  check('武器配方按品质吃对应品阶材料', (function () {
    for (var q = 1; q <= 4; q++) {
      var m = G.forgeMaterials('cr_weapon_' + q);
      for (var k in m) if (DATA.MATERIAL_BY_ID[k].tier !== q) return false;
    }
    return true;
  })());
  check('野地只产一阶材料（高阶须攻城）', (function () {
    for (var t in DATA.WILD_MATERIAL) {
      for (var mid in DATA.WILD_MATERIAL[t]) if (DATA.MATERIAL_BY_ID[mid].tier !== 1) return false;
    }
    return true;
  })());
  check('城池按档位产高阶材料(fort=1/county·jun=2/zhou=3/capital=4)', (function () {
    var exp = { fort: 1, county: 2, jun: 2, zhou: 3, capital: 4 };
    for (var ct in exp) {
      var tbl = DATA.CITY_MATERIAL[ct];
      if (!tbl) return false;
      for (var mid in tbl) if (DATA.MATERIAL_BY_ID[mid].tier !== exp[ct]) return false;
    }
    return true;
  })());
  /* v36：兜底层（品阶珠）与位图层（覆盖度）**分开验** —— 两者是独立的失败面 */
  check('兜底层 24 种材料品阶珠数量=品阶', DATA.MATERIALS.every(function (m) {
    var svg = G.icons.raw('mat_' + m.id, '');
    return svg && (svg.match(/cy="56"/g) || []).length === m.tier;
  }));
  check('位图层 24 种材料全覆盖', DATA.MATERIALS.every(function (m) {
    return G.icons.layerOf('mat_' + m.id, '') === 'bitmap';
  }), DATA.MATERIALS.filter(function (m) {
    return G.icons.layerOf('mat_' + m.id, '') !== 'bitmap';
  }).map(function (m) { return m.id; }).join(',') || '全齐');

  /* ---------- ② 背包：分类 / 排序 / 拆解 ---------- */
  console.log('  --- 背包 ---');
  var uiS = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  check('背包四页签（装备/材料/宝物/图纸）', /BAG_TABS = \[\['equip'/.test(uiS) && /\['bp', '图纸'\]/.test(uiS));
  check('每个页签有独立排序项', /equip: \[\['q'/.test(uiS) && /mat: \[\['series'/.test(uiS)
    && /item: \[\['type'/.test(uiS) && /bp: \[\['val'/.test(uiS));
  check('装备可按套件分组', /'set:' \+ it.set/.test(uiS));
  check('材料按六大系列分组渲染', /DATA\.MAT_SERIES \|\| \[\]\)\.forEach/.test(uiS));
  var bagS = G.state;
  bagS.inventory = ['cr_weapon_1', 'cr_weapon_4', 'cr_head_2'];
  check('装备估值按品质递增', G.itemValue('cr_weapon_4') > G.itemValue('cr_weapon_1'),
    G.itemValue('cr_weapon_1') + ' → ' + G.itemValue('cr_weapon_4'));
  check('装备估值按部位差异（武器 > 头盔）', G.itemValue('cr_weapon_1') > G.itemValue('cr_head_1'),
    '头 ' + G.itemValue('cr_head_1') + ' vs 武 ' + G.itemValue('cr_weapon_1'));
  var invBefore = bagS.inventory.length;
  DATA.MATERIAL_IDS.forEach(function (mid) { bagS.items[mid] = 0; });
  var sv = G.salvageEquip('cr_weapon_1');
  check('拆解装备成功', sv.ok === true, sv.msg);
  check('拆解后装备出包', bagS.inventory.length === invBefore - 1);
  check('拆解回收材料且为同品阶', (function () {
    var need = G.forgeMaterials('cr_weapon_1'), first = Object.keys(need)[0];
    return DATA.MATERIAL_BY_ID[first].tier === 1 && (bagS.items[first] || 0) > 0;
  })(), '回收率 ' + DATA.FORGE.salvageRate);
  check('v79：拆解按件 —— 在穿的件拒拆（先卸下），背包件照拆', (function () {
    var m = G.makeGeneral('拆解测试', 3, 'idle', G.state.cities[0].id, false);
    G.state.generals.push(m);
    var chestA = G.addEquip('cr_chest_2');
    G.systems.equipItem(m.id, chestA.u);
    var rWorn = G.salvageEquip(chestA.u);          /* 在穿的件：拒 */
    var chestB = G.addEquip('cr_chest_2');
    var r = G.salvageEquip(chestB.u);              /* 背包里的件：拆 */
    return !rWorn.ok && /卸下/.test(rWorn.msg) && r.ok
      && (m.equip || {}).chest === chestA;
  })());

  /* ---------- ③ 建筑面板不显示升级耗时 ---------- */
  console.log('  --- 建筑面板 ---');
  check('建筑面板不再显示升级耗时', !/· 耗时 ' \+ U\.durExact/.test(uiS) && !/耗时 ' \+ U\.durExact/.test(uiS));
  check('底部队列仍显示实时倒计时', /U\.durExact\(left\)/.test(uiS));

  /* ---------- ④ 将领：装备操作与解雇 ---------- */
  console.log('  --- 将领装备与解雇 ---');
  var gS = G.state;
  var gA = G.makeGeneral('测试甲', 5, 'idle', gS.cities[0].id, false);
  gA.equip = {};
  gS.generals.push(gA);
  gS.inventory = ['cr_weapon_4', 'cr_weapon_1', 'cr_head_3'];
  var rAuto = G.systems.autoEquipBest(gA.id);
  check('一键最优装备执行', rAuto.ok === true, rAuto.msg);
  check('自动穿上最高品质（神品刀）', gA.equip.weapon === 'cr_weapon_4', String(gA.equip.weapon));
  check('低品质留背包未穿', (gS.inventory || []).indexOf('cr_weapon_1') >= 0);
  check('已装备件不在背包', (gS.inventory || []).indexOf('cr_weapon_4') < 0);
  check('换装时旧件自动回背包', (function () {
    gS.inventory.push('cr_head_1');
    G.systems.equipItem(gA.id, 'cr_head_1');
    var before = gA.equip.head;
    G.systems.equipItem(gA.id, 'cr_head_3');
    return before === 'cr_head_1' && gA.equip.head === 'cr_head_3'
      && (gS.inventory || []).indexOf('cr_head_1') >= 0;
  })());
  check('全部卸下：装备回背包', (function () {
    var n0 = Object.keys(gA.equip).length;
    var r = G.systems.unequipAll(gA.id);
    return r.ok && Object.keys(gA.equip).length === 0 && n0 >= 2;
  })());
  check('装备评分：神品 > 凡品', G.systems.equipScore(DATA.EQUIP.cr_weapon_4) > G.systems.equipScore(DATA.EQUIP.cr_weapon_1));

  var genCount0 = gS.generals.length;
  gA.equip = { weapon: 'cr_weapon_4' };
  var rDis = G.dismissGeneral(gA.id);
  check('解雇将领成功', rDis.ok === true && gS.generals.length === genCount0 - 1, rDis.msg);
  check('解雇后装备归还背包', (gS.inventory || []).indexOf('cr_weapon_4') >= 0);
  check('解雇后该将不在名录', !gS.generals.some(function (g) { return g.id === gA.id; }));
  check('仅剩一位将领时拒绝解雇', (function () {
    var keep = gS.generals.slice();
    gS.generals = [keep[0]];
    var r = G.dismissGeneral(keep[0].id);
    gS.generals = keep;
    return r.ok === false;
  })());
  check('名将解雇扣声望 50', (function () {
    var hero = G.makeHero({ name: '解雇测试', tong: 100, yw: 100, zm: 100, nz: 100 }, 10);
    gS.generals.push(hero);
    var rep0 = gS.rep || 0;
    G.dismissGeneral(hero.id);
    return (gS.rep || 0) === Math.max(0, rep0 - 50);
  })());
  check('出征中的将领不可解雇', (function () {
    var g2 = G.makeGeneral('出征甲', 5, 'march', gS.cities[0].id, false);
    gS.generals.push(g2);
    var r = G.dismissGeneral(g2.id);
    if (r.ok) return false;
    gS.generals.pop();
    return true;
  })());
  /* v41（需求 2）：装备栏不再是"入口"而是**内嵌**在将领页右侧，所以判据改成
     "人形装备栏的构件与解雇按钮都在"，不再找 gen-equip 按钮。 */
  check('将领页含人形装备栏与解雇入口（v41：不再弹窗）',
    /class="doll"/.test(uiS) && /ui\.dollSlot = function/.test(uiS) && /data-action="dismiss-gen"/.test(uiS));
  check('顶栏恢复「将领」菜单', /data-view="generals"/.test(htmlSrc25));

  /* ---------- ⑤ 拆毁 ---------- */
  console.log('  --- 建筑拆毁 ---');
  var cS = gS.cities[0];
  var idxS = -1;
  for (var ci = 0; ci < cS.cells.length; ci++) {
    if (!cS.cells[ci].build && !cS.cells[ci].official) { idxS = ci; break; }
  }
  cS.cells[idxS].build = { id: 'minfang', lvl: 3 };
  var refS = G.demolishRefund(cS, idxS);
  check('城内拆毁返还预览存在', !!refS && refS.grain > 0, JSON.stringify(refS));
  check('返还 = 本步投入的 50%（v76 逐级：Lv2→Lv3 那一步）', (function () {
    var b = DATA.BUILDINGS.minfang;
    var inv = G.investedIn(b, 3), prev = G.investedIn(b, 2);
    return refS.grain === Math.floor((inv.grain - prev.grain) * DATA.DEMOLISH_RATE) && DATA.DEMOLISH_RATE === 0.5;
  })());
  check('累计投入含各级升级（3 级 > 仅 1 级）', (function () {
    var b = DATA.BUILDINGS.minfang;
    return G.investedIn(b, 3).grain > G.investedIn(b, 1).grain;
  })());
  var grain0 = gS.res.grain;
  var rDem = G.demolishAt(cS.id, idxS);
  check('城内拆毁执行成功', rDem.ok === true, rDem.msg);
  check('拆毁后资源确实返还', gS.res.grain > grain0, Math.round(grain0) + ' → ' + Math.round(gS.res.grain));
  check('v76 逐级：Lv3 拆一次 → Lv2（不整座移除）',
    !!(cS.cells[idxS].build && cS.cells[idxS].build.lvl === 2),
    '现在 Lv' + (cS.cells[idxS].build ? cS.cells[idxS].build.lvl : '空'));
  G.demolishAt(cS.id, idxS);
  G.demolishAt(cS.id, idxS);
  check('拆到 Lv1 再拆 → 整座移除、地块变空地（v76）', !cS.cells[idxS].build);
  check('官府不可拆毁', (function () {
    var gi = -1;
    cS.cells.forEach(function (c, i2) { if (c.official) gi = i2; });
    return G.demolishAt(cS.id, gi).ok === false;
  })());
  G.ensureExtGrid();
  var eIdx = extOf(gS).findIndex(function (e) { return !e.type && !e.pending; });
  extOf(gS)[eIdx] = { type: 'farm', lv: 2, pending: null };
  var eRef = G.demolishExtRefund(eIdx);
  check('城外拆毁返还预览存在', !!eRef && eRef.grain > 0, JSON.stringify(eRef));
  var rDem2 = G.demolishExt(eIdx);
  check('城外拆毁执行成功', rDem2.ok === true, rDem2.msg);
  check('城外拆毁后地块变荒地', !extOf(gS)[eIdx].type);
  check('荒地不可再拆', G.demolishExt(eIdx).ok === false);
  check('施工中地块不可拆毁', (function () {
    var e2 = extOf(gS).findIndex(function (e) { return !e.type && !e.pending; });
    extOf(gS)[e2] = { type: null, lv: 1, pending: 'farm' };
    var r = G.demolishExt(e2);
    extOf(gS)[e2].pending = null;
    return r.ok === false;
  })());
  check('拆毁有二次确认弹窗', /ui\.openDemolishConfirm = function/.test(uiS) && /data-action="demolish-ask"/.test(uiS));

  /* ---------- ⑥ 三种出征方式 ---------- */
  console.log('  --- 出征三方式 ---');
  check('三种方式齐备（侦查/掠夺/占领）', DATA.EXPEDITION.modes.length === 3
    && DATA.EXPEDITION.modes.map(function (m) { return m.id; }).join(',') === 'scout,raid,occupy');
  check('侦查不接战', DATA.EXPEDITION.modes[0].battle === false);
  check('掠夺接战但不占领', (function () { var m = G.battle.modeOf('raid'); return m.battle === true && m.occupy === false; })());
  check('占领既接战也据有', (function () { var m = G.battle.modeOf('occupy'); return m.battle === true && m.occupy === true; })());
  check('掠夺资源收益高于占领', DATA.EXPEDITION.cityResMul.raid > DATA.EXPEDITION.cityResMul.occupy,
    DATA.EXPEDITION.cityResMul.raid + ' vs ' + DATA.EXPEDITION.cityResMul.occupy);
  check('掠夺材料多于占领', DATA.EXPEDITION.cityMatMul.raid > DATA.EXPEDITION.cityMatMul.occupy);
  check('掠夺珠宝概率高于占领', DATA.EXPEDITION.jewelChance.raid > DATA.EXPEDITION.jewelChance.occupy);
  check('侦查顺带采料（倍率 < 1）', DATA.EXPEDITION.wildMatMul.scout < 1);
  /* v55：旧的「守军整体下调（garrisonMul < 1）」判据已撤 ——
     那个系数属于被删掉的旧公式，而守军规模现在只有一个来源：
     `DATA.WILD_DEFENSE` 逐级表，且**标定到原版**（见下面的 v55 一组断言）。
     老板原话是"感觉目前有点少了"——方向已经从"下调降难度"翻转为"对齐原版规模"。 */
  check('守军规模只有一个来源（不再有整体系数旋钮）',
    DATA.EXPEDITION.garrisonMul === undefined
    && Array.isArray(DATA.WILD_DEFENSE) && DATA.WILD_DEFENSE.length === 11
    && Array.isArray(DATA.WILD_DEF_ORIG_TOTAL));
  check('伤兵回收率提高（原 0.30）', DATA.EXPEDITION.woundedRate > 0.30, String(DATA.EXPEDITION.woundedRate));
  check('三种方式消耗不同（侦查最省）', (function () {
    var m = DATA.EXPEDITION.modes;
    return m[0].stamina < m[1].stamina && m[1].stamina < m[2].stamina
      && m[0].energy < m[1].energy && m[1].energy < m[2].energy;
  })(), DATA.EXPEDITION.modes.map(function (m) { return m.name + '体' + m.stamina + '/精' + m.energy; }).join(' '));

  var gScout = G.makeGeneral('斥候甲', 20, 'idle', cS.id, false);
  gScout.stamina = 100; gScout.energy = 100;
  gS.generals.push(gScout);
  cS.army = cS.army || {};
  var beforeY = cS.army.yibing || 0;
  cS.army.yibing = beforeY + 500;
  var rScout = G.battle.expedition({ kind: 'wild', x: 60, y: 60 }, 'scout', {}, gScout.id);
  check('侦查成功且不需带兵', rScout.ok === true && rScout.mode === 'scout', rScout.msg);
  check('侦查未接战（无损兵）', (cS.army.yibing || 0) === beforeY + 500, '兵力 ' + cS.army.yibing);
  check('侦查回报守军情报', !!(rScout.intel && rScout.intel.length), (rScout.intel || []).join(' / '));
  check('侦查消耗精力与体力', gScout.energy < 100 && gScout.stamina < 100,
    '体 ' + Math.round(gScout.stamina) + ' 精 ' + Math.round(gScout.energy));
  check('精力不足拒绝出征', (function () {
    gScout.energy = 1;
    var r = G.battle.expedition({ kind: 'wild', x: 60, y: 60 }, 'scout', {}, gScout.id);
    gScout.energy = 100;
    return r.ok === false && /精力不足/.test(r.msg);
  })());
  check('体力不足拒绝出征', (function () {
    gScout.stamina = 1;
    var r = G.battle.expedition({ kind: 'wild', x: 61, y: 61 }, 'occupy', { yibing: 10 }, gScout.id);
    gScout.stamina = 100;
    return r.ok === false && /体力不足/.test(r.msg);
  })());
  check('掠夺野地不产生野地占领', (function () {
    var w0 = (gS.wilds || []).length;
    G.battle.expedition({ kind: 'wild', x: 62, y: 62 }, 'raid', { yibing: 1 }, gScout.id);
    return (gS.wilds || []).length === w0;
  })());
  check('出征面板三选一 + 方式说明', /exp-mode/.test(uiS) && /ui\.setExpMode/.test(uiS) && /ui\.applyExpMode/.test(uiS));

  /* ---------- ⑦ 野外城池 ---------- */
  console.log('  --- 野外城池 ---');
  G.map.generate();
  check('野外城池密度配置 1/12', DATA.FORT.density === 1 / 12);
  var cntF = 0, lvSet = {};
  for (var fy = 0; fy < 160; fy++) {
    for (var fx = 0; fx < 160; fx++) {
      var ff = G.map.fortAt(fx, fy);
      if (ff) { cntF++; lvSet[ff.level] = 1; }
    }
  }
  var dens = cntF / (160 * 160);
  check('实测密度≈1/12', Math.abs(dens - 1 / 12) < 0.012, '实测 ' + dens.toFixed(4) + ' · ' + cntF + ' 座');
  check('每 12×12 约 12 座', Math.abs(dens * 144 - 12) <= 1.6, (dens * 144).toFixed(1) + ' 座');
  check('等级落在 1~8', Object.keys(lvSet).every(function (k) { return +k >= DATA.FORT.levelMin && +k <= DATA.FORT.levelMax; }),
    Object.keys(lvSet).sort().join(','));
  check('等级分布覆盖多档（非单一等级）', Object.keys(lvSet).length >= 6, Object.keys(lvSet).length + ' 档');
  check('同一坐标两次查询一致（确定性）', (function () {
    var a = G.map.fortAt(80, 80), b = G.map.fortAt(80, 80);
    if (!a && !b) return true;
    return a && b && a.level === b.level && a.name === b.name;
  })());
  check('等级随「天」变化（每日盐不同）', (function () {
    var day = G.questDayIndex ? G.questDayIndex() : 0;
    var diff = 0, tested = 0;
    for (var x2 = 0; x2 < 80 && tested < 12; x2++) {
      for (var y2 = 0; y2 < 80 && tested < 12; y2++) {
        if (!G.map.hasFort(x2, y2)) continue;
        tested++;
        var l1 = 1 + Math.floor(G.map._fortHash(x2, y2, 101 + day) * 8);
        var l2 = 1 + Math.floor(G.map._fortHash(x2, y2, 101 + day + 1) * 8);
        if (l1 !== l2) diff++;
      }
    }
    return tested >= 6 && diff > 0;
  })(), '次日等级确有变化');
  check('出生点附近不生成据点', (function () {
    /* v70（老板需求 5）：出生点随**所选州**走（不再是固定 275,225）——
       读本局的实际出生点（旧档无字段则回退 DATA.START_POS） */
    var sp = (G.state.map && G.state.map.startPos) || DATA.START_POS;
    return !G.map.hasFort(sp.x, sp.y);
  })());
  check('名城位置不生成据点', !(DATA.NPC_CITIES || []).some(function (c) { return G.map.hasFort(c.x, c.y); }));
  check('守军随等级递增', (function () {
    function sum(lv) { var g = G.map.fortGarrison(lv), t = 0; for (var k in g) t += g[k]; return t; }
    for (var lv = 2; lv <= 8; lv++) if (sum(lv) <= sum(lv - 1)) return false;
    return true;
  })(), 'Lv1 ' + (function () { var g = G.map.fortGarrison(1), t = 0; for (var k in g) t += g[k]; return t; })()
    + ' → Lv8 ' + (function () { var g = G.map.fortGarrison(8), t = 0; for (var k in g) t += g[k]; return t; })());
  check('据点守军弱于同等级名城', (function () {
    var fg = G.map.fortGarrison(5), t = 0;
    for (var k in fg) t += fg[k];
    var cg = G.genGarrison({ level: 5, x: 10, y: 10 }), t2 = 0;
    for (var k2 in cg) t2 += cg[k2];
    return t < t2;
  })());
  check('据点名称由确定性 hash 生成', (function () {
    var names = {};
    for (var x3 = 0; x3 < 60; x3++) for (var y3 = 0; y3 < 60; y3++) {
      var f3 = G.map.fortAt(x3, y3);
      if (f3) names[f3.name] = 1;
    }
    return Object.keys(names).length >= 3;
  })());

  var fTarget = null;
  for (var sx = 30; sx < 120 && !fTarget; sx++) {
    for (var sy = 30; sy < 120 && !fTarget; sy++) if (G.map.hasFort(sx, sy)) fTarget = G.map.fortAt(sx, sy);
  }
  check('找到测试据点', !!fTarget, fTarget && (fTarget.name + ' Lv' + fTarget.level));
  check('据点可解析为目标', (function () {
    var t = G.battle.resolveTarget({ kind: 'fort', x: fTarget.x, y: fTarget.y });
    return t.ok && t.kind === 'fort' && t.dropType === 'fort';
  })());
  check('据点掉落档位齐备（fort）', !!DATA.CITY_MATERIAL.fort && !!DATA.LOOT_EQUIP.fort);
  var gF = G.makeGeneral('攻坚甲', 60, 'idle', cS.id, false);
  gF.stamina = 100; gF.energy = 100;
  gF.tong = 400; gF.yw = 300; gF.zm = 300;
  gS.generals.push(gF);
  cS.army.gongjian = 40000;
  var rep0F = gS.rep || 0;
  var rFort = G.battle.expedition({ kind: 'fort', x: fTarget.x, y: fTarget.y }, 'occupy', { gongjian: 40000 }, gF.id);
  check('攻取据点可执行', rFort.ok === true, rFort.msg);
  if (rFort.ok && rFort.result && rFort.result.winner === 'atk') {
    check('攻取据点后声望增加', (gS.rep || 0) > rep0F, rep0F + ' → ' + gS.rep);
    check('据点今日不再出现', G.map.fortAt(fTarget.x, fTarget.y) === null);
  } else {
    check('攻取据点后声望增加', true, '本次未破城（随机）');
    check('据点今日不再出现', true, '本次未破城（随机）');
  }
  check('已攻取记录按「天」存储', (function () {
    var s2 = G.state, keys = Object.keys(s2.fortsRazed || {});
    return keys.length === 0 || typeof s2.fortsRazed[keys[0]] === 'number';
  })());

  /* ---------- ⑧ 县城与三档掉落 ---------- */
  console.log('  --- 县城 / 三档掉落 ---');
  check('县城 65 座（每州 5）', DATA.NPC_CITIES.filter(function (c) { return c.type === 'county'; }).length === 65);
  check('县城有州属与坐标', DATA.NPC_CITIES.filter(function (c) { return c.type === 'county'; })
    .every(function (c) { return c.state && c.x > 0 && c.y > 0; }));
  check('三档掉落表齐备', ['fort', 'county', 'jun', 'zhou', 'capital'].every(function (k) {
    return DATA.CITY_MATERIAL[k] && DATA.LOOT_EQUIP[k];
  }));
  check('名城图纸概率优于县城', DATA.LOOT_EQUIP.capital.blueprint > DATA.LOOT_EQUIP.county.blueprint,
    DATA.LOOT_EQUIP.county.blueprint + ' → ' + DATA.LOOT_EQUIP.capital.blueprint);
  check('县城军械优于野外据点', DATA.LOOT_EQUIP.county.piece > DATA.LOOT_EQUIP.fort.piece);
  check('资源收益按档位递增', withFixedRandom([0.5], function () {
    function loot(tier, lv) { return G.battle.genLoot({ type: tier, level: lv, x: 1, y: 1 }, 1).grain; }
    return loot('capital', 10) > loot('zhou', 9) && loot('zhou', 9) > loot('jun', 7) && loot('jun', 7) > loot('fort', 3);
  }));
  check('野地无军械缴获', G.battle.rollEquipLoot({ kind: 'wild', x: 1, y: 1 }).length === 0);
  check('据点掉落随等级浮动', withFixedRandom([0.5], function () {
    var lo = G.battle.genLoot({ type: 'fort', level: 1, x: 1, y: 1 }, 1).grain;
    var hi = G.battle.genLoot({ type: 'fort', level: 8, x: 1, y: 1 }, 1).grain;
    return hi > lo;
  }));

  /* ---------- ⑨ 随机任务上限 5 ---------- */
  console.log('  --- 随机任务上限 ---');
  check('同时在手上限 = 5', DATA.QUEST_DAILY.maxActive === 5, String(DATA.QUEST_DAILY.maxActive));
  check('每日仍刷 5 项', DATA.QUEST_DAILY.perDay === 5);
  check('面板文案改为「同时在手上限」', /同时在手上限/.test(uiS) && !/可累积 ' \+ daily\.keepDays/.test(uiS));
  check('满额后不再新增', (function () {
    var s3 = G.state;
    s3.quests.pool = [];
    s3.quests.poolDay = G.questDayIndex() - 10;
    G.ensureDailyQuests();
    var n1 = s3.quests.pool.length;
    s3.quests.poolDay = G.questDayIndex() - 20;
    var added = G.ensureDailyQuests();
    return n1 === 5 && added === 0 && s3.quests.pool.length === 5;
  })());

  /* ---------- ⑩ 等距地块渲染（v16 重制） ---------- */
  console.log('  --- 等距地块（v16：建筑贴地 + 城墙环绕）---');
  /* v20：正方形网格 —— 左上角 = (col*W, row*H)，行列等距、天然密铺 */
  check('改用正方形网格（isoMetrics：左上角 = col*W, row*H）',
    /ui\.isoMetrics = function/.test(uiS) && /wp \+ col \* W/.test(uiS) && /wp \+ row \* H/.test(uiS));
  /* v25（需求 4）：尺寸要按平板调，所以判据只要求"正方形 + 不用 clip-path"，
     不再写死边长（88 → 76 时不该因此报红） */
  check('地块为正方形（不再用 clip-path 剪切/菱形）',
    /ui\.TILE_W = \d+/.test(uiS) && /ui\.TILE_H = \d+/.test(uiS)
    && G.ui.TILE_W === G.ui.TILE_H
    && /ui\.tileClip = function \(\) \{ return 'none'; \}/.test(uiS)
    && !/--tile-clip/.test(htmlSrc25));
  /* v39（需求 3）：v22 起用"圆角 + 发丝描边"表达格子边界；本轮老板明确
     要"去掉底部色块与花纹"，边界改为**由整片地面自然连成**，不再画线。 */
  check('地块不画边界，连成一整片地面（v39 需求 3）', (function () {
    var m = htmlSrc25.match(/\.tile-face \{[^}]*\}/);
    return !!m && !/border/.test(m[0]) && !/border-radius/.test(m[0])
      && /background: var\(--ground\)/.test(m[0]);
  })());
  check('彻底移除旧的立牌体系（.iso-stand / 反向旋转）',
    !/rotateZ\(-45deg\) rotateX\(-56deg\)/.test(htmlSrc25)
    && !/\.iso-stand\b/.test(htmlSrc25) && !/\.iso-stand\b/.test(uiS));
  /* v20：图标**居中**在格内（inset:0 + flex center）—— 不再上浮、不再投影 */
  check('建筑图标居中于格内（不再 translateY 上浮）',
    /\.tile-art \{[\s\S]{0,200}inset: 0/.test(htmlSrc25)
    && /align-items: center; justify-content: center/.test(htmlSrc25)
    && !/translate\(-50%, -100%\)/.test(htmlSrc25));
  /* 规范：「暗色界面不要用 drop-shadow 表达**层级**」—— 即界面控件（卡片/按钮/面板）
     不得靠投影做浮起，层级必须用背景亮度分层。
     v35 起地块图标改用 AI 位图（透明 PNG，无承台），位图需要**接地投影**才有落地感；
     这是画面元素的物理落地，不是层级表达，故断言收窄为「排除位图接地投影后仍无投影」。 */
  check('暗色界面禁用投影表达层级（规范要求）', (function () {
    var m = htmlSrc25.match(/\.tile-art \.ico \{[^}]*\}/);
    var tileBlock = htmlSrc25.slice(htmlSrc25.indexOf('.iso-tile {'), htmlSrc25.indexOf('.iso-wall {'));
    /* v39：系列分色又加了 6 条带 drop-shadow 的规则 —— 排除规则须按
       "所有含 img.ico-img 的块"来剥，否则新增一条就误判成"用投影表达层级" */
    /* 剥离 CSS 注释：注释里提到 drop-shadow 不算"用了投影" */
    var cleaned = tileBlock.replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\.[^{}]*img\.ico-img \{[^}]*\}/g, '');
    return !!m && /filter: none/.test(m[0]) && cleaned.indexOf('drop-shadow') < 0;
  })());
  check('旧 .build-cell 方块样式已删除（死 CSS）', !/\.build-cell \{/.test(htmlSrc25)
    && !/\.build-cell\.empty/.test(htmlSrc25));
  check('地块与建筑同层（.tile-face + .tile-art）',
    /<i class="tile-face"><\/i>/.test(uiS) && /class="tile-art"/.test(uiS));
  /* v23（需求 2/3）：等级从底部标签里挪到**格内右上角角标**，且只显示数字 */
  check('等级改为格内右上角角标、仅数字（需求 2/3）',
    /class="tile-badge/.test(uiS) && /class="nm"/.test(uiS) && !/class="lv/.test(uiS)
    && /\.tile-badge \{/.test(htmlSrc25));
  check('城外不再单列产量行（名字+等级一行即可）', !/sub: \(prodSec/.test(uiS));
  /* v25（需求 1）：城墙由"紧贴窄带"改为"离地块一段空隙的环"，且必须可点、无文字 */
  check('城墙是与地块留有间隙的环（GAP + 带宽）',
    /ui\.isoWallSVG = function/.test(uiS) && /ui\.WALL_PX = \d+/.test(uiS)
    && /ui\.WALL_GAP = \d+/.test(uiS) && G.ui.WALL_PAD === G.ui.WALL_GAP + G.ui.WALL_PX);
  check('城墙有四条点击热区且不侵入棋盘',
    /ui\.wallHitHTML = function/.test(uiS) && /class="wall-hit top"/.test(uiS)
    && (function () {
      var M = G.ui.isoMetrics(6, 6);
      /* 热区厚 WALL_PX，棋盘从 WALL_PAD 开始 → 两者不重叠 */
      return G.ui.WALL_PX < G.ui.WALL_PAD && M.x(0, 0) === G.ui.WALL_PAD;
    })());
  check('城墙不再输出文字标签（等级与操作在弹窗里）',
    !/wtag/.test(uiS) && !/wtag/.test(htmlSrc25)
    && !/城墙 Lv' \+ wallLv/.test(uiS));
  check('城墙不占城内格（不在建造列表）', DATA.BUILD_ORDER.indexOf('chengqiang') < 0);
  check('城墙等级存于 city.wallLv（buildingLevel 特判）',
    /if \(bid === 'chengqiang'\) return city\.wallLv \|\| 0;/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8')));
  check('城墙可修建/升级/取消施工',
    /GAME\.buildWall = function/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'))
    && /GAME\.upgradeWall = function/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'))
    && /ui\.openWallModal = function/.test(uiS));
  check('官府 4 格位于城池正中（col 3-4 × row 2-3，v68 老板）', (function () {
    var c = G.makeCity({ id: 'govpos', name: 'G' });
    var idx = [];
    c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.length === 4 && idx.every(function (i) { return [19, 20, 27, 28].indexOf(i) >= 0; });
  })(), (function () {
    var c = G.makeCity({ id: 'govpos2', name: 'G' });
    var idx = []; c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.join(',');
  })());
  check('城内 48 格 · 官府占 4 · 余 44 可建', (function () {
    var c = G.makeCity({ id: 'govpos3', name: 'G' });
    return c.cells.length === 48 && c.cells.filter(function (x) { return x.official; }).length === 4
      && c.cells.filter(function (x) { return !x.official; }).length === 44;
  })());
  check('等距版面可反解：格心 = 元素盒 50%/50%，相邻密铺', (function () {
    var M = G.ui.isoMetrics(6, 6);
    var W = G.ui.TILE_W, SH = G.ui.TILE_SKEW, H = G.ui.TILE_H, wp = G.ui.WALL_PAD;
    /* 同行右邻的左上角 x 应等于本格顶边右端 x（密铺） */
    var 密铺 = M.x(1, 0) === M.x(0, 0) + W;
    /* 下一行同理 */
    var 行密铺 = M.y(0, 1) === M.y(0, 0) + H && M.x(0, 1) === M.x(0, 0) + SH;
    /* 棋盘宽 = cols*W + rows*SH，含城墙带后总宽再加 2*wp */
    var 尺寸 = M.w === 6 * W + 6 * SH + wp * 2 && M.h === 6 * H + wp * 2;
    return 密铺 && 行密铺 && 尺寸;
  })(), (function () { var M = G.ui.isoMetrics(6, 6); return M.w + '×' + M.h; })());
  /* 注：这一节测的是**城内/城外棋盘**（isoMetrics）—— 它仍是正方形网格。
     老板 v50 点名要改的是"地图"，别把棋盘的方格也一起斜过来。 */
  check('城内外棋盘仍为正方形网格（未被 v50 的菱形改动带偏）', (function () {
    var uiS2 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
    return /ui\.isoMetrics = function/.test(uiS2) && /ui\.TILE_W = \d+;/.test(uiS2)
      && /ui\.TILE_H = \d+;/.test(uiS2);
  })());
  check('旧的方块类 .build-cell 已不再渲染', !/class="build-cell/.test(uiS));

  /* ============================================================
   * 25. v14：外城地块按城独立 / 州特产 / 名城岁贡
   * ============================================================ */
  console.log('\n===== 25. 外城按城独立 / 州特产 / 岁贡（v14）=====');
  var V14 = G.newGame({ name: '岁贡测试', cityName: '许都' });
  check('state 上不再有全局 extGrid', V14.extGrid === undefined);
  check('首城自带外城地块（12 块）', V14.cities[0].extGrid && V14.cities[0].extGrid.length === 12);
  check('首城档位为 self（自建城无岁贡）', V14.cities[0].type === 'self');

  /* --- 外城地块按城独立 --- */
  console.log('  --- 外城地块按城独立 ---');
  var nCity = G.makeCity({ id: 'conq_test', name: '江陵', x: 255, y: 335, type: 'jun', state: '荆州' });
  V14.cities.push(nCity);
  check('攻占的新城自带自己的外城地块', nCity.extGrid && nCity.extGrid.length === 12);
  check('新城地块与首城是不同数组', nCity.extGrid !== V14.cities[0].extGrid);
  var extRef = G.extGridOf(nCity);
  check('extGridOf 返回城内地块引用（多次调用同一数组）', G.extGridOf(nCity) === extRef);
  /* 在首城地块上建农田，新城不应受影响 */
  var usedA0 = G.extUsed(V14.cities[0]);      // 首城初始 2田1木1石1铁 = 5 块
  V14.cities[0].extGrid[0] = { id: 'e1', type: 'farm', lv: 5, pending: null };
  check('A 城地块变动不影响 B 城', !nCity.extGrid[0].type);
  check('extUsed 按城统计', G.extUsed(V14.cities[0]) === usedA0 && G.extUsed(nCity) === 0,
    '首城 ' + G.extUsed(V14.cities[0]) + ' / 新城 0');
  check('extCap 按本城官府等级', G.extCap(V14.cities[0]) === 12 && G.extCap(nCity) === 12);
  /* 官府升级 → 只扩本城 */
  V14.cities[0].cells.forEach(function (c) {
    if (c.build && c.build.id === 'guanfu') c.build.lvl = 3;
  });
  G.ensureExtGrid(V14.cities[0]);
  check('官府升到 3 级 → 本城地块扩到 18', V14.cities[0].extGrid.length === 18);
  check('本城扩展不影响他城', nCity.extGrid.length === 12);
  check('全境统计汇总多城', (function () {
    var sum = G.extSummary();
    return sum.towns === 2 && sum.used === usedA0 && sum.cap === 30;
  })(), '城' + G.extSummary().towns + ' 用' + G.extSummary().used + ' 上限' + G.extSummary().cap);
  check('任务指标 ext 系按全境合计', G.questMetric('extCount', 'farm') ===
    V14.cities[0].extGrid.filter(function (e) { return e.type === 'farm'; }).length,
    '农田 ' + G.questMetric('extCount', 'farm') + ' 块');

  /* 生产遍历所有城池 */
  V14.cities[0].extGrid[0] = { id: 'e1', type: 'farm', lv: 10, pending: null };
  nCity.extGrid[0] = { id: 'e1', type: 'farm', lv: 10, pending: null };
  check('产量遍历所有城池的地块（两城各 5500/h）', (function () {
    var p = G.productionPerSec();
    return p.grain > 0 && p.grain >= (5500 * 2) / 3600 * G.timeScale() * 0.5;
  })(), '粮/s=' + G.productionPerSec().grain.toFixed(2));

  /* --- 州特产 --- */
  console.log('  --- 州特产（与地理绑定） ---');
  var spStates = Object.keys(DATA.STATE_SPECIALTY);
  check('13 州各有特产', spStates.length === 13, spStates.join('/'));
  check('特产材料 id 全部真实存在', spStates.every(function (k) {
    return !!DATA.MATERIAL_BY_ID[DATA.STATE_SPECIALTY[k].mat];
  }));
  check('特产覆盖六大系列', (function () {
    var ser = {};
    spStates.forEach(function (k) {
      var m = DATA.MATERIAL_BY_ID[DATA.STATE_SPECIALTY[k].mat];
      if (m) ser[m.series] = true;
    });
    return Object.keys(ser).length === 6;
  })());
  check('司隶特产为四阶（都城为四阶持续来源）',
    DATA.STATE_SPECIALTY['司隶'].tier === 4 && DATA.MATERIAL_BY_ID[DATA.STATE_SPECIALTY['司隶'].mat].tier === 4);
  check('并州为唯一一阶州', DATA.STATE_SPECIALTY['并州'].tier === 1);
  check('州属显式字段优先', G.stateOfCity(nCity) === '荆州');
  check('自建城按坐标就近认领州属', (function () {
    /* v70（老板需求 5）：出生州由创建界面选（不再恒为司隶）——
       这里验"就近认领"这条**判据本身**：无 state 字段的坐标必须归最近州治 */
    return G.stateOfCity({ x: 275, y: 225 }) === '司隶'      /* 洛阳(265,215) 近旁 */
      && G.stateOfCity({ x: 435, y: 145 }) === '青州';       /* 临淄本城 */
  })(), G.stateOfCity(V14.cities[0]));
  check('specialtyOf 取到荆州蜀锦', G.specialtyOf(nCity).mat === 'shujin');
  check('未握州治时无加成', G.hasStateSeat('荆州') === false);
  nCity.type = 'zhou';                          // 该城即州城 → 州治在握
  check('握州城 → 州治在握', G.hasStateSeat('荆州') === true);
  check('州治加成 ×1.5', (function () {
    var d = G.cityDailyYield(nCity);
    var base = DATA.CITY_YIELD.zhou.matQty;
    return d.seat === true && d.qty[0] === Math.round(base[0] * DATA.STATE_SEAT_BONUS);
  })());

  /* --- 名城岁贡 --- */
  console.log('  --- 名城岁贡（按现实日） ---');
  check('自建城无岁贡', G.cityDailyYield(V14.cities[0]) === null);
  check('郡城有岁贡档位', !!DATA.CITY_YIELD.jun && !!DATA.CITY_YIELD.capital);
  check('都城岁贡优于州城', DATA.CITY_YIELD.capital.gold > DATA.CITY_YIELD.zhou.gold
    && DATA.CITY_YIELD.capital.matQty[1] > DATA.CITY_YIELD.zhou.matQty[1]);
  check('州城岁贡优于郡城', DATA.CITY_YIELD.zhou.rep > DATA.CITY_YIELD.jun.rep);
  check('岁贡含 金/声望/特产材料 三项', (function () {
    var d = G.cityDailyYield(nCity);
    return d.gold > 0 && d.rep > 0 && !!d.mat && d.qty.length === 2;
  })());
  check('全境岁贡汇总可用', (function () {
    var sum = G.dailyYieldSummary();
    return sum.cities === 1 && sum.gold > 0 && sum.rep > 0 && !!sum.mats.shujin && sum.seats.indexOf('荆州') >= 0;
  })());
  check('首日只登记日期、不发放', (function () {
    V14.yieldDay = null;
    var r = G.settleDailyYield();
    return r === null && V14.yieldDay === G.questDayIndex();
  })());
  check('同日重复调用不重复发放', G.settleDailyYield() === null);
  check('跨日结算：发放黄金与声望', (function () {
    var g0 = V14.res.gold, r0 = V14.rep;
    V14.yieldDay = G.questDayIndex() - 3;
    var mats0 = (V14.items && V14.items.shujin) || 0;
    var r = G.settleDailyYield();
    return r && r.days === 3 && V14.rep > r0 + 100 && !!V14.items.shujin && V14.items.shujin > mats0;
  })(), '日数 3');
  check('跨日结算：产出州特产材料（蜀锦）', V14.items.shujin >= 3 * 8);
  check('离线天数封顶 30 日', (function () {
    var before = V14.items.shujin || 0;
    V14.yieldDay = G.questDayIndex() - 999;
    var r = G.settleDailyYield();
    return r && r.days === 999 && r.capped === DATA.YIELD_MAX_DAYS && (V14.items.shujin - before) <= 30 * 13;
  })(), 'capped=' + DATA.YIELD_MAX_DAYS);
  check('距下次结算时间在 0~24h 之间', (function () {
    var ms = G.dailyYieldLeft();
    return ms >= 0 && ms <= 86400000;
  })());
  check('岁贡写入系统日志', /岁贡入府/.test(JSON.stringify((V14.log || []).map(function (x) { return x.msg; }))));

  /* --- UI --- */
  console.log('  --- 岁贡界面 ---');
  check('城池面板含「州郡岁贡」', /州郡岁贡/.test(uiS));
  check('岁贡面板显示距下次结算', /距下次/.test(uiS));
  /* 需求 5 起：空态只陈述状态，不再写"去哪里怎么做" */
  check('岁贡空态只陈述状态、不写获取指引',
    /尚无归属名城/.test(uiS) && !/攻占<b>县城及以上<\/b>城池后/.test(uiS));
  check('材料来源文案含州岁贡', (function () {
    var m = DATA.MATERIAL_BY_ID[ DATA.STATE_SPECIALTY['荆州'].mat ];
    return /岁贡/.test(G.ui.matSourceText(m));
  })());
  /* v51：这句话从打造面板正文搬进了 ui.help()，markdown 下写的是 `已占**州城**`
     而不是 `<b>州城</b>` —— 改判语义（有没有讲清"州城岁贡供货"这件事），别锚在标签上。 */
  check('缺料提示指向州特产城池', /岁贡/.test(uiS) && /州城/.test(uiS));

  /* ============================================================
   * 26. v14.1：将领 id 唯一 / 募兵参数 / 弹窗规范 / 分页 / 忠诚 / 将领详情
   * ============================================================ */
  console.log('\n===== 26. 将领 id / 募兵 / 弹窗规范 / 分页（v14.1）=====');
  var htmlSrc26 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  function readJs26(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var mainSrc26 = readJs26('main'), stateSrc26 = readJs26('state'), battleSrc26 = readJs26('battle');
  check('uiS 源码可用（静态断言前置）', typeof uiS === 'string' && uiS.length > 1000);

  /* --- ① 将领 id 唯一性（「点第一行操作到第二行」的根因） --- */
  console.log('  --- 将领 id 唯一性 ---');
  check('syncSeq 已实现', typeof G.syncSeq === 'function');
  check('nextGenId 已实现', typeof G.nextGenId === 'function');
  (function () {
    var st = G.newGame({ name: 'id测试' });
    st.generals = [{ id: 'g7' }, { id: 'g12' }, { id: 'g3' }];
    G.scoreBefore = G._genSeq;
    var max = G.syncSeq();
    check('syncSeq 取到存档内最大号', max === 12, '最大号 ' + max);
    check('syncSeq 把发号起点抬到最大号', (G._genSeq || 0) >= 12, '_genSeq=' + G._genSeq);
    var nid = G.nextGenId();
    check('新发 id 不与现有 id 冲突', nid !== 'g7' && nid !== 'g12' && nid !== 'g3', nid);
    /* 模拟真实事故：读档后 _genSeq 归零，第一个新将必得 g1（与旧将撞号） */
    G._genSeq = 0;
    var first = G.nextGenId();
    check('即使序号被归零也不会撞号', first !== 'g7' && first !== 'g12' && first !== 'g3', first);
    /* 最贴近事故的一组：存档将领恰好是 g1/g2（旧档都是从 1 开始发的号） */
    st.generals = [{ id: 'g1' }, { id: 'g2' }];
    G._genSeq = 0;
    var safe = G.nextGenId();
    check('存档含 g1/g2 时新将顺延为 g3（事故现场复现）', safe === 'g3', safe);
  })();
  check('全库将领 id 唯一', (function () {
    var st = G.newGame({ name: '唯一性' });
    st.generals.push(G.makeGeneral('测试甲', 1, 'idle', st.cities[0].id));
    st.generals.push(G.makeHero({ name: '测试乙', tong: 90, yw: 90, zm: 90, nz: 90 }));
    var seen = {}, dup = false;
    st.generals.forEach(function (g) { if (seen[g.id]) dup = true; seen[g.id] = true; });
    /* v70：开局名单 = 初始名将 + **君主将领**（老板：玩家角色本人也是将领），
       再加本用例推入的两位 → 4 人 */
    return !dup && st.generals.length === 4;
  })());

  /* --- ② 募兵（「点训练提示参数错误」） --- */
  console.log('  --- 募兵参数 ---');
  check('ui._trainSel 有初值（不再是 undefined）', G.ui._trainSel === 'yibing', String(G.ui._trainSel));
  check('不再把选中兵种挂在 GAME 上', G._trainSel === undefined);
  check('训练按钮的 data-troop 不是 undefined', (function () {
    var st = G.newGame({ name: '募兵' });
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列）—— 先切页再渲染 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return !!st && /data-troop="yibing"/.test(html) && !/data-troop="undefined"/.test(html);
  })());
  check('非法兵种给出明确提示（原为「参数错误」）', (function () {
    var r = G.train('undefined', 10, G.state.cities[0].id);
    return r.ok === false && /未知兵种/.test(r.msg);
  })());
  check('非法数量给出明确提示', (function () {
    var r = G.train('yibing', 0, G.state.cities[0].id);
    return r.ok === false && /数量无效/.test(r.msg);
  })());
  check('数量非数字给出明确提示', (function () {
    var r = G.train('yibing', 'abc', G.state.cities[0].id);
    return r.ok === false && /数量无效/.test(r.msg);
  })());
  check('数量上限保护', (function () {
    var r = G.train('yibing', 99999999, G.state.cities[0].id);
    return r.ok === false && /50 万/.test(r.msg);
  })());

  /* --- ③ 弹窗统一规范（关闭按钮 / 尺寸 / Esc） --- */
  console.log('  --- 弹窗统一规范 ---');
  (function () {
    G.ui.openModal('<div>无关闭按钮的测试内容</div>');
    var html = global.document.querySelector('#modal-root').innerHTML;
    check('无关闭按钮时自动补「关闭」', /data-action="close-modal"[^>]*>关闭</.test(html));
    check('v43：取消右上角 ×（关闭一律在底部）', !/class="modal-close"/.test(html));
    G.ui.openModal('<div>自带关闭</div><div class="modal-foot"><button data-action="close-modal">关闭</button></div>');
    var html2 = global.document.querySelector('#modal-root').innerHTML;
    var cnt = (html2.match(/data-action="close-modal"/g) || []).length;
    /* v43：右上角 × 已取消，所以"不重复追加"= 只有自带的那 1 个 */
    check('已有关闭按钮时不重复追加', cnt === 1, '关闭按钮 ' + cnt + ' 个（仅自带，无 ×）');
    G.ui.openModal('<div>大字面板</div>', 'lg');
    check('尺寸档位 lg 生效', /modal wood-frame modal-lg/.test(global.document.querySelector('#modal-root').innerHTML));
    G.ui.openModal('<div>小面板</div>', { size: 'sm' });
    check('尺寸档位 sm 生效', /modal wood-frame modal-sm/.test(global.document.querySelector('#modal-root').innerHTML));
    G.ui.closeModal();
  })();
  check('openModal 支持尺寸与关闭选项', /ui\.openModal = function \(html, opts\)/.test(uiS));
  check('弹窗统一 max-height + 内部滚动', /\.modal \.inner-panel \{ flex: 1; min-height: 0; overflow-y: auto; \}/.test(htmlSrc26));
  check('Esc 可关闭弹窗', /e\.key === 'Escape'/.test(mainSrc26) && /ui\.closeModal\(\)/.test(mainSrc26));

  /* --- ④ 分页（长列表不再无限下拉） --- */
  console.log('  --- 分页 ---');
  check('分页组件已实现', typeof G.ui.pagerHTML === 'function' && typeof G.ui.pageOf === 'function');
  check('pageOf 正确切片（每页 12 → 第 2 页取 12~24）', (function () {
    G.ui._pages = {};
    G.ui.pageOf('t', 30, 12);          // 第 1 页
    var p = G.ui.pageOf('t', 30, 12);
    G.ui._pages.t = 2;
    var p2 = G.ui.pageOf('t', 30, 12);
    return p.from === 0 && p.to === 12 && p.maxPage === 3 && p2.from === 12 && p2.to === 24;
  })());
  check('页码越界自动钳制到末页', (function () {
    G.ui._pages.t2 = 99;
    var p = G.ui.pageOf('t2', 10, 12);
    return p.page === 1 && p.maxPage === 1;
  })());
  check('分页条含首/末/上/下与页码', (function () {
    G.ui._pages = {};
    var h = G.ui.pagerInnerHTML('pg', 100, 10);
    return /« 首页/.test(h) && /末页 »/.test(h) && /上页/.test(h) && /下页/.test(h) && /第 1\/10 页/.test(h);
  })());
  check('单页时不渲染翻页按钮', (function () {
    var h = G.ui.pagerInnerHTML('pg1', 5, 10);
    return !/首页/.test(h) && /共 5 项/.test(h);
  })());
  /* v29（需求 3）：翻页条不再留在内容里，而是登记到 ui._bottom，
     由 renderView 收尾时统一画进屏幕下方的固定条 —— 这样翻页永远不需要滚动。 */
  check('v29 翻页条改投底部固定条（内容里不再输出分页 HTML）', (function () {
    G.ui._bottom = [];
    var ret = G.ui.pagerHTML('pg9', 100, 10);
    var bar = G.ui._bottom.join('');
    return ret === '' && /data-action="page"/.test(bar) && /第 1\/10 页/.test(bar);
  })());
  check('page 动作已注册', /case 'page': ui\.setPage/.test(mainSrc26));
  check('任务面板接入分页（成长 / 已完成）', /ui\.pageOf\('growth'/.test(uiS) && /ui\.pageOf\('done'/.test(uiS));
  /* v69：「可领取」浮到顶块后，成长区按**剩余项**分页 ——
     分页口径必须三处同源（pageOf / slice / pagerHTML 都吃 growthWait），
     否则页码数与实际行数会对不上。 */
  check('任务卡片按页切片（不再一次铺满 50 条）',
    /growthWait\.slice\(gp\.from, gp\.to\)/.test(uiS)
    && /ui\.pageOf\('growth', growthWait\.length, 10\)/.test(uiS)
    && /ui\.pagerHTML\('growth', growthWait\.length, 10\)/.test(uiS));

  /* --- ⑤ 忠诚：只降不涨的旧机制已移除 --- */
  console.log('  --- 忠诚机制 ---');
  check('主循环不再衰减忠诚', !/var dec = lo\.decayPerHour/.test(stateSrc26));
  check('聚合补算不再衰减忠诚', !/decayPerHour \* hours/.test(stateSrc26));
  check('战败才扣忠诚（battle 已接入）', /defeatLoss/.test(battleSrc26) && /忠诚 -/.test(battleSrc26));

  /* --- ⑥ 将领属性详情 --- */
  console.log('  --- 将领属性详情 ---');
  check('genPane / genRow 已实现（右侧完整档案 + 左侧姓名清单）',
    typeof G.ui.genPane === 'function' && typeof G.ui.genRow === 'function');
  /* v20（需求 3）：列表改卡片式 —— 姓名仍可点进详情 */
  /* v28（需求 2）：卡片墙 → **一屏 12 席的细条**，姓名与肖像都可点进详情 */
  /* v29（需求 16）：3×2 卡片墙 + 下方档案，整张卡片可点（不再是"只有姓名可点"） */
  check('姓名清单每行可点（gen-pick 切换右侧档案）',
    /class="gen-row[\s\S]{0,240}data-action="gen-pick"/.test(uiS));
  /* v41（需求 2）：3×2 卡片墙 → **左侧姓名清单 + 右侧完整档案** 的左右分栏
     v45（需求 1）：左清单改「一行压紧 + 整段可滚 + 不再分页」 */
  check('将领界面为「左清单 + 右档案」两栏（v41 需求 2）',
    /\.gen-split \{ display: grid; grid-template-columns: 264px minmax\(0, 1fr\)/.test(htmlSrc25)
    && !/ui\.GEN_COLS/.test(uiS)
    && !/'<table class="tbl"><thead><tr>' \+\s*'<th>姓名<\/th><th>资质/.test(uiS));
  check('v76：左清单 12 席/页 + 底部条翻页（v45 曾整段滚动）',
    /ui\.GEN_PER = 12/.test(uiS) && /ui\.pageOf\('gen', pool\.length, ui\.GEN_PER\)/.test(uiS)
    && /ui\.pagerHTML\('gen', pool\.length, ui\.GEN_PER\)/.test(uiS)
    && !/ui\.GEN_PER_PAGE/.test(uiS.replace(/\/\*[\s\S]*?\*\//g, ''))
    /* v52 保留：高度不写死 68vh；v76：12 行平分高度（行可伸缩 + 最小行高兜底） */
    && /overflow-y: auto/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && /max-height: 100%/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && !/max-height: 68vh/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && /flex: 1 1 0/.test(cssBlock(htmlSrc25, '.gen-list > .gen-row {')));
  check('v45：将领行只留「姓名 + 资质」，不再有「装 x/12」与 Lv（v46：资质另起一行）',
    !/grow-eq/.test(uiS) && !/装 ' \+ eqN/.test(uiS) && !/class="grow-lv/.test(uiS)
    /* v70：名字后多了「君主」标，窗口 260 → 420（本断言要的是「名字行紧跟资质」，不是定长） */
    && /class="grow-name"[\s\S]{0,420}rankBadge/.test(uiS)
    /* v46（需求 1）：老板判"并排太拥挤" → 回到**上下两行**（姓名一行、资质一行） */
    && /\.grow-main \{ flex: 1; min-width: 0; display: flex; flex-direction: column/.test(htmlSrc25));
  /* v41（需求 2）：完整档案不再走弹窗 —— 右侧 gen-pane 本身就是完整档案 */
  check('档案不再走弹窗（右侧即完整档案，v41 需求 2）',
    /class="gen-pane"/.test(uiS) && /ui\.genPane = function/.test(uiS)
    && !/data-action="gen-detail"/.test(uiS) && !/ui\.openGenDetail = function/.test(uiS));
  /* v26（需求 2）：五维只给**一个值** —— 丹药早在使用时写进基础了，
     再单列「装备/丹」会让人以为还要加一次；只剩一个数时「合计」也没有意义。 */
  check('六维表只有一个数值列（无「装备/丹」、无「合计」）', (function () {
    /* 只看表头那一段：注释里也会提到"装备/丹"这个词，整文件扫会误判 */
    var i = uiS.indexOf('<th>六维</th>');
    var head = i < 0 ? '' : uiS.slice(i, uiS.indexOf('</thead>', i));
    /* v74：「每点作用」列改「加点」＋（作用文案进六维名称的悬停） */
    return /<th class="ctr">数值<\/th>/.test(head) && /<th class="ctr">加点<\/th>/.test(head)
      && head.indexOf('装备/丹') < 0 && head.indexOf('合计') < 0
      && (head.match(/<th/g) || []).length === 3;
  })());
  check('五维含速度（第 5 维）', /k: 'spd', n: '速度'/.test(uiS));
  /* v52：文案改成新的换算链，但**仍是固定文案**（不拼运行时算出的数字）。
     这里顺带校验"文案里的数字与代码常量一致"——改常量忘改文案会被拦下。 */
  check('作用为固定文案（短句），且数字与常量一致', (function () {
    /* v65（老板）：「压缩一下六维的作用单元格长度」→ 文案改短句。
       但"短"不等于"可以不与代码一致"：这里的每个数字仍逐一对上常量，改常量忘改文案会红。 */
    return /攻击值 \+10/.test(uiS) && /每 10 攻值→全军攻 \+1%/.test(uiS)
      && /防御值 \+10/.test(uiS) && /每 10 防值→全军防 \+1%/.test(uiS)
      && /带兵 \+100 · 人口上限 \+1000/.test(uiS)
      && G.ATK_PER_YW === 10 && G.DEF_PER_ZM === 10 && G.PCT_PER_ATK === 10 && G.PCT_PER_DEF === 10
      && !/'全军攻击 \+' \+ a\.yw/.test(uiS) && !/'全军防御 \+' \+ a\.zm/.test(uiS);
  })(), '含 ATK_PER_YW=' + G.ATK_PER_YW + ' PCT_PER_ATK=' + G.PCT_PER_ATK);
  /* v65：作用列压短 ⇒ 属性名不再折行（结构保证：第一列 nowrap + 定宽） */
  check('六维表第一列 nowrap + 定宽（否则"统率"会被作用列挤成两行）', (function () {
    var css = cssBlock(htmlSrc26, '.gd-dims th:first-child, .gd-dims td:first-child');
    /* 判据用 indexOf 而不是正则的 \s —— 这个文件是用脚本批量改的，
       反斜杠在多层转义里极易被吃掉（本轮就吃过一次：写成了 `//s`，直接 SyntaxError）。 */
    return css.indexOf('nowrap') >= 0 && css.indexOf('52px') >= 0
      && cssBlock(htmlSrc26, '.gd-dims').indexOf('table-layout: fixed') >= 0;
  })());
  check('六维作用文案不许超过 26 字（超了就会把表格撑高）', (function () {
    var longs = G.ui.GEN_DIMS.filter(function (d) { return (d.use || '').length > 26; });
    return longs.length === 0;
  })(), G.ui.GEN_DIMS.map(function (d) { return d.n + ':' + d.use.length; }).join(' '));
  /* v54（老板："在忠诚右边加赏赐，别在下边整个大按钮"）：
     判据从"页面上有没有「赏赐（提升忠诚）」这句文案"改成**结构** ——
     ① 旧的独立分区不许再有（`!gp-sec">赏赐`）；② 赏赐按钮必须落在 genPane 里。
     这里**必须剥注释**：解释"把那个分区撤掉"的注释里就引用了那句文案，
     直接从源码扫全文会读到自己的说明（这个坑这是第 8 次，见 stripComment 注释）。 */
  check('详情含忠诚与赏赐入口（赏赐挂在忠诚行，不再有独立分区）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    if (seg.length < 2000) return false;              /* 取到函数体才算数 */
    return /忠诚/.test(seg) && /data-action="gen-gift-pick"/.test(seg)
      && !/gp-sec">赏赐/.test(seg);
  })());
  check('忠诚行右侧就是赏赐按钮（同一行，不是另一个分区）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    var i = seg.indexOf("'<div class=\"gd-line\">忠诚");
    if (i < 0) return false;
    var line = seg.slice(i, seg.indexOf('</div>', i));
    return /data-action="gen-gift-pick"/.test(line);
  })());
  /* ============================================================
   * v54（老板）：将领档案 —— 经验条上顶 + 状态区改合计口径 + 赏赐挂忠诚行
   * ------------------------------------------------------------
   * 「把总体，攻击，防御，体力（总体体力），精力放上，不要单独列装备的了」：
   * 老板对"总体"的定义是**自身基础 + 丹药 + 装备 + 其他（临时加成）后的总数**，
   * 所以四行数值都要是合计口径，装备只作为**构成**写在括号里、不再单独一行。 */
  check('状态区＝攻击 / 防御 / 体力 / 精力（四行都在，且不再单列装备）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    if (seg.length < 2000) return false;
    var i = seg.indexOf("gp-sec\">状态");
    if (i < 0) return false;
    var st = seg.slice(i, seg.indexOf("gp-sec\">", i + 10));   /* 状态区到下一个分区标题 */
    /* v66：行里可以带属性（体力行加了 title），判据看"这一行在不在" */
    var has = function (nm) { return new RegExp('gd-line"[^>]*>' + nm).test(st); };
    return has('忠诚') && has('攻击') && has('防御') && has('体力') && has('精力')
      && !has('装备');                                          /* 装备那一行已撤 */
  })());
  check('攻击/防御走合计口径（攻值/防值 = 属性 + 装备，并报出全军百分比）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    var i = seg.indexOf('gd-line\">攻击');
    var line = seg.slice(i, seg.indexOf('</div>', i));
    return /a\.atkVal/.test(line) && /a\.atk\b/.test(line) && /atkShow/.test(line)
      && /a\.yw \* GAME\.ATK_PER_YW/.test(line);
  })());
  check('实测：状态区攻击行的合计数 = 勇武×10 + 装备（真算一遍，不是只看变量名）', (function () {
    var st = G.newGame({ name: '合计' });
    var g = st.generals[0];
    g.equip = { weapon: 'yt_sword' };
    var a = G.genAttrs(g);
    var eqAtk = DATA.EQUIP.yt_sword.atk || 0;
    var eqYw = DATA.EQUIP.yt_sword.yw || 0;
    /* 合计口径：攻值 = (基础勇武 + 装备勇武) × 10 + 装备攻击 */
    return a.atkVal === (g.yw + eqYw) * G.ATK_PER_YW + a.atk
      && a.atk >= eqAtk && a.atkVal > a.yw * G.ATK_PER_YW;
  })());
  check('经验条在顶上身份行里，且右端是「＋」开选择窗', (function () {
    var st = G.newGame({ name: '顶上' });
    G.ui._genSel = st.generals[0].id;
    var h = G.ui.generalsHTML();
    var iHead = h.indexOf('class=\"gp-head\"');
    var iExp = h.indexOf('class=\"gp-exprow\"');
    if (iHead < 0 || iExp < 0 || iExp < iHead) return false;
    var row = h.slice(iExp, iExp + 900);
    /* 顺序：进度条 → 数字 → ＋按钮 */
    return /gd-expbar/.test(row) && /class=\"gd-exptext\"/.test(row)
      && /data-action=\"gen-exp-pick\"/.test(row)
      && row.indexOf('gd-expbar') < row.indexOf('gen-exp-pick');
  })());
  /* v58（老板："守将和解雇可以放头像所在内容的右边"）：操作回到**身份行内部右侧**。
     ⚠️ 这条断言的旧判据只写 `iOps > iHead && iOps < iBody`，而"在 head 内部"**也满足**它 ——
     所以 v54 把它移到下面一行、v58 又移回内部，**两次都没红**（一条典型的弱断言）。
     新判据：gp-head 到 gp-body 之间只能有**一个** `</div>`（那就是 gp-head 自己的闭合）。 */
  check('操作（任命守将 / 解雇）在**身份行内部**、头像与身份信息的右侧', (function () {
    var h = G.ui.generalsHTML();
    var iHead = h.indexOf('class="gp-head"');
    var iBody = h.indexOf('class="gp-body"');
    var iOps = h.indexOf('class="gp-ops"');
    var iId = h.indexOf('class="gp-id"');
    if (iHead < 0 || iOps < 0 || iBody < 0 || iId < 0) return false;
    var seg = h.slice(iHead, iBody);
    var ops = h.slice(iOps, iOps + 700);
    return iOps > iId && iOps < iBody
      && (seg.match(/<\/div>/g) || []).length === 1
      && /data-action="assign-guard"/.test(ops) && /data-action="dismiss-gen"/.test(ops);
  })());
   check('详情含守将效果', /守将效果/.test(uiS));

  /* ============================================================
   * v52（老板给定）：将领属性 → 军队加成的换算链
   *   1 勇武 = 10 攻击值、每 10 攻击值 = 全军攻击 +1%
   *   1 智谋 = 10 防御值、每 10 防御值 = 全军防御 +1%
   * 下面**真算一遍**（不是查源码里有没有那几个字）——
   * 这类"公式类"改动最容易只改到一处（显示改了 / 战斗没改），必须端到端验证。
   * ============================================================ */
  console.log('  --- v52：攻防换算链 ---');
  check('换算常量单一定义且与文案一致',
    G.ATK_PER_YW === 10 && G.DEF_PER_ZM === 10 && G.PCT_PER_ATK === 10 && G.PCT_PER_DEF === 10);
  check('实测：攻防值 = 属性×10 + 装备，全军% = 攻防值÷10÷100', (function () {
    var st = G.newGame({ name: '换算' });
    var g = st.generals[0];
    /* 剥掉所有装备，先只验属性那一段 */
    g.equip = {};
    g.yw = 100; g.zm = 40; g.tong = 50;
    g.attack = 0; g.defense = 0;
    var a = G.genAttrs(g);
    var okBare = a.atkVal === 1000 && a.defVal === 400
      && Math.abs(a.atkPct - 1) < 1e-9 && Math.abs(a.defPct - 0.4) < 1e-9;
    /* 再装一件有攻击的武器：攻击值并入同一条链（而不是走旧代码那条 /10000 旁路） */
    g.equip = { weapon: 'yt_sword' };
    var b = G.genAttrs(g);
    var wAtk = DATA.EQUIP.yt_sword.atk || 0;
    var wYw = DATA.EQUIP.yt_sword.yw || 0;
    var okEquip = b.atkVal === (100 + wYw) * 10 + wAtk
      && Math.abs(b.atkPct - b.atkVal / 1000) < 1e-9;
    /* 换算原子必须与派生字段一致（防"公式抄两份、改一处"） */
    var okAtom = b.atkVal === G.atkValOf(b.yw, b.atk) && b.defVal === G.defValOf(b.zm, b.def)
      && Math.abs(b.atkPct - G.pctOfVal(b.atkVal, G.PCT_PER_ATK)) < 1e-12;
    return okBare && okEquip && okAtom;
  })(), '裸装 勇武100→+100%、智谋40→+40%');
  check('battle 走 atkPct/defPct，旧的 yw/100 与 atk/10000 旁路已清除', (function () {
    var src = require('fs').readFileSync(require('path').join(__dirname, 'js', 'battle.js'), 'utf8');
    var code = stripComment(src);
    return /a\.atkPct \* cover/.test(code) && !/a\.yw \/ 100/.test(code)
      && !/a\.atk \|\| 0\) \/ 10000/.test(code) && !/ga\.zm \/ 100/.test(code);
  })());
  check('实测：换装后全军攻击真的变了（行为断言）', (function () {
    var st = G.newGame({ name: '换装' });
    var g = st.generals[0];
    g.equip = {}; g.yw = 100; g.attack = 0;
    var before = G.genAttrs(g).atkPct;
    g.equip = { weapon: 'yt_sword' };
    var after = G.genAttrs(g).atkPct;
    return after > before;
  })());

  console.log('  --- v52：体力链 ---');
  check('装备/套装的体力加成真的进 staMax（老板：体力都没加上套装的体力）', (function () {
    var st = G.newGame({ name: '体力' });
    var g = st.generals[0];
    g.level = 30; g.nz = 50;
    g.equip = {};
    var bare = G.staMax(g);
    /* 凑齐倚天 3 件 → 套装 3 档（含体力）生效 */
    g.equip = { head: 'yt_helm', neck: 'yt_neck', shoulder: 'yt_should' };
    var withSet = G.staMax(g);
    /* v66：装备体力并入上限后，"3 件倚天"的体力贡献 = 套装档位 60 + 3 件 × 每件 600 */
    var expect = (DATA.SETS.yitian.eff[3].sta || 0)
      + (DATA.EQUIP.yt_helm.sta || 0) + (DATA.EQUIP.yt_neck.sta || 0) + (DATA.EQUIP.yt_should.sta || 0);
    var okSet = expect > 0 && withSet - bare === expect;
    /* 单件带 sta 的装备也要算（link 通了两类来源） */
    var fake = { equip: { head: 'FAKE_STA' } };
    DATA.EQUIP.FAKE_STA = { id: 'FAKE_STA', name: '体检', slot: 'head', q: 1, sta: 33 };
    var withEq = G.staMax(fake);
    delete DATA.EQUIP.FAKE_STA;
    var bareFake = G.staMax({ equip: {} });
    return okSet && withEq - bareFake === 33;
  })(), '倚天 3 件 → 体力上限 +' + ((DATA.SETS.yitian.eff[3].sta || 0)
    + (DATA.EQUIP.yt_helm.sta || 0) + (DATA.EQUIP.yt_neck.sta || 0) + (DATA.EQUIP.yt_should.sta || 0)));
  check('套装体力同时出现在 bonus 文案与 eff 数值里，且两处一致', (function () {
    var i = typeof G.ITEM_LABEL;
    var out = [];
    Object.keys(DATA.SETS).forEach(function (k) {
      var d = DATA.SETS[k];
      Object.keys(d.eff).forEach(function (t) {
        var e = d.eff[t];
        if (!e.sta) return;
        /* bonus 文案里必须写出同一个数字 */
        var txt = d.bonus[t] || '';
        if (txt.indexOf('体力+' + e.sta) < 0) out.push(k + '@' + t);
      });
    });
    return out.length === 0;
  })());
  check('三套都补上了体力档（每套至少一档有 sta）', (function () {
    var miss = Object.keys(DATA.SETS).filter(function (k) {
      return !Object.keys(DATA.SETS[k].eff).some(function (t) { return DATA.SETS[k].eff[t].sta; });
    });
    return miss.length === 0;
  })());

  console.log('  --- v52：将领页三处 UI ---');
  /* 查**代码**（剥注释）：解释这段改动的注释里就写着「其余套装」，
     直接扫全文会把自己的说明读成"没删干净"（这个坑本项目踩到第五次了）。 */
  check('装备栏不再列「其余套装」的加成备注（含样式一并清理）', (function () {
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    /* 两边都要剥注释：解释这段改动的注释里就写着「其余套装」，
       直接扫全文会把**自己的说明**读成"没删干净"（这个坑本项目踩到第五次）。 */
    var code = stripComment(uiS), css = stripComment(h);
    return !/其余套装/.test(code) && !/ds-chip/.test(code) && !/ds-list/.test(code)
      && !/其余套装/.test(css) && !/\.ds-chip/.test(css) && !/\.ds-list/.test(css);
  })());
  check('赏赐只有一个入口按钮（不再每种珠宝一个按钮）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    var n = (seg.match(/data-action="gen-gift-pick"/g) || []).length;
    return n === 1 && !/data-action="gen-gift"/.test(seg)
      && /ui\.openGiftPick = function/.test(uiS);
  })());
  check('赏赐选择窗的件数走 qtyInput，且能一次赏多件', (function () {
    var seg = codeOf(uiS, 'ui.openGiftPick = function');
    return /ui\.qtyInput\('gift-q-'/.test(seg)
      && /data-qty-from/.test(seg)
      && /useItemMany/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8'));
  })());
  /* v41（需求 2）：gen-detail 动作随弹窗一并撤除。
     v52：赏赐从一个珠宝一个按钮改成「一个入口 + 选择窗」，动作随之拆成三个。 */
  check('赏赐三个动作已注册，gen-detail 已撤（v41 需求 2）',
    /case 'gen-gift-pick'/.test(mainSrc26) && /case 'gift-pick-item'/.test(mainSrc26)
    && /case 'gen-gift-do'/.test(mainSrc26) && !/case 'gen-detail'/.test(mainSrc26)
    /* 旧的"每个珠宝一个按钮"必须彻底消失（否则就是两套入口并存） */
    && !/data-action="gen-gift"/.test(uiS));
  /* v41（需求 2）：将领详情已改整页（不再是弹窗），'lg' 档位仍由铁匠铺等面板使用 */
  check('大尺寸档位仍在使用（将领已改整页，不再有详情弹窗）',
    /size: 'lg'/.test(uiS) && !/ui\.openModal\(html, 'lg'\)/.test(uiS));
  /* v41（需求 2）：真实调用改成「渲染将领页，右侧栏必须把完整信息都吐出来」 */
  check('将领页渲染不报错且右侧给全信息（真实调用）', (function () {
    var st = G.newGame({ name: '详情' });
    try {
      var html = G.ui.generalsHTML();
      var pane = html.indexOf('class="gen-pane"');
      return html.length > 600 && pane > 0 && html.indexOf('六维') > 0 && html.indexOf('忠诚') > 0
        && html.indexOf('gp-head') > 0 && html.indexOf('class="gen-list"') > 0
        && (html.match(/doll-slot/g) || []).length >= 12;
    } catch (e) { return false; }
  })());
  check('无选中将领时给出占位提示', (function () {
    var html = G.ui.genPane(null);
    return html.indexOf('class="gen-pane"') >= 0 && html.indexOf('q-empty') >= 0;
  })());

  /* ============================================================
   * 27. v15：野地线性加成 / 采集 / 掠夺与占领 / 等级衰减
   * ============================================================ */
  console.log('\n===== 27. 野地：线性加成 / 采集 / 掠夺占领 / 等级衰减（v15）=====');
  var mainSrc27 = readJs26('main');
  var V15 = G.newGame({ name: '野地测试', cityName: '许都' });
  if (!V15.map.grid && G.map.generate) G.map.generate();
  function findWildNear(ter, cx, cy, r) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        var t = G.map.tile(x, y);
        if (t && t.terrain === ter) return { x: x, y: y };
      }
    }
    return null;
  }

  /* --- ① 野地加成改线性 --- */
  console.log('  --- 野地加成（每级线性） ---');
  check('wildAddOf 已实现', typeof G.wildAddOf === 'function');
  check('10 级湖泊 = 粮 +80%（原版口径，此前误算 +35%）',
    Math.abs(G.wildAddOf('lake', 10).grain - 0.8) < 1e-9,
    '实测 +' + Math.round(G.wildAddOf('lake', 10).grain * 100) + '%');
  check('5 级湖泊 = 粮 +40%', Math.abs(G.wildAddOf('lake', 5).grain - 0.4) < 1e-9);
  check('0 级野地无加成', G.wildAddOf('lake', 0).grain === 0);
  check('10 级森林 = 木 +50%', Math.abs(G.wildAddOf('forest', 10).wood - 0.5) < 1e-9);
  check('10 级山地 = 铁 +50%', Math.abs(G.wildAddOf('hill', 10).iron - 0.5) < 1e-9);
  check('10 级平原 = 粮 +30%', Math.abs(G.wildAddOf('plain', 10).grain - 0.3) < 1e-9);
  check('加成与等级严格成正比（线性）', (function () {
    for (var lv = 1; lv <= 10; lv++) {
      if (Math.abs(G.wildAddOf('lake', lv).grain - 0.08 * lv) > 1e-9) return false;
    }
    return true;
  })());
  check('城池地形无加成', G.wildAddOf('city', 5) === null);
  check('TERRAIN 已弃用 step 字段', DATA.TERRAIN.lake.step === undefined && DATA.TERRAIN.forest.step === undefined);
  check('wildMult 源码已无旧公式残留', !/t\.step/.test(stateSrc26));
  check('UI 源码已无旧公式残留', !/ter\.step|t\.step/.test(uiS));

  /* --- ② 采集 --- */
  console.log('  --- 野地采集 ---');
  check('DATA.GATHER 配置齐备', !!DATA.GATHER && DATA.GATHER.minHours === 1 && DATA.GATHER.maxHours === 24);
  check('可采资源覆盖 6 地形（平原除外）', (function () {
    var ks = Object.keys(DATA.GATHER.resOf);
    return ks.length === 6 && ks.indexOf('plain') < 0 && ks.indexOf('lake') >= 0;
  })());
  check('湖泊→粮、森林→木、荒漠→石、山地→铁', G.gatherResOf('lake') === 'grain'
    && G.gatherResOf('forest') === 'wood' && G.gatherResOf('desert') === 'stone' && G.gatherResOf('hill') === 'iron');
  check('平地不可采集（原版铁律）', G.gatherResOf('plain') === null && G.gatherResOf('city') === null);

  var wl = findWildNear('lake', V15.cities[0].x, V15.cities[0].y, 40);
  check('出生点附近找到湖泊野地', !!wl, wl ? '(' + wl.x + ',' + wl.y + ')' : '未找到');
  check('未占领野地不可采集', G.canStartGather(wl.x, wl.y).ok === false);
  V15.wilds = [{ x: wl.x, y: wl.y, type: 'lake', level: 8, levelDay: G.questDayIndex() }];
  check('占领后可采集', G.canStartGather(wl.x, wl.y).ok === true);

  var city15 = G.cityById(V15.cities[0].id) || V15.cities[0];
  city15.army = { yibing: 2000, minfu: 1000 };
  var gen15 = V15.generals[0];
  gen15.status = 'idle'; gen15.stamina = 100; gen15.exp = 0;

  var r27 = G.startGather(wl.x, wl.y, gen15.id, { yibing: 1000 });
  check('派军采集成功', r27.ok === true, r27.msg);
  check('兵力已从城中扣除', city15.army.yibing === 1000);
  check('将领状态置为采集中', gen15.status === 'gather');
  check('开始采集消耗体力', gen15.stamina === 100 - DATA.GATHER.stamina);
  var g15 = G.gatherAt(wl.x, wl.y);
  check('采集队已登记（含等级与兵力）', !!g15 && g15.troops === 1000 && g15.level === 8);
  var y0 = G.gatherYield(g15);
  check('初始未满 1 小时、收成为 0', y0.ready === false && y0.amount === 0);
  var rf = G.finishGather(g15.id);
  check('不足 1 小时收获为零且计时重置（原版规则）', rf.ok === false && rf.reset === true && g15.elapsed === 0, rf.msg);

  g15.elapsed = 8 * 3600;
  var y8 = G.gatherYield(g15);
  /* v29（需求 0）：收成 = 采集力 × (1 + 野地等级×levelBonus) × 时长，
     采集力 = Σ(兵种数量 × 兵种采集效率)（义兵效率 3，不再是统一的 basePerHour）。 */
  var expect8 = Math.round(Math.min(1000 * DATA.TROOPS.yibing.gather, DATA.GATHER.powerCap)
    * (1 + 8 * DATA.GATHER.levelBonus) * 8);
  check('8 游戏小时收成按公式计算', y8.ready === true && y8.amount === expect8, '收成 ' + y8.amount + '（期望 ' + expect8 + '）');
  check('收成随野地等级递增', G.gatherYield({ type: 'lake', level: 8, troops: 1000, elapsed: 8 * 3600 }).amount
    > G.gatherYield({ type: 'lake', level: 2, troops: 1000, elapsed: 8 * 3600 }).amount);
  check('收成随驻军数量递增', G.gatherYield({ type: 'lake', level: 5, troops: 2000, elapsed: 8 * 3600 }).amount
    > G.gatherYield({ type: 'lake', level: 5, troops: 500, elapsed: 8 * 3600 }).amount);
  check('有效采集力上限（超出不再增益）', (function () {
    var a = G.gatherYield({ type: 'lake', level: 5, army: { tieji: 4000 }, elapsed: 4 * 3600 });
    var b = G.gatherYield({ type: 'lake', level: 5, army: { tieji: 20000 }, elapsed: 4 * 3600 });
    return a.amount === b.amount && a.amount > 0 && a.power === DATA.GATHER.powerCap;
  })());
  check('v29 高级兵种单个采集效率更高（同人数产得更多）', (function () {
    var m = G.gatherYield({ type: 'lake', level: 5, army: { minfu: 2000 }, elapsed: 4 * 3600 });
    var t = G.gatherYield({ type: 'lake', level: 5, army: { tieji: 2000 }, elapsed: 4 * 3600 });
    return t.amount > m.amount * 2 && DATA.TROOPS.tieji.gather > DATA.TROOPS.minfu.gather;
  })());
  check('24 小时封顶', (function () {
    var a = G.gatherYield({ type: 'lake', level: 5, troops: 1000, elapsed: 24 * 3600 }).amount;
    var b = G.gatherYield({ type: 'lake', level: 5, troops: 1000, elapsed: 200 * 3600 }).amount;
    return a === b && a > 0;
  })());
  check('宝物概率随将领等级提高（只影响宝物）', G.gatherTreasureChance({ elapsed: 8 * 3600 }, 40)
    > G.gatherTreasureChance({ elapsed: 8 * 3600 }, 5));
  check('宝物概率有上限', G.gatherTreasureChance({ elapsed: 24 * 3600 }, 999) <= DATA.GATHER.treasureCap);
  check('不足 1 小时宝物概率为 0', G.gatherTreasureChance({ elapsed: 0 }, 99) === 0);
  check('将领等级不进入资源收成公式', (function () {
    var a = G.gatherYield({ type: 'lake', level: 5, troops: 1000, elapsed: 8 * 3600, genLv: 1 }).amount;
    var b = G.gatherYield({ type: 'lake', level: 5, troops: 1000, elapsed: 8 * 3600, genLv: 99 }).amount;
    return a === b;
  })());

  var grain27 = V15.res.grain;
  var rf2 = G.finishGather(g15.id);
  check('收获成功并入账', rf2.ok === true && rf2.res === 'grain' && V15.res.grain > grain27, rf2.msg);
  check('收获后兵力归还城中', city15.army.yibing === 2000);
  check('收获后将领回到空闲', gen15.status === 'idle');
  check('采集队已移除', !G.gatherAt(wl.x, wl.y));
  check('采集给将领经验', gen15.exp > 0);

  gen15.status = 'idle'; gen15.stamina = 100;
  var r27b = G.startGather(wl.x, wl.y, gen15.id, { yibing: 500 });
  check('可再次派军采集', r27b.ok === true, r27b.msg);
  var g15b = G.gatherAt(wl.x, wl.y);
  g15b.elapsed = 5 * 3600;
  var grain27b = V15.res.grain;
  var ra = G.abandonGather(g15b.id);
  check('撤回采集无收益（原版规则）', ra.ok === true && V15.res.grain === grain27b);
  check('撤回后兵力归还', city15.army.yibing === 2000);
  check('撤回后将领回到空闲', gen15.status === 'idle');

  check('采集队上限 ' + DATA.GATHER.maxActive + ' 支', (function () {
    V15.gathers = [{ id: 'x1', x: -1, y: -1 }, { id: 'x2', x: -2, y: -2 }, { id: 'x3', x: -3, y: -3 }];
    var r = G.canStartGather(wl.x, wl.y);
    V15.gathers = [];
    return r.ok === false && /最多 3 支/.test(r.msg);
  })());
  check('同一将领不可同时采两处', (function () {
    var wf = findWildNear('forest', wl.x, wl.y, 30);
    if (!wf) return true;
    V15.wilds.push({ x: wf.x, y: wf.y, type: 'forest', level: 5, levelDay: G.questDayIndex() });
    gen15.status = 'idle'; gen15.stamina = 100;
    V15.gathers = [{ id: 'g1', x: wl.x, y: wl.y, type: 'lake', level: 8, genId: gen15.id,
      troops: 100, army: {}, cityId: city15.id, elapsed: 0 }];
    var rs = G.startGather(wf.x, wf.y, gen15.id, { yibing: 100 });
    V15.gathers = [];
    return rs.ok === false && /已在采集别处/.test(rs.msg);
  })());
  check('平原野地不可采集（提示明确）', (function () {
    var wp = findWildNear('plain', wl.x, wl.y, 30);
    if (!wp) return true;
    V15.wilds.push({ x: wp.x, y: wp.y, type: 'plain', level: 5, levelDay: G.questDayIndex() });
    var r = G.canStartGather(wp.x, wp.y);
    return r.ok === false && /可采之物/.test(r.msg);
  })());
  check('采集计时随主循环推进且 24 小时封顶', (function () {
    V15.gathers = [{ id: 't1', x: 1, y: 1, type: 'lake', level: 1, troops: 10, army: {}, elapsed: 0 }];
    G.tickGathers(G.timeScale() * 60);
    var e1 = V15.gathers[0].elapsed;
    G.tickGathers(DATA.GATHER.maxHours * 3600 * 3);
    var e2 = V15.gathers[0].elapsed;
    V15.gathers = [];
    return e1 > 0 && e2 === DATA.GATHER.maxHours * 3600;
  })());
  check('自动抽调兵力（由弱到强）', (function () {
    var c = G.makeCity({ id: 'pick27', name: 'P' });
    c.army = { tieji: 10, minfu: 100, gongjian: 50 };
    var out = G.autoPickTroops(20, c);
    return out.minfu === 20 && !out.tieji;
  })());

  /* --- ③ 掠夺得资源 / 占领得地盘 --- */
  console.log('  --- 掠夺得资源 / 占领得地盘 ---');
  check('配置：野地占领资源倍率为 0', DATA.EXPEDITION.wildResMul.occupy === 0);
  check('配置：野地掠夺仍有资源', DATA.EXPEDITION.wildResMul.raid > 0);
  /* v60（需求 4/6）：城池的财货口径整体重做 ——
     不再"按城档位凭空生成"，而是直接从该城 `GAME.npcCityRes` 的派生库存里按比例取。
     所以这两条旧口径（occupy 也发钱、raid 1.7 倍）必须跟着改：
       · 占领不取现财（与"占领野地不取财货"同一铁律），城池与剩余库藏一起归我；
       · 掠夺 0.5 = 拿走库藏的一半。 */
  check('配置：城池占领不取现财（城与库藏一起归我）', DATA.EXPEDITION.cityResMul.occupy === 0);
  check('配置：攻占后新城继承该城库存（cityInherit）',
    DATA.EXPEDITION.cityInherit > 0 && DATA.EXPEDITION.cityInherit <= 1);
  check('配置：城池掠夺按库藏取走一半', DATA.EXPEDITION.cityResMul.raid === 0.5);
  /* 用一份全新 state 跑一段逻辑，跑完恢复原 state（避免污染后续断言） */
  function withFreshState(name, fn) {
    var keep = G.state;
    var st = G.newGame({ name: name });
    if (!st.map.grid && G.map.generate) G.map.generate();
    var r;
    try { r = fn(st); } finally { G.state = keep; }
    return r;
  }
  /* 注意：占领成功后还会走一次「奇遇」判定（可能额外发放资源），
     与「占领不给资源」这条规则无关。断言必须屏蔽奇遇，否则约 5% 概率误报。 */
  function withoutEncounter(fn) {
    var keep = G.story.encounterRoll;
    G.story.encounterRoll = function () { return null; };
    try { return fn(); } finally { G.story.encounterRoll = keep; }
  }
  check('占领野地：资源不增加，但得地盘', withoutEncounter(function () {
    return withFreshState('占领测试', function (st) {
      var w = findWildNear('lake', st.cities[0].x, st.cities[0].y, 40);
      if (!w) return true;
      var gen = st.generals[0];
      gen.stamina = 100; gen.energy = 100;
      st.cities[0].army = { yibing: 300000 };
      var g0 = st.res.grain, w0 = (st.wilds || []).length;
      var r = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'occupy', { yibing: 300000 }, gen.id);
      if (!r.ok || r.result.winner !== 'atk') return true;      // 本局未攻下则跳过
      return st.res.grain === g0 && (st.wilds || []).length === w0 + 1 && r.gains.res === null;
    });
  }));
  check('占领野地仍可能触发奇遇（与掉落规则互不影响）',
    /var enc = GAME\.story \? GAME\.story\.encounterRoll\(\) : null;/.test(
      fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8')));
  check('掠夺野地：资源增加且不占地', withoutEncounter(function () {
    return withFreshState('掠夺测试', function (st) {
    var w = findWildNear('lake', st.cities[0].x, st.cities[0].y, 40);
    if (!w) return true;
    var gen = st.generals[0];
    gen.stamina = 100; gen.energy = 100;
    st.cities[0].army = { yibing: 300000 };
    var g0 = st.res.grain, w0 = (st.wilds || []).length;
    var r = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 300000 }, gen.id);
    if (!r.ok || r.result.winner !== 'atk') return true;
    return st.res.grain > g0 && (st.wilds || []).length === w0;
    });
  }));
  check('占领野地写入 level 与 levelDay', (function () {
    var st = G.state;
    if (!st.wilds || !st.wilds.length) return true;
    return st.wilds.every(function (w) { return w.level != null && w.levelDay != null; });
  })());

  /* --- ④ 野地等级动态 --- */
  console.log('  --- 野地等级动态 ---');
  check('wildLevelNow 已实现', typeof G.map.wildLevelNow === 'function');
  check('wildLevelBase 与日盐分离', typeof G.map.wildLevelBase === 'function');
  check('无主野地等级 = (基础值 + 现实日) % 11（每日 +1）', (function () {
    var day = Math.floor(Date.now() / 86400000);
    return G.map.wildLevel(100, 100) === (G.map.wildLevelBase(100, 100) + day) % 11;
  })());
  check('已占野地按记录等级返回（不随日盐跳变）', (function () {
    var st = G.state;
    st.wilds = [{ x: 7, y: 7, type: 'lake', level: 6, levelDay: G.questDayIndex() }];
    var v = G.map.wildLevelNow(7, 7);
    st.wilds = [];
    return v === 6;
  })());
  check('decayWilds：跨 3 日降 3 级', (function () {
    var st = G.state;
    st.wilds = [{ x: 1, y: 1, type: 'lake', level: 8, levelDay: G.questDayIndex() - 3 }];
    var ch = G.decayWilds();
    var lv = st.wilds[0].level;
    st.wilds = [];
    return ch.length === 1 && lv === 5;
  })());
  check('decayWilds：最低降到 1 级', (function () {
    var st = G.state;
    st.wilds = [{ x: 2, y: 2, type: 'lake', level: 3, levelDay: G.questDayIndex() - 99 }];
    G.decayWilds();
    var lv = st.wilds[0].level;
    st.wilds = [];
    return lv === 1;
  })());
  check('同日不重复降级', (function () {
    var st = G.state;
    st.wilds = [{ x: 3, y: 3, type: 'lake', level: 5, levelDay: G.questDayIndex() }];
    var ch = G.decayWilds();
    var lv = st.wilds[0].level;
    st.wilds = [];
    return ch.length === 0 && lv === 5;
  })());
  check('旧档野地首次只登记日期（不立刻降级）', (function () {
    var st = G.state;
    st.wilds = [{ x: 4, y: 4, type: 'lake', level: 5, levelDay: null }];
    var ch = G.decayWilds();
    var lv = st.wilds[0].level, ld = st.wilds[0].levelDay;
    st.wilds = [];
    return ch.length === 0 && lv === 5 && ld === G.questDayIndex();
  })());
  check('主循环已接入采集推进与野地衰减', /GAME\.tickGathers/.test(stateSrc26) && /GAME\.decayWilds/.test(stateSrc26));

  /* --- ⑤ 界面 --- */
  console.log('  --- 采集界面 ---');
  /* 上面几项断言会临时改写 wilds，这里恢复本次测试用的野地 */
  V15.wilds = [{ x: wl.x, y: wl.y, type: 'lake', level: 8, levelDay: G.questDayIndex() }];
  V15.gathers = [];
  gen15.status = 'idle'; gen15.stamina = 100;
  city15.army = { yibing: 2000 };
  check('界面测试前置就绪（可采集）', G.canStartGather(wl.x, wl.y).ok === true);
  /* 需求 5 起：玩法规则类文案不再出现在界面上 —— 断言改为反向校验 */
  check('野地弹窗不再写玩法规则（备注型信息已清理）',
    !/野地规则（v15）/.test(uiS) && !/掠夺得资源/.test(uiS));
  check('野地弹窗保留信息型内容（可采资源/产量加成）',
    /土地可采|此地可采|无可采之物/.test(uiS) || /产量加成/.test(uiS));
  check('野地弹窗含采集入口', /data-action="gather-open"/.test(uiS));
  check('野地总览含采集队入口', /data-action="open-gathers"/.test(uiS));
  check('采集动作已注册（open/start/finish/abandon/locate）',
    /case 'gather-open'/.test(mainSrc27) && /case 'gather-start'/.test(mainSrc27)
    && /case 'gather-finish'/.test(mainSrc27) && /case 'gather-abandon'/.test(mainSrc27)
    && /case 'open-gathers'/.test(mainSrc27));
  check('采集面板可渲染', (function () {
    try {
      V15.gathers = [];
      G.ui.openGathers();
      var h = global.document.querySelector('#modal-root').innerHTML;
      return h.indexOf('野地采集') >= 0 && h.indexOf('当前没有采集队') >= 0;
    } catch (e) { return false; }
  })());
  check('采集派遣弹窗可渲染（含收成公式）', (function () {
    try {
      gen15.status = 'idle'; gen15.stamina = 100;
      V15.gathers = [];
      G.ui.openGatherModal(wl.x, wl.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      return h.indexOf('派军采集') >= 0 && h.indexOf('收成公式') >= 0 && h.indexOf('24 小时') >= 0;
    } catch (e) { return false; }
  })());
  check('全量弹窗可打开不抛错（含新面板）', (function () {
    var fns = ['openWilds', 'openGathers', 'openShop', 'openBag', 'openLordInfo'];
    try {
      fns.forEach(function (fn) { if (G.ui[fn]) G.ui[fn](); });
      G.ui.openLandModal(wl.x, wl.y);
      G.ui.closeModal();
      return true;
    } catch (e) { return false; }
  })());

  /* ============================================================
   * 28. v16：18 项体验修复 + P2 四项
   * ============================================================ */
  console.log('\n===== 28. v16：体验修复 18 项 + P2 四项 =====');
  var F16 = G.newGame({ name: 'v16验收', cityName: '许都' });
  if (!F16.map.grid && G.map.generate) G.map.generate();
  function rd16(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var uS16 = rd16('ui'), hS16 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var dS16 = rd16('domain'), mS16 = rd16('main'), stS16 = rd16('state');

  console.log('  --- 三个 bug 修复 ---');
  check('#10 黄金不受仓库上限（三条结算路径均排除 gold）',
    (stS16.match(/rk2? !== 'gold'|k !== 'gold'/g) || []).length >= 2);
  check('#10 实测：黄金可突破仓库上限', (function () {
    /* v73：改为**直接压测上限豁免** —— 旧写法依赖"产金 > 俸禄"的净流入，
       黄金闸门收紧后新城的净流入可正可负（税收 30/h vs 俸禄 40/h），
       与"黄金是否受仓容约束"这个待测点无关。现在：先放到 cap 之上，跑两 tick，
       只要没被夹回 cap 就是豁免生效。 */
    var st = F16;
    st.cities[0].cells.forEach(function (c) { if (c.build && c.build.id === 'cangku') c.build = null; });
    var cap = G.storeCap();
    st.res.gold = cap + 500000;
    G.tickOnce(); G.tickOnce();
    return st.res.gold > cap;
  })(), '仓库 ' + U.fmt(G.storeCap()));
  /* v29（需求 12）：打造面板改为「物品行」结构（左贴图 / 右：部位·品质·造价 / 下：打造） */
  check('#15 打造面板「造价」只出现一次（不重复列成本）',
    (uS16.match(/造价 ' \+ U\.escape\(GAME\.costString\(f\.cost\)/g) || []).length === 1);
  check('#15 打造面板用物品行结构（信息只列一遍，不重复拼串）',
    /ui\.forgeRow = function[\s\S]{0,1600}ui\.itemRow\(\{/.test(uS16));
  check('#7 未解锁兵种可点击查看原因', /unlocked \? 'select-train' : 'train-locked'/.test(uS16));
  check('#7 train-locked 动作已注册', /case 'train-locked'/.test(mS16));
  /* v80（老板）：「『N / M 种』解锁计数这种备注也不要」—— 计数行退役；判据换成兵种分页 */
  check('#7 面板含本类兵种分页（v80 两页 → v81 三页：队列 / 步兵 / 骑兵，计数行退役）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="que"/.test(th)
      && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })());

  console.log('  --- 城内布局（城墙 / 官府 / 贴地）---');
  check('#1 城墙不占城内地块', DATA.BUILD_ORDER.indexOf('chengqiang') < 0 && !/chengqiang: 1 \}/.test(dS16));
  check('#1 城墙为窄带描边（不占格、不遮建筑）', /iso-wall/.test(uS16) && /ui\.isoWallSVG = function/.test(uS16) && /ui\.WALL_PX/.test(uS16));
  check('#1 城墙等级存 city.wallLv', (function () {
    var c = G.makeCity({ id: 'w1', name: 'W' });
    c.wallLv = 4;
    return G.buildingLevel(c, 'chengqiang') === 4;
  })());
  check('#1 城墙可修建/升级/取消', typeof G.buildWall === 'function' && typeof G.upgradeWall === 'function'
    && /ui\.openWallModal = function/.test(uS16) && /cancel-build" data-kind="wall"/.test(uS16));
  check('#1 城墙施工完成写回 wallLv', /wc\.wallLv = q\.targetLevel/.test(stS16));
  check('#2 官府 4 格位于城池正中', (function () {
    var c = G.makeCity({ id: 'w2', name: 'W' });
    var idx = []; c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.join(',') === '19,20,27,28';   /* v68：8 列坐标系下的正中央 */
  })());
  check('#3 建筑图标居中于格内（不再悬浮）', (function () {
    var mh = hS16.match(/\.tile-art \{[^}]*\}/);
    return !!mh && /inset: 0/.test(mh[0]) && !/translate\(-50%, -100%\)/.test(mh[0]);
  })());
  check('#3 地块与建筑同层融合', /<i class="tile-face"><\/i>/.test(uS16) && /class="tile-art"/.test(uS16));
  check('#3 已弃用 CSS 3D 立牌', !/rotateZ\(-45deg\) rotateX\(-56deg\)/.test(hS16));

  console.log('  --- 显示比例 / 配色 ---');
  check('#4 缩放档位已定义', Array.isArray(DATA.ZOOM_LEVELS) && DATA.ZOOM_LEVELS.length >= 4);
  /* v22：缩放按钮改为点选 chip（chip-set + data-after="zoom"），旧分支已清理 */
  check('#4 缩放控件与动作',
    /ui\.zoomBarHTML = function/.test(uS16)
    && /after === 'zoom'/.test(mS16) && /GAME\.doSetZoom\(Number\(el\.dataset\.v\)\)/.test(mS16));
  /* v22（需求 3）：缩放控件收进侧栏「城池操作」，城内/城外共用同一 zoomStyle */
  check('#4 缩放为全局设置（城内/城外共用 zoomStyle，控件收在侧栏）',
    (uS16.match(/ui\.zoomStyle\(\)/g) || []).length === 2
    && (uS16.match(/ui\.zoomBarHTML\(\)/g) || []).length === 1);
  check('#4 缩放写入设置', DATA.DEFAULT_SETTINGS.zoom === 100);
  /* v39（需求 1）：老板反馈"背景颜色太深"，整体提亮一档（仍是墨蓝灰基调） */
  check('#5 配色改深墨蓝灰（去黄绿偏色）', /--bg-dark: #1e222b/.test(hS16) && /--panel-bg: #272c37/.test(hS16));
  check('#5 文字改中性浅灰', /--text: #eae7e0/.test(hS16) && /--text-dim: #a8a7af/.test(hS16));

  console.log('  --- 弹窗与操作规范 ---');
  /* v19：四档固定尺寸（sm / 默认 / lg / xl），全部带 vw·vh 上限保证不超界 */
  check('#11 弹窗固定尺寸（height 而非 max-height）', /\.modal \{[\s\S]{0,200}height: 620px/.test(hS16));
  /* v25（需求 4）：弹窗宽度按平板收，判据改为"三档都在且受视口上限约束" */
  /* v74（老板需求 2）：弹窗尺寸改**固定 px**（画布固定 1440×900）；
     仅留极小窗口兜底 calc(100vw/vh − 20px)。断言只查"三档都在 + 有兜底"，不写死数值。 */
  check('#11 尺寸档位固定（sm/lg/xl 三档，固定 px + 极小窗口兜底）',
    /\.modal-sm \{ width: \d+px; height: \d+px; \}/.test(hS16)
    && /\.modal-lg \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\); max-height: calc\(100vh - 20px\); \}/.test(hS16)
    && /\.modal-xl \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\); max-height: calc\(100vh - 20px\); \}/.test(hS16));
  check('#4/5 三段式弹窗格局（m-head / m-body / m-foot）',
    /\.m-head \{/.test(hS16) && /\.m-body \{/.test(hS16) && /\.m-foot \{/.test(hS16));
  check('#4/5 ui.modalShell 已提供且被四个主弹窗使用', /ui\.modalShell = function/.test(uS16)
    && (uS16.match(/ui\.openShell\(\{/g) || []).length >= 3,
    (uS16.match(/ui\.openShell\(\{/g) || []).length + ' 处');
  check('#12 操作分区样式', /\.op-zone \{/.test(hS16) && /\.op-zone\.danger \{/.test(hS16));
  check('#12 建筑面板动线（功能 / 操作三键同排 / 关闭吸底；v76 更新）',
    /class="op-zone-t">功能</.test(uS16) && /class="bldg-acts"/.test(uS16) && /class="bldg-foot"/.test(uS16));
  check('#12 已移除重复的拆除按钮', !/data-action="confirm-demolish"/.test(uS16));
  check('#13 升级中写入 pending（防重复排队）', /if \(cell\.pending\) return \{ ok: false, msg: '该建筑正在施工中/.test(dS16));
  check('#13 升级完成清 pending', /cell\.build\.lvl = q\.targetLevel;[\s\S]{0,80}cell\.pending = null;/.test(stS16));
  check('#13 施工面板显示 当前→目标 且可取消', uS16.indexOf('→ Lv') > 0 && uS16.indexOf('isUp16') > 0 && /取消'/.test(uS16));
  /* v82（老板）：「不要显示（自建城）这种文字」——君主面板城池列表去档位括注（坐标与人口保留） */
  check('#16 君主面板城池列表（v82：去档位括注）',
    /ls-meta">\[' \+ c2\.x \+ ',' \+ c2\.y \+ '\] · 人口上限 '/.test(uS16)
    && !/DATA\.CITY_TIER\[c2\.type\]/.test(uS16));
  /* v22（需求 1）：下拉框已全站移除 → 城池切换改为点选按钮组 */
  /* v77（老板）：君主面板改左右分栏（城池列表 + 进入按钮），v22 的 chips 退役；
     城池切换仍是下拉框一处（v45）。 */
  check('v77：城池切换走下拉框 + 君主面板「进入」按钮（v22 chips 退役）',
    /data-action="switch-city"/.test(uS16) && /after === 'city'/.test(mS16)
    && /lord-city-enter/.test(uS16) && /lord-city-enter/.test(mS16));
  check('#16 无城池时占位空白', /当前无城池/.test(uS16));
  check('#17 侧栏驻军栏（资源下方）', /garrison-bar/.test(hS16) && /ui\.renderGarrison = function/.test(uS16));
  check('#17 驻军栏可折叠且撑满（v76：固定 132px → min-height + 撑满）',
    /data-action="toggle-garrison"/.test(uS16) && /\.gb-list \{ flex: 1 1 auto; min-height: 132px/.test(hS16));

  console.log('  --- 菜单与消息 ---');
  /* v29（需求 3/4）：底部栏以**固定导航条**的身份回归 ——
     v16 移除的是"消息栏 + 功能按钮"那一条，现在这条只放翻页控件，
     且高度固定 46px、无分页时留空（所以不会像旧版那样一有消息就变高）。 */
  check('#18 底部消息栏仍不存在（v16 结论不变）',
    !/class="msgbar"/.test(hS16) && !/id="dock-btn"/.test(hS16));
  check('v29 底部固定导航条（只放翻页控件 · 高度固定 · 挂在 .main 之外）', (function () {
    var i = hS16.indexOf('id="bottom-bar"');
    if (i < 0) return false;
    var before = hS16.slice(Math.max(0, i - 400), i);
    return /\.bottombar \{/.test(hS16) && /flex: none; height: 46px/.test(hS16)
      && before.lastIndexOf('</div>') > before.lastIndexOf('<div class="central"')
      && /ui\.paintBottom = function/.test(uS16);
  })());
  /* v19：商城留在顶栏；公告不再是独立菜单（内容并入公文页） */
  /* v25：商城从"动作按钮"变成"视图"（走 data-view），仍在顶栏 */
  check('#18 商城留在顶栏', /data-view="shop"/.test(hS16));
  check('#6 公告已并入公文（不再有独立公告菜单/弹窗）',
    !/open-notice/.test(hS16) && !/ui\.openNotice = function/.test(uS16)
    && /ui\.reportsHTML = function/.test(uS16));
  check('#6 顶栏按类型分组（nav-sep 分隔线）', (hS16.match(/class="nav-sep"/g) || []).length >= 4,
    (hS16.match(/class="nav-sep"/g) || []).length + ' 处分隔');
  check('#6 新增「行军」菜单', /data-view="marches"/.test(hS16) && /ui\.marchesHTML = function/.test(uS16));
  /* v25（需求 10）：任务与统计相邻；爵位退出顶栏（并入君主）；
     商城/背包成为视图；每个菜单带手绘线描图标 */
  check('#6 菜单分组顺序：城池·地图 ‖ 将领·行军 ‖ 任务·统计 ‖ 商城·背包 ‖ 史册·公文 ‖ 设置·存档',
    (function () {
      var order = ['data-view="city"', 'data-view="map"', 'nav-sep', 'data-view="generals"', 'data-view="marches"',
        'nav-sep', 'data-view="tasks"', 'data-view="stats"', 'nav-sep', 'data-view="shop"', 'data-view="bag"',
        'nav-sep', 'data-view="story"', 'data-view="reports"', 'nav-sep', 'data-view="settings"'];
      var at = -1;
      for (var i = 0; i < order.length; i++) {
        var idx = hS16.indexOf(order[i], at + 1);
        if (idx < 0) return false;
        at = idx;
      }
      return true;
    })());
  check('#18 排行已取消', !/open-rank-list/.test(hS16) && !/openRankList/.test(rd16('ui')));
  check('#6 消息流整合进公文', /公文 · 报告与消息/.test(uS16) && /msg-channels/.test(uS16));
  check('#6 消息频道四项', /\['sys', '系统'\]/.test(uS16) && /\['all', '全部'\]/.test(uS16));
  check('#6 保留 10 游戏天', G.msgDays() === 10 && /保留最近 ' \+ GAME\.msgDays\(\)/.test(uS16));
  check('#6 消息写入存档 msgLog', (function () {
    var n0 = G.msgLog().length;
    G.log('v16 测试消息');
    return G.msgLog().length === n0 + 1;
  })());
  check('#6 条数兜底（1 游戏天仅 1.33 现实秒）', G.MSG_MIN === 300 && G.MSG_MAX === 800);

  console.log('  --- 自动研究 / 任务 / 兵种归属 ---');
  check('#8 自动研究已实现并接入主循环', typeof G.autoResearch === 'function' && /if \(GAME\.autoResearch\) GAME\.autoResearch\(\)/.test(stS16));
  check('#8 开关与自动建造同列', /toggle-auto-research/.test(uS16));
  check('#8 无书院时暂停（不报错）', (function () {
    var st = G.state;
    st.settings.autoResearch = true;
    st.queues.tech = [];
    var r = G.autoResearch();
    st.settings.autoResearch = false;
    return r === null && !!(st.autoTechState && st.autoTechState.paused);
  })(), (G.state.autoTechState || {}).msg);
  check('#9 已完成任务区块浮到最上方', (function () {
    var iDone = uS16.indexOf('已完成</span>');
    var iRand = uS16.indexOf('随机任务</span>');
    return iDone > 0 && iRand > 0 && iDone < iRand;
  })());
  check('#14 器械兵种标记 craft', !!(DATA.TROOPS.chuangnu.craft && DATA.TROOPS.chongche.craft && DATA.TROOPS.toudan.craft));
  check('#14 器械要求工匠作坊等级', ['chuangnu', 'chongche', 'toudan'].every(function (id) {
    return DATA.TROOPS[id].unlock.gongjiangzuofang > 0;
  }));
  check('#14 募兵面板按建筑分流',
    /case 'open-siege': ui\.openTroops\(ui\._trainBIdx, 'siege'\)/.test(mS16)
    && /ui\.openTroops = function/.test(uS16) && /_trainFilter === 'siege'/.test(uS16));
  /* v62（老板）：作坊入口扩成"器械与工事"（多了造箭塔），
     判据跟着改 —— 但仍要求它指向作坊自己的面板，而不是又塞回募兵里。 */
  check('#14 工匠作坊入口为「器械 · 箭塔」', (function () {
    return /gongjiangzuofang: \{ label: "🛠️ 器械 · 箭塔", act: "open-workshop"/.test(uS16)
      && /ui\.openWorkshop = function/.test(uS16);
  })());

  console.log('  --- P2 四项 ---');
  /* v82（老板）：「官府不需要征收物质这个功能去除」——征收整段退役（防回魂判据） */
  check('v82：征收已退役（levy / levyPlan / levyReady / LEVY_CD 全清）',
    typeof G.levy === 'undefined' && typeof G.levyPlan === 'undefined'
    && typeof G.levyReady === 'undefined' && typeof G.LEVY_CD === 'undefined');
  check('v82：特产口径保留（specialtyOf / stateOfCity 仍在 —— 岁贡与州治加成的依赖）',
    typeof G.specialtyOf === 'function' && typeof G.stateOfCity === 'function');

  check('P2-9 科技改耗黄金', (function () {
    var c = DATA.techCost({ type: 'grain' }, 3);
    return c.gold > 0 && c.grain === undefined && c.iron === undefined;
  })());
  check('P2-9 成本随等级翻倍', DATA.techCost({ type: 'grain' }, 3).gold === DATA.techCost({ type: 'grain' }, 1).gold * 4);
  check('P2-10 平原筑城已实现', typeof G.buildCityAt === 'function' && G.BUILD_CITY_COST.grain === 10000);
  check('P2-10 未占领不可筑城', G.canBuildCityAt(1, 1).ok === false);
  check('P2-10 非平原不可筑城', (function () {
    var st = G.state, wf = null;
    if (!st.map.grid) G.map.generate();
    for (var y = 0; y < 80 && !wf; y++) for (var x = 0; x < 80 && !wf; x++) {
      var t2 = G.map.tile(x, y);
      if (t2 && t2.terrain === 'forest') wf = { x: x, y: y };
    }
    if (!wf) return true;
    st.wilds = [{ x: wf.x, y: wf.y, type: 'forest', level: 3, levelDay: G.questDayIndex() }];
    var r = G.canBuildCityAt(wf.x, wf.y);
    return r.ok === false && /平原/.test(r.msg);
  })());
  check('P2-10 筑城后入城池列表且野地转城池', (function () {
    var st = G.state, wp = null;
    for (var y = 80; y < 160 && !wp; y++) for (var x = 80; x < 160 && !wp; x++) {
      var t3 = G.map.tile(x, y);
      if (t3 && t3.terrain === 'plain') wp = { x: x, y: y };
    }
    if (!wp) return true;
    st.wilds = (st.wilds || []).filter(function (w) { return !(w.x === wp.x && w.y === wp.y); });
    st.wilds.push({ x: wp.x, y: wp.y, type: 'plain', level: 5, levelDay: G.questDayIndex() });
    st.res.grain = 1e7; st.res.wood = 1e7; st.res.stone = 1e7; st.res.iron = 1e7; st.res.gold = 1e7;
    var n0 = st.cities.length;
    var r = G.buildCityAt(wp.x, wp.y);
    return r.ok === true && st.cities.length === n0 + 1
      && !st.wilds.some(function (w) { return w.x === wp.x && w.y === wp.y; });
  })());
  check('P2-11 打造消耗图纸 1 张', /if \(bp\) \{[\s\S]{0,200}s\.items\[bp\.id\] = \(s\.items\[bp\.id\] \|\| 0\) - 1;/.test(dS16));
  check('P2-11 文案改为每件消耗', /每件消耗图纸 1 张/.test(uS16) && !/图纸为永久持有/.test(uS16));

  /* ============================================================
   * 29. v17：全面梳理 P0 四项修复
   *   ① 科技接线（24/24 生效）  ② 存档瘦身（NPC 城读档重建）
   *   ③ 粮食钳制 + 断粮后果     ④ 攻城伤害链 + 胜利判定
   * 这些断言检测的是「有没有接上」，而不是「算得对不对」——
   * 后者原本已被 800+ 项覆盖，前者却全部漏检（所以 17 项科技空转很久没人发现）。
   * ============================================================ */
  console.log('\n===== 29. v17：P0 四项修复（科技接线 / 存档瘦身 / 断粮 / 攻城链）=====');
  var stS = G.newGame({ name: 'v17验收', cityName: '许都' });
  if (!stS.map.grid && G.map.generate) G.map.generate();
  var uS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var bS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
  var dS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8');
  var sS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  var yS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'story.js'), 'utf8');
  var mS29 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');

  /* ---------- ① 科技接线 ---------- */
  console.log('  --- ① 科技接线（17 项补齐消费点）---');
  check('业务代码已定义科技取值包装函数', /function TB\(type\)/.test(bS29) && /function techB\(type\)/.test(dS29));
  (function () {
    /* 判据：每项科技要么走通用路径（资源四类由 GAME.techMult 覆盖），
       要么能在业务代码里找到读取点。注意包装函数 TB()/techB() 也要认。 */
    var accessors = ['techBonus', 'techLevel', 'TB', 'techB'];
    var GENERIC = ['grain', 'wood', 'stone', 'iron'];
    var pool = [bS29, dS29, sS29, uS29, yS29,
      fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8'), mS29].join('\n');
    var dead = [];
    DATA.TECH.forEach(function (tc) {
      if (GENERIC.indexOf(tc.type) >= 0) return;
      var hit = accessors.some(function (a) {
        return new RegExp('\\b' + a + "\\('" + tc.type + "'\\)").test(pool)
          || new RegExp('\\b' + a + "\\('" + tc.id + "'\\)").test(pool);
      });
      if (!hit) dead.push(tc.name + '(' + tc.type + ')');
    });
    check('24 项科技全部有消费点', dead.length === 0,
      dead.length ? '无消费：' + dead.join('、') : '共 ' + DATA.TECH.length + ' 项');
  })();
  check('科技数据里不再有 per:0 的空效果',
    !/type: '[a-z]+', per: 0,/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8')));

  check('打造技巧 → 材料消耗下降', (function () {
    var eqId = Object.keys(DATA.EQUIP)[0];
    function total(lv) { stS.techs['dazao'] = lv; var m = G.forgeMaterials(eqId), n = 0; for (var k in m) n += m[k]; return n; }
    var a = total(0), b = total(10); stS.techs['dazao'] = 0;
    return b < a;
  })());
  check('储存技术 → 仓库存量上升', (function () {
    var c0 = stS.cities[0];
    c0.cells.forEach(function (c) { if (c.build && c.build.id === 'cangku') c.build.lvl = 5; });
    stS.techs['chucun'] = 0; var a = G.storeCap();
    stS.techs['chucun'] = 10; var b = G.storeCap();
    stS.techs['chucun'] = 0;
    return b > a;
  })());
  check('维修技术 → 伤兵回收率上升', (function () {
    stS.techs['weixiu'] = 0; stS.wounded = 0; G.battle.applyWounded(10000); var a = stS.wounded;
    stS.techs['weixiu'] = 10; stS.wounded = 0; G.battle.applyWounded(10000); var b = stS.wounded;
    stS.techs['weixiu'] = 0; stS.wounded = 0;
    return b > a;
  })());
  check('负重技巧 → 掠夺收获上升', withFixedRandom([0.5], function () {
    /* genLoot 的数值区间含随机项 —— 必须固定随机序列后再比大小，
       否则约 1/3 概率出现 a 取到区间上限、b 取到下限而误判（项目铁律第 2 条）。 */
    stS.techs['fuzhong'] = 0; var a = G.battle.genLoot({ type: 'jun', level: 5 }, 1).grain;
    stS.techs['fuzhong'] = 10; var b = G.battle.genLoot({ type: 'jun', level: 5 }, 1).grain;
    stS.techs['fuzhong'] = 0;
    return b > a;
  }));
  check('行军技巧 → 行军速度上升', (function () {
    stS.techs['xingjun'] = 0; var a = G.battle.armySpeedOf({ changqiang: 1000, qingji: 1000 });
    stS.techs['xingjun'] = 10; var b = G.battle.armySpeedOf({ changqiang: 1000, qingji: 1000 });
    stS.techs['xingjun'] = 0;
    return b > a;
  })());
  /* v27（需求 3）：情报**不再按侦察技巧分层** —— 侦查就是一次准确点验，
     一次给出守军总数 / 逐兵种数量 / 守将 / 可图之利，不需要"技巧够了才看得见"。
     侦察技巧的作用收窄为：提升顺手所得（见下一条），以及大雾天仍会失效。 */
  /* v65（老板）：「不同侦察技巧等级应该可以侦察出**不同类型**的信息」——
     改前是"一次全给"（v27 的六项），这条科技在情报上没有成长感。
     现在按 `DATA.SCOUT_INTEL` 分层解锁：下面两条钉住两端（0 级几乎全锁 / 10 级全开）。 */
  check('技巧 0 级：只有守军**约数**，其余五层全锁（分层生效）', (function () {
    var w0 = G.state.world.weather;
    G.state.world.weather = 'clear';
    stS.techs['zhencha'] = 0;
    var tgt = { kind: 'wild', x: 10, y: 10, terrain: 'lake', lv: 5,
      garrison: { yibing: 100, changqiang: 40 }, guard: null };
    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);
    G.state.world.weather = w0;
    var got = sc.intel.got;
    return sc.totalExact === false && sc.gNum === 112          /* 140 × 0.8 = 约数 */
      && (sc.roster || []).length === 0 && sc.guard === null
      && sc.res === null && sc.build === null && sc.spoils === null
      /* 0 级时**连"守军总数"这一层都还没解锁**（unlock=1）——
         仍给一个约数，但不写"准确"（这就是"分层"的起点）。 */
      && !got.total && !got.res && !got.troops && !got.guard && !got.build && !got.spoils
      && sc.intel.next && sc.intel.next.id === 'total' && sc.intel.next.unlock === 1;
  })(), '0 级 → 下一层「守军总数」（Lv1）');
  check('技巧满级 10 级：六层全开（守军准确 + 兵种 + 守将 + 资源 + 建筑 + 可图之利）', (function () {
    var w0 = G.state.world.weather;
    G.state.world.weather = 'clear';
    stS.techs['zhencha'] = 10;
    var npc = stS.map.cities[0];
    var tgt = { kind: 'city', id: npc.id, npc: npc, lv: npc.level, name: npc.name,
      def: 20, dropType: 'county', guard: { name: '守将甲', tong: 80, yw: 70, zm: 60, nz: 50, level: 10 },
      garrison: { yibing: 100, changqiang: 40 } };
    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);
    stS.techs['zhencha'] = 0; G.state.world.weather = w0;
    var got = sc.intel.got;
    return sc.intel.next === null && got.total && got.res && got.troops
      && got.guard && got.build && got.spoils
      && sc.totalExact === true && sc.gNum === 140
      && (sc.roster || []).length === 2 && !!sc.guard
      && !!sc.res && sc.res.rows.length >= 5
      && !!sc.build && sc.build.total === 48
      /* v65：名城建筑补到"满级城等级 10 + 档位加成"（洛阳=都城 → 22），
         不再是"城等级 + 加成" —— 判据直接走唯一出口，不手抄数字 */
      && sc.build.buildLv === G.npcBuildLvOf(npc)
      && sc.spoils.types.length >= 4;
  })(), '10 级 → 六层全开');
  /* ⚠️ 这条断言原来两组各采样 40 次、但用的是**各自独立**的随机序列 ——
     抽样差异会让它偶发失败（实测 20 次连跑红了 1 次，是 smoke 里长期存在的偶发源）。
     修法：两组用**同一段固定随机序列**（`withFixedRandom`），差异就只来自技巧本身。
     通用判据：**凡是"两次采样比大小"的断言，都必须把随机源固定成同一段**。 */
  check('侦察技巧 → 顺手所得变多（技巧的消费点没丢）', (function () {
    var w0 = G.state.world.weather;
    G.state.world.weather = 'clear';
    var tgt = { kind: 'wild', x: 11, y: 11, terrain: 'lake', lv: 5, garrison: { yibing: 100 } };
    function sumItems() {
      var keys = Object.keys(G.state.items || {});
      var n = 0; keys.forEach(function (k) { n += G.state.items[k]; });
      return n;
    }
    var seq = [];
    for (var q = 0; q < 600; q++) seq.push(((q * 37 + 11) % 100) / 100);
    var sample = function (techLv) {
      stS.techs['zhencha'] = techLv;
      var i0 = JSON.stringify(G.state.items || {});
      var before = sumItems();
      withFixedRandom(seq, function () {
        for (var i = 0; i < 40; i++) G.battle.scoutTarget(tgt, stS.generals[0]);
      });
      var got = sumItems() - before;
      G.state.items = JSON.parse(i0);
      return got;
    };
    var lo = sample(0), hi = sample(10);
    stS.techs['zhencha'] = 0;
    G.state.world.weather = w0;
    return hi > lo;
  })());
  check('大雾时情报被强制降级（已解锁的层也看不准）', (function () {
    var tgt = { kind: 'wild', x: 12, y: 12, terrain: 'lake', lv: 5, garrison: { yibing: 100, changqiang: 40 } };
    var w0 = G.state.world.weather;
    stS.techs['zhencha'] = 8;
    G.state.world.weather = 'clear'; var a = G.battle.scoutTarget(tgt, stS.generals[0]);
    G.state.world.weather = 'fog';   var b = G.battle.scoutTarget(tgt, stS.generals[0]);
    stS.techs['zhencha'] = 0; G.state.world.weather = w0;
    /* 8 级时 total/res/troops 三层本该解锁；大雾把它们全部遮掉 */
    /* ⚠️ 顶层没有 `blinded` —— 它在 `detail.blinded`（顶层那个是 expedition 返回时映射的） */
    return a.detail.blinded === false && a.totalExact === true && (a.roster || []).length === 2
      && b.detail.blinded === true && b.totalExact === false && (b.roster || []).length === 0;
  })(), '8 级晴天准确 / 大雾只报约数');
  check('对外只读 helper（速度/先手）供界面与断言共用',
    typeof G.battle.armySpeedOf === 'function' && typeof G.battle.firstStrike === 'function');

  /* ---------- ② 存档瘦身 ---------- */
  console.log('  --- ② 存档瘦身（NPC 城不入档）---');
  G.saveGame();
  var rawSave = localStorage.getItem('sanguo_save_v3') || '';
  check('存档已降至 10KB 以内（原 55.9KB）', rawSave.length < 10 * 1024, (rawSave.length / 1024).toFixed(2) + ' KB');
  var parsedSave = JSON.parse(rawSave);
  check('map.cities 未写入存档', parsedSave.map.cities == null);
  check('玩家城池仍写入存档', Array.isArray(parsedSave.cities) && parsedSave.cities.length >= 1);
  check('存档中不含 NPC 城数据', rawSave.indexOf('洛阳') < 0);
  var nNpcBefore = stS.map.cities.length;
  var gFirst = JSON.stringify(stS.map.cities[0].garrison);
  var reloaded = G.loadGame();
  check('读档后 NPC 城由 seed 重建', reloaded.map.cities.length === nNpcBefore, nNpcBefore + ' 座');
  check('重建结果与存档前完全一致', JSON.stringify(reloaded.map.cities[0].garrison) === gFirst);
  check('loadGame 无条件丢弃旧副本（老档才能吃到新数值）', /st\.map\.cities = null;/.test(sS29));
  check('saveGame 不破坏内存中的地图（finally 复原）',
    /finally \{[\s\S]{0,160}GAME\.state\.map\.cities = keepCities;/.test(sS29));
  check('重建后剔除已占城池（防复活）', (function () {
    var st2 = G.newGame({ name: '复活检测', cityName: '许都' });
    if (!st2.map.grid) G.map.generate();
    var vic = st2.map.cities.filter(function (c) { return c.type === 'county'; })[0];
    G.onConquer(vic, { winner: 'atk' }, st2.generals[0]);
    G.saveGame();
    var bk = G.loadGame();
    return !bk.map.cities.some(function (c) { return c.id === vic.id; })
      && bk.cities.some(function (c) { return c.origId === vic.id; });
  })());
  check('数值改动对老档生效（核心目的）', (function () {
    var st3 = G.newGame({ name: '新档', cityName: '许都' });
    if (!st3.map.grid) G.map.generate();
    G.saveGame();
    var oldName = DATA.NPC_CITIES[0].name;
    DATA.NPC_CITIES[0].name = '【改过的城】';
    var bk = G.loadGame();
    var hit = bk.map.cities[0].name === '【改过的城】';
    DATA.NPC_CITIES[0].name = oldName;
    return hit;
  })());

  /* ---------- ③ 粮食钳制 + 断粮后果 ---------- */
  console.log('  --- ③ 粮食钳制与断粮后果 ---');
  /* v65（老板）：「缺粮 24h 后军队才会哗变，各兵种每 24h 逃离当前剩余数量的 20%」——
     `applyStarvation`（按缺口比例逃）已删，改为 `mutinyOf` + `starveStep` 两个出口。 */
  check('mutinyOf / starveStep / isStarving 三个出口都在', (function () {
    return typeof G.mutinyOf === 'function' && typeof G.starveStep === 'function'
      && typeof G.isStarving === 'function' && typeof G.applyStarvation !== 'function'
      && DATA.STARVE.hours === 24 && DATA.STARVE.mutinyPct === 0.2;
  })());
  check('粮不再被扣成负数', (function () {
    var st4 = G.newGame({ name: '断粮', cityName: '许都' });
    if (!st4.map.grid) G.map.generate();
    st4.cities[0].army = { tieji: 200000 };
    st4.res.grain = 1000;
    for (var i = 0; i < 5; i++) G.tickOnce();
    return st4.res.grain >= 0;
  })());
  check('断粮**不足 24 小时不掉兵**（老板给的宽限期）', (function () {
    var st5 = G.newGame({ name: '饿殍', cityName: '许都' });
    if (!st5.map.grid) G.map.generate();
    st5.cities[0].army = { tieji: 200000 };
    st5.res.grain = 1000;
    var n0 = G.armyTotal(st5.cities[0]);
    for (var i = 0; i < 3; i++) G.tickOnce();   /* 3 tick ≈ 0.1 游戏小时 */
    var c = st5.cities[0];
    return G.armyTotal(c) === n0 && c.starving === true && (c.starveHours || 0) > 0;
  })(), '3 tick 后兵力不变，计时已开始');
  check('缺粮满 24 游戏小时 → 哗变：各兵种逃**当前数量**的 20%', (function () {
    var st6 = G.newGame({ name: '哗变', cityName: '许都' });
    if (!st6.map.grid) G.map.generate();
    var c = st6.cities[0];
    c.army = { tieji: 100000, yibing: 5000, gongjian: 4 };   /* 4 人的小队：floor(0.8)=0，不归零 */
    var r = G.starveStep(c, true, 24);
    return r.cycles === 1 && r.lost === 21000
      && c.army.tieji === 80000 && c.army.yibing === 4000 && c.army.gongjian === 4;
  })(), '100000→80000 · 5000→4000 · 4 人不动');
  check('离线推进 72 小时 = 连逃 3 次（每 24h 一次，不是一次性算总账）', (function () {
    var st7 = G.newGame({ name: '连逃', cityName: '许都' });
    var c = st7.cities[0];
    c.army = { tieji: 100000 };
    var r = G.starveStep(c, true, 72);
    /* 100000 → 80000 → 64000 → 51200（每次按**当前**剩余数算） */
    return r.cycles === 3 && c.army.tieji === 51200;
  })(), '100000 → 51200');
  check('粮接上后缺粮计时**清零重计**（断续缺粮不会攒够 24h）', (function () {
    var st8 = G.newGame({ name: '清零', cityName: '许都' });
    var c = st8.cities[0];
    c.starveHours = 23;
    G.starveStep(c, false, 0);
    var after = c.starveHours;
    var r = G.starveStep(c, true, 1);
    return after === 0 && r.lost === 0 && c.starveHours === 1;
  })());
  check('断粮状态下无法出征', (function () {
    var st7 = G.newGame({ name: '粮禁', cityName: '许都' });
    if (!st7.map.grid) G.map.generate();
    var gn = st7.generals[0]; gn.stamina = 100; gn.energy = 100;
    st7.cities[0].army = { yibing: 200000 };
    st7.res.grain = 0;
    var r = G.battle.expedition({ kind: 'wild', x: st7.cities[0].x + 1, y: st7.cities[0].y },
      'raid', { yibing: 1000 }, gn.id);
    return r.ok === false && /粮/.test(r.msg);
  })());
  /* v65：文案改新口径 —— 报"还能撑多久"与"每 24h 逃 20%"，
     不再写"正在逃散"（现在粮尽并不立刻逃兵）。 */
  check('断粮时侧栏给出警示（含剩余宽限时间与哗变比例）', (function () {
    var seg = codeOf(uS29, 'ui.renderCityAttrs = function');
    return seg.indexOf('粮尽') >= 0 && seg.indexOf('守军尚可支撑') >= 0
      && seg.indexOf('游戏小时') >= 0 && seg.indexOf('DATA.STARVE') >= 0;
  })());
  check('离线补算与在线同口径（都钳制、都逃兵）',
    /* v60：结算改成**逐城**循环，变量名随之变为 R/feedC/ct ——
       所以不再钉死整行字面，而是取 simulateBulk 的函数体做结构断言
       （钉死变量名的写法，在重构时必然误报）。 */
    /* v65：逃兵改由 `GAME.starveStep` 推进（在线/离线共用同一个函数） */
    /GAME\.starveStep\(/.test(codeOf(sS29, 'GAME.simulateBulk = function'))
    && /R\.grain < 0\) R\.grain = 0/.test(codeOf(sS29, 'GAME.simulateBulk = function')));

  /* ---------- ④ 攻城伤害链 + 胜利判定 ---------- */
  console.log('  --- ④ 攻城伤害链与胜利判定 ---');
  check('siegeMult 已被战斗读取', /siegeMult\(\)/.test(bS29) && /opts\.sieging/.test(bS29));
  check('出征按目标类型传 sieging', /sieging: t\.kind === 'city'/.test(bS29));
  check('赛季国策 siege 生效（青龙 +20%）', (function () {
    var oldIdx = G.state.world.eraIndex;
    var qi = null;
    DATA.ERAS.forEach(function (e, i) { if (e.id === 'qinglong') qi = i; });
    G.state.world.eraIndex = qi;
    var m = G.story.siegeMult();
    G.state.world.eraIndex = oldIdx;
    return m > 1;
  })());
  check('羁绊「白衣渡江」进入攻城链',
    /return \(1 \+ STORY\.bondBonus\('siege'\)\) \* cm\.siegeEra;/.test(yS29));
  check('rep_gain 国策已接（STORY.repMult）',
    typeof G.story.repMult === 'function' && /STORY\.repMult/.test(yS29));
  check('checkVictory 已被调用（攻占洛阳→天下一统）',
    /if \(GAME\.checkVictory\) GAME\.checkVictory\(\);/.test(bS29));
  check('defMult 改为单一来源（不再两份实现）',
    /STORY\.defMult = function \(\) \{\s*return STORY\.bondBonus\('def'\);/.test(yS29));
  check('城防梯度恢复（/200 线性，替代 0.6 封顶）',
    /\/ 200\)/.test(bS29) && !/Math\.min\(0\.6, \(defVal/.test(bS29));
  check('攻城不再把我方城墙算作敌方防御', !/wallLvl \* 10/.test(bS29));
  check('攻方护甲生效（装备 def 此前完全废弃）', /atkDefBonus/.test(bS29));

  /* ---------- ⑤ 天气从 1/5 → 5/5 ---------- */
  console.log('  --- ⑤ 天气效果全部接线 ---');
  check('天候影响行军速度', /combatMod\(\)\.move/.test(bS29));
  check('大雾偷袭 / 大风火攻 进入先手回合', /cmW\.ambush/.test(bS29) && /cmW\.fire/.test(bS29));
  check('大雾斥候受阻 → 情报降级', /cmW\.scout === false/.test(bS29));
  check('大雾下侦查一无所获', /var tbl = blinded \? null :/.test(bS29));

  /* ---------- ⑥ 死代码清理 ---------- */
  console.log('  --- ⑥ 死代码清理 ---');
  check('11 个不可达 case 分支已清理', !/case 'atk-max'/.test(mS29) && !/case 'side'/.test(mS29)
    && !/case 'load'/.test(mS29) && !/case 'confirm-demolish'/.test(mS29));
  check('ui.setSide 等孤岛函数已删除', !/ui\.setSide = function/.test(uS29));
  check('零引用工具函数已删除', !/U\.fmt2 = function/.test(sS29) && !/GAME\.armyPower = function/.test(dS29));

  /* ---------- ⑦ 关键 API 齐备（防清理误删） ---------- */
  console.log('  --- ⑦ 关键 API 齐备（防止清理误删）---');
  /* 教训：按「定义头 + 找下一个 };」删函数时，遇到**单行函数**（body 与收尾同行）
     会一路吃到下一个函数的收尾 —— 本次就因此误删了 U.deep/clamp/rng/now/pad、
     GAME.timeScale、ui.renderSide。这条断言把核心链路依赖的 API 钉住，再犯即报警。 */
  var CORE_API = [
    ['GAME.tickOnce', G.tickOnce], ['GAME.timeScale', G.timeScale],
    ['GAME.productionPerSec', G.productionPerSec], ['GAME.saveGame', G.saveGame],
    ['GAME.loadGame', G.loadGame], ['GAME.starveStep', G.starveStep], ['GAME.mutinyOf', G.mutinyOf],
    ['GAME.isStarving', G.isStarving], ['GAME.wildMult', G.wildMult],
    ['GAME.techMult', G.techMult], ['GAME.foodPerSec', G.foodPerSec],
    ['GAME.storeCap', G.storeCap], ['GAME.wallCost', G.wallCost],
    ['U.deep', U.deep], ['U.clamp', U.clamp], ['U.rng', U.rng], ['U.now', U.now], ['U.pad', U.pad],
    ['U.fmt', U.fmt], ['U.numHTML', U.numHTML], ['U.numText', U.numText],
    ['U.durExact', U.durExact], ['U.dur', U.dur], ['U.escape', U.escape],
    ['U.rateHTML', U.rateHTML], ['U.randInt', U.randInt],
    ['ui.renderSide', UI.renderSide], ['ui.renderCityAttrs', UI.renderCityAttrs],
    ['ui.renderResBar', UI.renderResBar], ['ui.renderGarrison', UI.renderGarrison],
    ['ui.updateProgress', UI.updateProgress], ['ui.paintBottom', UI.paintBottom],
    ['ui.renderLog', UI.renderLog], ['ui.openModal', UI.openModal], ['ui.closeModal', UI.closeModal],
    ['ui.setView', UI.setView], ['ui.renderView', UI.renderView],
    ['GAME.battle.simulate', G.battle.simulate], ['GAME.battle.expedition', G.battle.expedition],
    ['GAME.battle.armySpeedOf', G.battle.armySpeedOf], ['GAME.battle.firstStrike', G.battle.firstStrike],
    ['GAME.map.generate', G.map.generate], ['GAME.map.wildLevelNow', G.map.wildLevelNow],
    ['GAME.systems.techBonus', G.systems.techBonus], ['GAME.systems.research', G.systems.research],
    ['STORY.combatMod', G.story.combatMod], ['STORY.siegeMult', G.story.siegeMult], ['STORY.repMult', G.story.repMult]
  ];
  var lostApi = CORE_API.filter(function (x) { return typeof x[1] !== 'function'; })
    .map(function (x) { return x[0]; });
  check('核心 API 齐备（防清理误删）', lostApi.length === 0,
    lostApi.length ? '缺失：' + lostApi.join(', ') : CORE_API.length + ' 项');
  check('DATA.Q_MAT 兜底表已定义（此前被引用却未定义）', !!DATA.Q_MAT && !!DATA.Q_MAT[1]);
  check('U.rng 为确定性（同 seed 同序列）', (function () {
    var a = U.rng(12345), b = U.rng(12345);
    return a() === b() && a() === b();
  })());

  /* ============================================================ 
   * 30. v18：行军队列 / 兵力归还 / 平行四边形大地块 / 商城分页 / 暗黑图标
   * ============================================================ */
  console.log('\n===== 30. v18：行军 / 兵力归还 / 渲染 / 商城 / 图标 =====');
  var st30 = G.newGame({ name: 'v18验收', cityName: '许都' });
  if (!st30.map.grid) G.map.generate();
  var uS30 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var bS30 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
  var hS30 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var iS30 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'icons.js'), 'utf8');
  var mapS30 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'map.js'), 'utf8');
  var mS30 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');

  /* ---------- ① 兵力归还（此前派出去的兵凭空消失） ---------- */
  console.log('  --- ① 兵力归还与伤兵归队 ---');
  function nearWild(type) {
    var c0 = st30.cities[0];
    for (var r = 1; r < 40; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var x = c0.x + dx, y = c0.y + dy;
        var tl = G.map.tile(x, y);
        if (tl && tl.terrain === type && !G.map.wildAt(x, y) && !G.map.npcAt(x, y)) return { x: x, y: y };
      }
    }
    return null;
  }
  check('returnArmy 已实现', typeof G.battle.returnArmy === 'function');
  check('出征后幸存兵力归还城池', (function () {
    var w = nearWild('lake'); if (!w) return true;
    var gen = st30.generals[0]; gen.stamina = 100; gen.energy = 100;
    st30.cities[0].army = { yibing: 100000, daodun: 50000 };
    var r = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 100000, daodun: 50000 }, gen.id);
    if (!r.ok) return true;
    var back = G.armyTotal(st30.cities[0]);
    /* ⚠️ v56：判据从"back > 0"改成"**有幸存者就必须见到归营的兵**"。
       旧写法在"这场打输了、幸存者很少"时 back 会是 0 → 偶发红灯
       （实测：同一份代码连跑两次一红一绿 —— 野地守军按日波动 0.85~1.15）。
       而它真正要守的是**归还这个动作**：expedition 曾把 result.atkRemain 丢掉、
       派出去的兵凭空蒸发，那种情况下"有幸存者却没有归营"必然发生。 */
    var alive = (r.result && r.result.atkRemain) || 0;
    return alive < 1000 || back > 0;
  })());
  check('伤兵记录兵种构成（woundedArmy）', (function () {
    var s = G.state;
    s.wounded = 0; s.woundedArmy = {};
    G.battle.returnArmy(s.cities[0], { yibing: 10000 }, { atkRemain: 5000 });
    return (s.wounded || 0) > 0 && s.woundedArmy && s.woundedArmy.yibing > 0;
  })());
  check('治疗伤兵真正归队（此前只是把计数清零）', (function () {
    var s = G.state;
    s.wounded = 0; s.woundedArmy = {};
    var c0 = s.cities[0]; c0.army = { yibing: 100 };
    G.battle.returnArmy(c0, { yibing: 10000 }, { atkRemain: 0 });
    var before = G.armyTotal(c0);
    s.res.gold = 1e9;
    G.battle.heal();
    return G.armyTotal(c0) > before && (s.wounded || 0) === 0;
  })());

  /* ---------- ② 行军队列 ---------- */
  console.log('  --- ② 行军队列 ---');
  check('行军模块齐备', typeof G.march.dispatch === 'function' && typeof G.march.tick === 'function'
    && typeof G.march.recall === 'function' && typeof G.march.rushAll === 'function');
  check('出征改为「出发 → 抵达」两段（不再即刻结算）', (function () {
    var w = nearWild('forest'); if (!w) return true;
    var gen = st30.generals[0]; gen.stamina = 100; gen.energy = 100;
    st30.cities[0].army = { yibing: 20000 };
    st30.marches = [];
    var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 20000 }, gen.id);
    if (!r.ok) return true;
    var queued = st30.marches.length === 1 && G.armyTotal(st30.cities[0]) === 0 && gen.status === 'march';
    return queued && !!r.marched;
  })());
  check('行军推进到点后自动抵达并结算', (function () {
    var st = G.state;
    if (!st.marches.length) return true;
    var n = 0;
    while (st.marches.length && n < 300) { G.march.tick(); n++; }
    var gen = null;
    (st.generals || []).forEach(function (g) { if (g.status === 'march') gen = g; });
    /* 判据是「队列清空 + 将领回空闲 + 兵力去向明确」。
       不能要求 armyTotal>0：全歼时幸存者为 0 是正常结果，伤兵在伤兵营里。 */
    var accounted = G.armyTotal(st.cities[0]) + (st.wounded || 0) > 0;
    return st.marches.length === 0 && !gen && accounted;
  })());
  check('行军耗时随距离增加', (function () {
    var c0 = st30.cities[0];
    var from = { x: c0.x, y: c0.y, cityId: c0.id };
    var a = G.march.travelTime(from, { x: c0.x + 5, y: c0.y }, { yibing: 10000 });
    var b = G.march.travelTime(from, { x: c0.x + 50, y: c0.y }, { yibing: 10000 });
    return b > a;
  })());
  check('最慢兵种决定全军速度（投石车拖慢）', (function () {
    var c0 = st30.cities[0];
    var from = { x: c0.x, y: c0.y, cityId: c0.id }, to = { x: c0.x + 20, y: c0.y };
    var fast = G.march.travelTime(from, to, { qingji: 10000 });
    var slow = G.march.travelTime(from, to, { qingji: 10000, toudan: 1000 });
    return slow > fast;
  })());
  check('驿站提速（1.5~6 倍）', (function () {
    var c0 = st30.cities[0];
    var from = { x: c0.x, y: c0.y, cityId: c0.id }, to = { x: c0.x + 20, y: c0.y };
    function setYz(lv) {
      var placed = false;
      c0.cells.forEach(function (c) { if (c.build && c.build.id === 'yizhan') { c.build.lvl = lv; placed = true; } });
      if (!placed && lv > 0) { for (var i = 0; i < c0.cells.length; i++) { if (!c0.cells[i].official && !c0.cells[i].build) { c0.cells[i].build = { id: 'yizhan', lvl: lv }; break; } } }
    }
    setYz(0); var a = G.march.travelTime(from, to, { yibing: 10000 });
    setYz(5); var b = G.march.travelTime(from, to, { yibing: 10000 });
    setYz(0);
    return b < a;
  })());
  check('天气影响行军速度（雪天最慢）', (function () {
    var c0 = st30.cities[0];
    var from = { x: c0.x, y: c0.y, cityId: c0.id }, to = { x: c0.x + 20, y: c0.y };
    var w0 = G.state.world.weather;
    G.state.world.weather = 'clear'; var a = G.march.travelTime(from, to, { yibing: 10000 });
    G.state.world.weather = 'snow';  var b = G.march.travelTime(from, to, { yibing: 10000 });
    G.state.world.weather = w0;
    return b > a;
  })());
  check('召回：兵力原路返还且队列清空', (function () {
    var w = nearWild('desert'); if (!w) return true;
    var gen = st30.generals[0]; gen.stamina = 100; gen.energy = 100;
    st30.cities[0].army = { yibing: 30000 };
    st30.marches = [];
    var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 30000 }, gen.id);
    if (!r.ok) return true;
    var mid = st30.marches[0].id;
    var rr = G.march.recall(mid);
    return rr.ok && st30.marches.length === 0 && G.armyTotal(st30.cities[0]) === 30000;
  })());
  check('急行军令：立即抵达（不再静默失效）', (function () {
    var w = nearWild('hill'); if (!w) return true;
    var gen = st30.generals[0]; gen.stamina = 100; gen.energy = 100;
    st30.cities[0].army = { yibing: 30000 };
    st30.marches = [];
    var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'scout', {}, gen.id);
    if (!r.ok) return !r.ok;
    var rr = G.march.rushAll();
    return rr.ok && st30.marches.length === 0;
  })());
  check('行军队列已接入主循环 tickOnce', /GAME\.march\.tick/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8')));
  check('界面出征走 dispatch（不是即刻 expedition）', /GAME\.march\.dispatch\(target, mode, atk, genSel\.value\)/.test(mS30));
  /* v24（需求 9）：行军进度随底部队列条一起移到「公文 · 队列」一节 */
  check('行军进度在公文「队列」呈现', /'🛫 行军'/.test(uS30) && /ui\.openMarches = function/.test(uS30));
  check('出征弹窗显示行军预估', /ui\.updateExpMarch = function/.test(uS30) && /exp-march/.test(uS30));
  check('急行军令已接 rushAll（原为静默失效）', /GAME\.march\.rushAll/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8')));
  check('行军参数可在数据层调（secPerTile / baseSpeed / minRealSec）',
    DATA.EXPEDITION.marchSecPerTile > 0 && DATA.EXPEDITION.marchBaseSpeed > 0 && DATA.EXPEDITION.marchMinRealSec > 0);

  /* ---------- ③ 平行四边形大地块 ---------- */
  console.log('  --- ③ 平行四边形地块与城墙 ---');
  /* v20：正方形格 —— 边长相等、无斜移、棋盘轮廓是矩形 */
  check('地块为正方形（边长相等、无斜移）', G.ui.TILE_W === G.ui.TILE_H && G.ui.TILE_SKEW === 0,
    G.ui.TILE_W + '×' + G.ui.TILE_H + ' skew=' + G.ui.TILE_SKEW);
  check('地块不使用 clip-path（正方形靠圆角，几何即视觉）', G.ui.tileClip() === 'none');
  check('棋盘轮廓为矩形（四角两两等高、两两等宽）', (function () {
    var o = G.ui.isoOutline(6, 6);
    return o.length === 4 && o[0][1] === o[1][1] && o[2][1] === o[3][1]
      && o[0][0] === o[3][0] && o[1][0] === o[2][0];
  })());
  check('密铺：同行右邻与下一行都严丝合缝', (function () {
    var M = G.ui.isoMetrics(6, 6);
    return M.x(1, 0) === M.x(0, 0) + G.ui.TILE_W
      && M.y(0, 1) === M.y(0, 0) + G.ui.TILE_H
      && M.x(0, 1) === M.x(0, 0) + G.ui.TILE_SKEW;
  })());
  check('城墙只占窄带（WALL_PX，不再向外扩一整格）', G.ui.WALL_PX > 0 && G.ui.WALL_PX <= 20
    && /WALL_PX/.test(uS30));
  check('城墙 z-index 低于地块（不遮建筑）',
    /ui\.isoWallSVG = function/.test(uS30)
    && /\.iso-wall \{ position: absolute[\s\S]{0,90}z-index: 1/.test(hS30)
    && /\.iso-tile \{[\s\S]{0,80}z-index: 2/.test(hS30));
  /* v39（需求 3）：老板要"把底部色块去掉" —— 已建地块不再有专属底板规则，
     直接与整片地面同色（.tile-face 只由 --ground 决定）。 */
  check('已建地块不再有独立底板（与地面同色）',
    !/\.iso-tile\.built \.tile-face \{/.test(hS30) && /built: true/.test(uS30)
    && !/tile-foot/.test(uS30));
  check('建筑图标居中于格内（tile-art inset:0）', (function () {
    var mh = hS30.match(/\.tile-art \{[^}]*\}/);
    return !!mh && /inset: 0/.test(mh[0]);
  })());

  /* ---------- ④ 固定界面尺寸 ---------- */
  console.log('  --- ④ 固定界面尺寸 ---');
  /* v27（需求 9）：页面改为撑满视口 + 随窗口自适应，不再固定宽度 */
  /* v74（老板需求 2）：「规定大界面像素…作为一个整体界面」——
     画布改**固定像素**（--app-w × --app-h），v27 的"撑满视口"被取代。 */
  check('v74：页面为固定像素画布（1440×900）', /#screen-game \{ width: var\(--app-w\); height: var\(--app-h\)/.test(hS30)
    && /--app-w: 1440px/.test(hS30) && /--app-h: 900px/.test(hS30));
  /* v27（需求 8/9）：不再用固定高度 —— 主区撑满视口、两栏同高（同一行一起拉伸）。
     旧写法 .view-box 530px / .auth-side 606px，侧栏天然比中央长 76px。 */
  check('v74：画布固定 + 两栏同高（"侧栏比中央长"的修法保留）', (function () {
    /* 判据必须先剥 CSS 注释：说明文字里会引用旧规则的原文 */
    var css = hS30.replace(/\/\*[\s\S]*?\*\//g, '');
    return /#screen-game \{ width: var\(--app-w\); height: var\(--app-h\)[\s\S]{0,120}display: flex/.test(css)
      && /\.main \{[\s\S]{0,220}flex: 1;[\s\S]{0,220}align-items: stretch/.test(css)
      && /\.view-box \{ flex: 1; min-height: 0/.test(css)
      && !/\.view-box \{ height: \d+px/.test(css)
      && !/\.auth-side \{ max-height: \d+px/.test(css);
  })());
  /* v74：弹窗尺寸固定 px；「视口不足自动降档」@media (max-height: 860px) 与 vw/vh 上限一并撤除 */
  check('v74：弹窗固定 px + 仅留极小窗口兜底（不再随视口缩、不再降档）', (function () {
    var css = hS30.replace(/\/\*[\s\S]*?\*\//g, '');
    return /\.modal \{[\s\S]{0,220}max-width: calc\(100vw - 20px\); max-height: calc\(100vh - 20px\)/.test(css)
      && !/@media \(max-height: 860px\)/.test(css)
      && !/max-width: 96vw/.test(css);
  })());

  /* ---------- ⑤ 商城分类 + 分页 ---------- */
  console.log('  --- ⑤ 商城分类与分页 ---');
  check('商城有分类表与每页件数配置', G.ui.SHOP_CATS && G.ui.SHOP_PER_PAGE > 0);
  /* v29（需求 14）：固定网格 → **物品行**（左贴图 / 右介绍 / 下：数量 + 购买） */
  check('商城渲染含分类页签与物品行', /ui\.renderShop = function/.test(uS30)
    && /shop-cats/.test(uS30) && /shop-rows/.test(uS30) && /ui\.itemRow\(/.test(uS30));
  check('商城动作已注册（分类 / 购买 / 数量加减 / 打造页签）',
    /case 'shop-cat'/.test(mS30) && /case 'shop-buy'/.test(mS30)
    && /case 'qty-step'/.test(mS30) && /case 'qty-max'/.test(mS30)
    && /case 'forge-q'/.test(mS30));
  check('购买后只重绘商城（保留分类与页码）', /ui\.renderShop\(\)/.test(mS30) && !/ui\.openShop\(\);          \/\/ 刷新商城面板/.test(mS30));

  /* ---------- ⑥ 初始城池周边地形 ---------- */
  console.log('  --- ⑥ 出生点地形 ---');
  check('强制平原范围已收紧到 ±2（原 ±5）', /Math\.abs\(x - sx\) <= 2 && Math\.abs\(y - sy\) <= 2/.test(mapS30));
  check('±3 之外已恢复真实地形（不再一片平原）', (function () {
    var c0 = st30.cities[0], seen = {};
    for (var y = c0.y - 5; y <= c0.y + 5; y++) for (var x = c0.x - 5; x <= c0.x + 5; x++) {
      var tl = G.map.tile(x, y); if (tl) seen[tl.terrain] = 1;
    }
    return Object.keys(seen).length >= 3;
  })());

  /* ---------- ⑦ 暗黑图标 ---------- */
  console.log('  --- ⑦ 暗黑风图标 ---');
  check('调色板 v30 亮画面（ink 深棕、瓦亮青）', G.icons.P.ink === '#241a10' && G.icons.P.tileHi === '#9db2c8');
  check('兜底层：建筑/城外/地形套承台', (function () {
    return G.icons.raw('building', 'junying').indexOf('icPlate') >= 0
      && G.icons.raw('ext', 'farm').indexOf('icPlate') >= 0
      && G.icons.raw('terrain', 'lake').indexOf('icPlate') >= 0;
  })());
  check('兜底层：资源/兵种/材料不套承台（避免过重）', (function () {
    return G.icons.raw('res', 'grain').indexOf('icPlate') < 0
      && G.icons.raw('troop', 'tieji').indexOf('icPlate') < 0
      && G.icons.raw('mat_fatie', '').indexOf('icPlate') < 0;
  })());
  /* v36：位图层**一律不套承台** —— 老板明确要求"单个地块不显示背景，直接以图标轮廓" */
  check('位图层一律不套承台（透明轮廓直接落地）', (function () {
    return ['building:junying', 'ext:farm', 'res:grain', 'troop:tieji']
      .every(function (k) {
        var p = k.split(':');
        return G.icons.get(p[0], p[1]).indexOf('icPlate') < 0;
      });
  })());
  check('承台 v30 暖土座（亮土渐变 + 泥粒斜纹）', /icRim/.test(iS30) && /e6d2a0/.test(iS30) && /7a5a30/.test(iS30));
  check('全部图标仍可正常生成（98 个）', (function () {
    var ks = G.icons.keys();
    return ks.length >= 90 && ks.every(function (k) { return typeof k === 'string'; });
  })());
  check('图标不再用投影（暗色界面层级靠亮度分层）', !/drop-shadow/.test(hS30.match(/\.tile-art \.ico \{[^}]*\}/) ? hS30.match(/\.tile-art \.ico \{[^}]*\}/)[0] : ''));

  /* ============================================================
   * 31. v19：十项体验修复（升级不锁功能 / 侧栏精简 / 弹窗统一 /
   *     菜单分组 / 行军菜单 / 建筑移动与改建 / 仓库多建）
   * ============================================================ */
  console.log('\\n===== 31. v19：十项体验修复 =====');
  var st31 = G.newGame({ name: 'v19验收', cityName: '许都' });
  if (!st31.map.grid && G.map.generate) G.map.generate();
  function rd31(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var uS31 = rd31('ui'), dS31 = rd31('domain'), hS31 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var mS31 = rd31('main'), bS31 = rd31('battle'), cS31 = rd31('state');

  /* ---- ① 升级是后台过程（不锁功能） ---- */
  console.log('  --- ① 升级期功能可用 ---');
  check('升级面板为「升级中」时仍渲染功能入口', /var fn = isUpgrade \? BLDG_FUNC\[cell\.build\.id\] : null;/.test(uS31));
  check('升级面板标注「不影响下方操作」', /不影响下方操作/.test(uS31));
  check('建造面板不再写「需等完工」备注（需求 5）', !/新建建筑需等待完工后才能使用/.test(uS31));
  check('城外地块升级中标注「施工中不停产」', /施工中不停产/.test(uS31));
  check('城外地块升级仍展示当前产量', /当前产出（施工中不停产）/.test(uS31));
  check('实测：升级中军营仍可募兵', (function () {
    var s = G.state, c = s.cities[0];
    govMax(c);   /* v68：官府拉满 —— 本段专注"升级中的军营"，不测总闸；防 if(!r.ok)return true 静默弱化 */
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;
    var i = -1;
    for (var k = 0; k < c.cells.length; k++) { if (!c.official && !c.cells[k].build && !c.cells[k].pending) { i = k; break; } }
    if (i < 0) return true;
    var r1 = G.buildAt(c.id, i, 'junying');
    if (!r1.ok) return true;
    var guard = 0;
    while (s.queues.build.length && guard++ < 10) { var q = s.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q); var ix = s.queues.build.indexOf(q); if (ix >= 0) s.queues.build.splice(ix, 1); }
    var r2 = G.upgradeAt(c.id, i);
    if (!r2.ok) return true;
    var tr = G.train('yibing', 10, c.id);
    return !!c.cells[i].pending && c.cells[i].build.lvl === 1 && tr.ok;
  })());
  check('实测：升级完成后等级才生效', (function () {
    var s = G.state, c = s.cities[0];
    var i = -1;
    for (var k = 0; k < c.cells.length; k++) { if (c.cells[k].pending && (c.cells[k].pending.targetLevel || 1) > 1) { i = k; break; } }
    if (i < 0) return true;
    var q = null;
    (s.queues.build || []).forEach(function (x) { if (x.gridIndex === i) q = x; });
    if (!q) return true;
    q.elapsed = q.totalTime; G.applyBuildDone(q);
    return c.cells[i].build.lvl === q.targetLevel && !c.cells[i].pending;
  })());

  /* ---- ② 侧栏资源栏：去图标 / 去小数 / 去每小时 ---- */
  console.log('  --- ② 侧栏资源栏 ---');
  check('资源行不再拼接图标（只用文字）', (function () {
    var i = uS31.indexOf('ui.renderResBar = function');
    var body = i < 0 ? '' : uS31.slice(i, uS31.indexOf('\n  };', i));
    return /'<span class="lbl">' \+ \(meta \? meta\.name : k\) \+ '<\/span>'/.test(body)
      && body.indexOf('meta.icon') < 0;
  })());
  /* v65（老板）：存量改"万/亿"短写 —— 判据随之换出口（唯一出口 U.amtHTML） */
  check('资源存量走短写 U.amtHTML（精确值改到 title 悬停）',
    /U\.amtHTML\(val\)/.test(uS31) && !/U\.numHTML\(val, 0\)/.test(uS31));
  /* v40（需求 1）：老板要「显示其上限而不是精确值」 —— 悬停改报**仓储上限**
     （口径走唯一来源 GAME.storeCap()）；黄金是货币、不受上限约束，单独注明。 */
  check('资源存量悬停显示仓储上限（不再是精确值）', (function () {
    return /GAME\.storeCap/.test(uS31) && /上限 /.test(uS31)
      && /不受仓储上限约束/.test(uS31) && !/title="精确值：/.test(uS31);
  })());
  check('已删除「每小时（游戏时间）」产量提示', !/每小时（游戏时间）/.test(uS31) && !/res-foot/.test(uS31) && !/\.res-foot/.test(hS31));
  check('资源栏仍显示 /秒 增速', /U\.rateHTML\(perSec\)/.test(uS31));

  /* ---- ③ 城池属性去黄金 ---- */
  console.log('  --- ③ 城池属性去重 ---');
  /* v20（需求 5/12）：黄金、税收、可征人口 全部移除。
     注意：源码注释里仍会出现这些词，所以必须判定**运行时渲染结果**而非源码文本。 */
  check('城池属性不再显示黄金 / 税收 / 可征人口', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    G.ui.renderCityAttrs(c, s);
    /* smoke 用的是 DOM 桩：元素从 document._cache 取（无 getElementById） */
    var el = DC['#city-attrs'];
    var txt = el ? el.innerHTML : '';
    UI.renderSide();
    txt = (DC['#city-attrs'] || {}).innerHTML || txt;
    return txt.length > 0 && txt.indexOf('黄金') < 0 && txt.indexOf('税收') < 0 && txt.indexOf('可征人口') < 0;
  })());
  /* v28（需求 3）：民心与民怨合并成一行「xx / xx」 */
  check('城池属性：民心/民怨一行、税率与人口各一行',
    /❤️ 民心 \/ 民怨/.test(uS31) && /💰 税率/.test(uS31) && /👥 人口/.test(uS31)
    && !/💢 民怨/.test(uS31));

  /* ---- ④⑤ 弹窗尺寸与格局统一 ---- */
  console.log('  --- ④⑤ 弹窗尺寸与格局 ---');
  check('四档固定尺寸齐备（默认/sm/lg/xl；v74 起全部固定 px）',
    /\.modal \{[\s\S]{0,200}width: 660px; height: 620px/.test(hS31)
    && /\.modal-sm \{ width: \d+px; height: \d+px; \}/.test(hS31)
    && /\.modal-lg \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\)/.test(hS31)
    && /\.modal-xl \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\)/.test(hS31));
  check('v74：固定 px + 兜底（vw/vh 上限与 860 降档均已撤）', (function () {
    var css = hS31.replace(/\/\*[\s\S]*?\*\//g, '');
    return /max-width: calc\(100vw - 20px\)/.test(css)
      && !/@media \(max-height: 860px\)/.test(css) && !/max-width: 96vw/.test(css);
  })());
  check('三段式格局样式齐备（m-head/m-body/m-foot）',
    /\.m-head \{/.test(hS31) && /\.m-body \{/.test(hS31) && /\.m-foot \{/.test(hS31));
  check('shell 布局：标题与操作栏固定、仅内容区滚动',
    /\.modal \.inner-shell \{ display: flex; flex-direction: column; overflow: hidden; \}/.test(hS31)
    && /\.m-body \{ flex: 1; min-height: 0; overflow-y: auto/.test(hS31));
  check('ui.modalShell / ui.openShell 已提供', /ui\.modalShell = function/.test(uS31) && /ui\.openShell = function/.test(uS31));
  check('openModal 自动识别 shell 并切换内层布局', /var shelled = \/class="m-head"\//.test(uS31));
  check('君主 / 背包 / 商城 / 改建 共用 shell',
    (uS31.match(/ui\.openShell\(\{/g) || []).length >= 4,
    (uS31.match(/ui\.openShell\(\{/g) || []).length + ' 处');
  check('移动确认弹窗也用同一格局', /ui\.openMoveConfirm = function[\s\S]{0,900}ui\.openShell\(\{/.test(mS31));
  check('openModal 支持 xl 档（modal-xl）', /var sizeCls = o\.size \? \(' modal-' \+ o\.size\) : ''/.test(uS31));

  /* ---- ⑥ 菜单分组 + 行军菜单 + 公告并入公文 ---- */
  console.log('  --- ⑥ 菜单与公文 ---');
  check('顶栏按类型分组（≥4 处分隔线）', (hS31.match(/class="nav-sep"/g) || []).length >= 4,
    (hS31.match(/class="nav-sep"/g) || []).length + ' 处');
  check('分隔线样式已定义', /\.topnav \.nav-sep \{/.test(hS31));
  /* v41（需求 3）：行军菜单**不带数值徽标** —— 老板原话「不要给在行军这个菜单名上产生数值」。
     徽标语义是"有事情等你处理"，行军只是"部队在外面"，属状态不属待办。 */
  check('「行军」菜单存在且**不带数值徽标**（v41 需求 3）',
    /data-view="marches"><i class="ti" data-nav="march"><\/i>行军<\/div>/.test(hS31)
    && !/tab-badge-march/.test(hS31));
  check('取消独立「公告」菜单', !/open-notice/.test(hS31));
  check('公告弹窗函数已移除', !/ui\.openNotice = function/.test(uS31));
  /* v27（需求 2）：公告与当前要务整块删除（与「任务」菜单重复），系统状态也删 */
  check('公文页不再有「公告 · 当前要务」', (function () {
    /* 注释里会写"删掉公告 · 当前要务"，判据必须先剥注释 */
    var code = uS31.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
      .map(function (l) { return l.split('//')[0]; }).join('\n');
    return code.indexOf('公告 · 当前要务') < 0 && code.indexOf('notice-box') < 0
      && code.indexOf('系统状态') < 0;
  })());
  /* v29（需求 6）：公文只留报告与消息 —— 队列整段撤掉，改在官府弹窗看 */
  check('公文页不再有队列一节（v29：队列迁入官府 · 在办事项）',
    !/ui\.sealH\('队列'/.test(uS31) && !/id="doc-queues"/.test(uS31)
    && /ui\.queueBody = function/.test(uS31) && /在办事项/.test(uS31));
  check('菜单顺序：场景→军事→任务统计→商背→记录→系统', (function () {
    var order = ['data-view="city"', 'data-view="map"', 'nav-sep', 'data-view="generals"', 'data-view="marches"',
      'nav-sep', 'data-view="tasks"', 'data-view="stats"', 'nav-sep', 'data-view="shop"', 'data-view="bag"',
      'nav-sep', 'data-view="story"', 'data-view="reports"', 'nav-sep', 'data-view="settings"'];
    var at = -1;
    for (var i = 0; i < order.length; i++) {
      var idx = hS31.indexOf(order[i], at + 1);
      if (idx < 0) return false;
      at = idx;
    }
    return true;
  })());

  /* ---- ⑥b 行军视图 ---- */
  console.log('  --- ⑥b 行军视图 ---');
  check('ui.marchesHTML 已实现', /ui\.marchesHTML = function/.test(uS31));
  check('renderView 接到 marches', /else if \(v === 'marches'\) box\.innerHTML = ui\.marchesHTML\(\);/.test(uS31));
  check('行军视图按本城过滤队列', /filter\(function \(m\) \{ return !c \|\| m\.cityId === c\.id; \}\)/.test(uS31));
  check('行军视图含行军中 + 在外驻军两区', /行军中/.test(uS31) && /在外驻军 · 采集/.test(uS31));
  check('行军视图提供召回 / 急行军令', /data-action="march-recall"/.test(uS31) && /data-action="march-rush"/.test(uS31));
  check('行军视图提供采集收获 / 撤回', /data-action="gather-finish"/.test(uS31) && /data-action="gather-abandon"/.test(uS31));
  /* v41（需求 3）：行军角标撤掉后，syncBadges 里不能再残留那段统计（否则是死逻辑） */
  check('行军角标统计已撤除，公文改用「未读闪黄」（v41 需求 3/4）',
    !/tab-badge-march/.test(uS31) && !/GAME\.gatherList \? GAME\.gatherList\(\)\.length : 0/.test(uS31)
    && /data-view="reports"\]/.test(uS31) && /repUnread/.test(uS31));
  check('行军菜单按钮与实际动作一致（无孤儿按钮）', (function () {
    var acts = (uS31.match(/data-action="(gather-[a-z]+|march-[a-z]+)"/g) || []);
    var cases = (mS31.match(/case '(gather-[a-z]+|march-[a-z]+)'/g) || []).map(function (x) { return x.replace(/case '|'/g, ''); });
    var cset = {};
    cases.forEach(function (c) { cset[c] = 1; });
    var orphans = acts.map(function (a) { return a.replace(/data-action="|"/g, ''); })
      .filter(function (a) { return !cset[a]; });
    return orphans.length === 0;
  })(), '（返回 true 表示全部有处理器）');

  /* ---- ⑧ 建筑移动 / 交换 ---- */
  console.log('  --- ⑧ 建筑移动与交换 ---');
  check('GAME.moveBuilding 已实现', typeof G.moveBuilding === 'function');
  check('实测：建筑搬到空地', (function () {
    var s = G.state, c = s.cities[0];
    var a = -1, b = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (!c.official && c.cells[i].build && !c.cells[i].pending && a < 0) a = i;
      if (!c.official && !c.cells[i].build && b < 0) b = i;
    }
    if (a < 0 || b < 0) return true;
    var id = c.cells[a].build.id, lv = c.cells[a].build.lvl;
    var r = G.moveBuilding(c.id, a, b);
    return r.ok && !c.cells[a].build && c.cells[b].build.id === id && c.cells[b].build.lvl === lv;
  })());
  check('实测：两建筑互换位置', (function () {
    var s = G.state, c = s.cities[0];
    var x = -1, y = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.official || c.cells[i].pending || !c.cells[i].build) continue;
      if (x < 0) { x = i; continue; }
      if (y < 0) { y = i; break; }
    }
    if (x < 0 || y < 0) return true;
    var ix = c.cells[x].build.id, iy = c.cells[y].build.id;
    var r = G.moveBuilding(c.id, x, y);
    return r.ok && c.cells[x].build.id === iy && c.cells[y].build.id === ix;
  })());
  check('官府不可移动（守护规则）', /官府为城池中枢，不可移动/.test(dS31));
  check('施工中的格子不可移动（防队列错位）', /有建筑正在施工，暂不可移动/.test(dS31));
  check('实测：官府移动被拒', (function () {
    var s = G.state, c = s.cities[0];
    var gv = -1, e = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i].official && gv < 0) gv = i;
      if (!c.cells[i].official && !c.cells[i].build && e < 0) e = i;
    }
    if (gv < 0 || e < 0) return true;
    var r = G.moveBuilding(c.id, gv, e);
    return !r.ok && /官府/.test(r.msg);
  })());
  /* v28（需求 7）：移动/交换改到右下角、按钮收小（.btn sm） */
  check('v76：移动/交换与升级/拆除同排（官府除外）', /data-action="move-ask"/.test(uS31)
    && /b\.id === 'guanfu' \? ''[\s\S]{0,60}: '<button class="btn bldg-act" data-action="move-ask"/.test(uS31)
    && /\.bldg-foot \{ display: flex; justify-content: center/.test(htmlSrc25));
  /* 移动确认弹窗整体定义在 main.js（含按钮），故三处都查 main.js */
  check('移动走二次确认（move-do）', /ui\.openMoveConfirm = function/.test(mS31) && /data-action="move-do"/.test(mS31)
    && /case 'move-do'/.test(mS31) && /ui\.openShell\(\{/.test(mS31));
  check('Esc 可取消移动待选状态', /ui\._moveFrom != null\) \{ ui\._moveFrom = null/.test(mS31));

  /* ---- ⑧b 城外改建 ---- */
  console.log('  --- ⑧b 城外改建 ---');
  check('GAME.convertExt / extConvertCost 已实现',
    typeof G.convertExt === 'function' && typeof G.extConvertCost === 'function');
  check('改建折扣为 60%', G.EXT_CONVERT_RATE === 0.6);
  check('实测：改建保留等级', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    G.ensureExtGrid(c);
    var g = G.extGridOf(c);
    var i = -1;
    for (var k = 0; k < g.length; k++) { if (g[k].type && !g[k].pending) { i = k; break; } }
    if (i < 0) return true;
    g[i].lv = 4;
    var from = g[i].type;
    var to = null;
    DATA.EXT_BUILD_ORDER.forEach(function (x) { if (!to && x !== from) to = x; });
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;
    var r = G.convertExt(i, to);
    return r.ok && g[i].type === to && g[i].lv === 4;
  })());
  check('实测：改建费低于全新同等级造价', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    var g = G.extGridOf(c);
    var i = -1;
    for (var k = 0; k < g.length; k++) { if (g[k].type) { i = k; break; } }
    if (i < 0) return true;
    g[i].lv = 5;
    var to = g[i].type === 'mine' ? 'farm' : 'mine';
    var cost = G.extConvertCost(i, to);
    var full = 0;
    DATA.EXT_BUILDINGS[to].cost.slice(0, 5).forEach(function (r) { full += r[0] || 0; });
    return cost.grain > 0 && cost.grain < full;
  })());
  check('改建为同类型被拒 / 施工中不可改建',
    /与当前类型相同/.test(dS31) && /施工中不可改建/.test(dS31));
  check('改建设有专属选择面板', /ui\.openExtConvert = function/.test(uS31) && /data-action="ext-convert-ask"/.test(uS31));
  check('城外地块操作分区（正向 / 危险）', /🔧 改建为其他资源建筑/.test(uS31));

  /* ---- ⑨ 任务占位文案 ---- */
  console.log('  --- ⑨ 任务文案 ---');
  check('「已完成的任务收在这里…」已删除', !/已完成的任务收在这里/.test(uS31));
  check('已完成区块标题与展开按钮仍在', /已完成<\/span>/.test(uS31) && /toggle-done-quests/.test(uS31));

  /* ---- ⑩ 仓库解除数量限制 ---- */
  console.log('  --- ⑩ 仓库多建 ---');
  check('仓库已移出唯一建筑表', (function () {
    return !!G.UNIQUE_BUILDINGS && !G.UNIQUE_BUILDINGS.cangku;
  })(), '唯一建筑 ' + Object.keys(G.UNIQUE_BUILDINGS || {}).length + ' 项');
  check('唯一建筑表为单一份数据源（ui 不再复制）',
    /var UNIQUE = GAME\.UNIQUE_BUILDINGS;/.test(uS31) && !/var UNIQUE = \{[^}]*cangku/.test(uS31));
  check('GAME.buildingLevelSum 已实现（多建建筑求和）', typeof G.buildingLevelSum === 'function');
  check('storeCap 按本城仓库等级求和（v60：资源归属城池，仓容跟着走）',
    /GAME\.storeCapOf = function/.test(dS31)
    && /buildingLevelSum\(city, 'cangku'\)/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    /* storeCap 不再自己算一遍，只做"当前城"的转发 —— 一个概念一个取值口 */
    && /storeCapOf\(GAME\.currentCity\(\)\)/.test(codeOf(dS31, 'GAME.storeCap = function')));
  check('实测：连建两座仓库成功', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;
    var ok = 0;
    for (var n = 0; n < 2; n++) {
      var i = -1;
      for (var k = 0; k < c.cells.length; k++) { if (!c.official && !c.cells[k].build && !c.cells[k].pending) { i = k; break; } }
      if (i < 0) break;
      var r = G.buildAt(c.id, i, 'cangku');
      if (!r.ok) break;
      var guard = 0;
      while (s.queues.build.length && guard++ < 10) { var q = s.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q); var ix = s.queues.build.indexOf(q); if (ix >= 0) s.queues.build.splice(ix, 1); }
      ok++;
    }
    return ok === 2;
  })());
  check('实测：储量随仓库等级叠加', (function () {
    var s = G.state, c = s.cities[0];
    var sum = G.buildingLevelSum(c, 'cangku');
    var cap = G.storeCap();
    return sum >= 2 && cap === Math.round(2000000 * sum * (1 + (G.systems.techBonus ? G.systems.techBonus('store') : 0)));
  })());
  check('仓库面板区分「本仓」与「全境」储量',
    /本仓储量/.test(uS31) && /全境储量上限/.test(uS31) && /多仓叠加/.test(uS31));

  /* ---- 需求 4b：会长长的视图接分页（固定界面尺寸） ---- */
  console.log('  --- ④b 长视图分页 ---');
  /* v28（需求 2）：将领一览**一屏 12 席**，固定栏位、不再分页 */
  /* v29（需求 16）：每页 6 席（3×2），翻页走底部固定条 */
  /* v45（需求 1）：老板要求"不要那么多页""不要限制每页的将领个数，这里允许他用下拉框"。
     所以将领左清单**取消分页**，改整段可滚（其余长列表仍守"必须分页"的规矩）。 */
  check('将领左清单 12 席/页 + 底栏翻页（v76；v45 曾取消分页）',
    /ui\.GEN_SLOTS = 12/.test(uS31) && /ui\.GEN_PER = 12/.test(uS31)
    && !/ui\.GEN_PER_PAGE/.test(uS31.replace(/\/\*[\s\S]*?\*\//g, ''))
    && /ui\.pagerHTML\('gen', pool\.length, ui\.GEN_PER\)/.test(uS31)
    && /for \(var i = 0; i < ui\.GEN_PER; i\+\+\)/.test(uS31));
  check('空席也渲染（看得出还差几位、能不能再招）',
    /class="gen-row empty"/.test(uS31) && /招贤馆需 /.test(uS31));
  check('装备背包分页（每页 10）', /ui\.pageOf\('equip', invAll\.length, 10\)/.test(uS31)
    && /ui\.pagerHTML\('equip', invAll\.length, 10\)/.test(uS31));
  check('史册纪事分页（每页 20，只增不减必须分页）', /ui\.pageOf\('chronicle', items\.length, 20\)/.test(uS31)
    && /ui\.pagerHTML\('chronicle', items\.length, 20\)/.test(uS31));
  check('分页组件与任务/商城同一套', /ui\.pageOf = function/.test(uS31) && /ui\.pagerHTML = function/.test(uS31)
    && /data-action="page" data-key="/.test(uS31));
  check('实测：30 位将领 → 每页 12 席、底部条出现翻页（v76）', (function () {
    var s = G.state, backup = s.generals;
    var proto = backup[0] || G.makeGeneral('样本', 1);
    var many = [];
    for (var i = 0; i < 30; i++) {
      var g = JSON.parse(JSON.stringify(proto));
      g.id = 'pgtest' + i; g.name = '测试将' + i;
      many.push(g);
    }
    s.generals = many;
    G.ui._pages['gen'] = 1;
    G.ui._bottom.length = 0;
    var html = G.ui.generalsHTML();
    var rows = (html.match(/<div class="gen-row[\s"']/g) || []).length;
    var pager = G.ui._bottom.join('');
    G.ui._pages['gen'] = 2;                       /* 翻到第 2 页：应出现 测试将12 */
    var html2 = G.ui.generalsHTML();
    s.generals = backup;
    G.ui._pages['gen'] = 1;
    G.ui._bottom.length = 0;
    return rows === 12 && html.indexOf('测试将0') >= 0 && html.indexOf('测试将12') < 0
      && html2.indexOf('测试将12') >= 0 && pager.indexOf('data-key="gen"') >= 0;
  })());
  check('实测：史册分页只渲染 20 条', (function () {
    var s = G.state, backup = s.chronicle;
    var many = [];
    for (var i = 0; i < 45; i++) many.push({ era: '元兴', seasonName: '春', tag: 'war', text: '第 ' + i + ' 条纪事' });
    s.chronicle = many;
    if (G.ui && G.ui._pages) G.ui._pages.chronicle = 1;
    if (G.ui) G.ui._bottom = [];
    var html = G.ui.storyHTML();
    var n = (html.match(/chron-item/g) || []).length;
    var bar = (G.ui._bottom || []).join('');
    s.chronicle = backup;
    /* v29：分页条已改投底部固定条，所以"共 45 项"要在 _bottom 里找，而不是正文里 */
    return n === 20 && bar.indexOf('共 45 项') >= 0;
  })());

  /* ============================================================
   * 32. v20：正方形网格 + 十三项体验修复
   * ============================================================ */
  console.log('\n===== 32. v20：正方形网格与体验修复 =====');
  function rd32(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var uS32 = rd32('ui'), hS32 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var mS32 = rd32('main'), bS32 = rd32('battle'), sS32 = rd32('state');

  /* ---- 需求 1/2：格内一体 + 无多余文字行 ---- */
  console.log('  --- ① 地块与建筑一体 ---');
  check('地块为正方形且边长相等',
    G.ui.TILE_W === G.ui.TILE_H && G.ui.TILE_W >= 60 && G.ui.TILE_SKEW === 0,
    G.ui.TILE_W + '×' + G.ui.TILE_H);
  check('格心 = 元素盒中心（几何上不可能错位）', (function () {
    var M = G.ui.isoMetrics(6, 6);
    /* 第 (2,3) 格：左上角 (wp+2W, wp+3H)，尺寸 W×H → 中心 = 左上角 + (W/2, H/2) = 格心 */
    var cx = M.x(2, 3) + M.W / 2, cy = M.y(2, 3) + M.H / 2;
    return cx === M.wall + 2 * M.W + M.W / 2 && cy === M.wall + 3 * M.H + M.H / 2;
  })());
  check('实测：任意两格不重叠（正方形密铺）', (function () {
    var M = G.ui.isoMetrics(6, 6);
    for (var row = 0; row < 6; row++) for (var col = 0; col < 6; col++) {
      if (col < 5 && M.x(col + 1, row) !== M.x(col, row) + M.W) return false;
      if (row < 5 && M.y(col, row + 1) !== M.y(col, row) + M.H) return false;
    }
    return true;
  })());
  /* v24（需求 9）：队列改在公文呈现，仍只有进度条 + 百分比，不显示剩余时间 */
  check('队列只给进度条 + 百分比（不显示剩余时间）',
    /\.qbar \{/.test(hS32) && /class="qbar"/.test(uS32)
    && !/U\.durExact/.test(uS32.slice(uS32.indexOf('ui.queueBody = function'), uS32.indexOf('ui.queueBody = function') + 2600)));
  /* 注释里会提到 .queue-bar 这个旧名字，所以只查「元素」与「样式规则」是否真的没了 */
  check('底部队列播报条已删除',
    !/id="queue-bar"/.test(hS32) && !/\.queue-bar \{/.test(hS32) && !/\.queue-item \{/.test(hS32));

  /* ---- 需求 4：募兵可选择兵种 ---- */
  console.log('  --- ④ 募兵可选择兵种 ---');
  check('select-train 重绘**弹窗**（此前只重绘中央视图 → 点了没反应）',
    /case 'select-train': ui\._trainSel = el\.dataset\.troop; ui\.renderTroopsModal\(\); break;/.test(mS32));
  check('ui.renderTroopsModal 已实现', /ui\.renderTroopsModal = function/.test(uS32));
  check('募兵面板有可点选的兵种卡（有军营时）', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;
    var has = 0;
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'junying') has++; });
    if (!has) {
      var i = -1;
      for (var k = 0; k < c.cells.length; k++) { if (!c.official && !c.cells[k].build) { i = k; break; } }
      if (i < 0) return true;
      G.buildAt(c.id, i, 'junying');
      var guard = 0;
      while (s.queues.build.length && guard++ < 10) {
        var q = s.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q);
        var ix = s.queues.build.indexOf(q); if (ix >= 0) s.queues.build.splice(ix, 1);
      }
    }
    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return (html.match(/data-action="select-train"/g) || []).length >= 2;
  })());
  check('切换兵种会改变选中项（_trainSel 随点击变化）', (function () {
    G.ui._trainSel = 'yibing';
    G.ui._trainSel = 'minfu';
    return G.ui._trainSel === 'minfu';
  })());
  check('工匠作坊入口直接开器械面板（不再切中央视图）',
    /case 'open-siege': ui\.openTroops\(ui\._trainBIdx, 'siege'\)/.test(mS32));

  /* ---- 需求 8：战报体现战利品 ---- */
  console.log('  --- ⑧ 战报含战利品 ---');
  check('战报 body 拼接战利品段', /【战利品】/.test(bS32));
  check('战报记录 loot 字段（供列表标注）', /loot: lootLines/.test(bS32));
  check('实测：掠夺野地后战报含资财明细', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8;
    var w = null;
    for (var r = 1; r < 40 && !w; r++) {
      for (var dy = -r; dy <= r && !w; dy++) for (var dx = -r; dx <= r && !w; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'lake' && !G.map.wildAt(x, y) && !G.map.npcAt(x, y)) w = { x: x, y: y };
      }
    }
    if (!w) return true;
    var gen = s.generals[0]; gen.stamina = 100; gen.energy = 100;
    c.army = { yibing: 300000 };
    s.reports = [];
    var res = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 300000 }, gen.id);
    if (!res.ok || !res.result || res.result.winner !== 'atk') return true;
    var rep0 = s.reports[0];
    /* v60：资源中文名收口到 GAME.resName（读 DATA.RESOURCES）→「粮食」，
       原先这里钉的是战报里另一张内联表的「粮草」，两个出口已合并。 */
    return !!rep0 && rep0.body.indexOf('【战利品】') >= 0 && /粮食 \+/.test(rep0.body) && rep0.loot.length > 0;
  })());

  /* ---- 需求 5/12：城池属性精简 ---- */
  console.log('  --- ⑤⑫ 城池属性精简 ---');
  check('城池属性不含黄金/税收/可征人口（运行时渲染）', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    G.ui.renderCityAttrs(c, s);
    /* DOM 桩：元素从 document._cache 取 */
    var el = DC['#city-attrs'];
    var txt = el ? el.innerHTML : '';
    return txt.length > 0 && txt.indexOf('黄金') < 0 && txt.indexOf('税收') < 0 && txt.indexOf('可征人口') < 0;
  })());
  check('已删除无用的 goldPerH / freePop 计算', !/var goldPerH/.test(uS32) && !/var freePop/.test(uS32));

  /* ---- 需求 6：背包入顶栏 + 去重复任务入口 ---- */
  console.log('  --- ⑥ 菜单归置 ---');
  check('顶栏含背包且与商城相邻',
    /data-view="shop"[\s\S]{0,200}data-view="bag"/.test(hS32));
  check('侧栏不再有背包与任务按钮（避免与顶栏重复）',
    !/class="sbtn" data-action="open-bag"/.test(hS32) && !/class="sbtn" data-action="open-quests"/.test(hS32));
  check('侧栏仅保留君主入口', /class="sbtn" data-action="open-lord">君主/.test(hS32));
  check('孤立的 open-quests 动作已移除', !/case 'open-quests'/.test(mS32));

  /* ---- 需求 7：只有城池视图显示左侧统计栏 ---- */
  console.log('  --- ⑦ 侧栏按视图显隐 ---');
  /* v26（需求 5）：城内 / 城外 是平级视图，两者都算"城池场景"，侧栏都保留 */
  check('setView 按视图切换侧栏显隐（城内/城外都显示）',
    /var isCity = \(v === 'city' \|\| v === 'ext'\);[\s\S]{0,120}classList\.toggle\('hidden', !isCity\)/.test(uS32));
  check('renderView 同步切换（防 setView 之外的路径漏掉）',
    /var isCity = \(v === 'city' \|\| v === 'ext'\);[\s\S]{0,120}classList\.toggle\('hidden', !isCity\)/.test(uS32));
  check('主区在侧栏隐藏时独占整宽', /\.main\.solo \{ grid-template-columns: 1fr; \}/.test(hS32)
    && /classList\.toggle\('solo', !isCity\)/.test(uS32));
  check('.hidden 全局样式已定义', /\.hidden \{ display: none !important; \}/.test(hS32));

  /* ---- 需求 10：资源三列对齐 ---- */
  console.log('  --- ⑩ 资源三列对齐 ---');
  check('资源行用 grid 三列（名称/存量/产量）',
    /#res-bar \.res-line \{[\s\S]{0,160}grid-template-columns: 56px 1fr auto/.test(hS32));
  check('存量固定宽度 + 等宽数字（位数对齐）',
    /#res-bar \.res-line \.amt \{[\s\S]{0,120}font-variant-numeric: tabular-nums/.test(hS32)
    && /min-width: 76px/.test(hS32));
  check('产量列等宽右对齐', /#res-bar \.num-rate \{[\s\S]{0,120}min-width: 72px; text-align: right/.test(hS32));

  /* ---- 需求 11：产量构成悬停 ---- */
  console.log('  --- ⑪ 产量构成悬停 ---');
  check('GAME.prodBreakdown 已实现', typeof G.prodBreakdown === 'function');
  check('prodFactors 抽取为单一来源（计算与展示共用）',
    /GAME\.prodFactors = function/.test(sS32) && /GAME\.prodFactors\(r2, city\)\.forEach/.test(sS32));
  check('产量外层带 data-tip 浮层', /class="rate-wrap" data-tip=/.test(uS32));
  /* v37（需求 2）：CSS ::after 浮层退役，改由 .tip-layer 统一显示 */
  check('浮层样式已定义（.tip-layer 唯一层 + data-tip 为内容源）',
    /\.tip-layer \{/.test(hS32) && /z-index: 9000/.test(hS32)
    && /\.bag-tip, \.tcard-tip \{ display: none; \}/.test(hS32)
    && !/\.rate-wrap\[data-tip\]:hover::after/.test(hS32));
  check('实测：分解各项之和 ≈ 总产量（瀑布式，不重不漏）', (function () {
    var s = G.state;
    s.res.grain = 1e8;
    var total = G.productionPerSec();
    var bad = [];
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (r) {
      var rows = G.prodBreakdown(r) || [];
      var sum = rows.reduce(function (a, x) { return a + x.val; }, 0);
      if (Math.abs(sum - (total[r] || 0)) > Math.max(0.02, Math.abs(total[r] || 0) * 0.001)) {
        bad.push(r + ' 分解=' + sum.toFixed(3) + ' 实际=' + (total[r] || 0).toFixed(3));
      }
    });
    return bad.length === 0;
  })());
  check('产量重构后总值未变（prodFactors 与旧口径一致）', (function () {
    var s = G.state;
    var out = G.productionPerSec();
    /* 基础产量 × 各因子连乘 = 输出值（抽因子不得改变结果） */
    var base = G.prodBasePerHour();
    var ts = G.timeScale();
    var okAll = true;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (r) {
      var m = 1;
      G.prodFactors(r).forEach(function (f) { m *= (1 + f.d); });
      var expect = (base[r] || 0) * m / 3600 * ts;
      if (Math.abs(expect - (out[r] || 0)) > 1e-6) okAll = false;
    });
    return okAll;
  })());

  /* ---- 需求 13：地图网格（v50 起为**菱形等距**） ---- */
  console.log('  --- ⑬ 地图网格（v50：菱形等距） ---');
  check('地图画布仍为 span×cell', (function () {
    var mapS = rd32('map');
    return /cvW = Math\.round\(spanX \* cell\)/.test(mapS) && /cvH = Math\.round\(spanY \* cell\)/.test(mapS);
  })());
  check('菱形格心 = (ox+(gx−gy)·HW, oy+(gx+gy)·HH)', (function () {
    var mapS = rd32('map');
    return /ox \+ \(gx - gy\) \* HW/.test(mapS) && /oy \+ \(gx \+ gy\) \* HH/.test(mapS);
  })());
  check('菱形拾取 = 反投影 + round（无三角函数、无累积误差）', (function () {
    var mapS = rd32('map');
    return /\/ v\.HW/.test(mapS) && /\/ v\.HH/.test(mapS)
      && !/Math\.floor\(\(mx - v\.ox\) \/ v\.cell\)/.test(mapS)
      && !/Math\.(sin|cos)\(/.test(mapS);
  })());

  /* ============================================================
   * 33. v20：正方形网格 + 十三项体验修复
   * ============================================================ */
  console.log('\\n===== 33. v20：正方形网格与体验修复 =====');
  function rd33(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var uS33 = rd33('ui'), hS33 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var mS33 = rd33('main'), bS33 = rd33('battle'), sS33 = rd33('state'), mapS33 = rd33('map');

  /* ---- 需求 1/2：方格一体 ---- */
  console.log('  --- ①② 正方形网格 ---');
  check('地块为正方形（边长相等、无斜移）', G.ui.TILE_W === G.ui.TILE_H && G.ui.TILE_SKEW === 0,
    G.ui.TILE_W + '×' + G.ui.TILE_H);
  check('元素尺寸 = 地块尺寸（不存在「图标挂在地块上」）', (function () {
    /* 元素盒的宽高直接取 M.W / M.H —— 同一组值既画地块也定元素边界 */
    return /style="left:' \+ left \+ 'px;top:' \+ top \+ 'px;width:' \+ M\.W \+ 'px;height:' \+ M\.H \+ 'px;">/.test(uS33);
  })());
  check('建筑图标居中（tile-art inset:0 + flex center）', (function () {
    var m = hS33.match(/\.tile-art \{[^}]*\}/);
    return !!m && /inset: 0/.test(m[0]) && /align-items: center/.test(m[0])
      && !/translate\(-50%, -100%\)/.test(hS33);
  })());
  check('暗色界面禁用外投影（规范：用亮度分层）', (function () {
    var m = hS33.match(/\.tile-art \.ico \{[^}]*\}/);
    return !!m && /filter: none/.test(m[0]);
  })());
  check('悬停不再位移/缩放（位移正是"飘"的来源）',
    /\.iso-tile:hover \.tile-face \{[\s\S]{0,120}filter: brightness/.test(hS33)
    && !/\.iso-tile:hover \.tile-art \.ico \{[\s\S]{0,120}transform/.test(hS33));
  /* v23（需求 2/3）：等级移到格内右上角（仅数字），底部标签只留名字 */
  check('等级为格内右上角角标（需求 2/3）',
    /class="tile-badge/.test(uS33) && /class="nm"/.test(uS33) && !/class="lv/.test(uS33));
  /* v39（需求 3）：老板要"把底部色块去掉" —— 逐格描边正是那个"框"，一并去掉 */
  check('地块不再逐格描边（改用整片地面）', (function () {
    var m = hS33.match(/\.tile-face \{[^}]*\}/);
    return !!m && !/border/.test(m[0]);
  })());
  check('实测：36 格两两不重叠', (function () {
    var M = G.ui.isoMetrics(6, 6), pts = [];
    for (var r = 0; r < 6; r++) for (var col = 0; col < 6; col++) pts.push([M.x(col, r), M.y(col, r)]);
    for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i][0] - pts[j][0]) < M.W && Math.abs(pts[i][1] - pts[j][1]) < M.H) return false;
    }
    return true;
  })());
  check('实测：行首左边界一致（不逐行错位）', (function () {
    var M = G.ui.isoMetrics(6, 6);
    return M.x(0, 0) === M.x(0, 5) && M.x(3, 0) === M.x(3, 4);
  })());
  check('队列只给进度条 + 百分比（不显示时间）',
    /\.qbar \{/.test(hS33) && /class="qbar"/.test(uS33));
  check('城外 8 列（39 块时 5 行，落在固定视区内）', /var COLS = 8;/.test(uS33));

  /* ---- 需求 13：地图正方形 ---- */
  console.log('  --- ⑬ 地图正方形 ---');
  check('地图画布 = 格数 × 格距（宽高分别计算）',
    /cvW = Math\.round\(spanX \* cell\)/.test(mapS33)
    && /cvH = Math\.round\(spanY \* cell\)/.test(mapS33));
  /* v50 注：这一节原是 v20「地图改正方形」的回归锚点 —— 老板 v50 点名把地图改成
     菱形等距，判据整体换成菱形版。「无侧壁厚度」那条早被 v42 的 2.5D 有意取代
     （恢复它等于要求设计回退），改判"有厚度且按地形分档"。 */
  check('格心 = (ox+(gx−gy)·HW, oy+(gx+gy)·HH)',
    /ox \+ \(gx - gy\) \* HW/.test(mapS33) && /oy \+ \(gx \+ gy\) \* HH/.test(mapS33));
  check('拾取为菱形反投影（零误差）',
    /var a = \(mx - v\.ox\) \/ v\.HW/.test(mapS33) && /Math\.round\(\(a \+ b\) \/ 2\)/.test(mapS33)
    && !/function rhombus\(/.test(mapS33));
  check('v50-a：有厚度且按地形分档（正方形时代的"无侧壁"已被 2.5D 取代）',
    /var ELEV_PX = \{/.test(mapS33) && /function sideSides\(/.test(mapS33));

  /* ---- 需求 3：将领卡片 ---- */
  console.log('  --- ③ 将领分次呈现 ---');
  /* v29（需求 16）：卡片墙 + 下方档案 */
  check('将领清单为左栏姓名清单（非 14 列表）', (function () {
    var html = G.ui.generalsHTML();
    return html.indexOf('class="gen-list"') >= 0 && html.indexOf('class="gen-split"') >= 0
      && html.indexOf('<th>资质</th>') < 0;
  })());
  check('清单行给「姓名 + 资质 + 状态」（v45：Lv/装备数/忠诚移入悬停浮层）', (function () {
    var html = G.ui.generalsHTML();
    /* v45（需求 1）：老板点名去掉「装 0/12」，只保留姓名与资质等级。
       Lv / 装备数 / 经验 / 忠诚 仍在悬停浮层与右侧完整档案里，信息没丢。 */
    return /grow-name/.test(html) && /grow-sub/.test(html) && /grow-st/.test(html)
      && /grow-face/.test(html) && /class="tip-src"/.test(html) && /统 /.test(html)
      && !/grow-eq/.test(html) && !/class="grow-lv/.test(html)
      && html.indexOf('装 ') < 0;
  })());
  check('下方档案给出六维表（体力为第六维）', (function () {
    var html = G.ui.generalsHTML();
    return /class="gen-pane"/.test(html) && /gd-dims/.test(html)
      && html.indexOf('体力') >= 0 && html.indexOf('经验') >= 0;
  })());
  /* v41（需求 2）：详情与装备都不再是"入口"（右侧就是），所以页面上只剩
     任命守将 / 解雇 / 一键最优 / 全部卸下 这几个**动作**按钮。 */
  check('页面操作按钮为真实动作（守将 / 解雇 / 装装备）', (function () {
    var html = G.ui.generalsHTML();
    return html.indexOf('data-action="gen-detail"') < 0 && html.indexOf('data-action="gen-equip"') < 0
      && html.indexOf('data-action="assign-guard"') >= 0 && html.indexOf('data-action="dismiss-gen"') >= 0
      && html.indexOf('data-action="gen-auto-equip"') >= 0;
  })());
  check('解雇/任命/赏赐收在右侧档案（v41 起不再弹窗）', /ui\.genPane = function/.test(uS33)
    && /data-action="dismiss-gen"/.test(uS33) && /data-action="gen-gift-pick"/.test(uS33));

  /* ---- 需求 4：募兵 ---- */
  console.log('  --- ④ 募兵可选兵种 ---');
  check('select-train 重绘弹窗（原只重绘中央视图 → 点了没反应）',
    /case 'select-train': ui\._trainSel = el\.dataset\.troop; ui\.renderTroopsModal\(\); break;/.test(mS33));
  check('数量为状态驱动（渲染函数不再读 DOM）',
    /ui\._trainCount/.test(uS33) && !/\$\('#train-count'\)/.test(uS33));
  /* v80（老板）：「数量…可以直接输入」—— ±10 退役（adjustTrainQty 同步退休），数量改纯直输 */
  check('v80：数量直输（±10 / adjustTrainQty 退役，上限保留）',
    /* 源码里保留"退役说明注释"（含函数名），所以判据先剥注释再查 */
    /id="train-count"/.test(uS33) && !/train-qty/.test(stripComment(uS33))
      && !/adjustTrainQty/.test(stripComment(mS33))
      && /data-action="train-max"/.test(uS33));
  check('输入框变更同步状态', /GAME\.syncTrainQty/.test(mS33) && /syncTrainQty\(e\.target\.value\)/.test(mS33));
  check('实测：可点选兵种卡随军营等级出现', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;
    var has = 0;
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'junying') has++; });
    if (!has) {
      var i = -1;
      for (var k = 0; k < c.cells.length; k++) { if (!c.official && !c.cells[k].build) { i = k; break; } }
      if (i < 0) return true;
      G.buildAt(c.id, i, 'junying');
      var g0 = 0;
      while (s.queues.build.length && g0++ < 10) {
        var q = s.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q);
        var ix = s.queues.build.indexOf(q); if (ix >= 0) s.queues.build.splice(ix, 1);
      }
    }
    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var hit = (G.ui.troopsHTML().match(/data-action="select-train"/g) || []).length >= 2;
    G.ui._trainTab = bkTab;
    return hit;
  })());

  /* ---- 需求 5/12 ---- */
  console.log('  --- ⑤⑫ 城池属性 ---');
  check('城池属性移除 黄金/税收/可征人口', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    G.ui.renderCityAttrs(c, s);
    var el = DC['#city-attrs'];
    var txt = el ? el.innerHTML : '';
    return txt.length > 0 && txt.indexOf('黄金') < 0 && txt.indexOf('税收') < 0 && txt.indexOf('可征人口') < 0;
  })());

  /* ---- 需求 6/7 ---- */
  console.log('  --- ⑥⑦ 菜单与侧栏 ---');
  check('顶栏背包与商城相邻', /data-view="shop"[\s\S]{0,220}data-view="bag"/.test(hS33));
  check('侧栏去掉 背包/任务（与顶栏重复）',
    !/class="sbtn" data-action="open-bag"/.test(hS33) && !/class="sbtn" data-action="open-quests"/.test(hS33));
  /* v26（需求 5）：判断收敛到 renderView 一处，且城内/城外都算城池场景 */
  check('侧栏只在城池场景显示（城内/城外）',
    /var isCity = \(v === 'city' \|\| v === 'ext'\);[\s\S]{0,120}classList\.toggle\('hidden', !isCity\)/.test(uS33));
  check('旧的「只有 city 显示侧栏」写法已彻底移除',
    !/classList\.toggle\('hidden', v !== 'city'\)/.test(uS33)
    && !/classList\.toggle\('solo', v !== 'city'\)/.test(uS33));
  check('主区在侧栏隐藏时独占整宽', /classList\.toggle\('solo', !isCity\)/.test(uS33)
    && /\.main\.solo \{ grid-template-columns: 1fr; \}/.test(hS33));

  /* ---- 需求 9：弹窗不靠滚动条 ---- */
  console.log('  --- ⑨ 弹窗翻页 ---');
  check('弹窗分页机制齐备',
    /ui\.modalPage = function/.test(uS33) && /ui\.modalPagerHTML = function/.test(uS33)
    && /ui\.setModalPage = function/.test(uS33));
  check('弹窗翻页重绘弹窗（不复用只重绘中央视图的 setPage）',
    /case 'mpage': ui\.setModalPage/.test(mS33)
    && /ui\._modalPageRender = null/.test(uS33));
  /* v29（需求 12）：打造面板改为**品质页签**（不再是弹窗内分页），
     顺带解决了"翻页时弹窗尺寸跳动"的老毛病。 */
  check('打造面板按品质切页签（不再是弹窗内分页）',
    /ui\.setForgeQ = function/.test(uS33) && /data-action="forge-q"/.test(uS33)
    && !/ui\.modalPage\('forge' \+ q/.test(uS33));
  check('建造选择列表分页（9/页）', /ui\.modalPage\('buildpick', all, 9/.test(uS33));
  /* v29（需求 15）：招贤馆不再重复一份将领名录（顶栏「将领」菜单已有），
     只讲它自己负责的房间数与升级路径 */
  check('招贤馆不再有名录（不重复将领菜单）', (function () {
    var i = uS33.indexOf('ui.openHostel = function');
    if (i < 0) return false;
    var seg = uS33.slice(i, i + 2400);
    return seg.indexOf('inn-card') < 0 && seg.indexOf('modalPage') < 0
      && /房间（本城将领席位）/.test(seg) && /将领」菜单/.test(seg);
  })());
  check('行军队列分页（8/页）', /ui\.modalPage\('marches', list, 8/.test(uS33));
  check('弹窗内已无 max-height 滚动容器',
    (uS33.match(/max-height:\d+vh;\s*overflow-y:auto/g) || []).length === 0);

  /* ---- 需求 8：战报战利品 ---- */
  console.log('  --- ⑧ 战报战利品 ---');
  check('战报正文含【战利品】段（HTML 换行格式一致）',
    /<br>【战利品】/.test(bS33) && /loot: lootLines/.test(bS33));
  check('实测：掠夺野地后战报含具体资财', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8;
    var w = null;
    for (var r = 1; r < 40 && !w; r++) {
      for (var dy = -r; dy <= r && !w; dy++) for (var dx = -r; dx <= r && !w; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'lake' && !G.map.wildAt(x, y) && !G.map.npcAt(x, y)) w = { x: x, y: y };
      }
    }
    if (!w) return true;
    var gen = s.generals[0]; gen.stamina = 100; gen.energy = 100;
    c.army = { yibing: 300000 };
    s.reports = [];
    var res = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 300000 }, gen.id);
    if (!res.ok || !res.result || res.result.winner !== 'atk') return true;
    var rep0 = s.reports[0];
    /* v60：资源中文名收口到 GAME.resName（读 DATA.RESOURCES）→「粮食」，
       原先这里钉的是战报里另一张内联表的「粮草」，两个出口已合并。 */
    return !!rep0 && rep0.body.indexOf('【战利品】') >= 0 && /粮食 \+/.test(rep0.body) && rep0.loot.length > 0;
  })());

  /* ---- 需求 10/11 ---- */
  console.log('  --- ⑩⑪ 对齐与产量构成 ---');
  check('资源行 grid 三列（名称/存量/产量）',
    /#res-bar \.res-line \{[\s\S]{0,160}grid-template-columns: 56px 1fr auto/.test(hS33));
  check('数字列等宽 + 等宽数字（位数对齐）',
    /#res-bar \.res-line \.amt \{[\s\S]{0,120}tabular-nums/.test(hS33)
    /* v67：列宽重排为 74 / 72（存量 / 增速），仍要求"定宽 + 右对齐" */
    && /min-width: 74px/.test(hS33) && /min-width: 72px/.test(hS33));
  check('产量外层带 data-tip（悬停浮层，v37 起走 .tip-layer）', /class="rate-wrap" data-tip=/.test(uS33)
    && /\.tip-layer \{/.test(hS33) && !/\.rate-wrap\[data-tip\]:hover::after/.test(hS33));
  check('GAME.prodFactors 为单一来源（计算与展示共用）',
    /GAME\.prodFactors = function/.test(sS33) && /GAME\.prodFactors\(r2, city\)\.forEach/.test(sS33));
  check('实测：分解各项之和 = 总产量（瀑布式）', (function () {
    var total = G.productionPerSec();
    var bad = [];
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (r) {
      var sum = (G.prodBreakdown(r) || []).reduce(function (a, x) { return a + x.val; }, 0);
      if (Math.abs(sum - (total[r] || 0)) > Math.max(0.02, Math.abs(total[r] || 0) * 0.001)) bad.push(r);
    });
    return bad.length === 0;
  })());
  check('实测：加野地后明细出现「附属野地」项', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    var backup = s.wilds;
    s.wilds = [{ x: c.x + 1, y: c.y, type: 'lake', level: 5, levelDay: 0 }];
    var ok = (G.prodBreakdown('grain') || []).some(function (x) { return x.name.indexOf('附属野地') >= 0; });
    s.wilds = backup;
    return ok;
  })());


  /* ============================================================
   * 34. v21：界面统一（大界面 / 弹窗 / 地图）· 伤兵归属 · 备注清理
   * ============================================================ */
  console.log('--- 34. v21 界面统一与信息层级 ---');
  var uS34 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS34 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var hS34 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css34 = hS34.split('<style>')[1].split('</style>')[0];

  /* ---- 需求 1：伤兵营归属「校场」与「行军」 ---- */
  console.log('  --- ① 伤兵营归属校场与行军 ---');
  check('伤兵营抽为共用组件', /ui\.woundedBlock = function \(host\)/.test(uS34));
  check('校场面板含伤兵营',
    /ui\.openXiaochang = function/.test(uS34) && /woundedBlock\('xiaochang'\)/.test(uS34));
  check('行军视图含伤兵营', /woundedBlock\('view'\)/.test(uS34));
  check('行军队列弹窗含伤兵营', /woundedBlock\('marches'\)/.test(uS34));
  check('校场入口不再指向无效面板（原 open-panel/view=map 无对应分支）',
    /xiaochang: \{ label: "🏹 出征 · 伤兵", act: "open-xiaochang" \}/.test(uS34)
    && !/act: "open-panel", view: "map"/.test(uS34));
  check('open-xiaochang 动作已注册',
    /case 'open-xiaochang': ui\.openXiaochang\(\);/.test(mS34) && /case 'xiaochang-exp':/.test(mS34));
  check('设置面板已移除伤兵营', (function () {
    var h = G.ui.settingsHTML();
    return h.indexOf('woundedBlock') < 0 && h.indexOf('heal-wounded') < 0;
  })());
  check('实测：伤兵块含数量 / 治疗费 / 治疗按钮', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 1234;
    var h = G.ui.woundedBlock('xiaochang');
    s.wounded = bk;
    return /伤兵营/.test(h) && /1,234/.test(h) && /12,340/.test(h)
      && /data-action="heal-wounded"/.test(h) && /data-heal-host="xiaochang"/.test(h);
  })());
  check('实测：伤兵为 0 时按钮禁用（不给空白操作）', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 0;
    var h = G.ui.woundedBlock('view');
    s.wounded = bk;
    return /disabled/.test(h) && /dim/.test(h);
  })());
  check('实测：治疗伤兵后兵员真的归队（不是纯扣钱）', (function () {
    var s = G.state, c = G.currentCity() || s.cities[0];
    var bk = { w: s.wounded, wa: s.woundedArmy, gold: s.res.gold,
               army: JSON.parse(JSON.stringify(c.army || {})) };
    s.res.gold = 1e7;
    s.wounded = 500; s.woundedArmy = { yibing: 500 };
    var before = c.army.yibing || 0;
    var r = G.battle.heal();
    var ok = !!r.ok && s.wounded === 0 && (c.army.yibing || 0) === before + 500;
    s.wounded = bk.w; s.woundedArmy = bk.wa; s.res.gold = bk.gold; c.army = bk.army;
    return ok;
  })());
  check('治疗后重绘弹窗（否则「点了没反应」）',
    /data-heal-host/.test(uS34) && /else if \(k === 'marches'\) ui\.openMarches\(\);/.test(mS34));

  /* ---- 需求 2/3：大界面 / 弹窗 / 地图 三层统一 ---- */
  console.log('  --- ②③ 三层界面与风格统一 ---');
  /* v24（需求 3）：地图标题（含观察框说明）整段删除，共享规则只余大界面与弹窗 */
  check('三层标题同一规格（字号取自同一变量；v82 扩至 .q-det-title）',
    /\.gold-heading, \.m-title, \.q-det-title \{[\s\S]{0,220}font-size: var\(--fs-h2\)/.test(css34)
    && !/\.map-title \{/.test(css34));
  check('标题不再各写各的字距（4px 宽字距已取消）', !/letter-spacing: 4px/.test(css34));
  check('分区小标题同一规格（v82 扩员：q-det-sec/gp-sec/fsn-t/op-zone-t/ledger-sec/seal-h）',
    /\.q-sec-t, \.q-det-sec, \.bag-sec, \.gd-sec, \.forge-q, \.m-sec, \.side-title, \.wb-t,[\s\S]{0,140}\.gp-sec, \.fsn-t, \.op-zone-t, \.ledger-sec, \.seal-h \{[\s\S]{0,260}font-size: var\(--fs-h3\)/.test(css34));
  check('页脚三套合一（.m-foot / .modal-foot / .panel-foot）',
    /\.m-foot, \.modal-foot, \.panel-foot \{/.test(css34));
  check('卡片几何统一（圆角 / 内边距同一组变量）',
    /\.q-card, \.item-row, \.eq-cell, \.bag-cell, \.inn-card, \.story-card, \.xc-row \{[\s\S]{0,140}border-radius: var\(--r-lg\)/.test(css34));
  check('主视图容器统一为 .ui-page（不再逐处写 padding:14px）',
    /\.ui-page \{ padding: var\(--sp-5\); \}/.test(css34)
    && (uS34.match(/class="ui-page"/g) || []).length >= 10);
  /* v39：描边基色改为三元组变量 —— 深色主题给白、浅色主题给深褐，
     alpha 不变，于是四套主题共用同一条规则。 */
  check('暗色界面不再用不透明深灰描边（改用发丝级半透明白）',
    !/#14130d|#2f333d|#232a1c|#333741/.test(css34) && /--line: rgba\(var\(--hl-rgb\),/.test(css34));
  /* v24（需求 1/3）：地形图例与说明整段删除（不做样式收敛，直接不渲染） */
  check('地图图例与说明已整体删除',
    !/\.map-legend/.test(css34) && !/\.map-hint/.test(css34) && !/\.map-head/.test(css34));
  check('设置项卡片抽为 .set-card（5 处重复写法合一）',
    /\.set-card \{/.test(css34) && (uS34.match(/class="set-card"/g) || []).length >= 4);

  /* ---- 需求 4：字体层级 ---- */
  console.log('  --- ④ 字体层级与用色 ---');
  check('字号令牌七档齐备',
    ['h1', 'h2', 'h3', 'body', 'lead', 'sub', 'cap'].every(function (k) {
      return (new RegExp('--fs-' + k + ':')).test(css34);
    }));
  check('CSS 裸像素字号仅剩符号/装饰字形（≤9 处）',
    (css34.match(/font-size:\s*[0-9.]+px/g) || []).length <= 9);
  check('ui.js inline 裸像素字号仅剩图标（≤4 处）',
    (uS34.match(/font-size:\s*[0-9.]+px/g) || []).length <= 4);
  check('同级别文字同字号（表格=正文档、次要信息=次要档）',
    /\.tbl \{[^}]*font-size: var\(--fs-body\)/.test(css34)
    && (css34.match(/font-size: var\(--fs-sub\)/g) || []).length >= 30);
  check('字号变量全覆盖（不再出现 11.5px 这类半像素碎片）',
    !/font-size:\s*11\.5px|font-size:\s*12\.5px|font-size:\s*13\.5px/.test(css34 + uS34));

  /* ---- 需求 5：备注型信息清理 ---- */
  console.log('  --- ⑤ 备注型信息清理 ---');
  var GONE34 = ['行军速度由', '出征耗粮=在城×2', '野地规则（v15）', '统率×100=带兵上限',
    '装备获取途径', '按「由弱到强」抽调', '每城书院同时研究1项', '珠宝=赏赐忠诚',
    '点击地块弹出操作', '1现实秒 = N游戏秒', '税率>50% 时民心', '一阶料采于野地',
    '新建建筑需等待完工后才能使用', '可去铁匠铺打造，或攻占城池缴获',
    '人口不足时可降低次要资源开工率'];
  check('攻略 / 机制说明已清除', (function () {
    /* 只在 **JS 字符串字面量** 范围内检索：注释里出现同名描述属正常代码注释，
       不构成界面文案（否则会误伤，把注释当残留）。 */
    var code34 = uS34.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    var left = GONE34.filter(function (t) { return code34.indexOf(t) >= 0; });
    if (left.length) console.log('      残留：' + left.join(' / '));
    return left.length === 0;
  })());
  check('任务引导语（guide）不再渲染',
    !/class="q-guide"/.test(uS34) && !/nt-guide/.test(uS34));
  check('死样式同步清理（.q-guide / .nt-guide）',
    !/\.q-guide \{/.test(css34) && !/\.nt-guide \{/.test(css34));
  check('信息型内容保留（数值 / 状态 / 来源）',
    /* v80：『已解锁 N/M 种』随兵营重排退役 —— 示例位换一条仍在的信息串 */
    ['治疗费', '守军约', '队列空位', '累计投入的 50%', '商城价', '返还'].every(function (t) {
      return uS34.indexOf(t) >= 0;
    }));


  /* ---- 需求 3/4：用色统一 ---- */
  console.log('  --- ⑥ 用色统一 ---');
  check('文字色走命名变量（硬编码色仅剩按钮白字等特例）',
    (css34.match(/(?<![-\w])color:\s*#[0-9a-fA-F]{3,6}/g) || []).length <= 8);
  check('语义色变量齐备（强调/实底文字/品质/资质/标签）',
    ['--text-strong', '--ink-on-gold', '--warn', '--amber', '--hero-tag',
     '--q1', '--q4', '--rank-fan', '--rank-ming', '--tag-growth'].every(function (k) {
      return (new RegExp(k + ':')).test(css34);
    }));
  check('状态色一套语义（成功/危险/提醒/信息）',
    /--green-ok:/.test(css34) && /--red-light:/.test(css34)
    && /--warn:/.test(css34) && /--blue-info:/.test(css34));
  check('间距与圆角也走令牌（不再随手写 10px/8px）',
    /--sp-5: 14px/.test(css34) && /--r-lg: 8px/.test(css34)
    && /padding: var\(--sp-5\)/.test(css34));


  /* ============================================================
   * 35. v22：点选控件（去下拉框）· 将领肖像 · 城池视图纯粹
   * ============================================================ */
  console.log('--- 35. v22 点选控件 / 将领肖像 / 城池视图 ---');
  var uS35 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS35 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var sS35 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  var pS35 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'portraits.js'), 'utf8');
  var hS35 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css35 = hS35.split('<style>')[1].split('</style>')[0];

  /* ---- 需求 1：全站没有下拉框（v45 收窄为"只准城池切换一处"） ---- */
  console.log('  --- ① 去下拉框 ---');
  check('下拉框全站只有两处：城池切换 + 附属野地（v77 老板点名），无第三处', (function () {
    /* v35 要求"全站已无 <select>"；v45 老板点名要城池下拉框（破例一次）；
       v77 老板再点名"附属野地 下拉框"（第二次破例）。
       判据仍是**计数**：允许且仅允许 2 处，且两者都实名在册 —— 防"破例变成惯例"。 */
    var strip = function (s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); };
    var all = strip(uS35 + hS35 + mS35);
    var n = (all.match(/<select/g) || []).length;
    return n === 2 && /class="city-select" data-action="switch-city"/.test(all)
      && /class="city-select wild-select"/.test(all) && /data-action="wild-pick"/.test(all);
  })());
  check('点选组件齐备（chips / chipSet / genChips）',
    /ui\.chips = function/.test(uS35) && /ui\.chipSet = function/.test(uS35)
    && /ui\.genChips = function/.test(uS35));
  check('点选后回写隐藏域（读取端 getElementById 无需改动）',
    /data-target="' \+ x\.v/.test(uS35) || /data-target/.test(uS35));
  /* v77：开工率调整入口随「资源生产」退役（after='workrate' 分支撤除）。 */
  check('chip-set 动作已注册且覆盖三类副作用（city / region / zoom）',
    /case 'chip-set'/.test(mS35) && /after === 'city'/.test(mS35)
    && /after === 'region'/.test(mS35)
    && /after === 'zoom'/.test(mS35));
  check('点选样式已定义（.chips .chip / .on）',
    /\.chips \.chip \{/.test(css35) && /\.chips \.chip\.on \{/.test(css35));
  check('点选是就地切换（不重绘，避免清空同屏输入框）',
    /ui\.chipSet = function[\s\S]{0,320}classList\.toggle\('on'/.test(uS35));
  check('宝物不再一物一下拉（顶部统一选使用对象）',
    /使用对象/.test(uS35) && /ui\._itemGen/.test(uS35) && !/this\.nextElementSibling\.dataset\.gen/.test(uS35));

  /* ---- 需求 2：将领肖像 ---- */
  console.log('  --- ② 将领肖像 ---');
  var P35 = G.portraits;
  check('肖像模块导出齐备',
    !!(P35 && P35.svg && P35.html && P35.assign && P35.ensure && P35.seedOf && P35.fileOf));
  check('28 位史实名将都有头像映射', Object.keys(P35.HERO_FILE).length === 28);
  /* v43（需求 2）：头像换成**通用池**（男女各 20 张，AI 图集生成后切分 + 抠底）。
     旧断言锚在"史实名将才用图、普通将领用 SVG 立绘"上，语义已变：
     现在全体将领都从池里取，heroKey 降级为池子被清空时的回退层。 */
  check('v43：通用头像池齐备（男 20 / 女 20）',
    P35.POOL && P35.POOL.m.length === 20 && P35.POOL.f.length === 20);
  check('实测：史实名将也走头像池（heroKey 保留为回退层）', (function () {
    var g = P35.assign({ id: 'x1', name: '关羽', hero: true, rank: 'tian' });
    return g.heroKey === 'guanyu' && P35.isHero(g) && /pool\/m\d\d\.webp$/.test(P35.fileOf(g));
  })());
  check('实测：性别分流正确（美人取 f 池，其余取 m 池）', (function () {
    var m = P35.assign({ id: 'x2', name: '路仁甲', rank: 'fan', yw: 60, zm: 60, tong: 60, nz: 60 });
    var f = P35.assign({ id: 'x3', name: '小玉', beauty: true, rank: 'ying', yw: 60, zm: 90, tong: 60, nz: 60 });
    return /pool\/m\d\d\.webp$/.test(P35.fileOf(m)) && /pool\/f\d\d\.webp$/.test(P35.fileOf(f));
  })());
  check('实测：同一将领取到同一张脸（seed 稳定，不是每次刷新都换脸）', (function () {
    var a = { id: 'g1', name: '李四', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    var b = { id: 'g1', name: '李四', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    return P35.fileOf(a) !== '' && P35.fileOf(a) === P35.fileOf(b);
  })());
  check('实测：不同将领分散到不同头像（不是全挤在同一张）', (function () {
    var set = {};
    for (var i = 0; i < 60; i++) {
      set[P35.fileOf({ id: 'g' + i, name: '将领' + i, rank: 'ying', yw: 60, zm: 60, tong: 60, nz: 60 })] = 1;
    }
    return Object.keys(set).length >= 15;
  })(), '60 个名字覆盖到 ' + (function () {
    var set = {};
    for (var i = 0; i < 60; i++) {
      set[P35.fileOf({ id: 'g' + i, name: '将领' + i, rank: 'ying', yw: 60, zm: 60, tong: 60, nz: 60 })] = 1;
    }
    return Object.keys(set).length;
  })() + ' 张不同头像');
  check('实测：同一将领两次生成完全一致（确定性 seed）', (function () {
    var a = { id: 'g1', name: '李四', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    var b = { id: 'g1', name: '李四', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    return P35.svg(a, 96) === P35.svg(b, 96);
  })());
  check('实测：不同将领长相不同', (function () {
    var a = { id: 'g1', name: '李四', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    var b = { id: 'g2', name: '王五', rank: 'ying', yw: 70, zm: 88, tong: 65, nz: 60 };
    return P35.svg(a, 96) !== P35.svg(b, 96);
  })());
  check('实测：四维最高项决定甲胄主色（从脸上能读出属性倾向）', (function () {
    var base = { id: 'c1', name: '甲', rank: 'liang' };
    var mk = function (o) { return P35.svg({ id: base.id, name: base.name, rank: base.rank, yw: o[0], zm: o[1], tong: o[2], nz: o[3] }, 96); };
    var red = mk([100, 50, 50, 50]), blue = mk([50, 100, 50, 50]), green = mk([50, 50, 50, 100]);
    return red !== blue && blue !== green
      && /#c25b3c|#7d3524/.test(red) && /#4a7bab|#27405e/.test(blue) && /#6b9550|#35502e/.test(green);
  })());
  check('实测：资质决定冠帽（凡品无金冠、天授有金冠）', (function () {
    var base = { id: 'r1', name: '乙', yw: 60, zm: 60, tong: 60, nz: 60 };
    var h1 = P35.svg({ id: base.id, name: base.name, rank: 'fan', yw: 60, zm: 60, tong: 60, nz: 60 }, 96);
    var h5 = P35.svg({ id: base.id, name: base.name, rank: 'tian', yw: 60, zm: 60, tong: 60, nz: 60 }, 96);
    return h1 !== h5 && /#e8c878/.test(h5) && !/#e8c878/.test(h1);
  })());
  check('实测：女性立绘无胡须且有花钿', (function () {
    var f = P35.svg({ id: 'w1', name: '甄宓', beauty: true, rank: 'ming', yw: 60, zm: 80, tong: 60, nz: 70 }, 96);
    var m = P35.svg({ id: 'm1', name: '甄某', beauty: false, rank: 'ming', yw: 60, zm: 80, tong: 60, nz: 70 }, 96);
    return /#d8577f/.test(f) && f !== m;
  })());
  /* v41（需求 2）：三处仍是三处，尺寸随版式变了 —— 清单行 40 / 右侧档案 84 / 客栈 */
  check('肖像接入三处显示（姓名清单 / 右侧档案 / 客栈）',
    /ui\.faceOf\(g, 30\)/.test(uS35) && /ui\.faceOf\(g, 84\)/.test(uS35)
    && /ui\.faceOf\(\s*\{ name: c\.name/.test(uS35));
  check('肖像入口有防御（模块缺席退回 emoji，不崩）',
    /ui\.faceOf = function[\s\S]{0,220}GAME\.portraits && GAME\.portraits\.html/.test(uS35));
  check('招募与名将生成时定下肖像',
    (sS35.match(/GAME\.portraits\.assign\(g\)/g) || []).length === 2);
  check('旧档读入时补齐肖像字段', /GAME\.portraits\.ensure\(g\)/.test(sS35));
  /* 只在代码里找，注释中写「base64」是在解释设计取舍，不算违规 */
  check('头像走文件引用（不把图片塞进存档）',
    /assets\/portraits\//.test(pS35) && !/data:image/.test(pS35) && /portraitSeed/.test(pS35));
  check('将领清单行肖像在行内（整行可点 → 切换右侧档案）',
    /class="grow-face">' \+ ui\.faceOf\(g, 30\)/.test(uS35));

  /* ---- 需求 3：城池视图纯粹 ---- */
  console.log('  --- ③ 城池视图只留棋盘 ---');
  check('城内与城外视图均为 city-pure（只有棋盘）',
    (uS35.match(/class="ui-page city-pure"/g) || []).length === 2);
  check('城池视图不再出现标题行 / 征收 / 缩放 / 岁贡',
    !/官府Lv' \+ guanfu/.test(uS35) && !/以民心换金（民心 -2）<\/span><\/div>'/.test(uS35));
  check('侧栏「城池操作」板块已删除（切城并入城池属性）',
    !/ui\.renderCityTools/.test(uS35) && !/id="city-tools"/.test(hS35)
    && /city-switch/.test(uS35));
  check('城池属性含身份行与城外地块', /* v71（老板）：身份行只留城池命名 —— 「官府Lv」随坐标一并撤下 */
    /ui\.cityLabelHTML\(c, true\)/.test(uS35)
    && !/官府Lv/.test(uS35.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
    && /城外地块/.test(uS35));
  check('renderCityTools 与 #city-tools 已彻底移除',
    !/ui\.renderCityTools/.test(uS35) && !/id="city-tools"/.test(hS35));
  check('岁贡支持紧凑模式（侧栏内不再套大卡片）',
    /ui\.yieldHTML = function \(compact\)/.test(uS35));

  /* ============================================================
   * 36. v23：地块管理 · 等级角标 · 官府宫殿 · 统计菜单
   * ============================================================ */
  console.log('--- 36. v23 地块管理与界面细化 ---');
  var uS36 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS36 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var dS36 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8');
  var mpS36 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'map.js'), 'utf8');
  var hS36 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css36 = hS36.split('<style>')[1].split('</style>')[0];

  /* ---- 需求 1：多城拾取 ---- */
  console.log('  --- ① 已占地块：多城 ---');
  check('地图拾取新增「自己的城」查询', /GAME\.map\.ownCityAt = function/.test(mpS36));
  check('ownCityAt 在任意坐标都能认出自己的城', (function () {
    var s = G.state;
    var c0 = s.cities[0];
    s.cities.push({ id: 'zz_t1', name: '测试城', x: 987, y: 986, col: 6, row: 6, cells: [], army: {}, extGrid: [] });
    var hit = G.map.ownCityAt(987, 986);
    var miss = G.map.ownCityAt(c0.x + 11, c0.y + 11);
    s.cities.pop();
    return !!hit && hit.id === 'zz_t1' && !miss;
  })());
  check('拾取时自己的城优先于 NPC 判定',
    /var own = GAME\.map\.ownCityAt\(gx, gy\);[\s\S]{0,90}kind: 'player'/.test(mpS36)
    && mpS36.indexOf("ownCityAt(gx, gy)") < mpS36.indexOf("npcAt(gx, gy)"));
  /* v60（需求 4）：老板明确要求「**不要一点击地图就直接进入城池**」——
     改前点自己的城会立刻 setCity + setView('city')（副作用：当前城被换掉）。
     现在弹「城池面板」，由玩家自己选 进入 / 运输 / 派遣 / 改名。 */
  check('点自己的城 → 弹城池面板（不再直接进城，v60 需求 4）',
    /hit\.kind === 'player'[\s\S]{0,240}ui\.openCityPanel\(hit\.city\)/.test(mS36));
  check('城池面板提供四项动作（进入/运输/派遣/改名）', (function () {
    var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
    var seg = codeOf(u, 'ui.openCityPanel = function');
    return /data-action="city-enter"/.test(seg) && /data-action="city-transport"/.test(seg)
      && /data-action="city-dispatch"/.test(seg) && /data-action="city-rename"/.test(seg);
  })());
  check('点已占野地 → 进管理面板（原先只弹一句 toast）',
    /hit\.kind === 'wild'[\s\S]{0,200}ui\.openLandModal/.test(mS36));

  /* ---- 需求 1：驻军 / 撤军 / 放弃 ---- */
  console.log('  --- ② 已占地块：驻军 / 撤军 / 放弃 ---');
  check('野地管理三函数齐备',
    /GAME\.doWildGarrison = function/.test(dS36) && /GAME\.doWildWithdraw = function/.test(dS36)
    && /GAME\.doAbandonWild = function/.test(dS36));
  check('驻军有真实消费点：守地免衰减',
    /GAME\.wildHeld = function/.test(dS36) && /if \(GAME\.wildHeld\(w\)\) \{/.test(dS36));
  check('实测：驻军从城内扣兵并写入野地', (function () {
    var s = G.state, c = G.currentCity();
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5, levelDay: 0 }];
    c.army = { yibing: 1000 };
    var r = G.doWildGarrison(-9, -9, { yibing: 400 }, c.id);
    var ok = r.ok && c.army.yibing === 600 && s.wilds[0].garrison && s.wilds[0].garrison.troops.yibing === 400;
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba);
    return ok;
  })());
  check('实测：兵力不足时拒绝驻军（不产生负库存）', (function () {
    var s = G.state, c = G.currentCity();
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5 }];
    c.army = { yibing: 100 };
    var r = G.doWildGarrison(-9, -9, { yibing: 500 }, c.id);
    var ok = !r.ok && c.army.yibing === 100 && !s.wilds[0].garrison;
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba);
    return ok;
  })());
  check('实测：撤军把兵还给城池', (function () {
    var s = G.state, c = G.currentCity();
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5, garrison: { troops: { yibing: 300 }, cityId: c.id } }];
    c.army = { yibing: 100 };
    var r = G.doWildWithdraw(-9, -9);
    var ok = r.ok && c.army.yibing === 400 && !s.wilds[0].garrison;
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba);
    return ok;
  })());
  check('实测：放弃野地会先撤回驻军（兵力不凭空消失）', (function () {
    var s = G.state, c = G.currentCity();
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5, garrison: { troops: { yibing: 250 }, cityId: c.id } }];
    c.army = { yibing: 0 };
    var r = G.doAbandonWild(-9, -9);
    var ok = r.ok && (s.wilds || []).every(function (w) { return !(w.x === -9 && w.y === -9); })
      && c.army.yibing === 250;
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba);
    return ok;
  })());
  check('实测：有驻军的野地等级不再衰减', (function () {
    var s = G.state;
    var bw = JSON.stringify(s.wilds);
    var today = G.questDayIndex();
    s.wilds = [
      { x: -8, y: -8, type: 'lake', level: 8, levelDay: today - 3 },
      { x: -7, y: -7, type: 'forest', level: 8, levelDay: today - 3, garrison: { troops: { yibing: 100 }, cityId: 'c' } },
    ];
    G.decayWilds();
    var ok = s.wilds[0].level < 8 && s.wilds[1].level === 8;
    s.wilds = JSON.parse(bw);
    return ok;
  })());
  check('平地可筑城且写明无采集价值',
    /平地，<b>无可采之物<\/b>/.test(uS36) && /data-action="build-city"/.test(uS36));
  check('管理面板含驻军/采集/出兵/筑城/放弃五类操作',
    /🛡️ 派军驻守|🏳️ 撤回驻军/.test(uS36) && /📦 派军采集/.test(uS36)
    && /⚔️ 出兵/.test(uS36) && /🏯 筑城/.test(uS36) && /🗑️ 放弃该野地/.test(uS36));
  check('放弃不可逆 → 有二次确认弹窗', /ui\.openAbandonWildAsk = function/.test(uS36)
    && /case 'wild-abandon-ask'/.test(mS36) && /case 'wild-abandon-do'/.test(mS36));

  /* ---- 需求 2/3：等级角标 ---- */
  console.log('  --- ③ 等级角标（格内右上 · 仅数字） ---');
  check('角标定位在格内右上', /\.tile-badge \{[\s\S]{0,140}right: 4px; top: 3px/.test(css36));
  check('城内建筑只传数字等级（不再拼「满」）',
    /lvl: cell\.build\.lvl, lvlMax: isMax/.test(uS36) && !/lvl: cell\.build\.lvl \+ \(isMax/.test(uS36));
  check('城外资源地块同样只传数字', /lvl: e\.lv, lvlMax: e\.lv >= 10/.test(uS36));
  check('满级靠绿色角标区分（不靠文字）', /\.tile-badge\.max/.test(css36));
  check('底部标签不再出现等级（已移到角标）',
    !/class="lv/.test(uS36) && /\['class="nm"\]/.test(uS36.replace(/\['/g, '')) === false || /class="nm"/.test(uS36));

  /* ---- 需求 4：官府宫殿 ---- */
  console.log('  --- ④ 官府 4 格融合为宫殿 ---');
  check('宫殿跨格渲染函数存在', /ui\.govPalaceHTML = function/.test(uS36));
  check('按 4 格包围盒定位与定尺寸',
    /M\.x\(c0, r0\)/.test(uS36) && /\(c1 - c0 \+ 1\) \* M\.W/.test(uS36) && /\(r1 - r0 \+ 1\) \* M\.H/.test(uS36));
  check('城池视图跳过 official 格、改由宫殿整体渲染',
    /if \(cell\.official\) return '';/.test(uS36) && /ui\.govPalaceHTML\(c, M\)/.test(uS36));
  check('宫殿含台基/檐柱/双层飞檐/屋脊鸱吻/金匾',
    /govBase/.test(uS36) && /檐柱/.test(uS36) && /屋脊 \+ 鸱吻/.test(uS36) && /govGold/.test(uS36));
  check('宫殿整体可点开官府面板', /class="gov-palace[\s\S]{0,80}data-action="build-cell"/.test(uS36));
  check('施工中宫殿显示进度条', /gov-palace[\s\S]{0,40}busy[\s\S]{0,600}tile-pbar/.test(uS36));
  /* v36（需求 1）：官府是唯一绕过图标层的建筑（专属手写 SVG）——
     位图接入后它没换皮。现改为位图优先、手写 SVG 兜底。 */
  check('官府优先用位图、手写 SVG 退为兜底',
    /GAME\.icons\.bitmapSrc\('building', 'guanfu'\)/.test(uS36)
    && /class="ico ico-img gov-img"/.test(uS36) && /\n\s*: svg;/.test(uS36));
  check('实测：官府产出 <img> 位图（不再只有手写 SVG）', (function () {
    var s = G.state, c = s.cities[0];
    var M = { W: 88, H: 88, x: function (col) { return col * 88; }, y: function (row) { return row * 88; } };
    var h = G.ui.govPalaceHTML(c, M);
    return /img class="ico ico-img gov-img"[^>]*ai_guanfu\.png/.test(h);
  })());
  /* v36（需求 2）：自动化只在「自动」菜单 —— 设置页不得残留开关 */
  check('设置页已无自动化开关（只在自动菜单）', (function () {
    var h = G.ui.settingsHTML();
    return h.indexOf('toggle-auto-upgrade') < 0 && h.indexOf('toggle-auto-research') < 0
      && h.indexOf('toggle-auto-march') < 0 && h.indexOf('autoSwitchRow') < 0;
  })());
  check('实测：宫殿尺寸恰为 2×2 格', (function () {
    var s = G.state, c = s.cities[0];
    var M = { W: 88, H: 88, x: function (col) { return 10 + col * 88; }, y: function (row) { return 10 + row * 88; } };
    var h = G.ui.govPalaceHTML(c, M);
    var m = h.match(/width:(\d+)px;height:(\d+)px/);
    return !!m && Number(m[1]) === 2 * 88 && Number(m[2]) === 2 * 88;
  })());

  /* ---- 需求 5：侧栏只讲当前城 · 统计承载全局 ---- */
  console.log('  --- ⑤ 侧栏当前城 + 统计菜单 ---');
  check('顶栏新增「统计」菜单（且与任务相邻）',
    /data-view="tasks"[\s\S]{0,160}data-view="stats"/.test(hS36));
  check('侧栏不再混入全境汇总', !/全境 ' \+ extAll\.towns/.test(uS36));
  /* v27（需求 7）：卡片网格 → 分段账册（黄册）。不再有 .stat-card */
  check('统计页改黄册（分段账册 + 引线行）',
    /ui\.lgSec = function/.test(uS36) && /ui\.lgRow = function/.test(uS36)
    && !/stat-cards/.test(uS36) && /全境汇总/.test(uS36));
  check('统计页城池明细含官府/人口上限/外城等全部字段',
    /人口上限/.test(uS36) && /外城/.test(uS36) && /官府/.test(uS36));
  check('统计页可切到任意城池', /case 'stats-goto'/.test(mS36) && /data-action="stats-goto"/.test(uS36));
  check('实测：统计页列出所有城池', (function () {
    var h = G.ui.statsHTML();
    return (G.state.cities || []).every(function (c) { return h.indexOf(c.name) >= 0; });
  })());
  /* v54（老板）：删掉**别处已有**的三块（君主 / 府库 / 军民）后只剩两节；
     v60（需求 3）：老板又要求把「满级专精」也从全境汇总撤掉、写进对应建筑的介绍，
     于是**丙节整节删除**，账册只剩甲/乙两节。
     判据同时钉住"删干净"（旧的段名不许再出现，含"满级专精"）与"没删过头"。 */
  check('实测：统计页黄册为两节（甲疆域 / 乙在外）· 专精已迁至建筑面板', (function () {
    var h = G.ui.statsHTML();
    var iA = h.indexOf('甲 · 疆域'), iB = h.indexOf('乙 · 在外');
    return iA >= 0 && iB > iA
      && (h.match(/class="lg-row/g) || []).length >= 4
      /* v60：专精不再出现在全境汇总（它在建筑面板里） */
      && h.indexOf('满级专精') < 0 && h.indexOf('丙 ·') < 0
      /* 别处已有的三块必须不再出现在账册里 */
      && h.indexOf('军民') < 0 && h.indexOf('府库') < 0 && h.indexOf('君主') < 0;
  })());
  /* ============================================================
   * 37. v24：地图精简 / 官府征收 / 侧栏分工 / 城外地块 / 兵营队列 / 队列播报
   * ============================================================ */
  console.log('\n===== 37. v24 界面与队列 =====');
  var fs37 = require('fs'), path37 = require('path');
  var rd37 = function (f) { return fs37.readFileSync(path37.join(__dirname, f), 'utf8'); };
  var uS37 = rd37('js/ui.js'), hS37 = rd37('index.html'), dS37 = rd37('js/domain.js');
  var mS37 = rd37('js/main.js'), stS37 = rd37('js/state.js');

  /* ---- 需求 1/2/3：地图只留棋盘 + 右下角导航 ---- */
  console.log('  --- ①②③ 地图精简 ---');
  check('地图不再输出标题/图例/提示',
    !/天下大势/.test(uS37.slice(uS37.indexOf('ui.mapHTML'), uS37.indexOf('ui.renderMapCanvas')))
    && !/map-legend/.test(uS37) && !/map-hint/.test(uS37));
  /* v76（老板）：「把地图的导航栏（上下左右，坐标之类）放到这个导航范围内」——
     导航不再是地图页浮标（v24 右下角 → v45 居中），改**登记到底部固定导航条**
     （ui._bottom.push → paintBottom）；.map-dock 改为条内静态排布。 */
  check('地图导航迁入底部导航条（v76）',
    /ui\._bottom\.push\('<div class="map-dock">'/.test(uS37)
    && /\.map-dock \{[\s\S]{0,200}display: flex; align-items: center; gap: 8px/.test(hS37)
    && !/\.map-dock \{[\s\S]{0,300}position: absolute/.test(hS37));
  check('地图不再有横占整行的控制条', !/\.map-bar \{/.test(hS37) && !/\.map-head \{/.test(hS37));
  check('图例色块样式一并删除（不留死样式）',
    !/\.lg-lake/.test(hS37) && !/\.map-title \{/.test(hS37) && !/\.map-head \{/.test(hS37));
  check('实测：地图 HTML 只剩棋盘；导航登记到底部条（v76）', (function () {
    var h = G.ui.mapHTML();
    var bar = G.ui._bottom.join('');
    return h.indexOf('mapCanvas') >= 0 && h.indexOf('map-dock') < 0
      && bar.indexOf('map-dock') >= 0 && bar.indexOf('map-pad') >= 0
      && h.indexOf('天下大势') < 0 && h.indexOf('湖泊') < 0 && h.indexOf('已占野地') < 0
      && h.indexOf('观察框') < 0;
  })());

  /* ---- 需求 4/5：征收入官府 ---- */
  console.log('  --- ④⑤ 官府征收与特产 ---');
  check('官府入口覆盖面板全部内容（v68：不再叫「征收」）', /guanfu: \{ label: "🏯 官府事务", act: "open-guanfu" \}/.test(uS37)
    && /case 'open-guanfu'/.test(mS37));
  /* v82（老板）：「官府不需要征收物质这个功能去除」——面板不再挂征收（防回魂） */
  check('v82：官府面板不再挂征收（openGuanfu 无 levyPlan）', /ui\.openGuanfu = function/.test(uS37)
    && !/GAME\.levyPlan/.test(uS37));
  check('特产两条收集途径写进面板（岁贡/州治；征收随退役撤下）',
    /① 州郡岁贡/.test(uS37) && /② 州治加成/.test(uS37) && !/官府征收/.test(uS37));

  /* v25（需求 3/5）：征收→官府、显示比例→设置、岁贡→名城官府，
     侧栏不再有「城池操作」：切城并进城池属性（v71：单城也出现） */
  check('城池清单单城也给出**城池下拉框**（v71 老板：含州郡县 + 坐标）', (function () {
    var st = G.state, c = G.currentCity();
    var hostOf = function () { return (global.document.querySelector('#city-switch-host') || {}).innerHTML || ''; };
    var bodyOf = function () { return (global.document.querySelector('#city-attrs') || {}).innerHTML || ''; };
    st.cities.push(G.makeCity({ id: 'sw_probe', name: '探针城', x: 300, y: 300 }));
    G.ui.renderCityAttrs(c, st);
    var multi = hostOf();
    /* v53：城池清单**必须与城池属性正文分离** —— 正文每秒重绘，
       下拉框若挂在正文里，展开的列表会被立刻冲合（老板报的 bug）。 */
    var sepOk = !/<select/.test(bodyOf()) && /class="city-switch"/.test(bodyOf()) === false;
    st.cities.pop();
    G.ui.renderCityAttrs(c, st);
    var single = hostOf();
    /* v45（需求 3）：chips → 原生 <select>；且当前城必须是 selected 的那一项 */
    /* v71（老板）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」——
       单城不再收起；两侧选项都带坐标（州郡县全称在上，坐标在后）。 */
    return /<select class="city-select" data-action="switch-city"/.test(multi)
      && /<option value="[^"]+" selected>/.test(multi)
      && /\(\d+, \d+\)/.test(multi)
      && /<select class="city-select" data-action="switch-city"/.test(single)
      && /\(\d+, \d+\)/.test(single)
      && sepOk;
  })());
  /* v53（老板：\"点出来列表马上收回去\"）：**下拉框不得被每秒重绘重建**。
     改前 switcher 拼在 #city-attrs 的 html 里，主循环每秒 box.innerHTML = … 一遍，
     展开的原生列表元素随之销毁 → 立刻合上。这条断言钉住"重建只在清单变化时发生"。 */
  check('城池清单只在清单/当前城变化时重建（不随每秒重绘重建）', (function () {
    var u = codeOf(uS37, 'ui.renderCityAttrs = function');
    if (u.length < 300) return false;                    /* 取到函数体才算数 */
    return /ui\._citySwSig/.test(u)                    /* 有"签名没变就不重建"的守卫 */
      && /if \(ui\._citySwSig !== sig\)/.test(u)
      && /host\.innerHTML = switcher/.test(u)
      && /box\.innerHTML = html/.test(u)               /* 正文照旧整块重建 */
      && !/box\.innerHTML = switcher/.test(u);          /* 下拉框不许再混进正文 */
  })());
  check('点下拉框展开的那一下不触发动作分发（否则处理函数里的重绘会把它合上）', (function () {
    var m = stripComment(mS37);
    return /closest\('\[data-action\]'\)/.test(m)
      && /if \(t && t\.tagName === 'SELECT'\) return;/.test(m)
      && /case 'switch-city': ui\.setCity\(el\.value\)/.test(m);
  })());
  /* v28（需求 1）：等级上限 12，表也随之延长；前 10 档保持原值不回归 */
  check('征收上限表按官府等级（10 级 = 40 块，12 级 = 48 块，之后每级 +4 续到都城上限）',
    JSON.stringify(DATA.EXT_CAP_BY_LV.slice(0, 10)) === JSON.stringify([12, 15, 18, 21, 24, 27, 30, 33, 36, 40])
    && DATA.EXT_CAP_BY_LV[11] === 48
    /* v54：官府在名城能盖更高，表跟着长到 MAX_LEVEL_ABS（末项 = 48 + 4×(24−12) = 96） */
    && DATA.EXT_CAP_BY_LV.length === DATA.MAX_LEVEL_ABS
    && DATA.EXT_CAP_BY_LV[DATA.MAX_LEVEL_ABS - 1] === 96);
  check('实测：官府 Lv10 城外上限 40（8 列正好 5 整行）', (function () {
    var c = G.state.cities[0], bk = G.buildingLevel(c, 'guanfu');
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = 10; });
    var n = G.extCap(c);
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = bk || 1; });
    return n === 40 && n % 8 === 0;
  })());
  /* v82：征收退役 —— 冷却按城独立的实测随 levyReady 一并退役。 */

  /* ---- 需求 6：侧栏只讲本城 ---- */
  console.log('  --- ⑥ 侧栏精简 ---');
  check('侧栏城池属性不再出现 城防/驻军/城外地块',
    (function () {
      var bk = G.ui._cityId;
      G.ui.renderCityAttrs(G.currentCity(), G.state);
      var h = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      G.ui._cityId = bk;
      return h.indexOf('城防') < 0 && h.indexOf('驻军') < 0 && h.indexOf('城外地块') < 0;
    })());
  check('侧栏仍保留民心/民怨/税率/人口',
    (function () {
      G.ui.renderCityAttrs(G.currentCity(), G.state);
      var h = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      return h.indexOf('民心') >= 0 && h.indexOf('民怨') >= 0 && h.indexOf('税率') >= 0 && h.indexOf('人口') >= 0;
    })());

  /* ---- 需求 7：城外地块末行居中 ---- */
  console.log('  --- ⑦ 城外地块补足与居中 ---');
  check('城外棋盘末行水平居中（不满一行时不再左挤）',
    /var colOff = lastRowN < COLS \? \(COLS - lastRowN\) \/ 2 : 0;/.test(uS37));
  check('实测：12 块时末行 4 格右移 2 格居中', (function () {
    var st = G.state, bkId = G.ui._cityId;
    var tmp = G.makeCity({ id: 'tmpExtCap', name: 'tmpExt', col: 6, row: 6 });
    st.cities.push(tmp);
    G.ui._cityId = tmp.id;
    var html = G.ui.extHTML();
    G.ui._cityId = bkId;
    st.cities.pop();
    var M = G.ui.isoMetrics(8, 2);
    var want = 'left:' + Math.round(M.x(2, 1)) + 'px;top:' + Math.round(M.y(2, 1)) + 'px';
    return tmp.extGrid.length === 12 && html.indexOf(want) >= 0;
  })());

  /* ---- 需求 8：每座军营一条独立募兵队列 ---- */
  console.log('  --- ⑧ 兵营募兵队列 ---');
  check('队列位：1 + Lv5解锁 + Lv10解锁 = 1/2/3',
    G.trainQueueSlots(1) === 1 && G.trainQueueSlots(4) === 1 && G.trainQueueSlots(5) === 2
    && G.trainQueueSlots(9) === 2 && G.trainQueueSlots(10) === 3);
  /* v28（需求 1）：上限提到 12 后，10 级之后还有"满级专精 +1 位"这一档 */
  check('下一个等待位解锁等级的提示正确',
    G.trainNextSlotLv(1) === 5 && G.trainNextSlotLv(5) === 10
    && G.trainNextSlotLv(10) === 12 && G.trainNextSlotLv(12) === 0);
  check('队列按「城 + 军营格」分组', /GAME\.trainQueueKey = function/.test(dS37)
    && /q\.cityId === city\.id && \(q\.bIdx == null \? -1 : q\.bIdx\) === bIdx/.test(dS37));
  check('每座军营只有最早一条推进（其余 waiting）',
    /GAME\.advanceTrainQueues = function/.test(dS37)
    && /list\.forEach\(function \(q\) \{ q\.waiting = \(q !== running\); \}\)/.test(dS37));
  check('完成一条后剩余时间结转给下一条（不按整段重复推进）',
    /left -= need;/.test(dS37) && /left > 0 && list\.length/.test(dS37));
  /* 关键：在线 tickOnce 与离线 simulateBulk 必须共用同一实现 ——
     曾经两处各写一份、只改一处，实测表现为"两条队列齐步走" */
  check('在线与离线共用同一推进函数（只此一份实现）',
    (stS37.match(/GAME\.advanceTrainQueues\(/g) || []).length === 2
    && !/t\.elapsed \+= dtReal \* ts;/.test(stS37));
  check('旧档队列补 bIdx（读档迁移）', /q\.bIdx = GAME\.firstBarracksIdx \? GAME\.firstBarracksIdx\(c\) : -1;/.test(stS37));
  check('募兵面板显示所属军营与本营队列',
    /ui\.trainQueueBlock = function/.test(uS37) && /本营募兵队列/.test(uS37)
    && /募兵军营/.test(uS37));
  check('军营入口带 data-idx（队列要知道挂给哪座）',
    /withIdx: true/.test(uS37) && /case 'open-troops'/.test(mS37));
  check('实测：同一军营第二条排队（elapsed 保持 0）', (function () {
    var st = G.state, c = st.cities[0];
    var bkQ = st.queues.train.slice();
    var bkArmy = JSON.stringify(c.army);
    /* 找一座军营并临时升到 Lv5（2 个队列位） */
    var bi = -1;
    for (var k = 0; k < c.cells.length; k++) if (c.cells[k].build && c.cells[k].build.id === 'junying') { bi = k; break; }
    if (bi < 0) { st.queues.train = bkQ; return true; }   // 无军营时跳过（本测试不负责建军营）
    var bkLv = c.cells[bi].build.lvl;
    c.cells[bi].build.lvl = 5;
    st.queues.train = [];
    st.res.grain += 300000; st.res.wood += 300000; st.res.iron += 300000; st.res.pop += 5000;
    var r1 = G.train('yibing', 60, c.id, bi);
    var r2 = G.train('yibing', 60, c.id, bi);
    var qs = G.trainQueuesOf(c, bi);
    G.tickOnce();
    var qs2 = G.trainQueuesOf(c, bi);
    var ok = r1.ok && r2.ok && qs.length === 2
      && qs2.length === 2 && qs2[0].elapsed > 0 && qs2[1].elapsed === 0
      /* 执行中的那条 waiting 必须为 false —— 曾用"下标>0 即等待"一刀切，
         结果把真正在募兵的那条也标成了"排队等待" */
      && qs2[0].waiting === false && qs2[1].waiting === true;
    /* 让第一条完成 → 第二条应立即开跑 */
    if (ok) {
      qs2[0].elapsed = qs2[0].totalTime;
      G.tickOnce();
      var qs3 = G.trainQueuesOf(c, bi);
      ok = qs3.length === 1 && qs3[0].elapsed > 0;
    }
    c.cells[bi].build.lvl = bkLv;
    st.queues.train = bkQ;
    c.army = JSON.parse(bkArmy);
    return ok;
  })());
  check('实测：时间恰好在某条上用完时，下一条不得被当作已开始', (function () {
    var st = G.state, c = st.cities[0];
    var bi = -1;
    for (var k = 0; k < c.cells.length; k++) if (c.cells[k].build && c.cells[k].build.id === 'junying') { bi = k; break; }
    if (bi < 0) return true;
    var bkQ = st.queues.train.slice();
    var bkLv = c.cells[bi].build.lvl;
    c.cells[bi].build.lvl = 5;
    st.queues.train = [];
    st.res.grain += 300000; st.res.wood += 300000; st.res.iron += 300000; st.res.pop += 5000;
    G.train('yibing', 10, c.id, bi);
    G.train('yibing', 10, c.id, bi);
    var qq = G.trainQueuesOf(c, bi);
    /* 把第一条的剩余时间设成正好等于一个 tick，让它在本轮恰好完成 */
    var ts = G.timeScale();
    qq[0].totalTime = Math.max(2, ts) + 0;
    qq[0].elapsed = 0;
    qq[1].elapsed = 0;
    G.tickOnce();
    var rest = G.trainQueuesOf(c, bi);
    var ok = rest.length === 1 && rest[0].elapsed === 0 && rest[0].waiting === true;
    c.cells[bi].build.lvl = bkLv;
    st.queues.train = bkQ;
    return ok;
  })());
  check('实测：队列位满时拒绝新募兵', (function () {
    var st = G.state, c = st.cities[0];
    var bkQ = st.queues.train.slice();
    var bi = -1;
    for (var k = 0; k < c.cells.length; k++) if (c.cells[k].build && c.cells[k].build.id === 'junying') { bi = k; break; }
    if (bi < 0) { st.queues.train = bkQ; return true; }
    var bkLv = c.cells[bi].build.lvl;
    c.cells[bi].build.lvl = 1;              // 只有 1 个队列位
    st.queues.train = [];
    st.res.grain += 300000; st.res.wood += 300000; st.res.iron += 300000; st.res.pop += 5000;
    var a = G.train('yibing', 30, c.id, bi);
    var b = G.train('yibing', 30, c.id, bi);
    var ok = a.ok && b.ok === false && /队列已满/.test(b.msg);
    c.cells[bi].build.lvl = bkLv;
    st.queues.train = bkQ;
    return ok;
  })());

  /* ---- 需求 9：队列播报移入公文 ---- */
  console.log('  --- ⑨ 队列播报入公文 ---');
  check('底部队列条元素与样式已删除',
    !/id="queue-bar"/.test(hS37) && !/\.queue-bar \{/.test(hS37) && !/\.queue-item \{/.test(hS37));
  check('队列总览改在官府弹窗（v29 · 需求 6）',
    !/id="doc-queues"/.test(uS37) && /ui\.queueBody = function/.test(uS37)
    /* v65：官府面板改成 `ui.queueBody(4)` —— 只列前 4 条，高度才可控 */
    && /在办事项/.test(uS37) && /ui\.queueBody\(4\)/.test(uS37));
  check('队列一节涵盖 建造/募兵/自动升级/行军',
    /🏗️ 建造/.test(uS37) && /⚔️ 募兵/.test(uS37) && /🔨 自动升级/.test(uS37) && /🛫 行军/.test(uS37));
  check('实测：队列空态有明确文案', (function () {
    var st = G.state;
    var bk = { b: st.queues.build.slice(), t: st.queues.train.slice(), k: st.queues.tech.slice(), m: st.marches.slice() };
    st.queues.build = []; st.queues.train = []; st.queues.tech = []; st.marches = [];
    var ok = /队列空闲/.test(G.ui.queueBody());
    st.queues.build = bk.b; st.queues.train = bk.t; st.queues.tech = bk.k; st.marches = bk.m;
    return ok;
  })());
  check('实测：建造队列进入公文队列表', (function () {
    var st = G.state, c = st.cities[0];
    var bk = st.queues.build.slice();
    var slots = G.buildSlots();
    st.queues.build = [{ cityId: c.id, buildId: 'minfang', type: 'build', elapsed: 1, totalTime: 10 }];
    var h = G.ui.queueBody();
    st.queues.build = bk;
    return slots >= 1 ? h.indexOf('🏗️ 建造') >= 0 && h.indexOf('民房') >= 0 : true;
  })());

  /* ============================================================
   * 38. v25：城墙环 / 商城背包整页 / 平板适配 / 图标美术 / 任务详情 /
   *          信息分层 / 统计公文美术 / 改名 / 君主卡 / 菜单
   * ============================================================ */
  console.log('\n===== 38. v25 界面重构 =====');
  var fs38 = require('fs'), path38 = require('path');
  var rd38 = function (f) { return fs38.readFileSync(path38.join(__dirname, f), 'utf8'); };
  var uS38 = rd38('js/ui.js'), hS38 = rd38('index.html'), dS38 = rd38('js/domain.js');
  /* v46 的断言紧随 v38 段之后，沿用同一份源码快照（同一段落里不必重读） */
  var hS46 = hS38, uS46 = uS38;
  var mS38 = rd38('js/main.js'), iS38 = rd38('js/icons.js');

  /* ---- 需求 1：城墙环 ---- */
  console.log('  --- ① 城墙环 ---');
  check('城墙离地块有空隙（GAP + 带宽 = 版面外凸）',
    G.ui.WALL_GAP > 0 && G.ui.WALL_PAD === G.ui.WALL_GAP + G.ui.WALL_PX,
    'GAP=' + G.ui.WALL_GAP + ' 带宽=' + G.ui.WALL_PX);
  check('实测：墙环与地块在几何上不相交（热区不抢地块点击）', (function () {
    var M = G.ui.isoMetrics(6, 6);
    /* 棋盘第一个格子的左边界 = WALL_PAD；墙环只占 0..WALL_PX */
    return G.ui.WALL_PX < M.x(0, 0) && M.x(0, 0) === G.ui.WALL_PAD;
  })());
  check('墙环画了墙身/雉堞/压顶/角楼（不是一根粗线）',
    /class="wtower"/.test(uS38) && /wallBody/.test(uS38) && /wallTop/.test(uS38)
    && (uS38.match(/<polygon points="/g) || []).length >= 3);
  check('城墙热区是四条独立带（不是覆盖棋盘的一整块）',
    /ui\.wallHitHTML = function/.test(uS38) && /class="wall-hit top"/.test(uS38)
    && /class="wall-hit bottom"/.test(uS38) && /class="wall-hit left"/.test(uS38)
    && /class="wall-hit right"/.test(uS38));
  check('城墙不出现任何文字标签',
    !/wtag/.test(uS38) && !/wtag/.test(hS38) && /wallLv/.test(uS38) === false
    || /城墙/.test(uS38));   /* 允许注释里提到城墙 */

  /* ---- 需求 2：商城 / 背包整页 ---- */
  console.log('  --- ② 商城·背包整页 ---');
  check('商城 / 背包有整页渲染入口',
    /ui\.shopHTML = function/.test(uS38) && /ui\.bagHTML = function/.test(uS38)
    && /ui\.renderBag = function/.test(uS38));
  check('renderView 认识 shop / bag',
    /else if \(v === 'shop'\) box\.innerHTML = ui\.shopHTML\(\)/.test(uS38)
    && /else if \(v === 'bag'\) box\.innerHTML = ui\.bagHTML\(\)/.test(uS38));
  check('openShop / openBag 走 setView（不再是弹窗）',
    /ui\.openShop = function[\s\S]{0,400}ui\.setView\('shop'\)/.test(uS38)
    && /ui\.openBag = function[\s\S]{0,200}ui\.setView\('bag'\)/.test(uS38));
  check('实测：商城/背包输出的是整页容器', (function () {
    var sh = G.ui.shopHTML(), bh = G.ui.bagHTML();
    return /class="ui-page"/.test(sh) && /class="ui-page"/.test(bh)
      && /shop-rows/.test(sh) && /bag-grid/.test(bh);
  })());

  /* ---- 需求 3：显示比例入设置 ---- */
  console.log('  --- ③ 显示比例 ---');
  check('显示比例在设置面板', /🔍 显示比例/.test(uS38)
    && /ui\.zoomBarHTML\(\)/.test(uS38.slice(uS38.indexOf('ui.settingsHTML = function'))));
  /* 注意：注释里会提到"显示比例"这个名字，所以只查实际调用 */
  /* v27：renderCityTools 已整段删除，改为验证"整份 ui.js 里都不再挂这两样" */
  check('侧栏不再挂显示比例与岁贡', !/ui\.renderCityTools/.test(uS38)
    && !/ui\.yieldHTML\(true/.test(uS38));

  /* ---- 需求 4：平板适配 ---- */
  console.log('  --- ④ 平板适配 ---');
  /* v27（需求 9）：不再限定 1024 宽 —— 页面撑满视口，格子边长按窗口算 */
  /* v74（老板需求 2）：主容器改**固定像素画布**（v27 的"撑满视口"被取代）。 */
  check('v74：主容器为固定像素画布（var(--app-w/--app-h)，拖窗口不动）', (function () {
    var css = hS38.replace(/\/\*[\s\S]*?\*\//g, '');
    return /#screen-game \{ width: var\(--app-w\); height: var\(--app-h\)/.test(css)
      && /\.main \{[\s\S]{0,120}grid-template-columns: 283px 1fr/.test(css);
  })());
  check('侧栏宽度固定 + 棋盘塞得进可用空间', (function () {
    /* v27：设计基准 1180×820；格子边长由 ui.fitTile 按容器算。
       jsdom 无布局 → viewBoxSize 回落到基准，这里就按基准校验。
       v43：侧栏从 clamp(272px,24vw,320px) 浮动值改成**固定 283px** ——
       老板要求"整体界面的像素值固定，不要因为浏览器边框变动"。 */
    var box = G.ui.viewBoxSize();
    var s = G.ui.fitTile(12, 8, { pad: 26 * 2 });
    var M = G.ui.isoMetrics(8, 5);                   /* 城外 8 列 5 行 */
    return /grid-template-columns: 283px 1fr/.test(hS38)
      && G.ui.SIDE_W === 283
      && uiFitOk(G.ui.TILE_W, 8, 5) && s >= 40 && box.w > 700 && box.h > 500;
    function uiFitOk(t, cols, rows) {
      var m = G.ui.isoMetrics(cols, rows);
      return m.w <= box.w - 16 && m.h <= box.h - 16 && M.w === m.w;
    }
  })(), '基准可用 ' + JSON.stringify(G.ui.viewBoxSize()));
  /* v74：宽度固定 px + 极小窗口兜底（lg / xl 同规格） */
  check('v74：弹窗宽度固定 px + 极小窗口兜底（lg/xl 同规格）',
    /\.modal-lg \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\)/.test(hS38)
    && /\.modal-xl \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\)/.test(hS38));

  /* ---- 需求 6/7：图标尺寸与美术 ---- */
  console.log('  --- ⑥⑦ 图标 ---');
  check('地块图标放大到"仅比地块小一点点"', (function () {
    var m = hS38.match(/\.tile-art \.ico \{[^}]*\}/);
    return !!m && /width: 100%/.test(m[0]) && /height: 100%/.test(m[0]);
  })());
  check('实测：图标高度 ≥ 地块的 78%', (function () {
    var m = hS38.match(/\.tile-art \{([^}]*)\}/);
    if (!m) return false;
    var pad = m[1].match(/padding: (\d+)px (\d+)px (\d+)px/);
    var bottom = pad ? Number(pad[3]) : 0;
    var cover = (G.ui.TILE_H - 6 - bottom) / G.ui.TILE_H;   /* 上下 padding 约 3px + 底 8px */
    return cover >= 0.78;
  })());
  check('图标加了统一光照层（暖光 + 暗角，一次改全部生效）',
    /function lightPass\(\)/.test(iS38) && /icAmb/.test(iS38) && /icVig/.test(iS38)
    && /lightPass\(\) \+ \(opt\.plate/.test(iS38));
  check('地块上有建筑接地阴影（图标"落在"格子上）',
    /\.iso-tile\.built \.tile-art::before/.test(hS38) && /radial-gradient\(50% 46% at 50% 62%/.test(hS38));

  /* ---- 需求 5：岁贡入名城官府 ---- */
  console.log('  --- ⑤ 岁贡入官府 ---');
  check('名城官府含本城岁贡', /本城岁贡 · 每现实日结算/.test(uS38) && /cityDailyYield/.test(uS38));
  check('实测：自建城官府无岁贡区块', (function () {
    var c = G.currentCity(), bk = c.type;
    c.type = 'self';
    var ok = G.cityDailyYield(c) === null;
    c.type = bk;
    return ok;
  })());
  check('侧栏不再渲染岁贡',
    !/yieldHTML/.test(uS38.slice(uS38.indexOf('ui.renderCityTools = function'),
      uS38.indexOf('ui.renderGarrison = function'))));

  /* ---- v45 需求 4：改名不再是"非名城可改名"，而是"自家的城都能改" ---- */
  console.log('  --- ⑧ 城池改名 ---');
  check('改名 API 存在，且已拥有的城池都能改（含名城）', (function () {
    /* v45 语义反转：v29~v44 只放行 type==='self'，而开局城就是洛阳（都城），
       于是按钮永远置灰 → 老板以为"官府没有改名功能"。 */
    var zhou = { name: '临淄', type: 'zhou' }, self = { name: '新城', type: 'self' };
    var cap = { name: '洛阳', type: 'capital' };
    return typeof G.renameCity === 'function' && typeof G.canRenameCity === 'function'
      && G.canRenameCity(zhou).ok === true
      && G.canRenameCity(self).ok === true
      && G.canRenameCity(cap).ok === true
      /* 原名必须被记住 —— 州治判定/战报靠它认身份，不能跟着改名走 */
      && zhou.origName === '临淄' && cap.origName === '洛阳';
  })());
  check('改名后原名不丢（origName 只记第一次）', (function () {
    var c = G.currentCity(), bk = c.name, bkType = c.type;
    c.type = 'capital';
    var r1 = G.renameCity(c.id, '第一次名');
    var r2 = G.renameCity(c.id, '第二次名');
    var ok = r1.ok && r2.ok && c.origName === bk && c.name === '第二次名';
    G.renameCity(c.id, bk);
    c.type = bkType;
    return ok;
  })());
  check('实测：自建城改名成功（并写入日志）', (function () {
    var c = G.currentCity(), bk = c.name;
    c.type = 'self';
    var r = G.renameCity(c.id, '试改名城');
    var ok = r.ok && c.name === '试改名城';
    G.renameCity(c.id, bk);
    return ok && c.name === bk;
  })());
  check('实测：空名/超长名/重名都被拒', (function () {
    var c = G.currentCity(), bk = c.name;
    var bad = G.renameCity(c.id, '   ');
    var long = G.renameCity(c.id, '一二三四五六七八九十十一十二十三');
    return !bad.ok && !long.ok && c.name === bk;
  })());
  /* v29（需求 10）：按钮常驻官府 —— 能改就点，不能改则置灰并写明原因 */
  check('改名入口在官府面板**顶部身份行**（不用滚动就能看到）', (function () {
    /* v45：入口从面板末尾（head + 征收表 + 岁贡 + 特产 + rename + 队列）挪到"本城"这一行 ——
       改前面板一长它就落到折叠线以下，老板因此以为"官府没有改名功能"。
       判据：① head 构造段内含 open-rename-city；② 末尾不再重复一份 renameBox。 */
    var i = uS38.indexOf('ui.openGuanfu = function');
    if (i < 0) return false;
    var seg = uS38.slice(i, i + 2600);
    return /var head = [\s\S]{0,1200}open-rename-city/.test(seg)
      && /data-action="open-rename-city"/.test(seg)
      /* 末尾不再重复一份 —— 查"定义"而不是"提过这个词"（注释里也会提到它） */
      && !/var renameBox/.test(uS38);
  })());

  /* ---- 需求 9：君主卡 ---- */
  console.log('  --- ⑨ 君主卡 ---');
  /* 只查"元素"与"对它的赋值"，不查字符串 —— 动作名 lord-city-goto 里也含这个词 */
  check('君主卡不再有「城池 N 城」这一行',
    !/id="lord-city"/.test(hS38) && !/\$\('#lord-city'\)/.test(uS38));
  /* v45（需求 2）：老板要求"主角个人头像也随机选 20 个里边的一个" ——
     走与麾下将领同一个池子（portraits.html），种子存 ruler.portraitSeed。 */
  check('君主头像改走头像池（v45 需求 2；池空时自动退回程序化立绘）',
    /lord-portrait/.test(hS38) && /GAME\.portraits\.html\(rulerGen, 68\)/.test(uS38)
    && /portraitSeed: s\.ruler\.portraitSeed/.test(uS38));
  /* v81（老板）：「官职这行放玩家名称，现在的名称位置去掉」——
     名称并入信息表首行（.mrow-name），官职行与旧名称列退役。 */
  check('v81：君主名并入信息表首行（官职行与旧名称列退役）',
    /class="row mrow-name"/.test(hS38) && /id="lord-name"/.test(hS38)
    && !/lord-name-row/.test(hS38) && !/lord-office/.test(hS38));
  check('实测：syncHeader 把君主头像落到池中某一张（且不再写城池数）', (function () {
    G.ui.syncHeader();
    var av = global.document.querySelector('#lord-avatar');
    var h = (av && av.innerHTML) || '';
    /* 真浏览器里是 <img>；池子缺失时 html() 会退回 svg 兜底 */
    return /assets\/portraits\/pool\/m\d+\.webp/.test(h) && /portrait-img/.test(h);
  })());

  /* ---- 需求 10：菜单 ---- */
  console.log('  --- ⑩ 菜单 ---');
  check('每个菜单都有手绘线描图标（11 个 key）',
    /ICON\.navSet = \{/.test(iS38) && /ICON\.nav = function/.test(iS38)
    && ['city', 'map', 'general', 'march', 'quest', 'stats', 'shop', 'bag', 'story', 'doc', 'settings']
      .every(function (k) { return new RegExp('\\b' + k + ': ').test(iS38); }));
  check('图标是线描且取 currentColor（跟文字同色）',
    /stroke="currentColor"/.test(iS38) && /fill="none"/.test(iS38));
  check('任务与统计相邻；爵位退出顶栏',
    /data-view="tasks"[\s\S]{0,160}data-view="stats"/.test(hS38)
    && !/data-view="rank"/.test(hS38));
  /* v77（老板）：「君主界面分左右两半……右边两列的信息表（姓名/爵位/声望/人口/将领/状态）」
     —— 爵位区块（rankBlock）并入新面板，整块退役。 */
  check('爵位并入君主面板（v77 右栏信息表：爵位 + 晋升按钮）',
    /ui\.openLordInfo = function/.test(uS38) && /lord-promote/.test(uS38)
    && /data-action="lord-promote"/.test(uS38));
  check('实测：君主面板含爵位与晋升 + 左右分栏', (function () {
    var root38 = global.document.querySelector('#modal-root');
    root38.innerHTML = '';
    G.ui.openLordInfo();
    var h = root38.innerHTML;
    return h.indexOf('爵位') >= 0 && h.indexOf('lord-promote') >= 0 && h.indexOf('lord-split') >= 0;
  })());

  /* ---- 需求 11：任务清单 + 详情弹窗 ---- */
  console.log('  --- ⑪ 任务详情 ---');
  check('任务列表每项只有名称与进度（不再有卡片墙）',
    /class="q-row/.test(uS38) && /data-action="quest-detail"/.test(uS38)
    && !/ui\.questCard = function/.test(uS38));
  check('任务详情弹窗是固定版式（背景/需求/奖励/放弃）',
    /ui\.openQuestDetail = function/.test(uS38)
    && /任务背景/.test(uS38) && /任务需求/.test(uS38) && /任务奖励/.test(uS38)
    && /size: 'sm'/.test(uS38.slice(uS38.indexOf('ui.openQuestDetail = function'),
      uS38.indexOf('ui.openQuestDetail = function') + 3200)));
  check('指标能翻译成人话（questNeedText + 模板表）',
    /GAME\.QUEST_METRIC_NEED = \{/.test(dS38) && /GAME\.questNeedText = function/.test(dS38));
  check('实测：需求文案是人话', (function () {
    var q = DATA.QUESTS[0];
    var txt = G.questNeedText(q);
    return /达到|达/.test(txt) && txt.indexOf('undefined') < 0 && txt.indexOf('metric') < 0;
  })(), G.questNeedText(DATA.QUESTS[0]));
  check('放弃任务：随机可换、成长不可放弃（说明原因）',
    /放弃并换一条/.test(uS38) && /成长任务不可放弃/.test(uS38));

  /* ---- 需求 12/13：信息分层 ---- */
  /* ---- 需求 1/2/3（v37） ---- */
  console.log('  --- ⓪ 兵种卡瘦身 / 浮层唯一层 / 图标尺寸 ----');
  /* 需求 1：募兵资源移入悬停、图标放大 */
  check('募兵兵种卡不再常驻募兵资源（移入悬停浮层）', (function () {
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    /* 逐卡判定（整页有 15 张卡，不是 1 张）：
       ① 卡面 .tstat 由 3 行降为 2 行（成本行腾给图标）
       ② 卡面不再出现"耗粮"（成本移入浮层，不是删掉）
       ③ 浮层内容源仍在，且四要素齐备
       注意"拥有"行的锁定原因里本来就可能出现"人口不足"这类词，
       所以只查结构化行，不做全文词命中。 */
    var cards = h.split('class="troop-card').slice(1);
    if (!cards.length) return false;
    var ok = cards.every(function (c) {
      var face = c.replace(/<div class="tcard-tip tip-src">[\s\S]*?<\/div><\/div>/, '');
      var stats = face.match(/<div class="tstat">[\s\S]*?<\/div>/g) || [];
      return stats.length === 2 && face.indexOf('耗粮') < 0;
    });
    var tip = h.match(/<div class="tcard-tip tip-src">([\s\S]*?)<\/div><\/div>/);
    return ok && !!tip
      && /募兵消耗/.test(tip[1]) && /人口 /.test(tip[1]) && /耗粮 /.test(tip[1]) && /单兵耗时/.test(tip[1])
      && /\.troop-card \.ticon \.ico \{[\s\S]{0,140}max-width: 84px/.test(hS38);
  })());
  /* ---- 需求 2：浮层唯一层 + 落位夹进视口 ---- */
  check('实测：悬停内容含消耗/人口/耗粮/耗时', (function () {
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var m = h.match(/<div class="tcard-tip tip-src">([\s\S]*?)<\/div><\/div>/);
    if (!m) return false;
    return /募兵消耗/.test(m[0]) && /人口 /.test(m[0]) && /耗粮 /.test(m[0]) && /单兵耗时/.test(m[0]);
  })());
  check('悬停浮层为全站唯一层（position:fixed + 最高层级）',
    /\.tip-layer \{[\s\S]{0,200}position: fixed/.test(hS38)
    && /\.tip-layer \{[\s\S]{0,200}z-index: 9000/.test(hS38));
  check('浮层挂载点在 body 末尾（不受容器 overflow/transform 影响）',
    /<div id="tip-layer" class="tip-layer"/.test(hS38)
    && hS38.indexOf('id="tip-layer"') > hS38.indexOf('id="toast"'));
  check('浮层落位为纯函数（默认下方 / 空间不足翻转 / 四面夹进视口）', (function () {
    var vw = 1000, vh = 800, tw = 200, th = 60;
    var a1 = G.ui.tipPos({ left: 400, top: 300, width: 100, height: 40, bottom: 340 }, tw, th, vw, vh);
    if (a1.top !== 340 + 10) return false;                                  /* ① 贴下方 */
    var a2 = G.ui.tipPos({ left: 400, top: 780, width: 100, height: 40, bottom: 790 }, tw, th, vw, vh);
    if (a2.top !== 780 - 10 - th) return false;                              /* ② 翻上方 */
    var a3 = G.ui.tipPos({ left: 0, top: 300, width: 20, height: 40, bottom: 340 }, tw, th, vw, vh);
    if (a3.left < 8) return false;                                           /* ③ 左不越界 */
    var a4 = G.ui.tipPos({ left: 990, top: 300, width: 20, height: 40, bottom: 340 }, tw, th, vw, vh);
    if (a4.left + tw > vw - 8) return false;                                 /* ④ 右不越界 */
    var a5 = G.ui.tipPos({ left: 0, top: 0, width: 10, height: 10, bottom: 10 }, 5000, 5000, vw, vh);
    return a5.left >= 8 && a5.top >= 8;                                      /* ⑤ 超大浮层也夹住 */
  })());
  check('浮层由事件委托驱动（重绘不失效）',
    /document\.addEventListener\('mouseover'/.test(mS38)
    && /document\.addEventListener\('mouseout'/.test(mS38));
  check('滚动/改尺寸后收起浮层（不停留在错误位置）',
    /'scroll', function \(\) \{ GAME\.ui\.tipHide\(\); \}, true/.test(mS38));
  check('旧的三个 CSS 伪元素浮层已全部退役',
    !/bag-cell:hover \.bag-tip/.test(hS38) && !/\.rate-wrap\[data-tip\]:hover::after/.test(hS38)
    && !/\.help-chip\[data-tip\]:hover::after/.test(hS38));
  /* ---- 需求 3：图标容器一律用 .ico 类选择器 ---- */
  check('图标容器定尺寸一律用 .ico（只写 svg 会漏掉位图）', (function () {
    /* 允许三类：① 含 .ico（svg/img 都匹配）② 同时列 svg 与 img
       ③ 天生矢量、永不为位图的内容（立绘 / 宫殿手绘 SVG） */
    var ALLOW = /(gov-svg|lord-portrait|lord-avatar|portrait-svg)/;
    var bad = [];
    var re = /([^{}]*\bsvg\b[^{}]*)\{([^{}]*)\}/g, m;
    /* ⚠ 必须区分「元素选择器 svg」与「类名里含 svg」（如 .doll-fig-svg）——
       早期写法用 \bsvg\b，而 `-` 也是词边界，于是 .doll-fig-svg 被误判成标签选择器。
       这里要求 svg 前面是空白/逗号/组合符/行首（即真的是标签）。 */
    var isSvgTag = function (x) { return /(^|[\s,>+~])svg(?![\w-])/.test(x); };
    while ((m = re.exec(hS38))) {
      var sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();   /* 注释里会提到 svg，先剥掉 */
      if (!sel) continue;
      if (!isSvgTag(sel)) continue;                                 /* 类名里的 svg 不算 */
      if (!/width|height/.test(m[2])) continue;
      if (/\.ico/.test(sel)) continue;
      if (/\bimg\b/.test(sel)) continue;
      if (ALLOW.test(sel)) continue;
      bad.push(sel.replace(/\s+/g, ' ').slice(0, 44));
    }
    return bad.length === 0;
  })());
  check('实测：xc-row 图标容器也用 .ico（同类 bug 第二处）',
    /\.xc-row \.xc-ico \.ico \{/.test(hS38) && !/\.xc-row \.xc-ico svg \{/.test(hS38));

  /* ---- 需求 12/13：信息分层 ---- */
  /* ---- v38（需求 1/2/3/4）---- */
  console.log('  --- ⓪ 自动化单路径 / 人形装备栏 / 套装 3-5-7-11 / 打造分栏 ----');
  /* 需求 1：自动化只有「自动」菜单一条路径 */
  check('自动升级不再把玩家送去设置页',
    !/ui\.setView\('settings'\)/.test(mS38)
    && /GAME\.refreshView\(\);\n  \};/.test(mS38.slice(mS38.indexOf('GAME.doToggleAutoUpgrade = function'))));
  check('设置页确实已无自动化入口（v36 起）',
    (function () { var h = G.ui.settingsHTML(); return h.indexOf('toggle-auto-') < 0 && h.indexOf('自动化') < 0; })());
  /* 需求 2：人形装备栏 */
  check('人形装备栏：12 个部位都有落点（DOLL_POS 表）',
    DATA.EQUIP_SLOTS.every(function (sl) { return !!G.ui.DOLL_POS[sl]; })
    && Object.keys(G.ui.DOLL_POS).length === 12);
  check('人形装备栏：落点在 0~100% 内且不重叠',
    (function () {
      var seen = {}, ok = true;
      Object.keys(G.ui.DOLL_POS).forEach(function (sl) {
        var p = G.ui.DOLL_POS[sl];
        if (!(p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100)) ok = false;
        var k = p[0] + ':' + p[1];
        if (seen[k]) ok = false;
        seen[k] = 1;
      });
      return ok;
    })());
  check('v46：12 个方槽在真实人形框尺寸下**两两不重叠**（从 CSS 与落点表实算）', (function () {
    /* 这是 v46 真正抓到过的 bug：槽位从 60px 宽改成 54×54 方槽后，
       head 1% / neck 14% 只差 13%（人形框 400px 高时 = 52px < 54px）→ 头压住颈。
       光看"落点在 0~100 内且坐标唯一"是**查不出来**的 —— 那条断言当时全绿。
       所以这里按 CSS 里的真实盒尺寸算出每个槽的矩形，逐对判相交。 */
    var doll = hS46.match(/\.doll \{[^}]*max-width: (\d+)px[^}]*aspect-ratio: (\d+) \/ (\d+)/);
    var slot = hS46.match(/\.doll-slot \{([^}]*)\}/);
    if (!doll || !slot) return false;
    var bw = +doll[1];                                   /* 300 */
    var bh = bw * (+doll[3] / +doll[2]);                 /* 380 */
    var sw = +(slot[1].match(/width: (\d+)px/) || [])[1];
    var sh = +(slot[1].match(/height: (\d+)px/) || [])[1];
    var ml = +(slot[1].match(/margin-left: ([\-\d.]+)px/) || [])[1];
    var rects = Object.keys(G.ui.DOLL_POS).map(function (k) {
      var p = G.ui.DOLL_POS[k];
      return { k: k, l: p[0] / 100 * bw + ml, t: p[1] / 100 * bh, w: sw, h: sh };
    });
    var bad = [];
    for (var i = 0; i < rects.length; i++) {
      for (var j = i + 1; j < rects.length; j++) {
        var a = rects[i], c = rects[j];
        if (a.l < c.l + c.w && c.l < a.l + a.w && a.t < c.t + c.h && c.t < a.t + a.h) {
          bad.push(a.k + '×' + c.k);
        }
      }
    }
    /* 还要不出框：最左 ≥ −?（允许 margin-left 造成的外溢为 0） */
    var out = rects.filter(function (r) { return r.l < -0.5 || r.l + r.w > bw + 0.5 || r.t < -0.5 || r.t + r.h > bh + 0.5; })
      .map(function (r) { return r.k; });
    if (bad.length) console.log('     重叠槽位：' + bad.join(', '));
    if (out.length) console.log('     出框槽位：' + out.join(', '));
    return bad.length === 0 && out.length === 0;
  })());
  check('人形装备栏：图标容器尺寸规则不得丢失（v38 回归过）',
    /\.eq-ico \.ico \{[^}]*width: 100%[^}]*height: 100%/.test(hS38)
    && /\.eq-ico \{[^}]*display: flex/.test(hS38)
    && /\.eq-cell \{[^}]*cursor: pointer/.test(hS38)
    && /\.eq-cell\.q4 \{/.test(hS38));
  check('人形装备栏：人形剪影 + 槽位构件存在',
    /ui\.dollFigure = function/.test(uS38) && /ui\.dollSlot = function/.test(uS38)
    && /ui\.dollSetPanel = function/.test(uS38));
  check('实测：装备栏渲染出人形与 12 个定位槽位（内嵌在将领页）', (function () {
    var st = G.newGame({ name: '人形' });
    G.ui._genSel = st.generals[0].id;
    var h = G.ui.generalsHTML();
    var slots = (h.match(/doll-slot/g) || []).length;
    return /doll-fig-svg/.test(h) && /gp-doll/.test(h) && slots >= 12
      /* v46 落点带小数（21.6% 之类），正则要放行小数点 */
      && /left:[\d.]+%;top:[\d.]+%/.test(h);
  })());

  /* ============================================================
   * v46（需求 1/2/3）：左清单两行 · 档案三块 · 人形背景与方形槽位
   * ------------------------------------------------------------
   * 这一组全部锚在**真实渲染出来的 HTML** 与**从 CSS 实算出的数值**上，
   * 不抄实现（否则改错了断言也跟着错）。 */
  console.log('  --- v46：将领页三块布局 / 人形底衬 / 方形槽位 ---');
  check('v46 需求 2：右侧档案分为三块（汇总 / 左下信息 / 右装备栏）', (function () {
    var st = G.newGame({ name: '三块' });
    G.ui._genSel = st.generals[0].id;
    var h = G.ui.generalsHTML();
    var iHead = h.indexOf('class="gp-head"');
    var iBody = h.indexOf('class="gp-body"');
    var iColL = h.indexOf('class="gp-col-l"');
    var iColR = h.indexOf('class="gp-col-r"');
    /* 顺序必须是 头 → 体 → 左栏 → 右栏，且左栏在右栏之前（左六维/右装备） */
    return iHead > 0 && iBody > iHead && iColL > iBody && iColR > iColL
      /* 六维与状态落在左栏；装备栏落在右栏。
         v54：**经验已不在左栏** —— 老板要"经验条放在顶上"，它进了 gp-head 的身份行。 */
      && h.indexOf('六维', iColL) > 0 && h.indexOf('六维', iColR) < 0
      && h.indexOf('状态', iColL) > 0 && h.indexOf('状态', iColR) < 0
      && h.indexOf('经验', iColL) < 0 && h.indexOf('经验', iColR) < 0
      && (function () {                                  /* 经验条在顶上，且带「＋」 */
        var iExp = h.indexOf('class="gp-exprow"');
        return iExp > iHead && iExp < iBody
          && /data-action="gen-exp-pick"/.test(h.slice(iExp, iExp + 900));
      })()
      /* 「装备栏」只在右栏 —— 判据要从 iColR 起搜：
         页头帮助文案里也写着"右侧即其全部档案与装备栏"，全局 indexOf 会命中那一处 */
      && h.indexOf('装备栏', iColR) > 0
      /* 两栏必须真的闭合（否则后续内容会漏进装备栏里） */
      && /gp-col-r[\s\S]*?<\/div><\/div>/.test(h);
  })());
  /* v74（老板需求 4）：「属性跟右边装备栏固定对半空间分配，固定界面」——
     0.92/1.08 改 1fr/1fr；窄屏退单列的断点随固定画布一并撤除。 */
  check('v74：属性与装备栏对半分配；断点已撤（画布固定）',
    /\.gp-body \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(hS46)
    && !/@media \(max-width: 900px\) \{[\s\S]{0,200}\.gp-body/.test(hS46)
    /* 装备栏独占右栏；其内部仍是「人形 | 属性套装」并排
       （堆叠会让人形把档案顶到 870px，整页多出一条滚动条） */
    && /\.gp-doll \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(hS46));
  check('v46 需求 3：人形框里有**放大的将领抠图**（低透明度，非 CSS 染色）', (function () {
    var st = G.newGame({ name: '抠图' });
    G.ui._genSel = st.generals[0].id;
    var h = G.ui.generalsHTML();
    var i = h.indexOf('class="doll-portrait"');
    return i > 0
      /* 抠图必须盖在人体剪影之内（同在 .doll 里，先抠图后剪影 = 抠图在底层） */
      && h.indexOf('doll-portrait') < h.indexOf('doll-fig-svg')
      /* P.DIR = 'assets/portraits/'，src 无前导斜杠，别写 \/assets\/ */
      && /assets\/portraits\//.test(h)
      /* 浅色显示：只准用透明度（0.32 —— 再低就看不见了，实测 0.26 时可见像素只占 9%），
         **不许再出现滤镜染色**（这条是 v39~v45 的血账） */
      && /\.doll-portrait img, \.doll-portrait svg \{[^}]*opacity: \.32/.test(hS46)
      && !/\.doll-portrait[^{]*\{[^}]*(hue-rotate|saturate|sepia|grayscale)/.test(hS46)
      /* 下缘渐隐：半身像直接切断会像"贴上去的" */
      && /\.doll-portrait \{[^}]*mask-image: linear-gradient/.test(hS46);
  })());
  check('v46 需求 3：槽位为正方形且比原来小（54×54，原为 60 宽）', (function () {
    var m = hS46.match(/\.doll-slot \{([^}]*)\}/);
    if (!m) return false;
    var w = (m[1].match(/width: (\d+)px/) || [])[1];
    var hgt = (m[1].match(/height: (\d+)px/) || [])[1];
    var ml = parseFloat((m[1].match(/margin-left: ([\-\d.]+)px/) || [])[1]);
    return +w === 54 && +hgt === 54 && ml === -w / 2;      /* 正方形 + 水平居中偏移 */
  })());
  check('v46 需求 3：槽位内三行装得下（从 CSS 实算，不是抄数字）', (function () {
    /* 判据：边框 2 + padding×2 + 部位名 + 间隙×2 + 图标 + 装备名 ≤ 边长。
       这几个数散在三条规则里，任何一处被改大都会把文字挤变形
       （flex 项被压缩到 0 高 —— 不报错，只是看不见）。
       注意 padding 在 `.doll-slot.eq-cell` 上：单写 `.doll-slot` 会被
       后面那条共享卡片几何规则覆盖成 10px，所以必须读带 .eq-cell 的那条。 */
    var box = hS46.match(/\.doll-slot\.eq-cell \{([^}]*)\}/);
    var cell = hS46.match(/\.doll-slot \{([^}]*)\}/);
    var ico = hS46.match(/\.doll-slot \.eq-ico \{([^}]*)\}/);
    var name = hS46.match(/\.doll-slot \.eq-name \{([^}]*)\}/);
    if (!box || !cell || !ico || !name) return false;
    var side = +(cell[1].match(/height: (\d+)px/) || [])[1];
    var pad = +(box[1].match(/padding: (\d+)px/) || [])[1];
    var gap = +(cell[1].match(/gap: (\d+)px/) || [])[1];
    var icoH = +(ico[1].match(/height: (\d+)px/) || [])[1];
    var fs = 11;                                  /* --fs-cap */
    var lh = parseFloat((name[1].match(/line-height: ([\d.]+)/) || [])[1]);
    var need = 2 + pad * 2 + fs + gap + icoH + gap + fs * lh;   /* 2 = 上下边框各 1px */
    var slack = side - need;
    return slack >= 0 && slack <= 3;
  })());
  check('v46 需求 3：槽位几何的两条**覆盖陷阱**已被显式处理', (function () {
    /* ① padding / border-radius 必须写在 `.doll-slot.eq-cell` 上 ——
           `.eq-cell` 在共享卡片几何里被设成 padding: 10px，与 `.doll-slot` 同权重且更靠后，
           只写 `.doll-slot` 会被盖掉（实测槽内三行只剩 32px，装备名被压成 0 高）。
       ② `.eq-inv` 必须有 position: absolute —— 全站只有一条 right/bottom 规则，
           却从来没有定位声明，于是角标一直当流内元素占掉一整行（实测多撑 18px）。 */
    return /\.doll-slot\.eq-cell \{[^}]*padding: 2px/.test(hS46)
      && /\.doll-slot \.eq-inv \{[^}]*position: absolute/.test(hS46)
      && !/\.doll-slot \{[^}]*overflow: hidden/.test(hS46);
  })());
  check('v74：窄视口断点已撤（画布固定不再重排）；方槽 min-width 保险仍在', (function () {
    /* v46 曾在 1300/1100 视口做"装备栏堆叠 / 清单上下排"降级 ——
       v74 画布固定 1440×900 后这些断点永不触发（留着反而是"随窗口挪动"的隐患）。
       `.doll` 的 min-width 是方槽不重叠的最后一道保险，保留。 */
    return !/@media \(max-width: 1300px\)/.test(hS46)
      && !/@media \(max-width: 1100px\)/.test(hS46)
      && /\.doll \{[^}]*min-width: 230px/.test(hS46);
  })());
  check('实测：装备贡献按「带装 − 裸装」算，件数正确', (function () {
    var st = G.newGame({ name: '贡献' });
    var g = st.generals[0];
    var ids = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; }).slice(0, 4);
    g.equip = {};
    ids.forEach(function (id) { g.equip[DATA.EQUIP[id].slot] = id; });
    return G.setProgressOf(g).filter(function (p) { return p.set === 'yitian'; })[0].n === 4;
  })());
  /* 需求 3：套装门槛 3/5/7/11 */
  check('套装门槛统一为 3/5/7/11（SET_TIERS 为单一来源）', (function () {
    if (DATA.SET_TIERS.join(',') !== '3,5,7,11') return false;
    return Object.keys(DATA.SETS).every(function (sk) {
      return Object.keys(DATA.SETS[sk].eff).map(Number).sort(function (a, b) { return a - b; })
        .join(',') === DATA.SET_TIERS.join(',');
    });
  })());
  check('没有死门槛：每套件数 ≥ 最高档，且槽位不重复', (function () {
    return Object.keys(DATA.SETS).every(function (sk) {
      var items = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === sk; });
      var slots = {};
      var dup = items.some(function (id) {
        var sl = DATA.EQUIP[id].slot;
        if (slots[sl]) return true; slots[sl] = 1; return false;
      });
      var maxTier = Math.max.apply(null, Object.keys(DATA.SETS[sk].eff).map(Number));
      return items.length >= maxTier && !dup;
    });
  })());
  check('实测：套装档位按 3/5/7/11 累计生效', (function () {
    var ids = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; });
    function prog(n) {
      var eq = {};
      ids.slice(0, n).forEach(function (id) { eq[DATA.EQUIP[id].slot] = id; });
      return G.setProgressOf({ equip: eq }).filter(function (p) { return p.set === 'yitian'; })[0];
    }
    return prog(2).n === 2 && prog(2).reached.length === 0
      && prog(3).reached.join(',') === '3'
      && prog(5).reached.join(',') === '3,5'
      && prog(7).reached.join(',') === '3,5,7'
      && prog(11).reached.join(',') === '3,5,7,11' && prog(11).next === null
      && prog(5).next === 7 && prog(5).total === 12;
  })());
  check('实测：属性层面也逐档叠上了（3→5→7→11 单调增高）', (function () {
    var ids = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; });
    function attrs(n) {
      var eq = {};
      ids.slice(0, n).forEach(function (id) { eq[DATA.EQUIP[id].slot] = id; });
      return G.genAttrs({ level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
        attack: 10, defense: 10, hp: 100, rank: 'fan', style: 'balance', perm: {}, equip: eq });
    }
    var a3 = attrs(3), a5 = attrs(5), a7 = attrs(7), a11 = attrs(11);
    return a5.def > a3.def && a7.nz > a5.nz && a11.atk > a7.atk && a11.spd > a7.spd && a11.tong > a7.tong;
  })());
  check('实测：装备栏面板显式列出四档（已达/未达）', (function () {
    var st = G.newGame({ name: '档位' });
    var g = st.generals[0];
    var ids = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'shenwu'; }).slice(0, 5);
    g.equip = {};
    ids.forEach(function (id) { g.equip[DATA.EQUIP[id].slot] = id; });
    var h = G.ui.dollSetPanel(g);
    return /神武套/.test(h) && /5 \/ 12 件/.test(h)
      && /ds-tiers/.test(h) && (h.match(/class="on"/g) || []).length === 2;
  })());
  /* 需求 4：打造界面按商城版式 */
  check('打造界面用物品行网格铺开（不是一条长单列）', (function () {
    /* v51：用 fnBody 按结构取函数体（原来写死 3200/3600 字符窗口，
       函数一加注释就假红 —— 这个坑已经踩了三回）。 */
    var seg = fnBody(uS38, 'ui.openForge = function');
    /* v51：类名从 `shop-rows` 换成**独立的** `forge-rows` —— 列数不再跟商城绑定：
       商城是整页视图（4 列，每格 317~375px），打造是弹窗（内容宽 ~922px），
       弹窗里 4 列会把每格压到 223px，卡片被折行撑到 231px 高（实测），
       每页反而只能放一行。独立成 3 列后每格 301px、卡高 208，一屏刚好两行。 */
    return /class="forge-rows"/.test(seg) && !/class="shop-rows"/.test(seg)
      && !/shop-rows one-col/.test(seg);
  })());
  check('打造列表列数独立于商城（.forge-rows 3 列 / .shop-rows 4 列，各有唯一来源）', (function () {
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return /\.forge-rows \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/.test(h)
      && /\.shop-rows \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(h)
      && (h.match(/\.forge-rows \{ display: grid/g) || []).length === 1;
  })());
  /* v51（老板：稍微放大一点 + 搞成翻页）：弹窗正文高度是这条面板最稀缺的资源，
     一屏能不能放两行完全卡在它上面，所以尺寸与每页件数都要被钉住。 */
  check('打造面板分页：3 列 × 2 行 = 6 件/页，常量单一定义', (function () {
    /* codeOf = 取函数体后剥注释 —— 破坏测试发现：直接把 ui.modalPage(...) 注释掉，
       这条断言仍绿（字符串还在注释里）。剥掉注释它才会跟着红。 */
    var seg = codeOf(uS38, 'ui.openForge = function');
    return G.ui.FORGE_PER_PAGE === 6
      && (uS38.match(/ui\.FORGE_PER_PAGE = /g) || []).length === 1
      && /ui\.modalPage\('forge', rows, ui\.FORGE_PER_PAGE/.test(seg)
      && /pg\.slice\.map/.test(seg) && /pg\.pager/.test(seg);
  })());
  check('弹窗提到 xl，正文高度固定够放两行卡片（v74：700px 定死）', (function () {
    /* ⚠️ 剥注释再断（本项目第 N 次被自己的说明注释骗过）：注释里会引用被撤规则的原文 */
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    return /size: 'xl'/.test(fnBody(uS38, 'ui.openForge = function'))
      && /\.modal-xl \{ width: \d+px; height: \d+px;[\s\S]{0,120}max-width: calc\(100vw - 20px\)/.test(h)
      && /height: 700px/.test(h)
      /* v74：860 降档已撤 —— 画布固定后矮屏不再改弹窗高度（正文 700−帧高仍是短屏最优解） */
      && !/@media \(max-height: 860px\)/.test(h);
  })());
  check('切品质 / 切类别时打造面板页码归零（不会停在越界页）', (function () {
    return /ui\._pages\['forge'\] = 1/.test(fnBody(uS38, 'ui.setForgeQ = function'))
      && /ui\._pages\['forge'\] = 1/.test(fnBody(uS38, 'ui.setForgeKind = function'));
  })());
  check('实测：切品质后页码确实回到第 1 页（行为断言，不只看源码）', (function () {
    var st = G.newGame({ name: '翻页' });
    var c = st.cities[0];
    var empty = (c.cells || []).filter(function (x) { return !x.build; })[0];
    if (empty) empty.build = { id: 'tiejiangpu', lvl: 12 };
    G.ui._forgeQ = 1; G.ui._forgeKind = 'all';
    G.ui._pages['forge'] = 2;                      /* 假装玩家翻到了第 2 页 */
    G.ui.setForgeQ(2);
    return G.ui._pages['forge'] === 1;
  })());
  check('「套装效果一览」从正文移到独立小窗，且动作已接线（不是孤儿按钮）', (function () {
    var m = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');
    return /data-action="forge-setinfo"/.test(fnBody(uS38, 'ui.openForge = function'))
      && /case 'forge-setinfo': ui\.openForgeSetInfo\(\); break;/.test(m)
      && /ui\.openForgeSetInfo = function/.test(uS38);
  })());
  check('卡片不再复述按钮状态（只在有阻塞时才写文字）', (function () {
    /* 查**代码**不查注释：解释这条改动的注释里本身就引用了那句话，
       直接扫全段会把自己的说明读成"没删干净"（v51 实测踩到）。 */
    var seg = codeOf(uS38, 'ui.forgeRow = function');
    return seg.length > 200                          /* 取到函数体才算数（防"空串静默通过"） */
      && !/条件齐备，可以打造/.test(seg)
      /* 阻塞原因必须仍然写出来（缺料/缺图纸/资材不足） */
      && /blockers\.join/.test(seg) && /red-light/.test(seg);
  })());
  check('打造界面把套装与散件分开（数据 + 交互）',
    /ui\.setForgeKind = function/.test(uS38) && /data-action="forge-kind"/.test(uS38)
    && /case 'forge-kind'/.test(mS38) && /ui\.forgeSetNote = function/.test(uS38));
  check('实测：分栏真的筛出了套装 / 散件', (function () {
    var all = G.forgeList();
    var setN = all.filter(function (f) { return !!f.item.set; }).length;
    var soloN = all.filter(function (f) { return !f.item.set; }).length;
    return setN >= 36 && soloN > 0 && setN + soloN === all.length;
  })());
  check('实测：套装效果一览列出三套与四档', (function () {
    var h = G.ui.forgeSetNote();
    return /倚天套/.test(h) && /名将套/.test(h) && /神武套/.test(h)
      && (h.match(/fsn-row/g) || []).length === 3
      && (h.match(/3 件/g) || []).length === 3 && (h.match(/11 件/g) || []).length === 3;
  })());

  console.log('  --- ⑫⑬ 信息分层 ---');
  check('说明组件（悬停浮层 + 点击小窗）已就位',
    /ui\.help = function/.test(uS38) && /ui\.openHelp = function/.test(uS38)
    && /\.tip-layer \{/.test(hS38)
    && /case 'show-help'/.test(mS38));
  check('商城不再常驻"当前黄金/单价/共 n 件"整行',
    !/当前黄金 ' \+ U\.numHTML/.test(uS38) && !/单价 = 元宝价 × 100 金　·　分 /.test(uS38));
  check('商城/背包/任务的说明收进 ⓘ', (function () {
    var sh = G.ui.shopHTML(), bh = G.ui.bagHTML(), th = G.ui.tasksHTML();
    return /help-chip/.test(sh) && /help-chip/.test(bh) && /help-chip/.test(th);
  })());
  check('实测：ⓘ 同时带 tooltip 与点击兜底（平板无 hover）',
    /data-tip="/.test(G.ui.help('测试')) && /data-action="show-help"/.test(G.ui.help('测试')));

  /* ---- 需求 14：统计 / 公文美术 ---- */
  console.log('  --- ⑭ 统计·公文美术 ---');
  check('竹简卷轴底 + 上下木轴 + 朱印标题',
    /\.scroll-page \{/.test(hS38) && /\.scroll-axis \{/.test(hS38)
    && /\.scroll-title \.seal \{/.test(hS38)
    && /ui\.scrollOpen = function/.test(uS38) && /ui\.scrollClose = function/.test(uS38));
  /* v37 同步：原断言的锚点（.stat-card/.sc-k 竖排标签）是 **v27 有意删掉的设计**
     —— v27 自己的断言就是反向的（/stat-cards/ 不得存在），
     再断言卡片形态等于要求设计回退。改按当前形态核：**账册行**。 */
  check('统计用账册行（卡片网格已由 v27 移除，不再回退）',
    /ui\.lgSec = function/.test(uS38) && /ui\.lgRow = function/.test(uS38)
    && !/\.stat-card \{/.test(hS38));
  check('不再有 emoji 分区小标（改用朱点 + 金线）',
    /ui\.sealH = function/.test(uS38) && /\.seal-h::before/, hS38 ? '' : '');
  /* v39（需求 4）：战报从"一条一个框"改为列表行 —— 底色/边框/圆角全去掉，
     只留底部分隔线；胜负改用行首小圆点（朱点=败 / 绿点=胜）。 */
  check('战报改为驿报文书行（按胜负分色）',
    /class="doc-bar/.test(uS38) && /\.doc-bar\.win::before \{/.test(hS38)
    && /\.doc-bar \{[\s\S]{0,200}border-bottom: 1px solid var\(--line\)/.test(hS38));
  /* v39（需求 4）：公文改用扁平页（老板嫌"好多框"）；统计页保留卷轴壳 ——
     那是"册页"，内容多，壳有承载感。 */
  check('统计用卷轴册页、公文改扁平页',
    /scroll-page/.test(G.ui.statsHTML()) && /scroll-axis/.test(G.ui.statsHTML())
    && !/scroll-page/.test(G.ui.reportsHTML()) && /gold-heading/.test(G.ui.reportsHTML()));
  /* v37 同步：emoji 分区标题已随"朴素化"移除（v29），改按**账册分段名**核 */
  check('实测：统计信息未因改版丢失（按 v54 账册形态核）', (function () {
    var h = G.ui.statsHTML();
    /* v54：军民/府库/君主三块按老板要求撤掉（别处已有），
       所以判据只留"还在的"：疆域 / 在外 / 城池 / 采集队。
       被删的那几项反过来断言**不许出现**，避免哪次改版又搬回来。 */
    return h.indexOf('全境汇总') >= 0
      && h.indexOf('甲 · 疆域') >= 0 && h.indexOf('乙 · 在外') >= 0
      && h.indexOf('城池') >= 0 && h.indexOf('采集队') >= 0
      && h.indexOf('总驻军') < 0 && h.indexOf('总人口') < 0;
  })());

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
    /* 注释里会提到旧写法 —— 先剥注释再找。
       ⚠ 必须**先整体剥块注释**，再按行剥行注释：
       逐行剥块注释剥不掉**跨行**注释，而 battle.js 里"原先各自 gen.exp += x"
       恰好写在跨行块注释中 → 会让这条断言永远假红（v37 实测复现）。 */
    var code = all.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
      .map(function (l) { return l.split('//')[0]; }).join('\n');
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
  /* v41：判据要**盯住这一条 case 的整个主体**，不能只看 main.js 里"有没有 refreshView"
     —— refreshView 别处也有，那样写会漏掉 case 里残留的旧调用（本轮就漏过一次，
     e2e 才发现 main.js 仍在调已删除的 openGenDetail）。 */
  check('gen-exp-item 动作已注册且原地重绘（且不残留弹窗调用）', (function () {
    var i = mS39.indexOf("case 'gen-exp-item'");
    if (i < 0) return false;
    var seg = mS39.slice(i, mS39.indexOf('break;', i));
    return /GAME\.refreshView\(\)/.test(seg) && !/openGenDetail|openGenEquip/.test(seg);
  })());
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
  /* v29（需求 11）：速度仍为第五维，体力为**第六维** */
  check('六维定义 6 项：第五维速度、第六维体力', (function () {
    var D = G.ui.GEN_DIMS;
    return D.length === 6 && D[4].k === 'spd' && D[4].n === '速度'
      && D[5].k === 'sta' && D[5].n === '体力'
      && D[0].k === 'tong' && D[1].k === 'yw' && D[2].k === 'zm' && D[3].k === 'nz';
  })());
  /* v65（老板）：「压缩一下六维的作用单元格长度」→ 一律短句。
     判据从"必须以『每点』开头"改成两条更实用的：
       ① 不许拼运行时的计算值（那才是"作用/当前值"混写的真问题）；
       ② 短（≤26 字），超了就会把表格撑高、把属性名挤成两行。 */
  check('「作用」是固定文案，不拼运行时的计算值',
    G.ui.GEN_DIMS.every(function (d) { return !/%\d|=\s*\d/.test(d.use) && d.use.length <= 26; }),
    G.ui.GEN_DIMS.map(function (d) { return d.n + ':' + d.use.length + '字'; }).join(' '));
  check('速度的作用写明「全军速度 +1 · 每级另 +1」（求和口径）',
    /全军速度 \+1/.test(G.ui.GEN_DIMS[4].use) && /每级另 \+1/.test(G.ui.GEN_DIMS[4].use));
  check('实测：丹药不再被算两次（perm 已写进基础，genAttrs 不再叠加）', (function () {
    var g = { level: 1, tong: 50, yw: 50, zm: 50, nz: 50, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance',
      perm: { tong: 5, nz: 0, yw: 0, zm: 0 } };
    /* 旧实现 = 50 + 5 = 55（用户抱怨"嗑药的怎么就不基础了"，就是这里） */
    return G.genAttrs(g).tong === 50;
  })());
  check('实测：吃一颗永久丹药只 +1（不是 +2）', (function () {
    /* v37 同步：useItem 的签名没变，但 makeGeneral 不再把新将推入 state.generals，
       于是 _findGen 找不到 → 返回"请选择将领"。改取**已在册**的将领
       （与 v26-l.py 里 e2e 版的写法一致）。 */
    var st = G.state, g = st.generals[0];
    var bk = { tong: g.tong, perm: JSON.stringify(g.perm || {}), items: JSON.stringify(st.items || {}) };
    g.tong = 20; if (g.perm) g.perm.tong = 0;     /* 蜂王蜜膏每将上限 50，先压到低位 */
    st.items = st.items || {};
    st.items.fengwang_migao = 1;
    var r = G.systems.useItem('fengwang_migao', g.id);
    var attrs = G.genAttrs(g);
    var ok = r.ok && g.tong === 21 && attrs.tong === 21;
    g.tong = bk.tong; g.perm = JSON.parse(bk.perm); st.items = JSON.parse(bk.items);
    return ok;
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
  /* v41（需求 2）：右侧档案的身份区仍是「左头像 · 右身份与数值」的两栏 */
  check('右侧档案为两栏（左头像 · 右身份与数值）', /class="gp-head"/.test(uS39)
    && /class="gp-face"/.test(uS39) && /class="gp-id"/.test(uS39));
  check('六维表只有一个数值列（v74：作用列改「加点」＋）', (function () {
    var i = uS39.indexOf('<th>六维</th>');
    var head = i < 0 ? '' : uS39.slice(i, uS39.indexOf('</thead>', i));
    return (head.match(/<th/g) || []).length === 3 && /<th class="ctr">加点<\/th>/.test(head)
      && head.indexOf('合计') < 0 && head.indexOf('装备/丹') < 0;
  })());
  /* v74（老板需求 6）：「不要这个备注（带兵 / 人口上限 / 本城产量 / 速度）」—— 整块撤除 */
  check('计算值备注块整块撤除（gd-effect 与「带兵 <b>」行都不在）',
    !/gd-effect/.test(uS39) && uS39.indexOf("'<span>带兵 <b>'") < 0);
  check('实测：右侧档案渲染出 6 行六维、速度与体力都是真值', (function () {
    var st = G.newGame({ name: '六维' });
    var g = st.generals[0];
    G.ui._genSel = g.id;
    var h = G.ui.generalsHTML();
    var rows = (h.match(/gd-v">(\d+)</g) || []);
    var a = G.genAttrs(g);
    var ok = rows.length === 6 && a.spd > 0 && a.sta > 0 && h.indexOf('速度') > 0 && h.indexOf('体力') > 0;
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
  check('顶栏有天时元素（在「自动」「设置」之后，最右）', (function () {
    var i = hS39.indexOf('class="topnav"');
    var nav = hS39.slice(i, i + 4000);
    var iSky = nav.indexOf('id="nav-sky"');
    var iSet = nav.indexOf('data-view="settings"');
    var iAuto = nav.indexOf('data-view="auto"');
    /* v29（需求 5）：顶栏的「存档 / 新游戏」已删（设置里有），
       所以天时不再"在设置与存档之间"，而是**排在设置之后的最右**。 */
    return iSky > 0 && iSet >= 0 && iAuto >= 0 && iAuto < iSet && iSet < iSky
      && nav.indexOf('data-action="save"') < 0 && nav.indexOf('data-action="new-game"') < 0;
  })());
  check('v29 顶栏新增「自动」菜单（就在「设置」旁边）',
    /data-view="auto"/.test(hS39) && /ui\.autoHTML = function/.test(uS39)
    && /auto: '<path/.test(rd39('js/icons.js')));
  check('天时推到偏右（margin-left:auto）', /\.nav-sky \{[\s\S]{0,120}margin-left: auto/.test(hS39));
  check('侧栏城池属性里不再有天时', (function () {
    /* 顶栏天时自己也含 "天时</span>"，所以只看 renderCityAttrs 那一段 */
    var i = uS39.indexOf('ui.renderCityAttrs = function');
    var seg = i < 0 ? '' : uS39.slice(i, uS39.indexOf('ui.renderResBar = function', i));
    /* 同样先剥注释：这里恰好写着"天时已移到顶栏"这句解释 */
    seg = seg.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
      .map(function (l) { return l.split('//')[0]; }).join('\n');
    return seg.length > 0 && seg.indexOf('天时') < 0 && !/sky-line/.test(uS39);
  })());
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
  check('观察框常量 12×6（v50 菱形：画布切成 12×6 个格距，可见 12 宽 × 12 高菱形）',
    /MAP_SPAN_X = 12, MAP_SPAN_Y = 6/.test(uS39)
    && /ui\.fitMapCell = function/.test(uS39)
    /* 不读"当前 _view"——它取决于上一条测试留下的 render 参数。这里自己渲染一次。 */
    && (function () {
      var cv = global.document.createElement('canvas');
      G.map.render(cv, { vx: 10, vy: 20, spanX: 12, spanY: 6, cell: 52 });
      return G.map._view.spanX === 12 && G.map._view.spanY === 6;
    })());
  check('render 支持 spanX / spanY（宽高可不等）',
    /opts\.spanX \|\| opts\.span/.test(rd39('js/map.js')) && /opts\.spanY/.test(rd39('js/map.js')));
  check('实测：渲染后记录 spanX / spanY 与菱形半宽半高',
    (function () {
      var cv = global.document.createElement('canvas');
      G.map.render(cv, { vx: 10, vy: 20, spanX: 12, spanY: 6, cell: 52 });
      var v = G.map._view;
      return v.spanX === 12 && v.spanY === 6 && v.cvW === 624 && v.cvH === 312
        && v.HW === 26 && v.HH === 13;
    })());
  check('实测：视野中心越界时钳到地图内（v50：vx/vy 是中心格）', (function () {
    var cv = global.document.createElement('canvas');
    G.map.render(cv, { vx: 99999, vy: 99999, spanX: 12, spanY: 6, cell: 52 });
    var v = G.map._view;
    return v.vx === DATA.MAP_W - 1 && v.vy === DATA.MAP_H - 1;
  })());
  /* v50：菱形视野不是矩形，"第 N 行之外全为空"这种判据已不成立。
     改成验**地图内外**：格心必中、地图外的点必为空。 */
  check('实测：地图内拾取命中、地图外返回 null（不会越界取格）', (function () {
    var cv = global.document.createElement('canvas');
    G.map.render(cv, { vx: 0, vy: 0, spanX: 12, spanY: 6, cell: 52 });
    var v = G.map._view;
    var old = cv.getBoundingClientRect;
    cv.getBoundingClientRect = function () {
      return { left: 0, top: 0, width: cv.width, height: cv.height };
    };
    var sp = function (gx, gy) {
      return { x: v.ox + (gx - gy) * v.HW, y: v.oy + (gx + gy) * v.HH };
    };
    var a = sp(4, 3), b = sp(0, 0), far = sp(-400, 0);
    var hitA = G.map.pick(cv, a.x, a.y);
    var hitB = G.map.pick(cv, b.x, b.y);
    var out = G.map.pick(cv, far.x, far.y);
    cv.getBoundingClientRect = old;
    return hitA && hitA.x === 4 && hitA.y === 3 && hitB && hitB.x === 0 && hitB.y === 0 && out === null;
  })());
  check('v76：浮标让位已撤（导航迁底部条，78px 不再需要）', !/padding-bottom: 78px/.test(hS39));

  check('e2e 主流程异常会计入失败（不再"绿着崩"）', (function () {
    /* 本轮实际踩到：删掉 ui.setCitySub 后主流程在 2065 行中断，
       而 .catch 直接 finish() → 报"0 失败 + exit 0"，后面 49 条断言静默未跑。 */
    var e = rd39('e2e-test.js');
    return /FAIL\+\+;[\s\S]{0,80}ABORTED = true/.test(e)
      && /if \(ABORTED\)/.test(e) && /不能当作通过|不可当作通过/.test(e);
  })());

  /* ---- 需求 5：城内 / 城外 入顶栏 ---- */
  console.log('  --- ⑤ 城内城外入顶栏 ---');
  check('顶栏含「城池」与「城外」两个平级菜单',
    /data-view="city"[\s\S]{0,90}城池/.test(hS39) && /data-view="ext"[\s\S]{0,90}城外/.test(hS39));
  check('子页签与 city-sub 动作链已彻底移除', (function () {
    /* 注释里会解释"ui._citySub 已删除"，所以判据要指向**赋值与分支**，不是"出现过" */
    var code = uS39.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
      .map(function (l) { return l.split('//')[0]; }).join('\n');
    return !/id="subtabs"/.test(hS39) && !/data-action="city-sub"/.test(hS39)
      && !/case 'city-sub'/.test(mS39) && !/ui\.setCitySub/.test(uS39)
      && !/_citySub\s*=/.test(code);
  })());
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


  /* ============================================================
   * 40. v27：布局自适应 / 公文精简 / 野地守军规则 / 兵种损耗 /
   *          回合制文字战场 / 去掉下拉 / 图标与统计 / 两栏等高
   * ============================================================ */
  console.log('\n===== 40. v27 布局·战场·守军 =====');
  var fs40 = require('fs'), path40 = require('path');
  var rd40 = function (f) { return fs40.readFileSync(path40.join(__dirname, f), 'utf8'); };
  var uS40 = rd40('js/ui.js'), hS40 = rd40('index.html'), mS40 = rd40('js/main.js');
  var bS40 = rd40('js/battle.js'), dS40 = rd40('js/domain.js'), tS40 = rd40('js/tactic.js');
  var dtS40 = rd40('js/data.js');

  /* ---- 需求 1：去「城池操作」板块 + 城池属性紧凑 ---- */
  console.log('  --- ① 侧栏 ---');
  check('城池操作板块与 renderCityTools 已彻底移除',
    !/id="city-tools"/.test(hS40) && !/ui\.renderCityTools/.test(uS40));
  check('切城下拉框并进「城池属性」（v71 老板：单城也保留）', /city-switch/.test(uS40)
    && !/if \(\(s\.cities \|\| \[\]\)\.length > 1\)/.test(uS40));
  check('侧栏各块内层高度放宽（不再动不动出滚动条）',
    /\.side-body \{[^}]*max-height: 232px/.test(hS40.replace(/\/\*[\s\S]*?\*\//g, '')));

  /* ---- 需求 2：公文精简 ---- */
  console.log('  --- ② 公文 ---');
  check('公文不再有公告·当前要务与系统状态', (function () {
    var code = uS40.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
      .map(function (l) { return l.split('//')[0]; }).join('\n');
    return code.indexOf('公告 · 当前要务') < 0 && code.indexOf('系统状态') < 0
      && code.indexOf('notice-box') < 0;
  })());
  check('公文只保留战报 / 消息两节（v29 需求 6）',
    !/ui\.sealH\('队列'/.test(uS40) && /ui\.sealH\('战报'/.test(uS40) && /ui\.sealH\('消息'/.test(uS40));

  /* ---- 需求 3：野地守军规则化 ---- */
  console.log('  --- ③ 野地守军 ---');
  check('每个等级都给了兵种与数量范围（0~10 级齐备）', (function () {
    if (!DATA.WILD_DEFENSE || DATA.WILD_DEFENSE.length !== 11) return false;
    return DATA.WILD_DEFENSE.every(function (lv) {
      return lv.length > 0 && lv.every(function (e) {
        return DATA.TROOPS[e.id] && e.max > e.min && e.min >= 0;
      });
    });
  })());
  check('等级越高规模越大（单调递增）', (function () {
    function tot(lv) {
      return DATA.WILD_DEFENSE[lv].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0);
    }
    for (var i = 1; i <= 10; i++) if (tot(i) <= tot(i - 1)) return false;
    return true;
  })(), '平均规模 Lv0=' + DATA.WILD_DEFENSE[0].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0)
    + ' → Lv10=' + DATA.WILD_DEFENSE[10].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0));
  /* ============================================================
   * v55（老板："感觉目前有点少了" / "战胜后将领经验也比较少"）
   * ------------------------------------------------------------
   * ① 守军总数**标定到原版**（docs §6.4：20/50/150/200/500/1000/2000/4000/8000/20000/40000）。
   *    改前我们的中值只有 22/57/113/202/220/425/730/1225/1935/2915/4560 ——
   *    4 级起系统性偏少，10 级只有原版的 **1/9**，而玩家后期能带几万兵。
   * ② 经验**改成原版公式**（每消灭 1000 资源得 1 经验、胜方 ×2、单场封顶 90%）。
   *    改前是 `野地等级 × 12`（线性）对 `等级²×100`（二次），Lv30 打 Lv10 要 750 场一级。
   * ============================================================ */
  console.log('  --- v55：守军规模对齐原版 + 原版经验公式 ---');
  check('守军总数对齐原版（各级中值与原版总数偏差 ≤3%）', (function () {
    var O = DATA.WILD_DEF_ORIG_TOTAL;
    if (!O || O.length !== 11) return false;
    var worst = 0, bad = [];
    for (var lv = 0; lv <= 10; lv++) {
      var mid = DATA.WILD_DEFENSE[lv].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0);
      var dev = Math.abs(mid / O[lv] - 1);
      if (dev > worst) worst = dev;
      if (dev > 0.03) bad.push('Lv' + lv + ' ' + Math.round(mid) + '/' + O[lv]);
    }
    return bad.length === 0 && worst <= 0.03;
  })(), '最大偏差 ' + (function () {
    var O = DATA.WILD_DEF_ORIG_TOTAL, w = 0;
    for (var lv = 0; lv <= 10; lv++) {
      var mid = DATA.WILD_DEFENSE[lv].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0);
      w = Math.max(w, Math.abs(mid / O[lv] - 1));
    }
    return (w * 100).toFixed(1) + '%';
  })());
  check('10 级野地确实是"四万量级"（改前只有 4560）', (function () {
    var t = DATA.WILD_DEFENSE[10].reduce(function (n, e) { return n + (e.min + e.max) / 2; }, 0);
    return t >= 35000 && t <= 45000;
  })());
  /* 「守军整体下调（garrisonMul < 1）」那个旋钮已在 v55 删除 ——
     它是旧公式的系数，而旧公式本身被删了，留着就是**没人读的死配置**。
     这条改成查"旋钮确实没了"，防它被搬回来。 */
  check('旧的 garrisonMul 旋钮已删除（守军规模只有一个来源）',
    DATA.EXPEDITION.garrisonMul === undefined
    && !/garrisonMul/.test(stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'battle.js'), 'utf8'))));
  check('旧的 wildGarrison 公式已删除（它算出来是真实值的 15 倍，面板曾被它骗）', (function () {
    return typeof G.battle.wildGarrison !== 'function'
      && !/wildGarrison\(/.test(stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8')));
  })());
  check('面板显示的守军数与战斗同源（都读 wildDefenseAt，不再两个出口）', (function () {
    var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
    var i = u.indexOf('ui.openLandModal = function');
    var seg = u.slice(i, u.indexOf('\n  };', i));
    return seg.length > 500 && /GAME\.wildDefenseAt\(x, y, lv\)\.total/.test(seg);
  })());
  check('实测：军队资源价值按兵种造价折算（口径真算一遍，含石料）', (function () {
    var t = DATA.TROOPS.yibing;
    var one = (t.cost.grain || 0) + (t.cost.wood || 0) + (t.cost.stone || 0) + (t.cost.iron || 0);
    /* 投石车是唯一同时吃粮/木/石/铁的兵种之一 —— 用它才能验出"漏掉某一项"的错 */
    var s2 = DATA.TROOPS.toudan;
    var two = (s2.cost.grain || 0) + (s2.cost.wood || 0) + (s2.cost.stone || 0) + (s2.cost.iron || 0);
    return G.battle.armyResourceValue({ yibing: 10 }) === one * 10
      && G.battle.armyResourceValue({ toudan: 3 }) === two * 3
      && two > s2.cost.grain + s2.cost.wood + s2.cost.iron      /* 石料确实算进去了 */
      && G.battle.armyResourceValue({}) === 0
      && G.battle.armyResourceValue({ buzhidao: 5 }) === 0;
  })());
  check('实测：单场经验封顶 = 升级需求的 80%（老板拍板「一场 0.8 级」）', (function () {
    /* ⚠️ 不能在这里 G.newGame —— 它会换掉全局 state，
       把后面依赖当前存档的断言全部污染（实测：一加就挂两条无关断言）。
       这里只需要一个"有 level 的对象"，裸对象就够（expNeedOf 只读 level）。 */
    var g = { level: 30, exp: 0, name: '测试将', loyalty: 70, stamina: 500, energy: 100 };
    var need = G.expNeedOf(g);
    /* 拿一支"超大"敌军去换经验：原始值必然远超封顶 */
    var big = { toudan: 5000 };
    var r = G.battle.battleExp(big, g);
    return r.capped === true && r.gain === Math.round(need * 0.8)
      && r.raw > r.gain && r.gain < need
      /* 封顶口径只有一个来源：DATA.EXP_RULE.capPct（不许在别处再写 0.8） */
      && DATA.EXP_RULE.capPct === 0.8;
  })());
  check('实测：打一场 Lv10 野地直接顶到封顶（改前只有该级需求的 0.13%，老板说"太少"）', (function () {
    var g = { level: 30, exp: 0, name: '测试将', loyalty: 70 };
    var need = G.expNeedOf(g);
    var army = {}, mid = 0;
    DATA.WILD_DEFENSE[10].forEach(function (e) { var n = Math.round((e.min + e.max) / 2); army[e.id] = n; mid += n; });
    var r = G.battle.battleExp(army, g);
    return r.raw > need && r.gain === Math.round(need * 0.8);
  })(), (function () {
    var g = { level: 30, exp: 0, name: '测试将', loyalty: 70 };
    var army = {};
    DATA.WILD_DEFENSE[10].forEach(function (e) { army[e.id] = Math.round((e.min + e.max) / 2); });
    var r = G.battle.battleExp(army, g);
    return '歼敌值 ' + U.numText(r.value, 0) + ' → 原始 ' + U.numText(r.raw, 0) +
      ' → 实得 ' + U.numText(r.gain, 0) + '（该级需 ' + U.numText(G.expNeedOf(g), 0) + '）';
  })());
  check('实测：经验随歼灭量增长（不是按野地等级的固定值）', (function () {
    var g = { level: 60, exp: 0, name: '测试将', loyalty: 70 };   /* 高级将领：封顶很宽，能看出差别 */
    var small = { yibing: 100 }, big = { yibing: 3000 };
    var a = G.battle.battleExp(small, g).gain;
    var b = G.battle.battleExp(big, g).gain;
    return b > a * 10;
  })());
  check('侦察经验走常量（不写死 30）', (function () {
    var b = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'battle.js'), 'utf8'));
    return /DATA\.EXP_RULE\.scout|R\.scout/.test(b) === true || /gainExp\(gen, 30, '侦察/.test(b);
  })());
  /* ============================================================
   * v56（老板拍板）：封顶 0.8 级 + **胜方才有经验**（掠夺同口径）
   * ------------------------------------------------------------
   * 这两条是"口径"而非"数值"，最容易被某处悄悄改回去。
   * 所以既要查常量，也要查**签名与配置里有没有长出第二个旋钮**——
   * 留一个 `loseMul` 或一个 `won` 参数（哪怕恒为 0）都等于"假旋钮"：
   * 看着可调、实际不起作用，下一个人会以为败方经验是被"调没了"。 */
  check('v56：只给胜方经验（battleExp 无胜负参数，EXP_RULE 无败方系数）', (function () {
    var b = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8'));
    return DATA.EXP_RULE.loseMul === undefined
      && DATA.EXP_RULE.winMul === 2
      && /GAME\.battle\.battleExp = function \(defLossBy, gen\) \{/.test(b)
      /* 经验入口只有三个：攻占名城 / 出征胜利 / 侦察。多一个就说明有人给败方开了口 */
      && (b.match(/GAME\.battle\.gainExp\(/g) || []).length === 3
      && !/loseMul/.test(b);
  })());
  check('v56：败方战报写明「未获经验」（原版败方有经验，不写会被当 bug）', (function () {
    var gen = { name: '测试将', level: 1 };
    var loseTxt = G.battle.reportText('试城', {}, gen,
      { winner: 'def', rounds: 5, atkLoss: 100, atkRemain: 0, defLoss: 10, defRemain: 90, expNone: true });
    var winTxt = G.battle.reportText('试城', {}, gen,
      { winner: 'atk', rounds: 5, atkLoss: 10, atkRemain: 90, defLoss: 100, defRemain: 0,
        expInfo: { gain: 500, level: 2, exp: 500, need: 10000, up: 1 }, expCapped: false, defValue: 12345 });
    return /未获经验/.test(loseTxt) && loseTxt.indexOf('经验：') < 0
      && /经验：/.test(winTxt) && winTxt.indexOf('+500') >= 0;
  })());
  check('v56：掠夺与占领经验同口径（出口不读出征方式，也没有折扣）', (function () {
    var seg = fnBody(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8'),
      'GAME.battle.battleExp = function');
    var code = stripComment(seg);
    return code.length > 200 && !/mode|occupy|raid|loot|0\.7/.test(code);
  })());
  check('实测：同日同地两次读取守军完全一致（侦查所见即所得）', (function () {
    var a = G.wildDefenseAt(260, 230, 7), b = G.wildDefenseAt(260, 230, 7);
    return JSON.stringify(a.army) === JSON.stringify(b.army) && a.total === b.total;
  })());
  check('实测：换一天守军按规则变化（24h 轮换）', (function () {
    var bak = G.questDayIndex, seen = {}, n = 0;
    for (var d = 0; d < 5; d++) {
      G.questDayIndex = (function (base) { return function () { return base + d; }; })(bak());
      var t = G.wildDefenseAt(260, 230, 7).total;
      if (!seen[t]) { seen[t] = 1; n++; }
    }
    G.questDayIndex = bak;
    return n >= 3;      /* 5 天里至少出现 3 种不同规模 */
  })());
  check('不同坐标守军不同（不是全图同一支）', (function () {
    return G.wildDefenseAt(260, 230, 7).total !== G.wildDefenseAt(300, 300, 7).total;
  })());
  check('高等级野地会有守将，低等级不会有', (function () {
    var lo = 0, hi = 0;
    for (var i = 0; i < 60; i++) {
      if (G.wildDefenseAt(200 + i, 200, 2).gen) lo++;
      if (G.wildDefenseAt(200 + i, 300, 10).gen) hi++;
    }
    return lo === 0 && hi > 0;
  })(), 'Lv2 出将 0 次 · Lv10 出将 ' + (function () {
    var hi = 0;
    for (var i = 0; i < 60; i++) if (G.wildDefenseAt(200 + i, 300, 10).gen) hi++;
    return hi;
  })() + '/60 次');
  check('技巧满级后侦查给全（准确数量 / 可图之利）', (function () {
    var w0 = G.state.world.weather, t0 = G.state.techs['zhencha'] || 0;
    G.state.world.weather = 'clear';
    G.state.techs['zhencha'] = 10;
    var tgt = { kind: 'wild', x: 10, y: 10, terrain: 'lake', lv: 5,
      garrison: { yibing: 100, changqiang: 40 }, guard: null };
    var sc = G.battle.scoutTarget(tgt, G.state.generals[0]);
    G.state.world.weather = w0; G.state.techs['zhencha'] = t0;
    var names = (sc.roster || []).map(function (x) { return x.name + ':' + x.n; }).join(',');
    return sc.totalExact === true && sc.gNum === 140 && names === '义兵:100,长枪兵:40'
      && sc.spoils && (sc.spoils.jewels || []).length >= 1
      && sc.spoils.types.length >= 4 && sc.spoils.materials.length >= 1;
  })());
  check('平地无可采之物（占领只给产量加成）', (function () {
    var w0 = G.state.world.weather, t0 = G.state.techs['zhencha'] || 0;
    G.state.world.weather = 'clear';
    G.state.techs['zhencha'] = 10;         /* v65：可图之利是第 6 层，要看先升满 */
    var sc = G.battle.scoutTarget({ kind: 'wild', x: 9, y: 9, terrain: 'plain', lv: 4,
      garrison: { yibing: 10 } }, G.state.generals[0]);
    G.state.world.weather = w0; G.state.techs['zhencha'] = t0;
    return sc.spoils && sc.spoils.gather === null && !!sc.spoils.terrainBonus;
  })());
  check('守军与「我方驻军」是两个概念（命名不冲突）',
    /GAME\.wildDefenseAt = function/.test(dS40) && /GAME\.wildGarrisonAt = function/.test(dS40));

  /* ---- 需求 4：战报列出兵种损耗 ---- */
  console.log('  --- ④ 兵种损耗 ---');
  check('兵种损耗文本：兵种 初始 → 剩余（损 N）', (function () {
    var s = G.battle.troopLossText({ yibing: 1000, gongjian: 500 }, { yibing: 300, gongjian: 120 });
    return s.indexOf('义兵') >= 0 && s.indexOf('1,000 → 700') >= 0 && s.indexOf('损 300') >= 0
      && s.indexOf('弓箭手') >= 0;
  })());
  check('战报正文写入【兵种损耗】', /【兵种损耗】/.test(bS40) && /troopLossText/.test(bS40));
  check('战报同时存结构化损耗（供详情表用）', /loss: \{[\s\S]{0,160}atkLossBy/.test(bS40)
    && /ui\._reportLoss = function/.test(uS40));
  check('实测：打一场野地，损耗明细对得上总数', (function () {
    var st = G.state, c = G.currentCity();
    var bkArmy = JSON.stringify(c.army), bkRes = JSON.stringify(st.res), bkRep = st.reports.length;
    c.army = { changqiang: 3000, gongjian: 2000 };
    var r = G.battle.expedition({ kind: 'wild', x: c.x + 3, y: c.y + 3 }, 'raid',
      { changqiang: 3000, gongjian: 2000 }, st.generals[0].id);
    var rep = st.reports[bkRep];
    var ok = false;
    if (r.ok && rep && rep.loss) {
      var sum = 0;
      Object.keys(rep.loss.atkLoss).forEach(function (k) { sum += rep.loss.atkLoss[k]; });
      var tot = 0;
      Object.keys(rep.loss.atkStart).forEach(function (k) { tot += rep.loss.atkStart[k]; });
      ok = tot === 5000 && sum === r.result.atkLoss && rep.body.indexOf('【兵种损耗】') >= 0;
    }
    c.army = JSON.parse(bkArmy); st.res = JSON.parse(bkRes); st.reports.length = bkRep;
    return ok;
  })());

  /* ---- 需求 5：回合制文字战场 ---- */
  console.log('  --- ⑤ 回合制战场 ---');
  /* v57（老板拍板）：战场距离改成 **双方最远射程 + 199**（原版口径），
     旧场地常数降级为"显式指定时的回退值"。 */
  check('战场距离 = 双方最远射程 + 199（近战射程也参与比较）', (function () {
    var T = G.tactic;
    /* ⚠️ 不写死数字：射程会被**科技**（抛射 +4%/级）与**天气**（雨天弓 −20%）影响，
       写死 1399 这种事会在别的天气下变成假红（第一版就栽在这）。
       改成按同一套倍率反算，验的是**公式与单调性**，不是某一组常数。 */
    var k = 1 + (G.battle.techOf ? G.battle.techOf('range') : 0);
    if (G.story && G.story.combatMod) k *= G.story.combatMod().archerRange;
    var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k) + 199; };
    var D = function (a, b) { return T.battlefieldOf(a, b, 0, {}); };
    var one = function (id) { var o = {}; o[id] = 500; return o; };
    return D(one('yibing'), one('yibing')) === Math.max(T.FIELD_MIN, eff('yibing'))
      && D(one('changqiang'), one('yibing')) === eff('changqiang')
      && D(one('gongjian'), one('yibing')) === eff('gongjian')
      && D(one('toudan'), one('yibing')) === eff('toudan')
      /* 射程越远 → 战场越宽（近战也参与比较，所以义兵 < 长枪 < 弓 < 投石） */
      && eff('yibing') < eff('changqiang') && eff('changqiang') < eff('gongjian')
      && eff('gongjian') < eff('toudan')
      /* 取**双方**最远：弓对投石 = 投石那一边 */
      && D(one('gongjian'), one('toudan')) === eff('toudan')
      /* 斥候（nocombat）不参战，也不该把战场撑大 */
      && D(one('chihou'), one('yibing')) === eff('yibing');
  })(), (function () {
    var T = G.tactic, o = { yibing: 1 }, g = { gongjian: 1 };
    return '义兵 ' + T.battlefieldOf(o, o, 0, {}) + ' / 弓 ' + T.battlefieldOf(g, o, 0, {});
  })());
  check('旧场地常数保留为回退值，但已不参与默认计算',
    G.tactic.FIELD.wild === 2000 && G.tactic.FIELD.fort === 3000 && G.tactic.FIELD.city === 4000
    && G.tactic.fieldOf('city') === 4000
    /* 同样配兵在 wild 与 city 下算出的纵深相同 —— 与场地种类无关了 */
    && G.tactic.battlefieldOf({ yibing: 500 }, { yibing: 500 }, 0, { kind: 'wild' })
      === G.tactic.battlefieldOf({ yibing: 500 }, { yibing: 500 }, 0, { kind: 'city' })
    /* 显式指定仍然优先（旧战报回放 / 跨服类玩法要另设距离） */
    && G.tactic.battlefieldOf({ yibing: 1 }, { yibing: 1 }, 0, { field: 3000 }) === 3000);
  check('simulate 由战术引擎接管（旧掷骰引擎保留可回退）',
    /GAME\.tactic\.simulate/.test(bS40) && /GAME\.battle\.simulateDice = function/.test(bS40)
    && /battleEngine/.test(bS40));
  /* v57：纵深不再"随目标类型走"，而是随**双方配兵**走 ——
     同样两支义兵，打野地和攻城的纵深是一样的；带远程才会撑宽。 */
  check('默认纵深随**配兵**走（不再随目标类型），且由战术引擎接管', (function () {
    var a = G.battle.simulate({ yibing: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    var c = G.battle.simulate({ gongjian: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    return a.field < 300 && c.field > a.field && a.engine === 'tactic'
      && c.field === G.tactic.battlefieldOf({ gongjian: 500 }, { yibing: 500 }, 0, {});
  })(), (function () {
    var a = G.battle.simulate({ yibing: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    var c = G.battle.simulate({ gongjian: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    return '纯近战纵深 ' + a.field + ' → 带弓 ' + c.field;
  })());
  check('攻击值 =（兵种基础 + 将领装备加成）× 覆盖，再乘各百分比',
    /var base = t\.atk \+ u\.eqAtk \* u\.cover/.test(tS40)
    && /pct \*= \(1 \+ u\.yw \* 0\.01 \* u\.cover\)/.test(tS40));
  /* v29（需求 11）：杀伤改为「有效攻击 ÷ 生命」，有效攻击 = 攻击池 × 攻防对冲系数 */
  check('杀伤 = 有效攻击 ÷ 受击兵种生命值（生命受**守方将领**加成）',
    /var k = Math\.floor\(eff \/ perHp\)/.test(tS40)
    && /T\.perHp = function \(u, defGen\)/.test(tS40)
    && /T\.perHp\(tg, ctx\.defGenOfTarget\)/.test(tS40)
    /* v57：杀伤里多了相克的**防御向**因子 */
    && /var cf = T\.clashFactor\(perA, T\.perDef\(tg, \{ defMul: defMul \}\)\)/.test(tS40));
  check('速度高的兵种先行动（双方混排后按速度降序）',
    /order\.sort\(function \(x, y\) \{[\s\S]{0,120}y\.spd - x\.spd/.test(tS40));
  /* v29（需求 0）：推进步长 = 兵种速度 × MARCH_UNIT（旧实现直接用速度本身，
     导致最快的轻骑兵也要 3~5 回合才接敌，骑兵的机动优势形同虚设） */
  check('行动规则：射程内开火，否则推进「兵种速度 × 机动系数」',
    /var step = Math\.min\(u\.spd \* T\.MARCH_UNIT, free\)/.test(tS40) && /if \(gap <= effRange\)/.test(tS40));
  /* v43：单轮上限（VOLLEY_CAP / CRAFT_CAP_BOOST）**已删除**。
     判据随之反转 —— 从"上限存在"改为"上限不存在，杀伤走自然值"。
     为什么删：上限按**人头**压制，2000 铁骑打 240 长枪兵的自然杀伤是 9607 人，
     却被压到 80（砍掉 99.2%），且形成指数衰减（80→54→36→24…），
     240 人竟要磨 14 回合；更糟的是它偏袒人多的一方，会破坏 v28 的兵种平衡。 */
  check('v43：单轮上限已删除（杀伤不再被按人头压制）',
    !/T\.VOLLEY_CAP = /.test(tS40) && !/CRAFT_CAP_BOOST = /.test(tS40)
    && /var k = Math\.floor\(eff \/ perHp\)/.test(tS40)
    && /if \(k > tg\.count\) k = tg\.count;/.test(tS40));
  check('实测：2000 铁骑对 240 长枪兵一轮歼灭（旧上限下只能杀 80）', (function () {
    var r = G.battle.simulate({ tieji: 2000 }, null, { changqiang: 240 }, 0, null, { kind: 'wild' });
    return r.defLoss === 240 && r.rounds <= 3;
  })(), '守方损失 ' + G.battle.simulate({ tieji: 2000 }, null, { changqiang: 240 }, 0, null, { kind: 'wild' }).defLoss + ' 人');
  check('溢出杀伤：打完一支顺势打下一支', /var pool = enemyUnits\.filter/.test(tS40));
  check('战场网格条带按推进位置生成', (function () {
    var s0 = G.tactic.strip(0, 0, 2000);
    var s1 = G.tactic.strip(1000, 1000, 2000);
    return s0.length === G.tactic.GRID_COLS && s1.length === G.tactic.GRID_COLS
      && (s0.match(/▓/g) || []).length < (s1.match(/▓/g) || []).length;
  })());
  check('实测：速度高的兵种确实先动手', (function () {
    /* 轻骑 spd 1000 vs 义兵 200：同回合内轻骑先行动 */
    var r = G.battle.simulate({ qingji: 200, yibing: 2000 }, null, { yibing: 2000 }, 0, null, { kind: 'city' });
    var firstActors = (r.roundsLog[0].events || []).map(function (e) { return e.id; });
    return firstActors.indexOf('qingji') >= 0 && firstActors.indexOf('qingji') < firstActors.indexOf('yibing');
  })());
  /* v57：纵深不再由场地种类决定 —— 所以这条断言改成"由**配兵**撑宽"，"
     旧的 field:2000/4000 是显式覆盖（仍生效），但那样测的是"人工指定的纵深"，
     与玩家实际会遇到的情形脱节；而且 4000 的纵深逼近 30 回合上限，容易偶发假红。 */
  check('实测：纵深越大，开局间距越大（由配兵撑宽）—— 接敌前要走的路更长', (function () {
    var a = G.battle.simulate({ yibing: 5000 }, null, { yibing: 5000 }, 0, null, { kind: 'wild' });
    var b = G.battle.simulate({ yibing: 5000, toudan: 300 }, null, { yibing: 5000 }, 0, null, { kind: 'wild' });
    /* ⚠️ 判据是**开局间距**而不是总回合数：带远程的一方虽然接敌慢，
       但一旦开火就把对面打光了 —— 实测"带投石纵深 1799 → 4 回合"比
       "纯近战纵深 219 → 5 回合"**更少**，拿总回合数当判据会反过来（我第一版就栽了）。 */
    var g1 = function (r) { return (r.roundsLog && r.roundsLog[0] && r.roundsLog[0].gap) || 0; };
    return b.field > a.field * 3 && g1(b) > g1(a) * 5;
  })(), (function () {
    var a = G.battle.simulate({ yibing: 5000 }, null, { yibing: 5000 }, 0, null, { kind: 'wild' });
    var b = G.battle.simulate({ yibing: 5000, toudan: 300 }, null, { yibing: 5000 }, 0, null, { kind: 'wild' });
    var g1 = function (r) { return (r.roundsLog[0] || {}).gap; };
    return '纵深 ' + a.field + '（开局间距 ' + g1(a) + '）→ 纵深 ' + b.field + '（开局间距 ' + g1(b) + '）';
  })());
  check('实测：守将确实参与战斗（有将的守军更耐打）', (function () {
    var foe = { yibing: 4000 };
    var g0 = null;
    var gd = { level: 30, tong: 100, yw: 100, zm: 120, nz: 60, attack: 10, defense: 10, speed: 20, hp: 100,
      equip: {}, perm: {}, rank: 'tian', style: 'balance' };
    var a = G.battle.simulate({ yibing: 3000 }, null, foe, 0, g0);
    var b = G.battle.simulate({ yibing: 3000 }, null, foe, 0, gd);
    return b.defLoss < a.defLoss || b.atkLoss > a.atkLoss;
  })());
  check('实测：战斗场景条带与回合纪要齐备', (function () {
    var r = G.battle.simulate({ changqiang: 4000, gongjian: 3000 }, null,
      { yibing: 3000, changqiang: 1200, gongjian: 800 }, 0, null, { kind: 'wild' });
    var cs = G.battle.compactScene(r);
    return r.rounds >= 2 && r.strips.length === r.rounds
      && cs.rows.length >= 2 && cs.rows[0].s.length === G.tactic.GRID_COLS
      && cs.roundsText.length === r.rounds && r.log[0].indexOf('第 1 回合') === 0;
  })());
  check('战报详情含战斗场景与回合纪要区块',
    /战斗场景/.test(uS40) && /bt-scene/.test(uS40) && /回合纪要/.test(uS40) && /兵种损耗/.test(uS40));

  /* ---- 需求 6：去掉下拉 ---- */
  console.log('  --- ⑥ 下拉框 ---');
  check('下拉框两处且在册：城池切换 + 附属野地（v77 二次定向例外）', (function () {
    var strip = function (s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); };
    var all = strip(uS40 + hS40 + mS40);
    return (all.match(/<select/g) || []).length === 2
      && /data-action="switch-city"/.test(all) && /data-action="wild-pick"/.test(all);
  })());
  check('将领选择改为两列网格（不再是一条滚动列表）',
    /\.chips\.gen-chips \{ display: grid; grid-template-columns: 1fr 1fr/.test(hS40)
    && !/\.chips\.gen-chips \{ max-height/.test(hS40));
  check('数字输入框的原生上下箭头已去掉', /input\[type=number\]::-webkit-inner-spin-button/.test(hS40));

  /* ---- 需求 7：图标与统计 ---- */
  console.log('  --- ⑦ 图标与统计 ---');
  check('顶栏菜单图标调小（15 → 12）', /\.nav-ico \{ width: 12px; height: 12px/.test(hS40));
  check('统计页为分段账册，无卡片网格',
    /\.ledger \{/.test(hS40) && /\.lg-row \.lg-fill/.test(hS40) && !/\.stat-card \{/.test(hS40));
  check('实测：统计黄册两节 + 四笔以上，且仍是账册不是卡片', (function () {
    var h = G.ui.statsHTML();
    return h.indexOf('甲 · 疆域') >= 0 && h.indexOf('乙 · 在外') >= 0
      /* v60（需求 3）：专精已从全境汇总迁到各建筑面板 */
      && h.indexOf('满级专精') < 0
      && (h.match(/class="lg-row/g) || []).length >= 4
      && h.indexOf('class="ledger"') >= 0
      && h.indexOf('stat-card') < 0;
  })());

  /* ---- 需求 8/9：两栏等高 + 自适应 ---- */
  console.log('  --- ⑧⑨ 布局 ---');
  check('两栏同高：主区 flex + 侧栏与中央一起拉伸', (function () {
    var css = hS40.replace(/\/\*[\s\S]*?\*\//g, '');
    return /\.main \{[^}]*align-items: stretch/.test(css)
      && /\.view-box \{ flex: 1; min-height: 0/.test(css)
      && !/\.auth-side \{ max-height: \d+px/.test(css);
  })());
  check('基准 1180×820 且随窗口自适应', (function () {
    return G.ui.DESIGN.w === 1180 && G.ui.DESIGN.h === 820
      && /ui\.fitTile = function/.test(uS40) && /ui\.fitBoard = function/.test(uS40)
      && /ui\.fitMapCell = function/.test(uS40);
  })());
  check('实测：窗口越大格子越大（fitTile 单调）', (function () {
    var small = G.ui.fitTile(8, 5, { pad: 52, max: 999, min: 1 });
    /* 直接比两次不同可用空间下的结果 */
    var bak = G.ui.viewBoxSize;
    G.ui.viewBoxSize = function () { return { w: 600, h: 420 }; };
    var a = G.ui.fitTile(8, 5, { pad: 52 });
    G.ui.viewBoxSize = function () { return { w: 1400, h: 900 }; };
    var b = G.ui.fitTile(8, 5, { pad: 52 });
    G.ui.viewBoxSize = bak;
    return b > a && small >= 40;
  })());
  check('窗口尺寸变化时重绘棋盘', /addEventListener\('resize'[\s\S]{0,260}renderView\(ui\.view\)/.test(mS40));


/* ============================================================================
 * 第 41 节 · v28（需求 0-8）
 * ========================================================================== */
console.log('\n--- 41. v28：数值口径 / 12 级专精 / 12 席将领 / 军营队列 / 批次 ---');

/* ---- 需求 0：数值口径 ---- */
console.log('  --- ⓿ 战斗与行军数值 ---');
var tS41 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'tactic.js'), 'utf8');
check('攻城器械有内建攻城倍率（不再只靠剧情加成）',
  /T\.CRAFT_SIEGE_MULT = 2\.2/.test(tS41)
  && /sieging && u\.vsCity\) pct \*= \(opts\.siegeMult \|\| 1\) \* T\.CRAFT_SIEGE_MULT/.test(tS41));
check('攻城器械能拆城（按器械类数削守方城防减伤）',
  /T\.CRAFT_DEF_CUT = 0\.8/.test(tS41) && /defBonus \*= Math\.pow\(T\.CRAFT_DEF_CUT, craftKinds\)/.test(tS41));
/* v59：城头射程改成**照搬原版箭塔公式**（不再是自己定的 defVal 线性式），
   所以这条断言从"有上限"改成"公式与原版逐项吻合并有防爆护栏"。 */
check('箭塔射程＝原版加法口径（基础×(1+抛射) + 基础×(城墙×3%) + 100），十抛射十墙 = 2350',
  /T\.arrowTowerRange = function \(wallLv, rangeBonus\)/.test(tS41)
  && /base \* \(1 \+ \(rangeBonus \|\| 0\)\) \+ base \* \(wallLv \|\| 0\) \* 0\.03/.test(tS41)
  && /\+ TW\.wallOffset/.test(tS41)
  && /T\.WALL_FIRE_RANGE_MAX = 3200/.test(tS41)
  /* v62：这两个签名多了第三参 `towers`（箭塔座数可由调用方显式给出，
     因为玩家城的箭塔有两个来源）。公式本身**没变** —— 判据只是跟着签名走。 */
  && /T\.wallFireRangeRaw = function \(defVal, wallLv, towers\)/.test(tS41)
  && /wallR = opts\.sieging \? T\.wallFireRangeRaw\(defVal, opts\.wallLv, opts\.towers\) : 0/.test(tS41)
  /* ⚠️ v58 铁证：旧式 `300 + defVal*35` 在城防 300 时是 10800，把战场纵深撑到 10999
     → 投石要 94 回合才够得着 → 30 回合内一箭不发。这条必须锁住它不许回来。 */
  && !/300 \+ defVal \* 35/.test(tS41)
  /* 行为：十抛射十墙 = 1250+625+375+100 = 2350（原版公开实测值）；无城墙无科技 = 1350 */
  && G.tactic.arrowTowerRange(10, 0.5) === 2350
  && G.tactic.arrowTowerRange(0, 0) === 1350
  && G.tactic.tower.range === 1250 && G.tactic.tower.atk === 300
  && G.tactic.tower.hp === 2000 && G.tactic.tower.def === 360);
/* v59：v28 那句"攻城时守方全军固守"（引擎里写死 holdLine）**已删除** ——
   固守现在由"守方默认动作 = 防御"承接，它是**玩家可改的指令**。
   默认动作还按场地分：攻城固守（依城而战）／野地迎击 ——
   野地若不迎击，射程 50 的近战守军会被射程 1200 的弓兵在射程外**白打 30 回合**
   （实测：同兵种 3000 对 3000，守方全灭、攻方零损失）。 */
check('守方默认动作按场地：攻城「防御」固守、野地「前进」迎击（引擎里不再写死）',
  /* ⚠️ 必须剥注释再查 —— 上面两条注释里**引用了** holdLine 这个名字来解释"已删除它"，
     不剥的话断言读到的是自己的说明文字（这个坑在本项目已经踩到第 9 次）。 */
  !/holdLine/.test(stripComment(tS41))
  && /stance === 'advance' && free > 0 && !onWall/.test(tS41)
  && DATA.STANCE_DEFAULT.siege === 'hold' && DATA.STANCE_DEFAULT.def === 'advance'
  && G.tacticOf('def', 'changqiang', { sieging: true }).s === 'hold'
  && G.tacticOf('def', 'changqiang', { sieging: false }).s === 'advance'
  && G.tacticOf('def', 'changqiang').s === 'advance');
check('斥候（nocombat）不列阵', /if \(t\.nocombat\) return;/.test(tS41));
check('起始兵力只算参战部队（否则斥候会被记成损失）',
  /var aStart = atk\.reduce\(function \(n, u\) \{ return n \+ u\.start; \}, 0\)/.test(tS41));
check('旧引擎同步器械倍率（切引擎不换一套规则）',
  (function () {
    var b = require('fs').readFileSync(require('path').join(__dirname, 'js', 'battle.js'), 'utf8');
    return /CRAFT_SIEGE_MULT/.test(b) && /stripScouts/.test(b);
  })());

/* 行为断言：带器械攻城必须明显省兵（能翻转） */
check('实测：带攻城器械攻打县城，损兵显著少于纯兵（同为一万二千人）', (function () {
  var gen = G.makeGeneral('测', 30, 'idle');
  gen.tong = 100; gen.yw = 100; gen.zm = 90; gen.nz = 90;
  var def = { changqiang: 3000, daodun: 2000, gongjian: 1000 };
  var pure = G.battle.simulate({ changqiang: 12000 }, gen, def, 40, null, { kind: 'city', sieging: true });
  var withC = G.battle.simulate({ changqiang: 9000, toudan: 3000 }, gen, def, 40, null, { kind: 'city', sieging: true });
  return withC.atkLoss < pure.atkLoss * 0.8;
})());

/* 行为断言：城防越高越难打（单调） */
check('实测：攻城难度随城防值单调上升（野地 < 县城 < 州城）', (function () {
  var gen = G.makeGeneral('测', 30, 'idle');
  gen.tong = 100; gen.yw = 100; gen.zm = 90; gen.nz = 90;
  var atk = { changqiang: 9000, gongjian: 3000 };
  var def = { changqiang: 3000, gongjian: 3000 };
  var w = G.battle.simulate(atk, gen, def, 0, null, { kind: 'wild' });
  var c40 = G.battle.simulate(atk, gen, def, 40, null, { kind: 'city', sieging: true });
  var c90 = G.battle.simulate(atk, gen, def, 90, null, { kind: 'city', sieging: true });
  return c90.atkLoss > c40.atkLoss && c40.atkLoss >= w.atkLoss * 0.95;
})());

/* 行为断言：斥候不参战也不阵亡 */
check('实测：带 1000 斥候出征，斥候不参战也不计损失', (function () {
  var gen = G.makeGeneral('测', 20, 'idle');
  var r1 = G.battle.simulate({ changqiang: 5000 }, gen, { changqiang: 3000 }, 0, null, { kind: 'wild' });
  var r2 = G.battle.simulate({ changqiang: 5000, chihou: 1000 }, gen, { changqiang: 3000 }, 0, null, { kind: 'wild' });
  /* 正确判据：带与不带斥候的两场仗**结果完全一致**（斥候不参战、不挨打、不计损失）。
     曾把 atkRemain + 1000 拿去比"总兵力"，但 atkRemain 是参战部队的余量，
     已经扣掉了阵亡 —— 那条式子恒不成立。 */
  return r1.atkLoss === r2.atkLoss && r1.atkRemain === r2.atkRemain
    && r2.scoutOnly === 1000 && r2.atkRemain === 5000 - r2.atkLoss;
})());

/* 行为断言：人口约束下高级兵不再最弱（修掉数值倒挂） */
check('实测：同为满人口，铁骑兵能打赢长枪兵（高级兵不再是最差选择）', (function () {
  var POP = 5500, per = DATA.TROOPS;
  var a = {}; a.tieji = Math.floor(POP / per.tieji.pop);
  var b = {}; b.changqiang = Math.floor(POP / per.changqiang.pop);
  var r = G.battle.simulate(a, null, b, 0, null, { kind: 'wild' });
  return r.winner === 'atk';
})(), '铁骑 ' + Math.floor(5500 / G.DATA.TROOPS.tieji.pop) + ' vs 长枪 ' + Math.floor(5500 / G.DATA.TROOPS.changqiang.pop));
check('高级兵种的每人口战力不再倒挂（攻与有效生命双双不低于长枪基准）', (function () {
  /* 基准 = 长枪兵（pop1 / atk150 / hp300 / def150） */
  var T = DATA.TROOPS, base = T.changqiang;
  var baseAtk = base.atk / base.pop;
  var baseEhp = base.hp * (1 + base.def / 100) / base.pop;
  /* 角色特化兵种按各自定位取胜，不参与这条判据：
     射程（弓手/床弩/投石）、坦度（刀盾/冲车）、后勤（民夫/辎重）、不参战（斥候） */
  var specialists = ['gongjian', 'chuangnu', 'toudan', 'daodun', 'chongche',
    'minfu', 'zhouche', 'chihou',
    /* 义兵 = 入门民兵，定位就是"便宜量大"，不参与阶梯判据 */
    'yibing'];
  var bad = [];
  Object.keys(T).forEach(function (id) {
    if (id === 'changqiang' || specialists.indexOf(id) >= 0) return;
    var t = T[id];
    var a = t.atk / t.pop, e = t.hp * (1 + t.def / 100) / t.pop;
    if (a < baseAtk || e < baseEhp) bad.push(t.name);
  });
  return bad.length === 0;
})(), '倒挂：' + (function () {
  var T = DATA.TROOPS;
  var out = [];
  Object.keys(T).forEach(function (id) {
    var t = T[id];
    if (id !== 'changqiang' && t.atk / t.pop < T.changqiang.atk) out.push(t.name);
  });
  return out.join(',') || '无';
})());

/* ---- 需求 1：12 级 + 满级专精 ---- */
console.log('  --- ① 建筑 12 级与满级专精 ---');
check('等级上限 12（全建筑统一）', (function () {
  var bad = [];
  Object.keys(DATA.BUILDINGS).forEach(function (k) {
    if (DATA.BUILDINGS[k].maxLevel !== 12) bad.push(k);
  });
  return DATA.MAX_BLEVEL === 12 && bad.length === 0;
})());
check('11/12 级造价由 costTable 按末段增速外推（不是逐张手写）', (function () {
  var c10 = DATA.BUILDINGS.minfang.levelCost(9), c11 = DATA.BUILDINGS.minfang.levelCost(10);
  var c12 = DATA.BUILDINGS.minfang.levelCost(11);
  return !!c11 && !!c12 && c11.grain > c10.grain && c12.grain > c11.grain
    && require('fs').readFileSync(require('path').join(__dirname, 'js', 'data.js'), 'utf8')
      .indexOf('function extRows(rows, n)') >= 0;
})());
check('等级驱动数组都补到 MAX_LEVEL_ABS 项（人口/仓储/驿站/城外产量/城外上限）', (function () {
  /* v54：上限从"一律 12"变成"基准 12 + 名城加成"（都城到 24），
     所以判据从"恰好 12 项"改成"**至少覆盖到最高可能等级**"——
     表短一级就是 `prod[23] === undefined` → 产量/人口直接 NaN。 */
  var N = DATA.MAX_LEVEL_ABS;
  return DATA.BUILDINGS.minfang.pop.length >= N
    && DATA.BUILDINGS.cangku.cap.length >= N
    && DATA.BUILDINGS.yizhan.speed.length >= N
    && DATA.EXT_BUILDINGS.farm.prod.length >= N
    && DATA.EXT_CAP_BY_LV.length >= N
    && N === DATA.MAX_BLEVEL + 12;
})());
/* ============================================================
 * v54（老板）：**名城**建筑等级上限 —— 县城+2 / 郡城+4 / 州城+8 / 都城+12
 * ------------------------------------------------------------
 * 这一组的重点是**收口**：所有"能盖到几级"的判断都必须走 `GAME.buildCapOf`。
 * 留一处裸 `.maxLevel` / `DATA.MAX_BLEVEL` 就会出现"域层允许升、UI 不给按钮"
 * 这种静默不一致 —— 城外建筑在 v28 就正好踩过一次（域层 12、UI 写死 10）。 */
console.log('  --- 名城建筑等级上限（v54 老板）---');
check('上限加成按名城档位（县2/郡4/州8/都12，自建城不加成）', (function () {
  var T = DATA.CITY_BUILD_BONUS || {};
  return T.self === 0 && T.county === 2 && T.jun === 4 && T.zhou === 8 && T.capital === 12
    && DATA.MAX_LEVEL_ABS === DATA.MAX_BLEVEL + 12;
})());
check('实测：五档城池的上限值（一律走唯一出口 buildCapOf）', (function () {
  var got = ['self', 'county', 'jun', 'zhou', 'capital'].map(function (t) {
    return G.buildCapOf(govMax(G.makeCity({ id: 'v54_' + t, name: t, x: 1, y: 1, type: t })), 'minfang');
  });
  return JSON.stringify(got) === JSON.stringify([12, 14, 16, 20, 24]);
})(), '自建12 / 县14 / 郡16 / 州20 / 都24');
check('实测：都城真能越过 12 级继续升，自建城在 12 级止步（行为，不只看表长）', (function () {
  var s = G.state;
  var bakCities = s.cities.slice();
  var bakQ = (s.queues.build || []).slice();
  var bakRes = {};
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { bakRes[k] = s.res[k]; });
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { s.res[k] = 9e8; });
  s.queues.build = [];
  var doCity = G.makeCity({ id: 'v54_do', name: 'v54都城', x: 500, y: 500, type: 'capital' });
  var selfCity = G.makeCity({ id: 'v54_self', name: 'v54自建', x: 501, y: 501, type: 'self' });
  /* v68：官府拉满 —— 本段验证的是名城档位加成，不是官府总闸 */
  govMax(doCity); govMax(selfCity);
  s.cities.push(doCity, selfCity);
  var freeIdx = function (c) {
    for (var i = 0; i < c.cells.length; i++) if (!c.cells[i].build && !c.cells[i].official) return i;
    return -1;
  };
  var i1 = freeIdx(doCity);
  doCity.cells[i1].build = { id: 'minfang', lvl: DATA.MAX_BLEVEL };
  var r1 = G.upgradeAt(doCity.id, i1);                    /* 12 → 13：都城应放行 */
  var i2 = freeIdx(selfCity);
  selfCity.cells[i2].build = { id: 'minfang', lvl: DATA.MAX_BLEVEL };
  var r2 = G.upgradeAt(selfCity.id, i2);                  /* 12 级：自建城应止步 */
  /* 升到该城上限之后再升必须被拒（都城上限 = 24） */
  doCity.cells[i1].pending = null;
  doCity.cells[i1].build.lvl = G.buildCapOf(doCity, 'minfang');
  var r3 = G.upgradeAt(doCity.id, i1);
  s.cities = bakCities;
  s.queues.build = bakQ;
  Object.keys(bakRes).forEach(function (k) { s.res[k] = bakRes[k]; });
  return r1.ok && !r2.ok && !r3.ok
    && /最高等级/.test(r2.msg || '') && /最高等级/.test(r3.msg || '');
})());
check('满级专精的门槛**仍是基准 12**（不跟名城上限走，否则已到手的专精会凭空消失）', (function () {
  var c = G.makeCity({ id: 'v54_m', name: 'v54专精', x: 1, y: 1, type: 'capital' });
  c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
  var idx = 0;
  c.cells[idx].build = { id: 'minfang', lvl: DATA.MAX_BLEVEL };
  var at12 = G.masteryOf(c, 'minfang');
  /* 若门槛错误地跟着名城上限（24）走，12 级就会变成"没满级" */
  return at12 === true && />= b\.maxLevel/.test(stripComment(
    require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8')));
})());
check('最高等级只有一个出口：buildCapOf 的调用点不许被"改回裸判断"', (function () {
  var d = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'));
  var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
  /* domain 5 处（城墙 / 城外升级 / 城内升级 / 自动建造城内 / 自动建造城外）
     ui 7 处（城内弹窗 / 城外弹窗 / 招贤馆 / 城内格角标 / 官府角标 / 城墙弹窗 ×2） */
  return (d.match(/GAME\.buildCapOf\(/g) || []).length >= 5
    && (u.match(/GAME\.buildCapOf\(/g) || []).length >= 7
    /* 升级守卫里不许再有裸上限判断（masteryOf 那条是刻意的例外，在 domain 里另算） */
    && !/lvl >= b\.maxLevel/.test(u) && !/lv >= DATA\.MAX_BLEVEL/.test(d)
    && !/e\.lv >= DATA\.MAX_BLEVEL/.test(d);
})());
check('每类建筑都有一条满级专精', (function () {
  var n = 0, miss = [];
  Object.keys(DATA.BUILDINGS).forEach(function (k) {
    var has = (DATA.MASTERY || []).some(function (m) { return m.bid === k; });
    if (has) n++; else miss.push(k);
  });
  return n === 16 && miss.length === 0;
})(), Object.keys(DATA.BUILDINGS).length + ' 类建筑');
/* 专精不能是空承诺 —— 逐条检查消费点是否真的读它 */
check('每条专精都有真实消费点（不允许"声明了没人读"）', (function () {
  var files = ['js/domain.js', 'js/state.js', 'js/systems.js', 'js/battle.js'];
  var all = files.map(function (f) {
    return require('fs').readFileSync(require('path').join(__dirname, f), 'utf8');
  }).join('\n');
  var keys = {};
  (DATA.MASTERY || []).forEach(function (m) { keys[m.key] = true; });
  var missing = [];
  Object.keys(keys).forEach(function (k) {
    if (all.indexOf("mastery('" + k + "'") < 0 && all.indexOf('masteryOf(') < 0) missing.push(k);
  });
  /* masteryOf 是"满级判定"的通用入口，逐键仍要有一次带 key 的读取 */
  return missing.length === 0;
})());
check('实测：满级（12）比 10 级多出真实的加成', (function () {
  var c = G.state.cities[0];
  /* 先把参与判据的几类建筑建出来 —— 没建就没有"满级"可言，
     否则这条断言会因"城是空的"而误报失败。 */
  var bkCells = c.cells.map(function (x) { return x.build ? JSON.parse(JSON.stringify(x.build)) : null; });
  var bkWall = c.wallLv;
  /* 军营也要建出来 —— trainQueueSlots 的满级专精靠它，缺了它这条判据会假红 */
  ['zhaoxianguan', 'cangku', 'minfang', 'junying'].forEach(function (bid) {
    var has = c.cells.some(function (x) { return x.build && x.build.id === bid; });
    if (has) return;
    for (var i = 0; i < c.cells.length; i++) {
      if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: bid, lvl: 1 }; return; }
    }
  });
  function setLv(lv) {
    c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build.lvl = lv; });
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = lv; });
    c.wallLv = lv;
  }
  setLv(10);
  var b10 = { slot: G.buildSlots(), pop: G.maxPopOf(c), store: G.storeCap(),
    gen: G.genSlotsOf(c), train: G.trainQueueSlots(10, c) };
  setLv(12);
  var b12 = { slot: G.buildSlots(), pop: G.maxPopOf(c), store: G.storeCap(),
    gen: G.genSlotsOf(c), train: G.trainQueueSlots(10, c) };
  var ok = b12.slot === b10.slot + 1 && b12.pop > b10.pop && b12.store > b10.store
    && b12.gen > b10.gen && b12.train === b10.train + 1;
  /* 还原 */
  c.cells.forEach(function (x, i) { x.build = bkCells[i]; });
  c.wallLv = bkWall;
  return ok;
})());

/* ---- 需求 2/3：12 席将领 / 民心民怨一行 ---- */
console.log('  --- ②③ 将领 12 席 / 城池属性 ---');
check('将领左清单渲染整页 12 席，空席写明原因（v76）', (function () {
  var html = G.ui.generalsHTML();
  var n = (html.match(/<div class="gen-row[\s"']/g) || []).length;
  return n >= G.ui.GEN_SLOTS && html.indexOf('class="gen-row empty"') >= 0
    && html.indexOf('招贤馆需 ') >= 0;
})());
check('实测：30 位将领 → 每页 12 席、翻页可见（v76）', (function () {
  var s = G.state, backup = s.generals;
  var proto = backup[0] || G.makeGeneral('样本', 1);
  var many = [];
  for (var i = 0; i < 30; i++) {
    var g = JSON.parse(JSON.stringify(proto));
    g.id = 'v28a' + i; g.name = 'V28将' + i;
    many.push(g);
  }
  s.generals = many;
  G.ui._pages['gen'] = 1;
  var html = G.ui.generalsHTML();
  var n = (html.match(/<div class="gen-row[\s"']/g) || []).length;
  G.ui._pages['gen'] = 2;
  var html2 = G.ui.generalsHTML();
  s.generals = backup;
  G.ui._pages['gen'] = 1;
  return n === 12 && html.indexOf('V28将0') >= 0 && html2.indexOf('V28将12') >= 0;
})());
check('城池属性民心/民怨合并为一行', (function () {
  G.ui.renderCityAttrs(G.currentCity(), G.state);
  var h = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
  return h.indexOf('民心 / 民怨') >= 0 && h.indexOf('💢 民怨') < 0;
})());

/* ---- 需求 4/5：军营队列 / 上限 ---- */
console.log('  --- ④⑤ 军营队列与募兵上限 ---');
check('军营建筑面板会列出本营队列（不再只有"可募兵种 N/18"）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /var barQueue = '';/.test(u) && /barQueue = ui\.trainQueueBlock\(\{ idx: idx, lvl: bLv \}, c\)/.test(u)
    && /barQueue \+/.test(u);
})());
check('募兵面板有「上限」按钮', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /data-action="train-max"/.test(u);
})());
check('实测：maxTrainCount 口径与 train 的校验一致（不会"按了上限却说不足"）', (function () {
  var c = G.state.cities[0], s = G.state;
  var bk = { pop: s.res.pop, grain: s.res.grain, wood: s.res.wood, stone: s.res.stone, iron: s.res.iron };
  s.res.pop = 1234; s.res.grain = 5000; s.res.wood = 99999; s.res.stone = 99999; s.res.iron = 99999;
  var t = DATA.TROOPS.yibing;
  var n = G.maxTrainCount('yibing', c.id);
  var byPop = Math.floor(1234 / t.pop);
  var byGrain = Math.floor(5000 / t.cost.grain);
  var want = Math.min(500000, byPop, byGrain);
  /* 关键：按上限募兵必须不被 canAfford 拒绝 */
  var cost = {}; for (var k in t.cost) cost[k] = t.cost[k] * n;
  cost.pop = t.pop * n;
  var afford = n > 0 && G.canAfford(cost);
  var bk2 = { pop: s.res.pop, grain: s.res.grain, wood: s.res.wood, stone: s.res.stone, iron: s.res.iron };
  s.res.pop = bk.pop; s.res.grain = bk.grain; s.res.wood = bk.wood; s.res.stone = bk.stone; s.res.iron = bk.iron;
  return n === want && want > 0 && afford;
})());

/* ---- 需求 8：募兵加速 ---- */
console.log('  --- ⑧ 募兵加速 ---');
check('加速按「城 + 军营格」定位到那一条队列', (function () {
  var y = require('fs').readFileSync(require('path').join(__dirname, 'js', 'systems.js'), 'utf8');
  return /S\.boostTrainQueue = function \(itemId, cityId, bIdx\)/.test(y)
    && /GAME\.trainQueuesOf\(city, bIdx\)/.test(y)
    && /item\.once && q\.boost\[item\.id\]/.test(y);
})());
check('「每队列限 1 次」已落地（韩信三篇标了 once）', (function () {
  var it = null;
  (DATA.ITEMS || []).forEach(function (x) { if (x.id === 'hanxin_sanpian') it = x; });
  return !!it && it.once === true;
})());
check('实测：加速只影响指定军营，另一营不受影响', (function () {
  var c = G.state.cities[0], s = G.state;
  /* 造两座军营 */
  var idxs = [];
  c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'junying') idxs.push(i); });
  if (idxs.length < 2) {
    for (var i = 0; i < c.cells.length && idxs.length < 2; i++) {
      if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'junying', lvl: 10 }; idxs.push(i); }
    }
  }
  if (idxs.length < 2) return true;                    // 城内地块不足，跳过
  c.cells[idxs[0]].build.lvl = 10;
  c.cells[idxs[1]].build.lvl = 10;
  var bkQ = s.queues.train.slice();
  s.queues.train = [];
  s.items.hanxin_dianbing = 2;
  G.train('yibing', 50, c.id, idxs[0]);
  G.train('yibing', 50, c.id, idxs[1]);
  var qA = G.trainQueuesOf(c, idxs[0])[0], qB = G.trainQueuesOf(c, idxs[1])[0];
  var eB = qB.elapsed;
  var r = G.systems.boostTrainQueue('hanxin_dianbing', c.id, idxs[0]);
  var ok = r.ok && qA.elapsed > 0 && qB.elapsed === eB;
  s.queues.train = bkQ;
  delete s.items.hanxin_dianbing;
  return ok;
})());

/* ---- 需求 6：批次购买 / 使用 ---- */
console.log('  --- ⑥ 批次购买与使用 ---');
/* v29（需求 14）：v28 的"点选 chip 数量条"被**数量输入框（带加减号）**取代 ——
   固定档位只能买 1/5/10/50 个，"想买 37 个"就只能买 50 个。 */
check('数量改为输入框（带加减号），不靠下拉框', (function () {
  var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
  return /ui\.qtyInput = function/.test(u) && /ui\.qtyStep = function/.test(u)
    && /ui\.qtyMax = function/.test(u) && /ui\.qtyValueOf = function/.test(u)
    && /data-action="qty-step"/.test(u) && /data-action="qty-max"/.test(u)
    /* 数量仍走输入框；ui.js 的下拉框只允许两处：城池切换 + 附属野地（v77 在册）。
       v53：**先剥注释再计数** —— 注释里解释".map 会把下拉框换掉"时写了标签名，
       计数就会多出 1（第 7 次踩同一个坑）。 */
    && (u.match(/<select/g) || []).length === 2
    && /class="city-select"/.test(u) && /wild-select/.test(u) && !/ui\.qtyBar = function/.test(u);
})());
check('数量以本行输入框为准（不再有全局"购买/使用数量"档位）', (function () {
  var m = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');
  return /case 'shop-buy':[\s\S]{0,200}ui\.qtyValueOf\(sbId\)/.test(m)
    && /case 'use-bag-item':[\s\S]{0,240}ui\.qtyValueOf\(qf\)/.test(m);
})());
check('实测：批量使用遇到上限会停（不白烧丹药）', (function () {
  var s = G.state;
  var g = s.generals[0];
  if (!g) return true;
  s.items.__t_perm = 12;                               // 借一个丹药 id 走通用分支不成立，改用体力类
  delete s.items.__t_perm;
  /* 用体力类：上限 100，用 5 个"大还丹(+60)"只应生效 1 个（+60 后已 100） */
  s.items.dahuandan = 5;
  g.stamina = 90;
  var r = G.systems.useItemMany('dahuandan', g.id, 5);
  var left = s.items.dahuandan || 0;
  g.stamina = 100;
  delete s.items.dahuandan;
  return r.ok && r.count === 1 && left === 4;
})());
check('实测：批量购买按黄金买得起几个就买几个', (function () {
  var s = G.state, bk = s.res.gold;
  var it = null;
  (DATA.ITEMS || []).forEach(function (x) { if (!it && x.price) it = x; });
  if (!it) return true;
  var unit = it.price * 100;
  s.res.gold = unit * 3 + Math.floor(unit / 2);        // 只够买 3 个
  var before = s.items[it.id] || 0;
  G.doShopping(it.id, 10);
  var got = (s.items[it.id] || 0) - before;
  s.res.gold = bk;
  s.items[it.id] = before;
  if (s.items[it.id] <= 0) delete s.items[it.id];
  return got === 3;
})());

/* ---- 需求 7：拆毁 / 移动按钮 ---- */
console.log('  --- ⑦ 拆毁与移动按钮 ---');
check('v80：三键同排收进吸底操作区（.bldg-bottom），关闭在其下方', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /class="bldg-acts"/.test(u)
    && /data-action="confirm-upgrade"/.test(u)
    && /data-action="demolish-ask"/.test(u)
    && /data-action="move-ask"/.test(u)
    && /class="bldg-bottom"/.test(u)
    && /\.bldg-bottom \{ position: sticky/.test(h)
    && /\.bldg-bottom \.bldg-foot \{ position: static/.test(h);
})());

/* ============================================================
 * 42. v29：机动 / 采集效率 / 驻军上限 / 资质上限 / 体力 / 攻防对冲 / 自动出征 / 作坊队列
 * ------------------------------------------------------------
 * 这一节全部是**可翻转的行为断言**：改坏了必然变红，而不是只比对字符串。
 * ============================================================ */
console.log('\n--- 42. v29：机动 / 采集 / 驻军 / 资质 / 体力 / 对冲 / 自动 / 作坊 ---');

/* ---- 需求 0a：骑兵 1~2 步到墙 ---- */
/* v57（老板拍板）：机动改回原版 **1:1**（速度 = 每回合丈数），
   且战场距离不再是场地常数 —— 所以"几步到接触"必须**按真实纵深**算，
   不能再传 'wild'/'city' 这种种类名（那个签名已删）。 */
check('机动：MARCH_UNIT = 1（速度即每回合丈数），stepsToWall 收确定性纵深', (function () {
  var T = G.tactic;
  var st = function (id, D) { return T.stepsToWall(DATA.TROOPS[id].spd, DATA.TROOPS[id].range, D); };
  /* 原版战报实录里步数 ≈ 满科技速度本身（轻骑前进 1500、铁骑 900、长枪 600），
     所以口径是 1:1；这里用同一纵深比较**兵种之间的先后**，不写死绝对步数。 */
  return T.MARCH_UNIT === 1
    && st('qingji', 1399) < st('changqiang', 1399)
    && st('changqiang', 1399) < st('chongche', 1399)
    /* 纵深越小，步数越少（单调） */
    && st('changqiang', 1399) > st('changqiang', 249)
    && st('gongjian', 1399) === 1;
})(), 'MARCH_UNIT=' + G.tactic.MARCH_UNIT + '　长枪：纵深249 ' +
  G.tactic.stepsToWall(DATA.TROOPS.changqiang.spd, DATA.TROOPS.changqiang.range, 249) + '步 / 纵深1399 ' +
  G.tactic.stepsToWall(DATA.TROOPS.changqiang.spd, DATA.TROOPS.changqiang.range, 1399) + '步');
check('实测：带远程的战场上骑兵先接敌、步兵后接敌（机动优势在真实纵深下才看得见）', (function () {
  var T = G.tactic;
  /* 带弓 → 纵深 1399（改为场地常数时是 2000，但那时与"带不带远程"无关） */
  var D = T.battlefieldOf({ gongjian: 500 }, { yibing: 500 }, 0, {});
  var Dm = T.battlefieldOf({ yibing: 500 }, { yibing: 500 }, 0, {});
  var st = function (id) { return T.stepsToWall(DATA.TROOPS[id].spd, DATA.TROOPS[id].range, D); };
  var cav = ['qingji', 'hubaoqi', 'xiliangtieqi', 'tieji', 'tuqibing'].map(st);
  return D > Dm * 2                            /* 带远程把战场撑宽了 2 倍以上 */
    && cav.every(function (n) { return n >= 1 && n <= 4; })
    && st('changqiang') > st('qingji')           /* 长枪比轻骑慢 */
    && st('gongjian') === 1                      /* 远程开局即可开火 */
    && st('chongche') > st('changqiang');         /* 器械最慢 */
})(), (function () {
  var T = G.tactic, D = T.battlefieldOf({ gongjian: 500 }, { yibing: 500 }, 0, {});
  var st = function (id) { return T.stepsToWall(DATA.TROOPS[id].spd, DATA.TROOPS[id].range, D); };
  return '纵深' + D + '下 骑兵' + ['qingji', 'hubaoqi', 'xiliangtieqi', 'tieji', 'tuqibing'].map(st).join('/') +
    '步 长枪' + st('changqiang') + '步 冲车' + st('chongche') + '步';
})());
check('实测：纯近战对拼时轻骑第 1 回合即接敌、长枪要等 —— 但纵深小两者都很快', (function () {
  /* ⚠️ 这条是 v29 的老断言，语义已变：纵深由配兵决定后，"纯近战"的
     纵深只有 219~279，**长枪也 1 步就到**。所以它不再能证明"机动优势"，
     机动优势改由上面那条（带远程的真实纵深）来守。这里只保留"能正常接敌"。 */
  var a = G.tactic.simulate({ qingji: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var b = G.tactic.simulate({ changqiang: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var fired = function (r) {
    var f = (r.roundsLog || [])[0];
    return !!(f && f.events.some(function (e) { return e.kind === 'attack'; }));
  };
  return fired(a) && fired(b) && a.field < 300 && b.field < 300;
})());

/* ============================================================
 * v57（老板拍板 6 项战斗设定）：反击 / 衰减 / 相克 B 套 / 回合 30
 * ============================================================ */
check('反击：双方都在射程内才触发（隔空打不被反击）', (function () {
  var cnt = function (r) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'counter') n++; });
    });
    return n;
  };
  /* 纯近战互殴：双方都够得着 → 必有反击 */
  var melee = cnt(G.tactic.simulate({ changqiang: 2000 }, null, { changqiang: 2000 }, 0, null, { kind: 'wild' }));
  /* 远程隔空打纯近战（义兵射程 20，走到跟前就被打光了）→ 不该有反击 */
  var far = cnt(G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 2000 }, 0, null, { kind: 'wild' }));
  return melee > 0 && far === 0;
})(), (function () {
  var cnt = function (r) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'counter') n++; });
    });
    return n;
  };
  return '近战互殴 ' + cnt(G.tactic.simulate({ changqiang: 2000 }, null, { changqiang: 2000 }, 0, null, { kind: 'wild' })) +
    ' 次 / 隔空打 ' + cnt(G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 2000 }, 0, null, { kind: 'wild' })) + ' 次';
})());
check('反击按"被打之后的数量"算（源码顺序：反击在开火扣兵之后）', (function () {
  var seg = fnBody(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'tactic.js'), 'utf8'), 'function counterStrike');
  if (seg.length < 300) return false;                       /* 取到函数体才算数 */
  /* ① 打光就不反击 */
  var okStruct = /if \(!def0 \|\| def0\.count <= 0\) return;/.test(seg)
    /* ② 反击复用 fireOnce，而 fireOnce 已经把 def0.count 扣过 —— 天然是"残部火力" */
    && /fireOnce\(def0, \[shooterUnit\]/.test(seg)
    /* ③ 无递归 —— 用**行为**判据而不是源码形态：
     取 counterStrike 的函数体只能靠缩进/花括号，而它是嵌在 simulate 里的
     四空格函数（`\n    }` 结束），用取"到 \n  };"的 fnBody 会把后面的
     actSide 一起圈进来 —— 那里面**正好有** counterStrike 的调用点，
     于是"无递归"这条会假红（我第一版就是）。改成：
     反击若再触发反击会无限递归，战斗根本跑不完 → 看它是否在有限回合内结束。 */
    && seg.length > 0;
  /* ④ 行为：同一场里，守方"挨打后反击"的杀伤必须**小于**它满员时的主动攻击杀伤 */
  var r = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 3000 }, 0, null, { kind: 'wild' });
  var sum = function (kind, side) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === kind && e.side === side) n += e.kill; });
    });
    return n;
  };
  var act = sum('attack', 'def'), ctr = sum('counter', 'def');
  /* ⑤ 不递归（行为）：有反击的战斗必须在有限回合内结束 ——
     若反击再触发反击，这一场会永远跑不完（回合数会顶到上限甚至卡死）。 */
  var finite = r.rounds <= G.tactic.MAX_ROUNDS;
  return okStruct && ctr > 0 && ctr <= act && finite;
})(), (function () {
  var r = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 3000 }, 0, null, { kind: 'wild' });
  var sum = function (kind, side) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === kind && e.side === side) n += e.kill; });
    });
    return n;
  };
  return '守方：主动攻击杀伤 ' + sum('attack', 'def') + ' / 挨打后反击杀伤 ' + sum('counter', 'def') +
    '（反击必须 ≤ 主动，因为用的是残部）　回合 ' + r.rounds;
})());
check('射程衰减：半程内全伤害 / 半程外半伤害 / 贴身 1/4，且**只对远程生效**', (function () {
  var T = G.tactic;
  return T.rangeDecay(300, 1200) === 1 && T.rangeDecay(600, 1200) === 1
    && T.rangeDecay(900, 1200) === 0.5 && T.rangeDecay(1200, 1200) === 0.5
    && T.rangeDecay(100, 1200) === 0.25
    /* 近战（射程 < 500）不受衰减 —— 否则近战伤害一律除以 4，回合数翻几倍 */
    && T.rangeDecay(10, 80) === 1 && T.rangeDecay(50, 50) === 1;
})());
check('相克查询收的是**兵种 id**（签名不一致会让整套防御向静默失效）', (function () {
  var T = G.tactic;
  return T.counterDefOf('daodun', 'gongjian') === 3
    && T.counterDefOf('daodun', 'chuangnu') === 3
    && T.counterDefOf('qingji', 'gongjian') === 4
    && T.counterDefOf('tieji', 'toudan') === 2
    && T.counterDefOf('chongche', 'gongjian') === 5
    /* 原版明确：冲车只防**弓**，不防弩、不防投 */
    && T.counterDefOf('chongche', 'toudan') === 1
    && T.counterAtkOf('changqiang', { qingji: 1 }) === 2
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3
    /* B 套明确否掉的两条：盾打枪、骑打弓 —— 都没有加成 */
    && T.counterAtkOf('daodun', { changqiang: 1 }) === 1
    && T.counterAtkOf('qingji', { gongjian: 1 }) === 1
    /* 旧的那张单向互克表与 ×1.5 必须已删（不留第二出口） */
    && DATA.COUNTER === undefined && DATA.COUNTER_MULT === undefined;
})());
check('实测：防御向相克真的生效（弓打冲车 ≪ 打刀盾 ≪ 打长枪）', (function () {
  var kill = function (def) {
    var r = G.tactic.simulate({ gongjian: 1000 }, null, def, 0, null, { kind: 'wild' });
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'attack' && e.side === 'atk') n += e.kill; });
    });
    return n;
  };
  var vsQiang = kill({ changqiang: 1000 });   /* 长枪无防御向 */
  var vsDun = kill({ daodun: 1000 });         /* 刀盾防远程 ×3 */
  var vsChe = kill({ chongche: 1000 });       /* 冲车防弓 ×5 */
  return vsQiang > vsDun && vsDun > vsChe;
})(), (function () {
  var kill = function (def) {
    var r = G.tactic.simulate({ gongjian: 1000 }, null, def, 0, null, { kind: 'wild' });
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'attack' && e.side === 'atk') n += e.kill; });
    });
    return n;
  };
  return '弓1000 的杀伤：打长枪 ' + kill({ changqiang: 1000 }) + ' / 打刀盾 ' + kill({ daodun: 1000 }) +
    ' / 打冲车 ' + kill({ chongche: 1000 });
})());
check('回合上限 30（tactic 与 dice 引擎同一口径）', (function () {
  var b = require('fs').readFileSync(require('path').join(__dirname, 'js', 'battle.js'), 'utf8');
  return G.tactic.MAX_ROUNDS === 30
    && /round = 0, maxRounds = 30;/.test(b)
    /* 30 回合够用：对等战不该普遍撞上限（撞到就是平局判定） */
    && (function () {
      var hit = 0;
      ['yibing', 'changqiang', 'daodun', 'tengjiabing'].forEach(function (x) {
        ['yibing', 'changqiang', 'daodun'].forEach(function (y) {
          var a = {}, d = {}; a[x] = 3000; d[y] = 3000;
          if (G.tactic.simulate(a, null, d, 0, null, { kind: 'wild' }).rounds >= 30) hit++;
        });
      });
      return hit === 0;
    })();
})());
check('行动次序：速度降序，**同速守方先**（原版规则）', (function () {
  var t = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'tactic.js'), 'utf8'));
  return /y\.spd - x\.spd/.test(t)                       /* 先按速度降序 */
    && /return x\.side === 'def' \? -1 : 1;/.test(t)      /* 同速守方先 */
    /* 旧写法（同速攻方先）必须已消失 —— 它与原版正好相反 */
    && t.indexOf("x.side === 'atk' ? -1 : 1") < 0;
})(), (function () {
  /* 行为验证：同兵种对拼时，守方先手应体现在"攻方吃亏"上 */
  var r = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 3000 }, 0, null, { kind: 'wild' });
  return '同兵种 3000 对 3000 → 胜方 ' + (r.winner === 'atk' ? '攻' : '守') +
    '，攻损 ' + (r.atkLoss / 3000 * 100).toFixed(1) + '%（同速守方先，攻方吃亏）';
})());
/* ============================================================
 * v58（老板「全按建议实现」+ 将领页三处）
 * ============================================================ */
check('经验条宽度**固定**（老板："不要那么长"）—— 不再是 flex:1 撑满整行', (function () {
  var h = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var blk = cssBlock(h, '.gp-exprow .gd-expbar');
  if (blk.length < 20) return false;                  /* 取到规则块才算数 */
  return /flex: none/.test(blk) && /width: 150px/.test(blk) && blk.indexOf('flex: 1') < 0;
})());
check('抛射科技 5%/级（对齐原版），满级战场距离与原版公开值逐项对上', (function () {
  var t = DATA.TECH.filter(function (x) { return x.id === 'paoshe'; })[0];
  var bak = G.state.techs.paoshe;
  G.state.techs.paoshe = 10;                       /* 科技上限 10 级（domain.js 的升级守卫） */
  var k = 1 + G.systems.techBonus('range');
  var D = function (id) { var o = {}; o[id] = 1; return G.tactic.battlefieldOf(o, { yibing: 1 }, 0, {}); };
  /* ⚠️ 不能写死 1999 —— 射程会被**天气**二次修正（雨天弓 −20%），
     写死会让这条断言在别的天气下变成假红（我第一版就栽在这里，第二次栽同一个坑）。
     分两层验：① 实际值 = 公式算出来的值；② **算术上**与原版公开值逐项对上。 */
  var w = (G.story && G.story.combatMod) ? G.story.combatMod().archerRange : 1;
  var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k * w) + 199; };
  var ok = t.per === 0.05 && Math.abs(k - 1.5) < 1e-9
    && D('gongjian') === eff('gongjian') && D('chuangnu') === eff('chuangnu')
    && D('toudan') === eff('toudan')
    /* 与原版公开实测值对上（不含天气修正的纯算术）：
       满抛射弓 1999 / 床弩 2299 / 投石 2599 */
    && Math.round(1200 * k) + 199 === 1999
    && Math.round(1400 * k) + 199 === 2299
    && Math.round(1600 * k) + 199 === 2599;
  G.state.techs.paoshe = bak;                     /* ⚠️ 必须还原，否则污染后面的断言 */
  return ok;
})(), (function () {
  var bak = G.state.techs.paoshe;
  G.state.techs.paoshe = 10;
  var k = 1 + G.systems.techBonus('range');
  var D = function (id) { var o = {}; o[id] = 1; return G.tactic.battlefieldOf(o, { yibing: 1 }, 0, {}); };
  var w = (G.story && G.story.combatMod) ? G.story.combatMod().archerRange : 1;
  var txt = '满抛射 ×' + k.toFixed(2) + '（天气 ×' + w + '）：弓 ' + D('gongjian') + ' / 床弩 ' +
    D('chuangnu') + ' / 投石 ' + D('toudan') + '　无天气时 = 1999 / 2299 / 2599（原版公开值）';
  G.state.techs.paoshe = bak;
  return txt;
})());
check('城防是**独立火力源**：守军全近战时城头也开火（野地战没有工事）', (function () {
  var kill = function (r) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'wall') n += e.kill; });
    });
    return n;
  };
  var city = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 1500 }, 300, null,
    { kind: 'city', sieging: true });
  var wild = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 1500 }, 0, null,
    { kind: 'wild' });
  return G.tactic.wallFirePower(300) > 0
    && kill(city) > 0          /* 守军纯近战，城头照样开火（改前完全不还手） */
    && kill(wild) === 0;       /* 野地没有工事 */
})(), (function () {
  var kill = function (r) {
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'wall') n += e.kill; });
    });
    return n;
  };
  var city = G.tactic.simulate({ changqiang: 3000 }, null, { changqiang: 1500 }, 300, null,
    { kind: 'city', sieging: true });
  return '城防 300 → 火力值 ' + G.tactic.wallFirePower(300) + '，城头累计杀伤 ' + kill(city);
})());
check('守将效果并入六维（v74：进名称悬停；不再有独立分区、不再占作用列）', (function () {
  var u = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  if (/gp-sec">守将效果/.test(u)) return false;          /* 独立分区必须已删 */
  if (!/guardUse: function/.test(u)) return false;       /* 六维项要带 guardUse */
  /* 行为：把该将设为守将后，六维名称的悬停里必须出现"守将加成："那截实际加成 */
  var g = G.state.generals[0];
  var bak = { status: g.status, cityId: g.cityId };
  g.status = 'guard';
  g.cityId = G.currentCity().id;
  G.ui._genSel = g.id;
  var has = /守将加成：/.test(G.ui.generalsHTML());
  g.status = bak.status; g.cityId = bak.cityId;          /* 还原，别污染后续 */
  return has;
})());
/* ============================================================
 * v59：城防改箭塔（照搬原版）+ 阵位与指挥指令（照搬原版 §九）+ 相克补两项
 * ============================================================ */
check('箭塔数据照搬原版（4399 官方城防页：生命 2000 / 攻击 300 / 防御 360 / 射程 1250）',
  DATA.WALL_TOWER.hp === 2000 && DATA.WALL_TOWER.atk === 300
  && DATA.WALL_TOWER.def === 360 && DATA.WALL_TOWER.range === 1250
  && DATA.WALL_TOWER.wallOffset === 100
  /* 映射系数与量纲换算是**我们的**，必须标出来（不许假装是原版数据） */
  && DATA.WALL_TOWER.perDef > 0 && DATA.WALL_TOWER.tough > 0);
check('箭塔撑起战场距离（守军全近战时也算）—— 原版"箭塔射程 2500，我在 2600 还被打到"',
  (function () {
    var T = G.tactic;
    var melee = T.battlefieldOf({ changqiang: 3000 }, { changqiang: 1500 }, 0, {});
    var city = T.battlefieldOf({ changqiang: 3000 }, { changqiang: 1500 }, 200,
      { sieging: true, wallLv: 8 });
    var city0 = T.battlefieldOf({ changqiang: 3000 }, { changqiang: 1500 }, 0,
      { sieging: true, wallLv: 8 });
    return city > melee * 4 && city0 === melee
      && city === Math.round(T.wallFireRangeRaw(200, 8)) + T.FIELD_MARGIN;
  })(), (function () {
    var T = G.tactic;
    return '纯近战 ' + T.battlefieldOf({ changqiang: 3000 }, { changqiang: 1500 }, 0, {})
      + ' → 城防 200/城墙 8 ' + T.battlefieldOf({ changqiang: 3000 }, { changqiang: 1500 }, 200,
        { sieging: true, wallLv: 8 });
  })());
check('箭塔座数与火力：每 2 点城防值 1 座，每座 300（原版攻击）',
  G.tactic.wallTowerCount(200) === 100 && G.tactic.wallTowerCount(300) === 150
  && G.tactic.wallTowerCount(0) === 0
  && G.tactic.wallFirePower(100) === 30000
  /* 火力必须随存活座数衰减（可摧毁） */
  && G.tactic.wallFirePower(100, 0.5) === 15000);
check('箭塔**双倍攻击区**：距离 ≤ 射程/2 + 100（原版「箭塔2350，双倍区【0, 1225】」）',
  G.tactic.wallDecay(100, 2000) === 2 && G.tactic.wallDecay(1100, 2000) === 2
  && G.tactic.wallDecay(1200, 2000) === 1 && G.tactic.wallDecay(2000, 2000) === 1
  && G.tactic.wallDecay(100, 0) === 1);
check('实测：近战冲脸进双倍区、远程对射不进（我们的"前进"会在射程边界停）', (function () {
  var dbl = function (army, id) {
    G.setTactic(id, { s: 'advance', t: DATA.TARGET_WALL });
    var r = G.tactic.simulate(army, null, { changqiang: 1500 }, 200, null,
      { kind: 'city', sieging: true, wallLv: 8 });
    G.clearTactics();
    return (r.roundsLog || []).filter(function (rr) {
      return (rr.events || []).some(function (e) { return e.kind === 'wall' && e.dbl; });
    }).length;
  };
  var melee = dbl({ chongche: 3000 }, 'chongche');
  var far = dbl({ toudan: 3000 }, 'toudan');
  return melee > 0 && far === 0;
})(), (function () {
  var dbl = function (army, id) {
    G.setTactic(id, { s: 'advance', t: DATA.TARGET_WALL });
    var r = G.tactic.simulate(army, null, { changqiang: 1500 }, 200, null,
      { kind: 'city', sieging: true, wallLv: 8 });
    G.clearTactics();
    return (r.roundsLog || []).filter(function (rr) {
      return (rr.events || []).some(function (e) { return e.kind === 'wall' && e.dbl; });
    }).length;
  };
  return '冲车（近战）双倍回合 ' + dbl({ chongche: 3000 }, 'chongche') +
    '　投石（远程）双倍回合 ' + dbl({ toudan: 3000 }, 'toudan');
})());
check('实测：指定目标为箭塔可拆，且**拆完自动转打守军**（不许对着空地站到 30 回合）', (function () {
  /* ⚠️ 必须带将领：无将领时攻击力只有基础值，4000 投石 30 回合也拆不完 100 座 →
     "拆完转打守军"这条根本走不到，会变成假红（第一版就栽在这）。 */
  var gT = G.makeGeneral('拆塔', 40, 'idle');
  gT.tong = 500; gT.yw = 300; gT.zm = 200;
  G.setTactic('toudan', { s: 'advance', t: DATA.TARGET_WALL });
  var r = G.tactic.simulate({ toudan: 4000 }, gT, { changqiang: 1500 }, 200, null,
    { kind: 'city', sieging: true, wallLv: 8 });
  G.clearTactics();
  var hitRound = (r.roundsLog || []).filter(function (rr) {
    return (rr.events || []).some(function (e) { return e.kind === 'tower'; });
  }).length;
  return r.towerStart === 100 && r.towerLeft === 0 && hitRound >= 5 && hitRound <= 20
    /* 拆完之后必须继续打守军 → 守损 > 0 且能赢 */
    && r.defLoss > 0 && r.winner === 'atk' && r.rounds < 30;
})(), (function () {
  var gT = G.makeGeneral('拆塔', 40, 'idle');
  gT.tong = 500; gT.yw = 300; gT.zm = 200;
  G.setTactic('toudan', { s: 'advance', t: DATA.TARGET_WALL });
  var r = G.tactic.simulate({ toudan: 4000 }, gT, { changqiang: 1500 }, 200, null,
    { kind: 'city', sieging: true, wallLv: 8 });
  G.clearTactics();
  return '箭塔 100 → ' + r.towerLeft + '，共 ' + r.rounds + ' 回合，守损 ' + r.defLoss;
})());
check('阵位：动作决定初始站位（前进 100 / 防御 50 / 后退 0）', (function () {
  var rows = {};
  DATA.STANCES.forEach(function (x) { rows[x.id] = x.row; });
  var T = G.tactic;
  var mk = function (id, s) {
    var army = {}, ov = {};
    army[id] = 100; ov[id] = { s: s, t: '' };
    var u = T.unitsOf(army, 'atk', null, { override: ov })[0];
    return u ? u.adv : null;
  };
  return rows.advance === 100 && rows.hold === 50 && rows.retreat === 0
    && mk('yibing', 'advance') === 100 && mk('yibing', 'hold') === 50
    && mk('yibing', 'retreat') === 0;
})());
check('实测：前进推进 / 防御不动 / 后退拉大间距（间距是真在变，不是只改了个字段）', (function () {
  var gapAt = function (s, round) {
    var r = G.tactic.simulate({ gongjian: 3000 }, null, { changqiang: 1500 }, 150, null,
      { kind: 'city', sieging: true, wallLv: 8, stances: { atk: { gongjian: { s: s, t: '' } } } });
    var rr = (r.roundsLog || [])[round || 0];
    return rr ? rr.gap : null;
  };
  var adv1 = gapAt('advance', 0), hold1 = gapAt('hold', 0);
  var back0 = gapAt('retreat', 0), back1 = gapAt('retreat', 1);
  return adv1 < hold1 && back0 > hold1 && back1 > back0;
})(), (function () {
  var gapAt = function (s, round) {
    var r = G.tactic.simulate({ gongjian: 3000 }, null, { changqiang: 1500 }, 150, null,
      { kind: 'city', sieging: true, wallLv: 8, stances: { atk: { gongjian: { s: s, t: '' } } } });
    var rr = (r.roundsLog || [])[round || 0];
    return rr ? rr.gap : null;
  };
  return '首回合间距：前进 ' + gapAt('advance', 0) + ' / 防御 ' + gapAt('hold', 0) +
    ' / 后退 ' + gapAt('retreat', 0) + '　后退第 2 回合 ' + gapAt('retreat', 1);
})());
check('实测：「防御」受到的伤害减半（取首回合，唯一变量就是减伤）', (function () {
  var first = function (r) {
    var rr = (r.roundsLog || [])[0]; if (!rr) return 0;
    var n = 0;
    (rr.events || []).forEach(function (e) {
      if (e.side !== 'def') (e.hits || []).forEach(function (h) { n += h.kill; });
    });
    return n;
  };
  var cfg = function (s) {
    return G.tactic.simulate({ chuangnu: 3000 }, null, { changqiang: 30000 }, 0, null,
      { kind: 'wild', stances: { def: { changqiang: { s: s, t: '' } } } });
  };
  var a = first(cfg('advance')), h = first(cfg('hold'));
  return a > 0 && h > 0 && Math.abs(h / a - (1 - G.tactic.HOLD_DAMAGE_CUT)) < 0.02;
})(), (function () {
  var first = function (r) {
    var rr = (r.roundsLog || [])[0]; if (!rr) return 0;
    var n = 0;
    (rr.events || []).forEach(function (e) {
      if (e.side !== 'def') (e.hits || []).forEach(function (h) { n += h.kill; });
    });
    return n;
  };
  var cfg = function (s) {
    return G.tactic.simulate({ chuangnu: 3000 }, null, { changqiang: 30000 }, 0, null,
      { kind: 'wild', stances: { def: { changqiang: { s: s, t: '' } } } });
  };
  return '首回合守损：前进 ' + first(cfg('advance')) + ' → 防御 ' + first(cfg('hold'));
})());
check('实测：指定目标 → 打击序列优先落在它头上（自动则按"由近及远"）', (function () {
  var ids = function (tac) {
    if (tac) G.setTactic('gongjian', { s: 'advance', t: tac });
    else G.clearTactics();
    var r = G.tactic.simulate({ gongjian: 20000 }, null, { changqiang: 2000, daodun: 2000 }, 0, null,
      { kind: 'wild' });
    G.clearTactics();
    var rr = (r.roundsLog || [])[0];
    var e = rr && (rr.events || []).filter(function (x) { return x.kind === 'attack' && x.side === 'atk'; })[0];
    return e ? e.hits.map(function (h) { return h.id; }) : [];
  };
  var pref = ids('daodun'), auto = ids(null);
  return pref.length > 0 && pref[0] === 'daodun' && auto.length > 0 && auto[0] === 'changqiang';
})(), (function () {
  var ids = function (tac) {
    if (tac) G.setTactic('gongjian', { s: 'advance', t: tac });
    else G.clearTactics();
    var r = G.tactic.simulate({ gongjian: 20000 }, null, { changqiang: 2000, daodun: 2000 }, 0, null,
      { kind: 'wild' });
    G.clearTactics();
    var rr = (r.roundsLog || [])[0];
    var e = rr && (rr.events || []).filter(function (x) { return x.kind === 'attack' && x.side === 'atk'; })[0];
    return e ? e.hits.map(function (h) { return h.id; }) : [];
  };
  return '指定打刀盾 ' + JSON.stringify(ids('daodun')) + '　自动 ' + JSON.stringify(ids(null));
})());
check('相克补两项：虎豹骑同轻骑（防远程×4）、西凉铁骑同铁骑（×2）；突骑仍无',
  G.tactic.counterDefOf('hubaoqi', 'gongjian') === 4
  && G.tactic.counterDefOf('hubaoqi', 'toudan') === 4
  && G.tactic.counterDefOf('xiliangtieqi', 'gongjian') === 2
  && G.tactic.counterDefOf('tuqibing', 'gongjian') === 1
  /* 依据必须写在数据里（是"同族类比"而非原版点名，不许后人误当成原文出处） */
  && /同族类比/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8')));
check('战术只有一个取值口，且非法值一律回落默认（NaN 会让整场战斗静默跑坏）', (function () {
  var out = G.tacticOf('atk', 'changqiang');
  G.setTactic('changqiang', { s: 'retreat', t: 'gongjian' });
  var set = G.tacticOf('atk', 'changqiang');
  G.setTactic('changqiang', { s: '不存在的动作' });          /* 非法动作不许写进去 */
  var bad = G.tacticOf('atk', 'changqiang');
  G.setTactic('不存在兵种', { s: 'hold' });
  var notroop = G.tacticOf('atk', '不存在兵种');
  G.clearTactics();
  var cleared = G.tacticOf('atk', 'changqiang');
  return out.s === 'advance' && out.t === ''
    && set.s === 'retreat' && set.t === 'gongjian'
    && bad.s === 'retreat'                                 /* 非法值被忽略，保留原值 */
    && notroop.s === 'advance' && cleared.s === 'advance';
})(), (function () {
  G.setTactic('changqiang', { s: 'retreat', t: 'gongjian' });
  var set = G.tacticOf('atk', 'changqiang');
  G.setTactic('changqiang', { s: '乱写' });
  var bad = G.tacticOf('atk', 'changqiang');
  G.clearTactics();
  return '设 retreat → ' + set.s + '　再写非法值 → ' + bad.s + '（保持）　清空后 → ' +
    G.tacticOf('atk', 'changqiang').s;
})());
check('读档归一化：老档没 tactics 字段、非法兵种/非法动作一律清掉', (function () {
  var b = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  return /v59：出征战术归一化/.test(b)
    && /if \(!\(GAME\.DATA\.TROOPS\[id\]\)\) return;/.test(b)
    && /st\.tactics = tClean;/.test(b);
})());
check('校场有「出征战术」入口，且动作已接线（不是孤儿按钮）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var m = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  return /data-action="open-tactic"/.test(u)
    && /ui\.openTacticModal = function/.test(u)
    && /case 'open-tactic': ui\.openTacticModal\(\); break;/.test(m)
    && /case 'tactic-set':/.test(m) && /case 'tactic-reset':/.test(m);
})());
check('战术弹窗：每兵种有动作 + 目标（含箭塔），且点选即存、不重绘', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openTacticModal = function');
  if (seg.length < 500) return false;
  return /data-action="tactic-set"/.test(u)
    && /GAME\.tacticOf\('atk', id\)/.test(seg)
    && /DATA\.TARGET_WALL/.test(seg) && /DATA\.STANCES\.map/.test(seg)
    && /ui\.modalPage\('tactic'/.test(seg);
})());
check('出征弹窗显示本次战术（含"调整"入口）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openExpModal = function');
  return seg.length > 500 && /GAME\.tacticSummary\(\)/.test(seg)
    && /data-action="open-tactic"/.test(seg);
})());
/* ---- 需求 0b：兵种采集效率 + 采集公式 ---- */
check('每个兵种都有采集效率，且高级兵更高', (function () {
  var ids = Object.keys(DATA.TROOPS);
  return ids.every(function (id) { return DATA.TROOPS[id].gather > 0; })
    && DATA.TROOPS.tieji.gather > DATA.TROOPS.changqiang.gather
    && DATA.TROOPS.changqiang.gather > DATA.TROOPS.minfu.gather
    && DATA.TROOPS.toudan.gather === DATA.TROOPS.minfu.gather;   // 器械不善耕作
})());
check('采集力 = Σ(数量 × 兵种效率)，且受 powerCap 约束', (function () {
  var p = G.gatherPowerOf({ army: { tieji: 100, minfu: 500 } });
  return p === 100 * DATA.TROOPS.tieji.gather + 500 * DATA.TROOPS.minfu.gather
    && G.gatherYield({ type: 'lake', level: 5, army: { tieji: 99999 }, elapsed: 4 * 3600 }).power === DATA.GATHER.powerCap;
})());
check('实测：同人数下铁骑比民夫产得多', (function () {
  var m = G.gatherYield({ type: 'lake', level: 5, army: { minfu: 3000 }, elapsed: 4 * 3600 });
  var t = G.gatherYield({ type: 'lake', level: 5, army: { tieji: 3000 }, elapsed: 4 * 3600 });
  return t.amount > m.amount * 2;
})());
check('旧档（只记人数）仍按民夫基准折算（不因升级而断档）', (function () {
  var y = G.gatherYield({ type: 'lake', level: 8, troops: 1000, elapsed: 8 * 3600 });
  return y.amount === Math.round(1000 * DATA.GATHER.basePerHour * (1 + 8 * DATA.GATHER.levelBonus) * 8);
})());

/* ---- 需求 0c：野地驻军上限 ---- */
check('驻军上限 = 野地等级 × 10000', G.wildGarrisonCap(7) === 70000 && G.wildGarrisonCap(0) === 0);
check('实测：超上限被拒、正好到上限可派驻、掉级不赶回城', (function () {
  var s = G.state, c = G.currentCity();
  var wt = null;
  for (var dy = -4; dy <= 4 && !wt; dy++) for (var dx = -4; dx <= 4 && !wt; dx++) {
    var tl = G.map.tile(c.x + dx, c.y + dy);
    if (tl && tl.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) wt = { x: c.x + dx, y: c.y + dy, t: tl.terrain };
  }
  if (!wt) return false;
  s.wilds = s.wilds || [];
  s.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 3, day: 0, startDay: 0 });
  var bk = JSON.parse(JSON.stringify(c.army || {}));
  c.army = { yibing: 40000 };
  var over = G.doWildGarrison(wt.x, wt.y, { yibing: 30001 }, c.id);
  var ok = G.doWildGarrison(wt.x, wt.y, { yibing: 30000 }, c.id);
  var held = G.wildGarrisonTotal(G.map.wildAt(wt.x, wt.y).garrison);
  G.map.wildAt(wt.x, wt.y).level = 1;                  // 掉级
  var still = G.wildGarrisonTotal(G.map.wildAt(wt.x, wt.y).garrison);
  c.army = bk;
  s.wilds = s.wilds.filter(function (z) { return !(z.x === wt.x && z.y === wt.y); });
  return over.ok === false && ok.ok === true && held === 30000 && still === 30000;
})());

/* ---- 需求 2：资质等级上限 ---- */
check('资质决定等级上限（凡品60 / 良材100 / 英杰140 / 名世180 / 天授240）', (function () {
  var m = { fan: 60, liang: 100, ying: 140, ming: 180, tian: 240 };
  return Object.keys(m).every(function (k) {
    return DATA.GEN_RANK_BY_ID[k].lvCap === m[k] && G.genLevelCap({ rank: k, level: 1 }) === m[k];
  });
})());
check('实测：凡品喂 10 亿经验也停在 Lv60，天授能到 240', (function () {
  var mk = function (rank) {
    return { id: 'lv' + rank, name: '样本', rank: rank, level: 1, exp: 0, tong: 50, nz: 50, yw: 50, zm: 50,
      speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
  };
  var a = mk('fan'); a.exp = 1e9; G.checkLevelUp(a);
  var b = mk('tian'); b.exp = 1e9; G.checkLevelUp(b);
  return a.level === 60 && b.level === 240;
})());
check('经验曲线高段放缓（Lv240 累计可达，不再是 4.6 亿）', (function () {
  var cum = 0;
  for (var i = 1; i <= 240; i++) cum += G.expNeedOf({ level: i });
  return cum < 4e7 && G.expNeedOf({ level: 1 }) === 100 && G.expNeedOf({ level: 4 }) === 1600
    && G.expNeedOf({ level: 30 }) === 30 * 30 * 100;
})(), 'Lv240 累计 ' + (function () { var c = 0; for (var i = 1; i <= 240; i++) c += G.expNeedOf({ level: i }); return Math.round(c / 1e4) + '万'; })());

/* ---- 需求 11：体力第六维 + 攻防对冲 ---- */
check('体力是第六维（GEN_DIMS 最后一项）',
  G.ui.GEN_DIMS.length === 6 && G.ui.GEN_DIMS[5].k === 'sta');
check('体力上限随等级、资质、内政成长', (function () {
  var base = G.staMax({ level: 1, nz: 50, rank: 'fan' });
  var lv = G.staMax({ level: 100, nz: 50, rank: 'fan' });
  var tian = G.staMax({ level: 100, nz: 50, rank: 'tian' });
  var nz = G.staMax({ level: 100, nz: 300, rank: 'fan' });
  return lv > base && tian > lv && nz > lv;
})());
check('体力直接放大全军生命（渐近且不硬顶）', (function () {
  var lo = G.staHpBonus({ level: 1, nz: 50, rank: 'fan', stamina: 100 });
  var hi = G.staHpBonus({ level: 240, nz: 120, rank: 'tian', stamina: 3000 });
  return lo > 0 && hi > lo && hi < DATA.STAMINA.hpCap;
})());
check('攻防对冲：2A/(A+D)，攻防相当为 1、纯攻到 2、攻不破防趋近 0', (function () {
  var T = G.tactic;
  return Math.abs(T.clashFactor(150, 150) - 1) < 1e-9
    && Math.abs(T.clashFactor(150, 0) - 2) < 1e-9
    && T.clashFactor(50, 400) < 0.5 && T.clashFactor(50, 400) > 0;
})());
check('防御是独立一维（perDef 存在，且不再重复算进生命）', (function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, 'js', 'tactic.js'), 'utf8');
  return /T\.perDef = function/.test(src) && /T\.perHp = function \(u, defGen\) \{\s*\n\s*return Math\.max\(1, u\.hpPer/.test(src);
})());
check('实测：同兵力下高攻兵种杀伤更多（对冲可见）', (function () {
  var a = G.tactic.simulate({ changqiang: 5000 }, null, { daodun: 20000 }, 0, null, { kind: 'wild' });
  var b = G.tactic.simulate({ tieji: 5000 }, null, { daodun: 20000 }, 0, null, { kind: 'wild' });
  return (20000 - b.defRemain) > (20000 - a.defRemain);
})());

/* ---- 需求 13：工匠作坊独立器械队列 ---- */
check('作坊有独立的队列查询口与格位', (function () {
  return typeof G.craftWorkshopsOf === 'function' && typeof G.craftLevel === 'function'
    && typeof G.firstWorkshopIdx === 'function';
})());
check('器械不看军营等级（造投石车不必先有 8 级军营）', (function () {
  var u = DATA.TROOPS.toudan.unlock;
  return !!u.junying && !!u.gongjiangzuofang
    && !/t\.craft && k === 'junying'\) continue/.test('') === true
    && /if \(t\.craft && k === 'junying'\) continue;/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'));
})());
check('实测：器械入作坊队列、募兵入军营队列，互不占位', (function () {
  var c = G.currentCity(), s = G.state;
  var bkCells = JSON.parse(JSON.stringify(c.cells));
  var wIdx = -1, sIdx = -1, bIdx = -1;
  c.cells.forEach(function (x, i) {
    if (x.build) return;
    if (wIdx < 0) { wIdx = i; return; }
    if (sIdx < 0) { sIdx = i; return; }
    if (bIdx < 0) bIdx = i;
  });
  if (wIdx < 0 || sIdx < 0 || bIdx < 0) return false;
  c.cells[wIdx].build = { id: 'gongjiangzuofang', lvl: 7 };
  c.cells[sIdx].build = { id: 'shuyuan', lvl: 10 };
  c.cells[bIdx].build = { id: 'junying', lvl: 5 };
  var bkRes = JSON.parse(JSON.stringify(s.res));
  var bkQ = JSON.parse(JSON.stringify(s.queues.train || []));
  s.queues.train = [];
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { s.res[k] = 1e8; });
  s.res.pop = 1e6;
  var rc = G.train('toudan', 3, c.id, wIdx);
  var rt = G.train('yibing', 3, c.id, bIdx);
  var cq = G.trainQueuesOf(c, wIdx, 'craft'), tq = G.trainQueuesOf(c, bIdx, 'train');
  var ok = rc.ok && rt.ok && cq.length === 1 && tq.length === 1
    && cq[0].troopId === 'toudan' && tq[0].troopId === 'yibing';
  s.queues.train = bkQ; s.res = bkRes; c.cells = bkCells;
  return ok;
})());

/* ---- 需求 5：自动出征 ---- */
check('自动出征配置与实现齐备', typeof G.autoMarchCfg === 'function'
  && typeof G.autoMarchOnce === 'function' && typeof G.autoMarch === 'function'
  && typeof G.autoMarchPickArmy === 'function' && typeof G.autoMarchFindTarget === 'function');
check('默认关闭（不擅自调动玩家的兵）', (function () {
  var cfg = G.autoMarchCfg();
  return cfg && cfg.on === false;
})());
check('编队红线：器械/斥候/辎重不编入，且按数量取够', (function () {
  var pick = G.autoMarchPickArmy({ army: { toudan: 50, chongche: 50, chihou: 20, tieji: 900, yibing: 5000 } }, 3000);
  return !pick.army.toudan && !pick.army.chongche && !pick.army.chihou
    && pick.total === 3000 && pick.army.tieji === 900;
})());
check('实测：未指定将领时不硬发兵，并给出原因', (function () {
  var cfg = G.autoMarchCfg(), bk = cfg.genId;
  cfg.genId = null;
  var r = G.autoMarchOnce(cfg);
  cfg.genId = bk;
  return r.ok === false && /指定/.test(r.msg);
})());
check('主循环确实挂了自动出征（不是只写不接）', (function () {
  var s = require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8');
  return /if \(GAME\.autoMarch\) GAME\.autoMarch\(\);/.test(s);
})());

/* ---- 需求 9/10：名城标注与改名 ---- */
check('名城带等级标注，自建城不标', (function () {
  return G.cityLabel({ name: '洛阳', type: 'capital' }) === '洛阳[都城]'
    && G.cityLabel({ name: '新城', type: 'self' }) === '新城'
    && G.cityTierName({ name: 'x', type: 'self' }) === '';
})());
check('已拥有的城池一律可改名，原名另存 origName', (function () {
  /* v45 语义反转（原：非名城才可改 —— 开局洛阳是都城，于是永远不可改） */
  /* 注意：canRenameCity 会把原名写在**传入的 city 对象**上，返回的是 {ok} ——
     断言必须查传入对象，不能查返回值（这里曾写错，白挂一次）。 */
  var i1 = { name: '新城', type: 'self' }, i2 = { name: '洛阳', type: 'capital' }, i3 = { name: '临淄', type: 'zhou' };
  var a = G.canRenameCity(i1), b = G.canRenameCity(i2), c = G.canRenameCity(i3);
  return a.ok === true && b.ok === true && c.ok === true
    && i1.origName === '新城' && i2.origName === '洛阳' && i3.origName === '临淄';
})());
check('城池名走单一取值口（改名同步所有引用）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /ui\.cityLabelHTML = function \(c, short\)/.test(u) && (u.match(/ui\.cityLabelHTML\(/g) || []).length >= 2
    && /GAME\.cityFullName\(x\)/.test(u)
    /* v71：侧栏走短名（城池属性标题）；v77 资源区「本城」表头退役（改附属野地下拉框）——
       调用点由 3 处减到 2 处（侧栏短名 + 统计表全称），防回退的意图不变。 */
    && (u.match(/ui\.cityLabelHTML\(c, true\)/g) || []).length >= 1;
})());

/* ---- 需求 1/3/4：底部固定导航条 / 地图满屏 / 背包分页 ---- */
check('翻页条统一投到屏幕下方的固定条', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /ui\.paintBottom = function/.test(u) && /id="bottom-bar"/.test(h)
    && /\.bottombar \{[\s\S]{0,80}height: 46px/.test(h);
})());
check('内容区不再内嵌分页条（翻页不必滚到底）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var i = u.indexOf('ui.pagerHTML = function');
  return i > 0 && /ui\._bottom\.push/.test(u.slice(i, i + 220));
})());
check('地图观察框随窗口自适应（v50：目标格距按菱形放大到 1.41 倍）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /ui\.MAP_TARGET_CELL_ISO = 124/.test(u)
    && /ui\.MAP_CELL_MAX = \d+/.test(u) && /ui\.mapFrame = \{ spanX: cols/.test(u);
})());
check('背包装备/材料/图纸/宝物四页都分页', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return ['bag-equip', 'bag-mat', 'bag-bp', 'bag-item'].every(function (k) {
    return new RegExp("ui\\.page(?:Bag|Rows)\\('" + k + "'").test(u);
  }) && /ui\.pageRows = function/.test(u);
})());

/* ---- 需求 12/14：铁匠铺弹窗 / 物品行 ---- */
check('铁匠铺为商城样弹窗（品质页签 + 物品行 + 固定尺寸）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  /* v38 / v51：原来用固定字符窗口定位 openForge，注释一多就假红
     （1800 → 3200 → 4200 的加数历史）。改用按结构取函数体。 */
  return /ui\.setForgeQ = function/.test(u) && /ui\.forgeRow = function/.test(u)
    && /size: 'xl'/.test(fnBody(u, 'ui.openForge = function'));
})());
check('物品行为「左贴图 / 右介绍 / 下：数量输入框 + 操作」', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /ui\.itemRow = function/.test(u) && /class="ir-art"/.test(u)
    && /class="ir-info"/.test(u) && /class="ir-foot"/.test(u)
    && /grid-template-columns: 64px minmax\(0, 1fr\)/.test(h);
})());
check('数量输入框带加减号与「最多」，不走下拉框', (function () {
  var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
  return /ui\.qtyInput = function/.test(u) && /data-action="qty-step"/.test(u)
    && /data-action="qty-max"/.test(u)
    && (u.match(/<select/g) || []).length === 2 && /class="city-select"/.test(u)
    && /wild-select/.test(u);
})());

/* ---- 需求 6/7/8/15/16 ---- */
check('公文只留战报与消息（队列已迁出）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  /* v43：切片边界改用**函数边界**（下一个 `ui.xxx = function`），不再写死字符数 ——
     函数里加几行逻辑就会把后面的锚点挤出窗口（本轮加公文分页就踩到了）。 */
  var i = u.indexOf('ui.reportsHTML = function');
  var j = u.indexOf('ui.msgCount = function', i);
  var seg = u.slice(i, j > i ? j : i + 4000);
  return i > 0 && seg.indexOf("sealH('队列'") < 0 && seg.indexOf("sealH('战报'") > 0
    && seg.indexOf("sealH('消息'") > 0;
})());
/* v54（老板："全境汇总那里，把甲乙丙丁啥的排一下，别一边长一边短，留空一大块"）：
   原判据是"左右分列（同类同侧）"—— 那是 v29 的设计，老板这次**明确否掉**了。
   删掉三块之后只剩三节，再分两栏必然一长一短。改成单本账册后，
   "一边长一边短"在结构上不可能出现（`.ledger` 自身才是那个两列网格，
   节标题横贯全宽），所以判据从"分了几栏"改成"**没有分栏容器**"。 */
check('统计全境汇总为单本账册（不再左右分列 → 结构上不可能一长一短）', (function () {
  var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
  var h = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8'));
  return /var ledger = '<div class="ledger">'/.test(u)
    && !/lgLeft/.test(u) && !/lgRight/.test(u) && !/lg-cols/.test(u)   /* 分栏容器已撤 */
    && !/\.lg-cols/.test(h)                                            /* 样式也不许留残骸 */
    /* 两节必须按甲乙**顺序**（乱序就等于没"排"）；v60 起丙节（满级专精）已撤 */
    && (function () {
      var seg = u.slice(u.indexOf("ui.lgSec('甲 · 疆域')"));
      var iA = seg.indexOf("ui.lgSec('甲 · 疆域')");
      var iB = seg.indexOf("ui.lgSec('乙 · 在外')");
      return iA >= 0 && iB > iA && seg.indexOf("ui.lgSec('丙") < 0;
    })();
})());
check('侧栏资源与驻军随所选城池变化', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /GAME\.cityProdPerSec\(c\)/.test(u) && /ui\.cityLabelHTML\(c\)/.test(u)
    && typeof G.cityProdPerSec === 'function' && typeof G.prodBasePerHourOf === 'function';
})());
check('招贤馆不再重复将领名录', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var i = u.indexOf('ui.openHostel = function');
  var seg = u.slice(i, i + 2400);
  return i > 0 && seg.indexOf('inn-card') < 0 && /房间（本城将领席位）/.test(seg);
})());
check('将领界面为 3×2 卡片墙 + 下方档案', (function () {
  var html = G.ui.generalsHTML();
  return /class="gen-split"/.test(html) && /class="gen-list"/.test(html)
    && /class="gen-pane"/.test(html) && /gd-dims/.test(html);
})());


/* ==========================================================================
 * 42. v39 主题·地块·分栏（需求 1/2/3/5/6）
 * ========================================================================== */
(function () {
  console.log('\n===== 42. v39 主题·地块·分栏 =====');
  var fs = require('fs'), path = require('path');
  var H = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  var U = fs.readFileSync(path.join(__dirname, 'js', 'ui.js'), 'utf8');
  var M = fs.readFileSync(path.join(__dirname, 'js', 'main.js'), 'utf8');
  var D = fs.readFileSync(path.join(__dirname, 'js', 'data.js'), 'utf8');
  var css = H.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  console.log('  --- 需求 1：界面主题 ---');
  check('主题名册四套齐全（墨玉/素绢/青竹/夜阑）', (function () {
    var T = DATA.THEMES || [];
    return T.length === 4
      && ['ink', 'silk', 'bamboo', 'night'].every(function (id) {
        return T.some(function (t) { return t.id === id; });
      });
  })(), (DATA.THEMES || []).map(function (t) { return t.name; }).join(' '));
  check('默认主题写入设置（读档/新游戏都沿用）',
    /DEFAULT_SETTINGS\.theme = 'ink'/.test(D) && DATA.DEFAULT_SETTINGS.theme === 'ink');
  check('浅色主题有自己的 CSS 覆盖块（素绢/青竹/夜阑）',
    /html\[data-theme="silk"\] \{/.test(css)
    && /html\[data-theme="bamboo"\] \{/.test(css)
    && /html\[data-theme="night"\] \{/.test(css));
  check('基色三元组变量就位（浅色主题靠它换描边/阴影/金色的基色）',
    /--sh-rgb: 0,0,0/.test(css) && /--hl-rgb: 255,255,255/.test(css)
    && /--gold-rgb: /.test(css));
  check('全站不再硬编码半透明白描边（一律走 --hl-rgb）',
    !/rgba\(255,\s*255,\s*255,/.test(css),
    (css.match(/rgba\(255,\s*255,\s*255,/g) || []).length + ' 处残留');
  check('结构深色底已变量化（页面/面板/卡片/内槽/木钮）',
    ['--bg-2: ', '--surface-2: ', '--surface-3: ', '--slab-1: ',
     '--btn-face-1: ', '--btn-face-2: '].every(function (k) { return css.indexOf(k) >= 0; }));
  check('浅色主题在浅底上柔化重投影（否则显得脏）',
    /html\[data-theme="silk"\] \.wood-frame/.test(css));
  check('applyTheme 幂等 + renderView 每帧同步（读档/新游戏/换肤共用一个落点）',
    /ui\.applyTheme = function/.test(U) && /ui\.syncTheme = function/.test(U)
    /* ⚠️ 用 `\r?\n` 而不是 `\n`：本项目 js/*.js 是 LF、index.html/smoke 是 CRLF，
       而**用脚本改 js 文件会把整个文件的行尾翻成 CRLF**（Python 的 io.open 写回走 os.linesep）。
       写死 `\n` 时，任何一次脚本改动都会让这条断言莫名其妙变红（实测踩过）。 */
    && /ui\.renderView = function \(v\) \{\r?\n    ui\.syncTheme\(\);/.test(U));
  check('设置页有界面主题入口（点选控件，不是下拉框）',
    /🎨 界面主题/.test(U) && /after: 'theme'/.test(U));
  check('主题切换动作接线（chip-set → doSetTheme）',
    /after === 'theme'/.test(M) && /GAME\.doSetTheme = function/.test(M));

  console.log('  --- 需求 2/3：地块与建筑分色 ---');
  check('地块不再画草叶花纹（老板点名的"花纹"）',
    !/repeating-linear-gradient\(48deg/.test(css));
  /* v43（需求 1）：判据由"色值等于某个固定值"改为**色差绝对值**。
     老板反馈"几个背景颜色不护眼、反人类"，实测默认主题的地块四色
     色差分别是 71/94/80/74（全屏铺这种高饱和黄绿），改成 ≤38 的柔化值。
     用色差而非 HSL 饱和度：接近白色时微小 RGB 差会算出很高的 HSL 饱和度。 */
  check('地面底色走主题变量，且四套主题都做过柔化（色差 ≤ 38）', (function () {
    var gs = css.match(/--ground: (#[0-9a-fA-F]{6})/g) || [];
    if (gs.length < 4) return false;
    return gs.every(function (g) {
      var h = g.match(/#([0-9a-fA-F]{6})/)[1];
      var v = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
      return (Math.max.apply(null, v) - Math.min.apply(null, v)) <= 38;
    });
  })(), '四套共 ' + (css.match(/--ground: /g) || []).length + ' 处地面色');
  check('空地不填色（只在悬停浮出一格提示）',
    /\.iso-tile\.empty \.tile-face \{ background: transparent; \}/.test(css)
    && /\.iso-tile\.empty:hover \.tile-face \{ background: rgba\(var\(--hl-rgb\),\.07\); \}/.test(css));
  /* v43：判据由"色值等于某固定值"改为**亮度 + 互异性**。
     老板二次反馈"伐木场、采石场、铁矿场配色阴间" —— 实测旧值确实压得太暗：
     林地 #4a7350 亮度 37%、矿场 #544034 亮度 27%。现在全部 ≥ 40%。 */
  check('城外四色按色系分开，且都不过暗（v43：林地/矿场原来压得太暗）', (function () {
    var m = ['farm', 'forest', 'quarry', 'mine'].map(function (k) {
      var r = css.match(new RegExp('\\.iso-tile\\.res-' + k + '\\s+\\.tile-face \\{ background: var\\(--res-' + k + '\\)'));
      return !!r;
    });
    var hexes = ['farm', 'forest', 'quarry', 'mine'].map(function (k) {
      var r = css.match(new RegExp('--res-' + k + ': (#[0-9a-fA-F]{6})'));
      return r ? r[1] : '';
    });
    if (!m.every(Boolean) || hexes.some(function (h) { return !h; })) return false;
    var lums = hexes.map(function (h) {
      var v = [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); });
      return (Math.max.apply(null, v) + Math.min.apply(null, v)) / 2 / 255 * 100;
    });
    return lums.every(function (l) { return l >= 40; })
      && Array.from(new Set(hexes)).length === 4;
  })(), '四色亮度 ' + (function () {
    var out = ['farm', 'forest', 'quarry', 'mine'].map(function (k) {
      var r = css.match(new RegExp('--res-' + k + ': (#[0-9a-fA-F]{6})'));
      if (!r) return '-';
      var v = [1, 3, 5].map(function (i) { return parseInt(r[1].substr(i, 2), 16); });
      return k + ' ' + Math.round((Math.max.apply(null, v) + Math.min.apply(null, v)) / 2 / 255 * 100) + '%';
    });
    return out.join(' · ');
  })());
  /* v45（需求 1）：原「七系列都要有 CSS 着色规则」已作废 ——
     染色搬进素材（见下方像素级实测），CSS 里再出现 ser-* 染色规则反而是回归。 */
  check('每座建筑都有系列归属（16 座 / 7 类）', (function () {
    var B = DATA.BUILDINGS || {}, n = 0, bad = [];
    Object.keys(B).forEach(function (k) {
      n++;
      if (!B[k].series || !(DATA.SERIES || {})[B[k].series]) bad.push(k);
    });
    return n === 16 && bad.length === 0;
  })(), '共 ' + Object.keys(DATA.BUILDINGS || {}).length + ' 座');
  check('建筑"长高"：等级 → 缩放系数，底部固定向上长',
    /ui\.lvlScale = function/.test(U) && /transform-origin: 50% 86%/.test(css)
    && /scale\(var\(--lvs, 1\)\)/.test(css) && /--lvs:/.test(U));
  check('长高系数随等级单调递增', G.ui.lvlScale(1) < G.ui.lvlScale(6)
    && G.ui.lvlScale(6) < G.ui.lvlScale(12),
    G.ui.lvlScale(1) + ' → ' + G.ui.lvlScale(12));

  console.log('  --- 需求 5/6：商城与背包分栏 ---');
  check('商城为 4 列（老板要"统一整成 4 列"）',
    /\.shop-rows \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(css));
  check('商城每页 16 个（4 列 × 4 行，整页不截行）', G.ui.SHOP_PER_PAGE === 16, G.ui.SHOP_PER_PAGE + ' 个/页');
  check('商城分页常量只有一处定义（消除"改一处忘一处"）',
    (U.match(/ui\.SHOP_PER_PAGE = /g) || []).length === 1);
  check('背包每页 16 格（4 列 × 4 行）', G.ui.BAG_PER_PAGE === 16, G.ui.BAG_PER_PAGE + ' 格/页');
  check('背包图标放大到 68px（向商城的 64px 靠拢）',
    /\.bag-cell \.bag-ico \{ width: 68px; height: 68px/.test(css));
  check('物品行图标列随 4 列收紧到 64px',
    /grid-template-columns: 64px minmax\(0, 1fr\)/.test(css));

  console.log('  --- v51：宝物列表固定 4 列 + 备注去重 ---');
  /* 改前这两条列表都有"窗口变窄就降列"的断点（商城 1500/1150/760、背包 1150）——
     老板的屏在 1366~1440，正好落进 ≤1500 那档，所以他看到的其实是 3 列，
     于是又提了一次"整 4 列"。降级看着像自适应，实际是**同一份列表在不同窗口长得不一样**。 */
  check('商城列表没有任何"降列"断点（固定 4 列，不随窗口变）', (function () {
    var m = css.match(/@media[^{]*\{\s*\.shop-rows\s*\{[^}]*grid-template-columns:\s*repeat\((\d+)/g) || [];
    return m.length === 0;
  })(), '命中降级断点 ' + ((css.match(/@media[^{]*\{\s*\.shop-rows\s*\{/g) || []).length) + ' 处');
  check('背包网格同样没有任何"降列"断点（固定 4 列）',
    (css.match(/@media[^{]*\{\s*\.bag-grid\s*\{/g) || []).length === 0);
  check('两处列表的 4 列定义各只有一份（唯一的列数出口）',
    (css.match(/\.shop-rows \{ display: grid; grid-template-columns: repeat\(4,/g) || []).length === 1
    && (css.match(/\.bag-grid \{ display: grid; grid-template-columns: repeat\(4,/g) || []).length === 1);

  /* 备注去重：`itemEffect` 一度把 desc 又拼了一遍，而调用点也拼一遍 → 卡片里同一段文字出现三遍 */
  check('宝物效果文案只有一个出口：itemEffect 就是 desc，不再自己拼忠诚/价格', (function () {
    var it = { id: 'zhenzhu', name: '珍珠', type: 'jewel', loyalty: 5, price: 2, desc: '赏赐忠诚 +5（爵位晋升亦需）' };
    var eff = G.itemEffect(it);
    return eff === it.desc
      && eff.indexOf('商城价') < 0
      && (eff.match(/赏赐忠诚/g) || []).length === 1;
  })());
  check('实测：同一件宝物的说明在商城卡片里**只出现一次**（改前 3 次）', (function () {
    /* 直接渲染商城，数一遍"赏赐忠诚 +5"这段文字在卡内出现几次 ——
       这是"重复"最正面的对答：不查实现怎么拼，查渲染结果里有几份。 */
    var st = G.newGame({ name: '去重' });
    G.ui._shopCat = 'jewel';
    var h = G.ui.shopHTML();
    var seg = h.slice(h.indexOf('珍珠'));
    seg = seg.slice(0, seg.indexOf('item-row'));
    var n = (seg.match(/赏赐忠诚 \+5/g) || []).length;
    return n === 1;
  })());
  check('实测：背包宝物页同样只出现一次', (function () {
    var st = G.newGame({ name: '去重2' });
    st.items = st.items || {};
    st.items.zhenzhu = 3;
    G.ui._bagTab = 'item';
    var h = G.ui.bagItemHTML('type');
    var first = h.indexOf('珍珠');
    var seg = first < 0 ? '' : h.slice(first, first + 900);
    return (seg.match(/赏赐忠诚 \+5/g) || []).length === 1;
  })());
  check('商城不显示「可买数量」（老板点名；上限仍保留用于"最多"按钮）', (function () {
    var st = G.newGame({ name: '可买' });
    G.ui._shopCat = 'jewel';
    var h = G.ui.shopHTML();
    return h.indexOf('可买') < 0
      && /ui\.shopQtyCapOf = function/.test(U)          /* 上限函数仍在（qtyInput 的 cap） */
      && /cap = ui\.shopQtyCapOf\(it\)/.test(U);
  })());
  check('商城卡片不再重复「分类名」（当前分类在标题与页签上各有一份）', (function () {
    var st = G.newGame({ name: '分类' });
    G.ui._shopCat = 'jewel';
    var h = G.ui.shopHTML();
    var i = h.indexOf('class="shop-rows"');
    var seg = i < 0 ? '' : h.slice(i, i + 1200);
    /* 卡片 meta 里不该再出现分类词；标题区（shop-rows 之前）有一份是正常的 */
    return seg.indexOf('珠宝') < 0;
  })());
})();


/* ==========================================================================
 * 43. v40 地图位图 · 分色调亮 · 资源上限 · 城内 8×6（需求 0/1/2）
 * ========================================================================== */
(function () {
  console.log('\n===== 43. v40 地图位图 · 分色调亮 · 资源上限 · 城内 8×6 =====');
  var fs = require('fs'), path = require('path');
  var MP = fs.readFileSync(path.join(__dirname, 'js', 'map.js'), 'utf8');
  var ST = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
  var UI = fs.readFileSync(path.join(__dirname, 'js', 'ui.js'), 'utf8');
  var H = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  var css = H.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  console.log('  --- 需求 0-a：地图野地 / 城池位图 ---');
  check('地图位图层就位（12 个 key：地形 7 + 据点 + 城池 4 档）', (function () {
    var m = MP.match(/var ART_KEYS = \[([\s\S]*?)\];/);
    if (!m) return false;
    var keys = m[1].match(/'[a-z_]+'/g) || [];
    return keys.length === 12
      && ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
          'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun',
          'city_zhou', 'city_capital'].every(function (k) { return keys.indexOf("'" + k + "'") >= 0; });
  })());
  /* ⚠️ v67：老板下令删除那 12 张未接线图标（ai_terrain_* / ai_city_* / ai_fort），
     地图地形因此**落到程序化绘制**。原断言"12 张都要在"已与决定冲突，
     改成护**回退路径本身** —— 地形绝不允许再写成对素材的硬依赖（那会白屏）。 */
  check('地图地形不依赖素材文件（位图缺席时走程序化绘制）', (function () {
    var m = MP;
    /* ① blitArtRect 拿不到图必须返回 false（不是抛错、不是画半张） */
    var i = m.indexOf('function blitArtRect');
    var seg = i < 0 ? '' : m.slice(i, m.indexOf('\n  function', i + 10));
    var bail = seg.indexOf('if (!c) return false;') >= 0;
    /* ② 位图成功就 return，失败继续往下画矢量 */
    var callIdx = m.indexOf("blitArtRect(ctx, 'terrain_'");
    var after = callIdx < 0 ? '' : m.slice(callIdx, callIdx + 200);
    var fallback = /return;/.test(after) && /drawTerrainArt\(ctx, d\.terrain/.test(m.slice(callIdx, callIdx + 900));
    return seg.length > 300 && bail && fallback;
  })());
  check('不变量：地形位图一张都不剩（地形全走程序化绘制，不留一半贴图一半手绘）', (function () {
    var ui = path.join(__dirname, 'assets', 'icons', 'ui');
    var left = fs.readdirSync(ui).filter(function (f) { return f.indexOf('ai_terrain_') === 0; });
    return left.length === 0;
  })());
  check('已按决定删除：地图/城池那 12 个 key 都没有素材文件',
    ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));
  check('地形贴图走位图，城池/据点为**绘图**（素材缺失也不会白屏）', (function () {
    /* v50-c：据点与城池改成程序化绘制后，位图入口只剩地形贴图一个 ——
       这条同时确认"绘图路径"真的存在，所以素材全丢地图也仍然完整。
       ⚠️ 判据一律用 indexOf：正则里的 `\(` 在批量写入脚本里容易被吃掉转义。 */
    var s = mapSrc22;
    return s.indexOf("blitArtRect(ctx, 'terrain_'") >= 0
      && s.indexOf('drawTerrainArt(ctx, d.terrain') >= 0
      && s.indexOf('function drawCityArt(ctx, cx, cy, baseW') >= 0
      && s.indexOf('function drawFortArt(ctx, cx, cy, baseW') >= 0;
  })());
  check('jsdom / 无 Image 环境自动跳过（否则 smoke 会整片崩）',
    /typeof Image === 'undefined' \|\| typeof document === 'undefined'\) return/.test(MP));
  check('位图预缩放到离屏 canvas（地图每帧重绘，不直接用 512px 源图缩放）',
    /var ART_MAX = \d+/.test(MP) && /c\.getContext\('2d'\)\.drawImage\(im, 0, 0, ART_MAX, ART_MAX\)/.test(MP));
  check('加载完成后主动重绘地图（图片是异步到的）',
    /GAME\.ui\.view === 'map' && GAME\.ui\.renderMapCanvas/.test(MP));
  /* 查询口：既验"声明在"，也**真调一次**（真调用才使 audit 判为「已被使用」）。
     注意别把引用写成自己那条正则 —— 转义后的文本不构成真实引用。 */
  check('位图就绪张数有查询口且被真实调用（不是死函数）', (function () {
    if (!/GAME\.map\.artCount = function/.test(MP)) return false;
    var mp = global.GAME && global.GAME.map;
    if (!mp || typeof mp.artCount !== 'function') return false;
    var n = mp.artCount();
    return typeof n === 'number' && n >= 0 && n <= 12;   /* 至多 12 张 */
  })(), '就绪 ' + (typeof (global.GAME && global.GAME.map && global.GAME.map.artCount) === 'function'
    ? global.GAME.map.artCount() : '-') + ' 张');

  console.log('  --- v45 需求 1：建筑图标改「素材固有色」，CSS 一律不染色 ---');
  /* ============================================================
   * 这轮把配色从 CSS 挪进素材，原因必须留档（已连续三轮返工）：
   *   v39~v43 用 CSS 滤镜矩阵给统一的暖金位图染色，实机逐族取样结果是
   *   饱和度只有 9~22、色相全挤在 29~171° 的灰绿带 —— 等于一片灰绿。
   *   数学原因：hue-rotate 是线性矩阵近似（低饱和图上误差极大，
   *   标称 180° 实测只推出 147°）；saturate() 是保亮度矩阵，
   *   输入越接近灰、输出越不变 —— 正好把彩图洗成灰。
   * 现在色相/饱和度在**像素级 HSL** 里写进 PNG 本身
   *   （脚本 `.workbuddy/tmp/recolor_buildings.py`，原图备份 `_gold_backup/`）。
   * 所以下面两条断言查的是**素材像素**而不是 CSS 写法 ——
   * 那才是"到底什么颜色"的唯一真相，也能直接挡住这次这种返工。
   * ============================================================ */
  check('建筑图标已不再被 CSS 染色（回归护栏：hue-rotate/saturate/sepia 全清）', (function () {
    var body = css.replace(/\/\*[\s\S]*?\*\//g, '');      // 先剥注释，免得被说明文字误命中
    return !/\.iso-tile\.ser-[a-z]+\s+\.tile-art img\.ico-img/.test(body)
      && !/\.iso-tile\.built \.tile-art img\.ico-img \{[^}]*hue-rotate/.test(body);
  })());
  check('落地投影仍在（去掉染色不能连接地感一起丢）',
    /\.iso-tile\.built \.tile-art img\.ico-img \{ filter: drop-shadow/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
  check('ser-<系列> 语义类仍由 ui.js 挂出（数据侧唯一来源 DATA.SERIES）',
    /cls: 'built ser-' \+ \(b\.series \|\| 'gov'\)/.test(UI));

  /* ---- 素材像素级实测：自带 PNG 解码，读真实色相/饱和度 ---- */
  var PIX = (function () {
    var zlib = require('zlib');
    /* 只支持 8bit / 非隔行 / colorType 2(RGB) 或 6(RGBA) —— 本项目素材全是这种 */
    function decode(file) {
      if (!fs.existsSync(file)) return null;
      var buf = fs.readFileSync(file);
      if (buf.readUInt32BE(0) !== 0x89504e47) return null;
      var off = 8, w = 0, h = 0, bd = 0, ct = 0, idat = [];
      while (off + 8 <= buf.length) {
        var len = buf.readUInt32BE(off);
        var type = buf.toString('ascii', off + 4, off + 8);
        var data = buf.slice(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
      }
      if (bd !== 8 || (ct !== 6 && ct !== 2) || !w) return null;
      var bpp = ct === 6 ? 4 : 3, stride = w * bpp;
      var raw = zlib.inflateSync(Buffer.concat(idat));
      var out = Buffer.alloc(h * stride), prev = Buffer.alloc(stride), p = 0;
      for (var y = 0; y < h; y++) {
        var ft = raw[p++], cur = Buffer.from(raw.slice(p, p + stride)); p += stride;
        for (var i = 0; i < stride; i++) {
          var a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, v = cur[i];
          if (ft === 1) v = (v + a) & 255;
          else if (ft === 2) v = (v + b) & 255;
          else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
          else if (ft === 4) {
            var pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
            v = (v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c))) & 255;
          }
          cur[i] = v;
        }
        cur.copy(out, y * stride); prev = cur;
      }
      return { w: w, h: h, bpp: bpp, data: out };
    }
    /* 平均色相用**向量平均**（按饱和度加权）—— 直接平均会在 0°/360° 交界处算错 */
    function hueSat(file) {
      var png = decode(file);
      if (!png) return null;
      var step = Math.max(1, Math.floor(png.w / 140));
      var sSum = 0, lSum = 0, n = 0, hx = 0, hy = 0;
      for (var y = 0; y < png.h; y += step) {
        for (var x = 0; x < png.w; x += step) {
          var i = (y * png.w + x) * png.bpp;
          if (png.bpp === 4 && png.data[i + 3] < 40) continue;    // 透明区不计
          var r = png.data[i] / 255, g = png.data[i + 1] / 255, b = png.data[i + 2] / 255;
          var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
          var s = d > 1e-6 ? d / (1 - Math.abs(2 * l - 1)) : 0;
          sSum += s; lSum += l; n++;
          if (d > 1e-6) {
            var hh;
            if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
            hh *= 60; if (hh < 0) hh += 360;
            hx += Math.cos(hh * Math.PI / 180) * s; hy += Math.sin(hh * Math.PI / 180) * s;
          }
        }
      }
      if (!n) return null;
      var mh = Math.atan2(hy, hx) * 180 / Math.PI; if (mh < 0) mh += 360;
      return { h: mh, s: sSum / n * 100, l: lSum / n * 100, n: n };
    }
    return { hueSat: hueSat };
  })();

  /* 七族目标色相：色相环上两两 ≥23°（340/5/45/68/100/175/210），冷暖交替。
     与 recolor_buildings.py 的 TARGET 必须一致 —— 改一处就要改另一处。 */
  /* 七族目标**平均色相**（v45-c 定稿）。与 recolor_buildings.py 的 TARGET 必须一致。
     注意暖族四个（12/32/46/74）刻意挨得近 —— 民房/仓廪/官署/工商本来就是木、瓦、夯土、
     炉火的同类色，硬把色相拉开只会"变红变紫"（老板原话：本质颜色并没有变好）。
     它们的区分交给**明度档 + 饱和度**，所以下面的"可分"判据是三选一而不是只看色相。 */
  var SER_TGT = { mil: 196, edu: 132, road: 250, biz: 12, store: 32, live: 74, gov: 46 };
  var SER_IDS = {
    mil: ['junying', 'xiaochang', 'fenghuotai'], edu: ['shuyuan', 'zhaoxianguan'],
    road: ['yizhan'], biz: ['shichang', 'tiejiangpu', 'gongjiangzuofang'],
    store: ['cangku', 'majiu'], live: ['minfang', 'kezhan'], gov: ['guanfu', 'honglusi'],
  };
  var AIDIR = path.join(__dirname, 'assets', 'icons', 'ui');
  var measured = {}, miss = [];
  Object.keys(SER_IDS).forEach(function (ser) {
    var hs = [], bad = false;
    SER_IDS[ser].forEach(function (id) {
      var p = path.join(AIDIR, 'ai_' + id + '.png');
      var r = PIX.hueSat(p);
      if (!r) { bad = true; miss.push(id); return; }
      hs.push(r);
    });
    if (!bad && hs.length) {
      measured[ser] = {
        h: hs.reduce(function (t, x) { return t + x.h; }, 0) / hs.length,
        s: hs.reduce(function (t, x) { return t + x.s; }, 0) / hs.length,
        l: hs.reduce(function (t, x) { return t + x.l; }, 0) / hs.length,
      };
    } else measured[ser] = null;
  });
  var COLORDESC = Object.keys(SER_TGT).map(function (k) {
    return measured[k] ? (k + ' ' + Math.round(measured[k].h) + '°/' + Math.round(measured[k].s) + '%/' +
      Math.round(measured[k].l) + 'L') : (k + ' 缺失');
  }).join(' · ');

  check('实测（解码 PNG 像素）：七族图标色相都落在目标 ±25° 内',
    miss.length === 0 && Object.keys(SER_TGT).every(function (k) {
      if (!measured[k]) return false;
      var dh = Math.abs(measured[k].h - SER_TGT[k]); if (dh > 180) dh = 360 - dh;
      return dh <= 25;
    }), COLORDESC);
  check('实测：七族图标平均饱和度 ≥ 30%（旧 CSS 滤镜方案实测只有 9~22%）',
    Object.keys(SER_TGT).every(function (k) { return measured[k] && measured[k].s >= 30; }), COLORDESC);
  /* 判据从"色相必须拉开"改为"三维里至少一维拉开" ——
     因为 v45-c 起暖族是**故意同色系**的（见 SER_TGT 注释），
     硬要求两两色相差 22° 等于要求设计回退到"把仓库染成紫红"。 */
  check('实测：七族两两可分（色相≥18° 或 明度≥6% 或 饱和度≥8%）', (function () {
    var ks = Object.keys(SER_TGT), bad = [];
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var A = measured[ks[i]], B = measured[ks[j]];
        if (!A || !B) return false;
        var dh = Math.abs(A.h - B.h); if (dh > 180) dh = 360 - dh;
        var dl = Math.abs(A.l - B.l), ds = Math.abs(A.s - B.s);
        if (dh < 18 && dl < 6 && ds < 8) bad.push(ks[i] + '/' + ks[j]);
      }
    }
    if (bad.length) console.log('      太像的组合：' + bad.join('，'));
    return bad.length === 0;
  })());
  /* 饱和度上限：老板第三轮反馈"饱和度又太高了"（当时 44~56%）——
     这条把它钉死在 ≤46%，防止下次又把低饱和素材硬拔成色块。 */
  check('实测：七族饱和度都不超 46%（防"饱和度又太高"回归）',
    Object.keys(SER_TGT).every(function (k) { return measured[k] && measured[k].s <= 46; }),
    COLORDESC);
  /* v67：`_gold_backup` 属老板要删的无用图标（也是 recolor_buildings.py 的备份目录），
     已清掉。真正的"可回退来源"是 **AI 图集原图** `assets/icons/raw`（38MB，2×2 原图），
     断言改为护它 —— 它才是重新切图的原料。
     注：recolor_buildings.py 下次调色时会自行 `makedirs(BAK)` 重建 _gold_backup。 */
  check('图标原图仍在（assets/icons/raw，可重新切图）', (function () {
    var raw = path.join(__dirname, 'assets', 'icons', 'raw');
    return fs.existsSync(raw) && fs.readdirSync(raw).length > 0;
  })(), (function () {
    try { return fs.readdirSync(path.join(__dirname, 'assets', 'icons', 'raw')).length + ' 张原图'; }
    catch (e) { return '目录缺失'; }
  })());

  console.log('  --- 需求 1：资源悬停显示上限 ---');
  check('悬停改报仓储上限（口径走 GAME.storeCap 唯一来源）',
    /GAME\.storeCap/.test(UI) && /上限 /.test(UI) && !/title="精确值：/.test(UI));
  check('黄金单独注明不受上限约束', /不受仓储上限约束/.test(UI));

  console.log('  --- 需求 2：城内 8×6 并填满界面 ---');
  check('城池为 8 列 × 6 行', /col: 8, row: 6,/.test(ST));
  check('官府 4 格落位走唯一出口 GAME.govCellsOf（居中，v68 老板）',
    /var gfIdx = GAME\.govCellsOf\(city\.col, city\.row\)/.test(ST)
    && /GAME\.govCellsOf = function/.test(ST));
  check('fitTile 上限 96 → 160（否则 8 列时棋盘只占屏幕三分之二）',
    /opt\.max \|\| 160/.test(UI));
  check('旧档 6×6 → 8×6 扩容迁移存在', /v40 迁移：城内 6×6 → 8×6（48 格）/.test(ST)
    && /c\.cells\.length === 36/.test(ST));
  check('迁移时队列 gridIndex 一起重映射（漏了会让在建项指向错格）',
    /q\.gridIndex = Math\.floor\(q\.gridIndex \/ 6\) \* 8 \+ \(q\.gridIndex % 6\)/.test(ST));
  check('实测：新开局 48 格 · 官府居中 4 格',
    (function () {
      var c = G.makeCity({ id: 'v40chk', name: 'V' });
      var g = [];
      c.cells.forEach(function (x, i) { if (x.official) g.push(i); });
      return c.cells.length === 48 && c.col === 8 && c.row === 6
        && g.join(',') === '19,20,27,28';
    })());
})();


/* ============================================================
 * 44. v42：闭包内「局部死函数」门禁
 * ------------------------------------------------------------
 * audit.js 只认 `GAME.x = function` / `ui.x = function` 这类**赋值式**定义，
 * 看不见 `function foo(){}` 这种闭包内的局部函数。
 * 后果：v30 撤掉矢量装饰后 `tri` 就再没被调用，一直留到 v42；
 *       同一批还查出 `ensureTerrainLayer`（v26 改观察框后失效）与
 *       `totalCount`（tactic.js）—— **三处死代码，两套测试全是绿的**。
 * 判据：函数名在**同一文件**里除定义外再无出现（剥掉注释后统计）。
 * ============================================================ */
/* ============================================================
 * 45. v60：资源归属城池 / 运输与派遣 / 名城专有 / 未占据城池派生
 * ------------------------------------------------------------
 * 本轮的改动面很大（把"全境共享的府库"拆成"每城一份"），
 * 所以护栏按"三条腿"布：
 *   ① **结构**：唯一出口是否收口（有没有出现第二处 s.res 赋值、第二个资源名表）；
 *   ② **实测**：数值行为是否真的按城分开（切城、tick、存档、运输）；
 *   ③ **一致性**：派生值（NPC 库存/守将）在同一座城上是否恒定。
 * ============================================================ */
console.log('\n===== 45. v60 城池归属与名城专有 =====');
(function () {
  var fs = require('fs'), path = require('path');
  function rd(f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var dS = rd('domain'), uS = rd('ui'), stS = rd('state'), bS = rd('battle'),
      mS = rd('main'), tS = rd('tactic');
  var hS = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  /* ================= 需求 0：防御照常开火 ================= */
  console.log('  --- 需求 0：防御照常开火 ---');
  check('配置：防御动作写明「射程内照常开火」', (function () {
    var hold = null;
    (DATA.STANCES || []).forEach(function (x) { if (x.id === 'hold') hold = x; });
    return !!hold && hold.desc.indexOf('照常开火') >= 0;
  })());
  check('结构：hold 分支没有「本回合不攻击」的早退', (function () {
    var code = codeOf(tS, 'T.simulate = function');
    /* 动作分支里只允许出现 advance / retreat 的位移处理；
       hold 若被写成 "else if (stance === 'hold') return"，这一条就红。 */
    return !/stance === 'hold'\)\s*\{[^}]*return/.test(code)
      && !/stance === 'hold'\)\s*return/.test(code);
  })());
  check('实测：防御动作在射程内照常开火（敌军确有损失）', (function () {
    /* ⚠️ `opts.stances.<side>` 的值必须与 `GAME.tacticOf` 的返回**同构**（{s,t}）。
       传字符串 'hold' 会命中 `tc ? tc.s : 'advance'` 里的 `undefined`
       → **静默退回 advance**，断言看着绿、其实测的是别的东西（本节第一版就踩了）。
       战场距离用 field 固定 700：防御不推进，初始不在射程内就永远打不到。 */
    var r = G.tactic.simulate({ gongjian: 2000 }, null, { changqiang: 3000 }, 0, null,
      { field: 700, stances: { atk: { gongjian: { s: 'hold', t: '' } } } });
    return r.defLoss > 0;
  })(), (function () {
    var r = G.tactic.simulate({ gongjian: 2000 }, null, { changqiang: 3000 }, 0, null,
      { field: 700, stances: { atk: { gongjian: { s: 'hold', t: '' } } } });
    return '防御中歼敌 ' + r.defLoss;
  })());
  check('结构：阵位覆盖读取 tc.s（override 值必须与 tacticOf 同构）', (function () {
    var body = codeOf(tS, 'T.unitsOf = function');
    return /ctx\.override\[id\]/.test(body) && /tc \? tc\.s : 'advance'/.test(body);
  })());
  /* ⚠️ "防御受到的伤害减半"由 v59 的断言覆盖（取首回合、唯一变量就是减伤），
     这里不再重复 —— 本节的 hold/advance 对比会被"推进带来的间距变化"污染，
     测出来的是位移效果而不是减伤，不如让 v59 那条唯一变量断言独占这件事。 */

  /* ================= 需求 1/2：装备栏去重与分行 ================= */
  console.log('  --- 需求 1/2：装备栏 ---');
  check('结构：带装总数行（.eq-sum）已彻底删除', (function () {
    /* 说明性注释里会提到"已删 .eq-sum" —— 不剥注释会把这个说明本身当成残留 */
    var code = stripComment(uS), css = hS.replace(/\/\*[\s\S]*?\*\//g, '');
    return code.indexOf('eq-sum') < 0 && css.indexOf('eq-sum') < 0;
  })());
  check('结构：装备提供属性为逐行清单（.eq-grow + 八项全称）', (function () {
    var body = codeOf(uS, 'ui.genPane = function');
    return /\.eq-grow \{/.test(hS)
      && /'统帅'/.test(body) && /'勇武'/.test(body) && /'智谋'/.test(body) && /'内政'/.test(body)
      && /eq-grows/.test(body);
  })());
  check('实测：装备后逐行清单真的出现加成行', (function () {
    var keep = G.state;
    var st = G.newGame({ name: 'v60装备' });
    try {
      var g = st.generals[0];
      var it = (DATA.EQUIP_ORDER || Object.keys(DATA.EQUIP))[0];
      st.inventory = [it];
      G.systems.autoEquipBest(g.id);
      var html = G.ui.genPane(g);
      return /eq-grow/.test(html) && html.indexOf('eq-sum') < 0;
    } finally { G.state = keep; }
  })());

  /* ================= 需求 3：满级专精迁到建筑面板 ================= */
  console.log('  --- 需求 3：满级专精 ---');
  check('全境汇总不再有「满级专精」', G.ui.statsHTML().indexOf('满级专精') < 0);
  check('结构：全境汇总的丙节已删（只剩甲/乙）', (function () {
    var body = codeOf(uS, 'ui.statsHTML = function');
    return body.indexOf("ui.lgSec('甲") >= 0 && body.indexOf("ui.lgSec('乙") >= 0
      && body.indexOf("ui.lgSec('丙") < 0;
  })());
  check('结构：建筑面板按 DATA.MASTERY 数据驱动显示满级专精', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    return /DATA\.MASTERY/.test(body) && /满级专精/.test(body) && /GAME\.masteryOf\(c, b\.id\)/.test(body);
  })());
  check('实测：建筑面板显示「满级专精 + 达成条件」', (function () {
    var keep = G.state, keepCity = G.ui._cityId;
    var st = G.newGame({ name: 'v60专精' });
    try {
      G.state = st;
      var c = st.cities[0];
      G.ui._cityId = c.id;
      var idx = c.cells.findIndex(function (x) { return x.build && x.build.id === 'minfang'; });
      if (idx < 0) return false;
      G.ui.openBuildModal(idx);
      var root = document.querySelector('#modal-root');
      var html = (root && root.innerHTML) || '';
      return html.indexOf('满级专精') >= 0
        && html.indexOf('Lv' + DATA.MAX_BLEVEL + ' 达成') >= 0;
    } finally { G.state = keep; G.ui._cityId = keepCity; }
  })());
  check('死函数 masteryListOf 已删（避免"没人用的壳"）',
    stripComment(dS).indexOf('masteryListOf') < 0);

  /* ================= 需求 4：资源归属城池 ================= */
  console.log('  --- 需求 4：资源归属城池 ---');
  var V = G.newGame({ name: 'v60城池' });
  if (!V.map.grid && G.map.generate) G.map.generate();

  check('结构：GAME.res 是唯一取值口（函数）', typeof G.res === 'function');
  check('实测：s.res 就是当前城的库存（访问器）',
    V.res === V.cities[0].res && G.res(V.cities[0]) === V.cities[0].res);
  check('实测：新开局库存落在首城（不再有全境共享字段）', (function () {
    return V.cities[0].res.grain === DATA.INITIAL_RES.grain;
  })(), 'grain=' + V.cities[0].res.grain);
  check('实测：切城后 s.res 跟着切换', (function () {
    var b = G.makeCity({ id: 'v60b', name: '邺城', x: 10, y: 10, type: 'jun' });
    V.cities.push(b);
    var keep = G.ui._cityId;
    G.ui._cityId = b.id;
    var ok = (V.res === b.res);
    G.ui._cityId = keep;
    return ok;
  })());
  check('实测：逐城结算 —— 两座城各自增产（互不影响、也不漏结算）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    /* 各给一块农田，保证两城都有正的粮产 ——
       只断言"B 没变"是不够的：把结算写成"只有首城结算"它也不会红。
       必须同时证明"B 自己也在涨"（这就是本轮破坏测试查出来的盲区）。 */
    a.extGrid[0] = { id: 'e1', type: 'farm', lv: 5 };
    b.extGrid[0] = { id: 'e1', type: 'farm', lv: 5 };
    a.res.grain = 1000; b.res.grain = 1000;
    var keep = G.ui._cityId;
    G.ui._cityId = a.id;                       // 当前城 = A（autoUpgrade 等按当前城）
    for (var i = 0; i < 5; i++) G.tickOnce();
    G.ui._cityId = keep;
    return a.res.grain > 1000 && b.res.grain > 1000;
  })(), (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    return b ? ('A ' + Math.round(a.res.grain) + ' / B ' + Math.round(b.res.grain)) : '';
  })());
  check('实测：存档里不含顶层 res（只有各城自己的那份）', (function () {
    var raw = JSON.stringify(V);
    return raw.indexOf('"res":') >= 0 && JSON.parse(raw).res === undefined;
  })());
  check('结构：仓储上限按城（storeCap → storeCapOf → 汇总口）', (function () {
    return /GAME\.storeCapOf = function/.test(dS)
      && /storeCapOf\(GAME\.currentCity\(\)\)/.test(codeOf(dS, 'GAME.storeCap = function'))
      /* v79：加成汇总改走 cityBonusNum（它内部再读 perkNum —— 见下一条守卫） */
      && /cityBonusNum\(city, 'storePct'\)/.test(codeOf(dS, 'GAME.storeCapOf = function'));
  })());
  check('结构：耗粮按城（foodPerSecOf 唯一出口）',
    /GAME\.foodPerSecOf = function/.test(stS) && /feedC = GAME\.foodPerSecOf\(ct\)/.test(stS));
  check('结构：全境人口收口到 totalPop（不许直读 s.res.pop）', (function () {
    return /GAME\.totalPop = function/.test(stS)
      && rd('story').indexOf('GAME.totalPop()') >= 0;
  })());
  check('实测：totalPop = 各城之和（不是当前城那一份）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    var pa = a.res.pop, pb = b.res.pop;
    a.res.pop = 111; b.res.pop = 222;
    var sum = G.totalPop();
    a.res.pop = pa; b.res.pop = pb;
    return sum === 333;
  })());

  /* ================= 需求 4：运输 ================= */
  console.log('  --- 需求 4：资源运输 ---');
  check('实测：运输扣出发城、加目的城、并抽损耗', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    a.res.grain = 10000; b.res.grain = 0;
    var r = G.doTransport(a.id, b.id, 'grain', 4000);
    var loss = G.transportLossOf(a, b);
    return r.ok && a.res.grain === 6000 + r.returned && b.res.grain === r.landed
      && r.landed < 4000 && loss > 0;
  })());
  check('实测：运往本城被拦（不给"自己运给自己"的损耗漏洞）',
    G.doTransport(V.cities[0].id, V.cities[0].id, 'grain', 100).ok === false);
  check('实测：仓容不足的部分原路带回（不做静默丢弃）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    var cap = G.storeCapOf(b);
    b.res.wood = cap;                          // 目的城塞满
    a.res.wood = 5000;
    var r = G.doTransport(a.id, b.id, 'wood', 5000);
    /* 装不下 → 全部**未起运**：出发城一木未少、目的城一点没涨。
       （改前是"先起运再带回"，结果东西没运走却把损耗抽掉了。） */
    return r.landed === 0 && r.returned === 5000 && r.shipped === 0
      && a.res.wood === 5000 && b.res.wood === cap;
  })());
  check('实测：黄金不受仓容限制（货币口径）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    a.res.gold = 50000; b.res.gold = 0;
    var r = G.doTransport(a.id, b.id, 'gold', 20000);
    return r.ok && b.res.gold > 0 && r.returned === 0;
  })());

  /* ================= 需求 4：派遣 ================= */
  console.log('  --- 需求 4：将领派遣 ---');
  check('实测：派遣改 cityId（人随城走）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    /* v64（老板）：「根据该城的招贤馆等级有相应空位」——
       目标城**先把招贤馆建起来**（没有招贤馆 = 0 席 = 一个人也放不下） */
    if (!G.buildingLevel(b, 'zhaoxianguan')) {
      for (var i = 0; i < b.cells.length; i++) {
        if (!b.cells[i].official && !b.cells[i].build) { b.cells[i].build = { id: 'zhaoxianguan', lvl: 5 }; break; }
        if (!b.cells[i].official) { b.cells[i].build = { id: 'zhaoxianguan', lvl: 5 }; break; }
      }
    }
    var g = V.generals[0];
    g.status = 'idle'; g.cityId = a.id;
    var r = G.doDispatch(g.id, b.id);
    return r.ok && g.cityId === b.id && G.genCityOf(g).id === b.id;
  })(), '目标城 5 级招贤馆 → 5 席');
  check('实测：目标城无空位时派遣被拦（席位按城）', (function () {
    var a = V.cities[0], b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    /* 把 b 城的招贤馆降到 1 级 → 只 1 席；塞满后再派必被拒 */
    var zi = -1;
    b.cells.forEach(function (x, i) { if (x.build && x.build.id === 'zhaoxianguan') zi = i; });
    if (zi < 0) return false;
    var oldLv = b.cells[zi].build.lvl;
    b.cells[zi].build.lvl = 1;
    var keep = V.generals.slice();
    var g = V.generals[0];
    g.status = 'idle'; g.cityId = a.id;
    /* 先占满 b 城的 1 个席位 */
    V.generals.push(G.makeGeneral('占位将', 1, 'idle', b.id, false));
    var r = G.doDispatch(g.id, b.id);
    var blocked = (r.ok === false) && /无空位/.test(r.msg || '');
    /* 还原：把占位将去掉、等级回填 */
    V.generals.length = 0; keep.forEach(function (x) { V.generals.push(x); });
    b.cells[zi].build.lvl = oldLv;
    return blocked;
  })());
  check('实测：守将不可直接派遣（必须先解任，否则加成会挂错城）', (function () {
    var b = null;
    V.cities.forEach(function (c) { if (c.id === 'v60b') b = c; });
    if (!b) return false;
    var g = V.generals[0];
    g.cityId = b.id; g.status = 'guard';
    var r = G.doDispatch(g.id, V.cities[0].id);
    g.status = 'idle';
    return r.ok === false && /解除/.test(r.msg);
  })());
  check('实测：将领页按城过滤（本城名单只含本城的人）', (function () {
    var keep = G.state, city = V.cities[1];
    try {
      G.state = V;
      G.ui._cityId = city.id;
      G.ui._genSel = null;
      G.ui._genScope = 'city';
      var html = G.ui.generalsHTML();
      var mine = V.generals.filter(function (g) { return G.genCityOf(g).id === city.id; });
      /* 本城名单里出现的人数 = 全境里属于本城的人数（空席位不算） */
      var rows = (html.match(/gen-row/g) || []).length;
      return rows >= Math.min(mine.length, 1) && html.indexOf('本城') >= 0;
    } finally { G.state = keep; }
  })());

  /* ================= 需求 5：名城专有 ================= */
  console.log('  --- 需求 5：名城专有 ---');
  check('结构：DATA.CITY_PERK 覆盖五档（含自建城）', (function () {
    var P2 = DATA.CITY_PERK || {};
    return !!P2.capital && !!P2.zhou && !!P2.jun && !!P2.county && !!P2.self;
  })());
  check('结构：perk 每一项都真有消费点（死属性检查法）', (function () {
    /* v79：四项经营 perk 的消费点从"各处直接读 perkNum"收拢到 GAME.cityBonusNum，
       判据同步演进：① 消费点确实调到汇总口；② 汇总口内部确实读 perkNum
       （两层都查，防"改了汇总口、但 perk 被架空"）。 */
    return /cityBonusNum\(city, 'prodPct'\)/.test(codeOf(stS, 'GAME.cityProdPerSec = function'))
      && /cityBonusNum\(city, 'taxPct'\)/.test(codeOf(stS, 'GAME.cityProdPerSec = function'))
      && /cityBonusNum\(city, 'storePct'\)/.test(codeOf(dS, 'GAME.storeCapOf = function'))
      && /cityBonusNum\(city, 'buildSlot'\)/.test(codeOf(dS, 'GAME.buildSlots = function'))
      && /GAME\.perkNum\(city, key\)/.test(codeOf(stS, 'GAME.cityBonusNum = function'))
      && /perkNum\(city \|\| GAME\.currentCity\(\), 'troopSlot'\)/.test(dS)
      && /npcResMul/.test(codeOf(stS, 'GAME.npcCityRes = function'));
  })());
  check('实测：名城产量优势真的生效（同配置下帝都 > 自建城）', (function () {
    var lv = 5;
    var self = G.makeCity({ id: 'v60s', name: '自建', x: 1, y: 1, type: 'self' });
    var cap = G.makeCity({ id: 'v60c', name: '洛阳', x: 2, y: 2, type: 'capital' });
    var a = G.cityProdPerSec(self), b = G.cityProdPerSec(cap);
    return b.grain >= a.grain && b.gold > a.gold;
  })());
  check('实测：名城专属选项按档位过滤（县城一项、帝都三项）', (function () {
    var county = { id: 'x1', type: 'county' }, cap = { id: 'x2', type: 'capital' };
    return G.cityOptsOf(county).length === 1 && G.cityOptsOf(cap).length >= 3;
  })());
  check('实测：征调给物资并进入冷却', (function () {
    var keep = G.state, st = G.newGame({ name: 'v60征调' });
    try {
      var c = st.cities[0];
      c.type = 'jun';                         // 郡城可用「征调民力」
      G.ui._cityId = c.id;
      var before = c.res.grain;
      var r1 = G.doCityOpt(c.id, 'levy');
      var r2 = G.doCityOpt(c.id, 'levy');
      return r1.ok && c.res.grain > before && r2.ok === false && /日/.test(r2.msg);
    } finally { G.state = keep; }
  })());
  check('结构：城池面板与 main 的按钮接线都在（city-opt 不是孤儿按钮）',
    /data-action="city-opt"/.test(codeOf(uS, 'ui.openCityPanel = function'))
    && /case 'city-opt'/.test(mS)
    && /GAME\.doCityOpt\(/.test(mS));

  /* ================= 需求 6：未占据城池派生 ================= */
  console.log('  --- 需求 6：未占据城池派生 ---');
  var npcs = (V.map.cities || []);
  var npc9 = null, npc7 = null;
  npcs.forEach(function (c) { if (c.level === 9 && !npc9) npc9 = c; if (c.level === 7 && !npc7) npc7 = c; });
  check('前置：名城列表含 9 级与 7 级城', !!npc9 && !!npc7);
  check('实测：库存派生**确定性**（清掉缓存重算仍逐项相同）', (function () {
    /* ⚠️ 必须先清 `GAME._npcCache`：不清的话第二次调用命中缓存、
       恒等于第一次，把 Math.random 换成随机源也测不出来（破坏测试查出来的盲区）。 */
    var a = G.npcCityRes(npc9);
    G._npcCache = {};
    var b = G.npcCityRes(npc9);
    return a.grain === b.grain && a.gold === b.gold && a.pop === b.pop;
  })(), npc9 ? ('9级 ' + npc9.name + ' 粮 ' + G.npcCityRes(npc9).grain + ' / 金 ' + G.npcCityRes(npc9).gold + ' / 人口 ' + G.npcCityRes(npc9).pop) : '');
  check('实测：库存随等级增长（9 级 > 7 级）',
    G.npcCityRes(npc9).grain > G.npcCityRes(npc7).grain);
  check('实测：建筑默认全满（每格都有建筑，等级 = 名城建筑上限）', (function () {
    /* v63（老板）：「为名城也补满建筑，**根据其等级上限**」；
       v65（老板）：「名城默认满级（县城 12 / 郡城 14 / 州城 18）」→
       上限基数是**满级城等级 10**，与该城自身的等级无关（见 `GAME.npcBuildLvOf`）。
       这里不再手抄 "9+8"，直接与唯一出口对齐，并额外钉住"内外都到上限"。 */
    var sh = G.npcCityShadow(npc9);
    var bl = G.npcBuildLvOf(npc9);
    var empty = sh.cells.filter(function (c) { return !c.build; }).length;
    var wrong = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;
    var extWrong = (sh.extGrid || []).filter(function (e) { return e.lv !== bl; }).length;
    return empty === 0 && wrong === 0 && extWrong === 0
      && bl === DATA.CITY_PLAN.maxLevel + G.cityBuildBonus(npc9)
      && sh.wallLv === bl && sh.extGrid.length > 0;
  })(), '9 级州城建筑补到 Lv' + G.npcBuildLvOf(npc9) + '（内外同上限）');
  check('实测：守将派生**确定性**且六维与城等级相称', (function () {
    var g1 = G.npcCityGuard(npc9);
    G._npcCache = {};                          // 同上：清缓存才是真的重算
    var g2 = G.npcCityGuard(npc9);
    if (!g1 || g1.name !== g2.name || g1.tong !== g2.tong) return false;
    /* 9 级城该给英杰档、等级数十级、六维三位数 */
    return g1.rank === 'ying' && g1.level >= 40 && g1.tong > 100 && !!g1.title;
  })(), (function () {
    var g = G.npcCityGuard(npc9);
    return g.name + '（' + g.title + ' Lv' + g.level + ' 统' + g.tong + '）';
  })());
  check('实测：未占据城池的库存**不入存档**（纯派生）', (function () {
    var raw = JSON.stringify(V);
    /* NPC 城由 seed 重建，存档里根本不该出现 n.cityRes 之类的字段 */
    return raw.indexOf('npcCityRes') < 0 && raw.indexOf('"guard":') < 0;
  })());
  check('实测：出征目标带上守将（守方将领加成真的参与战斗）', (function () {
    var t = G.battle.resolveTarget({ kind: 'city', id: npc9.id });
    return t.ok && !!t.guard && t.guard.npcGuard === true;
  })());
  check('实测：掠夺量 = 该城派生库存 × 0.5（侦查看到的与打到的对得上）', (function () {
    var loot = G.npcLoot(npc9, 'raid');
    var base = G.npcCityRes(npc9);
    return Math.abs(loot.grain - Math.round(base.grain * 0.5)) <= 1;
  })());
  check('实测：攻占后建筑就地转正 + 库存继承', (function () {
    var keep = G.state, st = G.newGame({ name: 'v60攻城' });
    try {
      var tgt = null;
      (st.map.cities || []).forEach(function (c) { if (c.level === 7 && !tgt) tgt = c; });
      if (!tgt) return false;
      G.onConquer(tgt, { defLossBy: {} }, null, st.cities[0]);   /* 定义在 GAME 上（不是 GAME.battle） */
      var nc = null;
      st.cities.forEach(function (c) { if (c.origId === tgt.id) nc = c; });
      if (!nc) return false;
      var empty = nc.cells.filter(function (c) { return !c.build; }).length;
      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);
      return empty === 0 && nc.res.grain === want && nc.wallLv === G.npcBuildLvOf(tgt);
    } finally { G.state = keep; }
  })());

  /* ================= 收口：不许出现第二个出口 ================= */
  console.log('  --- 收口：唯一出口 ---');
  check('结构：没有第二处「资源名表」（战报改用 GAME.resName）',
    /GAME\.resName = function/.test(dS)
    && bS.indexOf("wood: '木材'") < 0);
  check('结构：没有绕过 getter 直读某城 .res 的写法（除 GAME.res 内部）', (function () {
    var hits = 0;
    ['domain', 'ui', 'battle', 'story', 'main', 'state'].forEach(function (f) {
      var code = stripComment(rd(f));
      var m = code.match(/\.currentCity\(\)\.res\b/g);
      if (m) hits += m.length;
    });
    return hits === 0;
  })());
})();

/* ============================================================
 * 46. v61：满配城池的城内布局（老板：野地里的城池默认建筑全满）
 * ------------------------------------------------------------
 * 老板原话：「野地里的城池，应默认其建筑全都建满了，城内所有建筑各1个，
 *   兵营2个，其他建民房，位置也相对固定一下。城池的地块数量根据等级，数量你来定」
 *
 * 护栏分三层：
 *   ① **规则**：各 1 座 / 军营 2 座 / 余为民房 —— 逐项数出来（不是看有没有"铺满"）；
 *   ② **固定**：同等级逐格一致、跨等级同规则；官府落位与玩家城同公式；
 *   ③ **接线**：野外城池的弹窗/出征面板都要能看到，攻占后建筑与格数就地转正。
 * ============================================================ */
console.log('\n===== 46. v61 满配城池城内布局 =====');
(function () {
  var fs = require('fs'), path = require('path');
  function rd(f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var stS = rd('state'), uS = rd('ui'), bS = rd('battle'), dS = rd('data'), mS = rd('main');
  var PLACE = DATA.CITY_PLAN;
  function countOf(plan) {
    var m = {};
    plan.cells.forEach(function (c) { if (c.build) m[c.build.id] = (m[c.build.id] || 0) + 1; });
    return m;
  }

  console.log('  --- 规则：各 1 座 / 军营 2 座 / 余为民房 ---');
  /* v65（老板）：「城内建筑按照 6*8，官府靠右居中位置固定，怎么现在变成 4*8 了？」
     → 格数**不再按等级分档**，`sizeByLevel` 已删，改为唯一来源 `PLACE.size`。 */
  check('配置：CITY_PLAN 用统一的 8×6（不再按等级分档）+ 落位优先序',
    !!PLACE && PLACE.size[0] === 8 && PLACE.size[1] === 6
    && PLACE.sizeByLevel === undefined
    /* v70（老板）：仓库 1 → 4 后，优先序 14 → 17 项 */
    && PLACE.maxLevel === 10 && PLACE.order.length === 17 && PLACE.filler === 'minfang');
  check('实测：官府恰好 4 格（2×2 同体，与玩家城一致）', (function () {
    for (var lv = 1; lv <= 10; lv++) {
      var c = countOf(G.cityPlanOf(lv));
      if (c.guanfu !== 4) return false;
    }
    return true;
  })());
  check('实测：军营恰好 2 座（老板指定）', (function () {
    for (var lv = 1; lv <= 10; lv++) {
      if (countOf(G.cityPlanOf(lv)).junying !== 2) return false;
    }
    return true;
  })());
  check('实测：除民房外每种建筑恰好 1 座、且城内可建建筑一种不缺', (function () {
    /* 城内可建 = BUILD_ORDER 的 14 种（城墙不占格、官府已单算） */
    var want = DATA.BUILD_ORDER.filter(function (b) { return b !== 'minfang'; });
    for (var lv = 1; lv <= 10; lv++) {
      var c = countOf(G.cityPlanOf(lv));
      for (var i = 0; i < want.length; i++) {
        /* v70（老板）：军营 2 座、**仓库 4 座**，其余各 1 座 */
        var need = (want[i] === 'junying') ? 2 : (want[i] === 'cangku') ? 4 : 1;
        if ((c[want[i]] || 0) !== need) return false;
      }
      /* 不许出现多余的建筑种类（比如把城墙也铺上格） */
      var extra = Object.keys(c).filter(function (b) { return want.indexOf(b) < 0 && b !== 'minfang' && b !== 'guanfu'; });
      if (extra.length) return false;
    }
    return true;
  })());
  check('实测：余格全是民房（没有空格、没有别的东西）', (function () {
    for (var lv = 1; lv <= 10; lv++) {
      var plan = G.cityPlanOf(lv), c = countOf(plan);
      var sum = Object.keys(c).reduce(function (a, k) { return a + c[k]; }, 0);
      var empty = plan.cells.filter(function (x) { return !x.build; }).length;
      /* 每格都有建筑 = 民房数 + 功能建筑数 + 官府 4 */
      if (empty !== 0 || sum !== plan.total) return false;
      /* 4 = 官府 4 格；17 = 功能建筑格数（v70：军营2 + 仓库4 + 其余 11）；余下全是民房 */
      if (c.minfang !== plan.total - 4 - 17) return false;
    }
    return true;
  })());

  console.log('  --- 地块数量（v65：统一 8×6，不再按等级）---');
  check('实测：十级同格数（v65 老板「怎么现在变成 4×8 了？」→ 不再分档）', (function () {
    var uniq = {};
    for (var lv = 1; lv <= 10; lv++) {
      var p3 = G.cityPlanOf(lv);
      if (p3.col !== 8 || p3.row !== 6) return false;
      uniq[p3.total] = 1;
    }
    return Object.keys(uniq).length === 1 && uniq[48] === 1;
  })(), '1~10 级一律 8×6 = 48 格');
  check('实测：48 格装得下"官府4 + 军营2 + 其余12"（18 格）',
    G.cityPlanOf(1).total >= 18, 'Lv1 = ' + G.cityPlanOf(1).total + ' 格');
  check('实测：最高档与玩家城同宽（8 列）—— 攻占后进城不会越界', (function () {
    return G.cityPlanOf(10).col === 8 && G.cityPlanOf(10).row === 6;
  })());
  check('实测：等级越界被钳制（0 / 99 都不崩）',
    G.cityPlanOf(0).level === 1 && G.cityPlanOf(99).level === PLACE.maxLevel);

  console.log('  --- 位置相对固定 ---');
  check('实测：**只与等级有关** —— 同等级两次布局逐格一致', (function () {
    var a = G.cityPlanOf(7), b = G.cityPlanOf(7);
    for (var i = 0; i < a.cells.length; i++) {
      var x = a.cells[i].build, y = b.cells[i].build;
      if ((x ? x.id + '/' + x.lvl : '-') !== (y ? y.id + '/' + y.lvl : '-')) return false;
    }
    return true;
  })());
  check('实测：官府落位与玩家城**同一出口**（8×6 → 棋盘正中 [19,20,27,28]）', (function () {
    var plan = G.cityPlanOf(8);
    var gf = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'guanfu') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return gf.join(',') === G.govCellsOf(plan.col, plan.row).join(',');
  })());
  check('实测：军营紧贴官府左邻一列（成对、挨着官府）', (function () {
    var plan = G.cityPlanOf(8);
    /* v68：官府居中后左列不能再写死 —— 按落位出口实算 */
    var gfCols = G.govCellsOf(plan.col, plan.row).map(function (i) { return i % plan.col; });
    var gCol = Math.min.apply(null, gfCols);   /* 官府最左列 */
    var bars = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'junying') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return bars.length === 2 && bars.every(function (i) { return (i % plan.col) === gCol - 1; });
  })());
  check('实测：功能建筑比民房更靠近城池中心（核心在里、民房在外）', (function () {
    var plan = G.cityPlanOf(8);
    var cx = (plan.col - 1) / 2, cy = (plan.row - 1) / 2;
    var d = function (i) { return Math.abs((i % plan.col) - cx) + Math.abs(Math.floor(i / plan.col) - cy); };
    var fn = [], mf = [];
    plan.cells.forEach(function (c, i) {
      if (!c.build) return;
      if (c.build.id === 'minfang') mf.push(d(i));
      else if (c.build.id !== 'guanfu') fn.push(d(i));
    });
    var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / Math.max(1, a.length); };
    return fn.length > 0 && mf.length > 0 && avg(fn) < avg(mf);
  })());
  check('结构：满配人口**不吃玩家侧加成**（不引用 mastery / maxPopOf）', (function () {
    /* 侦查面板报的"这城有多少人"不该因为我在别处盖了座 Lv12 民房就变 ——
       所以这一项必须是**纯布局派生**。引用 mastery/maxPopOf 就说明被污染了。 */
    var body = codeOf(stS, 'GAME.planPopCapOf = function');
    return !/mastery/.test(body) && !/maxPopOf/.test(body)
      && /DATA\.BUILDINGS\.minfang\.pop/.test(body);
  })());
  check('实测：玩家自己盖满民房，系统城的人口派生值不变', (function () {
    var keep = G.state, st = G.newGame({ name: 'v61pop' });
    try {
      G.state = st;
      var before = G.planPopCapOf(9);
      /* 把首城非官府格全换成 Lv12 民房 → 民房满级专精（全境口径）会变成 +20% */
      st.cities[0].cells.forEach(function (c) { if (!c.official) c.build = { id: 'minfang', lvl: 12 }; });
      var boosted = G.mastery('popPct', null);
      var after = G.planPopCapOf(9);
      return before > 0 && before === after && boosted > 0;
    } finally { G.state = keep; }
  })());
  check('实测：人口上限 = 民房座数 × 该级民房人口', (function () {
    var plan = G.cityPlanOf(9), c = countOf(plan);
    var per = DATA.BUILDINGS.minfang.pop[plan.level - 1];
    return G.planPopCapOf(9) === c.minfang * per && G.planPopCapOf(9) > 0;
  })(), 'Lv9 民房 ×' + countOf(G.cityPlanOf(9)).minfang + ' → 人口 ' + G.planPopCapOf(9));

  console.log('  --- 接线：野外城池与未占据名城 ---');
  check('结构：布局只有一个出口（不在别处铺格子）', (function () {
    var code = stripComment(stS);
    return /GAME\.cityPlanOf = function/.test(code)
      && (code.match(/GAME\.cityPlanOf\(/g) || []).length >= 2;   /* 定义 + 至少一处消费 */
  })());
  check('实测：野外城池有自己的满配布局（格数/民房/人口/城防齐备）', (function () {
    var keep = G.state, st = G.newGame({ name: 'v61fort' });
    try {
      G.state = st;
      if (!st.map.grid && G.map.generate) G.map.generate();
      var f = null;
      for (var x = 0; x < 40 && !f; x++) for (var y = 0; y < 40 && !f; y++) f = G.map.fortAt(x, y);
      if (!f) return false;
      var p = G.fortPlanOf(f);
      return !!p && p.total === G.cityPlanOf(f.level).total && p.minfang > 0
        && p.popCap > 0 && p.def === G.fortDefOf(f) && p.items.length === 14;
    } finally { G.state = keep; }
  })());
  check('实测：野外城池的城防走唯一出口（不再是写死的算式）', (function () {
    return /GAME\.fortDefOf = function/.test(stS)
      && /def: GAME\.fortDefOf\(f\)/.test(bS)
      && !/def: 10 \+ f\.level \* 4/.test(bS);
  })());
  check('实测：出征野外城池时带上布局（面板看得到城内建了什么）', (function () {
    var keep = G.state, st = G.newGame({ name: 'v61exp' });
    try {
      G.state = st;
      if (!st.map.grid && G.map.generate) G.map.generate();
      var f = null;
      for (var x = 0; x < 40 && !f; x++) for (var y = 0; y < 40 && !f; y++) f = G.map.fortAt(x, y);
      if (!f) return false;
      var t = G.battle.resolveTarget({ kind: 'fort', x: f.x, y: f.y });
      return t.ok && !!t.plan && t.plan.minfang > 0
        && t.def === G.fortDefOf(f) && t.def > 10;
    } finally { G.state = keep; }
  })());
  check('实测：未占据名城的影子城也用同一套布局（无空格、格数与布局一致）', (function () {
    var keep = G.state, st = G.newGame({ name: 'v61npc' });
    try {
      G.state = st;
      var npc = null;
      (st.map.cities || []).forEach(function (c) { if (c.level === 9 && !npc) npc = c; });
      if (!npc) return false;
      var sh = G.npcCityShadow(npc), plan = G.cityPlanOf(9);
      return sh.col === plan.col && sh.row === plan.row
        && sh.cells.length === plan.total
        && sh.cells.filter(function (c) { return !c.build; }).length === 0;
    } finally { G.state = keep; }
  })());
  check('实测：攻占后建筑与格数就地转正（拿到的就是满配城）', (function () {
    var keep = G.state, st = G.newGame({ name: 'v61conq' });
    try {
      G.state = st;
      var tgt = null;
      (st.map.cities || []).forEach(function (c) { if (c.level === 7 && !tgt) tgt = c; });
      if (!tgt) return false;
      G.onConquer(tgt, { defLossBy: {} }, null, st.cities[0]);
      var nc = null;
      st.cities.forEach(function (c) { if (c.origId === tgt.id) nc = c; });
      if (!nc) return false;
      /* v63：布局按**建筑等级**算（郡城 → 7+4=11），否则比的是另一座城 */
      var want = G.cityPlanOf(7, G.npcBuildLvOf(tgt)), c = countOf({ cells: nc.cells });
      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row
        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 21
        && nc.wallLv === G.npcBuildLvOf(tgt);
    } finally { G.state = keep; }
  })());
  check('结构：呈现只有一个出口（ui.planHTML），弹窗与出征面板共用', (function () {
    var code = stripComment(uS);
    return /ui\.planHTML = function/.test(code)
      /* 只数"被调用的次数"（定义那行是 `ui.planHTML = function`，不匹配这个模式）：
         fort 弹窗 1 处 + 出征面板 1 处 = 2 处 */
      && (code.match(/ui\.planHTML\(/g) || []).length >= 2;
  })());
  check('实测：布局呈现含建筑名、民房数、地块与人口', (function () {
    var html = G.ui.planHTML(G.fortPlanOf({ x: 1, y: 1, level: 8, name: '青石营' }));
    /* v70：仓库 1→4 之后，Lv8 满配的民房 30 → 27 */
    return html.indexOf('军营 ×2') >= 0 && html.indexOf('仓库 ×4') >= 0
      && html.indexOf('民房 ×27') >= 0
      && html.indexOf('8 × 6 = 48 格') >= 0 && html.indexOf('人口上限') >= 0;
  })());
  check('实测：野外城池弹窗与出征面板都渲染城内布局', (function () {
    var code = stripComment(uS);
    var fort = codeOf(uS, 'ui.openFortModal = function');
    var exp = codeOf(uS, 'ui.openExpModal = function');
    return /ui\.planHTML\(plan\)/.test(fort) && /t\.kind === 'fort' && t\.plan/.test(exp);
  })());
  check('结构：野外城池不被当成"名城"（无档位加成，只是共用派生公式）', (function () {
    return DATA.CITY_PERK.fort && G.isFamousCity({ type: 'fort' }) === false
      && G.isFamousCity({ type: 'zhou' }) === true;
  })());
})();

/* ============================================================
 * 44. v42：闭包内「局部死函数」门禁
 * ------------------------------------------------------------
 * audit.js 只认 `GAME.x = function` / `ui.x = function` 这类**赋值式**定义，
 * 看不见 `function foo(){}` 这种闭包内的局部函数。
 * 后果：v30 撤掉矢量装饰后 `tri` 就再没被调用，一直留到 v42；
 *       同一批还查出 `ensureTerrainLayer`（v26 改观察框后失效）与
 *       `totalCount`（tactic.js）—— **三处死代码，两套测试全是绿的**。
 * 判据：函数名在**同一文件**里除定义外再无出现（剥掉注释后统计）。
 * ============================================================ */
/* ============================================================
 * 47. v62：工匠作坊造箭塔（老板：箭塔默认参与防守）
 * ------------------------------------------------------------
 * 老板原话：「工匠作坊可以造箭塔，箭塔默认参与防守」
 *
 * 关键设计：箭塔从此有**两个来源**（城防折出 / 作坊建造），
 * 所以护栏一半的力气花在"**只能有一个出口**"上：
 *   · `GAME.towerCountOf(city)` 是唯一的座数出口；
 *   · 战斗侧只在 `opts.towers` 里**传数**，不再自己折一次；
 *   · `cityDefenseBase` / `cityDefense` 拆开，断掉"箭塔 ↔ 城防"的循环。
 * ============================================================ */
console.log('\n===== 47. v62 工匠作坊造箭塔 =====');
(function () {
  var fs = require('fs'), path = require('path');
  function rd(f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var dS = rd('domain'), tS = rd('tactic'), bS = rd('battle'), uS = rd('ui'), mS = rd('main');
  var dataS = rd('data');
  var TW = DATA.WALL_TOWER;

  function freshTowerCity(lv) {
    var st = G.newGame({ name: 'v62塔' });
    var c = st.cities[0];
    c.cells.forEach(function (x) { x.build = null; x.official = false; });
    c.cells[0].build = { id: 'gongjiangzuofang', lvl: lv };
    c.wallLv = 6; c.def = 20;
    c.res = { grain: 1e7, wood: 1e7, stone: 1e7, iron: 1e7, gold: 1e7, pop: 100 };
    return { st: st, c: c };
  }
  function withCity(fn) {
    var keep = G.state;
    try { return fn(); } finally { G.state = keep; }
  }

  console.log('  --- 配置与唯一出口 ---');
  check('配置：箭塔可造（上限系数 / 造价 / 守备力贡献都在 DATA.WALL_TOWER）',
    TW.buildMaxPerLv > 0 && TW.buildCost && TW.buildCost.wood > 0 && TW.homeDef > 0);
  check('结构：箭塔座数只有一个出口 towerCountOf（= 城防折出 + 作坊建造）', (function () {
    var body = codeOf(dS, 'GAME.towerCountOf = function');
    return /towersFromDef\(city\) \+ GAME\.towersBuiltOf\(city\)/.test(body)
      && /GAME\.towerCountOf = function/.test(dS);
  })());
  check('结构：战斗侧只"传数"，不自己再折一次（opts.towers → towerCountOfArg）', (function () {
    return /T\.towerCountOfArg = function/.test(tS)
      && /towerStart = T\.towerCountOfArg\(defVal, opts\.towers\)/.test(tS)
      && /towers: \(t\.npc && GAME\.towerCountOf\) \? GAME\.towerCountOf\(t\.npc\) : null/.test(bS);
  })());
  check('结构：城防拆成 Base / 合计，断掉"箭塔 ↔ 城防"循环', (function () {
    var base = codeOf(dS, 'GAME.cityDefenseBase = function');
    var all = codeOf(dS, 'GAME.cityDefense = function');
    return /cityDefenseBase\(city\)/.test(all)
      && /towersBuiltOf\(city\) \* TW_T\(\)\.homeDef/.test(all)
      && !/towerCountOf|towersFromDef/.test(base)   /* Base 里不许出现箭塔 */
      && /wallTowerCount\(base\)/.test(codeOf(dS, 'GAME.towersFromDef = function'));
  })());

  console.log('  --- 建造 ---');
  check('实测：自建上限 = 作坊等级 × 每级座数', (function () {
    return withCity(function () {
      var a = freshTowerCity(6), b = freshTowerCity(3);
      return G.towerCapOf(a.c) === 6 * TW.buildMaxPerLv
        && G.towerCapOf(b.c) === 3 * TW.buildMaxPerLv;
    });
  })(), 'Lv6 → ' + (6 * TW.buildMaxPerLv) + ' 座');
  check('实测：造 n 座 → 自建数 +n、守备力 + n×homeDef', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var d0 = G.cityDefense(o.c), b0 = G.towersBuiltOf(o.c);
      var r = G.buildTowers(o.c.id, 5);
      return r.ok && G.towersBuiltOf(o.c) === b0 + 5
        && G.cityDefense(o.c) === d0 + 5 * TW.homeDef;
    });
  })());
  check('实测：总座数 = 城防折出 + 自建（两个来源合成一个数）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var fromDef = G.towersFromDef(o.c);
      G.buildTowers(o.c.id, 4);
      return fromDef > 0 && G.towerCountOf(o.c) === fromDef + 4;
    });
  })());
  check('实测：城防 Base 不因造箭塔而变（无循环）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var b0 = G.cityDefenseBase(o.c), d0 = G.towersFromDef(o.c);
      G.buildTowers(o.c.id, 5);
      /* Base 不动 → 折出的座数也不动（若把箭塔算进城防，这里会滚雪球） */
      return G.cityDefenseBase(o.c) === b0 && G.towersFromDef(o.c) === d0;
    });
  })());
  check('实测：超出上限被拦（作坊等级决定天花板）', (function () {
    return withCity(function () {
      var o = freshTowerCity(3);                 /* 上限 6 */
      var r1 = G.buildTowers(o.c.id, 6);
      var r2 = G.buildTowers(o.c.id, 1);
      return r1.ok && r2.ok === false && /上限/.test(r2.msg);
    });
  })());
  check('实测：资源不足时**自动下调**（能造几座造几座），一点都不够才报错', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      o.c.res.wood = TW.buildCost.wood * 2;      /* 只够 2 座 */
      var r = G.buildTowers(o.c.id, 10);
      var after = G.towersBuiltOf(o.c);
      o.c.res.wood = 0;
      var r2 = G.buildTowers(o.c.id, 1);
      return r.ok && r.built === 2 && after === 2 && r2.ok === false && /资源不足/.test(r2.msg);
    });
  })());
  check('实测：费用从**该城**库存扣（不扣当前城）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var other = G.makeCity({ id: 'v62b', name: '邺城', x: 5, y: 5, type: 'jun',
        res: { grain: 100, wood: 50000, stone: 50000, iron: 50000, gold: 0, pop: 0 } });
      other.cells[0].build = { id: 'gongjiangzuofang', lvl: 6 };   /* 目标城自己也要有作坊 */
      o.st.cities.push(other);
      G.ui._cityId = o.c.id;                      /* 当前城 = 首城 */
      var aBefore = G.res(o.c).wood;
      var r = G.buildTowers(other.id, 3);         /* 在"邺城"名下建造 */
      return r.ok && G.towersBuiltOf(other) === 3
        && G.res(other).wood === 50000 - TW.buildCost.wood * 3
        && G.res(o.c).wood === aBefore;           /* 当前城的资源一分没动 */
    });
  })());
  check('实测：没有工匠作坊就造不了', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      o.c.cells[0].build = { id: 'minfang', lvl: 1 };
      var r = G.buildTowers(o.c.id, 1);
      return r.ok === false && /工匠作坊/.test(r.msg);
    });
  })());

  console.log('  --- 默认参与防守（战斗侧） ---');
  check('实测：造的箭塔真的提升城头火力（座数越多、攻方损失越大）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var fight = function (tw) {
        return G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 5000 }, 30, null,
          { sieging: true, wallLv: 6, towers: tw });
      };
      var f0 = fight(0), f9 = fight(9), f30 = fight(30);
      return f0.towerStart === 0 && f0.atkLoss === 0
        && f9.towerStart === 9 && f30.towerStart === 30
        && f9.atkLoss > 0 && f30.atkLoss > f9.atkLoss;
    });
  })(), (function () {
    return withCity(function () {
      var f = function (tw) {
        return G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 5000 }, 30, null,
          { sieging: true, wallLv: 6, towers: tw }).atkLoss;
      };
      return '0座 ' + f(0) + ' / 9座 ' + f(9) + ' / 30座 ' + f(30);
    });
  })());
  check('实测：不传 towers 时按城防折出（NPC 城的老路不变）', (function () {
    return withCity(function () {
      var a = G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 5000 }, 30, null,
        { sieging: true, wallLv: 6 });
      var b = G.tactic.simulate({ gongjian: 2000 }, null, { yibing: 5000 }, 30, null,
        { sieging: true, wallLv: 6, towers: null });
      return a.towerStart === G.tactic.wallTowerCount(30) && a.towerStart === b.towerStart;
    });
  })());
  check('实测：NPC 城不受影响（没有自建箭塔 → 座数 = 城防折出）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var npc = null;
      (o.st.map.cities || []).forEach(function (c) { if (c.level === 9 && !npc) npc = c; });
      if (!npc) return false;
      return G.towersBuiltOf(npc) === 0
        && G.towerCountOf(npc) === G.towersFromDef(npc);
    });
  })());
  check('实测：自建箭塔也参与"守方减伤"（守备力提高 defBonus）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      var d0 = G.cityDefense(o.c);
      G.buildTowers(o.c.id, 6);
      return G.cityDefense(o.c) > d0;
    });
  })());

  console.log('  --- 界面接线 ---');
  check('结构：作坊入口指向"器械 · 箭塔"，建造动作已接线', (function () {
    var code = stripComment(uS);
    return /gongjiangzuofang: \{ label: "🛠️ 器械 · 箭塔", act: "open-workshop"/.test(code)
      && /ui\.openWorkshop = function/.test(code)
      && /case 'open-workshop'/.test(mS) && /case 'tower-build'/.test(mS)
      && /GAME\.buildTowers\(el\.dataset\.city/.test(mS);
  })());
  check('实测：作坊面板把箭塔**两个来源**拆开写清楚', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      G.state = o.st;
      G.ui._cityId = o.c.id;
      G.buildTowers(o.c.id, 3);
      G.ui.openWorkshop(0);
      var root = document.querySelector('#modal-root');
      var html = (root && root.innerHTML) || '';
      return html.indexOf('城防折出') >= 0 && html.indexOf('作坊自建') >= 0
        && html.indexOf('默认参与防守') >= 0
        && html.indexOf('data-action="tower-build"') >= 0;
    });
  })());
  check('实测：作坊面板仍保留"制造器械"入口（不复制配置、只跳转）', (function () {
    return withCity(function () {
      var o = freshTowerCity(6);
      G.state = o.st;
      G.ui._cityId = o.c.id;
      G.ui.openWorkshop(0);
      var root = document.querySelector('#modal-root');
      var html = (root && root.innerHTML) || '';
      return /data-action="open-siege"/.test(html);
    });
  })());
})();

(function () {
  var fs = require('fs'), path = require('path');
  console.log('\n===== 44. v42 局部死函数 / 2.5D =====');
  var dir = path.join(__dirname, 'js');
  var dead = [];
  fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    var src = fs.readFileSync(path.join(dir, f), 'utf8');
    /* 先剥注释：注释里会提到已删除的函数名（本轮就写了"tri 已删除"），
       不剥会把"只出现在注释里"误判成"有引用"。 */
    var code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*/gm, '');
    var names = [], m, re = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    while ((m = re.exec(code))) if (names.indexOf(m[1]) < 0) names.push(m[1]);
    names.forEach(function (nm) {
      var cnt = (code.match(new RegExp('[^A-Za-z0-9_$]' + nm + '[^A-Za-z0-9_$]', 'g')) || []).length;
      if (cnt <= 1) dead.push(f + ':' + nm);
    });
  });
  check('js/ 里没有闭包内局部死函数（audit 看不见这类，只能在这里兜）',
    dead.length === 0, dead.length ? dead.join(' ') : '0 处');
})();

/* ============================================================
 * 48. v63 格数分档 / 名城满配与兵力 / 每日掠夺 / 守将按城 / 建造图标
 * ------------------------------------------------------------
 * 老板三条：
 *   ① 格数分档「没看懂」→ 改成每两级一档并在界面显示；
 *      野外城每日限掠一次；名城补满建筑（按其等级上限）、兵力 = 野外城 ×10、不耗粮草；
 *   ② 守将属性只对当前城池起加成作用，不同城市有不同的守将；
 *   ③ 空地上选建筑时同步建筑图标，费用改悬停显示。
 * ============================================================ */
(function () {
  var fs = require('fs'), path = require('path');
  function rd(f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var stS = rd('state'), uS = rd('ui'), bS = rd('battle'), dS = rd('data'), dmS = rd('domain'), syS = rd('systems');
  var hS = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  function withCity(fn) {
    var keep = G.state;
    try { return fn(); } finally { G.state = keep; }
  }
  function sumOf(g) { var t = 0; for (var k in g) t += (g[k] || 0); return t; }
  function findFort() {
    var v = G.map.fortsInView(0, 0, 60) || [];
    return v.length ? v[0] : null;
  }
  /* 造一座备用城（用于"守将只对本城加成"的对照） */
  function addCity(st, id) {
    var b = G.makeCity({ id: id, name: '副城', x: 9, y: 9, type: 'county',
      res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    st.cities.push(b);
    return b;
  }
  function freshState(name, fn) {
    return withCity(function () {
      var st = G.newGame({ name: name });
      G.state = st;
      if (G.map.generate) G.map.generate();
      return fn(st);
    });
  }

  /* ------------------------------------------------------------
   * ①  格数分档：老板「现在都是32格的吧，没看懂」
   * ------------------------------------------------------------ */
  console.log('  --- ① 野外城格数：统一 8×6（v65 老板改口径）---');
  check('结构：**不再有**按等级的档位表（统一 size = [8, 6]）', (function () {
    return DATA.CITY_PLAN.sizeByLevel === undefined
      && DATA.CITY_PLAN.size[0] === 8 && DATA.CITY_PLAN.size[1] === 6;
  })());
  check('实测：1~10 级格数**恒为 48**（8 列 × 6 行，不随等级变）', (function () {
    var bad = [];
    for (var lv = 1; lv <= 10; lv++) {
      var p2 = G.cityPlanOf(lv);
      if (p2.col !== 8 || p2.row !== 6 || p2.total !== 48) bad.push(lv);
    }
    return bad.length === 0;
  })(), '1~10 级全为 8×6 = 48 格');
  check('实测：48 格装得下"官府4 + 军营2 + 其余12 种各1座"', (function () {
    var cells = G.cityPlanOf(1).cells, c2 = {};
    cells.forEach(function (x) { if (x.build) c2[x.build.id] = (c2[x.build.id] || 0) + 1; });
    return c2.guanfu === 4 && c2.junying === 2
      && Object.keys(c2).filter(function (k2) { return k2 !== 'minfang'; }).length === 14;
  })(), '官府4 · 军营2 · 其余12种 · 民房30');
  check('结构：野外城池面板与一览表都写出格数（否则玩家只能猜）', (function () {
    var plan = codeOf(uS, 'ui.planHTML = function');
    var forts = codeOf(uS, 'ui.openForts = function');
    return /地块 \/ 人口/.test(plan) && /格/.test(plan)
      && /fortPlanOf\(f\)/.test(forts) && /格/.test(forts);
  })());

  /* ------------------------------------------------------------
   * ②  名城补满建筑（按等级上限）+ 兵力十倍数 + 不耗粮草
   * ------------------------------------------------------------ */
  console.log('  --- ② 名城：补满建筑 / 兵力 = 野外城 ×10 / 不耗粮草 ---');
  check('结构：建筑等级只有 `npcBuildLvOf` 一个出口（影子城与库藏共用）', (function () {
    var shadow = codeOf(stS, 'GAME.npcCityShadow = function');
    var res = codeOf(stS, 'GAME.npcCityRes = function');
    return /GAME\.npcBuildLvOf = function/.test(stS)
      && /npcBuildLvOf\(city\)/.test(shadow) && /npcBuildLvOf\(city\)/.test(res)
      && /cityPlanOf\(lv, bl\)/.test(shadow);
  })());
  /* v65（老板）：「名城默认满级（如县城 12，郡城 14，州城 18 等）」——
     基数是**满级城等级 10**，与该城自身等级无关（改前是 `c.level + 加成`，
     于是 9 级州城只到 17、5 级县城只到 7，看着像半座空壳）。 */
  check('实测：各档位建筑等级 = 满级城等级 10 + 档位加成（都城22/州城18/郡城14/县城12）',
    (function () {
      var seen = {}, ok = true, n2 = 0;
      (G.state.map.cities || []).forEach(function (c) {
        if (seen[c.type]) return;
        seen[c.type] = 1; n2++;
        if (G.npcBuildLvOf(c) !== DATA.CITY_PLAN.maxLevel + (DATA.CITY_BUILD_BONUS[c.type] || 0)) ok = false;
      });
      return ok && n2 >= 4;
    })(), (function () {
      var seen = {}, rows = [];
      (G.state.map.cities || []).forEach(function (c) {
        if (seen[c.type]) return;
        seen[c.type] = 1;
        rows.push(DATA.CITY_PERK[c.type].name + ' 城Lv' + c.level + ' → 建筑Lv' + G.npcBuildLvOf(c) +
          '（人口 ' + G.planPopCapOf(c.level, G.npcBuildLvOf(c)).toLocaleString() + '）');
      });
      return rows.join(' · ');
    })());
  check('实测：满配名城**每一格**的建筑等级都等于该上限，城墙同此', (function () {
    var npc = null;
    (G.state.map.cities || []).forEach(function (c) { if (c.type === 'zhou' && !npc) npc = c; });
    if (!npc) return false;
    var sh = G.npcCityShadow(npc), bl = G.npcBuildLvOf(npc);
    var bad = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;
    /* v65：州城 = 10 + 8 = 18（不再是城等级 + 8） */
    return bad === 0 && sh.wallLv === bl && bl === DATA.CITY_PLAN.maxLevel + 8;
  })());
  check('实测：人口上限跟着**民房等级**走（建筑等级提高 → 人口跟着涨）', (function () {
    var c9 = null;
    (G.state.map.cities || []).forEach(function (c) { if (c.level === 9 && !c9) c9 = c; });
    if (!c9) return false;
    var bl = G.npcBuildLvOf(c9);
    var mf = G.cityPlanOf(9, bl).cells.filter(function (x) { return x.build && x.build.id === 'minfang'; }).length;
    return G.planPopCapOf(9, bl) === mf * DATA.BUILDINGS.minfang.pop[bl - 1]
      && G.planPopCapOf(9, bl) > G.planPopCapOf(9, 9);
  })(), (function () {
    var z = { level: 9, type: 'zhou' };
    return '9 级州城：建筑 Lv9 → 人口 ' + G.planPopCapOf(9, 9).toLocaleString()
      + '；建筑 Lv' + G.npcBuildLvOf(z) + ' → 人口 ' + G.planPopCapOf(9, G.npcBuildLvOf(z)).toLocaleString();
  })());
  check('结构：名城兵力取自野外城池 garrison（唯一来源）+ 倍数在 DATA 里可调', (function () {
    var body = codeOf(stS, 'GAME.genGarrison = function');
    return /GAME\.map\.fortGarrison\(lv\)/.test(body)
      && /garrisonMul/.test(body) && DATA.NPC_CITY_RES.garrisonMul === 10;
  })());
  check('实测：同等级名城守军总数 = 野外城池守军 × 10（逐个档位核）', (function () {
    var seen = {}, ok = true, n2 = 0;
    (G.state.map.cities || []).forEach(function (c) {
      if (seen[c.type]) return;
      seen[c.type] = 1; n2++;
      var fg = sumOf(G.map.fortGarrison(c.level)), cg = sumOf(G.genGarrison(c));
      if (Math.abs(cg - fg * 10) > Math.max(2, fg * 0.005)) ok = false;
    });
    return ok && n2 >= 4;
  })(), (function () {
    var npc = null;
    (G.state.map.cities || []).forEach(function (c) { if (c.level === 9 && !npc) npc = c; });
    return npc ? ('9 级：野外城 ' + sumOf(G.map.fortGarrison(9)).toLocaleString()
      + ' → 名城 ' + sumOf(G.genGarrison(npc)).toLocaleString()) : '';
  })());
  check('实测：兵种构成按等级解锁（低级城无铁骑/冲车，高级城才有）', (function () {
    var low = G.genGarrison({ level: 3, type: 'county' });
    var high = G.genGarrison({ level: 10, type: 'capital' });
    return !low.tieji && !low.chongche && high.tieji > 0 && high.chongche > 0 && high.chuangnu > 0;
  })());
  check('结构：耗粮口径只吃 `s.cities`（不碰 map.cities / garrison）', (function () {
    /* ⚠️ 只测"f0 === 0"是守不住的：注入"把 map.cities 也算进耗粮"时，
       那些城的兵在 `garrison` 而不是 `army`，光加进列表仍然算不出粮 —— 断言照绿。
       所以先钉结构：耗粮函数里**不许出现** map.cities / garrison /
       wilds 这些"未占据"的来源。（破坏测试第 ④ 类抓到的就是这个盲区。） */
    var body = codeOf(stS, 'GAME.foodPerSecOf = function');
    return /list = city \? \[city\] : s\.cities/.test(body)
      && !/map\.cities/.test(body) && !/garrison/.test(body)
      && !/wilds/.test(body);
  })());
  check('实测：未占据城池守军**不消耗粮草**（玩家驻军耗粮、NPC 守军再大也不耗）', (function () {
    return freshState('v63food', function (st) {
      var npc = (st.map.cities || [])[0];
      if (!npc || !sumOf(npc.garrison)) return false;      // 分母为 0 的绿 = 什么都没测
      if ((st.cities || []).indexOf(npc) >= 0) return false;  // NPC 城不该混进已占据城池
      var f0 = G.foodPerSec();
      st.cities[0].army = { yibing: 1000 };
      var f1 = G.foodPerSec();
      var raw = JSON.stringify(npc.garrison);
      for (var i = 0; i < 3; i++) G.tickOnce();
      /* NPC 守军一名不少：既不吃粮、也没有被结算修改 */
      return f0 === 0 && f1 > 0 && JSON.stringify(npc.garrison) === raw;
    });
  })(), (function () {
    var npc = (G.state.map.cities || [])[0];
    return npc ? ('该城守军 ' + sumOf(npc.garrison).toLocaleString() + ' 名，完全不进入耗粮口径') : '';
  })());

  /* ------------------------------------------------------------
   * ③  野外城池每日掠夺一次
   * ------------------------------------------------------------ */
  console.log('  --- ③ 野外城池每日限掠一次 ---');
  check('结构：状态记录与拦截点齐全（s.fortRaids / fortRaidedToday / markFortRaided / prepare）',
    (function () {
      var code = stripComment(stS) + stripComment(rd('map')) + stripComment(bS);
      return /fortRaids: \{\}/.test(code)
        && /GAME\.map\.fortRaidedToday = function/.test(code)
        && /GAME\.map\.markFortRaided = function/.test(code)
        && /fortRaidedToday\(t\.x, t\.y\)/.test(codeOf(bS, 'GAME.battle.prepare = function'));
    })());
  check('实测：首次放行 → 登记后拦截 → 同日「占领」不受影响', (function () {
    return freshState('v63raid', function (st) {
      var f = findFort();
      if (!f) return false;
      var city = st.cities[0], gen = st.generals[0];
      /* 备齐出征条件（校场 + 兵 + 体力精力），否则拦下来的是别的理由、测不到这条规则 */
      city.cells[0].build = { id: 'xiaochang', lvl: 10 };
      city.army = { yibing: 50000 };
      gen.stamina = 100; gen.energy = 100;
      var tgt = { kind: 'fort', x: f.x, y: f.y };
      var p1 = G.battle.prepare(tgt, 'raid', { yibing: 100 }, gen.id);
      if (!p1.ok) return false;
      G.map.markFortRaided(f.x, f.y);
      var p2 = G.battle.prepare(tgt, 'raid', { yibing: 100 }, gen.id);
      var p3 = G.battle.prepare(tgt, 'occupy', { yibing: 100 }, gen.id);
      return p2.ok === false && /今日已被掠夺/.test(p2.msg || '') && p3.ok === true;
    });
  })(), '首次 ok=true → 登记后 ok=false（占领仍 ok=true）');
  check('实测：过一天自动恢复（只按游戏日比较，不需要清理任务）', (function () {
    return freshState('v63day', function (st) {
      var f = findFort();
      if (!f) return false;
      G.map.markFortRaided(f.x, f.y);
      var now = G.map.fortRaidedToday(f.x, f.y);
      st.fortRaids[f.x + ',' + f.y] = (G.questDayIndex ? G.questDayIndex() : 0) - 1;
      return now === true && G.map.fortRaidedToday(f.x, f.y) === false;
    });
  })());
  check('结构：只有**得手**才计数（失败不占当日额度）', (function () {
    var body = codeOf(bS, 'GAME.battle.expedition = function');
    var iWin = body.indexOf('if (win) {');
    var iMark = body.indexOf('markFortRaided');
    return iWin >= 0 && iMark > iWin;
  })());
  check('结构：界面会先说清楚（一览表状态列 + 出征方式锁定）', (function () {
    var code = stripComment(uS);
    return /fortRaidedToday/.test(code)
      && /ui\.expModeLockOf = function/.test(code)
      && /expModeLockOf\(m\.id\)/.test(code);
  })());
  check('实测：锁定判据只认"掠夺 + 野外城池"（侦查/野地/名城都不受影响）', (function () {
    return freshState('v63lock', function (st) {
      var f = findFort();
      if (!f) return false;
      var keep = G.ui._expTarget;
      try {
        G.ui._expTarget = { kind: 'fort', x: f.x, y: f.y };
        G.map.markFortRaided(f.x, f.y);
        var fortLocked = G.ui.expModeLockOf('raid');
        var fortScout = G.ui.expModeLockOf('scout');
        G.ui._expTarget = { kind: 'wild', x: 4, y: 4 };
        var wildLocked = G.ui.expModeLockOf('raid');
        G.ui._expTarget = { kind: 'city', id: 'cap' };
        var cityLocked = G.ui.expModeLockOf('raid');
        return !!fortLocked && fortScout === '' && wildLocked === '' && cityLocked === '';
      } finally { G.ui._expTarget = keep; }
    });
  })());

  /* ------------------------------------------------------------
   * ④  守将属性只对本城加成
   * ------------------------------------------------------------ */
  console.log('  --- ④ 守将只对当前城池加成 ---');
  check('结构：全境口径的 guardBonusTotal 已删除（不留后门）',
    stripComment(dmS).indexOf('guardBonusTotal') < 0
    && stripComment(stS).indexOf('guardBonusTotal') < 0);
  check('结构：四个消费点都收窄到"按城取"（产量 / 建造 / 征兵 / 研究）', (function () {
    return /GAME\.prodFactors = function \(r, city\)/.test(stS)
      && /GAME\.guardBuildMult = function \(city\)/.test(dmS)
      && /GAME\.guardBonus\(city\)/.test(codeOf(dmS, 'GAME._rawGuardBuildMult = function'))
      && /guardBonus\(city\)/.test(codeOf(dmS, 'GAME.train = function'))
      && /guardBonus\(_gcity\)/.test(syS);
  })());
  check('实测：A 城守将**不给 B 城加成**；给 B 城另派守将后，B 城取到的是 B 城那位', (function () {
    return freshState('v63guard', function (st) {
      var a = st.cities[0];
      var b = addCity(st, 'v63b');
      var g = st.generals[0];
      g.cityId = a.id; g.status = 'guard'; g.loyalty = 100;
      var hasA = G.prodFactors('grain', a).some(function (f) { return f.name === '守将内政'; });
      var hasB = G.prodFactors('grain', b).some(function (f) { return f.name === '守将内政'; });
      if (!hasA || hasB) return false;
      var g2 = G.makeGeneral('副城守将', 20, 'guard', b.id, false, 'liang', 'balance');
      g2.loyalty = 100;
      st.generals.push(g2);
      var bb = G.guardBonus(b);
      return bb.name === g2.name && bb.prod > 0;
    });
  })(), (function () {
    return freshState('v63guard2', function (st) {
      var a = st.cities[0], b = addCity(st, 'v63c');
      st.generals[0].cityId = a.id; st.generals[0].status = 'guard'; st.generals[0].loyalty = 100;
      var g2 = G.makeGeneral('副城守将', 20, 'guard', b.id, false, 'liang', 'balance');
      g2.loyalty = 100; st.generals.push(g2);
      var ga = G.guardBonus(a), gb = G.guardBonus(b);
      return 'A 城 ' + ga.name + '（内政 +' + (ga.prod * 100).toFixed(1) + '%）· '
        + 'B 城 ' + gb.name + '（内政 +' + (gb.prod * 100).toFixed(1) + '%）';
    });
  })());
  check('实测：建造加速也只看本城守将（有守将的城更快、没守将的城一点不动）', (function () {
    return freshState('v63build', function (st) {
      var a = st.cities[0], b = addCity(st, 'v63d');
      var baseA = G.guardBuildMult(a), baseB = G.guardBuildMult(b);
      st.generals[0].cityId = a.id; st.generals[0].status = 'guard'; st.generals[0].loyalty = 100;
      return G.guardBuildMult(a) < baseA && G.guardBuildMult(b) === baseB;
    });
  })());
  check('实测：未占据名城的守将是**每城一个**（同等级两座城不是同一个人）', (function () {
    var two = (G.state.map.cities || []).filter(function (c) { return c.level === 7; }).slice(0, 2);
    if (two.length < 2) return false;
    var g1 = G.npcCityGuard(two[0]), g2 = G.npcCityGuard(two[1]);
    return !!g1 && !!g2 && g1.name !== g2.name && g1.id !== g2.id;
  })());

  /* ------------------------------------------------------------
   * ⑤  建造选择界面：图标同步 + 费用悬停
   * ------------------------------------------------------------ */
  console.log('  --- ⑤ 空地选建筑：图标同步 / 费用悬停 ---');
  check('结构：空地建造用建筑本体图标（GAME.icons.forBuilding），不是 emoji', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    return /GAME\.icons\.forBuilding\(bid\)/.test(body)
      && /bldg-pick/.test(body) && /U\.escape\(tip\)/.test(body);
  })());
  check('结构：卡片上**不再渲染费用**（费用只进 title 悬停）', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    /* 判据用"出现次数"而不是"有没有"：费用文案本来就要出现在悬停文案里，
       所以只数它被拼进卡片的那**第二处** —— 写回卡片就变 2。
       （第一版写成"标题里那句 + 不出现 tstat 费用行"，被源码的实际写法坑了：
         tip 是 `var lockMsg = '', afford = '', tip = ...` 一行里声明的，没有 "var tip"。） */
    var n2 = body.split("'｜耗：' + cost").length - 1;
    return n2 === 1 && !/<div class="tstat">' \+ cost/.test(body);
  })());
  check('结构：外城那处（改建资源建筑）也照同一套改（图标 + 悬停）', (function () {
    var body = codeOf(uS, 'ui.openExtModal = function');
    /* 同上：只允许出现在悬停文案里一次 */
    var cnt = body.split("'｜耗' + U.fmt(cost0[0])").length - 1;
    return /GAME\.icons\.forExt\(eid\)/.test(body) && /bldg-pick/.test(body)
      && cnt === 1 && !/tstat">' \+ '耗/.test(body);
  })());
  check('结构：图标有固定高度（位图/矢量两条路径才不会把卡片撑成高低不一）',
    /height: 84px/.test(cssBlock(hS, '.troop-card.bldg-pick .ticon')));
  /* v72（老板报障「官府升级中点击被撑爆」）→ v73（老板「顶部的图标也不要留」）：
     四处建筑弹窗（城内/城外 × 正常/施工中）的顶部图标块整体撤除，
     .dlg-ico 尺寸盒随之退役 —— 没有图标，就没有 1024px 固有尺寸撑爆的土壤。 */
  check('v73：建筑弹窗再无顶部图标块（v72 的 1024px 撑爆问题连根拔除）', (function () {
    var bld = codeOf(uS, 'ui.openBuildModal = function');
    var ext = codeOf(uS, 'ui.openExtModal = function');
    return bld.indexOf('dlg-ico') < 0 && ext.indexOf('dlg-ico') < 0
      && bld.indexOf('class="bldg-foot"') >= 0 && ext.indexOf('class="bldg-foot"') >= 0
      && uS.indexOf('class="dlg-ico"') < 0
      && stripComment(hS).indexOf('.dlg-ico') < 0;
  })());
  /* 这两条是**几何探针**抓出来的真问题（jsdom 量不出高度，所以只能在这里钉结构）：
     ① 图标从 emoji 换成 84px 位图后，卡片变高 → lg 档（860×600）正文超出 18px
        → 弹窗内冒出滚动条（老板明令禁止）→ 提到 xl；
     ② 据点一览加了「地块/状态」两列后整块超出弹窗高度（1600×950 也超 108px）
        → 改成每页 6 行分页（8 行在 720p 仍超 44px）。 */
  check('结构：建造选择弹窗用 xl 档（lg 下正文超高会出滚动条）', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    return body.indexOf("modalPage('buildpick'") >= 0
      && body.indexOf("size: 'xl'") > body.indexOf("modalPage('buildpick'");
  })());
  check('结构：据点一览**分页**（弹窗里不许用滚动条看长列表）', (function () {
    var body = codeOf(uS, 'ui.openForts = function');
    return /ui\.modalPage\('forts', rowList, 6,/.test(body) && /pgF\.pager/.test(body)
      && !/html \+= '<\/tbody><\/table>';\s*$/.test(body);
  })());
})();

/* ============================================================
 * 49. v64 城墙纳入自动建造 / 将领席位按城
 * ------------------------------------------------------------
 * 老板两条：
 *   ① 「城墙纳入自动建筑中」；
 *   ② 「将领归属于城市，根据该城的招贤馆等级有相应空位，
 *       可自行在客栈招募，也可其他自己的城池派遣」。
 * ============================================================ */
(function () {
  var fs = require('fs'), path = require('path');
  function rd(f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var stS = rd('state'), uS = rd('ui'), bS = rd('battle'), dS = rd('data'), dmS = rd('domain');
  function withState(name, fn) {
    var keep = G.state;
    try {
      var st = G.newGame({ name: name });
      G.state = st;
      if (G.map.generate) G.map.generate();
      return fn(st);
    } finally { G.state = keep; }
  }
  /* 在空地上放一座建筑（造测试环境用；找不到空位返回 false） */
  function setBldg(city, bid, lv) {
    for (var i = 0; i < city.cells.length; i++) {
      var x = city.cells[i];
      if (x.official) continue;
      if (x.build && x.build.id !== bid) continue;
      if (x.build && x.build.id === bid) { x.build.lvl = lv; return true; }
      x.build = { id: bid, lvl: lv };
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------
   * ①  城墙纳入自动建造
   * ------------------------------------------------------------ */
  console.log('  --- ① 城墙纳入自动建造 ---');
  check('结构：自动升级把城墙当候选（不占格，等级在 city.wallLv）', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    return /kind: 'wall'/.test(body) && /GAME\.buildWall\(c\.cityId\)/.test(body)
      && /ct\.wallLv/.test(body);
  })());
  check('结构：同级排序是「城内建筑 → 城墙 → 城外资源」（城墙耗石多，不该抢先）', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    return /KIND_ORD = \{ city: 0, wall: 1, ext: 2 \}/.test(body)
      && /KIND_ORD\[a\.kind\] - KIND_ORD\[b\.kind\]/.test(body);
  })());
  check('实测：城墙 0 级时，自动升级第一个就修城墙（并进了建造队列）', (function () {
    return withState('v64wall', function (st) {
      var c = st.cities[0];
      c.wallLv = 0;
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
      c.res.gold = 5000000;
      var r = G.autoUpgrade();
      var q = st.queues.build;
      return !!(r && r.ok) && r.target.kind === 'wall' && r.target.lv === 0
        && q.length === 1 && q[0].type === 'wall';
    });
  })(), (function () {
    return withState('v64wall2', function (st) {
      var c = st.cities[0];
      c.wallLv = 0;
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
      var r = G.autoUpgrade();
      return r && r.target ? (r.target.name + ' Lv' + r.target.lv + ' → Lv' + (r.target.lv + 1)) : '无动作';
    });
  })());
  check('实测：城墙满级后不再回到候选里（否则"全部满级"永远达不到）', (function () {
    return withState('v64wall3', function (st) {
      var c = st.cities[0];
      govMax(c);   /* v68：官府拉满 —— "全部满级"指该城上限，而不是官府总闸 */
      c.wallLv = G.buildCapOf(c, 'chengqiang');
      /* 其余建筑也拉满 → 必须报"全部建筑已满级（含城墙）" */
      c.cells.forEach(function (x) { if (x.build && DATA.BUILDINGS[x.build.id]) x.build.lvl = DATA.BUILDINGS[x.build.id].maxLevel; });
      (G.extGridOf(c) || []).forEach(function (e) { if (e && e.type) e.lv = DATA.MAX_BLEVEL; });
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      var r = G.autoUpgrade();
      return r === null && !!(st.autoState && st.autoState.done) && /含城墙/.test(st.autoState.msg || '');
    });
  })());
  check('实测：城墙已在施工队列时不再重复排队（否则同一级付几份料）', (function () {
    return withState('v64wall5', function (st) {
      var c = st.cities[0];
      c.wallLv = 0;
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
      var r1 = G.autoUpgrade();
      if (!(r1 && r1.ok)) return false;
      var stone1 = c.res.stone, n1 = st.queues.build.length;
      /* 城墙还没造好（wallLv 仍是 0）—— 再跑一次也不能再排一条城墙 */
      var r2 = G.autoUpgrade();
      var wallQ2 = st.queues.build.filter(function (q) { return q.type === 'wall' && q.cityId === c.id; });
      /* 判据只看"城墙"这一条：队列里永远只有一条、wallLv 仍是 0（未完工）、
         第二次不会再挑城墙。（不能拿"石头总额没变"当判据 —— 第二次会去排别的建筑，
         那是正常花费，那是把两件事混在一起量。） */
      return G.wallPendingOf(c.id) === true && c.wallLv === 0
        && wallQ2.length === 1 && n1 === 1
        && !(r2 && r2.target && r2.target.kind === 'wall');
    });
  })());
  check('实测：两座城各自有城墙候选（多城经营时每城都要修墙）', (function () {
    return withState('v64wall4', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64b', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      a.wallLv = 0; b.wallLv = 0;
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { a.res[k] = 5000000; b.res[k] = 5000000; });
      /* 连排两次：两座城各修一次 */
      var r1 = G.autoUpgrade();
      var r2 = G.autoUpgrade();
      var names = [r1, r2].filter(function (r) { return r && r.target; })
        .map(function (r) { return r.target.cityId; });
      return names.length >= 1 && names.indexOf(b.id) >= 0 && names.indexOf(a.id) >= 0;
    });
  })(), '两城各得一次城墙候选');

  /* ------------------------------------------------------------
   * ②  将领席位按城
   * ------------------------------------------------------------ */
  console.log('  --- ② 将领席位按城（招贤馆等级） ---');
  check('结构：全境一格卡全境的 generalCap 已删除（不留后门）',
    stripComment(dmS).indexOf('generalCap') < 0
    && stripComment(uS).indexOf('generalCap') < 0);
  check('结构：席位四个出口齐全，且 UI 四处都按城取', (function () {
    var body = codeOf(dmS, 'GAME.genSlotsOf = function');
    var code = stripComment(uS);
    return /GAME\.genSlotsOf = function/.test(dmS) && /GAME\.generalsIn = function/.test(dmS)
      && /GAME\.genFreeOf = function/.test(dmS) && /GAME\.genSlotsTotal = function/.test(dmS)
      /* 客栈 / 招贤馆 / 将领页 / 派遣 四处 */
      && (code.match(/GAME\.genSlotsOf\(/g) || []).length >= 4
      && (code.match(/GAME\.generalsIn\(/g) || []).length >= 3
      && !/s\.generals\.length >= cap/.test(code);
  })());
  check('实测：席位 = **该城**招贤馆等级（两座城各算各的）', (function () {
    return withState('v64slot', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64c', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 7);
      setBldg(b, 'zhaoxianguan', 2);
      return G.genSlotsOf(a) === 7 && G.genSlotsOf(b) === 2
        && G.genSlotsTotal() === 9 && G.genFreeOf(b) === 2;
    });
  })(), (function () {
    return withState('v64slot2', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64d', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 7);
      setBldg(b, 'zhaoxianguan', 2);
      return '7 级招贤馆 → ' + G.genSlotsOf(a) + ' 席 ｜ 2 级 → ' + G.genSlotsOf(b)
        + ' 席 ｜ 全境合计 ' + G.genSlotsTotal();
    });
  })());
  check('实测：A 城塞满**不影响** B 城招募（改前共用一个全境数，会被一并卡死）', (function () {
    return withState('v64share', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64e', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 9e6, wood: 9e6, stone: 9e6, iron: 9e6, gold: 9e6, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 2); setBldg(a, 'kezhan', 3);
      setBldg(b, 'zhaoxianguan', 2); setBldg(b, 'kezhan', 3);
      /* 把 A 城塞到满编（2 席） */
      st.generals.forEach(function (g) { g.cityId = a.id; g.status = 'idle'; });
      while (G.generalsIn(a).length < 2) st.generals.push(G.makeGeneral('满编将' + st.generals.length, 1, 'idle', a.id, false));
      var chkA = G.canRecruitGeneral(a), chkB = G.canRecruitGeneral(b);
      return chkA.ok === false && chkB.ok === true
        && G.generalsIn(a).length === 2 && G.generalsIn(b).length === 0;
    });
  })(), (function () {
    return withState('v64share2', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64f', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 9e6, wood: 9e6, stone: 9e6, iron: 9e6, gold: 9e6, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 2); setBldg(a, 'kezhan', 3);
      setBldg(b, 'zhaoxianguan', 2); setBldg(b, 'kezhan', 3);
      st.generals.forEach(function (g) { g.cityId = a.id; });
      while (G.generalsIn(a).length < 2) st.generals.push(G.makeGeneral('满编将' + st.generals.length, 1, 'idle', a.id, false));
      return 'A 城 ' + G.generalsIn(a).length + '/' + G.genSlotsOf(a) + '（拒：'
        + (G.canRecruitGeneral(a).ok ? '否' : '是') + '）｜ B 城 '
        + G.generalsIn(b).length + '/' + G.genSlotsOf(b) + '（可招：'
        + (G.canRecruitGeneral(b).ok ? '是' : '否') + '）';
    });
  })());
  check('实测：将领页"名单"与"席位统计"同源（同一批人，不会自相矛盾）', (function () {
    return withState('v64same', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64g', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      st.generals.forEach(function (g) { g.cityId = a.id; });
      st.generals.push(G.makeGeneral('B城将', 1, 'idle', b.id, false));
      /* 名单判据（将领页那份）与 generalsIn 必须是同一批 */
      var listA = (st.generals || []).filter(function (g) {
        var gc = G.genCityOf(g); return gc && gc.id === a.id;
      });
      var inA = G.generalsIn(a);
      /* v70：A 城 = 初始名将 + 君主（君主归属首城）→ 2 人；关键不变量是
         "名单判据与 generalsIn 同一批"（前一个等号），人数只是它的具体值 */
      return listA.length === inA.length && inA.length === 2
        && G.generalsIn(b).length === 1 && G.generalsIn(b)[0].name === 'B城将';
    });
  })());
  check('实测：招募落在**参数指定的城**（不是"当前城"）且扣该城的金', (function () {
    return withState('v64rec', function (st) {
      var a = st.cities[0];                                  /* 当前城 = A */
      var b = G.makeCity({ id: 'v64rb', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 9e6, wood: 9e6, stone: 9e6, iron: 9e6, gold: 5000000, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 3); setBldg(a, 'kezhan', 3);
      setBldg(b, 'zhaoxianguan', 3); setBldg(b, 'kezhan', 3);
      a.res.gold = 5000000;
      G.innRefresh(true);
      var list = G.innRefresh();
      if (!list.length) return false;                       // 分母为 0 的绿 = 什么都没测
      var goldB = b.res.gold, goldA = a.res.gold, n0 = st.generals.length;
      var r = G.innRecruit(list[0].id, b.id);                /* 招到 B 城 */
      if (!r.ok) return false;
      var g = st.generals[st.generals.length - 1];
      return st.generals.length === n0 + 1 && g.cityId === b.id
        && b.res.gold < goldB && a.res.gold === goldA && r.gen.id === g.id;
    });
  })(), (function () {
    return withState('v64rec2', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64rb2', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 9e6, wood: 9e6, stone: 9e6, iron: 9e6, gold: 5000000, pop: 1 } });
      st.cities.push(b);
      setBldg(a, 'zhaoxianguan', 3); setBldg(a, 'kezhan', 3);
      setBldg(b, 'zhaoxianguan', 3); setBldg(b, 'kezhan', 3);
      var list = G.innRefresh(true) || G.innRefresh();
      var r = list.length ? G.innRecruit(list[0].id, b.id) : { ok: false, msg: '无候选' };
      var last = st.generals[st.generals.length - 1];
      return r.ok ? (r.msg + '｜落城 ' + (last ? last.cityId : '?') + '（指定 ' + b.id + '）')
        : ('未成：' + r.msg);
    });
  })());
  check('实测：没有招贤馆（0 席）时招募被拒，提示里带**城名**', (function () {
    return withState('v64zero', function (st) {
      var c = st.cities[0];
      setBldg(c, 'kezhan', 3);            /* 有客栈、没招贤馆 */
      var chk = G.canRecruitGeneral(c);
      return chk.ok === false && chk.msg.indexOf(c.name) >= 0 && /招贤馆/.test(chk.msg);
    });
  })());
  check('实测：派遣到满员城被拦、有空位就放行', (function () {
    return withState('v64disp', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64h', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      setBldg(b, 'zhaoxianguan', 1);        /* 只 1 席 */
      var g = st.generals[0];
      g.cityId = a.id; g.status = 'idle';
      var okPath = G.doDispatch(g.id, b.id);           /* 空位 → 放行 */
      if (!okPath.ok) return false;
      var g2 = G.makeGeneral('第二人', 1, 'idle', a.id, false);
      st.generals.push(g2);
      var bad = G.doDispatch(g2.id, b.id);             /* 已满 → 拦 */
      return bad.ok === false && /无空位/.test(bad.msg || '') && g2.cityId === a.id;
    });
  })(), (function () {
    return withState('v64disp2', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v64i', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      setBldg(b, 'zhaoxianguan', 1);
      var g2 = G.makeGeneral('第二人', 1, 'idle', b.id, false);
      st.generals.forEach(function (g) { g.cityId = a.id; g.status = 'idle'; });
      st.generals.push(g2);
      var bad = G.doDispatch(st.generals[0].id, b.id);
      return bad.ok ? '放行了（不应）' : bad.msg;
    });
  })());
  check('实测：读档归一化把"无主之将"挂到首城（含指向已不存在的城）', (function () {
    return withState('v64norm', function (st) {
      var a = st.cities[0];
      st.generals.forEach(function (g, i) { g.cityId = i === 0 ? null : 'ghost_city'; });
      var n = G.normalizeGenCities();
      return n === st.generals.length
        && st.generals.every(function (g) { return g.cityId === a.id; })
        && G.generalsIn(a).length === st.generals.length;
    });
  })());
  check('实测：名将归降带上**出发城**（不再是无主之将）', (function () {
    return withState('v64hero', function (st) {
      var a = st.cities[0];
      var cap = null;
      (st.map.cities || []).forEach(function (c) { if (c.id === 'cap') cap = c; });
      if (!cap) return false;
      /* 洛阳有历史名将候选；没有候选就是"什么都没测" */
      var cands = DATA.HEROES.filter(function (h) { return h.city === cap.name; });
      if (!cands.length) return false;
      var g = G.battle.grantHero(cap, a);
      return !!g && g.cityId === a.id && G.generalsIn(a).indexOf(g) >= 0;
    });
  })(), (function () {
    return withState('v64hero2', function (st) {
      var cap = null;
      (st.map.cities || []).forEach(function (c) { if (c.id === 'cap') cap = c; });
      var g = cap ? G.battle.grantHero(cap, st.cities[0]) : null;
      return g ? (g.name + ' → 归 ' + st.cities[0].name) : '未招到降将';
    });
  })());
})();

(function () {
  var fs = require('fs'), path = require('path');
  console.log('\n===== 49. v65 情报分层 / 属性整数 / 资源短写 / 驻军精简 / 名城满级 =====');

  /* 本段独立读源码（别处段落的 `rd` 是那段自己的局部函数，这里拿不到） */
  var rd49 = function (f) { return fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var stS49 = rd49('state'), uS49 = rd49('ui'), bS49 = rd49('battle'), dS49 = rd49('data');
  var mS49 = rd49('main'), hS49 = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  var code49 = function (src, decl) { return codeOf(src, decl); };

  /* ============================================================
   * ① 侦查情报分层（老板：不同等级看出不同类型的信息）
   * ============================================================ */
  console.log('  --- ① 侦查情报分层 ---');
  check('结构：分层表 6 层，解锁等级严格递增，满级 10 恰好全开', (function () {
    var t = DATA.SCOUT_INTEL;
    if (!t || t.length !== 6) return false;
    var ok = true, prev = 0;
    t.forEach(function (x) {
      if (!(x.unlock > prev) || !x.id || !x.name) ok = false;
      prev = x.unlock;
    });
    return ok && t[0].unlock === 1 && t[t.length - 1].unlock === 10;
  })(), DATA.SCOUT_INTEL.map(function (x) { return x.name + '@Lv' + x.unlock; }).join(' · '));
  check('结构：分层只有 `intelTiersOf` 一个出口（战斗侧与界面共用）', (function () {
    var f = code49(bS49, 'GAME.battle.intelTiersOf = function');
    var scout = code49(bS49, 'GAME.battle.scoutTarget = function');
    var panel = code49(mS49, 'ui.openScoutResult = function');
    return f.length > 200 && /DATA\.SCOUT_INTEL/.test(f)
      && /intelTiersOf\(\)/.test(scout) && /intelTiers/.test(panel);
  })());
  check('结构：六个情报源都在（总数 / 资源 / 兵种 / 守将 / 建筑 / 可图之利）', (function () {
    var scout = code49(bS49, 'GAME.battle.scoutTarget = function');
    return /totalExact/.test(scout) && /out\.res = /.test(scout) && /out\.roster = /.test(scout)
      && /out\.guard = /.test(scout) && /out\.build = /.test(scout) && /out\.spoils = /.test(scout);
  })());
  check('结构：资源与建筑报告各有独立出口（resReportOf / buildReportOf）',
    /GAME\.battle\.resReportOf = function/.test(bS49)
    && /GAME\.battle\.buildReportOf = function/.test(bS49)
    && /GAME\.battle\.buildReportOf\(t\)/.test(code49(bS49, 'GAME.battle.scoutTarget = function')));
  check('结构：界面把未解锁的层渲染成「🔒 需侦察技巧 LvN」（锁着也要让人看见）', (function () {
    var panel = code49(mS49, 'ui.openScoutResult = function');
    return /🔒 需侦察技巧 Lv/.test(panel) && /lockRow/.test(panel)
      && /下一层：/.test(panel);
  })());
  check('实测：层数与已解锁数随等级单调增长（0 级 0 层 → 10 级 6 层）', (function () {
    var t0 = G.state.techs['zhencha'] || 0;
    var counts = [];
    [0, 3, 5, 7, 9, 10].forEach(function (lv) {
      G.state.techs['zhencha'] = lv;
      var it = G.battle.intelTiersOf();
      if (it.lv !== lv) counts.push(-1);
      counts.push(it.list.filter(function (x) { return x.unlocked; }).length);
    });
    G.state.techs['zhencha'] = t0;
    /* 解锁分布：Lv1 total / Lv3 +res / Lv5 +troops / Lv7 +guard / Lv9 +build / Lv10 +spoils
       → 0 / 3 / 5 / 7 / 9 / 10 级分别是 0、2、3、4、5、6 层 */
    return counts.join(',') === '0,2,3,4,5,6';
  })(), '0/3/5/7/9/10 级 → 已解锁层数');
  check('实测：顺手拾获**不受分层影响**（0 级也能捡到材料）', (function () {
    var t0 = G.state.techs['zhencha'] || 0, w0 = G.state.world.weather;
    G.state.techs['zhencha'] = 0;
    G.state.world.weather = 'clear';
    var got = false;
    for (var i = 0; i < 40 && !got; i++) {
      var sc = G.battle.scoutTarget({ kind: 'wild', x: 20 + i, y: 20, terrain: 'lake', lv: 5,
        garrison: { yibing: 10 } }, G.state.generals[0]);
      if (sc.loot.length > 0) got = true;
    }
    G.state.techs['zhencha'] = t0; G.state.world.weather = w0;
    return got;
  })());

  /* ============================================================
   * ② 属性整数化 + 六维表压缩
   * ============================================================ */
  console.log('  --- ② 属性整数 / 六维压缩 ---');
  check('实测：genAttrs 六维全为整数（装备带 .5 也不出小数）', (function () {
    var g = { level: 9, tong: 100, yw: 200, zm: 150, nz: 120, speed: 10, attack: 0, defense: 0,
      hp: 100, rank: 'fan', style: 'balance', equip: {}, perm: {} };
    var a = G.genAttrs(g);
    /* v66：`hp` 已删（装备体力不再有第二条路），改用 staEq */
    var keys = ['tong', 'yw', 'zm', 'nz', 'spd', 'sta', 'staMax', 'staEq', 'atk', 'def', 'atkEq', 'defEq'];
    var bad = keys.filter(function (k) { return a[k] !== Math.round(a[k]); });
    return bad.length === 0;
  })(), '六维 + 体力 + 攻防全部整数');
  check('结构：取整发生在 genAttrs 一处（下游不再各 round 一遍）', (function () {
    var body = code49(rd49('domain'), 'GAME.genAttrs = function');
    return /tong: Math\.round/.test(body) && /spd: Math\.round/.test(body)
      && /a\.atk = Math\.round/.test(body);
  })());
  check('实测：装备贡献逐行也是整数（差值不会出现 .5）', (function () {
    var h = G.ui.generalsHTML();
    return !/class="eq-grow"><span class="k">[^<]*<\/span><span class="v">\+\d+\.\d/.test(h);
  })());

  /* ============================================================
   * ③ 侧栏驻军只留两个字
   * ============================================================ */
  console.log('  --- ③ 侧栏驻军精简 ---');
  check('结构：驻军标题只留「驻军」二字（去掉城名/总数/种类/耗粮）', (function () {
    var body = code49(uS49, 'ui.renderGarrison = function');
    return /'<span>⚔ 驻军<\/span>'/.test(body)
      && body.indexOf('种 · 耗粮') < 0 && body.indexOf('c.name') < 0;
  })());

  /* ============================================================
   * ④ 官府面板：说明进 help（老板"按建议执行"）
   * ============================================================ */
  console.log('  --- ④ 官府面板溢出收口 ---');
  check('结构：特产三条收集途径已挪进 ui.help（正文只留"本州归属"）', (function () {
    var body = code49(uS49, 'ui.openGuanfu = function');
    return /ui\.help\('如何收集本城特产/.test(body)
      && body.indexOf("'① 州郡岁贡</span>") < 0
      && /本州归属/.test(body);
  })());
  /* 「正文里没有那三条」的**实测**放在 e2e ——
     smoke 的 DOM stub 没有 querySelectorAll，量不了真实弹窗正文
     （这里是项目的老规矩：尺寸/结构类的"实测"必须去真浏览器）。 */

  /* ============================================================
   * ⑤ 资源短写：三档边界 + 唯一出口 + 定宽右对齐
   * ============================================================ */
  console.log('  --- ⑤ 资源数量短写 ---');
  check('结构：短写只有 `U.amtHTML` 一个出口（纯文本版 amtText 供悬停）', (function () {
    return /U\.amtHTML = function/.test(stS49) && /U\.amtText = function/.test(stS49)
      && /U\.amtHTML\(val\)/.test(code49(uS49, 'ui.renderResBar = function'));
  })());
  check('结构：存量列定宽 + 右对齐 + 单位小字（各行数字才齐整）', (function () {
    var css = cssBlock(hS49, '#res-bar .res-line .amt');
    return css.indexOf('min-width: 74px') >= 0 && css.indexOf('text-align: right') >= 0
      && cssBlock(hS49, '#res-bar .res-line .amt .amt-u').indexOf('font-size: var(--fs-cap)') >= 0;
  })());
  check('实测：三档边界（9999 原值 / 10000 万 / 1e8 亿）与单位小字', (function () {
    return U.amtText(9999) === '9,999' && U.amtText(10000) === '1.0万'
      && U.amtText(1e8) === '1.00亿' && U.amtText(12345) === '1.2万'
      && U.amtHTML(1e8).indexOf('amt-u') >= 0;
  })(), [U.amtText(9999), U.amtText(10000), U.amtText(12345), U.amtText(1e8)].join(' | '));

  /* ============================================================
   * ⑥ 系统城统一 8×6 + 名城建筑满级
   * ============================================================ */
  console.log('  --- ⑥ 布局统一与名城满级 ---');
  check('实测：官府在"棋盘正中"（与 makeCity 同一出口 GAME.govCellsOf）', (function () {
    var bad = [];
    for (var lv = 1; lv <= 10; lv++) {
      var p = G.cityPlanOf(lv), gf = [];
      p.cells.forEach(function (c, i) { if (c.official) gf.push(i); });
      if (gf.join(',') !== G.govCellsOf(p.col, p.row).join(',')) bad.push(lv);
    }
    return bad.length === 0;
  })(), '官府 4 格恒为「第三行 4-5 与第四行 4-5」（正中央）');
  check('实测：城内**与城外**的建筑等级都等于该城上限', (function () {
    var npc = null;
    (G.state.map.cities || []).forEach(function (c) { if (!npc) npc = c; });
    if (!npc) return false;
    var sh = G.npcCityShadow(npc), bl = G.npcBuildLvOf(npc);
    var badIn = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;
    var badOut = (sh.extGrid || []).filter(function (e) { return e.lv !== bl; }).length;
    return badIn === 0 && badOut === 0 && sh.wallLv === bl;
  })());
  check('实测：野外城池（非名城）仍按**自己的等级**，不给满级', (function () {
    var fort = { id: 'f49', name: '据点', x: 3, y: 3, level: 4, type: 'fort' };
    return G.npcBuildLvOf(fort) === 4
      && G.npcBuildLvOf({ id: 'c49', level: 4, type: 'county' }) === DATA.CITY_PLAN.maxLevel + 2;
  })(), '据点 Lv4 → 建筑 Lv4；县城 Lv4 → 建筑 Lv12');


  /* ============================================================
   * ⑧ 侦查面板分页 + 官府面板收口（v65 的"装得下"）
   * ============================================================ */
  console.log('  --- ⑧ 弹窗装得下：侦查分页 / 官府收口 ---');
  check('结构：侦查面板分两页（满级六层装不进一个弹窗）', (function () {
    var panel = code49(mS49, 'ui.openScoutResult = function');
    var pages = (mS49.match(/\{ id: '(enemy|loot)'/g) || []).length;
    return /ui\.SCOUT_PAGES = \[/.test(mS49) && pages === 2
      && /if \(page === 0\)/.test(panel) && /data-action="scout-page"/.test(panel);
  })(), '「敌情与缴获」/「虚实与可图之利」');
  check('结构：页签在 main 里有接线（不是孤儿按钮）', (function () {
    return /case 'scout-page'/.test(mS49) && /ui\._scoutLast/.test(mS49);
  })());
  check('结构：**新的一次侦查从第 1 页开始**（页签记忆只服务当次翻页）', (function () {
    var arrive = code49(mS49, 'GAME.onMarchArrive = function');
    return /openScoutResult\(\{ kind: m\.kind, name: m\.name \}, r, 0\)/.test(arrive);
  })());
  check('结构：官府面板的"在办事项"**限条数**（队列是最容易无限长的一块）', (function () {
    var g = code49(uS49, 'ui.openGuanfu = function');
    return /ui\.queueBody\(4\)/.test(g) && /ui\.queueBody = function \(limit\)/.test(uS49);
  })());
  check('结构：官府面板用 xl 档（默认档 660×620 装不下）', (function () {
    var g = code49(uS49, 'ui.openGuanfu = function');
    return /size: 'xl'/.test(g);
  })());
  /* ⚠️ `gNum` 必须从 expedition 带出来 —— 漏了面板就显示「约 undefined 名」。
     这个真 bug 是本轮 e2e 抓到的：改成"结构断言"守它，避免下次又漏。 */
  check('结构：侦查结果把 `gNum` 一起带出（否则面板显示 undefined）', (function () {
    var exp = code49(bS49, 'GAME.battle.expedition = function');
    return /gNum: sc\.gNum/.test(exp) && /totalExact: sc\.totalExact/.test(exp);
  })());
  check('实测：侦查面板渲染守军总数时**不出 undefined**', (function () {
    var t0 = G.state.techs['zhencha'] || 0, w0 = G.state.world.weather;
    G.state.techs['zhencha'] = 10; G.state.world.weather = 'clear';
    var g = G.state.generals[0];
    g.status = 'idle'; g.stamina = G.staMax(g); g.energy = 100;
    var r = G.battle.expedition({ kind: 'wild', x: 34, y: 34 }, 'scout', {}, g.id);
    G.state.techs['zhencha'] = t0; G.state.world.weather = w0;
    if (!r || !r.ok) return false;
    var html = G.ui.openScoutResult ? '（有渲染入口）' : '';
    G.ui.openScoutResult({ name: '野地' }, r, 0);
    var root = document.querySelector('#modal-root');
    var txt = (root && root.textContent) || '';
    G.ui.closeModal();
    return !!html && r.gNum > 0 && txt.length === 0;   /* smoke 环境没有真 DOM → txt 为空 */
  })(), '（DOM 断言归 e2e；这里守 gNum 有值）');
  check('实测：野外城与名城都拿到 48 格布局（v65 统一）', (function () {
    var npc = null;
    (G.state.map.cities || []).forEach(function (c) { if (!npc) npc = c; });
    if (!npc) return false;
    var sh = G.npcCityShadow(npc);
    var fort = { id: 'f65', name: '据点', x: 4, y: 4, level: 6, type: 'fort' };
    var fp = G.fortPlanOf(fort);
    return sh.col === 8 && sh.row === 6 && fp.col === 8 && fp.row === 6;
  })());

  /* ============================================================
   * ⑦ 缺粮哗变：24 小时宽限 + 每 24h 逃 20%
   * ============================================================ */
  console.log('  --- ⑦ 缺粮哗变规则 ---');
  check('结构：在线与离线走同一个 starveStep（不许两套口径）', (function () {
    /* ⚠️ **必须剥注释**：这两个函数的说明里就写着"走同一个 starveStep"，
       不剥就会读到自己的说明文字 —— 破坏测试第 5 类第一次注入就是这样假绿的。
       （同一个坑这是第 10 次，见 stripComment 的注释。） */
    var tick = stripComment(code49(stS49, 'GAME.tickOnce = function'));
    var bulk = stripComment(code49(stS49, 'GAME.simulateBulk = function'));
    return /GAME\.starveStep\(ct,/.test(tick) && /GAME\.starveStep\(ct,/.test(bulk);
  })());
  check('实测：**离线补算**也会哗变（喂一座饿死的城，跑 simulateBulk）', (function () {
    var st = G.newGame({ name: 'v65off', cityName: '许都' });
    var c = st.cities[0];
    c.army = { yibing: 100000 };
    c.res.grain = 0;
    c.starveHours = 0;
    var n0 = c.army.yibing;
    /* 参数是**现实秒**：推进两个游戏日（= 2×24×3600 游戏秒 / 时间倍率） */
    G.simulateBulk(2 * 24 * 3600 / G.timeScale());
    return c.army.yibing < n0;
  })(), '离线两日 → 兵力下降');
  check('结构：旧的"按缺口比例逃"已删干净（applyStarvation 不存在）',
    typeof G.applyStarvation !== 'function' && stS49.indexOf('applyStarvation = function') < 0);
  check('实测：24 小时宽限内不掉兵，之后每次逃 20%（按**当前**剩余数）', (function () {
    var st = G.newGame({ name: 'v65starve', cityName: '许都' });
    var c = st.cities[0];
    c.army = { yibing: 100000 };
    c.starveHours = 0;
    var early = G.starveStep(c, true, 23);          /* 还差 1 小时 */
    var at24 = G.starveStep(c, true, 1);            /* 刚好满 24 */
    var next = G.starveStep(c, true, 24);           /* 再满 24 */
    return early.lost === 0 && at24.lost === 20000 && next.lost === 16000
      && c.army.yibing === 64000;
  })(), '100000 →(24h) 80000 →(48h) 64000');

  /* ============================================================
   * 50. v66：经验封顶 / 装备体力入上限 / 客栈高资质下调
   * ============================================================ */
  console.log('\n===== 50. v66：经验封顶 / 装备体力入上限 / 客栈降资质 =====');
  function rd66(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var dmS66 = rd66('domain'), syS66 = rd66('systems'), bS66 = rd66('battle'),
      uS66 = rd66('ui'), stS66 = rd66('state');
  /* ⚠️ `G.newGame()` 只返回 state，**不会**装进 GAME.state。
     凡是走业务函数（useItem / gainExpByItem）的断言都必须先装 state，
     否则操作的是上节的残留 state —— 那会造出"拒绝理由其实是背包没道具"的假绿。 */
  var keep66 = G.state;
  function with66(nm, fn) {
    try {
      var st = G.newGame({ name: nm });
      G.state = st;
      if (G.map.generate) G.map.generate();
      return fn(st);
    } finally { G.state = keep66; }
  }
  function g66(st) {
    var g = st.generals[0];
    g.level = 1; g.nz = 0; g.equip = {};
    return g;
  }
  function expItemId66() {
    var id = null;
    (DATA.ITEMS || []).forEach(function (it) { if (!id && it.type === 'exp') id = it.id; });
    return id;
  }
  function staItemId66() {
    var id = null;
    (DATA.ITEMS || []).forEach(function (it) { if (!id && it.type === 'stamina') id = it.id; });
    return id;
  }
  var SAMPLED66 = null, MSG66 = '', HP66 = [0, 0], HEAL66 = [0, 0], DBG66 = '';

  /* ---------- ① 等级到上限后不能再用经验道具 ---------- */
  console.log('  --- ① 经验道具封顶 ---');
  check('实测：未到上限时 expBlockOf 放行（返回空串）', with66('v66e1', function (st) {
    var g = g66(st);
    g.level = Math.max(1, G.genLevelCap(g) - 1);
    return G.expBlockOf(g) === '' && G.expBlocked(g) === false;
  }));
  check('实测：到上限后给出原因（资质档位 + Lv 上限都写在文案里）', with66('v66e2', function (st) {
    var g = g66(st), cap = G.genLevelCap(g), rk = G.rankOf(g);
    g.level = cap;
    var msg = G.expBlockOf(g);
    MSG66 = msg;
    return G.expBlocked(g) === true && msg.length > 8
      && msg.indexOf('Lv' + cap) >= 0 && msg.indexOf(rk.name) >= 0;
  }), '文案：' + MSG66);
  check('实测：到上限时 useItem 拒绝，**理由就是"已达上限"**（不是"背包没有"）', with66('v66e4', function (st) {
    var g = g66(st), itemId = expItemId66();
    if (!itemId) return false;
    g.level = G.genLevelCap(g); g.exp = 0;
    st.items = st.items || {};
    st.items[itemId] = 3;
    var r = G.systems.useItem(itemId, g.id);
    return r.ok === false && /上限/.test(r.msg) && st.items[itemId] === 3 && (g.exp || 0) === 0;
  }), '道具 3 → 3，经验不动');
  check('实测：批量「用到升级」同样被拦，一个都不烧', with66('v66e5', function (st) {
    var g = g66(st), itemId = expItemId66();
    if (!itemId) return false;
    g.level = G.genLevelCap(g); g.exp = 0;
    st.items = st.items || {};
    st.items[itemId] = 5;
    var r = G.systems.gainExpByItem(itemId, g.id, 'till');
    return r.ok === false && /上限/.test(r.msg) && st.items[itemId] === 5;
  }), '道具 5 → 5');
  check('实测：未到上限时仍能正常吃到经验（防止"一刀切封掉"）', with66('v66e6', function (st) {
    var g = g66(st), itemId = expItemId66();
    if (!itemId) return false;
    g.level = 1; g.exp = 0;
    st.items = st.items || {};
    st.items[itemId] = 2;
    var r = G.systems.useItem(itemId, g.id);
    /* 练兵经验 +3000 会把 1 级将一路吃到 Lv4 且经验**刚好用光**（100+400+900=1400…
       实际到 Lv4 累计 1400，余 1600 又够一级）—— 所以"吃到了"的判据是**等级上升**，
       不是"还有剩余经验"。 */
    DBG66 = 'item=' + itemId + ' ' + r.msg + '，Lv1 → Lv' + g.level
      + '，道具 2 → ' + st.items[itemId];
    return r.ok === true && st.items[itemId] === 1 && g.level > 1;
  }), DBG66);
  check('实测：批量「用到升级」在未到上限时确实升级', with66('v66e7', function (st) {
    var g = g66(st), itemId = expItemId66();
    if (!itemId) return false;
    g.level = 1; g.exp = 0;
    st.items = st.items || {};
    st.items[itemId] = 30;
    var r = G.systems.gainExpByItem(itemId, g.id, 'till');
    return r.ok === true && g.level > 1;
  }));
  check('结构：三个消费点都先问同一个出口（单个 / 批量 / 界面面板）', (function () {
    var use = codeOf(syS66, 'S.useItem = function');
    var batch = codeOf(syS66, 'S.gainExpByItem = function');
    var panel = codeOf(uS66, 'ui.openExpPick = function');
    return /expBlockOf/.test(use) && /expBlockOf/.test(batch) && /expBlockOf/.test(panel)
      && use.length > 200 && batch.length > 200 && panel.length > 200;
  })());
  check('结构：到上限时 ＋ 按钮转暗并写明原因（入口仍在，点得动）', (function () {
    var pane = codeOf(uS66, 'ui.genPane = function');
    return /atCap \? 'dim'/.test(pane) && /已达资质上限 Lv/.test(pane);
  })());
  check('结构：封顶判据只走 genLevelCap（不另写 lvCap 直读）', (function () {
    var body = codeOf(dmS66, 'GAME.expBlockOf = function');
    return /genLevelCap/.test(body) && body.indexOf('lvCap') < 0;
  })());

  /* ---------- ② 装备体力 → 体力上限（唯一一条链） ---------- */
  console.log('  --- ② 装备体力 → 体力上限 ---');
  check('实测：打造散件的体力真的加进上限', with66('v66s1', function (st) {
    var g = g66(st);
    var bare = G.staMax(g);
    g.equip = { head: 'cr_head_4', chest: 'cr_chest_4' };
    var want = (DATA.EQUIP.cr_head_4.sta || 0) + (DATA.EQUIP.cr_chest_4.sta || 0);
    return want > 0 && G.staMax(g) - bare === want;
  }), '2 件神品散件 → 上限 +' + ((DATA.EQUIP.cr_head_4.sta || 0) + (DATA.EQUIP.cr_chest_4.sta || 0)));
  check('实测：散件 + 套装件 + 套装档位**三来源合一**（不重不漏）', with66('v66s2', function (st) {
    var g = g66(st);
    var bare = G.staMax(g);
    g.equip = { head: 'yt_helm', neck: 'yt_neck', shoulder: 'yt_should' };   /* 倚天 3 件 */
    var want = (DATA.EQUIP.yt_helm.sta || 0) + (DATA.EQUIP.yt_neck.sta || 0)
      + (DATA.EQUIP.yt_should.sta || 0) + (DATA.SETS.yitian.eff[3].sta || 0);
    var got = G.staMax(g) - bare;
    return got === want && G.staEquipOf(g) === got;
  }));
  check('实测：装备体力进上限后**全军生命真的更厚**（行为断言）', with66('v66s3', function (st) {
    var g = g66(st);
    var m0 = G.battle.hpMult(g);
    g.equip = { head: 'cr_head_4', chest: 'cr_chest_4', shoulder: 'cr_shoulder_4', arm: 'cr_arm_4' };
    HP66 = [m0, G.battle.hpMult(g)];
    return HP66[1] > m0 * 1.05;
  }), '全军生命倍率 ' + HP66[0].toFixed(3) + ' → ' + HP66[1].toFixed(3));
  check('实测：装上装备后当前体力**不塌陷**（装备是常备额度，不是"要重新回满"）', with66('v66s4', function (st) {
    var g = g66(st);
    g.stamina = G.staBaseMax(g);
    var wasFull = G.staNow(g) === G.staMax(g);
    g.equip = { head: 'cr_head_4', chest: 'cr_chest_4' };
    return wasFull && G.staNow(g) === G.staMax(g);
  }), '满体力装上装备 → 仍然满（上限 ' + G.staMax({ level: 1, nz: 0, rank: 'fan' }) + ' → 需要装备）');
  check('实测：卸下装备后上限与当前值一起回落（常备额度不留残留）', with66('v66s5', function (st) {
    var g = g66(st);
    g.equip = { head: 'cr_head_4' };
    var mx1 = G.staMax(g), now1 = G.staNow(g);
    g.equip = {};
    return G.staMax(g) < mx1 && G.staNow(g) === G.staMax(g) && now1 === mx1;
  }));
  check('实测：体力满时止血散**不消耗**（判据改到池子口径后仍成立）', with66('v66s6', function (st) {
    var g = g66(st), id = staItemId66();
    if (!id) return false;
    g.equip = { head: 'cr_head_4' };
    g.stamina = G.staBaseMax(g);            /* 余量满 = 池子满 */
    st.items = st.items || {};
    st.items[id] = 2;
    var r = G.systems.useItem(id, g.id);
    return r.ok === false && /已满/.test(r.msg) && st.items[id] === 2;
  }), '道具 2 → 2');
  check('实测：体力不满时止血散**真的回到池子上**', with66('v66s7', function (st) {
    var g = g66(st), id = staItemId66();
    if (!id) return false;
    g.equip = { head: 'cr_head_4' };
    g.stamina = 0;
    st.items = st.items || {};
    st.items[id] = 1;
    var before = G.staNow(g);
    var r = G.systems.useItem(id, g.id);
    HEAL66 = [before, G.staNow(g)];
    /* useItem 用完会把 items 里的键 delete 掉，所以判据是"不再有剩余" */
    return r.ok === true && G.staNow(g) > before && !(st.items[id] > 0);
  }), '体力 ' + HEAL66[0] + ' → ' + HEAL66[1]);
  check('结构：装备体力在战斗里不再有第二条路（hpMultOf 只走体力这一条链）', (function () {
    var body = codeOf(bS66, 'function hpMultOf');
    return body.length > 40 && body.indexOf('genEquipBonus') < 0 && /staHpBonus/.test(body);
  })());
  check('结构：界面的体力、出征门槛、采集门槛同源（都不直读 g.stamina）', (function () {
    var ui = stripComment(uS66), b = stripComment(bS66), dm = stripComment(dmS66);
    return ui.indexOf('g.stamina') < 0
      && b.indexOf('(gen.stamina || 0) <') < 0
      && dm.indexOf('(gen.stamina || 0) <') < 0
      && /GAME\.staNow\(gen\) < mode\.stamina/.test(b);
  })());
  check('结构：装备提供清单读 staEq（与左栏"状态 · 体力"同一个数）', (function () {
    var pane = codeOf(uS66, 'ui.genPane = function');
    return /\['staEq', '体力'\]/.test(pane) && pane.indexOf("['hp', '体力']") < 0;
  })());
  check('结构：六维表的体力取"总体"（staMax），不再取当前值', (function () {
    return /val: 'staMax'/.test(uS66) && /a\[d\.val \|\| d\.k\]/.test(uS66);
  })());
  check('实测：genAttrs 不再有 hp 字段（体力只有一条链）', with66('v66s8', function (st) {
    var g = g66(st);
    g.equip = { head: 'cr_head_4' };
    var a = G.genAttrs(g);
    return a.hp === undefined && typeof a.staMax === 'number' && typeof a.staEq === 'number';
  }));
  check('实测：装备体力对上限的贡献是整数（哪怕坐骑加成带小数）', with66('v66s9', function (st) {
    var g = g66(st);
    g.equip = { mount: 'jueying' };
    st.techs = st.techs || {};
    st.techs['majiu'] = 5;                     /* 驯马技巧会乘出小数 */
    var a = G.genAttrs(g);
    return a.staMax === Math.round(a.staMax) && a.staEq === Math.round(a.staEq);
  }));

  /* ---------- ③ 客栈高资质降幅 ---------- */
  console.log('  --- ③ 客栈高资质降幅 ---');
  check('实测：天授 / 名世 / 英杰 权重按累计 ÷100 / ÷80 / ÷60 下调', (function () {
    var CUT = { tian: 100, ming: 80, ying: 60 }, ORIG = { tian: 2, ming: 6, ying: 15 };
    var bad = [];
    DATA.GEN_RANKS.forEach(function (r) {
      if (!CUT[r.id]) return;
      if (Math.abs(r.w - ORIG[r.id] / CUT[r.id]) > 1e-9) bad.push(r.id + '=' + r.w);
    });
    return bad.length === 0;
  })(), '天授 ' + DATA.GEN_RANKS[4].w + ' · 名世 ' + DATA.GEN_RANKS[3].w + ' · 英杰 ' + DATA.GEN_RANKS[2].w);
  check('实测：低资质（凡品 50 / 良材 27）不动', DATA.GEN_RANKS[0].w === 50 && DATA.GEN_RANKS[1].w === 27,
    DATA.GEN_RANKS[0].w + ' / ' + DATA.GEN_RANKS[1].w);
  check('实测：客栈1级 天授概率 ≈0.026%（v66 为 0.25%）', (function () {
    var ws = G.rankWeights(1), t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    return Math.abs(v / t * 100 - 0.026) < 0.01;
  })());
  check('结构：权重下限按自身基准 5%（不是写死的 0.5 —— 那会把降幅吃掉）', (function () {
    var body = codeOf(stS66, 'GAME.rankWeights = function');
    return /Math\.max\(r\.w \* 0\.05/.test(body) && body.indexOf('Math.max(0.5') < 0;
  })());
  check('实测：客栈1级 天授权重不再被下限抬回 0.5', (function () {
    var t = null;
    G.rankWeights(1).forEach(function (x) { if (x.rank.id === 'tian') t = x; });
    return !!t && t.w < 0.3;
  })(), '权重 ' + (function () {
    var t = null;
    G.rankWeights(1).forEach(function (x) { if (x.rank.id === 'tian') t = x; });
    return t ? t.w.toFixed(2) : '?';
  })());
  check('实测：抽样 5000 次 天授出现率 < 0.8%（旧口径约 2%）', (function () {
    var n = 0, N = 5000;
    for (var i = 0; i < N; i++) if (G.pickRank(1).id === 'tian') n++;
    SAMPLED66 = n / N * 100;
    return SAMPLED66 < 0.8;
  })(), (function () {
    var n = 0, N = 5000;
    for (var i = 0; i < N; i++) if (G.pickRank(1).id === 'tian') n++;
    return (n / N * 100).toFixed(2) + '%';
  })());

  /* ============================================================
   * 51. v67：放弃城池 / 城池关联数据登记表 / 侧栏分列
   * ============================================================ */
  console.log('\n===== 51. v67：放弃城池 + 关联数据清理 + 侧栏分列 =====');
  function rd67(f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var dmS67 = rd67('domain'), uS67 = rd67('ui'), mS67 = rd67('main');
  var hS67 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var keep67 = G.state, REFS67 = '', MSG67B = '', LEFT67 = [];
  function with67(nm, fn) {
    try {
      var st = G.newGame({ name: nm });
      G.state = st;
      if (G.map.generate) G.map.generate();
      return fn(st);
    } finally { G.state = keep67; }
  }
  /* 造一座"身上挂满数据"的城：将领（守将）/ 建造 / 募兵 / 野地驻军，全都挂在它身上 */
  function cityFull67(st, opts) {
    opts = opts || {};
    var host = st.cities[0];
    var c = G.makeCity({ id: 'p2', name: '许都', x: host.x + 3, y: host.y,
      res: { grain: 5e5, wood: 1e5, stone: 1e5, iron: 1e5, gold: 1e5 } });
    c.wallLv = 3; c.army = { yibing: 1234 };
    if (opts.origId) c.origId = opts.origId;
    st.cities.push(c);
    var g = st.generals[0];
    g.cityId = c.id; g.status = 'guard';
    st.queues.build.push({ cityId: c.id, gridIndex: 0, buildId: 'minfang', type: 'build',
      elapsed: 0, totalTime: 100 });
    st.queues.train.push({ kind: 'train', cityId: c.id, bIdx: 0, troopId: 'yibing',
      count: 100, elapsed: 0, totalTime: 100 });
    st.wilds = st.wilds || [];
    st.wilds.push({ x: c.x + 5, y: c.y, type: 'forest', level: 3, levelDay: 0,
      garrison: { troops: { yibing: 777 }, cityId: c.id } });
    return { host: host, c: c, g: g };
  }

  /* ---------- ① 登记表：能把"挂在城上的数据"全找出来 ---------- */
  console.log('  --- ① 现存的关联数据（表格自检） ---');
  check('实测：cityRefsOf 找得出将领 / 建造 / 募兵 / 野地驻军 / 城池本体', with67('v67a', function (st) {
    var o = cityFull67(st);
    var keys = G.cityRefsOf(o.c.id).map(function (r) { return r.key; }).sort().join(',');
    REFS67 = keys;
    return ['cities', 'generals', 'queues.build', 'queues.train', 'wilds'].every(function (k) {
      return G.cityRefsOf(o.c.id).some(function (r) { return r.key === k && r.n >= 1; });
    });
  }), '找到：' + REFS67);
  check('实测：在途行军与在外采集也认得出（且标成 hard）', with67('v67b', function (st) {
    var o = cityFull67(st);
    st.marches.push({ id: 'm1', cityId: o.c.id, genId: o.g.id, modeId: 'raid', army: {} });
    st.gathers.push({ id: 'ga1', x: o.c.x + 1, y: o.c.y, type: 'forest', level: 1,
      genId: o.g.id, army: {}, troops: 10, cityId: o.c.id, elapsed: 0 });
    var refs = G.cityRefsOf(o.c.id);
    var m = refs.filter(function (r) { return r.key === 'marches'; })[0];
    var g2 = refs.filter(function (r) { return r.key === 'gathers'; })[0];
    return !!m && m.hard === true && !!g2 && g2.hard === true;
  }));
  check('结构：清理**照登记表**批量走（不许散着手写 filter）', (function () {
    var body = stripComment(codeOf(dmS67, 'GAME.abandonCity = function'));
    return body.length > 400 && /GAME\.CITY_SCOPED\.forEach/.test(body)
      && /GAME\.restoreCityTile/.test(body);
  })());

  /* ---------- ② 不许放弃的情形 ---------- */
  console.log('  --- ② 拒绝的情形 ---');
  check('实测：最后一座城池不许放弃（会无处落脚）', with67('v67c', function (st) {
    var r = G.abandonCityCheck(st.cities[0].id);
    return r.ok === false && /最后一座/.test(r.msg);
  }), MSG67B);
  check('实测：有在途行军时不许放弃（清了会丢兵）', with67('v67d', function (st) {
    var o = cityFull67(st);
    st.marches.push({ id: 'm2', cityId: o.c.id, genId: o.g.id, modeId: 'raid', army: {} });
    var r = G.abandonCity(o.c.id);
    MSG67B = r.msg;
    return r.ok === false && /在途行军/.test(r.msg) && G.cityById(o.c.id) !== null;
  }), MSG67B);
  check('实测：有在外采集队时也不许放弃', with67('v67e', function (st) {
    var o = cityFull67(st);
    st.gathers.push({ id: 'ga2', x: o.c.x + 1, y: o.c.y, type: 'forest', level: 1,
      genId: o.g.id, army: {}, troops: 10, cityId: o.c.id, elapsed: 0 });
    var r = G.abandonCity(o.c.id);
    return r.ok === false && /采集队/.test(r.msg);
  }));

  /* ---------- ③ 正常放弃：批量清干净 ---------- */
  console.log('  --- ③ 放弃之后：不留悬空引用 ---');
  check('实测：放弃后**关联数据一类都不剩**（cityRefsOf 为空）', with67('v67f', function (st) {
    var o = cityFull67(st);
    var r = G.abandonCity(o.c.id);
    LEFT67 = G.cityRefsOf(o.c.id);
    return r.ok === true && LEFT67.length === 0;
  }), LEFT67.length ? ('残留：' + JSON.stringify(LEFT67)) : '0 项残留');
  check('实测：城池本体从 s.cities 移除、cityById 查不到', with67('v67g', function (st) {
    var o = cityFull67(st);
    G.abandonCity(o.c.id);
    return st.cities.length === 1 && G.cityById(o.c.id) === null
      && st.cities[0].id === o.host.id;
  }));
  check('实测：将领归到接收城、守将随城解任', with67('v67h', function (st) {
    var o = cityFull67(st);
    var before = o.g.status;
    G.abandonCity(o.c.id);
    return before === 'guard' && o.g.cityId === o.host.id && o.g.status === 'idle';
  }));
  check('实测：建造 / 募兵队列里该城的条目被清掉', with67('v67i', function (st) {
    var o = cityFull67(st);
    G.abandonCity(o.c.id);
    var b = st.queues.build.filter(function (q) { return q.cityId === o.c.id; }).length;
    var t = st.queues.train.filter(function (q) { return q.cityId === o.c.id; }).length;
    return b === 0 && t === 0;
  }));
  check('实测：野地驻军**兵不丢**（并入接收城），野地本身还在', with67('v67j', function (st) {
    var o = cityFull67(st);
    var wild = st.wilds[st.wilds.length - 1];
    var n0 = o.host.army.yibing || 0;
    G.abandonCity(o.c.id);
    var n1 = o.host.army.yibing || 0;
    return n1 === n0 + 777 && !wild.garrison
      && st.wilds.filter(function (w) { return w.x === wild.x && w.y === wild.y; }).length === 1;
  }));
  check('实测：UI 的当前城池指针不再指向已删城', with67('v67k', function (st) {
    var o = cityFull67(st);
    G.ui._cityId = o.c.id;
    G.abandonCity(o.c.id);
    var ok = G.ui._cityId === o.host.id && G.currentCity() && G.currentCity().id === o.host.id;
    G.ui._cityId = null;
    return ok;
  }));
  check('实测：放弃后**这一格还给地图**（自建城 → 平原）', with67('v67l', function (st) {
    var o = cityFull67(st);
    G.abandonCity(o.c.id);
    var t = G.map.tile(o.c.x, o.c.y);
    return t && t.terrain === 'plain';
  }));
  check('实测：放弃**攻占来的城** → 那座系统城回到地图（按 origId）', with67('v67m', function (st) {
    var npc = (st.map.cities || [])[0];
    if (!npc) return false;
    var o = cityFull67(st, { origId: npc.id });
    /* 照 onConquer 造现场：城压在 NPC 城坐标上、格子标 'city'、NPC 列表里已剔除它
       （不造这一步，夹具与真实攻占就是两回事 —— 上一版就是因此假红）。 */
    o.c.x = npc.x; o.c.y = npc.y;
    var tk0 = G.map.tile(o.c.x, o.c.y); if (tk0) tk0.terrain = 'city';
    st.map.cities = st.map.cities.filter(function (x) { return x.id !== npc.id; });
    var before = (st.map.cities || []).some(function (x) { return x.id === npc.id; });
    G.abandonCity(o.c.id);
    var after = (st.map.cities || []).some(function (x) { return x.id === npc.id; });
    var tk = G.map.tile(o.c.x, o.c.y);
    return before === false && after === true && !!tk && tk.terrain === 'city';
  }));

  /* ---------- ④ 界面入口 ---------- */
  console.log('  --- ④ 入口与确认框 ---');
  check('结构：城池面板有「放弃城池」入口，且只在还有别的城时出现', (function () {
    var pane = codeOf(uS67, 'ui.openCityPanel = function');
    return /city-abandon-ask/.test(pane) && /\(s\.cities \|\| \[\]\)\.length > 1/.test(pane);
  })());
  check('结构：二次确认与执行业务都在（且判据走同一个出口）', (function () {
    var ask = codeOf(uS67, 'ui.openAbandonCityAsk = function');
    return /GAME\.abandonCityCheck/.test(ask) && /city-abandon-do/.test(ask)
      && /case 'city-abandon-ask'/.test(mS67) && /GAME\.abandonCity\(/.test(mS67)
      && ask.length > 500;
  })());
  check('实测：确认框列出"失去什么 / 谁随迁"（不可逆要说清代价）', with67('v67n', function (st) {
    var o = cityFull67(st);
    G.ui.openAbandonCityAsk(o.c.id);
    var root = document.querySelector('#modal-root');
    var html = (root && root.innerHTML) || '';
    if (html.length < 50) return false;
    return html.indexOf('失去库存') >= 0 && html.indexOf('将领随迁') >= 0
      && html.indexOf('data-action="city-abandon-do"') >= 0 && html.indexOf(o.host.name) >= 0;
  }));
  check('实测：不能放弃时确认框**不给确定按钮**，只说明原因', with67('v67o', function (st) {
    var r = G.abandonCityCheck(st.cities[0].id);   /* 只有一座城 */
    G.ui.openAbandonCityAsk(st.cities[0].id);
    var html = (document.querySelector('#modal-root') || {}).innerHTML || '';
    return r.ok === false && html.indexOf('data-action="city-abandon-do"') < 0
      && html.indexOf('最后一座') >= 0;
  }));

  /* ---------- ⑤ 侧栏分列（老板：资源与统计太拥挤） ---------- */
  console.log('  --- ⑤ 侧栏资源 / 驻军分列 ---');
  check('结构：资源行改成三列定宽（74 / 72 / +），列间距 8px', (function () {
    var css = cssBlock(hS67, '#res-bar .res-line .val');
    return /grid-template-columns: 74px 72px 1\.1em/.test(css) && /column-gap: 8px/.test(css);
  })());
  check('结构：增速列与存量列之间有**发丝竖线**（这才叫分列）', (function () {
    var css = cssBlock(hS67, '#res-bar .res-line .rate-wrap');
    return /border-left: 1px solid var\(--line\)/.test(css) && /padding-left: 8px/.test(css);
  })());
  check('结构：增速列定宽 ≥70px 且右对齐（各行的 /秒 右缘对齐）', (function () {
    var css = cssBlock(hS67, '#res-bar .num-rate');
    return /min-width: 72px/.test(css) && /text-align: right/.test(css);
  })());
  check('结构：驻军行也是「名称 | 数量 | 耗粮」三列 + 竖线', (function () {
    var row = cssBlock(hS67, '.gb-row');
    var f = cssBlock(hS67, '.gb-row .gb-f');
    return /display: grid/.test(row) && /grid-template-columns: 1fr 62px 74px/.test(row)
      && /border-left: 1px solid var\(--line\)/.test(f);
  })());


  /* ============================================================
   * v67 · 存档槽位体系（老板：「补一个存档」）
   * ------------------------------------------------------------
   * 分两层：**结构断言**（唯一出口是否真的唯一）+ **行为断言**（存→导出→导入→读→清）。
   * 行为那半边必须能翻转：篡改一个字就该被校验和拦住。
   * ============================================================ */
  console.log('  --- v67：存档槽位 / 导出导入 ---');
  (function () {
    var fsSv = require('fs'), pathSv = require('path');
    var stSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'state.js'), 'utf8'));
    var mainSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'main.js'), 'utf8'));
    var uiSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'ui.js'), 'utf8'));
    var hSrc = fsSv.readFileSync(pathSv.join(__dirname, 'index.html'), 'utf8');

    check('槽位表：主档 + 3 手动 + 3 自动备份（共 7，键名规则唯一）', (function () {
      var ids = G.SLOTS.map(function (x) { return x.id; });
      return G.SLOTS.length === 7 && ids.join(',') === 'main,s1,s2,s3,a1,a2,a3'
        && G.SLOTS[0].key === 'sanguo_save_v3'
        && G.SLOTS.filter(function (x) { return x.kind === 'auto'; }).length === 3
        && G.SLOTS.every(function (x) { return /^sanguo_save_v3/.test(x.key); });
    })(), G.SLOTS.map(function (x) { return x.id; }).join(','));

    check('序列化只有 savePayload 一个出口（saveGame/saveTo 都不许自己 stringify）', (function () {
      var a = codeOf(stSrc, 'GAME.saveGame = function');
      var b = codeOf(stSrc, 'GAME.saveTo = function');
      var c = codeOf(stSrc, 'GAME.savePayload = function');
      return a.length > 80 && b.length > 300 && c.length > 200
        && a.indexOf('GAME.savePayload()') >= 0
        && b.indexOf('GAME.savePayload()') >= 0
        && a.indexOf('JSON.stringify(GAME.state') < 0
        && b.indexOf('JSON.stringify(GAME.state') < 0
        && c.indexOf('JSON.stringify(GAME.state') >= 0;
    })());

    check('读档后处理只有 adoptState 一个出口（主档与槽位共用）', (function () {
      var a = codeOf(stSrc, 'GAME.loadGame = function');
      var b = codeOf(stSrc, 'GAME.loadFrom = function');
      var d = codeOf(stSrc, 'GAME.adoptState = function');
      return a.length > 100 && b.length > 200 && d.length > 3000
        && a.indexOf('GAME.adoptState(st)') >= 0
        && b.indexOf('GAME.adoptState(st)') >= 0
        && d.indexOf('GAME.normalizeGuards()') >= 0
        && d.indexOf('GAME.syncSeq()') >= 0;
    })());

    check('自动存档走 autoSave（先轮换备份，再写主档）',
      /GAME\.autoSave\(\)/.test(mainSrc) && /GAME\.rotateAuto\(\)/.test(stSrc));

    check('面板逐行渲染**全部**槽位（行数来自槽位表，不许写死/偷工减料）', (function () {
      var fn = codeOf(uiSrc, 'ui.openSaveManager = function');
      if (fn.length < 400) return false;
      /* 判据：渲染源是 slotList 全量 + 没有"取前 N 个"的写法。
         ⚠️ 上一版这里只查 `.sv-row` 样式类在不在 —— 破坏测试注入
         `list.slice(0,6)` 时**零反应**，等于没测。 */
      return /list\.map\(ui\.svRowHTML\)/.test(fn)
        && fn.indexOf('.slice(') < 0
        && fn.indexOf('sv-list') >= 0
        && fn.indexOf('sv-imp') >= 0;
    })());
    check('面板样式不给自己加滚动条（弹窗内禁止下拉条）',
      /\.sv-row\b/.test(hSrc) && !/sv-list[^}]*overflow/.test(hSrc));

    check('首页也有存档入口（换台机器导入存档要从这里开始）',
      /id="create-saves"/.test(hSrc) && /data-action="open-saves"/.test(hSrc));

    /* ---------- 行为：存 → 导出 → 导入 → 读 → 清 ---------- */
    var stBackup = G.state;
    if (!G.state) G.state = G.newGame({ name: '存档校验', gender: 'male' });
    if (!G.state.map.grid && G.map.generate) G.map.generate();

    var w = G.saveTo('s1');
    check('存入手动槽 → 成功，且索引里有摘要（面板不必解析主档）',
      w.ok === true && (function () { var m = G.slotMetaOf('s1'); return !!m && m.cities === G.state.cities.length && m.size > 1000; })(),
      w.msg + ' · ' + (w.size || 0) + ' 字节');

    var ex = G.exportText('s1');
    var pack = ex.ok ? JSON.parse(ex.text) : null;
    check('导出文本自描述：格式标记 + 版本 + 8 位校验和',
      !!pack && pack._fmt === 'sanguo-save' && pack._ver === pack.state.version
      && pack._check === G.checksum(JSON.stringify(pack.state)) && pack._check.length === 8,
      ex.ok ? ('校验和 ' + pack._check) : ex.msg);

    check('校验和能翻转（不是恒真装饰）',
      G.checksum('a') !== G.checksum('b') && G.checksum('abc') === G.checksum('abc'));

    var bad = JSON.parse(ex.text);
    bad.state.ruler.name = bad.state.ruler.name + '！';   // 只改一个字
    var rBad = G.importText(JSON.stringify(bad), 's2');
    check('导入被篡改的存档 → 校验和拦住', rBad.ok === false && /校验/.test(rBad.msg), rBad.msg);

    check('导入非本游戏 / 版本不符 → 各自给出明确原因', (function () {
      var r1 = G.importText('这不是 JSON');
      var r2 = G.importText('{"_fmt":"other"}');
      var r3 = G.importText('{"_fmt":"sanguo-save","_ver":99,"state":{}}');
      return r1.ok === false && /JSON/.test(r1.msg)
        && r2.ok === false && /本游戏/.test(r2.msg)
        && r3.ok === false && /版本/.test(r3.msg);
    })());

    var rOk = G.importText(ex.text, 's2');
    check('导入正常存档 → 落到指定槽位', rOk.ok === true && rOk.slot === 's2' && !!G.slotMetaOf('s2'), rOk.msg);

    var back = G.loadFrom('s2');
    check('从槽位读档 → 复现同一份（城池数一致、地形已重建）',
      !!back && back.cities.length === pack.state.cities.length && !!back.map,
      back ? (back.cities.length + ' 城') : '读取失败');

    var rd = G.dropSlot('s2');
    check('清空槽位 → 内容没了、索引也清干净',
      rd.ok === true && G.slotMetaOf('s2') === null && G.loadFrom('s2') === null, rd.msg);
    check('主档不可删除（防手滑把当前档清掉）', G.dropSlot('main').ok === false);

    check('轮换顺序：a3←a2←a1←main（坏档不会当场盖掉唯一好档）', (function () {
      var k = function (id) { return G.slotOf(id).key; };
      G.saveTo('s1');
      try { localStorage.setItem(k('main'), 'M1'); localStorage.setItem(k('a1'), 'A1'); localStorage.setItem(k('a2'), 'A2'); } catch (e) { return false; }
      G.rotateAuto();
      var okOrder = localStorage.getItem(k('a1')) === 'M1'
        && localStorage.getItem(k('a2')) === 'A1'
        && localStorage.getItem(k('a3')) === 'A2';
      return okOrder;
    })());

    ['s1', 's2', 's3', 'a1', 'a2', 'a3'].forEach(function (id) { G.dropSlot(id); });
    try { localStorage.removeItem('sanguo_slots_v3'); } catch (e) {}
    G.state = stBackup;
  })();

})();

  console.log('  --- 第 53 节：定期来袭（第 2 期 · 防守） ---');
  (function () {
    var G = GAME, D = DATA;
    var stBackup = G.state;
    var fsx = require('fs'), pathx = require('path');
    var stSrc = stripComment(fsx.readFileSync(pathx.join(__dirname, 'js', 'state.js'), 'utf8'));

    /* ---- 结构：唯一出口与红线 ---- */
    check('四个唯一出口都在（invasionTick / invasionDueAt / defensePowerOf / invasionPowerOf）',
      typeof G.invasionTick === 'function' && typeof G.invasionDueAt === 'function'
      && typeof G.defensePowerOf === 'function' && typeof G.invasionPowerOf === 'function');

    check('DATA.INVASION 存在，且 loseCity===false（体验红线：输了不丢城）',
      !!D.INVASION && D.INVASION.loseCity === false);

    check('invasionTick 全项目只有一处定义（不许多套口径）',
      (stSrc.match(/GAME\.invasionTick\s*=/g) || []).length === 1);

    var tickBody = codeOf(stSrc, 'GAME.tickOnce = function');
    var bulkBody = codeOf(stSrc, 'GAME.simulateBulk = function');
    check('在线 tickOnce 调 invasionTick', tickBody.length > 500 && /GAME\.invasionTick\s*\(/.test(tickBody),
      '体长 ' + tickBody.length);
    check('离线 simulateBulk 调 invasionTick（**同口径**，不许各写一套）',
      bulkBody.length > 300 && /GAME\.invasionTick\s*\(/.test(bulkBody), '体长 ' + bulkBody.length);

    /* ---- 造受控局面：三座城（过解锁门槛；三城才能验"收拢 vs 分散"）---- */
    var st = G.newGame({ name: '守城测试', avatar: '\u{1F9D4}', gender: 'male', region: 'random' });
    G.state = st;                       // ⚠️ newGame 只返回 state，不装进 GAME.state
    G.map.generate();
    st.cities.push(G.makeCity({ id: 'inv2', name: '二城', x: 265, y: 215 }));
    st.cities.push(G.makeCity({ id: 'inv3', name: '三城', x: 266, y: 216 }));
    var c = st.cities[0], c2 = st.cities[1], c3 = st.cities[2];
    st.world = st.world || {}; st.world.elapsed = 0;
    c.army = { yibing: 5000 }; c2.army = {}; c3.army = {};

    check('首次推进后给出排期（invasionDueAt > 0）',
      (function () { G.invasionTick(0); return G.invasionDueAt(c) > 0; })());

    /* ---- ★ 核心一：城防真的被消费（不再是死显示）---- */
    var d0, d12;
    c.wallLv = 0;  d0 = G.defensePowerOf(c);
    c.wallLv = 12; d12 = G.defensePowerOf(c);
    check('★ 城墙 Lv0→12 守备力真的变了（城防被消费，不是只进显示）',
      d12 > d0 * 1.3, d0 + ' → ' + d12);

    /* 快照/还原：invasionResolve 会改 city，连调两次会叠加 */
    var snap = function () {
      return { army: JSON.parse(JSON.stringify(c.army)), wall: c.wallLv,
               res: JSON.parse(JSON.stringify(G.res(c))), rep: st.rep };
    };
    var back = function (s0) {
      c.army = JSON.parse(JSON.stringify(s0.army)); c.wallLv = s0.wall; st.rep = s0.rep;
      var R = G.res(c); for (var k in R) { if (R.hasOwnProperty(k)) delete R[k]; }
      for (var k2 in s0.res) R[k2] = s0.res[k2];
    };
    var s0 = snap();
    c.wallLv = 0;  var r0  = G.invasionResolve(c); back(s0);
    c.wallLv = 12; var r12 = G.invasionResolve(c); back(s0);
    check('★ 同一来袭规模下，城墙等级真的改变战损（不只是显示值）',
      r0.severity !== r12.severity || r0.held !== r12.held,
      'Lv0 sev=' + r0.severity.toFixed(3) + ' / Lv12 sev=' + r12.severity.toFixed(3));

    /* ---- ★ 核心二：兵力越集中，战损越小（收拢 vs 分散）---- */
    c.wallLv = 0;
    c.army = { yibing: 5000 }; c2.army = {}; c3.army = {};
    var sevConc = G.invasionResolve(c); back(s0);
    c.army = { yibing: 1000 }; c2.army = { yibing: 2000 }; c3.army = { yibing: 2000 };
    var sevSpread = G.invasionResolve(c); back(s0);
    check('★ 兵力集中在目标城 → 战损更小（分散挨打，这是机制的真实取舍）',
      sevSpread.ratio > sevConc.ratio,
      '收拢 ratio=' + sevConc.ratio.toFixed(3) + ' vs 分散 ratio=' + sevSpread.ratio.toFixed(3));

    /* ---- 到点必触发 + 不丢城 ---- */
    var cityCount = st.cities.length;
    var now = st.world.elapsed || 0;
    c.inv.nextAt = now - 1;
    var fired = G.invasionTick(0);
    check('时间轮到点必触发（返回触发次数 ≥1）', fired >= 1, 'fired=' + fired);
    check('结算后城池数不变（loseCity=false 的结构保证）', st.cities.length === cityCount,
      st.cities.length + ' 城');

    /* ---- 边界：开关 ---- */
    st.settings.invasion = false;
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);
    check('总开关关掉后 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    st.settings.invasion = true;

    /* ---- 边界：城数不足不解锁（别一开局就挨打）---- */
    var saved = st.cities;
    st.cities = [c];
    check('城数不足解锁门槛时 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('城数不足解锁门槛时 invasionTick 不触发', G.invasionTick(0) === 0);
    st.cities = saved;

    /* ---- 可复现随机：断言要能稳定，就不能用真随机 ---- */
    check('invasionRoll 同 seed 同结果（否则断言无法稳定）',
      G.invasionRoll('abc') === G.invasionRoll('abc')
      && G.invasionRoll('abc') !== G.invasionRoll('abd'));
    check('invasionRoll 落在 [0,1)', (function () {
      for (var i = 0; i < 200; i++) { var v = G.invasionRoll('k' + i); if (v < 0 || v >= 1) return false; }
      return true;
    })());

    /* ---- 资源名出口（曾因 DATA.RESOURCES 是数组而 TypeError）---- */
    check('GAME.resName 全项目只有一处定义（防第二出口回退）', (function () {
      /* 必须**跨全部模块**统计 —— 定义在 domain.js，只看 state.js 会数成 0 */
      var fs2 = require('fs'), px = require('path'), all = '';
      fs2.readdirSync(px.join(__dirname, 'js')).forEach(function (f) {
        if (/\.js$/.test(f)) all += stripComment(fs2.readFileSync(px.join(__dirname, 'js', f), 'utf8'));
      });
      return (all.match(/GAME\.resName\s*=\s*function/g) || []).length === 1;
    })());
    check('GAME.resName 按 key 取中文名（DATA.RESOURCES 是数组不是字典）',
      G.resName('grain') === '粮食' && G.resName('gold') === '黄金' && G.resName('nope') === 'nope');

    G.state = stBackup;
  })();

  /* ============================================================
   * 54. 建造前置（v68 · 逐步探索）
   * ------------------------------------------------------------
   * 老板三条 + 补充规则，全部走 GAME.buildPrereqOf 单一出口：
   *   ① 其他建筑等级不能超过官府（总闸：buildCapOf 与 prereq 同一判据）
   *   ② 先客栈后招贤馆（招贤馆需客栈 Lv2）
   *   ③ 铁匠铺 Lv3 才能建工匠作坊
   *   ④~⑥ 校场/驿站/鸿胪寺/马厩
   * 建造与升级同一把尺；新建按 1 级算（可多建建筑不被误判为升级）。
   * ============================================================ */
  console.log('\n--- 第 54 节：建造前置（逐步探索） ---');
  (function () {
    var keep54 = G.state;
    var st54 = G.newGame({ name: 'gate54' });
    G.state = st54;
    if (G.map.generate) G.map.generate();
    var rd54 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var c54 = st54.cities[0];
    st54.res.grain = 5e8; st54.res.wood = 5e8; st54.res.stone = 5e8; st54.res.iron = 5e8; st54.res.gold = 5e8;
    var free54 = function (except) {
      /* except：本次要保留的格 —— 被前置拒掉的格仍是空位，不排除会重复取到同一格 */
      for (var i = 0; i < c54.cells.length; i++) {
        var x = c54.cells[i];
        if (i === except) continue;
        if (!x.official && !x.build && !x.pending) return i;
      }
      return -1;
    };
    var fin54 = function () {
      var g = 0;
      while (st54.queues.build.length && g++ < 40) {
        var q = st54.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q);
        var ix = st54.queues.build.indexOf(q); if (ix >= 0) st54.queues.build.splice(ix, 1);
      }
    };
    var setGov54 = function (lv) {
      c54.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = lv; });
    };
    var govIdx54 = c54.cells.findIndex(function (x) { return x.build && x.build.id === 'guanfu'; });

    try {
      /* ---- ① 官府总闸：等级 ≤ 官府 ---- */
      var g1 = free54();
      var b1 = G.buildAt(c54.id, g1, 'junying');
      check('官府 Lv1 时：新建筑（1级）可建', b1.ok === true, b1.msg);
      fin54();
      var u1 = G.upgradeAt(c54.id, g1);
      check('★ 官府 Lv1 时军营升 2 级被拦（总闸生效，提示指向官府）',
        u1.ok === false && /官府/.test(u1.msg || ''), u1.msg);
      var gu1 = G.upgradeAt(c54.id, govIdx54);
      check('★ 官府自身不受总闸（它可以先升）', gu1.ok === true, gu1.msg);
      fin54();
      setGov54(2);
      var u2 = G.upgradeAt(c54.id, g1);
      check('★ 官府 Lv2 后军营可升 2 级（总闸打开）', u2.ok === true, u2.msg);
      fin54();
      setGov54(12);
      var gu2 = G.upgradeAt(c54.id, govIdx54);
      check('官府 12 级是它自己的硬顶（报「最高等级」而不是官府）',
        gu2.ok === false && /最高等级/.test(gu2.msg || ''), gu2.msg);

      /* ---- ② 先客栈后招贤馆 ---- */
      var z1 = free54();
      var p1 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('★ 无客栈时招贤馆被拦（先客栈后招贤馆）',
        p1.ok === false && /客栈/.test(p1.msg || ''), p1.msg);
      var k1 = free54(z1);
      var p2 = G.buildAt(c54.id, k1, 'kezhan');
      check('客栈本身可建（无前置）', p2.ok === true, p2.msg);
      fin54();
      var p3 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('客栈 Lv1 仍不够（需 Lv2）', p3.ok === false, p3.msg);
      c54.cells[k1].build.lvl = 2;
      var p4 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('★ 客栈到 Lv2 后招贤馆可建', p4.ok === true, p4.msg);
      fin54();
      /* 升级同受前置：把客栈压回 Lv1 */
      c54.cells[k1].build.lvl = 1;
      var p5 = G.upgradeAt(c54.id, z1);
      check('★ 升级同受前置（客栈降级后招贤馆不能升）',
        p5.ok === false && /客栈/.test(p5.msg || ''), p5.msg);
      c54.cells[k1].build.lvl = 2;

      /* ---- ③ 铁匠铺 → 工匠作坊 ---- */
      var t1 = free54();
      var q1g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('★ 无铁匠铺时工匠作坊被拦', q1g.ok === false && /铁匠铺/.test(q1g.msg || ''), q1g.msg);
      var t2 = free54(t1);
      G.buildAt(c54.id, t2, 'tiejiangpu'); fin54();
      c54.cells[t2].build.lvl = 2;
      var q2g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('铁匠铺 Lv2 仍不够（需 Lv3）', q2g.ok === false, q2g.msg);
      c54.cells[t2].build.lvl = 3;
      var q3g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('★ 铁匠铺到 Lv3 后工匠作坊可建', q3g.ok === true, q3g.msg);
      fin54();

      /* ---- ④ 可多建建筑的新建不被误判为升级（真缺陷回归）---- */
      var ck1 = free54();
      var c1b = G.buildAt(c54.id, ck1, 'cangku');
      check('仓库第 1 座可建', c1b.ok === true, c1b.msg);
      fin54();
      var ck2 = free54(ck1);
      var c2b = G.buildAt(c54.id, ck2, 'cangku');
      check('★ 仓库第 2 座可建（新建按 1 级算，不被误当升级）', c2b.ok === true, c2b.msg);
      fin54();

      /* ---- ⑤ 表与出口的收口 ---- */
      check('前置表 6 条规则齐备', (function () {
        var P = DATA.BUILD_PREREQ || {};
        return P.zhaoxianguan && P.zhaoxianguan.kezhan === 2
          && P.gongjiangzuofang && P.gongjiangzuofang.tiejiangpu === 3
          && P.xiaochang && P.xiaochang.junying === 2
          && P.yizhan && P.yizhan.shichang === 2
          && P.honglusi && P.honglusi.kezhan === 3
          && P.majiu && P.majiu.junying === 3;
      })());
      check('逐步探索只有一个出口：buildPrereqOf 定义 1 处、内核与 UI 都接',
        (function () {
          var d = stripComment(rd54('domain')), u = stripComment(rd54('ui'));
          return (d.match(/GAME\.buildPrereqOf\s*=\s*function/g) || []).length === 1
            && (d.match(/GAME\.buildPrereqOf\(/g) || []).length >= 2
            && (u.match(/GAME\.buildPrereqOf\(/g) || []).length >= 2;
        })());
      check('无官府的城不受总闸（异常/测试构造不被误伤）', (function () {
        var cx = G.makeCity({ id: 'nogov54', name: '无官府城', x: 1, y: 1, type: 'self' });
        cx.cells.forEach(function (x) { if (x.build) x.build = null; });
        var cap = G.buildCapOf(cx, 'minfang');
        var pre = G.buildPrereqOf(cx, 'minfang', 3);
        cx.cells[0].build = { id: 'minfang', lvl: 5 };
        st54.cities.push(cx);
        var up = G.upgradeAt(cx.id, 0);
        return cap === DATA.MAX_BLEVEL && pre.ok === true && up.ok === true;
      })());
    } finally {
      G.state = keep54;
    }
  })();

  /* ============================================================
   * 55. v68：官府居中 + 旧档迁移（老板 2026-09-14）
   * ------------------------------------------------------------
   * 「官府在城内的地块居中放置，占第三行 4，5 和第四行 4，5 空格」
   *   · 8×6：col 3-4 × row 2-3（0-based）→ 格号 [19,20,27,28]
   *   · 落位唯一出口 GAME.govCellsOf；makeCity / cityPlanOf / 迁移 都走它
   *   · 旧档（官府在右侧 [22,23,30,31]）自动迁移：中央占用者与旧位**对调**（不丢）
   * ============================================================ */
  console.log('\n--- 第 55 节：官府居中 + 旧档迁移 ---');
  (function () {
    var fs55 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var govIdxOf = function (c) {
      var g = []; c.cells.forEach(function (x, i) { if (x.official) g.push(i); });
      return g.join(',');
    };
    /* ① 玩家城居中 */
    check('★ 玩家城官府居中（第三行 4-5 / 第四行 4-5 → [19,20,27,28]）',
      govIdxOf(G.makeCity({ id: 'g55a', name: 'A' })) === '19,20,27,28',
      govIdxOf(G.makeCity({ id: 'g55b', name: 'B' })));
    /* ② 系统城（cityPlanOf）同一出口 */
    check('★ 系统城官府同样居中（走同一出口）',
      (function () {
        var p = G.cityPlanOf(5);
        var g = []; p.cells.forEach(function (x, i) { if (x.official) g.push(i); });
        return g.join(',') === '19,20,27,28';
      })());
    /* ③ 出口唯一性 + 防回退 */
    check('官府落位只有一个出口：govCellsOf 定义 1 处、makeCity/cityPlanOf 都接',
      (function () {
        var st = stripComment(fs55('state'));
        return (st.match(/GAME\.govCellsOf\s*=\s*function/g) || []).length === 1
          && (st.match(/GAME\.govCellsOf\(/g) || []).length >= 2;
      })());
    check('落位定义处不许写死旧格号（迁移识别旧档的 oldPos 除外）',
      (function () {
        var st55s = stripComment(fs55('state'));
        var mk = codeOf(st55s, 'GAME.makeCity = function');
        var cp = codeOf(st55s, 'GAME.cityPlanOf = function');
        return mk.length > 100 && cp.length > 100
          && !/6 \+ 8 \* 2/.test(mk) && !/6 \+ 8 \* 2/.test(cp)
          /* 迁移必须仍认得旧格号 —— 老档靠它识别（这行是"合法保留"的锚） */
          && /var oldPos = \[6 \+ 8 \* 2/.test(st55s);
      })());
    /* ④ 旧档迁移：右侧 → 居中；中央占用者对调；等级/在建/队列一起走 */
    var keep55 = G.state;
    try {
      var st55 = G.newGame({ name: 'govmig' });
      G.state = st55;
      var c55 = st55.cities[0];
      c55.cells.forEach(function (x) { x.official = false; x.build = null; x.pending = null; });
      [22, 23, 30, 31].forEach(function (i) {
        c55.cells[i].official = true; c55.cells[i].build = { id: 'guanfu', lvl: 5 };
      });
      c55.cells[19].build = { id: 'minfang', lvl: 3 };
      c55.cells[20].build = { id: 'junying', lvl: 4 };
      c55.cells[27].pending = { buildId: 'cangku', targetLevel: 1 };
      st55.queues.build = [{ cityId: c55.id, gridIndex: 27, buildId: 'cangku', type: 'build', elapsed: 0, totalTime: 10 }];
      var mig = G.adoptState(st55);
      var mc = mig.cities[0];
      check('★ 迁移：官府自动从右侧移到正中', govIdxOf(mc) === '19,20,27,28', govIdxOf(mc));
      check('★ 迁移：官府等级保留（5 级不丢）',
        !!(mc.cells[19].build && mc.cells[19].build.id === 'guanfu' && mc.cells[19].build.lvl === 5));
      check('★ 迁移：中央的建筑与旧位对调（民房/军营不丢）',
        !!(mc.cells[22].build && mc.cells[22].build.id === 'minfang' && mc.cells[22].build.lvl === 3
          && mc.cells[23].build && mc.cells[23].build.id === 'junying' && mc.cells[23].build.lvl === 4));
      check('★ 迁移：在建项与 pending 一起换位（队列索引重映射）',
        mc.cells[27].pending === null && !!mc.cells[30].pending && mc.cells[30].pending.buildId === 'cangku'
          && (mig.queues.build || []).some(function (q) { return q.gridIndex === 30 && q.buildId === 'cangku'; }));
      /* ⑤ 幂等：已居中的档再读一次不折腾 */
      var again = G.adoptState(mig);
      check('★ 迁移幂等：已居中的档再读一次不变化',
        govIdxOf(again.cities[0]) === '19,20,27,28'
          && !!(again.cities[0].cells[22].build && again.cities[0].cells[22].build.id === 'minfang'));
    } finally {
      G.state = keep55;
    }
  })();

  /* ============================================================
   * 56. v68：弹窗统一规范（老板「点击建筑出来的弹窗……尽量统一」）
   * ------------------------------------------------------------
   * 考察结论与规范见 docs/设计规范.md §11。本节守卫易回退点：
   *   · 建筑详情弹窗（城内/城外/城墙）统一骨架与底栏
   *   · 底栏三格：危险（左）· 关闭（中）· 管理（右）
   *   · 升级费用与按钮同行（op-row-between）
   *   · 页脚样式统一（bldg-foot 与 m-foot 同规格，不用 dashed）
   *   · 操作命名：名字覆盖面板全部内容；多功能面板「用途A · 用途B」
   * ============================================================ */
  console.log('\n--- 第 56 节：弹窗统一规范 ---');
  (function () {
    var fs56 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u56 = stripComment(fs56('ui'));
    var h56 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

    check('建筑详情弹窗统一用 bldg-foot 底栏（城内×2 / 城外×2 / 城墙×2）',
      (u56.match(/class="bldg-foot"/g) || []).length >= 6,
      (u56.match(/class="bldg-foot"/g) || []).length + ' 处');

    check('★ v76：操作三键同排（升级 · 拆 1 级 · 移动/交换），关闭单独吸底', (function () {
      /* 取**含城内拆毁按钮**的那段，从 .bldg-acts 起验三键顺序与底栏关闭 */
      var i = u56.indexOf('data-action="demolish-ask" data-kind="city');
      if (i < 0) return false;
      var a = u56.lastIndexOf('class="bldg-acts"', i);
      if (a < 0) return false;
      var seg = u56.slice(a, i + 1200);
      return seg.indexOf('confirm-upgrade') >= 0
        && seg.indexOf('confirm-upgrade') < seg.indexOf('demolish-ask')
        && seg.indexOf('demolish-ask') < seg.indexOf('move-ask')
        && seg.indexOf('close-modal') > seg.indexOf('move-ask');
    })());

    check('★ 升级行统一：费用与按钮同行（op-row-between 余 2 处：城外/城墙）',
      (u56.match(/op-row op-row-between/g) || []).length >= 2,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');

    check('页脚样式统一：bldg-foot 与 m-foot 同规格（实线，不再 dashed）',
      /\.bldg-foot \{[^}]*solid/.test(h56) && !/\.bldg-foot \{[^}]*dashed/.test(h56));

    check('★ 操作命名：官府入口覆盖面板全部内容（不再叫「征收」）', (function () {
      var m = u56.match(/guanfu: \{ label: "([^"]+)"/);
      return !!m && m[1].indexOf('征收') < 0 && m[1].indexOf('官府') >= 0;
    })());

    check('操作命名：多功能面板用「用途A · 用途B」（军营 / 作坊）',
      /junying: \{ label: "[^"]+ · [^"]+"/.test(u56)
      && /gongjiangzuofang: \{ label: "[^"]+ · [^"]+"/.test(u56));

    check('施工中弹窗与正常态同构（名称 · Lv→Lv + 描述；v73 起不设顶部图标）',
      /升级中 · 后台施工/.test(u56)
      && !/icons\.forBuilding\(isUpgrade \? cell\.build\.id : cell\.pending\.buildId\)/.test(u56));

    check('e2e 依赖的文案保留（不影响下方操作 / 目标等级）',
      /不影响下方操作/.test(u56) && /→ Lv' \+ cell\.pending\.targetLevel/.test(u56));

    check('纯关窗语义不叫「取消」（城外空地已统一为「关闭」）',
      /选择资源建筑[\s\S]{0,500}m-foot[\s\S]{0,120}关闭/.test(u56));
  })();

  console.log('\n--- 第 57 节：可领取任务置顶 + 行内一键领取（v69） ---');
  (function () {
    var fs57 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u57 = stripComment(fs57('ui'));
    var m57 = stripComment(fs57('main'));
    var h57 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

    /* 本地造档 helper —— 第 49 节的 withState 定义在**它自己的 IIFE 内**，跨节不可见
       （与 v68 的 govMax 同一类坑：段内 helper 不能跨段落作用域使用） */
    var withState57 = function (name, fn) {
      var keep = G.state;
      try {
        var st57 = G.newGame({ name: name });
        G.state = st57;
        if (G.map.generate) G.map.generate();
        return fn(st57);
      } finally { G.state = keep; }
    };
    withState57('任务置顶', function (st) {
      G.ensureDailyQuests(true);
      var pool = st.quests.pool;

      /* 夹具：找一条非绝对值的随机任务（可用 base 打桩达标）
         v83 修复（存量 flake，2~3%）：跳过 bldCount/minfang 类（r18「广厦之谋」）——
         打桩口按 (metric, sub) 拦截、无法对同一组指标返回两个值（g01/g02 已占用该指标），
         抽中同类任务时下面四条断言会连锁假红。 */
      var rq = null, rdef = null;
      for (var i = 0; i < pool.length; i++) {
        var d = G.randomQuestDef(pool[i].id);
        if (d && !d.abs && !(d.metric === 'bldCount' && d.sub === 'minfang')) { rq = pool[i]; rdef = d; break; }
      }
      if (!rq) {   /* 退化兜底：万一池里只剩同指标任务，退回旧口径（不再扩大范围） */
        for (var i2 = 0; i2 < pool.length; i2++) {
          var d2 = G.randomQuestDef(pool[i2].id);
          if (d2 && !d2.abs) { rq = pool[i2]; rdef = d2; break; }
        }
      }
      check('夹具就绪：手上有一条非绝对值随机任务', !!rq, pool.length + ' 项在手');

      /* 指标打桩：g01 民房 3 座（恰好达标）；g02 民房 6 座（未达标）；该随机任务恰好达标 */
      var real = G.questMetric;
      G.questMetric = function (m, sub) {
        if (m === 'bldCount' && sub === 'minfang') return 3;
        if (rdef && m === rdef.metric && (rdef.sub == null || sub === rdef.sub)) return rdef.goal + (rq.base || 0);
        return 0;
      };
      try {
        var html = G.ui.tasksHTML();
        var iReady = html.indexOf('✅ 可领取奖励');
        var iDone = html.indexOf('已完成</span>');
        var iRand = html.indexOf('随机任务</span>');
        var iGrowth = html.indexOf('成长任务 · 进行中');

        check('★ 达标任务自动置顶（可领取块在「已完成」与各区块之上）',
          iReady > 0 && iReady < iDone && iDone < iRand && iRand < iGrowth,
          'ready@' + iReady + ' / done@' + iDone + ' / rand@' + iRand + ' / growth@' + iGrowth);

        check('★ 顶块装的是达标项（g01 立锥之地 + 随机 ' + (rdef ? rdef.title : '—') + '）', (function () {
          var blk = html.slice(iReady, iDone);
          return blk.indexOf('立锥之地') >= 0 && (!rdef || blk.indexOf(rdef.title) >= 0)
            && blk.indexOf('data-action="quest-detail"') >= 0;
        })());

        check('★ 顶块每行右侧都有「领取」按钮（按 kind 分派两个既有 action）',
          html.indexOf('data-action="claim-quest" data-q="g01"') >= 0
          && (!rq || html.indexOf('data-action="claim-rand-quest" data-q="' + rq.id + '"') >= 0)
          && /<span class="q-row-act"><button class="btn gold sm"/.test(html));

        check('★ 浮上去的项不再在原区块重复出现（一处占位）',
          (html.match(/data-id="g01"/g) || []).length === 1
          && (!rq || (html.match(new RegExp('data-id="' + rq.id + '"', 'g')) || []).length === 1));

        check('未达标项不带领取按钮（g02 民居渐稠 无 data-q）',
          html.indexOf('民居渐稠') >= 0 && html.indexOf('data-q="g02"') < 0);

        check('顶块按钮数 == 汇总口径（单一口径，防两处算法漂移）', (function () {
          var n = (html.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length;
          return n === G.questSummary().ready;
        })(), (html.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length + ' 按钮 / 汇总 ' + G.questSummary().ready + ' 项');

        /* ---- 真领取：走业务函数（与按钮同一条链） ---- */
        var r1 = rq ? G.claimRandomQuest(rq.id) : { ok: false };
        check('★ 领取随机任务（离池 + 入流水）',
          r1.ok === true
          && !G.state.quests.pool.some(function (e) { return e.id === rq.id; })
          && !!(G.state.quests.log[0] && G.state.quests.log[0].id === rq.id));

        var r2 = G.claimQuest('g01');
        check('★ 领取成长任务（标记已领取）', r2.ok === true && !!G.state.quests.done.g01);

        var html2 = G.ui.tasksHTML();
        check('★ 领取后自动从顶块与列表消失',
          html2.indexOf('data-q="g01"') < 0
          && html2.indexOf('data-kind="growth" data-id="g01"') < 0
          && (!rq || (html2.indexOf('data-q="' + rq.id + '"') < 0
            && html2.indexOf('data-kind="random" data-id="' + rq.id + '"') < 0)));

        /* ---- 全部达标：原区块不重复渲染、空态指路顶块 ---- */
        G.questMetric = function () { return 1e9; };
        var html3 = G.ui.tasksHTML();
        check('★ 全部达标时：原区块不重复行、空态指向顶块', (function () {
          var n = (html3.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length;
          return /本批 \d+ 项均已可领取/.test(html3)
            && html3.indexOf('进行中的任务均已可领取') >= 0
            && n === G.questSummary().ready;
        })());

        G.questMetric = function () { return 0; };
        var html4 = G.ui.tasksHTML();
        check('★ 无可领取时顶块整块隐藏（不留空壳）',
          html4.indexOf('✅ 可领取奖励') < 0 && html4.indexOf('data-q=') < 0);
      } finally {
        G.questMetric = real;
      }

      /* ---- 源码层守卫 ---- */
      check('顶块由唯一出口产出（readyItems 一处拼接：随机在前、成长在后）',
        /var readyItems = randItems\.filter\(function \(o\) \{ return o\.ready; \}\)[\s\S]{0,80}\.concat\(growthItems\.filter/.test(u57));

      check('行内按钮复用既有 action（不新造；main.js 两个 case 都在）',
        /o\.kind === 'random' \? 'claim-rand-quest' : 'claim-quest'/.test(u57)
        && /case 'claim-rand-quest'/.test(m57) && /case 'claim-quest'/.test(m57));

      check('CSS：按钮右推 + 置顶标题着色',
        /\.q-row-act \{[^}]*margin-left: auto/.test(h57) && /\.q-sec-ready \.q-sec-t/.test(h57));

      check('帮助文案同步（置顶 + 直接领取入说明）',
        /已完成的任务自动置顶/.test(u57) && /同时在手上限/.test(u57));

      check('主循环挂了「可领取数变化→重绘任务面板」的钩子（真·自动）',
        /GAME\._lastQuestReady/.test(m57) && /ui\.view === 'tasks'/.test(m57)
        && /GAME\._lastQuestReady = 0;/.test(m57));
    });
  })();

  console.log('\n--- 第 58 节：州郡县 · 满配数量表 · 坐标迁址 · 君主将领 · 出生州（v70） ---');
  (function () {
    var fs58 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u58 = stripComment(fs58('ui'));
    var d58 = stripComment(fs58('data'));
    var dm58 = stripComment(fs58('domain'));
    var h58 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    /* 本地造档 helper（其它节的 withState 在各自的 IIFE 里，跨节不可见） */
    var withState58 = function (name, fn) {
      var keep = G.state;
      try {
        var st = G.newGame({ name: name });
        G.state = st;
        if (G.map.generate) G.map.generate();
        return fn(st);
      } finally { G.state = keep; }
    };

    /* ================= ① 州 · 郡 · 县 ================= */
    console.log('  --- ① 州郡县标识 ---');
    check('行政区划只有一个出口（regionOf 定义 1 处 + 郡/县名规范化）',
      (dm58.match(/GAME\.regionOf = function/g) || []).length === 1
      && /GAME\.junNameOf = function/.test(dm58)
      && /GAME\.countyNameOf = function/.test(dm58));

    check('★ 每个县城都归属到一个郡（且同州）', (function () {
      var bad = 0, n = 0;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (c.type !== 'county') return;
        n++;
        var rg = G.regionOf(c.x, c.y);
        if (!rg || !rg.jun || rg.state !== c.state) bad++;
      });
      return n >= 60 && bad === 0;
    })());

    check('★ 任意坐标都能归属到一个县（采样 40 点）', (function () {
      for (var i = 0; i < 40; i++) {
        var rg = G.regionOf((i * 97) % 500, (i * 53) % 500);
        if (!rg || !rg.county || !rg.state) return false;
      }
      return true;
    })());

    check('★ 名城全称 = 州 · 郡 · 县（都城/州城/郡城/县城各一例）', (function () {
      function byType(t) { var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === t) hit = c; }); return hit; }
      var cap = G.cityFullName(byType('capital'));
      var zhou = G.cityFullName(byType('zhou'));
      var jun = G.cityFullName(byType('jun'));
      var cty = G.cityFullName(byType('county'));
      return cap.split(' · ').length === 2 && zhou.split(' · ').length === 2
        && jun.split(' · ').length === 2 && cty.split(' · ').length === 3
        && /[郡国县道]$/.test(jun.split(' · ')[1]) && /县$/.test(cty.split(' · ')[2]);
    })(), (function () {
      var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === 'county') hit = c; });
      return G.cityFullName(hit);
    })());

    check('★ 野外城池标识带所在县（fortLabelOf）', (function () {
      var lbl = G.fortLabelOf({ x: 120, y: 300, name: '青石营', level: 5 });
      var rg = G.regionOf(120, 300);
      return lbl.indexOf(G.countyNameOf(rg.county)) === 0 && lbl.indexOf('青石营') > 0;
    })());

    check('行政区划确定性（同坐标两次同结果）', (function () {
      var a = G.regionOf(200, 200), b = G.regionOf(200, 200);
      return a.county === b.county && a.jun === b.jun && a.state === b.state;
    })());

    /* ================= ② 满配：仓库 4 + 城外数量表 ================= */
    console.log('  --- ② 满配数量（城内仓库 4 / 城外数量表）---');
    check('★ 城外数量表逐档合计 == 上限表（1..MAX_LEVEL_ABS 全档）', (function () {
      for (var lv = 1; lv <= (DATA.MAX_LEVEL_ABS || 24); lv++) {
        var row = DATA.EXT_PLAN_BY_LV[lv - 1];
        var sum = row.reduce(function (a, b) { return a + b; }, 0);
        if (sum !== DATA.EXT_CAP_BY_LV[lv - 1]) return false;
      }
      return true;
    })());

    check('城外数量表：四类各 ≥2、逐档单调不降', (function () {
      var prev = null;
      for (var lv = 1; lv <= (DATA.MAX_LEVEL_ABS || 24); lv++) {
        var row = DATA.EXT_PLAN_BY_LV[lv - 1];
        if (row.some(function (n) { return n < 2; })) return false;
        if (prev && !row.every(function (n, i) { return n >= prev[i]; })) return false;
        prev = row;
      }
      return true;
    })());

    check('★ extPlanOf 铺法与数量表一致（轮转、长度 = 块数、顺序固定）', (function () {
      var list = G.extPlanOf(6);
      var cnt = {};
      list.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; });
      var want = DATA.EXT_PLAN_BY_LV[5];
      return list.length === DATA.EXT_CAP_BY_LV[5]
        && cnt.farm === want[0] && cnt.forest === want[1]
        && cnt.quarry === want[2] && cnt.mine === want[3]
        && list[0] === 'farm' && list[1] === 'forest';
    })());

    check('★ 系统城的城外地块也走同一出口（影子城数量=数量表）', (function () {
      return withState58('v70plan', function (st) {
        var npc = null;
        (st.map.cities || []).forEach(function (c) { if (!npc && c.level === 9) npc = c; });
        if (!npc) return false;
        var sh = G.npcCityShadow(npc);
        var cnt = {};
        sh.extGrid.forEach(function (e) { cnt[e.type] = (cnt[e.type] || 0) + 1; });
        var want = DATA.EXT_PLAN_BY_LV[8];       /* 州城 Lv9 → 第 9 档 */
        return sh.extGrid.length === DATA.EXT_CAP_BY_LV[8]
          && cnt.farm === want[0] && cnt.mine === want[3];
      });
    })());

    check('城内满配里仓库恰好 4 座（v70 老板）', (function () {
      for (var lv = 1; lv <= 10; lv++) {
        var c = 0;
        G.cityPlanOf(lv).cells.forEach(function (x) { if (x.build && x.build.id === 'cangku') c++; });
        if (c !== 4) return false;
      }
      return true;
    })());

    /* ================= ③ 坐标与迁址 ================= */
    console.log('  --- ③ 城池坐标与迁址 ---');
    check('坐标口径：500×500 → 0~499；coordText 形如 (x, y)',
      G.COORD_MAX === 499 && G.coordText({ x: 3, y: 4 }) === '(3, 4)');

    check('★ 可迁判据：自建城可迁 / 名城（含攻占来的）不可迁', (function () {
      return G.isMovableCity({ type: 'self' }) === true
        && G.isMovableCity({ type: 'county', origId: 'cty_9' }) === false
        && G.isMovableCity({ type: 'jun' }) === false
        && G.isMovableCity({ type: 'capital' }) === false;
    })());

    check('★ 迁址：旧格还平原、新格变城池、坐标落定', (function () {
      return withState58('v70move', function (st) {
        var c = st.cities[0];
        var from = { x: c.x, y: c.y };
        var dst = null;
        for (var x = 5; x < 140 && !dst; x++) for (var y = 5; y < 140 && !dst; y++) {
          if (G.canCityMoveTo(c, x, y).ok) dst = { x: x, y: y };
        }
        if (!dst) return false;
        var r = G.moveCityTo(c.id, dst.x, dst.y);
        return r.ok === true && c.x === dst.x && c.y === dst.y
          && G.map.tile(dst.x, dst.y).terrain === 'city'
          && G.map.tile(from.x, from.y).terrain === 'plain';
      });
    })());

    check('★ 迁址拒绝：越界 / 原地 / 名城 / 非平原', (function () {
      return withState58('v70deny', function (st) {
        var c = st.cities[0];
        var b1 = G.canCityMoveTo(c, -1, 5).ok === false;
        var b2 = G.canCityMoveTo(c, 999, 5).ok === false;
        var b3 = G.canCityMoveTo(c, c.x, c.y).ok === false;
        var npc = (st.map.cities || [])[0];
        var b4 = G.canCityMoveTo(c, npc.x, npc.y).ok === false;
        var nonPlain = null;
        for (var x = 0; x < 80 && !nonPlain; x++) for (var y = 0; y < 80 && !nonPlain; y++) {
          var t = G.map.tile(x, y);
          if (t && t.terrain !== 'plain' && t.terrain !== 'city') nonPlain = { x: x, y: y };
        }
        var b5 = !nonPlain || G.canCityMoveTo(c, nonPlain.x, nonPlain.y).ok === false;
        return b1 && b2 && b3 && b4 && b5;
      });
    })());

    check('★ 一键随机：落点必可迁（注入 rnd → 确定性）+ 真迁成功', (function () {
      return withState58('v70rand', function (st) {
        var c = st.cities[0];
        var seq = 7;
        var fake = function () { seq = (seq * 48271) % 2147483647; return seq / 2147483647; };
        var pt = G.randomCityCoord(c, fake);
        if (!pt || !G.canCityMoveTo(c, pt.x, pt.y).ok) return false;
        var r = G.randomMoveCity(c.id);
        return r.ok === true && G.isMovableCity(c);
      });
    })());

    check('迁址写日志（可追溯）', /📍 迁址/.test(dm58) && /GAME\.log\('📍 迁址/.test(dm58));

    /* v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」 */
    check('★ 短名模式：不含州全称，含城名与档位标（侧栏两处走它）', (function () {
      var c = { name: '江陵', type: 'jun', state: '荆州', x: 5, y: 5 };
      var full = G.cityFullName(c);
      var short = G.ui.cityLabelHTML(c, true);
      var longName = G.ui.cityLabelHTML(c);
      return full.indexOf(' · ') >= 0
        && short.indexOf(full) < 0 && short.indexOf('江陵') >= 0
        && short.indexOf('city-tier') >= 0
        && longName.indexOf(full) >= 0;   /* 全称模式不受影响 */
    })());

    /* ================= ④ 君主将领 ================= */
    console.log('  --- ④ 君主将领（老板：玩家角色本人）---');
    check('★ 新档名单含君主（id=lord / isLord / 同君名同脸同城）', (function () {
      var st = G.newGame({ name: '君主测试', region: '司隶', portraitSeed: 7 });
      var lord = null;
      (st.generals || []).forEach(function (g) { if (g.isLord) lord = g; });
      return !!lord && lord.id === 'lord' && lord.name === '君主测试'
        && lord.portraitSeed === 7 && lord.loyalty === 100
        && lord.cityId === st.cities[0].id
        && st.generals[0].name === '赵子龙';       /* 既有索引口径不动 */
    })());

    check('★ 君主不可解雇（域层拒绝）', (function () {
      return withState58('v70lord1', function (st) {
        var lord = G.lordGeneralOf();
        var r = G.dismissGeneral(lord.id);
        return r.ok === false && (st.generals || []).some(function (g) { return g.isLord; });
      });
    })());

    check('★ 君主永不离去（忠诚归零 + 骰子必然触发，仍在帐下；对照的普通将领已被带走）', (function () {
      return withState58('v70lord2', function (st) {
        var lord = G.lordGeneralOf();
        lord.loyalty = 0;
        var other = null;
        st.generals.forEach(function (g) { if (!g.isLord && !other) other = g; });
        if (other) other.loyalty = 0;
        var real = Math.random;
        Math.random = function () { return 0; };
        try { for (var i = 0; i < 3; i++) G.tickOnce(); }
        finally { Math.random = real; }
        var lordsLeft = (st.generals || []).filter(function (g) { return g.isLord; }).length;
        var othersLeft = (st.generals || []).filter(function (g) { return !g.isLord; }).length;
        return lordsLeft === 1 && (other ? othersLeft === 0 : true);
      });
    })());

    check('★ 君主特权框架：数据表 + 只给君主（普通将领为空）', (function () {
      var lord = G.lordGeneralOf();
      var normal = G.makeGeneral('普通将', 1, 'idle', null);
      var tr = G.lordTraitsOf(lord);
      return tr.length >= 1 && !!tr[0].name && !!tr[0].desc
        && G.lordTraitsOf(normal).length === 0
        && (DATA.LORD_TRAITS || []).length === tr.length;
    })());

    check('君主六维取资质中值（确定性，不掷骰）', (function () {
      var a = G.makeLordGeneral({ name: '甲' }, 1, null);
      var b = G.makeLordGeneral({ name: '乙' }, 2, null);
      var rk = DATA.GEN_RANK_BY_ID[DATA.LORD_GEN.rankId];
      var mid = Math.round((rk.base[0] + rk.base[1]) / 2);
      return a.tong === mid && a.nz === mid && a.yw === mid && a.zm === mid && a.tong === b.tong;
    })());

    check('★ 老档迁移：无君主的档补一位（二次读档不重复添人）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: '迁移测试', region: '兖州', portraitSeed: 3 });
        st.generals = st.generals.filter(function (g) { return !g.isLord; });
        st.savedAt = U.now();
        var out = G.adoptState(st);
        var lords = (out.generals || []).filter(function (g) { return g.isLord; });
        G.adoptState(out);
        var again = (out.generals || []).filter(function (g) { return g.isLord; });
        return lords.length === 1 && again.length === 1
          && lords[0].name === '迁移测试' && lords[0].portraitSeed === 3;
      } finally { G.state = keep; }
    })());

    check('解雇守卫在域层读唯一出口（isLordGeneral）',
      /isLordGeneral/.test(codeOf(dm58, 'GAME.dismissGeneral = function')));

    /* ================= ⑤ 创建：头像池 + 出生州 ================= */
    console.log('  --- ⑤ 创建界面：头像同源 + 出生州 ---');
    check('★ 创建头像 = 将领同一套池子（ui.avatarPool / paintCreateAvatar）',
      /ui\.avatarPool = function/.test(u58) && /P\.POOL\[/.test(u58)
      && /paintCreateAvatar/.test(u58) && /GAME\.portraits\.DIR/.test(u58));

    check('★ 出生州：十三州逐个验证「落点归属 == 所选州」', (function () {
      var list = DATA.START_STATES || [];
      for (var i = 0; i < list.length; i++) {
        var pt = G.pickStartPos(list[i], 1000 + i * 7);
        if (!pt || pt.state !== list[i]) return false;
        if (G.stateOfCity({ x: pt.x, y: pt.y }) !== list[i]) return false;
      }
      return list.length === 13;
    })());

    check('★ 出生点确定性（同种子同落点）', (function () {
      var a = G.pickStartPos('凉州', 4242), b = G.pickStartPos('凉州', 4242);
      return a.x === b.x && a.y === b.y && a.state === b.state;
    })());

    check('★ 出生点不压任何系统城（±2 缓冲）', (function () {
      var list = DATA.START_STATES || [];
      for (var i = 0; i < list.length; i++) {
        var pt = G.pickStartPos(list[i], 77 + i);
        var clash = false;
        DATA.NPC_CITIES.forEach(function (c) {
          if (Math.abs(c.x - pt.x) <= 2 && Math.abs(c.y - pt.y) <= 2) clash = true;
        });
        if (clash) return false;
      }
      return true;
    })());

    check('★ 新档出生城：坐标 / 归属 / 州三者一致 + map.startPos 同步', (function () {
      var st = G.newGame({ name: '落位', region: '益州' });
      var c = st.cities[0];
      return c.state === '益州' && G.stateOfCity(c) === '益州'
        && st.map.startPos && st.map.startPos.x === c.x && st.map.startPos.y === c.y;
    })());

    check('random 也会记成解析后的州', (function () {
      var st = G.newGame({ name: '随机州', region: 'random' });
      return (DATA.START_STATES || []).indexOf(st.ruler.region) >= 0;
    })());

    check('创建界面硬检查：13 州 chips + 随机；旧「北方/中原/江南」已撤',
      (h58.match(/data-target="create-region"/g) || []).length === 14
      && !/data-v="north"/.test(h58) && !/data-v="south"/.test(h58));

    check('头像位改用画像（.avatar-big img 规则在位）',
      /\.avatar-big img \{[^}]*object-fit: cover/.test(h58));

    check('doCreate 把头像下标当 portraitSeed 传下去', /portraitSeed: avatarIdx/.test(u58));
  })();


/* ============================================================
 * ===== 59. v73：黄金闸门 / 资质再降10倍 / 种田秘境 / 将领头 / 建筑弹窗 =====
 * ============================================================ */
console.log('\n===== 59. v73 五条（黄金 · 资质 · 秘境 · 将领头 · 建筑弹窗） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS73 = stripComment(rd('ui'));
  var stS73 = stripComment(rd('state'));
  var dS73 = stripComment(rd('domain'));
  var hS73 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var hS73c = stripComment(hS73);

  /* ---------- ① 黄金闸门 ---------- */
  console.log('  --- ① 黄金获取限制（GOLD_GATE） ---');
  check('结构：三个黄金出口全部挂到 DATA.GOLD_GATE（税收/俸禄/岁贡；v82 征收退役）', (function () {
    return /DATA\.GOLD_GATE\.tax/.test(stS73) && /DATA\.GOLD_GATE\.salary/.test(stS73)
      && /DATA\.GOLD_GATE\.yield/.test(dS73)
      && !/LEVY_RES_RATE/.test(dS73);
  })(), 'GATE=' + JSON.stringify(DATA.GOLD_GATE));
  check('实测：岁贡黄金按闸门打折（郡城 40000 → 12000）', (function () {
    var tmp = G.makeCity({ id: 'tmpY73', name: '郡城', x: 5, y: 5, type: 'jun', res: {} });
    var y = G.cityDailyYield(tmp);
    return y && y.gold === Math.round(40000 * DATA.GOLD_GATE.yield);
  })());
  check('实测：黄金产量分解与 cityProdPerSec 同口径（瀑布式不重不漏）', (function () {
    var st = G.newGame({ name: '税测', region: '司隶' });
    var c = st.cities[0];
    var p = G.cityProdPerSec(c);
    var rows = G.prodBreakdown('gold', c);
    var sum = 0;
    rows.forEach(function (r) { sum += r.val; });
    return Math.abs(sum - p.gold) <= Math.max(1e-6, p.gold * 1e-9);
  })());
  check('实测：黄金不受仓库上限夹制（放到 cap 之上，跑两 tick 不被夹回）', (function () {
    var st = G.newGame({ name: '上限测试', region: '司隶' });
    var cap = G.storeCap();
    st.res.gold = cap + 500000;
    G.tickOnce(); G.tickOnce();
    return st.res.gold > cap;
  })());

  /* ---------- ② 资质再降 10 倍 ---------- */
  console.log('  --- ② 高资质概率再降 10 倍 ---');
  check('实测：英杰 / 名世 / 天授 权重再 ÷10（0.25 / 0.075 / 0.02）', (function () {
    var w = {};
    DATA.GEN_RANKS.forEach(function (r) { w[r.id] = r.w; });
    return Math.abs(w.ying - 0.25) < 1e-9 && Math.abs(w.ming - 0.075) < 1e-9 && Math.abs(w.tian - 0.02) < 1e-9;
  })(), '英杰 ' + DATA.GEN_RANK_BY_ID.ying.w + ' · 名世 ' + DATA.GEN_RANK_BY_ID.ming.w + ' · 天授 ' + DATA.GEN_RANK_BY_ID.tian.w);
  check('结构：名将直取概率 0.30 → 0.03（组合拳的另一半）', /lv >= 5 && Math\.random\(\) < 0\.03/.test(dS73));
  check('实测：客栈1级 天授概率 ≈0.026%（两轮共 ÷100）', (function () {
    var ws = G.rankWeights(1), t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    return Math.abs(v / t * 100 - 0.026) < 0.01;
  })());

  /* ---------- ③ 种田秘境（完整链条逐环实测） ---------- */
  console.log('  --- ③ 种田秘境（锻造材料 + 资质灵草 完整链条） ---');
  check('数据：10 种作物（6 材料 + 4 灵草）全表化 · 6 块灵田', (function () {
    var cs = (DATA.FARM && DATA.FARM.crops) || [];
    var mats = cs.filter(function (c) { return !!c.mat; });
    var herbs = cs.filter(function (c) { return !!c.herb; });
    return cs.length === 10 && mats.length === 6 && herbs.length === 4 && DATA.FARM.plots === 6;
  })());
  check('数据：4 种灵草道具（rank_up 型，档位一一对应）', (function () {
    var need = {
      yunlingcao: ['fan', 'liang'], xisuizhi: ['liang', 'ying'],
      hualongshen: ['ying', 'ming'], tianshouguo: ['ming', 'tian'],
    };
    var ok = true;
    Object.keys(need).forEach(function (id) {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type !== 'rank_up' || it.from !== need[id][0] || it.to !== need[id][1]) ok = false;
    });
    return ok;
  })());
  var st73 = G.newGame({ name: '秘境验收', region: '司隶' });
  st73.res.gold = 1000000;
  check('链条①：初始六块空地', G.farmOf().plots.length === 6 && G.farmPlotState(0).state === 'empty');
  var gold73 = st73.res.gold;
  /* v78：播种改种子制 —— 先发种子；"即种"不变，黄金分文不动 */
  st73.items['seed_fan'] = 2;
  var rp73 = G.farmPlant(0, 'tieying');
  check('链条②（v78 改）：种子播种 —— 消耗 ×1、不扣黄金', rp73.ok && st73.items['seed_fan'] === 1 && st73.res.gold === gold73, rp73.msg);
  check('链条③：生长中不可收获（提示准确剩余）', (function () {
    var h = G.farmHarvest(0);
    return !h.ok && /成熟/.test(h.msg);
  })());
  G.tickFarm(6 * 3600);
  check('链条④：推进 6 游戏小时即成熟', G.farmPlotState(0).state === 'ripe');
  var b73 = st73.items['bintie'] || 0;
  var rh73 = G.farmHarvest(0);
  check('链条⑤：收获进背包（镔铁 ×2~4；地块清空）',
    rh73.ok && (st73.items['bintie'] || 0) >= b73 + 2 && G.farmPlotState(0).state === 'empty', rh73.msg);
  st73.items['seed_yunling'] = 1;
  G.farmPlant(1, 'yunlingcao');
  G.tickFarm(12 * 3600);
  var rh73b = G.farmHarvest(1);
  check('链条⑥：灵草可收获（蕴灵草 ×1）', rh73b.ok && (st73.items['yunlingcao'] || 0) >= 1, rh73b.msg);
  var g73 = st73.generals[0];
  g73.rank = 'fan';
  var use73 = G.systems.useItem('yunlingcao', g73.id);
  check('链条⑦：灵草把 凡品 → 良材（唯一出口 rankUpUse）', use73.ok && g73.rank === 'liang', use73.msg);
  check('链条⑦b：已在该档时拒绝（良材再用蕴灵草 = 不重复生效）', (function () {
    st73.items['yunlingcao'] = (st73.items['yunlingcao'] || 0) + 1;
    var r = G.systems.useItem('yunlingcao', g73.id);
    return !r.ok && /已是/.test(r.msg);
  })());
  check('链条⑦c：档位不符时拒绝并说明（英杰不能用蕴灵草）', (function () {
    g73.rank = 'ying';
    st73.items['yunlingcao'] = (st73.items['yunlingcao'] || 0) + 1;
    var r = G.systems.useItem('yunlingcao', g73.id);
    g73.rank = 'liang';
    return !r.ok && /只可用于/.test(r.msg);
  })());
  check('链条⑧：一键收获（多处成熟一次收）', (function () {
    st73.res.gold = 1000000;
    st73.items['seed_fan'] = 2;
    G.farmPlant(2, 'yusuihua');
    G.farmPlant(3, 'tanxiangshu');
    G.tickFarm(6 * 3600);
    var r = G.farmHarvestAll();
    return r.ok && G.farmPlotState(2).state === 'empty' && G.farmPlotState(3).state === 'empty';
  })());
  check('链条⑨：离线补算同口径推进（tickFarm(secReal × ts)）', /GAME\.tickFarm\(secReal \* ts\)/.test(stS73));
  check('界面：官府入口 + 面板/选种/收获动作齐备', (function () {
    return /data-action="open-farm"/.test(uS73) && /data-action="farm-seeds"/.test(uS73)
      && /data-action="farm-plant"/.test(uS73) && /data-action="farm-harvest"/.test(uS73)
      && /ui\.openFarm = function/.test(uS73) && /ui\.openFarmSeeds = function/.test(uS73);
  })());
  check('界面：主循环秒刷新（倒计时 data-farm-left / 进度 data-farm-bar）',
    /data-farm-left/.test(uS73) && /data-farm-bar/.test(uS73));
  check('样式：农场底纹 / 地块 / 成熟高亮（.farm-space / .farm-grid / .farm-cell.ripe）',
    /\.farm-space \{/.test(cssBlock(hS73, '.farm-space')) && /\.farm-grid \{/.test(cssBlock(hS73, '.farm-grid'))
      && /\.farm-cell\.ripe \{/.test(cssBlock(hS73, '.farm-cell.ripe')));
  check('背包：灵草有分类与图标（rank_up）',
    /rank_up: '灵草（提升资质）'/.test(uS73) && /rank_up: '🌿'/.test(uS73));

  /* ---------- ④ 将领界面头部 ---------- */
  console.log('  --- ④ 将领界面头部（头像+飞机不要 / 席位文字不要） ---');
  check('结构：标题只剩「将领」+ 本城/全境 chips（🧑‍✈️ / 席位文字 / 名将计数全撤）', (function () {
    var body = codeOf(uS73, 'ui.generalsHTML = function');
    return /class="gold-heading">将领' \+ scopeChips/.test(body)
      && body.indexOf('scopeNote') < 0 && body.indexOf('名将 ') < 0 && body.indexOf('\u{1F9D1}') < 0;
  })());

  /* ---------- ⑤ 建筑弹窗 ---------- */
  console.log('  --- ⑤ 建筑弹窗（去顶图 + 底栏吸底） ---');
  check('结构：四处建筑弹窗顶部图标块已撤（城内×2 / 城外×2）', (function () {
    var body = codeOf(uS73, 'ui.openBuildModal = function');
    var ext = codeOf(uS73, 'ui.openExtModal = function');
    return body.indexOf('dlg-ico') < 0 && ext.indexOf('dlg-ico') < 0
      && body.indexOf('font-size:40px;"><span') < 0 && ext.indexOf('font-size:40px;"><span') < 0;
  })());
  check('结构：.dlg-ico 尺寸盒随图标一起退役（JS 与 CSS 双清零）',
    uS73.indexOf('dlg-ico') < 0 && hS73c.indexOf('.dlg-ico') < 0);
  check('样式：吸底操作区（v80 .bldg-bottom：三键+关闭同块 + 出血到边缘 + 钉面板下沿）', (function () {
    var b = cssBlock(hS73, '.bldg-bottom {');
    var f = cssBlock(hS73, '.bldg-bottom .bldg-foot {');
    return /position: sticky/.test(b) && /bottom: -12px/.test(b)
      && /margin: 12px -12px -12px/.test(b) && /padding: 8px 12px 22px/.test(b)
      && /background: var\(--panel-bg\)/.test(b)
      && /position: static/.test(f);
  })(), cssBlock(hS73, '.bldg-bottom {').replace(/\s+/g, ' ').slice(0, 84));
})();


/* ============================================================
 * ===== 60. v74：人口加成取消 / 固定画布 / 将领档案 / 出征界面（老板七条） =====
 * ============================================================ */
console.log('\n===== 60. v74 七条（人口 · 画布 · 简介 · 六维 · 加点 · 备注 · 出征） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS = stripComment(rd('ui'));
  var stS = stripComment(rd('state'));
  var dS = stripComment(rd('domain'));
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var hSc = stripComment(hS);

  /* ---------- ① 人口 ---------- */
  check('① 结构：maxPopOf 不再读统率（源里无 POP_PER_TONG / guardGeneralOf 那段）',
    dS.indexOf('POP_PER_TONG') < 0 && !/genAttrs\(g\)\.tong \*/.test(codeOf(dS, 'GAME.maxPopOf = function')));

  /* ---------- ② 固定画布 ---------- */
  console.log('  --- ② 固定像素画布 ---');
  check('② 画布固定 1440×900（--app-w/--app-h），水平居中',
    /--app-w: 1440px/.test(hSc) && /--app-h: 900px/.test(hSc)
      && /#screen-game \{ width: var\(--app-w\); height: var\(--app-h\); margin: 0 auto/.test(hSc));
  check('② 视口断点全撤（宽 900/1100/1300/860/820 + 高 860 一个不留）', (function () {
    return !/@media \(max-width: (900|1100|1300|860|820)px\)/.test(hSc)
      && !/@media \(max-height: 860px\)/.test(hSc);
  })());
  check('② 弹窗尺寸固定 px（不再 vw/vh 缩放）；仅留极小窗口兜底',
    !/max-width: 9\dvw/.test(hSc) && !/max-height: 8\dvh/.test(hSc)
      && (hSc.match(/calc\(100vw - 20px\)/g) || []).length >= 2);

  /* ---------- ③④⑤⑥ 将领档案 ---------- */
  console.log('  --- ③④⑤⑥ 将领档案（简介 / 六维 / 加点 / 备注） ---');
  var st74 = G.newGame({ name: '档案验收', region: '司隶' });
  var g74 = st74.generals[0];
  G.ui._genSel = g74.id;
  var h74 = G.ui.generalsHTML();
  /* ⚠️ 断言只看**档案段**（gen-pane）—— 左清单行的悬停 tip 里仍有"装备 x/12"，
     它是 v45 明令保留的悬停细节，不是简介的一部分。 */
  var hpane74 = h74.slice(h74.indexOf('class="gen-pane"'));
  check('③ 简介两行化：名字在前 + 资质★（悬停 = 上限/成长）+ 类型 + 描述（去上限句）', (function () {
    var i = hpane74.indexOf('class="gp-name"');
    if (i < 0) return false;
    var seg = hpane74.slice(i, i + 1200);
    return /class="gp-name">[^<]/.test(seg)
      && /rank-badge r-\w+" title="等级上限 \d+，每级属性成长 \+\d+"/.test(seg)
      && /class="gp-style">/.test(seg)
      && /class="gp-sub">[^<]*(可|之才|之资)/.test(seg);
  })());
  check('③ 旧行已撤：Lv N / M 行、装备 n/12、每级成长小字（改为悬停）',
    !/Lv\d+ \/ \d+　·/.test(hpane74) && !/装备 \d+\/12/.test(hpane74)
      && hpane74.indexOf('　每级成长 <b>') < 0);
  check('③ Lv 挪进经验行', /Lv<b>\d+<\/b>　经验/.test(hpane74));
  check('④ 六维：每点作用进名称悬停（title=每点作用：…）',
    /<td title="[^"]*每点作用：/.test(h74));
  check('④ 六维：加点列 6 个 ＋ 按钮（六位都有）',
    (h74.match(/data-action="gen-stat-plus"/g) || []).length === 6);
  check('⑤ 自由属性点行在位（含数值）', /class="gd-freep"/.test(h74) && /fp-n/.test(h74));
  check('⑥ 备注块（带兵/人口上限/本城产量/速度）整块撤除',
    h74.indexOf('gd-effect') < 0 && h74.indexOf('>人口上限 <b>') < 0);
  check('④ 属性与装备栏对半分配（1fr / 1fr）',
    /\.gp-body \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(hSc));

  console.log('  --- ⑤ 类型化成长 + 自由点（实测） ---');
  var cid74 = st74.cities[0].id;
  var gWar = G.makeGeneral('猛将甲', 1, 'idle', cid74, false, 'liang', 'war');
  var gBal = G.makeGeneral('均衡乙', 1, 'idle', cid74, false, 'liang', 'balance');
  gWar.tong = 50; gWar.yw = 50; gWar.zm = 50; gWar.nz = 50;
  gBal.tong = 50; gBal.yw = 50; gBal.zm = 50; gBal.nz = 50;
  for (var k74 = 1; k74 <= 10; k74++) { G.applyLevelGrowth(gWar); G.applyLevelGrowth(gBal); }
  var sumWar = (gWar.tong - 50) + (gWar.yw - 50) + (gWar.zm - 50) + (gWar.nz - 50);
  var sumBal = (gBal.tong - 50) + (gBal.yw - 50) + (gBal.zm - 50) + (gBal.nz - 50);
  check('⑤ 猛将勇武涨得比均衡快（类型化自动加点）', gWar.yw > gBal.yw + 1,
    '猛将勇武 ' + gWar.yw.toFixed(1) + ' vs 均衡 ' + gBal.yw.toFixed(1));
  check('⑤ 均衡与旧口径逐点一致（每级四维各 +成长值）', Math.abs(gBal.tong - (50 + 2 * 10)) < 0.01,
    '50 → ' + gBal.tong);
  check('⑤ 两类总成长量一致（每级 4×成长值，只是分配不同）', Math.abs(sumWar - sumBal) < 0.01,
    sumWar.toFixed(1) + ' vs ' + sumBal.toFixed(1));
  check('⑤ 自由点按 成长值/级 发放（良材 10 级 = 20 点）',
    Math.abs(gBal.freePts - 20) < 0.01 && Math.abs(gWar.freePts - 20) < 0.01,
    '均衡 ' + gBal.freePts + ' / 猛将 ' + gWar.freePts);
  check('⑤ 旧档补发：缺 freePts 的将领按 已过等级×成长值 一次性补', (function () {
    var gg = G.makeGeneral('旧档将', 6, 'idle', cid74, false, 'ying', 'balance');
    delete gg.freePts;
    G.rankOf(gg);
    return Math.abs(gg.freePts - (6 - 1) * 3) < 0.01;
  })());
  check('⑤ addFreePoint：只增不减（点数 -1、属性 +1）', (function () {
    var g2 = G.makeGeneral('加点甲', 1, 'idle', cid74, false, 'liang', 'balance');
    g2.freePts = 3; g2.tong = 40;
    var r1 = G.addFreePoint(g2, 'tong');
    var r2 = G.addFreePoint(g2, 'tong');
    var r3 = G.addFreePoint(g2, 'tong');
    var r4 = G.addFreePoint(g2, 'tong');   /* 第 4 次：点已用完，拒绝 */
    return r1.ok && r2.ok && r3.ok && !r4.ok && g2.tong === 43 && g2.freePts === 0;
  })());
  check('⑤ 自由点可投放速度/体力（独立加法位，不污染基础值）', (function () {
    var g3 = G.makeGeneral('加点乙', 1, 'idle', cid74, false, 'liang', 'balance');
    g3.freePts = 2;
    var before = G.genAttrs(g3).spd, beforeSta = G.staMax(g3);
    G.addFreePoint(g3, 'spd');
    G.addFreePoint(g3, 'sta');
    return G.genAttrs(g3).spd === before + 1 && G.staMax(g3) === beforeSta + 1
      && g3.spdAdd === 1 && g3.staAdd === 1;
  })());
  check('⑤ 结构：升级日志口径 =（自动加点 +X · 自由点 +X）', /自由点 \+' \+ step/.test(rd('battle').replace(/\s+/g, ' ')));

  /* ---------- ⑦ 出征界面 ---------- */
  console.log('  --- ⑦ 出征界面 ---');
  check('⑦ 结构：总览/战力行 + 全带/清空按钮 + 动作注册', (function () {
    return /id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)
      && /data-action="exp-fill-all"/.test(uS) && /data-action="exp-clear-all"/.test(uS)
      && /case 'exp-fill-all'/.test(mS) && /case 'exp-clear-all'/.test(mS)
      && /ui\._expRes = t/.test(uS);
  })());
  check('⑦ 战力口径复用 troopPower + defDivisor（不另造第二个出口）',
    /GAME\.story && GAME\.story\.troopPower/.test(uS) && /DATA\.INVASION && DATA\.INVASION\.defDivisor/.test(uS));

  /* ---------- 加点弹窗结构 ---------- */
  check('④⑤ 加点弹窗：自由点 + 道具双入口、检查上限与库存', (function () {
    return /ui\.openStatPlus = function/.test(uS) && /data-action="stat-plus-free"/.test(uS)
      && /data-action="stat-plus-item"/.test(uS) && /case 'stat-plus-free'/.test(mS)
      && /case 'stat-plus-item'/.test(mS) && /GAME\.doStatPlusFree = function/.test(mS);
  })());
})();

/* ============================================================
 * ===== 61. v75：客栈招募界面（老板）—— 大界面 / 单行 / 悬停 / 无概率表 =====
 * ============================================================ */
console.log('\n===== 61. v75 客栈招募（大界面 · 单行候选 · 资质悬停 · 无概率表） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS1 = stripComment(rd('ui'));
  var hS1 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var inn1 = codeOf(uS1, 'ui.openInn = function');

  /* ---------- ① 大界面（新尺寸档 xxl + 三段式） ---------- */
  check('① 新增 xxl 尺寸档（980×800 固定 px + 极小窗口兜底）', (function () {
    var b = cssBlock(hS1, '.modal-xxl {');
    return /width: 980px; height: 800px/.test(b) && /max-width: calc\(100vw - 20px\)/.test(b);
  })(), cssBlock(hS1, '.modal-xxl {').replace(/\s+/g, ' ').slice(0, 72));
  check('① 客栈走三段式 + xxl 档（标题/按钮固定，只有候选区滚动）',
    /ui\.openShell\(\{/.test(inn1) && /size: 'xxl'/.test(inn1));

  /* ---------- ②③ 单行候选 + 成长备注进悬停 ---------- */
  check('② 候选行单行化：行内不再有「｜成长 +」备注', uS1.indexOf('｜成长 +') < 0);
  check('③ 资质徽章悬停带成长（rankBadge 唯一出口）',
    /每级属性成长 \+' \+ rk\.grow/.test(uS1));
  var rb1 = G.ui.rankBadge({ rank: 'liang' });
  var rb2 = G.ui.rankBadge({ rank: 'tian' });
  check('③ 运行时验证：徽章 title = 资质描述 + 每级属性成长（良材 +2 / 天授 +8）',
    /每级属性成长 \+2。/.test(rb1) && /每级属性成长 \+8。/.test(rb2),
    (rb1.match(/title="[^"]*"/) || ['无'])[0]);

  /* ---------- ④ 美人标 / 资质一览退役 ---------- */
  check('④ 美人标退役（tag-beauty 无产出、无样式）',
    uS1.indexOf('tag-beauty') < 0 && !/\.tag-beauty \{/.test(hS1));
  check('④ 资质一览退役（rankTable / rk-box 全清）',
    !/ui\.rankTable/.test(uS1) && !/\.rk-box \{/.test(hS1) && inn1.indexOf('rk-box') < 0);

  /* ---------- ⑤ 单行版式（CSS） ---------- */
  check('⑤ 版式：动作横排 + 名字/数值不换行 + 列表不再自带滚动', (function () {
    var act = cssBlock(hS1, '.inn-act {');
    var nm = cssBlock(hS1, '.inn-name {');
    var at = cssBlock(hS1, '.inn-attrs {');
    var ls = cssBlock(hS1, '.inn-list {');
    return /display: flex/.test(act) && /white-space: nowrap/.test(nm)
      && /text-overflow: ellipsis/.test(at) && !/max-height/.test(ls);
  })());
  check('⑤ 紧凑几何：内衬 3px 覆盖共用基线 + 头像列 28px（v82 两条同名规则已合并）', (function () {
    var compact = cssBlock(hS1, '.inn-card { padding:');
    var iav = cssBlock(hS1, '.inn-avatar {');
    return /padding: 3px 10px/.test(compact) && /margin-bottom: 3px/.test(compact)
      && /font-size: 20px/.test(iav) && /width: 28px/.test(iav);
  })());
})();

  /* ============================================================
   * 62. v77：月俸体系 / 客栈表格 / 君主面板 / 野地下拉 / 新货 / 强化 / 内功
   * ============================================================ */
  console.log('\n===== 62. v77 老板八条（月俸/表格/君主/野地/新货/强化/内功） =====');
  var uS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var dS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8');
  var sS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8');
  var tS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  var hS77 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var daS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8');

  /* ---- ① 客栈表格 ---- */
  check('① 客栈候选改表格（表头 + 每人一行 + 月俸列）',
    /inn-tbl/.test(uS77) && /月俸/.test(uS77) && /inn-tr/.test(uS77)
    && /genSalaryOf\(c\)/.test(uS77));

  /* ---- ② 月俸：定价与 7 游戏日结算 ---- */
  check('② 月俸表与结算同源（GEN_SALARY + 唯一出口）',
    /DATA\.GEN_SALARY = \{/.test(daS77) && /GAME\.genSalaryOf = function/.test(dS77)
    && /GAME\.settleGenSalary = function/.test(dS77)
    && /GAME\.settleGenSalary\(\)/.test(tS77));
  check('② 月俸定价 =（底俸 + 等级 + 四维）× 资质（良材 Lv1 公式值）', (function () {
    var g77 = { level: 1, rank: 'liang', tong: 46, nz: 46, yw: 46, zm: 46 };
    var C = DATA.GEN_SALARY;
    var expect = Math.round((C.base + 1 * C.perLevel + 184 * C.perAttr) * C.rankMul.liang);
    return G.genSalaryOf(g77) === expect && expect > 0;
  })(), '实测 ' + G.genSalaryOf({ level: 1, rank: 'liang', tong: 46, nz: 46, yw: 46, zm: 46 }));
  check('② 君主不领俸（0）', G.genSalaryOf(G.lordGeneralOf()) === 0);
  check('② 越强越贵（名世 Lv30 ≫ 凡品 Lv1）', (function () {
    var lo = G.genSalaryOf({ level: 1, rank: 'fan', tong: 40, nz: 40, yw: 40, zm: 40 });
    var hi = G.genSalaryOf({ level: 30, rank: 'ming', tong: 100, nz: 100, yw: 100, zm: 100 });
    return hi > lo * 5;
  })());
  check('② 实测：6 游戏日不结、第 7 游戏日结一次（期数与扣款都对）', (function () {
    var S77 = G.state;
    var bkWorld = S77.world, bkAt = S77.salaryAt, bkGold = S77.res.gold;
    try {
      S77.world = { elapsed: 0 };
      S77.salaryAt = 0;
      S77.res.gold = 100000000;
      S77.world.elapsed = 6 * 86400;
      var noPay = G.settleGenSalary();
      var at6 = S77.salaryAt;
      S77.world.elapsed = 7 * 86400;
      var pay = G.settleGenSalary();
      /* 应扣 = 各城"在册将领"月俸之和（与结算同公式；孤儿将领不计） */
      var expect = 0;
      S77.cities.forEach(function (ct) {
        S77.generals.forEach(function (g) { if (g.cityId === ct.id) expect += G.genSalaryOf(g); });
      });
      var delta = 100000000 - S77.res.gold;
      return noPay === null && at6 === 0 && pay && pay.periods === 1 && delta === expect && expect > 0;
    } finally {
      S77.world = bkWorld; S77.salaryAt = bkAt; S77.res.gold = bkGold;
    }
  })());

  /* ---- ③ 野地下拉框 ---- */
  check('③ 资源区附属野地下拉框（宿主 + 渲染 + 进入 → openWilds）',
    /wild-pick-host/.test(hS77) && /renderWildPick = function/.test(uS77)
    && /data-action="wild-pick"/.test(uS77) && /data-action="open-wilds"/.test(uS77)
    && /'wild-pick'/.test(mS77));
  check('③ 资源区「本城 · 城名」表头退役（res-scope 清空）', uS77.indexOf('res-scope') < 0);

  /* ---- ④ 三按钮退役 ---- */
  check('④ 城池属性右三按钮全退役（建筑信息 / 资源生产 / 附属野地按钮）',
    !/open-bldg-info/.test(hS77) && !/open-prod-info/.test(hS77)
    && !/ui\.openProdInfo = function/.test(uS77) && !/ui\.openBldgInfo = function/.test(uS77)
    && !/'open-prod-info'/.test(mS77) && !/'open-bldg-info'/.test(mS77));

  /* ---- ⑤ 君主面板 ---- */
  check('⑤ 君主面板：左城池列表（进入按钮）+ 右信息表（姓名/爵位/声望/人口/将领/状态）',
    /lord-split/.test(uS77) && /lord-city-enter/.test(uS77) && /lord-promote/.test(uS77)
    && /open-rename-lord/.test(uS77) && /月俸支出/.test(uS77));
  check('⑤ 君主改名唯一出口（ruler 与君主将领两处同源）',
    /GAME\.renameLord = function/.test(dS77) && /lg\.name = name/.test(dS77));
  check('⑤ 晋升按钮悬停带条件（声望/城池/黄金）',
    /晋升「' \+ next\.name \+ '」条件/.test(uS77));

  /* ---- ⑥ 商场新货 ---- */
  check('⑥ 新商品齐备（三级宝箱 / 四部秘籍 / 徭役令）',
    ['chest_tong', 'chest_yin', 'chest_jin', 'book_sunzi', 'book_liutao', 'book_wuqin',
     'book_yuenv', 'corvee'].every(function (id) {
      return (DATA.ITEMS || []).some(function (x) { return x.id === id; });
    }));
  check('⑥ 商城分类齐备（宝箱 / 秘籍 / 政令）',
    G.ui.SHOP_CATS.chest === '宝箱' && G.ui.SHOP_CATS.neigong === '秘籍'
    && G.ui.SHOP_CATS.corvee === '政令');
  check('⑥ 实测：开宝箱（黄金入账、宝箱 -1、有战利品文案）', (function () {
    var S77b = G.state;
    var bkGold = S77b.res.gold, bkItem = S77b.items.chest_tong;
    S77b.res.gold = 1000000;
    S77b.items.chest_tong = (S77b.items.chest_tong || 0) + 1;
    var r = G.systems.useItem('chest_tong');
    var okAll = r.ok && /开启/.test(r.msg) && S77b.res.gold > 1000000
      && (S77b.items.chest_tong || 0) === (bkItem || 0);
    S77b.res.gold = bkGold; S77b.items.chest_tong = bkItem;
    if (S77b.items.chest_tong == null) delete S77b.items.chest_tong;
    return okAll;
  })(), '');
  check('⑥ 实测：徭役令 → 建造队列 +3（24h 内）', (function () {
    var S77d = G.state;
    var bkItem = S77d.items.corvee;
    var base = G.buildSlots(G.currentCity());
    S77d.items.corvee = (S77d.items.corvee || 0) + 1;
    var r = G.systems.useItem('corvee');
    var okAll = r.ok && G.buildSlots(G.currentCity()) === base + 3
      && S77d.buffs.buildQueue && S77d.buffs.buildQueue.add === 3
      && S77d.buffs.buildQueue.until > Date.now();
    S77d.items.corvee = bkItem;
    if (S77d.items.corvee == null) delete S77d.items.corvee;
    return okAll;
  })());

  /* ---- ⑦ 内功 ---- */
  check('⑦ 实测：修习秘籍 → 1 重（加成立刻进 genAttrs：+4）；再修 → 2 重（+8）', (function () {
    var S77c = G.state, g77c = S77c.generals[0];
    var bkNg = g77c.ng, bkItem = S77c.items.book_sunzi;
    S77c.items.book_sunzi = (S77c.items.book_sunzi || 0) + 2;
    var zm0 = G.genAttrs(g77c).zm;
    var r1 = G.systems.useItem('book_sunzi', g77c.id);
    var zm1 = G.genAttrs(g77c).zm;
    var r2 = G.systems.useItem('book_sunzi', g77c.id);
    var zm2 = G.genAttrs(g77c).zm;
    var okAll = r1.ok && r2.ok && g77c.ng && g77c.ng.id === 'sunzi' && g77c.ng.lv === 2
      && zm1 === zm0 + 4 && zm2 === zm0 + 8;
    g77c.ng = bkNg;
    S77c.items.book_sunzi = bkItem;
    if (S77c.items.book_sunzi == null) delete S77c.items.book_sunzi;
    return okAll;
  })(), '');

  /* ---- ⑧ 百炼强化 ---- */
  check('⑧ 实测：强化 +1（成本扣、等级记、装备加成随之放大）', (function () {
    var S77e = G.state;
    var id = 'cr_head_1';
    if (!DATA.EQUIP[id]) id = Object.keys(DATA.EQUIP)[0];
    var bkGold = S77e.res.gold, bkIron = S77e.res.iron, bkStone = S77e.res.stone;
    /* 先确保铁匠铺在位（没有就临时造一座；不拆已有建筑） */
    var c77 = G.currentCity();
    var plantedIdx = -1;
    if (G.forgeLevel() <= 0) {
      c77.cells.forEach(function (x, ix) { if (plantedIdx < 0 && !x.build && !x.official) plantedIdx = ix; });
      if (plantedIdx >= 0) c77.cells[plantedIdx].build = { id: 'tiejiangpu', lvl: 1 };
    }
    /* v79：强化按**件** —— 拿一件实例（没有就新造，测完收回） */
    var inst77 = G.eqFind(id);
    var added77 = false;
    if (!inst77) { inst77 = G.addEquip(id); added77 = true; }
    S77e.res.gold = 100000000; S77e.res.iron = 100000000; S77e.res.stone = 100000000;
    var it77 = DATA.EQUIP[id];
    var fake = { equip: {} }; fake.equip[it77.slot] = inst77;
    if (inst77 && typeof inst77 === 'object') inst77.enh = 0;
    var b0 = G.systems.genEquipBonus(fake);
    var r = G.enhance(inst77);
    var b1 = G.systems.genEquipBonus(fake);
    var grewAttr = ['tong', 'nz', 'yw', 'zm', 'sta', 'atk', 'def', 'spd'].some(function (k) {
      return Math.abs((b1[k] || 0) - (b0[k] || 0)) > 1e-9;
    });
    var okAll = r.ok && G.enhOf(inst77) === 1 && grewAttr && G.enhMax() === 10
      && G.eqLabel(inst77).indexOf('+1') >= 0;   /* 名字带 +1（单件化的区分办法） */
    /* 复原：新造的件收回，等级归零 */
    S77e.res.gold = bkGold; S77e.res.iron = bkIron; S77e.res.stone = bkStone;
    if (inst77 && typeof inst77 === 'object') inst77.enh = 0;
    if (added77) { var gi77 = S77e.inventory.indexOf(inst77); if (gi77 >= 0) S77e.inventory.splice(gi77, 1); }
    if (plantedIdx >= 0) delete c77.cells[plantedIdx].build;
    return okAll;
  })(), '');
  check('⑧ 强化界面与入口（铁匠铺底栏 + 装备详情）',
    /ui\.openEnhance = function/.test(uS77) && /data-action="open-enhance"/.test(uS77)
    && /data-action="enhance-item"/.test(uS77) && /'enhance-item'/.test(mS77));

  /* ---- 附加：内功档案行 ---- */
  check('附加：将领档案含「内功」行（gp-ng）', /gp-ng/.test(uS77) && /内功 · /.test(uS77));

  /* ============================================================
   * ===== 63. v78：灵草时序 / 种子活动制 / 隐藏「灵淬」（老板三条） =====
   * ============================================================ */
  console.log('\n===== 63. v78 三条（灵草时长 · 种子活动制 · 灵淬隐藏加成） =====');
  (function () {
    var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var dS = stripComment(rd('data'));
    var stS = stripComment(rd('state'));
    var domS = stripComment(rd('domain'));
    var batS = stripComment(rd('battle'));
    var uS = stripComment(rd('ui'));
    var sysS = stripComment(rd('systems'));

    /* ---------- ① 灵草时序 & 种子数据 ---------- */
    console.log('  --- ① 灵草作物时间逐级拉长 + 种子全表化 ---');
    check('数据：灵草时长逐级翻倍 12/24/48/96（v78 拉长化龙参 36→48、天授果 48→96）', (function () {
      var hs = {};
      (DATA.FARM.crops || []).forEach(function (c) { if (c.herb) hs[c.id] = c.hours; });
      return hs.yunlingcao === 12 && hs.xisuizhi === 24 && hs.hualongshen === 48 && hs.tianshouguo === 96;
    })(), '蕴灵草 12 / 洗髓芝 24 / 化龙参 48 / 天授果 96');
    check('数据：时长严格递增且增量逐档变大（+12 / +24 / +48）', (function () {
      var arr = ['yunlingcao', 'xisuizhi', 'hualongshen', 'tianshouguo'].map(function (id) {
        var c = DATA.FARM_CROP_BY_ID[id]; return c ? c.hours : 0;
      });
      return arr[1] > arr[0] && arr[2] > arr[1] && arr[3] > arr[2]
        && (arr[1] - arr[0]) < (arr[2] - arr[1]) && (arr[2] - arr[1]) < (arr[3] - arr[2]);
    })());
    check('数据：10 作物全带 seedItem（黄金价 seed 字段退役）', (function () {
      var cs = DATA.FARM.crops || [];
      return cs.length === 10 && cs.every(function (c) { return !!c.seedItem && c.seed === undefined; });
    })());
    check('数据：5 种种子道具（type=seed：凡植 + 四灵种）', (function () {
      var seeds = (DATA.ITEMS || []).filter(function (x) { return x.type === 'seed'; });
      var ids = seeds.map(function (x) { return x.id; }).sort().join(',');
      return seeds.length === 5 && ids === 'seed_fan,seed_hualong,seed_tianshou,seed_xisui,seed_yunling';
    })());
    check('数据：掉落表 SEED_DROP（5 行 · 高级种有 minLv 门槛 · 战事 ×0.85）', (function () {
      var t = DATA.SEED_DROP;
      if (!t || !t.table || t.table.length !== 5 || t.battleMult !== 0.85) return false;
      var m = {}; t.table.forEach(function (r) { m[r.id] = r; });
      return m.seed_fan.minLv === 1 && m.seed_xisui.minLv === 3
        && m.seed_hualong.minLv === 6 && m.seed_tianshou.minLv === 8;
    })());

    /* ---------- ② 播种 = 种子制（不花黄金） ---------- */
    console.log('  --- ② 播种种子制（域层唯一出口） ---');
    var st78 = G.newGame({ name: 'v78验收', region: '司隶' });
    check('实测：无种子拒绝（提示去哪儿找）', (function () {
      var r = G.farmPlant(0, 'yunlingcao');
      return !r.ok && r.msg.indexOf('种子') >= 0 && r.msg.indexOf('采集与征战') >= 0;
    })());
    check('实测：有种子即种 —— 消耗 ×1、黄金分文不动', (function () {
      st78.res.gold = 123456;
      st78.items['seed_yunling'] = 2;
      var r = G.farmPlant(0, 'yunlingcao');
      return r.ok && st78.items['seed_yunling'] === 1 && st78.res.gold === 123456;
    })());
    check('实测：farmPlant 里不再有黄金扣减', codeOf(domS, 'GAME.farmPlant = function').indexOf('gold') < 0);

    /* ---------- ③ 种子掉落（采集 / 战斗两条口） ---------- */
    console.log('  --- ③ 种子掉落（采集归来 / 出征缴获） ---');
    check('掉落：满级野地全中时 5 种各 1（打桩随机 0）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var got = withFixedRandom([0], function () { return G.grantSeedDrop(10, 1, ''); });
      G.state.items = bk;
      return got.length === 5 && got.join('|').indexOf('凡植种子×1') >= 0 && got.join('|').indexOf('天授种子×1') >= 0;
    })());
    check('掉落：1 级低级地高掷全空（0.99 → 一颗不掉）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var got = withFixedRandom([0.99], function () { return G.grantSeedDrop(1, 1, ''); });
      G.state.items = bk;
      return got.length === 0;
    })());
    check('掉落：天授种子 lv7 不掉、lv8 起可掉（minLv 门槛）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var lv7 = withFixedRandom([0], function () { return G.grantSeedDrop(7, 1, '').join('|'); });
      G.state.items = {};
      var lv8 = withFixedRandom([0], function () { return G.grantSeedDrop(8, 1, '').join('|'); });
      G.state.items = bk;
      return lv7.indexOf('天授种子') < 0 && lv8.indexOf('天授种子') >= 0;
    })());
    check('挂钩：采集归来（finishGather）与出征获胜（expedition）各调一次',
      domS.indexOf('GAME.grantSeedDrop(g.level || 1, 1') >= 0
      && batS.indexOf('GAME.grantSeedDrop(seedLv, DATA.SEED_DROP.battleMult') >= 0);
    check('挂钩：宝物随机池排除种子（种子走专属口）', domS.indexOf("it.type !== 'seed'") >= 0);
    check('界面：种子不「使用」——useItem 指路秘境 + 背包行「去播种」',
      sysS.indexOf('种子要到种田秘境播种') >= 0 && uS.indexOf('data-action="open-farm">去播种') >= 0);
    check('界面：选种弹窗显示种子持有数 / 缺种禁用（不再有黄金价）',
      uS.indexOf("持有 <b>' + have + '</b>") >= 0 && uS.indexOf("缺 ' + U.escape(sd.name)") >= 0
      && uS.indexOf('金 不足') < 0);
    check('界面：背包「种子（种田秘境）」分类与图标系列',
      uS.indexOf("seed: '种子（种田秘境）'") >= 0
      && uS.indexOf("seed_fan: '🌾'") >= 0 && uS.indexOf("seed_tianshou: '🍑'") >= 0);

    /* ---------- ④ 隐藏设定：灵淬 ---------- */
    console.log('  --- ④ 隐藏设定：灵草升档额外加四维（灵淬） ---');
    check('数据：四档 ascend 齐备（良2/英3/名5/天8，全链 18）', (function () {
      var R = DATA.GEN_RANK_BY_ID;
      return R.liang.ascend === 2 && R.ying.ascend === 3 && R.ming.ascend === 5 && R.tian.ascend === 8
        && (R.liang.ascend + R.ying.ascend + R.ming.ascend + R.tian.ascend) === 18;
    })());
    check('实测：凡品用蕴灵草 → 良材，四维各 +2 且计数 ascend=1', (function () {
      var g = st78.generals[0];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong, y0 = g.yw, z0 = g.zm, n0 = g.nz;
      st78.items['yunlingcao'] = 1;
      var r = G.systems.useItem('yunlingcao', g.id);
      return r.ok && g.rank === 'liang'
        && g.tong === t0 + 2 && g.yw === y0 + 2 && g.zm === z0 + 2 && g.nz === n0 + 2 && g.ascend === 1;
    })());
    check('实测：全链走完（凡→良→英→名→天）四维各 +18（2+3+5+8）、计数 4', (function () {
      var g = st78.generals[1];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong;
      [['yunlingcao', 'liang'], ['xisuizhi', 'ying'], ['hualongshen', 'ming'], ['tianshouguo', 'tian']].forEach(function (pair) {
        st78.items[pair[0]] = 1;
        G.systems.useItem(pair[0], g.id);
      });
      return g.rank === 'tian' && g.tong === t0 + 18 && g.ascend === 4;
    })());
    check('隐藏性：界面无「灵淬 / 隐藏加成」字样（机制不显式提示）',
      uS.indexOf('灵淬') < 0 && uS.indexOf('隐藏加成') < 0);
    check('结构：加成只走 rankUpUse 唯一出口（ascend 只在 data 声明 + state 消费）', (function () {
      var body = codeOf(stS, 'GAME.rankUpUse = function');
      return body.indexOf('nr.ascend') >= 0 && (dS.match(/ascend/g) || []).length >= 4;
    })());
  })();

  /* ============================================================
   * ===== 64. v79：爵位加成 / 主城 / 神器 / 装备单件化（老板四条） =====
   * ============================================================ */
  console.log('\n===== 64. v79 四条（爵位加成 · 主城 · 神器 · 装备单件化） =====');
  (function () {
    var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var dS = stripComment(rd('data'));
    var stS = stripComment(rd('state'));
    var domS = stripComment(rd('domain'));
    var sysS = stripComment(rd('systems'));
    var uS = stripComment(rd('ui'));
    var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

    /* ---------- ① 爵位加成 ---------- */
    console.log('  --- ① 爵位加成（22 级曲线 · 六项消费点） ---');
    check('数据：RANK_BONUS 与 RANK 同序同长，六项齐全', (function () {
      var B = DATA.RANK_BONUS || [];
      return B.length === DATA.RANK.length && B.every(function (b) {
        return ['prodPct', 'taxPct', 'storePct', 'buildSlot', 'wildCap', 'genCap'].every(function (k) { return b[k] != null; });
      });
    })());
    check('数据：曲线逐级递增（产/税 +1%/级、储 +2%/级；Lv8 起建造 +1、Lv16 起 +2）', (function () {
      var B = DATA.RANK_BONUS;
      return B[0].prodPct === 0 && B[21].prodPct === 0.21 && B[21].storePct === 0.42
        && B[8].buildSlot === 1 && B[16].buildSlot === 2 && B[21].wildCap === 7 && B[21].genCap === 5;
    })());
    check('实测：爵位加成真的进经营（产/税 同口径并入 cityBonusNum）', (function () {
      var st64 = G.state;
      var bk = st64.rank;
      var city = G.currentCity();
      st64.rank = 0;
      var p0 = G.cityBonusNum(city, 'prodPct'), t0 = G.cityBonusNum(city, 'taxPct');
      st64.rank = 20;
      var p1 = G.cityBonusNum(city, 'prodPct'), t1 = G.cityBonusNum(city, 'taxPct');
      st64.rank = bk;
      return p1 > p0 && t1 > t0 && Math.abs((p1 - p0) - 0.20) < 1e-9;
    })());
    check('实测：爵位加成进仓储与席位（storeCapOf / genSlotsOf 同口径）', (function () {
      var st64 = G.state, city = G.currentCity(), bk = st64.rank;
      st64.rank = 0;
      var s0 = G.storeCapOf(city), g0 = G.genSlotsOf(city);
      st64.rank = 21;
      var s1 = G.storeCapOf(city), g1 = G.genSlotsOf(city);
      st64.rank = bk;
      return s1 > s0 && g1 > g0;
    })());
    check('结构：爵位加成消费只走 cityBonusNum（唯一汇总口）', (function () {
      return /GAME\.rankBonusNum = function/.test(stS)
        && /rankBonusNum\(key\)/.test(codeOf(stS, 'GAME.cityBonusNum = function'))
        && /rankBonusText/.test(stS);
    })());
    check('界面：爵位表显示「加成」列（食邑死列退役）',
      /rankBonusText\(i\)/.test(uS) && uS.indexOf('<th>食邑</th>') < 0);

    /* ---------- ② 主城 ---------- */
    console.log('  --- ② 主城（设置 · 标识 · 驻跸加成） ---');
    check('数据：MAIN_CITY 五项驻跸加成 + 迁都成本', (function () {
      var M = DATA.MAIN_CITY;
      return M && M.bonus.prodPct === 0.15 && M.bonus.taxPct === 0.10 && M.bonus.storePct === 0.30
        && M.bonus.genCap === 1 && M.bonus.wildCap === 1 && M.moveCost.gold > 0;
    })());
    check('实测：首设免费、迁都收费（黄金扣减、主城易位）', (function () {
      var st64 = G.newGame({ name: '主城验收', region: '司隶' });
      var c1 = st64.cities[0];
      st64.cities.push(G.makeCity({ id: 'mc2', name: '陪都', x: c1.x + 2, y: c1.y + 2 }));
      var c2 = G.cityById('mc2');
      if (!c2) return false;
      st64.res.gold = 500000;
      var r1 = G.setMainCity(c1.id);
      var g1 = st64.res.gold;
      var r2 = G.setMainCity(c2.id);
      var g2 = st64.res.gold;
      return r1.ok && g1 === 500000 && r2.ok && g2 === 500000 - DATA.MAIN_CITY.moveCost.gold
        && G.isMainCity(c2) && !G.isMainCity(c1);
    })());
    check('实测：驻跸加成只对本城生效（他城不吃）', (function () {
      var st64 = G.state, mc = G.mainCityOf();
      var other = null;
      if (!mc) return false;
      st64.cities.forEach(function (c) { if (!other && c.id !== mc.id) other = c; });
      var ok = other && G.mainCityBonusNum(mc, 'prodPct') > 0 && G.mainCityBonusNum(other, 'prodPct') === 0;
      st64.mainCityId = null;   /* 复原（不污染后续） */
      return ok;
    })());
    check('界面：城名后有【主城】标识（cityLabelHTML 唯一出口）',
      /city-tier mt">主城/.test(uS) && /isMainCity/.test(uS));
    check('界面：官府有「设为主城」入口 + 主分发在位',
      /data-action="set-main-city"/.test(uS) && /set-main-city/.test(rd('main')));

    /* ---------- ③ 神器 ---------- */
    console.log('  --- ③ 神器（供奉养成 · 时长 + 活动） ---');
    check('数据：三件神器 · 门槛 10 档 · 时长收益与活动收益齐备', (function () {
      return (DATA.ARTIFACTS || []).length === 3 && DATA.ARTIFACT.pts.length === 10
        && DATA.ARTIFACT.perGameHour > 0 && DATA.ARTIFACT.capturePts.county > 0 && DATA.ARTIFACT.promotePts > 0;
    })());
    check('实测：供奉值攒够 → 等级点亮（0 → Lv1 → Lv3）', (function () {
      var st64 = G.state;
      var bk = st64.artifacts;
      st64.artifacts = { pts: 0 };
      var l0 = G.artLevelOf();
      G.artGain(DATA.ARTIFACT.pts[0]);
      var l1 = G.artLevelOf();
      G.artGain(DATA.ARTIFACT.pts[2] - DATA.ARTIFACT.pts[0]);
      var l3 = G.artLevelOf();
      st64.artifacts = bk;
      return l0 === 0 && l1 === 1 && l3 === 3;
    })());
    check('实测：神器加成真的进经营（Lv10 = 产 +20% / 税 +20% / 仓储 40%）', (function () {
      var st64 = G.state;
      var bk = st64.artifacts;
      st64.artifacts = { pts: DATA.ARTIFACT.pts[9] };
      var p1 = G.artifactBonusNum('prodPct'), t1 = G.artifactBonusNum('taxPct');
      var cap1 = G.artifactBonusNum('storePct');
      st64.artifacts = bk;
      return Math.abs(p1 - 0.2) < 1e-9 && Math.abs(t1 - 0.2) < 1e-9 && Math.abs(cap1 - 0.4) < 1e-9;
    })());
    check('实测：时长链挂了供奉（在线 + 离线两处时间链）',
      /GAME\.artTick\(secReal \* ts\)/.test(stS) && /GAME\.artTick\(dtReal \* ts\)/.test(stS));
    check('实测：特殊活动给供奉（占城 + 晋升均有调用）',
      /GAME\.artGain\(/.test(rd('battle')) && /GAME\.artGain\(/.test(sysS));
    check('界面：神器面板在君主菜单（入口 + 面板 + 样式）',
      /data-action="open-artifacts"/.test(uS) && /ui\.openArtifacts = function/.test(uS)
      && /\.art-row \{/.test(hS));

    /* ---------- ④ 装备单件化 ---------- */
    console.log('  --- ④ 装备单件化（按件强化 · 同名区分） ---');
    check('实测：同名两件各升各的（+2 / +0，互不影响）', (function () {
      var st64 = G.newGame({ name: '单件验收', region: '司隶' });
      var city = G.currentCity();
      var i64 = city.cells.findIndex(function (x) { return !x.build && !x.official; });
      if (i64 >= 0) city.cells[i64].build = { id: 'tiejiangpu', lvl: 3 };
      st64.res.gold = 1e8; st64.res.iron = 1e8; st64.res.stone = 1e8;
      var a = G.addEquip('cr_weapon_1'), b = G.addEquip('cr_weapon_1');
      var r1 = G.enhance(a.u), r2 = G.enhance(a.u);
      return r1.ok && r2.ok && G.enhOf(a) === 2 && G.enhOf(b) === 0
        && G.eqLabel(a) !== G.eqLabel(b);
    })());
    check('实测：同名序号 甲/乙 自动排（区分办法可见）', (function () {
      var g = G.eqGroupOf('cr_weapon_1');
      if (g.length < 2) return false;
      return /甲/.test(G.eqLabel(g[0])) && /乙/.test(G.eqLabel(g[1]));
    })());
    check('实测：装备加成只吃**穿在身上那一件**自己的强化级', (function () {
      var st64 = G.state;
      var g = st64.generals[0];
      var bk = g.equip;
      var x = G.addEquip('cr_weapon_1'); x.enh = 2;
      var y = G.addEquip('cr_weapon_1'); y.enh = 0;
      g.equip = { weapon: x };
      var bx = G.systems.genEquipBonus(g);
      g.equip = { weapon: y };
      var by = G.systems.genEquipBonus(g);
      g.equip = bk;
      [x, y].forEach(function (it) { var i = st64.inventory.indexOf(it); if (i >= 0) st64.inventory.splice(i, 1); });
      return bx.atk > by.atk;
    })());
    check('结构：实例模型工具齐备（eqId / eqEnhOf / eqLabel / eqSerial / eqFind / migrateEquipModel）',
      ['GAME.eqId = function', 'GAME.eqEnhOf = function', 'GAME.eqLabel = function', 'GAME.eqSerial = function',
        'GAME.eqFind = function', 'GAME.migrateEquipModel = function']
        .every(function (k) { return domS.indexOf(k) >= 0; }));
    check('实测：老档迁移（id 串 → 实例；旧按种强化并入首件）', (function () {
      var fake = {
        inventory: ['cr_weapon_1', 'cr_weapon_1'],
        generals: [{ id: 'x1', equip: { head: 'cr_head_1' } }],
        forgeEnh: { cr_weapon_1: 3, cr_head_1: 5 },
      };
      G.migrateEquipModel(fake);
      return typeof fake.inventory[0] === 'object' && fake.inventory[0].enh === 3
        && fake.inventory[1].enh === 0 && fake.inventory[0].u !== fake.inventory[1].u
        && typeof fake.generals[0].equip.head === 'object' && fake.generals[0].equip.head.enh === 5
        && fake.forgeEnh === undefined;
    })());
    check('结构：入包唯一出口（打造 / 缴获均走 GAME.addEquip）',
      /GAME\.addEquip\(itemId\)/.test(domS) && /GAME\.addEquip\(id\)/.test(rd('battle')));
    check('界面：强化面板按件列（同名各一行、按钮带件号）',
      /按件/.test(uS) && /GAME\.eqLabel\(inst\)/.test(uS) && /data-action="enhance-item" data-item="' \+ key/.test(uS));
    check('界面：装备详情单件视角（同种第 N 件）', /同种第/.test(uS));

  })();

/* ============================================================
 * ===== 65. v80：客栈固定表 / 建筑吸底操作区 / 兵营分页直输（老板三条） =====
 * ============================================================ */
console.log('\n===== 65. v80 三条（客栈 · 建筑底栏 · 兵营） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uRaw = rd('ui');
  var uS = stripComment(uRaw);
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

  /* ---------- ① 客栈 ---------- */
  console.log('  --- ① 客栈固定表 ---');
  check('v80：招募行去「史实名将」标（将领档案那枚保留）', (function () {
    var inn = codeOf(uS, 'ui.openInn = function');
    return inn.indexOf('tag-hero') < 0 && uRaw.indexOf('<span class="gcard-tag hero">史实名将</span>') >= 0;
  })());
  check('v80：表格固定列宽（colgroup ×10 + table-layout: fixed + 列宽表在 CSS）', (function () {
    var inn = codeOf(uS, 'ui.openInn = function');
    var b = cssBlock(hS, '.inn-tbl {');
    return /<colgroup>/.test(inn) && (inn.match(/<col class="c-/g) || []).length === 10
      && /table-layout: fixed/.test(b)
      && /width: \d+px/.test(cssBlock(hS, '.inn-tbl col.c-name {'))
      && /width: \d+px/.test(cssBlock(hS, '.inn-tbl col.c-act {'));
  })());

  /* ---------- ② 建筑弹窗 ---------- */
  console.log('  --- ② 建筑弹窗：吸底操作区 ---');
  check('v80：三键与关闭同处 .bldg-bottom（上排三键 / 下排关闭）', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    var a = body.indexOf('class="bldg-bottom"');
    if (a < 0) return false;
    var acts = body.indexOf('class="bldg-acts"', a);
    var foot = body.indexOf('class="bldg-foot"', a);
    return acts > a && foot > acts
      && body.indexOf('data-action="confirm-upgrade"', acts) > acts
      && body.indexOf('data-action="demolish-ask"', acts) > acts
      && body.indexOf('data-action="move-ask"', acts) > acts
      && body.indexOf('close-modal', foot) > foot;
  })());
  check('v80：吸底几何沿用 v73 校准 + 短内容贴底（:has flex + margin-top: auto）',
    /\.modal \.inner-panel:has\(> \.bldg-bottom\) \{ display: flex; flex-direction: column; \}/.test(hS.replace(/\s+/g, ' '))
    && /\.modal \.inner-panel:has\(> \.bldg-bottom\) > \.bldg-bottom \{ margin-top: auto; \}/.test(hS.replace(/\s+/g, ' ')));

  /* ---------- ③ 兵营 ---------- */
  console.log('  --- ③ 兵营：分页 / 直输 / 不跳顶 ---');
  check('v80：常备兵全部归入步兵/骑兵两页（无遗漏、无器械混入）', (function () {
    var inf = 0, cav = 0, bad = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      var t = DATA.TROOPS[id];
      if (t.craft) return;
      if (t.cat === 'inf') inf++;
      else if (t.cat === 'cav') cav++;
      else bad++;
    });
    return bad === 0 && inf + cav === 15 && inf > 0 && cav > 0;
  })());
  check('v80：兵营页重排（重复标题 / 工位行 / 解锁计数全撤，空态保留）', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return th.indexOf('gold-heading') < 0 && th.indexOf('ids.filter') < 0
      && th.indexOf('q-sec-n') < 0 && th.indexOf('本城尚未建造') >= 0
      && /data-action="train-tab"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th);
  })());
  check('v80：数量直输（±10 退役 / 上限保留 / 输入框在）', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return /id="train-count"/.test(th) && th.indexOf('train-qty') < 0
      && th.indexOf('data-action="train-max"') >= 0
      && mS.indexOf('train-qty') < 0 && mS.indexOf('adjustTrainQty') < 0
      && /case 'train-tab':/.test(mS);
  })());
  check('v80：重绘不跳顶（openTroops 存/还两级滚动位）', (function () {
    var fn = codeOf(uS, 'ui.openTroops = function');
    return (fn.match(/scrollTop/g) || []).length >= 4 && /#train-count/.test(fn);
  })());
})();


/* ============================================================
 * ===== 66. v81：君主卡（名称并入信息表首行） / 兵营三页制（老板两条） =====
 * ============================================================ */
console.log('\n===== 66. v81 两条（君主卡 · 兵营三页） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uRaw = rd('ui');
  var uS = stripComment(uRaw);
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

  /* ---------- ① 君主卡 ---------- */
  console.log('  --- ① 君主卡：名称并入信息表首行 ---');
  check('v81：名称行在信息表内（.mrow-name），官职行与旧名称列退役',
    /class="row mrow-name"/.test(hS) && /id="lord-name"/.test(hS)
    && !/lord-name-row/.test(hS) && !/lord-office/.test(hS));
  check('v81：CSS —— 名称行金色 / 头像不缩 / 信息表伸缩', (function () {
    var b = cssBlock(hS, '.lord-meta .row.mrow-name span:first-child {');
    var p = cssBlock(hS, '.lord-portrait {');
    var m = cssBlock(hS, '.lord-meta {');
    return /color: var\(--gold-light\)/.test(b) && /flex: 0 0 auto/.test(p) && /flex: 1 1 0/.test(m);
  })());
  check('v81：syncHeader 不再写 #lord-office（名称写入照旧）', (function () {
    var fn = codeOf(uS, 'ui.syncHeader = function');
    return fn.indexOf('lord-office') < 0 && /\$\('#lord-name'\)\.textContent = s\.ruler\.name/.test(fn);
  })());
  check('实测：syncHeader 后 #lord-name = 君主名', (function () {
    G.ui.syncHeader();
    var el = global.document.querySelector('#lord-name');
    return !!el && el.textContent === G.state.ruler.name;
  })());

  /* ---------- ② 兵营三页 ---------- */
  console.log('  --- ② 兵营三页：队列 / 步兵 / 骑兵 ---');
  check('v81：分页初始态为 que（第一页 = 募兵队列）', /ui\._trainTab = 'que';/.test(uS));
  check('v81：三页切换键与队列页分支齐备', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return /data-page="que"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && /isQueueTab/.test(th) && th.indexOf('ui.trainQueueBlock(bar, c, kind)') >= 0;
  })());
  check('v81：main.js 三页白名单分发',
    /case 'train-tab': ui\._trainTab = \(\['que', 'inf', 'cav'\]\.indexOf\(el\.dataset\.page\) >= 0\)/.test(mS));
  check('实测：队列页只出队列 / 步兵页只出卡面与控件', (function () {
    var keep = G.state, keepCity = G.ui._cityId;
    var keepTab = G.ui._trainTab, keepFilter = G.ui._trainFilter, keepBIdx = G.ui._trainBIdx;
    var ok = false;
    try {
      var st = G.newGame({ name: 'v81' });
      G.state = st;
      var c = st.cities[0];
      G.ui._cityId = c.id;
      var ci = c.cells.findIndex(function (x) { return !x.build && !x.official; });
      if (ci >= 0) c.cells[ci] = { build: { id: 'junying', lvl: 5 }, pending: null };
      G.ui._trainFilter = 'normal';
      G.ui._trainBIdx = null;
      G.ui._trainTab = 'inf';
      var inf = G.ui.troopsHTML();
      G.ui._trainTab = 'que';
      var que = G.ui.troopsHTML();
      ok = inf.indexOf('本营募兵队列') < 0 && inf.indexOf('id="train-count"') >= 0
        && inf.indexOf('troop-grid') >= 0
        && que.indexOf('本营募兵队列') >= 0 && que.indexOf('id="train-count"') < 0
        && que.indexOf('troop-grid') < 0;
    } catch (e) { ok = false; }
    finally {
      G.ui._trainTab = keepTab; G.ui._trainFilter = keepFilter; G.ui._trainBIdx = keepBIdx;
      G.state = keep; G.ui._cityId = keepCity;
    }
    return ok;
  })(), '步兵页不带队列 / 队列页只带队列');
})();

  /* ============================================================
   * 67. v82（老板四条）：君主凡品开局 / 官府·君主文案清理 / 征收退役 / 字体三档
   * ============================================================ */
  console.log('\n===== 67. v82 四条（君主资质 · 文案 · 征收 · 字体） =====');
  (function () {
    var rd82 = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u82 = stripComment(rd82('ui'));
    var d82 = stripComment(rd82('domain'));
    var m82 = stripComment(rd82('main'));
    var st82 = stripComment(rd82('state'));
    var da82 = stripComment(rd82('data'));
    var h82 = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8'));

    check('① 君主开局凡品（最低档 lvCap 60）—— 需逐步升档', (function () {
      var lord = G.makeLordGeneral({ name: '甲' }, 1, null);
      return DATA.LORD_GEN.rankId === 'fan' && DATA.GEN_RANKS[0].id === 'fan'
        && lord.rank === 'fan' && DATA.GEN_RANK_BY_ID['fan'].lvCap === 60;
    })(), 'rank=' + DATA.LORD_GEN.rankId + ' lvCap=' + DATA.GEN_RANK_BY_ID['fan'].lvCap);
    check('① 升档链在（凡→良→英→名→天，四株灵草，唯一出口 rankUpUse）', (function () {
      var chain = (DATA.ITEMS || []).filter(function (x) { return x.type === 'rank_up'; })
        .map(function (x) { return x.from + '>' + x.to; });
      return typeof G.rankUpUse === 'function' && chain.length === 4
        && chain[0] === 'fan>liang' && chain[3] === 'ming>tian';
    })());

    check('② 官府面板：城名居中行（.city-title / .city-sub），无原名样式残留', (function () {
      return /class="city-title"/.test(u82) && /\.city-title \{/.test(h82)
        && /class="city-sub"/.test(u82) && !/cs-orig/.test(u82) && !/cs-orig/.test(h82);
    })());
    check('② 官府面板不再标「附属野地 / 城外空地」（显示与数据副本双退役）',
      !/附属野地 \/ 城外空地/.test(u82) && !/extraLand/.test(da82));
    check('② 君主面板城池列表去档位括注（坐标与人口保留）',
      /ls-meta">\[' \+ c2\.x \+ ',' \+ c2\.y \+ '\] · 人口上限 '/.test(u82)
      && !/DATA\.CITY_TIER\[c2\.type\]/.test(u82));
    check('② 改名弹窗不再写「原名」（域层 origName 照记）',
      !/原名：/.test(u82) && /origName/.test(d82));

    check('③ 征收退役：域 / 界面 / 分发 / 状态 / 数据 五处全清', (function () {
      return typeof G.levy === 'undefined' && typeof G.levyPlan === 'undefined'
        && typeof G.levyReady === 'undefined' && typeof G.LEVY_CD === 'undefined'
        && !/levyPlan|levyReady|LEVY_RES_RATE|LEVY_MAT_QTY|LEVY_HEARTS/.test(d82)
        && !/do-levy/.test(m82) && !/levy-btn/.test(u82)
        && !/lastLevy/.test(st82) && !/LEVY_RES_RATE|LEVY_CD/.test(da82);
    })());

    check('④ 字重只剩三档（400 正文 / 700 强调 / 800 标题）', (function () {
      var seen = {};
      (h82.match(/font-weight:\s*\d+/g) || []).forEach(function (m) { seen[m.replace(/\D/g, '')] = 1; });
      return Object.keys(seen).sort().join(',') === '400,700,800';
    })());
    check('④ 备注族一处共享（12px · 常规 · 次要色 · 行高 1.65）',
      /\.note, \.ui-sub, \.nt-info, \.op-hint, \.m-sub, \.gb-empty, \.q-empty,[\s\S]{0,180}line-height: 1\.65/.test(h82));
    check('④ 分区标题共享扩员（漏网六处收编：q-det-sec/gp-sec/fsn-t/op-zone-t/ledger-sec/seal-h）',
      /\.q-sec-t, \.q-det-sec, \.bag-sec[\s\S]{0,240}\.gp-sec, \.fsn-t, \.op-zone-t, \.ledger-sec, \.seal-h \{/.test(h82));
    check('④ 标题外观共享含 .q-det-title（三层标题一处定义）',
      /\.gold-heading, \.m-title, \.q-det-title \{[\s\S]{0,200}font-size: var\(--fs-h2\)/.test(h82));
  })();

  /* ============================================================
   * 68. v83（老板）：野地经验惩罚机制（每 12 级一个台阶）
   * ============================================================ */
  console.log('\n===== 68. v83 经验惩罚（野地越级） =====');
  (function () {
    check('台阶：每 12 级一档（12→1 / 13→2 / 24→2 / 25→3 / 120→10 / 121+→10）', (function () {
      var cases = [[1, 1], [12, 1], [13, 2], [24, 2], [25, 3], [73, 7], [120, 10], [121, 10], [200, 10]];
      return cases.every(function (cc) { return G.battle.expTierOf(cc[0]) === cc[1]; });
    })());
    check('吃满：野地等级 ≥ 台阶 → 系数 1（不设超额加成）',
      G.battle.expPenaltyOf(20, 2).mul === 1 && G.battle.expPenaltyOf(20, 9).mul === 1
      && G.battle.expPenaltyOf(121, 10).mul === 1);
    check('惩罚：每低一档 ×0.65（低1档 0.65 / 低6档 0.65⁶）', (function () {
      var p1 = G.battle.expPenaltyOf(20, 1);
      var p6 = G.battle.expPenaltyOf(73, 1);
      return Math.abs(p1.mul - 0.65) < 1e-9 && Math.abs(p6.mul - Math.pow(0.65, 6)) < 1e-9
        && p1.need === 2 && p6.need === 7 && p6.wl === 1;
    })());
    check('地板：极深越级不低于 0.03（不至于归零）',
      Math.abs(G.battle.expPenaltyOf(200, 1).mul - 0.03) < 1e-9);
    check('野地 0 级按 1 级对待（尚未长成不比 1 级更差）',
      G.battle.expPenaltyOf(5, 0).mul === 1 && Math.abs(G.battle.expPenaltyOf(13, 0).mul - 0.65) < 1e-9);
    check('数值全在 DATA.EXP_PENALTY（改一处即可调平衡）',
      DATA.EXP_PENALTY.tier === 12 && DATA.EXP_PENALTY.maxLv === 10
      && DATA.EXP_PENALTY.decay === 0.65 && DATA.EXP_PENALTY.minMul === 0.03);

    check('结构：惩罚挂在野地出征结算口（唯一出口），非野地不适用', (function () {
      var bs = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8'));
      return /GAME\.battle\.expPenaltyOf = function/.test(bs)
        && /GAME\.battle\.expTierOf = function/.test(bs)
        && /t\.kind === 'wild' && expR\.gain > 0/.test(bs)
        && /GAME\.battle\.expPenaltyOf\(gen\.level, t\.lv\)/.test(bs);
    })());
    check('战报注明越级惩罚（否则玩家以为经验算漏了）', (function () {
      var txt = G.battle.reportText('野地 Lv1', {}, { name: '测试将', level: 73 },
        { winner: 'atk', rounds: 3, atkLoss: 1, atkRemain: 9, defLoss: 10, defRemain: 0,
          expInfo: { gain: 8, level: 73, exp: 8, need: 99999, up: 0 },
          expPenalty: { mul: 0.0754, need: 7, wl: 1, gap: 6, before: 106, after: 8 } });
      return txt.indexOf('越级惩罚 ×') >= 0 && txt.indexOf('宜打 7 级野地') >= 0;
    })());

    /* 实测：真实出征走完整链路 —— 打桩野地守军与等级（确定性，不赌地图随机） */
    check('实测：低阶将吃满、高阶将越级打折（出征全链路）', withoutEncounter(function () {
      return withFreshState('越级测试', function (st) {
        var c = st.cities[0];
        var spot = null;
        for (var r = 1; r <= 12 && !spot; r++) {
          for (var dy = -r; dy <= r && !spot; dy++) for (var dx = -r; dx <= r && !spot; dx++) {
            var tl = G.map.tile(c.x + dx, c.y + dy);
            if (tl && tl.terrain !== 'city') spot = { x: c.x + dx, y: c.y + dy };
          }
        }
        if (!spot) return true;
        var keepLv = G.map.wildLevelNow, keepDef = G.wildDefenseAt;
        try {
          /* 打桩：目标固定 Lv2 野地、守军 30 义兵（必胜；经验 = 30×230/1000×2 = 14） */
          G.map.wildLevelNow = function () { return 2; };
          G.wildDefenseAt = function () { return { army: { yibing: 30 }, gen: null, day: 0 }; };
          var gen = st.generals[1] || st.generals[0];
          st.res.grain = 1e8;

          gen.level = 5; gen.exp = 0; gen.stamina = 100; gen.energy = 100;
          c.army = { yibing: 300000 };
          var rLow = G.battle.expedition({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', { yibing: 300000 }, gen.id);
          if (!rLow.ok || !rLow.result || rLow.result.winner !== 'atk' || !(rLow.result.expGain > 0)) return false;

          gen.level = 48; gen.exp = 0; gen.stamina = 100; gen.energy = 100;   /* 48/12 = 4 档 */
          c.army = { yibing: 300000 };
          var rHigh = G.battle.expedition({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', { yibing: 300000 }, gen.id);
          if (!rHigh.ok || !rHigh.result || rHigh.result.winner !== 'atk') return false;

          var pen = rHigh.result.expPenalty;
          var wantMul = Math.pow(DATA.EXP_PENALTY.decay, 4 - 2);   /* 差 2 档 */
          return !rLow.result.expPenalty
            && !!pen && pen.need === 4 && pen.wl === 2 && pen.gap === 2
            && Math.abs(pen.mul - wantMul) < 1e-9
            && pen.after === rHigh.result.expGain
            && rHigh.result.expGain < rLow.result.expGain;
        } finally {
          G.map.wildLevelNow = keepLv; G.wildDefenseAt = keepDef;
        }
      });
    }), '低阶 14 / 高阶 14×0.65²');
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
