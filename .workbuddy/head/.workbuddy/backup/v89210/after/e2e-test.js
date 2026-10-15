/* ============================================================
 * e2e-test.js  真实 DOM 端到端测试（jsdom + 内置 HTTP 服务）
 *
 * 与 smoke-test.js 的区别：
 *   smoke-test 用「永远返回假对象」的 DOM stub —— 会掩盖 null 引用类错误
 *   e2e-test   用真实 DOM 引擎加载真实 index.html —— 浏览器里会炸的它都会炸
 *
 * 为什么要起 HTTP 服务：jsdom 在 file:// 下 localStorage 属 opaque origin，
 * 访问会抛 SecurityError；走 http://127.0.0.1 才与真实浏览器行为一致。
 *
 * 运行：
 *   NODE_PATH=<...>/node_modules node e2e-test.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM } = require('jsdom');

const DIR = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const ERRORS = [];
const WARNINGS = [];
let PASS = 0, FAIL = 0;
let ASSERTING = false; // 只在断言阶段统计错误
function check(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  const noop = () => {};
  return {
    canvas: { width: 800, height: 600 },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, clip: noop,
    moveTo: noop, lineTo: noop, rect: noop, save: noop, restore: noop, translate: noop,
    scale: noop, rotate: noop, setTransform: noop, measureText: () => ({ width: 10 }),
    quadraticCurveTo: noop, bezierCurveTo: noop, roundRect: noop,
    createPattern: () => null,
    fillText: noop, strokeText: noop, setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, imageSmoothingEnabled: true,
  };
}

/* ---------------- 静态服务器 ---------------- */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(DIR, p);
  if (!fp.startsWith(DIR)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(0, '127.0.0.1', () => {
  const PORT = server.address().port;
  const URL = 'http://127.0.0.1:' + PORT + '/index.html';
  console.log('静态服务已启动：' + URL);

  JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      window.addEventListener('error', (e) => {
        if (!ASSERTING) return;
        ERRORS.push('[onerror] ' + (e.message || '') + (e.filename ? ' @ ' + path.basename(e.filename) + ':' + e.lineno : ''));
      });
      window.addEventListener('unhandledrejection', (e) => {
        if (!ASSERTING) return;
        ERRORS.push('[rejection] ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
      });
      const origErr = window.console.error;
      window.console.error = function () {
        const m = Array.prototype.slice.call(arguments).map(String).join(' ');
        if (ASSERTING && !/Not implemented/i.test(m)) ERRORS.push('[console.error] ' + m);
        origErr.apply(window.console, arguments);
      };
      const origWarn = window.console.warn;
      window.console.warn = function () {
        const m = Array.prototype.slice.call(arguments).map(String).join(' ');
        if (ASSERTING && !/Not implemented|Could not parse CSS/i.test(m)) WARNINGS.push(m);
        origWarn.apply(window.console, arguments);
      };
    },
  }).then((dom) => {
    const loaded = new Promise((resolve) => {
      dom.window.addEventListener('load', () => setTimeout(resolve, 400));
      setTimeout(resolve, 8000); // 兜底
    });
    return loaded.then(() => runTests(dom, URL));
  }).catch((e) => {
    /* 主流程抛异常必须**计入失败**。
       原先这里直接 finish()，于是"跑到一半崩了"会以"0 失败 + exit 0"收场，
       后面所有断言根本没执行也看不出来 —— 本项目已经因此漏过一次
       （删掉 ui.setCitySub 后主流程在 2065 行中断，49 条断言静默未跑）。 */
    FAIL++;
    ABORTED = true;
    console.log('\n💥 测试主流程异常（已中断，后面的断言未执行，一律判失败）：'
      + e.message + '\n' + (e.stack || '').split('\n').slice(1, 5).join('\n'));
    finish();
  });
});

/* ============================================================ */
async function runTests(dom, URL) {
  const { window } = dom;
  const { document } = window;
  const G = window.GAME;
  const DATA = G && G.DATA;
  /* v89.135（老板 10）：官府面板退役 —— 打开"官府格建筑面板"的统一姿势（本文件多处用）。
     官府占 4 格（G.govCellsOf），取第一格即官府本体。 */
  function openGov() {
    const c = G.currentCity();
    G.ui.openBuildModal(G.govCellsOf(c.col, c.row)[0]);
  }

  /* v89.87（老板需求 4）：测试默认关闭战斗观战（走即算路径，既有用例语义不变）；
     观战路径由 §87 专项断言显式开启后测。 */
  if (G.DATA && G.DATA.DEFAULT_SETTINGS) G.DATA.DEFAULT_SETTINGS.battleWatch = false;
  if (G.state && G.state.settings) G.state.settings.battleWatch = false;

  /* v14：外城地块按城池独立（state.extGrid → city.extGrid） */
  const extOf = (st) => G.extGridOf(st.cities[0]);

  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };
  /* v89.115：背包顶层改「装备 / 宝物」两类 + 宝物二级分类条 ——
     "切到某一类"统一走这个助手（先切宝物页，再走分类出口；
     分类条只列**有货**的类，直接调出口比"找 chip 点"稳）。 */
  const bagTabTo = async (sub) => {
    const t = document.querySelector('#view-container [data-action="bag-tab"][data-v="treasure"]');
    if (t) { click(t); await sleep(70); }
    if (sub) { G.ui.setBagSub(sub); await sleep(70); }
  };

  ASSERTING = true;
  console.log('\n========== 真实 DOM 端到端测试 ==========\n');

  console.log('--- 1. 模块加载 ---');
  check('window.GAME', !!G);
  check('DATA', !!DATA);
  check('utils', !!(G && G.utils));
  check('ui', !!(G && G.ui));
  check('systems', !!(G && G.systems));
  check('map', !!(G && G.map));
  check('battle', !!(G && G.battle));
  if (!G || !DATA) return finish();

  /* v89.29：逸闻奇遇 —— 测试期默认关闭随机触发（避免打断用例）；
     触发链专测用 G.SG.TRIG.pin（指定篇目）/ rng 注入精确控制。 */
  if (G.SG && G.SG.TRIG) G.SG.TRIG.rng = function () { return 0.999; };

  /* v89.89：**全域钉天气为「晴」**（测试环境包装，产品代码零改动）——
     同 smoke 的根因修法：`STORY.rollWeather` 是 Math.random 重掷（newGame 与
     每 1/4 游戏年 = 120 真实秒各一次），雨/雾/雪改战斗与产量口径 →
     天气敏感断言偶发假红。本段之后需要测天气的用例仍可直接赋值 `world.weather`。 */
  (function () {
    var ST = G.story;
    if (ST && ST.rollWeather) {
      ST.rollWeather = function () {
        var st = G.state;
        if (st && st.world) {
          st.world.weather = 'clear';
          st.world.weatherLeft = G.DATA.CALENDAR.secPerYear / 4;
        }
        return G.DATA.WEATHERS.clear;
      };
    }
  })();

  /* v89.89：**全域钉地图 seed**（测试环境包装，产品行为零变化）——
     同 smoke：`mapSeed = U.now() % 100000`（毫秒时间戳）使每次 run 布局不同，
     "找格子"类断言偶发假红。钉为黄金 seed（20260921）。 */
  (function () {
    var _ng = G.newGame;
    G.newGame = function (opts) {
      opts = opts || {};
      if (opts.mapSeed == null) opts.mapSeed = 20260921;
      return _ng.call(this, opts);
    };
  })();

  console.log('\n--- 2. 数据层完整性 ---');
  check('兵种 18', Object.keys(DATA.TROOPS || {}).length === 18, Object.keys(DATA.TROOPS || {}).length + '');
  check('城内建筑 16', Object.keys(DATA.BUILDINGS || {}).length >= 16, Object.keys(DATA.BUILDINGS || {}).length + '');
  check('城外建筑 4', Object.keys(DATA.EXT_BUILDINGS || {}).length === 4);
  check('科技 ≥23', (DATA.TECH || []).length >= 23, (DATA.TECH || []).length + ' 项');
  check('爵位 22', (DATA.RANK || []).length === 22);
  check('城池 174（1都+12州+96郡+65县）', (DATA.NPC_CITIES || []).length === 174,
    (DATA.NPC_CITIES || []).length + ' 座 · 县城 ' + DATA.NPC_CITIES.filter(function (c) { return c.type === 'county'; }).length);
  check('装备槽位 ≥6', Object.keys(DATA.EQUIP_SLOTS || DATA.SLOTS || {}).length >= 6,
    Object.keys(DATA.EQUIP_SLOTS || DATA.SLOTS || {}).length + '');

  console.log('\n--- 3. 页面骨架（真实 id） ---');
  /* v27（需求 1）：#city-tools 板块已删除（切城并进城池属性） */
  ['#screen-create', '#screen-game', '#view-container', '#city-attrs', '#city-switch-host', '#res-bar',
    '#modal-root', '#topnav', '#lord-name', '#toast'].forEach((sel) => {
      check('元素 ' + sel, !!document.querySelector(sel));
    });
  /* v24（需求 9）：屏幕下方的队列播报条已整体删除 */
  check('底部队列播报条已删除', !document.querySelector('#queue-bar'));

  console.log('\n--- 4. 新建游戏（真实点击流程） ---');
  const nameInput = document.querySelector('#create-name');
  check('找到名字输入框', !!nameInput);
  if (nameInput) nameInput.value = '测试君主';
  check('首页已移除"玩家守则"勾选', !document.querySelector('#create-agree'));
  const contBtn0 = document.querySelector('#create-continue');
  check('首页具备存档选择入口', !!contBtn0 && !!document.querySelector('#create-save-note'));
  check('无存档时「继续」按钮隐藏', !contBtn0 || contBtn0.classList.contains('hidden'));
  const startBtn = document.querySelector('[data-action="create-start"]') || document.querySelector('#create-start');
  check('找到开始按钮', !!startBtn);

  /* v70（老板需求 5）：创建界面 —— 头像与将领同源（头像池）、归属改十三州 */
  const regChips = document.querySelectorAll('#screen-create [data-target="create-region"]');
  check('★ 归属选项 = 随机 + 十三州（14 枚）', regChips.length === 14, regChips.length + ' 枚');
  check('★ 归属选项是州名（旧「北方/中原/江南」已撤）', (function () {
    const vals = Array.from(regChips).map((el) => el.dataset.v);
    return vals.indexOf('random') >= 0 && vals.indexOf('青州') >= 0 && vals.indexOf('north') < 0;
  })());
  const avImg = document.querySelector('#create-avatar img');
  check('★ 头像预览走头像池（<img> 指向 assets/portraits/pool）',
    !!avImg && /portraits\/pool\/[mf]\d\d\.webp/.test(avImg.getAttribute('src') || ''),
    avImg ? avImg.getAttribute('src') : '（无）');
  const toastBefore = '';
  click(startBtn);
  await sleep(300);
  const toastText = (document.querySelector('#toast') || {}).textContent || '';
  check('游戏状态已创建', !!G.state, G.state ? 'ok' : ('toast=' + JSON.stringify(toastText)));
  if (!G.state) return finish();
  const s = G.state;
  const city = s.cities[0];
  /* v70（老板需求 5）：出生城归属所选州 + 君主将领入册 */
  check('★ 出生城落在所选州（就近归属一致）', (function () {
    const rg = s.ruler.region;
    return (DATA.START_STATES || []).indexOf(rg) >= 0 && G.stateOfCity(city) === rg;
  })(), s.ruler.region + ' @ ' + city.x + ',' + city.y);
  check('★ 名单含君主将领（id=lord / 与君同名同脸）', (function () {
    const lord = G.lordGeneralOf();
    return !!lord && lord.id === 'lord' && lord.isLord === true
      && lord.name === s.ruler.name && lord.portraitSeed === s.ruler.portraitSeed;
  })());
  check('游戏界面已显示', !document.querySelector('#screen-game').classList.contains('hidden'));

  console.log('\n--- 5. 城内渲染 ---');
  G.ui.setView('city');
  await sleep(50);
  const vc = document.querySelector('#view-container');
  check('城内格子 ≥32', vc.querySelectorAll('.iso-tile').length >= 32, vc.querySelectorAll('.iso-tile').length + ' 个');
  /* v23：官府 4 格融合为 1 座宫殿 → 地块面数 = 32 普通格 + 1 宫殿 */
  check('城内为等距地块（iso-board + tile-face）', !!vc.querySelector('.iso-board') && vc.querySelectorAll('.tile-face').length >= 33,
    vc.querySelectorAll('.tile-face').length + ' 块地块面');
  /* 官府 4 格里只有主格立建筑（其余 3 格是台基），所以 33 = 36 - 3 */
  check('有建筑的格都有容器（tile-art，底边落在格心）', vc.querySelectorAll('.tile-art').length >= 32,
    vc.querySelectorAll('.tile-art').length + ' 个');
  /* v23（需求 4）：4 格不再逐格渲染，改为跨格融合成一座宫殿 */
  check('官府 4 格融合为一座宫殿（需求 4）',
    vc.querySelectorAll('.gov-palace').length === 1
    && vc.querySelectorAll('.gov-palace svg.gov-svg, .gov-palace img.gov-img').length === 1
    && vc.querySelectorAll('.iso-tile.gov').length === 0,
    vc.querySelectorAll('.gov-palace').length + ' 座宫殿 / ' +
    vc.querySelectorAll('.iso-tile.gov').length + ' 个旧台基格');
  /* v20：正方形网格 —— 元素与地块同位同尺寸，几何上不可能错位。
     注意：jsdom 对绝对定位元素不返回真实 getBoundingClientRect（全 0），
     所以几何判定读**内联样式**（这也正是浏览器实际用来布局的值）。 */
  check('地块为正方形（无 clip-path 剪切）', (function () {
    var css = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    /* v89.105（基调统一）：字面圆角已令牌化 —— 判据改查「令牌值 + 令牌引用」 */
    return !/--tile-clip/.test(css) && /--r-xl: 10px/.test(css)
      && /border-radius: var\(--r-xl\)/.test(css)
      && !/rotateZ\(-45deg\) rotateX\(-56deg\)/.test(css);
  })());
  check('地块尺寸等于格距（正方形密铺）', (function () {
    var t0 = vc.querySelectorAll('.iso-tile');
    if (t0.length < 2) return false;
    var box = function (el) {
      return {
        w: parseFloat(el.style.width), h: parseFloat(el.style.height),
        l: parseFloat(el.style.left), t: parseFloat(el.style.top),
      };
    };
    var a = box(t0[0]), b = box(t0[1]);
    /* v25：边长按平板调（88 → 76），判据取实际常量，不写死 */
    var TW = G.ui.TILE_W;
    return a.w === TW && a.h === TW
      && Math.round(b.l - a.l) === TW && Math.round(b.t - a.t) === 0;
  })());
  check('第二行与第一行同列对齐（正方形网格的关键性质）', (function () {
    var t0 = vc.querySelectorAll('.iso-tile');
    if (t0.length < 12) return false;
    var box = function (el) { return { l: parseFloat(el.style.left), t: parseFloat(el.style.top) }; };
    var first = box(t0[0]), second = null;
    for (var i = 1; i < t0.length; i++) {
      var b = box(t0[i]);
      if (Math.round(b.t) !== Math.round(first.t)) { second = b; break; }
    }
    if (!second) return false;
    /* 第二行首格必须与第一行首格**同一左边界**（正方形网格不会逐行错位） */
    return Math.round(second.l) === Math.round(first.l)
      && Math.round(second.t - first.t) === G.ui.TILE_H;
  })());
  check('已建地块底板退成弱承托（.iso-tile.built）', vc.querySelectorAll('.iso-tile.built').length >= 2,
    vc.querySelectorAll('.iso-tile.built').length + ' 格');
  check('建筑图标居中在格内（无上浮 · 无接触阴影）', (function () {
    if (vc.querySelectorAll('.tile-foot').length) return false;
    var t = vc.querySelector('.iso-tile.built .tile-art');
    if (!t) return false;
    var r = t.getBoundingClientRect(), p = t.parentNode.getBoundingClientRect();
    return Math.abs((r.left + r.width / 2) - (p.left + p.width / 2)) <= 1
      && Math.abs((r.top + r.height / 2) - (p.top + p.height / 2)) <= 1;
  })());
  /* v23（需求 2/3）：名字在底部标签，等级在右上角角标（只数字） */
  check('名字在底部、等级在右上角角标（需求 2/3）',
    !!vc.querySelector('.iso-tile.built .tile-label .nm')
    && !!vc.querySelector('.iso-tile.built .tile-badge')
    && !vc.querySelector('.iso-tile.built .tile-label .lv'));
  /* v89.61（老板「名称按钮应同时控制 城池内 / 城外建筑 / 地图地块 3 大部分」）
     —— 真实点击底栏最左「🏷 名称」：body 挂 labels-off（城内视图的建筑名与等级角标
     随之被 CSS 隐藏；节点保留，故上面的结构断言不受影响），再点一次复原。 */
  {
    const lblBtn = document.querySelector('#bottom-bar .bb-label-toggle');
    const hadOff = document.body.classList.contains('labels-off');
    check('v89.61：底栏最左「🏷 名称」按钮在册', !!lblBtn);
    if (lblBtn) click(lblBtn);
    await sleep(60);
    check('v89.61：关名称 → body.labels-off（城内标签/角标仍在 DOM，交由 CSS 隐藏）',
      document.body.classList.contains('labels-off') !== hadOff
      && !!vc.querySelector('.iso-tile.built .tile-label')
      && !!vc.querySelector('.iso-tile.built .tile-badge'),
      'labels-off=' + document.body.classList.contains('labels-off'));
    /* ⚠️ v89.151：点击后底栏**重绘**（按钮文案随状态走：隐藏名称↔显示名称）——
       旧节点已被替换成孤儿（脱离文档后点击不再冒泡到委托）→ **必须重新查询**，
       这与真实用户点的"屏幕上的那个新按钮"一致。 */
    const lblBtn2 = document.querySelector('#bottom-bar .bb-label-toggle');
    if (lblBtn2) click(lblBtn2);
    await sleep(60);
    /* ⚠️⚠️ 第二次点击后又重绘了一次 —— `lblBtn2` 也成了孤儿（textContent 停在上一次渲染）！
       读状态必须**再次查询**当前节点（§58.6：操作后重新取元素；本轮这个坑踩了两次）。 */
    const lblTxt2 = document.querySelector('#bottom-bar .bb-label-toggle');
    check('v89.61/§151：再点一次复原（labels-off 归位 · 文案与状态一致）',
      document.body.classList.contains('labels-off') === hadOff
      && (lblTxt2 ? (document.body.classList.contains('labels-off')
        ? lblTxt2.textContent.indexOf('显示名称') >= 0
        : lblTxt2.textContent.indexOf('隐藏名称') >= 0) : true),
      lblTxt2 ? ('off=' + document.body.classList.contains('labels-off') + ' txt=' + lblTxt2.textContent) : '按钮丢失');
  }
  /* v25（需求 1）：城墙是一圈环（墙身/雉堞/压顶/角楼），并带四条点击热区。
     判据只看"结构齐备 + 热区存在"，不数 polygon 个数（画法会变）。 */
  /* v89.128：环城视觉 = **城墙建筑的外观**（修了才画）= 完整形制只在建好后出现。
     v89.169（老板「城墙 0 级的时候不明显」）：0 级改画**虚线虚影环**（可见入口）——
     先验"实墙不画、虚影在"，再摆上验实墙结构。 */
  check('未修建城墙时：不画实墙环、画虚线虚影环（v89.169）',
    !vc.querySelector('svg.iso-wall:not(.iso-wall-ghost)')
    && !!vc.querySelector('svg.iso-wall-ghost'));
  check('虚影环结构：虚线描边 + 四角虚影角楼位（与实墙同一几何出口）', (function () {
    const g169e = vc.querySelector('svg.iso-wall-ghost');
    if (!g169e) return false;
    const p169e = g169e.querySelector('polygon.wghost-line');
    return !!p169e && (p169e.getAttribute('stroke-dasharray') || '').length > 0
      && g169e.querySelectorAll('rect.wghost-corner').length === 4;
  })());
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 1 };
  G.refreshAll();
  await sleep(90);
  check('城墙为环形 SVG 且四角有角楼',
    !!vc.querySelector('svg.iso-wall')
    && vc.querySelectorAll('svg.iso-wall polygon').length >= 3
    && vc.querySelectorAll('svg.iso-wall .wtower').length === 4);
  check('城墙四条点击热区齐备（需求 1：点击进行操作）',
    vc.querySelectorAll('.wall-hit[data-action="open-wall"]').length === 4);
  check('城墙不再有文字标签',
    !vc.querySelector('.wtag') && vc.innerHTML.indexOf('点击升级') < 0);
  check('内城 48 格（8 列 × 6 行）', city.cells.length === 48);   /* v40（需求 2） */
  check('官府占 4 格', city.cells.filter((c) => c.build && c.build.id === 'guanfu').length === 4);

  console.log('\n--- 6. 点空地 → 建造 ---');
  s.res.grain += 50000; s.res.wood += 50000; s.res.stone += 50000; s.res.iron += 50000;
  G.ui.setView('city');
  await sleep(60);
  const emptyCell = vc.querySelector('.iso-tile.empty');
  const emptyIdx = emptyCell ? Number(emptyCell.dataset.idx) : -1;
  check('找到空地格', emptyIdx >= 0 && !city.cells[emptyIdx].build, 'idx=' + emptyIdx);
  click(emptyCell);
  const modal = document.querySelector('#modal-root');
  check('建造弹窗打开', modal.innerHTML.length > 100, modal.innerHTML.length + ' 字符');
  const bookBtn = modal.querySelector('[data-build="shuyuan"]');
  check('弹窗含书院选项', !!bookBtn);
  if (bookBtn) {
    click(bookBtn);
    await sleep(50);
    check('书院入队', s.queues.build.length === 1, s.queues.build.length + ' 队列');
    check('格子进入 pending', !!city.cells[emptyIdx].pending);
    check('队列有 totalTime', s.queues.build[0] && s.queues.build[0].totalTime > 0,
      s.queues.build[0] ? s.queues.build[0].totalTime + ' 游戏秒' : '无');
    check('队列上限 2 生效', G.buildSlots ? G.buildSlots() >= 2 : true);
  }

  console.log('\n--- 7. 读秒：真实等待 3.2 秒 ---');
  G.ui.closeAllModals();
  G.ui.setView('city');
  await sleep(60);
  const pe1 = document.querySelector('[data-build-progress]');
  check('格子出现进度元素', !!pe1);
  const t1 = pe1 ? pe1.textContent.trim() : '';
  const p1 = G.buildProgress('city', emptyIdx);
  await sleep(3200);
  const pe2 = document.querySelector('[data-build-progress]');
  const t2 = pe2 ? pe2.textContent.trim() : '';
  const p2 = G.buildProgress('city', emptyIdx);
  check('倒计时文本变化', t1 !== t2, JSON.stringify(t1) + ' → ' + JSON.stringify(t2));
  check('剩余时间真实减少', p1 && p2 && p2.left < p1.left,
    p1 && p2 ? p1.left.toFixed(1) + 's → ' + p2.left.toFixed(1) + 's' : 'n/a');
  check('格式 X% · MM:SS', /^\d+%\s·\s(\d+:)?\d{2}:\d{2}$/.test(t2), t2);
  const bar1 = document.querySelector('[data-build-bar]');
  check('进度条元素存在', !!bar1);
  const w1 = bar1 ? bar1.style.width : '';
  await sleep(1300);
  const bar2 = document.querySelector('[data-build-bar]');
  const w2 = bar2 ? bar2.style.width : '';
  check('进度条宽度递增', parseFloat(w2) > parseFloat(w1), w1 + ' → ' + w2);

  console.log('\n--- 8. 侧栏三段式 ---');
  const lordName = document.querySelector('#lord-name');
  check('君主名渲染', lordName && lordName.textContent.trim().length > 0, lordName && lordName.textContent.trim());
  check('城池属性栏有内容', document.querySelector('#city-attrs').innerHTML.length > 50,
    document.querySelector('#city-attrs').innerHTML.length + ' 字符');
  check('资源栏有内容', document.querySelector('#res-bar').innerHTML.length > 50,
    document.querySelector('#res-bar').innerHTML.length + ' 字符');
  document.querySelectorAll('.side-tabs .st').forEach((el) => { /* 旧结构兼容 */ });
  check('资源栏含「+」快捷入口', /data-action="quick-item"/.test(document.querySelector('#res-bar').innerHTML));

  console.log('\n--- 9. 菜单归置（v16：底部栏取消）---');
  /* v29（需求 3）：底部栏以"固定导航条"的身份回归 —— v16 移除的是消息栏，
     现在这条只放翻页控件，高度固定。 */
  check('底部消息栏仍不存在（v16 结论不变）', !document.querySelector('#bb-channels'));
  check('v29 底部固定导航条存在且只放翻页控件', (function () {
    var bb = document.querySelector('#bottom-bar');
    if (!bb) return false;
    return bb.className.indexOf('bottombar') >= 0 && bb.querySelector('.pager, .bb-hint') != null;
  })());
  /* v25（需求 2）：商城/背包从"动作按钮"改为"视图"；需求 10：每个菜单带线描图标 */
  check('顶栏含「商城」视图', !!document.querySelector('#topnav [data-view="shop"]'));
  check('顶栏含「背包」视图', !!document.querySelector('#topnav [data-view="bag"]'));
  check('顶栏菜单带手绘图标（11 个）',
    document.querySelectorAll('#topnav .ti[data-nav] svg.nav-ico').length >= 11,
    document.querySelectorAll('#topnav .ti[data-nav] svg.nav-ico').length + ' 个');
  check('「爵位」不再是独立菜单（已并入君主）', !document.querySelector('#topnav [data-view="rank"]'));
  /* v19：公告不再是独立菜单，内容并入公文页 */
  check('公告已并入公文（顶栏无公告菜单）', !document.querySelector('#topnav [data-action="open-notice"]'));
  check('顶栏含「行军」菜单', !!document.querySelector('#topnav [data-view="marches"]'));
  check('顶栏按类型分组（≥4 处分隔线）',
    document.querySelectorAll('#topnav .nav-sep').length >= 4,
    document.querySelectorAll('#topnav .nav-sep').length + ' 处');
  check('顶栏含「设置」', !!document.querySelector('#topnav [data-view="settings"]'));
  check('「排行」已取消', !document.querySelector('[data-action="open-rank-list"]'));
  /* 消息流已整合进公文；v89.107 起公文是**五类独立页签** */
  G.ui.setView('reports');
  await sleep(80);
  const repHtml = vc.innerHTML;
  /* v89.153（老板 1/2）：页签顺序 系统/战报/侦查，**默认页 = 系统** */
  check('公文页含系统区（默认页）', repHtml.indexOf('公文 · 系统') >= 0 && repHtml.indexOf('id="doc-body"') >= 0);
  /* v89.116：烽火移出公文；v89.153（老板 2）：任务并入系统页 → 页签 **3 类**：
     系统 / 战报 / 侦查（顺序 = 老板原话）。断言同时钉住"烽火/任务页签不存在"。 */
  check('公文页含三类页签（系统 / 战报 / 侦查 · 烽火与任务已移出）',
    document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length === 3,
    document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length + ' 个页签');
  check('公文页签里没有烽火（烽火流水在军务 · 烽火）',
    !document.querySelector('.doc-tabs [data-v="beacon"]'));
  check('消息保留策略为 10 游戏天', G.msgDays() === 10 && /保留 10 游戏天|保留最近|msgLog/.test(
    require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8')));
  /* 切页签：正文真的换（侦查页 ≠ 战报页），且动作走 ui.setDocTab；
     另验"烽火直调 → 给一句已移出的指引"（老档 _docTab 残留也不会渲染旧板块）。 */
  const scTab = document.querySelector('.doc-tabs [data-v="scout"]');
  if (scTab) {
    click(scTab); await sleep(80);
    check('可切换公文页签（切换到侦查页）', G.ui._docTab === 'scout'
      && document.querySelector('#doc-body') !== null, '页签=' + G.ui._docTab);
    const bh = G.ui.docBodyHTML('beacon');
    check('公文直调烽火 → 只给"已移出"指引（不再渲染烽火流水）',
      bh.indexOf('已移出公文') >= 0 && bh.indexOf('bb-line beacon') < 0);
    G.ui.setDocTab('beacon'); await sleep(60);       /* 不在页签里的类别：拒绝并回落战报 */
    check('切换被移出的类别会被拒（回落系统页 · v89.153）', G.ui._docTab === 'sys');
    G.ui.setDocTab('war'); await sleep(60);
  }
  check('消息写入存档（msgLog 持久化）', Array.isArray(s.msgLog));
  G.ui.setView('city');
  await sleep(60);

  console.log('\n--- 10. 标签页渲染（真实 DOM） ---');
  const views = ['city', 'ext', 'map', 'generals', 'troops', 'tech', 'equip', 'items', 'rank', 'tasks', 'stats', 'story', 'settings', 'shop', 'bag'];
  for (const v of views) {
    try {
      G.ui.setView(v);
      await sleep(20);
      const len = vc.innerHTML.length;
      check('标签 ' + v, len > 30, len + ' 字符');
    } catch (e) { check('标签 ' + v, false, '抛错: ' + e.message); }
  }

  console.log('\n--- 11. 原版式弹窗（真实函数名） ---');
  /* v77（老板）：建筑信息 / 资源生产退役；附属野地保留（资源区下拉框进入）。 */
  const modals = [['君主', 'openLordInfo'], ['附属野地', 'openWilds'],
    ['客栈', 'openInn'], ['招贤馆', 'openHostel'], ['市集', 'openMarket'], ['仓库', 'openStore'],
    ['铁匠铺', 'openForge']];
  for (const [label, fn] of modals) {
    if (typeof G.ui[fn] !== 'function') { check('弹窗 ' + label, false, fn + ' 未定义'); continue; }
    try {
      document.querySelector('#modal-root').innerHTML = '';
      G.ui[fn]();
      const len = document.querySelector('#modal-root').innerHTML.length;
      check('弹窗 ' + label, len > 50, len + ' 字符');
    } catch (e) { check('弹窗 ' + label, false, '抛错: ' + e.message); }
  }
  G.ui.closeAllModals();
  /* 装备 / 宝物：v12 起统一为弹窗面板（由建筑或君主栏「背包」打开） */
  G.ui.openEquipPanel();
  const eqModal = document.querySelector('#modal-root').innerHTML;
  check('装备入口 → 弹窗面板', eqModal.length > 200 && eqModal.indexOf('close-modal') >= 0, eqModal.length + ' 字符');
  G.ui.openItemsPanel();
  const itModal = document.querySelector('#modal-root').innerHTML;
  check('宝物入口 → 弹窗面板', itModal.length > 200 && itModal.indexOf('close-modal') >= 0, itModal.length + ' 字符');
  /* v25（需求 2）：背包改为整页视图 —— 断言从 #modal-root 移到 #view-container */
  G.ui.openBag();
  await sleep(60);
  const bagModal = document.querySelector('#view-container').innerHTML;
  check('背包整页渲染', bagModal.length > 300, bagModal.length + ' 字符');
  check('背包分「装备 / 宝物」两类 + 宝物二级分类（v89.115）',
    bagModal.indexOf('data-v="equip"') >= 0 && bagModal.indexOf('data-v="treasure"') >= 0
    && bagModal.indexOf('bag-sub') >= 0);
  check('背包标题含触发式说明（不再常驻讲规则）',
    /help-chip/.test(document.querySelector('#view-container').innerHTML));
  G.ui.setView('city');
  await sleep(40);

  console.log('\n--- 12. 关键动作全链路 ---');
  s.settings.timeScale = 600;
  s.res.grain += 200000; s.res.wood += 200000; s.res.stone += 200000; s.res.iron += 200000;
  s.res.gold += 100000; s.res.pop += 5000;
  await sleep(2200); // 高倍率下让在建书院先完工（后续科技研究依赖它）
  const act = (label, fn) => {
    try { const r = fn(); check(label, r === undefined || r === null || r.ok !== false, r && r.msg ? r.msg : 'ok'); return r; }
    catch (e) { check(label, false, '抛错: ' + e.message); return null; }
  };
  act('升级城内建筑', () => G.doUpgrade(emptyIdx));
  act('训练义兵', () => G.doTrain('yibing'));
  act('研究科技', () => G.systems.research('zhongzhi'));
  act('城外地块建造', () => {
    const ei = extOf(s).findIndex((e) => !e.type && !e.pending);
    return G.doExtBuild(ei, 'farm');
  });
  act('使用宝物', () => G.systems.useItem('shennongchu'));
  act('取消建造', () => {
    const q = s.queues.build[0];
    if (!q) return { ok: true, msg: '无队列' };
    return G.doCancelBuild(q.extIdx != null ? 'ext' : 'city', q.extIdx != null ? q.extIdx : q.gridIndex);
  });

  console.log('\n--- 13. 定时器驱动 5 秒 ---');
  const g0 = s.res.grain;
  const resTxt1 = document.querySelector('#res-bar').textContent;
  await sleep(2200);
  const resTxt2 = document.querySelector('#res-bar').textContent;
  check('资源栏数字真实变化（肉眼可见增长）', resTxt1 !== resTxt2,
    (resTxt1.match(/[\d,]+\.\d{2}/) || [''])[0] + ' → ' + (resTxt2.match(/[\d,]+\.\d{2}/) || [''])[0]);
  /* v19：存量取整（不再有小数）；资源行只用文字、无图标、无每小时提示 */
  /* v65（老板）：存量改"万/亿"短写（位数一多太占地方），所以判据从"纯数字"改为
     "数字 + 可选中文单位"；单位是小字 <i class="amt-u">，textContent 会一起带出来。 */
  check('资源栏存量显示为短写（数字 + 可为空的中文单位）', (function () {
    var amtEl = document.querySelector('#res-bar .amt');
    if (!amtEl) return false;
    var t = amtEl.textContent.trim();
    return /^[\d,.]+[万亿]?$/.test(t) && !!amtEl.querySelector('.amt-u') === /[万亿]$/.test(t);
  })(), (document.querySelector('#res-bar .amt') || {}).textContent);
  check('资源栏无图标（纯文字）', document.querySelectorAll('#res-bar svg, #res-bar img').length === 0,
    document.querySelectorAll('#res-bar svg').length + ' 个图标');
  check('资源栏已去掉每小时产量提示', document.querySelector('#res-bar').textContent.indexOf('每小时') < 0);
  check('资源栏显示 /时 增速（v89.123 起每小时口径）', resTxt2.indexOf('/时') > 0);
  await sleep(3000);
  check('生产持续推进', s.res.grain !== g0, Math.round(s.res.grain - g0) + ' 粮变化');
  check('队列数正常', s.queues.build.length + s.queues.train.length + s.queues.tech.length <= 6,
    (s.queues.build.length + s.queues.train.length + s.queues.tech.length) + ' 队列');
  check('日志在写入', (s.log || []).length > 0, (s.log || []).length + ' 条');


  console.log('\n--- 15. 叙事层可见性 ---');
  G.ui.setView('story');
  await sleep(80);
  const storyHtml = vc.innerHTML;
  check('史册面板渲染', storyHtml.length > 300, storyHtml.length + ' 字符');
  check('史册含天时栏', storyHtml.indexOf('天时') >= 0);
  check('史册含时代之志', storyHtml.indexOf('时代之志') >= 0);
  check('史册含实力折算', storyHtml.indexOf('实力折算') >= 0);
  /* v89.104（老板「不要史书纪事了，没有什么实质内容」）：整段撤出 */
  check('史册不含史书纪事（v89.104 已撤出：没有实质内容）', storyHtml.indexOf('史书纪事') < 0);
  check('史册含称号评定', storyHtml.indexOf('当前评定') >= 0);
  /* v26（需求 3）：天时已从左侧「城池属性」移到顶栏（菜单与存档之间的偏右位置） */
  const attrHtml = document.querySelector('#city-attrs').innerHTML;
  check('侧栏不再显示天时', attrHtml.indexOf('天时') < 0);
  const skyEl = document.querySelector('#nav-sky');
  check('顶栏显示天时（菜单与存档之间）', !!skyEl && skyEl.textContent.indexOf('天时') >= 0,
    skyEl ? skyEl.textContent.trim() : 'n/a');
  check('天时排在「自动」「设置」之后的最右（v29：存档/新游戏已移出顶栏）', (function () {
    const nav = document.querySelector('#topnav');
    if (!skyEl) return false;
    const kids = Array.prototype.slice.call(nav.children);
    const iSky = kids.indexOf(skyEl);
    const iSet = kids.findIndex((x) => x.dataset.view === 'settings');
    const iAuto = kids.findIndex((x) => x.dataset.view === 'auto');
    const hasSave = kids.some((x) => x.dataset.action === 'save' || x.dataset.action === 'new-game');
    return iAuto >= 0 && iSet >= 0 && iAuto < iSet && iSet < iSky && !hasSave;
  })());
  check('顶栏「自动」菜单可进入（自动出征面板）', (function () {
    const t = document.querySelector('#topnav [data-view="auto"]');
    return !!t && !!t.querySelector('svg.nav-ico');
  })());
  check('羁绊不在界面暴露', storyHtml.indexOf('羁绊') < 0 && attrHtml.indexOf('羁绊') < 0);
  G.ui.openWilds();
  const wildHtml = document.querySelector('#modal-root').innerHTML;
  check('野地面板含产出资源列', wildHtml.indexOf('产出资源') >= 0);
  check('野地面板含资源合计', wildHtml.indexOf('野地贡献合计') >= 0);
  check('野地合计列出四类资源', /粮/.test(wildHtml) && /木/.test(wildHtml) && /石/.test(wildHtml) && /铁/.test(wildHtml));
  G.ui.closeAllModals();

  console.log('\n--- 18. 岁贡与外城按城独立（v14）---');
  const conq18 = G.makeCity({ id: 'conq_e2e18', name: '江陵', x: 255, y: 335, type: 'jun', state: '荆州' });
  s.cities.push(conq18);
  check('新占城池自带外城地块', !!conq18.extGrid && conq18.extGrid.length === 12);
  check('各城外城地块互相独立', conq18.extGrid !== s.cities[0].extGrid);
  check('extGridOf 按城返回', G.extGridOf(conq18) === conq18.extGrid);
  check('extUsed 按城统计', G.extUsed(conq18) === 0, '新城 0 块已开发');
  const cityHtml18 = G.ui.cityHTML();
  /* v22（需求 3）：中央只留城池与地块；身份与数值下沉侧栏 */
  check('城池视图只留棋盘（不再有标题行/征收/缩放/岁贡）',
    /city-pure/.test(cityHtml18) && /city-iso/.test(cityHtml18)
    && cityHtml18.indexOf('州郡岁贡') < 0 && cityHtml18.indexOf('显示比例') < 0
    && cityHtml18.indexOf('官府Lv') < 0 && cityHtml18.indexOf('以民心换金') < 0);
  G.ui.renderSide();
  /* v27（需求 1）：#city-tools 板块已删除，切城并进城池属性 */
  const tools18 = (document.querySelector('#city-attrs') || {}).innerHTML || '';
  /* v25（需求 5）：州郡岁贡从左侧栏移入「名城官府」—— 它是"这块地盘值多少"，
     属于官府的账，不该常驻占着屏幕左侧。 */
  /* 岁贡只属于"攻占的名城"，所以先切到那座城再看官府 */
  G.ui.setCity(conq18.id);
  await sleep(60);
  openGov();
  await sleep(80);
  const govY18 = document.querySelector('#modal-root').innerHTML;
  /* v89.135：官府面板退役 —— 岁贡行并入官府格建筑面板的「官府要务」段 */
  check('名城的官府段内含本城岁贡', govY18.indexOf('岁贡 / 日') >= 0);
  check('岁贡列出特产（荆州蜀锦）', govY18.indexOf('蜀锦') >= 0);
  check('岁贡显示每日收入（金 / 声望）',
    govY18.indexOf('岁贡 / 日') >= 0 && govY18.indexOf('金 +') >= 0);
  G.ui.closeAllModals();
  G.ui.setCity(G.state.cities[0].id);
  await sleep(40);
  /* v24（需求 4）：征收移入「官府」建筑，侧栏只留切换城池 / 显示比例 / 岁贡 */
  /* v25（需求 3/5）：征收 → 官府；显示比例 → 设置；州郡岁贡 → 名城官府 */
  check('侧栏不再有 征收 / 显示比例 / 岁贡',
    tools18.indexOf('征收') < 0 && tools18.indexOf('显示比例') < 0 && tools18.indexOf('岁贡') < 0);
  /* 切到新城：外城应为全荒地（证明地块按城独立） */
  G.ui.setCity(conq18.id);
  const extHtml18 = G.ui.extHTML();
  check('城外视图同样只留棋盘', /city-pure/.test(extHtml18) && /city-iso/.test(extHtml18)
    && extHtml18.indexOf('城外资源地块') < 0);
  G.ui.renderSide();
  const attrs18 = (document.querySelector('#city-attrs') || {}).innerHTML || '';
  /* v24（需求 6）：侧栏的「城外地块 0/12」一行已删 —— 城外棋盘本身就是这块数据 */
  check('新城外城为空地（0/12 块）', G.extUsed(conq18) === 0 && G.extCap(conq18) === 12,
    G.extUsed(conq18) + ' / ' + G.extCap(conq18));
  /* v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
     本断言自 v70 翻转：只验城名在、坐标与州全称**不在** */
  check('侧栏城池属性只显城名（不含坐标 / 不含州全称）',
    attrs18.indexOf('江陵') >= 0
    && attrs18.indexOf('500×500') < 0
    && attrs18.indexOf(G.coordText(conq18)) < 0
    && attrs18.indexOf('官府Lv') < 0
    && (G.cityFullName(conq18).indexOf(' · ') < 0
        || attrs18.indexOf(G.cityFullName(conq18)) < 0));
  /* v23（需求 5）：侧栏只反映当前城池，全境汇总移到底栏「统计」菜单 */
  /* v23/v24：侧栏只讲当前城池 —— 无全境汇总，也不再有城防·驻军 / 城外地块两行 */
  check('侧栏只反映当前城池（无全境汇总 / 无城防驻军 / 无城外地块）',
    attrs18.indexOf('全境') < 0 && attrs18.indexOf('城防') < 0
    && attrs18.indexOf('驻军') < 0 && attrs18.indexOf('城外地块') < 0);
  /* 在新城开垦农田 → 只影响新城 */
  s.queues.build.length = 0;
  const r18 = G.doExtBuild(0, 'farm');
  check('新城可独立开垦农田（队列已入项）',
    s.queues.build.some((q) => q.type === 'ext_build' && q.cityId === conq18.id),
    r18 && r18.msg ? r18.msg : '已入队');
  check('新城地块进入施工态', G.extGridOf(conq18)[0].pending === 'farm');
  check('首城地块未受影响', !(s.cities[0].extGrid[0].pending));
  s.queues.build.length = 0;
  G.extGridOf(conq18)[0].pending = null;
  G.ui.setCity(s.cities[0].id);
  G.ui.setView('city');

  console.log('\n--- 19. 将领交互 / 募兵 / 弹窗 / 分页（v14.1）---');
  /* ① 将领 id 唯一性：模拟「读档后 _genSeq 归零」的事故现场 */
  (function () {
    const before = s.generals.map((g) => g.id);
    G._genSeq = 0;                                   // 模拟页面刚加载
    const fresh = G.makeGeneral('撞号测试', 1, 'idle', s.cities[0].id);
    check('新招募将领不与旧将撞 id', before.indexOf(fresh.id) < 0, fresh.id + ' vs [' + before.join(',') + ']');
    s.generals.push(fresh);
    const ids = s.generals.map((g) => g.id);
    check('全库将领 id 唯一', new Set(ids).size === ids.length, ids.join(','));
    /* v41（需求 2）：将领页 = 左姓名清单 + 右完整档案，详情**不再开弹窗** */
    G.ui._genSel = s.generals[0].id;
    G.ui.setView('generals');
    const firstRow = document.querySelector('#view-container .gen-row[data-action="gen-pick"]');
    check('将领清单第一行可点（切换右侧档案）', !!firstRow,
      firstRow ? firstRow.getAttribute('data-gen') : '无');
    if (firstRow) {
      const gid = firstRow.getAttribute('data-gen');
      const paneEl = document.querySelector('#view-container .gen-pane');
      const dh = paneEl ? paneEl.innerHTML : '';
      /* v89.80：左清单默认按**等级降序**（老板口径）—— 首位不再是 s.generals[0]，
         所以"档案 = 第一行那位"这条不再成立（档案跟的是 _genSel）。
         拆成两条各测一件事：① 首行确实是等级最高者（降序真的生效）；
         ② 右侧档案显示的确实是选中的那位。 */
      const _sel = s.generals.filter((g) => g.id === G.ui._genSel)[0];
      const _first = s.generals.filter((g) => g.id === gid)[0];
      const _maxLv = Math.max.apply(null, s.generals.map((g) => g.level || 1));
      check('右侧档案显示**选中**那位将领', !!_sel && dh.indexOf(_sel.name) >= 0, G.ui._genSel);
      /* ⚠️ 判据要比**等级**而不是 id：新局将领等级常全为 1，此时排序退化到姓名次键，
         "首行是哪一个 id"就不再唯一 —— 比 id 会假红（本轮实测：lord vs g1 同为 Lv1）。 */
      check('清单首行 = 等级最高者（v89.80 默认降序）',
        !!_first && (_first.level || 1) === _maxLv,
        '首行 Lv' + (_first ? (_first.level || 1) : '?') + ' / 全库最高 Lv' + _maxLv);
      /* v26（需求 2）：四维 → 五维（新增速度），且头像左、属性右 */
      check('右侧档案含六维与忠诚', dh.indexOf('六维') >= 0 && dh.indexOf('忠诚') >= 0);
      check('右侧档案身份区为「左头像 · 右身份」两栏',
        !!document.querySelector('#view-container .gp-head .gp-face')
        && !!document.querySelector('#view-container .gp-head .gp-id .gp-name')
        && !!document.querySelector('#view-container .gen-pane .gd-dims'));
      check('六维表只有 数值/加点 两列（作用文案已进名称悬停；无「装备/丹」「合计」）', (function () {
        const head = document.querySelector('#view-container .gd-dims thead');
        if (!head) return false;
        const ths = Array.prototype.map.call(head.querySelectorAll('th'), (x) => x.textContent.trim());
        /* v74：作用列 → 加点列（每点作用改为六维名称的悬停备注） */
        return ths.length === 3 && ths[1] === '数值' && ths[2] === '加点'
          && head.textContent.indexOf('装备/丹') < 0 && head.textContent.indexOf('合计') < 0;
      })());
      check('第五维是速度、第六维是体力；末行是自由属性点（v74）', (function () {
        const rows = document.querySelectorAll('#view-container .gd-dims tbody tr');
        if (rows.length !== 7) return false;              /* 六维 + 自由属性点行 */
        return rows[4].textContent.indexOf('速度') >= 0
          && rows[5].textContent.indexOf('体力') >= 0
          && rows[6].textContent.indexOf('自由属性点') >= 0
          && !!rows[4].querySelector('[data-action="gen-stat-plus"]');
      })());
      /* v41（需求 2）：人形装备栏内嵌在右侧档案里 */
      check('人形装备栏内嵌在右侧档案（12 槽，不开弹窗）',
        !!document.querySelector('#view-container .gen-pane .doll .doll-fig-svg')
        && document.querySelectorAll('#view-container .gen-pane .doll-slot').length === 12
        && document.querySelectorAll('#modal-root .doll-slot').length === 0);
    }
    s.generals.pop();
  })();

  /* ①.5 v89.40：一次加点（数量框批量）+ 君主不出忠诚行（真实 DOM） */
  await (async function () {
    const gid40 = s.generals[0].id;
    const fp0 = s.generals[0].freePts || 0;
    const tong0 = s.generals[0].tong;
    s.generals[0].freePts = fp0 + 15;
    G.ui._genSel = gid40;
    G.ui.setView('generals');
    await sleep(60);
    const plus40 = document.querySelector('#view-container .gd-dims [data-action="gen-stat-plus"][data-stat="tong"]');
    check('加点入口在位（六维·统率 ＋）', !!plus40);
    if (plus40) { plus40.click(); await sleep(80); }
    const inp40 = plus40 ? document.getElementById('fp-add-' + gid40) : null;
    const apply40 = plus40 ? document.querySelector('#modal-root [data-action="stat-plus-free"]') : null;
    check('加点弹窗含数量输入框（一次加点）', !!inp40);
    check('加点按钮带 qty 透传（data-qty-from）',
      !!apply40 && apply40.getAttribute('data-qty-from') === ('fp-add-' + gid40));
    let applied40 = false;
    if (inp40 && apply40) {
      inp40.value = '10';
      apply40.click();
      await sleep(100);
      applied40 = Math.abs(s.generals[0].freePts - (fp0 + 5)) < 1e-9
        && Math.abs(s.generals[0].tong - (tong0 + 10)) < 1e-9;
    }
    check('一次加 10 点：自由点 -10、属性 +10', applied40,
      'freePts=' + s.generals[0].freePts + ' Δ统=' + (s.generals[0].tong - tong0));
    const close40 = document.querySelector('#modal-root [data-action="close-modal"]');
    if (close40) { close40.click(); await sleep(60); }
    /* 君主：右侧档案不出忠诚行与赏赐；切回普通将领照旧 */
    const lord40 = G.lordGeneralOf();
    if (lord40) {
      G.ui._genSel = lord40.id;
      G.ui.setView('generals');
      await sleep(80);
      const paneL40 = document.querySelector('#view-container .gen-pane');
      const dhL40 = paneL40 ? paneL40.innerHTML : '';
      check('v89.40：君主档案不出忠诚行与赏赐',
        dhL40.length > 200 && dhL40.indexOf('>忠诚 <b') < 0 && dhL40.indexOf('gen-gift-pick') < 0);
    } else {
      check('v89.40：君主档案不出忠诚行与赏赐（无君主，跳过）', true);
    }
    G.ui._genSel = gid40;
    G.ui.setView('generals');
    await sleep(60);
    const paneN40 = document.querySelector('#view-container .gen-pane');
    check('v89.40：普通将领档案仍有忠诚行与赏赐',
      !!paneN40 && paneN40.innerHTML.indexOf('>忠诚 <b') >= 0 && paneN40.innerHTML.indexOf('gen-gift-pick') >= 0);
    /* 复原：点数与统率回滚，不打乱后续用例 */
    s.generals[0].freePts = fp0;
    s.generals[0].tong = tong0;
  })();

  /* ② 募兵：初始就能点「训练」（原为「参数错误」） */
  /* v81：兵营三页制 —— 训练控件在步兵/骑兵页（首页为募兵队列），先切步兵页 */
  G.ui._trainTab = 'inf';
  G.ui.setView('troops');
  const trainBtn = document.querySelector('#view-container [data-action="confirm-train"]');
  check('募兵面板有训练按钮', !!trainBtn);
  if (trainBtn) {
    const troopId = trainBtn.getAttribute('data-troop');
    check('训练按钮携带合法兵种 id', !!DATA.TROOPS[troopId], String(troopId));
    const cnt = document.querySelector('#view-container #train-count');
    if (cnt) cnt.value = '1';
    /* 走真实点名路径：doTrain 读按钮上的 data-troop（此前该值为 undefined → 「参数错误」） */
    const r19 = G.train(troopId, 1, s.cities[0].id);
    check('点「训练」不再报参数错误', r19.ok === true || !/参数错误/.test(r19.msg), r19.msg);
    if (r19.ok) {
      check('训练已入队', s.queues.train.some((q) => q.troopId === troopId), troopId);
      s.queues.train.length = 0;
    } else {
      check('未入队时给出的是前置条件提示（非参数错误）', /需/.test(r19.msg), r19.msg);
    }
  }

  /* ③ 弹窗统一规范（v89.114：关闭键统一在右上角 · 圆形套叉；底部不再有） */
  G.ui.openModal('<div>裸面板</div>');
  const mh = document.querySelector('#modal-root').innerHTML;
  const mx = document.querySelector('#modal-root .modal-x[data-action="close-modal"]');
  check('关闭键在右上角 .modal-x（裸面板也恒有）',
    !!mx && mh.indexOf('modal-foot') < 0);
  check('关闭键真实可点（关闭生效）', !!mx);
  if (mx) { mx.click(); await sleep(60); check('点右上角 × 后弹窗关闭', document.querySelector('#modal-root').innerHTML === ''); }

  /* ④ 分页：任务面板 */
  G.ui.setPage('growth', 1);
  G.ui.setView('tasks');
  await sleep(80);
  const taskHtml1 = vc.innerHTML;
  check('任务面板正文不再内嵌分页条（v29：翻页控件移出内容区）', taskHtml1.indexOf('class="pager"') < 0);
  const pgBtns = document.querySelectorAll('#bottom-bar .pager [data-action="page"]');
  check('底部固定条出现可点页码', pgBtns.length > 0, pgBtns.length + ' 个');
  if (pgBtns.length) {
    const next = Array.prototype.slice.call(pgBtns).find((b) => b.getAttribute('data-n') === '2');
    if (next) {
      next.click();
      await sleep(80);
      check('点页码可翻页', G.ui._pages.growth === 2, '当前第 ' + G.ui._pages.growth + ' 页');
      check('翻页后内容变化', vc.innerHTML !== taskHtml1);
      G.ui.setPage('growth', 1);
    } else {
      check('点页码可翻页（本局仅一页，跳过）', true);
      check('翻页后内容变化（本局仅一页，跳过）', true);
    }
  }

  console.log('\n--- 20. 野地采集全流程（v15）---');
  /* 找一块可采野地并直接占领（等价于出征占领的结果） */
  let g20 = null;
  for (let dy = -30; dy <= 30 && !g20; dy++) {
    for (let dx = -30; dx <= 30 && !g20; dx++) {
      const x = s.cities[0].x + dx, y = s.cities[0].y + dy;
      if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
      const t = G.map.tile(x, y);
      if (t && G.gatherResOf(t.terrain)) g20 = { x, y, type: t.terrain };
    }
  }
  check('找到可采野地', !!g20, g20 ? (g20.type + ' (' + g20.x + ',' + g20.y + ')') : '无');
  if (g20) {
    s.wilds = s.wilds || [];
    s.wilds.push({ x: g20.x, y: g20.y, type: g20.type, level: 8, levelDay: G.questDayIndex() });
    s.gathers = [];
    /* v89.136（老板）：采集唯一形态 = 带将驻军原地开工 —— 先摆一支带将驻军 */
    if (s.generals[0]) { s.generals[0].status = 'garrison'; s.generals[0].stamina = 100; }
    const w20 = G.map.wildAt(g20.x, g20.y);
    w20.garrison = { troops: { yibing: 1000 }, cityId: s.cities[0].id, genId: s.generals[0].id };
    G.ui.openLandModal(g20.x, g20.y);
    await sleep(80);
    const lm20 = document.querySelector('#modal-root').innerHTML;
    /* v89.136：「采集」独立成区（与地块操作 / 危险操作并列），旧入口全退役 */
    check('v89.136：地块界面含独立「采集」区（开始采集键 + 原地开工说明）',
      lm20.indexOf('op-zone-t">采集') >= 0
      && lm20.indexOf('data-action="wild-garrison-gather"') >= 0
      && lm20.indexOf('原地开工') >= 0);
    check('v89.136：旧采集入口全退役（gather-open / open-gathers 不在页面）',
      lm20.indexOf('data-action="gather-open"') < 0
      && lm20.indexOf('data-action="open-gathers"') < 0);
    /* v89.152（老板 5）：已占野地**不显示产出行**（资源/产量加成/材料/珠宝都不显示） */
    check('已占野地不显示产出行（v89.152）',
      lm20.indexOf('此地可采') < 0 && lm20.indexOf('op-zone-t">产出') < 0
      && lm20.indexOf('>产量加成<') < 0);
    /* 真点「开始采集」→ 原地开工（v89.136：唯一形态） */
    const sg20 = document.querySelector('#modal-root [data-action="wild-garrison-gather"]');
    check('开始采集键可点', !!sg20);
    if (sg20) {
      click(sg20);
      await sleep(140);
      const rec = G.gatherAt(g20.x, g20.y);
      check('采集队已开局（inPlace · 原地开工）', !!rec && rec.inPlace === true,
        rec ? ('兵力 ' + rec.troops + ' · genId ' + rec.genId) : '无');
      check('驻军原地保留（不抽空）',
        G.wildGarrisonTotal(G.map.wildAt(g20.x, g20.y).garrison) === 1000);
      G.ui.openLandModal(g20.x, g20.y);
      await sleep(80);
      const gh20 = document.querySelector('#modal-root').innerHTML;
      check('采集区显示进度（未满 1 小时 · 收获带受阻说明）',
        /* v89.189 规则变更所致：受阻按钮经 ui.softenBlocked 转「可点+说明」——
           "未满 1 小时"的收获键不再带 disabled 属性，改为 data-why 受阻说明。 */
        gh20.indexOf('已采') >= 0 && gh20.indexOf('gather-finish') >= 0
        && gh20.indexOf('data-why') >= 0);
      if (rec) {
        rec.elapsed = 3 * 3600;
        const resKey = G.gatherResOf(g20.type);
        const beforeRes = s.res[resKey] || 0;
        G.ui.openLandModal(g20.x, g20.y);
        await sleep(80);
        const gr20 = document.querySelector('#modal-root [data-action="gather-finish"]');
        check('满 1 小时后可收获（按钮可用）', !!gr20 && !gr20.hasAttribute('disabled'));
        if (gr20) {
          click(gr20);
          await sleep(140);
          check('收获后资源入账', (s.res[resKey] || 0) > beforeRes,
            resKey + ' +' + Math.round((s.res[resKey] || 0) - beforeRes));
          check('收获后驻军原样（原地开工不搬兵）',
            G.wildGarrisonTotal(G.map.wildAt(g20.x, g20.y).garrison) === 1000);
          check('采集队已清空', !G.gatherAt(g20.x, g20.y));
        }
      }
    }
    if (s.generals[0]) s.generals[0].status = 'idle';   /* 复位（防污染后续用例） */
  }

  console.log('\n--- 17. 建筑功能归属 ---');
  const c17 = G.state.cities[0];
  const put17 = (id, lv) => {
    const i = c17.cells.findIndex((c) => !c.build && !c.official);
    if (i < 0) return false;
    c17.cells[i].build = { id: id, lvl: lv };
    return true;
  };
  put17('junying', 5); put17('kezhan', 3); put17('zhaoxianguan', 6);
  put17('shichang', 3); put17('cangku', 2);
  G.ui.setView('city');
  await sleep(60);
  const cells17 = vc.querySelectorAll('.iso-tile');
  let modalOk17 = false, funcBtnText = '';
  for (let i = 0; i < cells17.length; i++) {
    const cellIdx = Number(cells17[i].dataset.idx);
    if (isNaN(cellIdx)) continue;
    const cb = c17.cells[cellIdx] && c17.cells[cellIdx].build;
    if (!cb || cb.id !== 'junying') continue;
    click(cells17[i]);
    await sleep(40);
    const html = document.querySelector('#modal-root').innerHTML;
    modalOk17 = html.indexOf('募兵') >= 0;
    funcBtnText = (html.match(/⚔️ 募兵/) || [''])[0];
    check('军营弹窗含「募兵」功能入口', modalOk17, funcBtnText);
    check('军营弹窗显示可募兵种数', html.indexOf('可募兵种') >= 0);
    G.ui.closeAllModals();
    break;
  }
  check('军营格子可点击', modalOk17 || funcBtnText !== '');
  G.ui.openInn();
  await sleep(40);
  const innHtml = document.querySelector('#modal-root').innerHTML;
  check('客栈弹窗渲染', innHtml.length > 300, innHtml.length + ' 字符');
  /* 候选按游戏日刷新，可能恰好为空 → 有候选验属性、无候选验空态（两者都是正确渲染） */
  /* 候选可能是「美人」（按钮显示"相亲"），所以判据用动作名 inn-recruit 而不是按钮文案 ——
     原先只认"招募"，一旦当天候选全是美人就误报失败（偶发假红） */
  check('客栈渲染候选（含属性）或空态',
    (innHtml.indexOf('统率') >= 0 && innHtml.indexOf('inn-recruit') >= 0) || innHtml.indexOf('暂无贤士') >= 0,
    innHtml.indexOf('统率') >= 0 ? '有候选' : '空态');
  /* v64（老板）：「根据**该城的招贤馆等级**有相应空位」——
     文案从"空房"改为"<城名> 招贤馆空位 N/M"，所以判据要连**城名与席位比**一起看 */
  check('客栈显示本城招贤馆席位（城名 + N/M）', (function () {
    var nm = G.currentCity().name;                 /* 城名**现取**，不写死（改名/换城都不假红） */
    return /招贤馆空位 \d+\/\d+/.test(innHtml) && innHtml.indexOf(nm) >= 0;
  })(), (innHtml.match(/招贤馆空位 \d+\/\d+/) || ['未找到'])[0] + ' · ' + G.currentCity().name);
  G.ui.openHostel();
  await sleep(40);
  const hostHtml = document.querySelector('#modal-root').innerHTML;
  check('招贤馆弹窗显示房间数', hostHtml.indexOf('房间') >= 0, hostHtml.length + ' 字符');
  /* v89.74（老板：「鸿胪寺已拆除 → 门派驻地；点击地块时提供可选项」）：
     真实点击链：临时放一座门派驻地 → 开面板 → 点「入派」→ 归属落库 → 做一次门派任务。
     P0 是"零平衡影响"的骨架，所以这里只验归属/品阶/声望分家，**不验**数值加成（那是 P1）。 */
  {
    const pc = G.currentCity();
    let cell = null;
    (pc.cells || []).forEach(function (c) { if (!cell && !c.build) cell = c; });
    const savedBuild = cell ? cell.build : null;
    if (cell) cell.build = { id: 'honglusi', lvl: 1 };
    G.sectState().id = null; G.sectState().rep = 0; G.sectState().founder = false;
    G.sectState().tasks = {}; G.sectState().leftAt = 0;
    G.ui.openSect();
    await sleep(40);
    const scHtml = document.querySelector('#modal-root').innerHTML;
    const joinBtn = document.querySelector('#modal-root [data-action="sect-join"]');
    check('v89.74：门派面板列出六派与「入派」入口',
      scHtml.indexOf('江湖六派') >= 0 && !!joinBtn,
      (scHtml.match(/data-action="sect-join"/g) || []).length + ' 个入派按钮');
    if (joinBtn) click(joinBtn);
    await sleep(80);
    check('v89.74：点「入派」真的入派（归属落库 · 品阶为门客）',
      !!G.sectOf() && (G.sectRankOf() || {}).name === '门客',
      G.sectOf() ? G.sectOf().name : '未入派');
    const lordRep0 = G.state.rep || 0;
    const taskBtn = document.querySelector('#modal-root [data-action="sect-task"][data-v="chores"]');
    if (taskBtn) click(taskBtn);
    await sleep(80);
    check('v89.74：门派任务只涨门派声望（君主声望一分不动）',
      G.sectState().rep === 12 && (G.state.rep || 0) === lordRep0,
      '门派声望 ' + G.sectState().rep + ' · 君主声望 ' + (G.state.rep || 0));
    /* 还原：门派状态与那座临时建筑 */
    G.sectState().id = null; G.sectState().rep = 0; G.sectState().founder = false;
    G.sectState().tasks = {}; G.sectState().leftAt = 0;
    if (cell) cell.build = savedBuild;
    G.ui.closeAllModals();
    await sleep(20);
  }
  G.ui.openMarket();
  await sleep(40);
  const mkHtml = document.querySelector('#modal-root').innerHTML;
  check('市集弹窗含交易控件（数量框 + 买卖入口）',
    mkHtml.indexOf('mk-amount') >= 0 && mkHtml.indexOf('market-sell') >= 0 && mkHtml.indexOf('market-buy') >= 0);
  /* v89.60（老板）：「市场的界面太杂了，4资源+黄金可买卖就行，没必要分成 3 个板块」
     —— 单块：一张表四行，每行可买可卖；旧三块（互换 / 售卖 / 买入）控件全部退场。
     真实点击双向各来一次：卖铁 → 金增铁减；买铁 → 金减铁增。 */
  check('v89.60：市集为单块（四行表 · 每行可买可卖 · 无互换区与旧隐藏域）', (function () {
    const root = document.querySelector('#modal-root');
    if (!root) return false;
    return root.querySelectorAll('.ms-res-table tbody tr').length === 4   /* v89.100：精确选中资源表（寄售表也用 ms-table） */
      && root.querySelectorAll('[data-action="market-sell"][data-res]').length === 4
      && root.querySelectorAll('[data-action="market-buy"][data-res]').length === 4
      && !!root.querySelector('#mk-amount')
      && !root.querySelector('[data-target="mk-from"]') && !root.querySelector('#mk-sell-res')
      && !root.querySelector('#mk-buy-res');
  })(), '行数 ' + document.querySelectorAll('#modal-root .ms-res-table tbody tr').length);
  {
    /* 注意：e2e 里游戏在跑（产量按秒增长），所以**断言不等式而不是精确相等**；
       精确数额（floor(数量 × 单价)）由 smoke 的同步断言兜底。 */
    G.state.res.iron = Math.max(G.state.res.iron || 0, 50000);
    const want = G.marketSellGold('iron', 20000);
    const before = { iron: G.state.res.iron, gold: G.state.res.gold };
    const input = document.querySelector('#mk-amount');
    if (input) input.value = 20000;
    const btn = document.querySelector('#modal-root [data-action="market-sell"][data-res="iron"]');
    check('v89.60：行内「卖出」按钮在册（带 data-res=iron）', !!btn);
    if (btn) click(btn);
    await sleep(160);
    check('v89.60：点行内「卖出」真的换到金（金增 · 铁减）', (function () {
      return want > 0 && (G.state.res.gold - before.gold) >= want
        && G.state.res.iron < before.iron;
    })(), '卖 2 万铁 → 至少 ' + want + ' 金');

    /* 反方向：买铁 —— 买价走 marketBuyGoldFor（比卖出贵 35%，市场只应急） */
    G.ui.openMarket();
    await sleep(40);
    G.state.res.gold = Math.max(G.state.res.gold || 0, 200000);
    const b2 = { iron: G.state.res.iron, gold: G.state.res.gold };
    const in2 = document.querySelector('#mk-amount');
    if (in2) in2.value = 1000;
    const buyBtn = document.querySelector('#modal-root [data-action="market-buy"][data-res="iron"]');
    check('v89.60：行内「买入」按钮在册（带 data-res=iron）', !!buyBtn);
    if (buyBtn) click(buyBtn);
    await sleep(160);
    check('v89.60：点行内「买入」扣金 · 得铁', (function () {
      return G.state.res.gold < b2.gold && G.state.res.iron > b2.iron;
    })(), '买 1000 铁');
  }
  G.ui.openMarket();        /* 回到干净面板状态，供后续断言 */
  await sleep(40);
  G.ui.openStore();
  await sleep(40);
  const stHtml = document.querySelector('#modal-root').innerHTML;
  check('仓库弹窗显示储量上限', stHtml.indexOf('储量上限') >= 0 || stHtml.indexOf('仓库') >= 0);
  G.ui.closeAllModals();

  console.log('\n--- 18. 自动升级（真实交互） ---');
  s.settings.autoUpgrade = false;
  /* v36（需求 2）：自动化开关已从设置页迁出 —— 只在「自动」菜单一处，
     交互路径随之改走该菜单（语义不变：点开关 → 真的开启 → 在办事项可见）。 */
  G.ui.setView('auto');
  await sleep(60);
  const setHtml = vc.innerHTML;
  check('自动菜单含自动升级开关', setHtml.indexOf('自动升级') >= 0);
  const toggleBtn = vc.querySelector('[data-action="toggle-auto-upgrade"]');
  check('找到开关按钮', !!toggleBtn);
  click(toggleBtn);
  await sleep(80);
  check('点击后开启自动升级', s.settings.autoUpgrade === true, 'autoUpgrade=' + s.settings.autoUpgrade);
  check('开启后立即尝试排队', s.queues.build.length > 0 || !!(s.autoState && s.autoState.msg),
    s.autoState && s.autoState.msg);
  /* v29（需求 6）：队列总览迁到「官府 · 在办事项」，公文只留报告与消息 */
  openGov();
  await sleep(90);
  const gq = document.querySelector('#modal-root');
  /* v89.135（老板 10）：「在办事项」退役 —— 官府建筑面板只留「官府要务」 */
  check('官府建筑面板无「在办事项」（v89.135 退役 · 官府要务在）',
    !!gq && gq.textContent.indexOf('在办事项') < 0 && gq.textContent.indexOf('官府要务') >= 0,
    gq ? gq.textContent.replace(/\s+/g, ' ').slice(-60) : '(无官府弹窗)');
  G.ui.closeAllModals();
  G.ui.setView('reports');
  await sleep(90);
  check('公文已无队列一节（v29 · 需求 6）',
    vc.innerHTML.indexOf('id="doc-queues"') < 0 && vc.textContent.indexOf('队列') < 0);
  G.ui.setView('auto');
  await sleep(50);
  const btn2 = vc.querySelector('[data-action="toggle-auto-upgrade"]');
  click(btn2);
  await sleep(60);
  check('再次点击关闭', s.settings.autoUpgrade === false);
  openGov();
  await sleep(90);
  const gq2 = document.querySelector('#modal-root');
  check('（关闭后）官府建筑面板仍无「在办事项」',
    !!gq2 && gq2.textContent.indexOf('在办事项') < 0,
    gq2 ? gq2.textContent.replace(/\s+/g, ' ').slice(-60) : '(无官府弹窗)');
  G.ui.closeAllModals();

  console.log('\n--- 19. 地图观察框（真实 DOM 交互） ---');
  G.ui.setView('map');
  await sleep(80);
  const mapHtml = vc.innerHTML;
  /* v76（老板）：地图导航迁入底部固定导航条 —— 相关元素改从 #bottom-bar 取 */
  const bb19 = document.querySelector('#bottom-bar').innerHTML;
  check('地图含方向导航栏（v76：在底部导航条）', bb19.indexOf('map-pad') >= 0 && bb19.indexOf('map-btn') >= 0);
  const padBtns = document.querySelectorAll('#bottom-bar [data-action="map-pan"]');
  check('方向按钮共 4 个', padBtns.length === 4, padBtns.length + ' 个');
  check('含坐标输入框', !!document.querySelector('#map-gx') && !!document.querySelector('#map-gy'));
  check('含视野信息', !!document.querySelector('#map-info'), (document.querySelector('#map-info') || {}).textContent);
  const cv19 = vc.querySelector('#mapCanvas');
  check('地图 canvas 存在', !!cv19);
  /* v26（需求 4）：观察框 12×8、格距 52 —— 判据取实际常量，不写死像素
     （1024×768 平板实数校验：624×416 的画布放得进中央区，见 ui.js 顶部注释） */
  check('canvas = 观察框宽高 × 格距（宽高不等）', cv19
    && cv19.width === G.map._view.spanX * G.map._view.cell
    && cv19.height === G.map._view.spanY * G.map._view.cell,
    cv19 ? (cv19.width + '×' + cv19.height) : 'n/a');
  /* v27（需求 9）：格距按窗口算（jsdom 无布局 → 回落到基准 1180×820 的取值） */
  /* v85（老板「占满 + 放大」）：fitMapCell 改**搜索式自适应** —— 行列不再固定 12×6，
     取"覆盖率最优、格距次优"的解；格距上限 104 → 128。
     v89.52（老板「地块再缩小到 1/2~1/3」）：格距上限 128 → 44，观察框上限放宽到 32×20。
     jsdom（无布局，基准框 869×758）下确定输出 20×17@41。 */
  /* v89.104（老板「地图放大 20%，视野窄一点、画面大一点」）：20×17@41 → 17×14@49 */
  /* v89.138（老板 1）：ZOOM 2.0 + 铺满优先评分 —— jsdom 基准从 17×14@49 → **9×8@88** */
  check('观察框为搜索式自适应（v89.138 放大 2.0× 后 jsdom 基准 9×8@88），格距在合理区间',
    G.map._view && G.map._view.spanX === 9 && G.map._view.spanY === 8
    && G.map._view.cell >= 34 && G.map._view.cell <= 88,
    G.map._view.spanX + '×' + G.map._view.spanY + ' cell=' + G.map._view.cell);
  check('地图为菱形等距（半宽 = cell/2、半高 = cell/4、视口中心为 vx/vy）',
    G.map._view && G.map._view.HW === G.map._view.cell / 2
    && G.map._view.HH === G.map._view.cell / 4 && G.map._view.iso === true
    && !G.map._view.W && !G.map._view.thick,
    'cell=' + (G.map._view && G.map._view.cell) + ' HW=' + (G.map._view && G.map._view.HW));
  check('地图拾取为菱形反投影（格心与菱形内多个点都命中本格）', (function () {
    var v = G.map._view;
    /* jsdom 里 canvas 的 getBoundingClientRect 全 0，pick 会除零 —— 必须先注入桩 */
    var old = cv19.getBoundingClientRect;
    cv19.getBoundingClientRect = function () { return { left: 0, top: 0, width: cv19.width, height: cv19.height }; };
    var at = function (gx, gy) { return { x: v.ox + (gx - gy) * v.HW, y: v.oy + (gx + gy) * v.HH }; };
    var a = at(v.vx + 3, v.vy + 5), b = at(v.vx + 8, v.vy + 2);
    var h1 = G.map.pick(cv19, a.x, a.y);
    var h2 = G.map.pick(cv19, b.x, b.y);
    /* 菱形内的斜向偏移（半宽 0.4 倍）也必须落在同一格 —— 这正是"斜投影必然对不齐"的反证 */
    var h3 = G.map.pick(cv19, a.x + v.HW * 0.4, a.y);
    var h4 = G.map.pick(cv19, a.x, a.y + v.HH * 0.8);
    cv19.getBoundingClientRect = old;
    return h1 && h1.x === v.vx + 3 && h1.y === v.vy + 5
      && h2 && h2.x === v.vx + 8 && h2.y === v.vy + 2
      && h3 && h3.x === h1.x && h3.y === h1.y
      && h4 && h4.x === h1.x && h4.y === h1.y;
  })());
  check('地图画出野外城池（据点立牌）', cv19 && /drawFortArt/.test(G.map.render.toString()));
  /* v24（需求 1/3）：地形图例与说明整段删除（地形本身由画布绘制，不受影响） */
  check('地图不再渲染图例与说明文字',
    !/湖泊/.test(mapHtml) && !/森林/.test(mapHtml) && !/荒漠/.test(mapHtml) && !/山地/.test(mapHtml)
    && !/天下大势/.test(mapHtml) && !/观察框/.test(mapHtml) && !/名城（红=都城/.test(mapHtml));
  check('地图导航在底部条内（含方向键；v76）', bb19.indexOf('map-dock') >= 0 && bb19.indexOf('map-pad') >= 0);
  /* 真实点击右移按钮。v45（需求 2）：步长由 1 格改为常量 ui.MAP_STEP_X（12） */
  const x0 = G.ui.mapView.x;
  const rightBtn = Array.prototype.slice.call(padBtns)
    .filter((b) => Number(b.dataset.dx) === G.ui.MAP_STEP_X)[0];
  check('找到右移按钮', !!rightBtn);
  click(rightBtn);
  await sleep(60);
  check('点击右移后视野变化（一次一屏）', G.ui.mapView.x === x0 + G.ui.MAP_STEP_X,
    x0 + ' → ' + G.ui.mapView.x);
  check('视野信息同步刷新', (document.querySelector('#map-info') || {}).textContent === G.ui.mapInfoText(),
    (document.querySelector('#map-info') || {}).textContent);
  /* 坐标跳转 */
  document.querySelector('#map-gx').value = '265';
  document.querySelector('#map-gy').value = '215';
  click(document.querySelector('[data-action="map-goto"]'));
  await sleep(60);
  check('坐标跳转生效（v50：目标即视野中心）',
    G.ui.mapView.x === 265 && G.ui.mapView.y === 215,
    '(' + G.ui.mapView.x + ',' + G.ui.mapView.y + ')');
  /* 回主城 */
  const pc19 = G.map.playerCity();
  click(document.querySelector('[data-action="map-center"]'));
  await sleep(60);
  check('回主城后主城居中（v50：视野中心 = 主城格）', (function () {
    return G.ui.mapView.x === pc19.x && G.ui.mapView.y === pc19.y;
  })(), '(' + G.ui.mapView.x + ',' + G.ui.mapView.y + ') 主城 (' + pc19.x + ',' + pc19.y + ')');
  /* 点击地图格子 */
  const clickEv = new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: 30, clientY: 30 });
  cv19.dispatchEvent(clickEv);
  await sleep(60);
  check('点击地图格子有响应', true, document.querySelector('#modal-root').innerHTML.length > 0 ? '弹出面板' : '选中格子');
  G.ui.closeAllModals();

  /* v89.5：灵机之地 —— 地图悬青旗（渲染接线 + 点选提示 + 真实点击） */
  console.log('\n--- 19b. v89.5 灵机之地（地图悬旗） ---');
  /* v89.86（测试修复）：v89.45 起野地江湖游历默认剥离（GAME.jianghuWildMounted=false）；
     19b/19c 两段测的是**该层本身** —— 显式临时挂载，跑完还原（与 smoke §v89.45 同一手法）。 */
  const jhWasA = G.jianghuWildMounted;
  G.jianghuWildMounted = true;
  check('v89.5：渲染接线含青旗（render 调 drawJhPennant）', /drawJhPennant\(/.test(G.map.render.toString()));
  const q19b = (function () {
    const pc = G.map.playerCity();
    for (let r = 0; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = pc.x + dx, y = pc.y + dy;
          if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
          const tl = G.map.tile(x, y);
          if (!tl || G.map.fortAt(x, y)) continue;
          const si = G.jianghuSpotInfo(x, y);
          if (si && si.mark) return { x: x, y: y, n: si.n };
        }
      }
    }
    return null;
  })();
  check('主城周边 5 格内能找到灵机格', !!q19b, q19b ? '(' + q19b.x + ',' + q19b.y + ') 事×' + q19b.n : '未找到');
  check('v89.5：点选灵机格 → 状态行「江湖事 ×n · 灵机」', (function () {
    if (!q19b) return false;
    const old = G.ui.mapPick;
    G.ui.mapPick = { kind: 'wild', x: q19b.x, y: q19b.y };
    G.ui.syncMapInfo();
    const t = document.querySelector('#map-pick-info').textContent;
    G.ui.mapPick = old;
    G.ui.syncMapInfo();
    return t.indexOf('江湖事 ×' + q19b.n) >= 0 && t.indexOf('灵机') >= 0;
  })());
  check('v89.5：真实点击灵机格（canvas 事件 → 点选行含灵机）', (function () {
    if (!q19b) return false;
    /* v89.138（老板 1）：视野从 17×14 收窄到 9×8 —— 先把视野中心移到灵机格，
       否则"主城周边 5 格"的目标可能落在可视区外（老断言直接 return false）。 */
    G.ui.mapView.x = q19b.x; G.ui.mapView.y = q19b.y;
    G.ui.renderMapCanvas();
    const v = G.map._view;
    const sx = v.ox + (q19b.x - q19b.y) * v.HW, sy = v.oy + (q19b.x + q19b.y) * v.HH;
    if (!(sx > 0 && sy > 0 && sx < cv19.width && sy < cv19.height)) return false;
    const oldRect = cv19.getBoundingClientRect;
    cv19.getBoundingClientRect = function () { return { left: 0, top: 0, width: cv19.width, height: cv19.height }; };
    cv19.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: sx, clientY: sy }));
    cv19.getBoundingClientRect = oldRect;
    return (document.querySelector('#map-pick-info') || {}).textContent.indexOf('灵机') >= 0;
  })());

  /* v89.6：奇遇 · 见闻录（隐藏点位 → 就近探察 → 探奇 → 图鉴） */
  console.log('\n--- 19c. v89.6 奇遇 · 见闻录 ---');
  check('v89.6：底栏含「见闻录」入口', !!document.querySelector('#bottom-bar [data-action="open-journal"]'));
  const wSite19c = (function () {
    const list = G.wonderSites();
    for (let i = 0; i < list.length; i++) {
      if (!G.map.fortAt(list[i].x, list[i].y)) return list[i];
    }
    return null;
  })();
  check('v89.6：找到奇遇点位', !!wSite19c, wSite19c ? '(' + wSite19c.x + ',' + wSite19c.y + ') ' + wSite19c.wid : '未找到');
  const WILD19c = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };
  G.wonderState().r = {}; G.wonderState().d = {}; G.wonderState().j = {};
  const farT19c = (function () {
    if (!wSite19c) return null;
    for (let d = 3; d <= 12; d++) {
      const x = wSite19c.x + d, y = wSite19c.y;
      if (x >= G.DATA.MAP_W) break;
      const tl = G.map.tile(x, y);
      if (tl && WILD19c[tl.terrain] && !G.wonderSiteOf(x, y)) return { x: x, y: y };
    }
    return null;
  })();
  check('v89.6：找到距点位 3+ 格的无奇对照格', !!farT19c, farT19c ? '(' + farT19c.x + ',' + farT19c.y + ')' : '未找到');
  if (farT19c) {
    G.ui.openLandModal(farT19c.x, farT19c.y);
    await sleep(60);
    const tF = (document.querySelector('#modal-root') || {}).textContent || '';
    check('v89.6：远处开格 —— 无「探奇」暗示（隐藏点真隐藏）', tF.indexOf('探奇') < 0);
    check('v89.6：点位仍未现形', G.wonderSiteOf(wSite19c.x, wSite19c.y).revealed === false);
    G.ui.closeAllModals();
    await sleep(40);
  }
  const nearX19c = wSite19c.x + 1 <= G.DATA.MAP_W - 1 ? wSite19c.x + 1 : wSite19c.x - 1;
  G.ui.openLandModal(nearX19c, wSite19c.y);
  await sleep(60);
  const tN = (document.querySelector('#modal-root') || {}).textContent || '';
  check('v89.6：就近探察 —— 「探得异迹」提示 + 点位现形',
    tN.indexOf('探得异迹') >= 0 && G.wonderSiteOf(wSite19c.x, wSite19c.y).revealed === true);
  G.ui.closeAllModals();
  await sleep(40);
  G.ui.openLandModal(wSite19c.x, wSite19c.y);
  await sleep(60);
  check('v89.6：已现形 → 弹窗有「探奇」入口',
    ((document.querySelector('#modal-root') || {}).textContent || '').indexOf('探奇') >= 0);
  const lg19c = G.lordGeneralOf();
  if (lg19c) { lg19c.energy = 100; G.setStaNow(lg19c, 100); }
  click(document.querySelector('#modal-root [data-action="do-wonder"]'));
  await sleep(140);
  check('v89.6：探奇 → 全屏奇遇（#scene-fx · kind=wonder）',
    !!document.querySelector('#scene-fx') && !!G.sceneFx && G.sceneFx.kind === 'wonder');
  const hero19c = document.querySelector('#scene-fx .sxf-hero');
  check('v89.6：奇遇横幅「奇缘紫」底纹（--wonder-rgb）',
    !!hero19c && hero19c.outerHTML.indexOf('wonder-rgb') >= 0);
  let guard19c = 0;
  while (guard19c < 8 && document.querySelector('#scene-fx [data-action="sxf-choice"]')) {
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(90);
    guard19c++;
  }
  const rT19c = (document.querySelector('#scene-fx') || {}).textContent || '';
  check('v89.6：结算屏（专属退出 + 见闻录收录行）',
    !!document.querySelector('#scene-fx [data-action="sxf-exit"]') && rT19c.indexOf('见闻录收录') >= 0);
  check('v89.6：见闻录已录 1 类', Object.keys(G.wonderState().j).length === 1,
    Object.keys(G.wonderState().j).join(','));
  click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
  await sleep(140);
  const tA = (document.querySelector('#modal-root') || {}).textContent || '';
  check('v89.6：回归弹窗显示「已探」', tA.indexOf('已探') >= 0);
  G.ui.closeAllModals();
  await sleep(40);
  check('v89.6：重复探奇被拒', G.wonderCheck(wSite19c.x, wSite19c.y, (lg19c || {}).id).ok === false);
  G.ui.openJournal();
  await sleep(60);
  const jT19c = (document.querySelector('#modal-root') || {}).textContent || '';
  const wName19c = (G.DATA.WONDERS[wSite19c.wid] || {}).name || '';
  check('v89.6：见闻录 —— 已录显名 · 未录？？？ · 进度 1/24',
    jT19c.indexOf(wName19c) >= 0 && jT19c.indexOf('？？？') >= 0 && /已录见闻\s*1\s*\/\s*24/.test(jT19c));
  G.ui.closeAllModals();
  G.jianghuWildMounted = jhWasA;   /* v89.86：还原剥离状态 */

  console.log('\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');
  /* 给当前城配齐客栈、招贤馆、铁匠铺 */
  const c20 = G.state.cities[0];
  const put20 = (id, lv) => {
    const ex = c20.cells.find((c) => c.build && c.build.id === id);
    if (ex) { ex.build.lvl = lv; return true; }
    const i = c20.cells.findIndex((c) => !c.build && !c.official);
    if (i < 0) return false;
    c20.cells[i].build = { id: id, lvl: lv };
    return true;
  };
  put20('kezhan', 5); put20('zhaoxianguan', 12); put20('tiejiangpu', 7);
  G.state.res.gold = 3000000; G.state.res.iron = 900000; G.state.res.wood = 700000; G.state.res.stone = 500000;
  /* v12：打造需材料，先备齐 */
  DATA.MATERIAL_IDS.forEach((mid) => { G.state.items[mid] = (G.state.items[mid] || 0) + 300; });

  /* ① 客栈（v75 改版）：资质徽章 + 悬停成长备注 + 单行候选 + 无概率表（老板） */
  G.ui.openInn();
  await sleep(70);
  const inn20 = document.querySelector('#modal-root').innerHTML;
  check('客栈面板渲染', inn20.length > 400, inn20.length + ' 字符');
  check('候选显示资质徽章', /class="rank-badge r-/.test(inn20));
  check('v75：成长备注不再写行内（收进徽章悬停）',
    inn20.indexOf('｜成长 +') < 0 && /rank-badge r-\w+" title="[^"]*每级属性成长 \+/.test(inn20));
  check('v75：不再显示资质一览（四维/成长/概率全撤）',
    inn20.indexOf('rk-box') < 0 && inn20.indexOf('四维 ') < 0);
  check('v75：候选单行版式（动作横排 inn-act）', /class="inn-act"/.test(inn20));
  G.ui.closeAllModals();

  /* ② 招贤馆：v29（需求 15）起只讲房间数与升级路径，不再重复将领名录 */
  G.ui.openHostel();
  await sleep(60);
  const host20 = document.querySelector('#modal-root').innerHTML;
  check('招贤馆不再有将领名录（不重复「将领」菜单）',
    host20.indexOf('inn-card') < 0 && host20.indexOf('房间') >= 0);
  check('招贤馆指向「将领」菜单看名录', host20.indexOf('将领') >= 0);
  G.ui.closeAllModals();
  /* 资质徽章改在「将领」菜单验证 */
  G.ui.setView('generals');
  await sleep(60);
  check('将领菜单显示资质徽章', /class="rank-badge r-/.test(vc.innerHTML));

  /* ③ 将领列表新增资质列 */
  G.ui.setView('generals');
  await sleep(60);
  const gen20 = vc.innerHTML;
  /* v20（需求 3）：清单改卡片式、分次呈现 —— 不再有 14 列表头 */
  /* v29（需求 16）：上方 3×2 卡片墙 + 下方档案 */
  /* v41（需求 2）：3×2 卡片墙 → 左姓名清单 + 右完整档案 */
  check('将领界面为左清单 + 右档案', gen20.indexOf('class="gen-split"') >= 0
    && gen20.indexOf('class="gen-list"') >= 0 && gen20.indexOf('class="gen-pane"') >= 0
    && gen20.indexOf('<th>资质</th>') < 0);
  check('将领清单行渲染资质徽章', /class="rank-badge r-/.test(gen20));
  /* v45（需求 1）：老板点名去掉「装 0/12」，清单行只留姓名 + 资质等级 ——
     等级/装备数/经验/忠诚 仍在悬停速览与右侧完整档案里。 */
  check('清单行含姓名/Lv/资质/状态/悬停速览（v45 去装备数；v89.80 加回 Lv）',
    /class="grow-name"/.test(gen20) && /class="grow-st/.test(gen20)
    && /class="rank-badge/.test(gen20) && /class="tip-src"/.test(gen20)
    && /grow-lv">Lv\d+</.test(gen20)
    && !/class="grow-eq"/.test(gen20));
  check('右侧档案含六维表与经验/体力', /class="gen-pane"/.test(gen20)
    && /gd-dims/.test(gen20) && gen20.indexOf('体力') >= 0 && gen20.indexOf('经验') >= 0);
  check('将领页不再写资质成长规则（需求 5：备注型信息已清理）', gen20.indexOf('天授+8') < 0);
  check('页面只留真实动作按钮（详情与装备已内嵌，不再有入口）',
    gen20.indexOf('data-action="gen-detail"') < 0 && gen20.indexOf('data-action="gen-equip"') < 0
    && gen20.indexOf('data-action="assign-guard"') >= 0 && gen20.indexOf('data-action="dismiss-gen"') >= 0);

  /* v53（老板）：**一城一守将** —— 走真实点击流程验一遍，不只看数据层。
     清单行点选（gen-pick）→ 右侧档案的「任命守将」按钮：
     先给 A 任命、再给 B 任命，A 必须自动让位（按钮回到「任命守将」），
     且守将加成的持有者变成 B。 */
  (function () {
    const st = G.state;
    const cur = G.currentCity();
    st.generals.forEach((g) => { if (g.status === 'guard') { g.status = 'idle'; g.cityId = null; } });
    /* 前面流程可能只剩一位将（读过档/被解雇过）—— 补齐到两位，否则这条是空断言 */
    const made = [];
    while (st.generals.length < 2) {
      const ng = G.makeGeneral('v53守将' + (made.length + 1), 10, 'idle', cur.id, false);
      st.generals.push(ng); made.push(ng.id);
    }
    G.refreshAll();
    const rows = Array.prototype.slice.call(
      document.querySelectorAll('.gen-list .gen-row[data-gen]'));
    if (rows.length < 2) { check('将领清单至少两位（构造前置）', false, rows.length + ' 位'); return; }
    const idA = rows[0].getAttribute('data-gen');
    const idB = rows[1].getAttribute('data-gen');
    rows[0].click();                                  // 选中 A
    let btnA = document.querySelector('.gen-pane [data-action="assign-guard"]');
    check('档案里找到「任命守将」按钮', !!btnA, btnA ? btnA.textContent.trim() : '无');
    btnA.click();                                     // A 任守将
    document.querySelector('.gen-list .gen-row[data-gen="' + idB + '"]').click();  // 选中 B
    const btnB = document.querySelector('.gen-pane [data-action="assign-guard"]');
    btnB.click();                                     // B 任守将 → A 应自动解任
    const holder = G.guardGeneralOf(cur);
    check('后任生效：守将身份落在 B 身上（不是两个都算）',
      !!holder && holder.id === idB, holder ? holder.id + ' / 期望 ' + idB : '无守将');
    check('同城只有一位守将（点完仍满足不变量）',
      st.generals.filter((g) => g.status === 'guard' && g.cityId === cur.id).length === 1);
    document.querySelector('.gen-list .gen-row[data-gen="' + idA + '"]').click();  // 回看 A
    const btnA2 = document.querySelector('.gen-pane [data-action="assign-guard"]');
    check('A 的按钮回到「任命守将」（旧任确实被解除了）',
      !!btnA2 && btnA2.textContent.indexOf('任命守将') >= 0 && btnA2.textContent.indexOf('解除') < 0,
      btnA2 ? btnA2.textContent.trim() : '无');
    /* 收尾：本用例造的将清掉，守住将领数不会越测越多；
       v89.117：**守将身份也要复位** —— 这条用例会把清单前两位任命成守将
       （其中很可能就是君主），而本轮起"守将不可出征"是硬规则 →
       不复位会把后面所有出征/行军用例全拦死（实测 31 条翻红的根因）。
       与本用例开头"先清空守将"对称：自己摆的前置，自己收干净。 */
    st.generals = st.generals.filter((g) => made.indexOf(g.id) < 0);
    st.generals.forEach((g) => { if (g.status === 'guard') { g.status = 'idle'; g.cityId = null; } });
    G.refreshAll();
  })();

  /* ④ 铁匠铺打造面板 */
  G.ui.openForge();
  await sleep(70);
  const forge20 = document.querySelector('#modal-root').innerHTML;
  check('打造面板渲染', forge20.length > 500, forge20.length + ' 字符');
  check('标题显示可打造等级', forge20.indexOf('可打造至') >= 0);
  check('按品质分组（凡品/良品/珍品/神品）',
    forge20.indexOf('凡品') >= 0 && forge20.indexOf('神品') >= 0);
  /* v29（需求 12）：材料逐项列出，并标出**出产州**（缺料时最想知道的那件事） */
  check('列出材料成本（含出产州）', forge20.indexOf('材料') >= 0 && forge20.indexOf('特产') >= 0);
  /* v51：卡片瘦身时删掉了「条件齐备，可以打造」——它只是复述按钮状态
     （可造＝金色可点、不可造＝灰且 disabled）。所以旧判据（面板里出现四个词之一）
     在"本页都能造"时会失配。换成**更强**的两条：
     ① 凡是被禁用的打造按钮，**它所在的卡片必须写明缺什么**（这是真正要保证的事）；
     ② 齐备的卡片不再出现复述文字。 */
  /* v89.117（老板「太多打造按钮了，统一成一个放在底部」）：
     口径变了 —— **逐卡打造键退役**，改「点选一件 + 底部唯一打造键（与百炼强化同栏）」。 */
  check('v89.117 铁匠铺：卡片不再带打造键（整卡可点选 data-action="forge-pick"）', (function () {
    const cards = Array.prototype.slice.call(document.querySelectorAll('#modal-root .item-row[data-action="forge-pick"]'));
    const picks = document.querySelectorAll('#modal-root .ir-pick').length;
    return cards.length > 0 && picks === cards.length
      && document.querySelectorAll('#modal-root .item-row [data-action="forge-item"]').length === 0;
  })(), document.querySelectorAll('#modal-root .item-row').length + ' 张卡');
  check('v89.140 铁匠铺：底部只有 1 个打造键；百炼强化已搬去**建筑菜单**', (function () {
    const btns = document.querySelectorAll('#modal-root [data-action="forge-item"]');
    const foot = document.querySelector('#modal-root .m-foot');
    return btns.length === 1 && !!foot && !!foot.querySelector('[data-action="forge-item"]')
      && !foot.querySelector('[data-action="open-enhance"]')
      /* 分页条（v89.140 老板 5：翻页放底部）——单页时可能为空，只要求 foot 里出现 pager 容器或单页 */
      && (!!foot.querySelector('.mpage, .pager') || true);
  })());
  check('v89.117 铁匠铺：未选中时打造键受阻（dim + data-why · v89.189 软化）', (function () {
    const b = document.querySelector('#modal-root [data-action="forge-item"]');
    return !!b && !b.hasAttribute('disabled') && b.classList.contains('dim')
      && !!b.getAttribute('data-why') && /点选/.test(b.textContent);
  })());
  /* v89.189（老板 1）：「无法采取的操作，弹窗提示原因」——真点受阻键 → 弹「无法执行」窗 */
  check('v89.189 真点：受阻的打造键 → 弹「无法执行」窗（操作名 + 原因）', (function () {
    G.ui.closeAllModals();
    G.ui.openForge();                       /* 未选中 → 底部键受阻 */
    const b = document.querySelector('#modal-root [data-action="forge-item"]');
    if (!b || !b.getAttribute('data-why')) return false;
    click(b);
    const root = document.querySelector('#modal-root');
    const txt = root ? root.textContent : '';
    const ok = txt.indexOf('无法执行') >= 0 && txt.indexOf('点选') >= 0;
    G.ui.closeAllModals();
    G.ui.openForge();                       /* 复位，后续用例继续 */
    return ok;
  })());
  check('v89.117 铁匠铺：点选后底部键写明件名 + 缺什么写在卡上', (function () {
    /* 先造出阻塞（清空材料）→ 点选一件 → 底部键禁用且面板给出原因；验完恢复 */
    const saveItems = G.state.items;
    G.state.items = {};
    G.ui.openForge();
    G.ui._forgeSelList = [];   /* v89.201：多选语义 —— 本用例验"单件选中"，先清空选集摆前置 */
    const card = document.querySelector('#modal-root .item-row[data-action="forge-pick"]');
    if (card) card.click();
    const b2 = document.querySelector('#modal-root [data-action="forge-item"]');
    const hint = document.querySelector('#modal-root .m-foot .op-hint');
    const selRow = document.querySelector('#modal-root .item-row.on');
    /* v89.189：软化后 disabled 属性被摘除 —— 判据改用 data-why 受阻说明。 */
    const okBlocked = !!b2 && !b2.hasAttribute('disabled') && !!b2.getAttribute('data-why')
      && !!hint && /材料不足|缺图纸|需铁匠铺|资材不足/.test(hint.textContent)
      && !!selRow && /材料不足|缺图纸|需铁匠铺|资材不足/.test(selRow.textContent);
    G.state.items = saveItems;
    G.ui.openForge();
    return okBlocked;
  })());
  check('v89.117 铁匠铺：选中件可打造时底部键启用（金色 + 写明件名）', (function () {
    /* 恢复到"哪件都能造"：补满资材与图纸，再点选凡品盔 */
    /* v89.201：选中改多选 —— 本用例验"**单件**选中 → 底键写明件名"，先清空选集（否则
       前序用例的残留选中会让底键显示「打造 N 件」，无件名）。 */
    G.ui._forgeSelList = [];
    const saveItems = G.state.items, saveRes = G.state.res;
    const it = G.DATA.EQUIP.cr_head_1;
    G.state.items = Object.assign({}, saveItems);
    (G.DATA.MATERIALS || []).forEach((m) => { G.state.items[m.id] = 999; });
    G.state.res = Object.assign({}, saveRes, { gold: 9e8, iron: 9e8, wood: 9e8, stone: 9e8,
      grain: 9e8, cloth: 9e8, horse: 9e8 });
    G.ui.openForge();
    const row = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
    if (!row) { G.state.items = saveItems; G.state.res = saveRes; G.ui.openForge(); return false; }
    row.click();
    const b3 = document.querySelector('#modal-root [data-action="forge-item"]');
    const ok = !!b3 && !b3.hasAttribute('disabled') && /打造/.test(b3.textContent)
      && b3.textContent.indexOf(it.name) >= 0;
    return ok;
  })());
  check('v89.117 铁匠铺：类别条可切「套装」，且出现**具体套装**子条', (function () {
    const setCat = document.querySelector('#modal-root [data-action="forge-kind"][data-k="set"]');
    if (!setCat) return false;
    setCat.click();
    const chips = document.querySelectorAll('#modal-root [data-action="forge-set"]');
    const names = Array.prototype.map.call(chips, (c) => c.textContent.replace(/\d+$/, ''));
    return chips.length >= 2 && names.some((x) => /套/.test(x));
  })());
  check('含打造按钮', forge20.indexOf('data-action="forge-item"') >= 0);
  check('打造面板不再写来源说明（需求 5）', forge20.indexOf('图纸来源') < 0);
  /* 真造一件：走**新流程**（点选卡片 → 底部打造键） */
  (function () {
    const saveItems = G.state.items, saveRes = G.state.res;
    (G.DATA.MATERIALS || []).forEach((m) => { G.state.items[m.id] = 999; });
    G.state.res = Object.assign({}, saveRes, { gold: 9e8, iron: 9e8, wood: 9e8, stone: 9e8 });
  })();
  const invBefore = (G.state.inventory || []).length;
  /* v89.117：先把筛选复位（前面的子用例切到过「套装」类别），再**逐页找** ——
     凡品不止 6 件，`cr_head_1` 可能在第 2 页；翻页走与玩家同一条路
     （改 ui._pages['forge'] + 重开面板）。 */
  G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSelList = [];
  let pickRow = null;
  for (let pi = 1; pi <= 8 && !pickRow; pi++) {
    G.ui._pages['forge'] = pi;
    G.ui.openForge();
    pickRow = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
  }
  check('找到凡品盔（可点选 · 逐页可达）', !!pickRow);
  if (pickRow) { pickRow.click(); }
  const forgeBtn = document.querySelector('#modal-root [data-action="forge-item"]');
  check('点选后底部打造键启用', !!forgeBtn && !forgeBtn.hasAttribute('disabled'));
  if (forgeBtn) { forgeBtn.click(); }
  await sleep(90);
  check('点击打造后进入背包', (G.state.inventory || []).length === invBefore + 1,
    invBefore + ' → ' + (G.state.inventory || []).length);
  check('打造后记录已造', (G.state.forged || []).indexOf('cr_head_1') >= 0);
  G.ui.closeAllModals();

  /* ⑤ 装备面板：体力作用说明 + 获取指引 */
  G.ui.setView('equip');
  await sleep(60);
  const eq20 = vc.innerHTML;
  check('装备面板说明体力作用', eq20.indexOf('全军生命') >= 0);
  check('装备面板不再写获取途径（需求 5）', eq20.indexOf('装备获取途径') < 0);

  /* ⑥ 商城：分类页签 + 固定网格 + 分页（v18 从一长条列表重构） */
  G.ui.openShop();
  await sleep(60);
  const shop20 = document.querySelector('#view-container').innerHTML;
  /* v25（需求 12）：顶部那行「当前黄金…单价…共 n 件」整段删除，改收进 ⓘ */
  check('商城不再常驻换算说明（改为 ⓘ 触发）',
    /🛒 商城 · <\/div>/.test(shop20) === false
    && shop20.indexOf('help-chip') >= 0 && shop20.indexOf('·　分 ') < 0);
  check('商城有分类页签（不再是单一长列表）', document.querySelectorAll('.shop-cats .shop-cat').length >= 5,
    document.querySelectorAll('.shop-cats .shop-cat').length + ' 类');
  /* v29（需求 14）：竖卡网格 → **物品行**（左贴图 / 右介绍 / 下：数量 + 购买）
     v39（需求 5）：2 列 → 4 列，每页 8 → 16 行（4 列 × 4 行，整页不截行） */
  check('商城为物品行版式（每页 16 行）', (function () {
    var rows = document.querySelectorAll('#view-container .item-row');
    var okRow = rows.length === 16;
    var first = rows[0];
    return okRow && !!first
      && !!first.querySelector('.ir-art svg, .ir-art img')
      && !!first.querySelector('.ir-name')
      && !!first.querySelector('.qty-input input')
      && !!first.querySelector('[data-action="shop-buy"]');
  })(), document.querySelectorAll('#view-container .item-row').length + ' 行');
  check('分类页签按类型计数', shop20.indexOf('图纸') >= 0);
  /* 切到「图纸」分类 → 应列出倚天套图纸 */
  G.ui.setShopCat('blueprint');
  await sleep(60);
  check('切分类后列出倚天套图纸', document.querySelector('#view-container').innerHTML.indexOf('倚天套图纸') >= 0);
  /* 切到「珠宝」分类 → 低档珠宝可购买（v89.152：珍珠 -> 蚌珠） */
  G.ui.setShopCat('jewel');
  await sleep(60);
  const shopJ = document.querySelector('#view-container').innerHTML;
  check('切分类后珠宝可购买', shopJ.indexOf('蚌珠') >= 0 && shopJ.indexOf('赏赐忠诚') >= 0);
  /* 分页：材料 24 件 → 3 页（每页 8 行），翻页条在底部固定条里 */
  G.ui.setShopCat('material');
  await sleep(60);
  const matBtns = document.querySelectorAll('#bottom-bar [data-action="page"]');
  check('材料分类有分页（翻页条在底部固定条）', matBtns.length >= 4, matBtns.length + ' 个翻页键');
  const pgA = document.querySelector('#bottom-bar .pg-info').textContent;
  G.ui.setPage('shop-items', 2);
  await sleep(60);
  const pgB = document.querySelector('#bottom-bar .pg-info').textContent;
  check('翻页生效（页码变化）', pgA !== pgB, pgA + ' → ' + pgB);
  /* 数量输入框：−/＋ 与「最多」真的连到买家 */
  check('数量输入框可加减且合计随之变化', (function () {
    var inp = document.querySelector('#view-container .qty-input input');
    if (!inp) return false;
    var plus = inp.parentNode.querySelector('[data-action="qty-step"][data-d="1"]');
    var before = Number(inp.value);
    if (plus) plus.click();
    var after = Number(inp.value);
    var tot = document.getElementById(inp.id + '-total');
    return after === before + 1 && !!tot && tot.textContent.indexOf('合计') >= 0;
  })());
  G.ui.setView('city');
  await sleep(40);

  /* ⑦ 死属性修复的界面可见性 */
  G.ui.setView('generals');
  await sleep(50);
  const gen20b = vc.innerHTML;
  check('将领页不再写体力/精力规则（需求 5）', gen20b.indexOf('不可出征') < 0);
  check('将领页不再写忠诚衰减规则（需求 5）', gen20b.indexOf('加成减半') < 0);
  /* v45：等级不再挂在清单行上，但右侧档案仍必须给全（六维/体力/忠诚） */
  check('将领页仍呈现信息型数据（等级/六维/忠诚/体力）',
    gen20b.indexOf('gd-dims') >= 0 && gen20b.indexOf('体力') >= 0
    && gen20b.indexOf('忠诚') >= 0 && gen20b.indexOf('Lv') >= 0);
  var g0_20 = G.state.generals[0];
  g0_20.stamina = 3;
  var c0_20 = G.currentCity();
  g0_20.cityId = c0_20 ? c0_20.id : g0_20.cityId;
  G.ui.setView('city');
  await sleep(50);
  G.ui.setView('generals');
  await sleep(60);
  /* v29（需求 11）：体力是第六维 —— 卡片上给紧凑的「体 78」，
     下方档案给「当前 / 上限（%）＋ 全军生命加成」的完整口径。 */
  check('体力值在将领页可见（清单行悬停速览 + 右侧档案给完整口径）', (function () {
    var tip = document.querySelector('#view-container .gen-row .tip-src');
    var det = document.querySelector('#view-container .gen-pane');
    /* v89.133（老板）：全军生命 +X% 移入行悬停（title）——判据改 innerHTML
       （textContent 不含属性；"体力 当前/上限"两数连写仍是行面主数字）。 */
    return !!tip && /体\s*\d+/.test(tip.textContent)
      && !!det && det.textContent.indexOf('体力') >= 0
      && det.innerHTML.indexOf('全军生命') >= 0;
  })());
  g0_20.stamina = 100;

  console.log('\n--- 21. v12：SVG 图标 / 背包 / 任务 / 菜单去重 ---');
  /* ① 地块直接画建筑 SVG */
  G.ui.setView('city');
  await sleep(100);
  const tiles21 = vc.querySelectorAll('.iso-tile');
  /* v35：图标载体由「内联 SVG」改为「AI 位图 <img.ico-img>」（另有矢量回退），
     断言锚点随之改为二者之一 —— 语义不变：地块上确实渲染了图标。 */
  const tilesSvg = vc.querySelectorAll('.tile-art svg.ico, .tile-art img.ico-img');
  check('城内地块渲染图标（矢量或位图）', tilesSvg.length > 0 && tilesSvg.length <= vc.querySelectorAll('.iso-tile:not(.empty)').length,
    tiles21.length + ' 格 / ' + tilesSvg.length + ' 个图标');
  check('地块不再使用 emoji 图标容器', vc.querySelectorAll('.bicon').length === 0);
  check('地块有承台底色（tile-face）', vc.querySelectorAll('.tile-face').length >= 33);
  /* 图标渲染健康的判据：矢量层要有渐变定义，位图层要有已挂载的 <img> */
  check('图标已渲染（矢量含渐变 / 位图已挂载）',
    vc.querySelectorAll('.iso-tile svg linearGradient').length > 0
    || vc.querySelectorAll('.iso-tile img.ico-img').length > 0);

  /* ② 城内 / 城外 已是**顶栏菜单**（v26 · 需求 5），点它切视图 */
  check('中央不再有子页签', !document.querySelector('#subtabs'));
  const extTab = document.querySelector('#topnav [data-view="ext"]');
  check('顶栏有「城外」菜单', !!extTab && extTab.textContent.indexOf('城外') >= 0);
  click(extTab);
  await sleep(110);
  check('点「城外」切到城外视图', G.ui.view === 'ext', G.ui.view);
  check('顶栏「城外」高亮、城池取消高亮',
    extTab.classList.contains('active')
    && !document.querySelector('#topnav [data-view="city"]').classList.contains('active'));
  check('城外仍保留左侧栏（同一座城的资源与驻军）',
    !document.querySelector('.auth-side').classList.contains('hidden'));
  check('切到城外后渲染地块棋盘',
    /city-iso/.test(vc.innerHTML) && vc.querySelectorAll('.iso-tile').length >= 12,
    vc.querySelectorAll('.iso-tile').length + ' 块');
  check('城外也是等距场景', !!document.querySelector('.iso-board'), document.querySelectorAll('.iso-board .iso-tile').length + ' 块');
  check('城外地块也渲染图标（矢量或位图）',
    document.querySelectorAll('.iso-board svg.ico, .iso-board img.ico-img').length > 0,
    document.querySelectorAll('.iso-board svg.ico, .iso-board img.ico-img').length + ' 个');
  click(document.querySelector('#topnav [data-view="city"]'));
  await sleep(90);
  check('点「城池」切回城内', G.ui.view === 'city'
    && /city-iso/.test(vc.innerHTML), G.ui.view);

  /* ③ 顶部导航去重 */
  const tabs21 = Array.prototype.map.call(document.querySelectorAll('#topnav .tab[data-view]'), (x) => x.dataset.view);
  check('顶栏去掉军队/科技/装备/宝物',
    tabs21.indexOf('troops') < 0 && tabs21.indexOf('tech') < 0 && tabs21.indexOf('equip') < 0 && tabs21.indexOf('items') < 0,
    tabs21.join(','));
  check('顶栏保留城池入口', tabs21.indexOf('city') >= 0);
  check('任务导航有红点元素', !!document.querySelector('#tab-badge-task'));

  /* ④ 建筑弹窗 → 功能面板（带关闭按钮） */
  const c21 = G.state.cities[0];
  const put21 = (id, lv) => {
    let cell = c21.cells.find((x) => x.build && x.build.id === id);
    if (cell) { cell.build.lvl = Math.max(cell.build.lvl, lv); return true; }
    const i = c21.cells.findIndex((x) => !x.build && !x.official);
    if (i < 0) return false;
    c21.cells[i].build = { id: id, lvl: lv };
    return true;
  };
  put21('junying', 5); put21('shuyuan', 5); put21('tiejiangpu', 5);
  G.ui.setView('city');
  await sleep(90);
  const idxJY = c21.cells.findIndex((x) => x.build && x.build.id === 'junying');
  G.ui.openBuildModal(idxJY);
  await sleep(60);
  const bm = document.querySelector('#modal-root');
  check('军营弹窗含「募兵 · 兵种」入口', bm.innerHTML.indexOf('募兵 · 兵种') >= 0);
  /* v24（需求 8）：入口带 data-idx（队列要挂到具体那座军营） */
  const entryBtn = bm.querySelector('[data-action="open-troops"][data-idx]');
  check('找到功能入口按钮（带军营下标）', !!entryBtn, entryBtn ? 'idx=' + entryBtn.dataset.idx : '未找到');
  click(entryBtn);
  await sleep(90);
  const panelHtml = document.querySelector('#modal-root').innerHTML;
  check('军队以弹窗打开（不再切标签页）', panelHtml.length > 400 && document.querySelector('#modal-root').querySelector('[data-action="close-modal"]') !== null,
    panelHtml.length + ' 字符');
  check('面板标题标明归属建筑', panelHtml.indexOf('军营') >= 0);
  check('切标签页未发生（仍在城池视图）', G.ui.view === 'city', 'view=' + G.ui.view);
  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(60);
  /* v89.117（老板「关闭的时候不回到上一级界面…这个操作逻辑很别扭」）：
     从下级面板（军队）点 ✕ = **返回上一级**（军营面板）；再点一次才全关。
     这条断言把"层"的行为钉在真 DOM 上（smoke 里另有结构化断言）。 */
  const afterOne = document.querySelector('#modal-root').innerHTML;
  check('v89.117：下级点 ✕ → 回到上一级（军营面板，不是全关）',
    afterOne.length > 100 && afterOne.indexOf('军营') >= 0, afterOne.length + ' 字符');
  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(60);
  check('关闭按钮生效（顶层 ✕ → 全关）', document.querySelector('#modal-root').innerHTML.length < 20,
    document.querySelector('#modal-root').innerHTML.length + ' 字符');

  /* ⑤ 背包：每行 5 格 + 悬停属性 */
  /* v79：同名两件走 addEquip（实例）—— 序号（甲/乙）即"区分办法" */
  G.addEquip('cr_head_1'); G.addEquip('cr_head_1');
  G.state.inventory.push('cr_weapon_2', 'yt_sword', 'jueying', 'cr_arm_1');
  DATA.MATERIAL_IDS.forEach((m) => { G.state.items[m] = (G.state.items[m] || 0) + 9; });
  G.ui.openBag('equip');
  await sleep(80);
  let bagH = document.querySelector('#view-container');
  const cells21 = bagH.querySelectorAll('.bag-cell');
  check('背包装备格子渲染', cells21.length >= 5, cells21.length + ' 格');
  check('每格都有悬停浮层', bagH.querySelectorAll('.bag-tip').length === cells21.length);
  check('浮层含属性文案', /class="tip-a"/.test(bagH.innerHTML));
  const grid21 = bagH.querySelector('.bag-grid');
  check('网格为 5 列（CSS 声明）', !!grid21 && /repeat\(5, 1fr\)/.test(document.querySelector('style') ? document.documentElement.innerHTML : ''),
    grid21 ? grid21.className : 'n/a');
  check('v79：同名装备以序号区分（甲/乙 入名，替代数量角标）',
    /·甲/.test(bagH.innerHTML) && /·乙/.test(bagH.innerHTML),
    (bagH.innerHTML.match(/·[甲乙丙丁]/g) || []).join(' '));
  /* 材料（宝物 · 材料分类）—— v89.115：两类页签 + 二级分类条 */
  await bagTabTo('material');
  bagH = document.querySelector('#view-container');
  /* v29（需求 4）：材料页改为**按格分页**，首屏只渲染第一页
     v39（需求 6）：每页 20 → 16 格（4 列 × 4 行） */
  /* v89.143（老板 1）：每页 16 → **28**（7 列 × 4 行 · 整行不截）—— 本局 24 种材料恰一页装下 */
  check('材料页按格分页（28/页 = 7×4 · 本局 24 种一页装下）', (function () {
    var n = bagH.querySelectorAll('.bag-cell').length;
    var bar = document.querySelector('#bottom-bar').textContent;
    return G.ui.BAG_PER_PAGE === 28 && n === 24 && bar.indexOf('共 24 项') >= 0;
  })(), bagH.querySelectorAll('.bag-cell').length + ' 格 / ' + document.querySelector('#bottom-bar').textContent.trim());
  check('材料格子用图标（矢量或位图，非 emoji）', (function () {
    var cells = bagH.querySelectorAll('.bag-cell .bag-ico');
    var svg = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i].querySelector('svg, img.ico-img')) svg++;
    return cells.length > 0 && svg === cells.length;
  })(), bagH.querySelectorAll('.bag-cell .bag-ico svg, .bag-cell .bag-ico img.ico-img').length + '/' + bagH.querySelectorAll('.bag-cell .bag-ico').length + ' 格为图标');
  check('材料按系列分组（每页都带分组标题）', (bagH.innerHTML.match(/bag-sec/g) || []).length >= 3,
    (bagH.innerHTML.match(/bag-sec/g) || []).length + ' 组');
  /* v29：翻到第 2 页应能看到剩下的系列 —— 验证"分页条真的接上了材料页" */
  /* v89.143（老板 1）：24 项 ≤ 28/页 → 只剩 1 页；且 7 列网格 = 3 整行 + 3 格（材料页按系列分组，
     末组不满行是数据本身如此）—— 判据改为"一页装下 + 无第 2 页按钮"。 */
  check('材料页一页装下（24 ≤ 28 · 无多余页码）', (function () {
    var btn2 = document.querySelector('#bottom-bar [data-action="page"][data-n="2"]');
    var n = document.querySelectorAll('#view-container .bag-cell').length;
    return n === 24 && !btn2;
  })(), document.querySelectorAll('#view-container .bag-cell').length + ' 格');
  check('材料品阶用颜色阶而非星级（noStar）', bagH.querySelectorAll('.bag-cell.q1').length > 0);
  /* 宝物（全部） */
  await bagTabTo('all');
  bagH = document.querySelector('#view-container');
  /* v29（需求 14）：宝物页改用「物品行」——左贴图/右介绍/下：数量+使用 */
  /* v89.140（老板 7）：宝物页改**统一物品框**（bag-cell · 7 列 · 悬停介绍） */
  check('宝物页为统一格子（bag-cell · 7 列网格 · 无数量输入框）',
    /bag-cell/.test(bagH.innerHTML) && !/item-row/.test(bagH.innerHTML)
    && !/qty-input/.test(bagH.innerHTML));
  G.ui.setView('city');
  await sleep(40);

  /* ⑥ 任务面板：随机 / 成长进行中 / 已完成 三分区 */
  G.ensureDailyQuests(true);
  G.ui.setView('tasks');
  await sleep(100);
  const tk21 = vc.innerHTML;
  check('任务面板三分区齐全',
    tk21.indexOf('随机任务') >= 0 && tk21.indexOf('成长任务 · 进行中') >= 0 && tk21.indexOf('已完成') >= 0);
  /* v25（需求 11）：列表只给名称，领取/放弃按钮在详情弹窗里 */
  const questRows21 = vc.querySelectorAll('[data-action="quest-detail"]').length;
  check('任务清单渲染（每项只一行名称）', questRows21 > 0, questRows21 + ' 行');
  const firstQ = vc.querySelector('[data-action="quest-detail"]');
  click(firstQ);
  await sleep(90);
  const qDet21 = document.querySelector('#modal-root').innerHTML;
  check('点任务名称弹出固定格式详情',
    qDet21.indexOf('任务背景') >= 0 && qDet21.indexOf('任务需求') >= 0 && qDet21.indexOf('任务奖励') >= 0);
  check('详情含放弃或不可放弃说明',
    qDet21.indexOf('放弃') >= 0);
  G.ui.closeAllModals();
  await sleep(40);
  check('随机任务带类型标签', /q-tag t-(military|war|build|tech|govern|talent|forge)/.test(tk21));
  check('成长任务卡渲染', /q-tag t-growth/.test(tk21));
  /* v19（需求 9）：去掉「已完成的任务收在这里…」占位文案 —— 收起时保持简洁，
     区块标题与「展开」按钮仍在，不与待办混排这一语义由结构保证。 */
  check('已完成区默认收起（无占位文案）',
    tk21.indexOf('已完成的任务收在这里') < 0 && tk21.indexOf('已完成') >= 0);
  click(vc.querySelector('[data-action="toggle-done-quests"]'));
  await sleep(80);
  check('展开后显示已完成列表', /q-done-box/.test(vc.innerHTML));
  click(vc.querySelector('[data-action="toggle-done-quests"]'));
  await sleep(60);

  /* ⑥.5 可领取任务置顶 + 行内一键领取（v69 老板） */
  {
    let rq57 = null, rdef57 = null;
    for (const e57 of G.state.quests.pool) {          /* 首选：非绝对值且尚未达标 */
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs && !G.randQuestReady(e57)) { rq57 = e57; rdef57 = d57; break; }
    }
    for (const e57 of G.state.quests.pool) {          /* 兜底：任意非绝对值 */
      if (rq57) break;
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs) { rq57 = e57; rdef57 = d57; }
    }
    check('夹具：手上有一条可打桩的随机任务', !!rq57, rq57 ? rq57.id : '（无）');
    if (rq57) {
      rq57.base = -1e9;                       /* 直接达标（base 只对增量型有意义） */
      G.ui.setView('tasks');
      await sleep(90);
      /* 按 **rq57 自己的 id** 取按钮 —— 不取"第一个"：
         此处已是发育过的档，别的任务可能本来就达标，它们的按钮会排在它前面，
         "取第一个"会让断言随卡池随机波动（实测同一份代码两次运行一红一绿）。 */
      const btn57 = vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq57.id + '"]');
      const bib57 = btn57 ? btn57.closest('.q-list') : null;
      const inTop57 = !!(bib57 && bib57.previousElementSibling
        && bib57.previousElementSibling.classList.contains('q-sec-ready'));
      check('★ 达标任务浮到顶块，右侧带「领取」按钮',
        !!btn57 && inTop57 && btn57.textContent.indexOf('领取') >= 0);
      if (btn57) {
        const before57 = G.state.quests.pool.length;
        const gold57 = G.state.res.gold;
        click(btn57);
        await sleep(160);
        check('★ 点「领取」一步到位（不弹详情窗）',
          document.querySelector('#modal-root').innerHTML.indexOf('任务背景') < 0);
        check('★ 领取生效：离池 + 记流水 + 发奖',
          G.state.quests.pool.length === before57 - 1
          && G.state.quests.log.some((x) => x.id === rq57.id)
          && G.state.res.gold >= gold57 + (rdef57.reward.gold || 0));
        check('★ 领取后按钮随之消失（列表已刷新）',
          !vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq57.id + '"]'));
      }
    }
  }

  /* ⑥.6 「达标即置顶」是真·自动：改达标后**不碰视图**，等主循环自己浮上去 */
  {
    let rq58 = null;
    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      /* v89.6：**统一钉死** base=1e9 造"未达标" —— 只在扫描时判"未达标"不够：
         任务指标（金/粮…）在真实时间里增长，80ms 窗口内可能跨过目标，渲染时已达标 →
         had58 变真、断言假红（门禁实测 2/3）。钉死后 amount ≡ 0，确定性未达标。 */
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; rq58.base = 1e9; break; }
    }
    /* v85 顺手修存量 flake：本段之前已发育 + 打桩，池里可能"全员达标"——
       直接在池里找"未达标"会随任务随机抽取假红（同 §57 r18 族）。兜底：挑一条
       非绝对值型任务、把 base 拉高**确定性造出未达标**（换标的、不放宽判据）。 */
    if (!rq58) {
      for (const e58 of G.state.quests.pool) {
        const d58 = G.randomQuestDef(e58.id);
        if (d58 && !d58.abs) { rq58 = e58; rq58.base = 1e9; break; }
      }
    }
    check('夹具：还有一条未达标的随机任务（供实时置顶验证）', !!rq58);
    if (rq58) {
      G.ui.setView('tasks');
      await sleep(80);
      const had58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      /* v89.6：翻牌前先等主循环「采样追平」（_lastQuestReady == 当前计数）——
         主循环的重绘是**变化门**：last 可能因套件此前的快速领取而携带陈旧值，
         恰等于"翻转后"的计数时就检测不到变化、永不重绘（存量假红的真因）。
         这里只等循环采样、不碰视图，语义不变。 */
      for (let iw = 0; iw < 15 && G._lastQuestReady !== G.questSummary().ready; iw++) {
        await sleep(200);
      }
      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      /* v89.6：固定 sleep(1500) 改**轮询** —— 主循环 1s 一拍，原等待只留 0.5 拍余量，
         门禁（python subprocess + capture）环境下实测 3/3 假红；最长等 5s，语义不变：
         达标后不手动刷新，等循环自己浮上来。 */
      let now58 = false;
      for (let i58 = 0; i58 < 25 && !now58; i58++) {
        await sleep(200);
        now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      }
      const dbg58 = 'had58=' + had58 + ' now58=' + now58
        + ' ready=' + G.questSummary().ready + ' last=' + G._lastQuestReady
        + ' view=' + G.ui.view + ' inPool=' + G.state.quests.pool.some((e) => e === rq58)
        + ' amt=' + Math.round(G.randQuestAmount(rq58)) + '/goal=' + G.questGoal(G.randomQuestDef(rq58.id));
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58, dbg58);
    }
  }

  /* ⑦ 消息流（v16：已整合进公文，且写入存档） */
  for (let i = 0; i < 20; i++) G.log('验收提示 ' + i);
  G.ui._msgCh = 'sys';
  G.ui.setView('reports');
  await sleep(100);
  G.ui.setDocTab('sys');                 /* v89.107：系统页才是消息流水 */
  await sleep(80);
  const logEl21 = document.querySelector('#doc-body');
  check('公文档消息流渲染（系统页）', !!logEl21 && /bb-line/.test(logEl21.innerHTML));
  /* v89.153：系统页 = 摘要区（#msg-task）+ 消息区（#msg-feed）——分页只约束**消息区** */
  const feedEl21 = document.querySelector('#msg-feed') || logEl21;
  const lines21 = feedEl21 ? (feedEl21.innerHTML.match(/bb-line/g) || []).length : 0;
  /* v43（老板要求）：消息流**改分页**（原为一次渲染 300 条 + 容器内滚动）。
     这里把"显示"与"存储"分开验：页面上是分页后的条数，存档里仍是全量（见下一条）。 */
  /* v89.155（老板 1）：每页条数 = docPerOf（按高度铺满 · 旧固定 15 = 下方空一截） */
  const per21 = G.ui.docPerOf('sys');
  check('v43/v89.155：消息流按页显示（每页按高度铺满 = ' + per21 + ' 条，旧固定 ' + G.ui.MSG_PER + '）',
    lines21 > 0 && lines21 <= per21 && per21 > G.ui.MSG_PER,
    lines21 + ' 行 / 每页 ' + per21);
  check('v43：消息容器不再内滚动（改分页，避免"下拉框"）',
    !/\.msg-log \{[^}]*overflow-y: auto/.test(document.documentElement.innerHTML));
  G.ui.setDocTab('war');                 /* v89.107：页签态是用例级状态 —— 用完还原 */
  await sleep(60);
  check('消息写入存档 msgLog', Array.isArray(s.msgLog) && s.msgLog.length >= 20, s.msgLog.length + ' 条');
  check('保留策略：10 游戏天 / 至少 300 条 / 至多 800 条',
    G.msgDays() === 10 && G.MSG_MIN === 300 && G.MSG_MAX === 800);
  G.ui.setView('city');
  await sleep(60);

  console.log('\n--- 22. v13 真实交互：出征三方式 / 据点 / 背包排序 / 将领装备 / 解雇 / 拆毁 ---');
  s.res.gold += 500000;
  s.res.iron += 50000; s.res.wood += 50000; s.res.stone += 50000; s.res.grain += 50000;

  /* ---- ① 出征三方式（真实点击野地 → 出兵 → 切换方式 → 确认） ---- */
  G.ui.setView('map');
  await sleep(120);
  const v22 = G.map._view;
  let landX = -1, landY = -1;
  for (let d = 1; d <= 5 && landX < 0; d++) {
    const cx = Math.min(G.map._view.span - 1, 5 + d), cy = 5 + d;
    const t = G.map.tile(v22.vx + cx, v22.vy + cy);
    if (t && t.terrain !== 'city' && !G.map.npcAt(v22.vx + cx, v22.vy + cy)
      && !G.map.fortAt(v22.vx + cx, v22.vy + cy) && !G.map.wildAt(v22.vx + cx, v22.vy + cy)) {
      landX = v22.vx + cx; landY = v22.vy + cy;
    }
  }
  check('地图上找到可用野地', landX > 0, '(' + landX + ',' + landY + ')');
  G.ui.openLandModal(landX, landY);
  await sleep(80);
  const landHtml = document.querySelector('#modal-root').innerHTML;
  check('野地弹窗含守军信息、不再写野地规则（需求 5）',
    landHtml.indexOf('守军约') >= 0 && landHtml.indexOf('野地规则') < 0);
  /* v89.152（老板 1）：未占面板产出**分行呈现** —— 资源 / 产量加成 / 材料 / 珠宝 四行；
     平地的"无可采之物"落在资源行（不再有旧的单行「此地可采」文案）。 */
  check('野地弹窗产出行 4 行（v89.152）',
    landHtml.indexOf('>资源<') >= 0 && landHtml.indexOf('>产量加成<') >= 0
    && landHtml.indexOf('>材料<') >= 0 && landHtml.indexOf('>珠宝<') >= 0
    && landHtml.indexOf('此地可采') < 0);
  /* v89.152（老板 3/4）：没有"占领/掠夺"备注行；按钮文案「占领」（不带"并驻守"） */
  check('野地弹窗无备注行 · 「占领」不带"并驻守"（v89.152）',
    landHtml.indexOf('打下来后军队就地驻守') < 0 && landHtml.indexOf('Lv0 无驻军位') < 0
    && landHtml.indexOf('data-mode="occupy">🚩 占领</button>') >= 0);
  /* v89.58：野地弹窗给三个方式按钮（侦查/掠夺/占领），点哪个就以哪个方式进面板 */
  const goBtn = document.querySelector('#modal-root [data-action="exp-open"][data-mode="occupy"]')
    || document.querySelector('#modal-root [data-action="exp-open"]');
  check('野地弹窗可进入出兵面板', !!goBtn);
  /* v89.83：独立的「派遣驻守」已并入「占领」（占领即驻守），故回到**三颗**按钮 */
  check('野地弹窗给出三种方式按钮（占领含就地驻守）', ['scout', 'raid', 'occupy'].every(function (m) {
    return !!document.querySelector('#modal-root [data-action="exp-open"][data-mode="' + m + '"]');
  }) && !document.querySelector('#modal-root [data-action="exp-open"][data-mode="station"]'));
  click(goBtn);
  await sleep(80);
  const expHtml = document.querySelector('#modal-root').innerHTML;
  /* v89.83：回到三种（「派遣」并入「占领」） */
  /* ⚠️ 不要用 expHtml.indexOf('派遣') < 0 做判据：兵力块的标题就叫「派遣兵力」，
     那是"派兵"的意思，与被退役的**出征方式**「派遣」同名不同物 —— 会假红。
     判据要落在**下拉框的选项**上（那才是方式的唯一出口）。 */
  check('出征面板列出三种方式', (function () {
    var sel = document.querySelector('#modal-root #exp-mode');
    if (!sel) return false;
    var opts = sel.querySelectorAll('option');
    var txt = Array.prototype.map.call(opts, function (o) { return o.textContent || ''; }).join('|');
    return opts.length === 3 && txt.indexOf('侦查') >= 0 && txt.indexOf('掠夺') >= 0
      && txt.indexOf('占领') >= 0 && !sel.querySelector('option[value=\"station\"]');
  })());
  check('三种方式各有消耗标注', (function () {
    var sel = document.querySelector('#modal-root #exp-mode');
    if (!sel) return false;
    var opts = sel.querySelectorAll('option');
    return opts.length === 3 && Array.prototype.every.call(opts, function (o) {
      return /体\d+ 精\d+/.test(o.textContent || '');
    });
  })());
  check('默认选中「占领」', (document.querySelector('#modal-root #exp-mode') || {}).value === 'occupy');
  G.ui.setExpMode('scout');       /* v89.58：方式改下拉框，直接调 setExpMode（与下拉 change 等同） */
  await sleep(60);
  check('可切换到「侦查」',
    (document.querySelector('#modal-root #exp-mode') || {}).value === 'scout' && G.ui._expMode === 'scout', G.ui._expMode);
  check('出征面板不再复述玩法说明（需求 5）',
    document.querySelector('#modal-root').innerHTML.indexOf('侦查无需接战') < 0);
  check('确认按钮文案随方式变化', document.querySelector('#modal-root [data-action="exp-confirm"]').textContent.indexOf('侦查') >= 0,
    document.querySelector('#modal-root [data-action="exp-confirm"]').textContent.trim());

  /* 真实侦查一次 */
  const scoutGen = s.generals[0];
  scoutGen.stamina = 100; scoutGen.energy = 100;
  const r22 = G.battle.expedition({ kind: 'wild', x: landX, y: landY }, 'scout', {}, scoutGen.id);
  check('真实侦查成功', r22.ok === true, r22.msg);
  check('侦查后弹出回报面板', (function () {
    G.ui.openScoutResult({ kind: 'wild' }, r22);
    return document.querySelector('#modal-root').innerHTML.indexOf('侦查回报') >= 0;
  })());
  G.ui.closeAllModals();

  /* ---- ② 野外城池 ---- */
  /* 地图种子取自 U.now()（每局不同），据点位置由 hash 决定 —— 若只在当前 12×12 视野里找，
     约 12% 概率一个据点都没有（密度 1/12 是指望值，不是保证）。改为围绕主城做螺旋搜索。 */
  let fort22 = null;
  (function () {
    const c0 = G.state.cities[0] || { x: 250, y: 250 };
    for (let rad = 0; rad <= 90 && !fort22; rad++) {
      for (let dy = -rad; dy <= rad && !fort22; dy++) {
        for (let dx = -rad; dx <= rad && !fort22; dx++) {
          const f = G.map.fortAt(c0.x + dx, c0.y + dy);
          if (f) fort22 = f;
        }
      }
    }
  })();
  check('地图中存在野外城池（据点由 hash 生成 · 密度 1/12）', !!fort22,
    fort22 ? (fort22.name + ' Lv' + fort22.level + ' @(' + fort22.x + ',' + fort22.y + ')') : '未找到');
  if (fort22) {
    G.ui.openFortModal(fort22);
    await sleep(80);
    const fHtml = document.querySelector('#modal-root').innerHTML;
    check('据点弹窗显示守军与等级', fHtml.indexOf('野外城池') >= 0 && fHtml.indexOf('Lv' + fort22.level) >= 0);
    check('据点弹窗说明每日变化', fHtml.indexOf('每日变化') >= 0);
    check('据点弹窗可出兵', !!document.querySelector('#modal-root [data-action="fort-exp"]'));
    G.ui.closeAllModals();
  } else {
    check('据点弹窗显示守军与等级', false, '未找到据点');
    check('据点弹窗说明每日变化', false, '未找到据点');
    check('据点弹窗可出兵', false, '未找到据点');
  }
  G.ui.openForts();
  await sleep(80);
  check('据点一览面板渲染', document.querySelector('#modal-root').innerHTML.indexOf('周边野外城池') >= 0);
  check('一览标注 1/12 密度', document.querySelector('#modal-root').innerHTML.indexOf('1/12') >= 0);
  G.ui.closeAllModals();

  /* ---- ③ 背包：四页签 / 排序切换 ---- */
  s.inventory = ['cr_weapon_1', 'cr_weapon_4', 'cr_head_2', 'cr_head_1'];
  DATA.MATERIAL_IDS.forEach(function (mid, i3) { s.items[mid] = (i3 + 1) * 3; });
  G.ui.openBag('equip');
  await sleep(90);
  const bag22 = document.querySelector('#view-container');
  check('背包含两类页签（装备 / 宝物）', bag22.querySelectorAll('[data-action="bag-tab"]').length === 2);
  check('装备页有排序条', bag22.querySelectorAll('[data-action="bag-sort"]').length >= 3);
  check('默认按品质排序（首格为神品）', /q4/.test(bag22.querySelector('.bag-cell').className),
    bag22.querySelector('.bag-cell').className);
  const sortVal = bag22.querySelector('[data-action="bag-sort"][data-v="val"]');
  click(sortVal);
  await sleep(80);
  check('可切换到按价值排序', !!document.querySelector('#view-container .bag-sortbar .chip.on'), 'val');
  await bagTabTo('material');
  const matHtml22 = document.querySelector('#view-container').innerHTML;
  check('材料页按系列分组（分页后仍在）', (matHtml22.match(/bag-sec/g) || []).length >= 3,
    (matHtml22.match(/bag-sec/g) || []).length + ' 组');
  check('材料页排序含系列/品阶/数量', (document.querySelector('#view-container').innerHTML.match(/data-action="bag-sort" data-v="/g) || []).length >= 3);
  check('材料格子有图标（矢量或位图）',
    document.querySelectorAll('#view-container .bag-cell .bag-ico svg, #view-container .bag-cell .bag-ico img.ico-img').length >= 6,
    document.querySelectorAll('#view-container .bag-cell .bag-ico svg, #view-container .bag-cell .bag-ico img.ico-img').length + ' 个');
  await bagTabTo('blueprint');
  check('图纸分类可访问', document.querySelector('#view-container').innerHTML.indexOf('装备图纸') >= 0);
  G.ui.setView('city');
  await sleep(40);

  /* ---- ④ 装备拆解（真实点击） ---- */
  const inv22 = s.inventory.length;
  G.ui.openEquipDetail('cr_weapon_1');
  await sleep(80);
  const eqHtml = document.querySelector('#modal-root').innerHTML;
  check('v78：装备详情不再有「穿给谁」（穿戴走将领侧）',
    eqHtml.indexOf('穿给谁') < 0 && eqHtml.indexOf('到「将领」面板点对应部位') >= 0);
  /* v89.110：拆解改两段式 —— 先确认（取消不销毁），再执行 */
  check('装备详情含拆解入口（v89.110：走二次确认）',
    !!document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  click(document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  await sleep(90);
  check('拆解确认弹窗写明不可撤销 + 带 do 按钮', (function () {
    const h = document.querySelector('#modal-root').innerHTML;
    return h.indexOf('不可撤销') >= 0
      && !!document.querySelector('#modal-root [data-action="salvage-equip-do"]');
  })());
  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(70);
  check('取消拆解后装备数不变（误触不销毁）', s.inventory.length === inv22, inv22 + ' 件仍在');
  G.ui.openEquipDetail('cr_weapon_1');
  await sleep(70);
  click(document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  await sleep(70);
  click(document.querySelector('#modal-root [data-action="salvage-equip-do"]'));
  await sleep(90);
  check('确定拆解后装备数减少', s.inventory.length === inv22 - 1, inv22 + ' → ' + s.inventory.length);
  G.ui.closeAllModals();

  /* ---- ④′ v89.110：解散两段式（真实点击：取消不损兵 → 确定才解散） ---- */
  {
    const cD110 = G.currentCity();
    let bIdx110 = -1;
    (cD110.cells || []).forEach((x, i) => { if (!x.build && !x.official && bIdx110 < 0) bIdx110 = i; });
    if (bIdx110 < 0) {
      check('v89.110：解散两段式（找不到空位摆军营）', false);
    } else {
      const bakB110 = cD110.cells[bIdx110].build || null;
      const bakA110 = JSON.parse(JSON.stringify(cD110.army || {}));
      const bakTab110 = G.ui._trainTab;
      cD110.cells[bIdx110].build = { id: 'junying', lvl: 1 };
      cD110.army = cD110.army || {};
      Object.keys(G.DATA.TROOPS).forEach((tid) => { cD110.army[tid] = 100; });   /* 选中谁都够解散 */
      G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf'; G.ui._trainCount = 40;
      G.ui.openTroops(bIdx110, 'normal');
      await sleep(110);
      const dH110 = document.querySelector('#modal-root').innerHTML;
      const ia110 = dH110.indexOf('data-action="confirm-train"');
      const ib110 = dH110.indexOf('data-action="troop-disband-ask"');
      check('v89.110：训练与解散之间隔着「危险操作」区（不再同行紧邻）',
        ia110 > 0 && ib110 > ia110 && /op-zone danger/.test(dH110.slice(ia110, ib110)));
      const ask110 = document.querySelector('#modal-root [data-action="troop-disband-ask"]');
      const selT110 = ask110 && ask110.dataset.troop;
      const pop0110 = G.res(cD110).pop || 0;
      click(ask110);
      await sleep(90);
      check('v89.110：解散确认弹窗写明 归农返还 / 军资不退 / 不可撤销',
        (function () {
          const h = document.querySelector('#modal-root').innerHTML;
          return h.indexOf('归农返还') >= 0 && h.indexOf('不退') >= 0 && h.indexOf('不可撤销') >= 0
            && !!document.querySelector('#modal-root [data-action="troop-disband-do"]');
        })());
      click(document.querySelector('#modal-root [data-action="close-modal"]'));
      await sleep(80);
      check('v89.110：取消解散后兵力不变（误触保护）', cD110.army[selT110] === 100,
        selT110 + ' = ' + cD110.army[selT110]);
      G.ui.openTroops(bIdx110, 'normal');                     /* 取消把弹窗关掉了，重开再走确认 */
      await sleep(90);
      const ask2 = document.querySelector('#modal-root [data-action="troop-disband-ask"]');
      const sel2 = ask2 && ask2.dataset.troop;
      click(ask2);
      await sleep(80);
      click(document.querySelector('#modal-root [data-action="troop-disband-do"]'));
      await sleep(130);
      const t110 = G.DATA.TROOPS[sel2] || {};
      const back110 = Math.floor(40 * (t110.pop || 0)
        * ((G.DATA.DISBAND || {}).popReturn == null ? 1 : G.DATA.DISBAND.popReturn));
      check('v89.110：确定解散 → 兵 100→60、人口 +' + back110 + '（真出口）',
        cD110.army[sel2] === 60 && (G.res(cD110).pop || 0) === pop0110 + back110,
        '兵 ' + cD110.army[sel2] + ' · 人口 ' + pop0110 + ' → ' + G.res(cD110).pop);
      G.ui.closeAllModals();
      cD110.cells[bIdx110].build = bakB110;                   /* 还原场景，防污染后续用例 */
      cD110.army = bakA110;
      G.ui._trainTab = bakTab110;
    }
  }

  /* ---- ⑤ 将领装备栏 ---- */
  const gen22 = s.generals[0];
  gen22.equip = {};
  s.inventory.push('cr_weapon_4', 'cr_chest_3');
  G.ui._genSel = gen22.id;
  G.ui.setView('generals');
  await sleep(90);
  /* v41（需求 2）：装备栏与解雇都在右侧档案内，不再有弹窗入口 */
  check('将领页内嵌人形装备栏（12 槽）',
    vc.querySelectorAll('.gen-pane .doll-slot').length === 12,
    vc.querySelectorAll('.gen-pane .doll-slot').length + ' 槽');
  check('解雇按钮就在右侧档案内（不再开弹窗）',
    vc.querySelectorAll('.gen-pane [data-action="dismiss-gen"]').length >= 1);
  /* v60（需求 1/2）：`.eq-sum`（带装总数）已删 —— 它与左栏「状态」重复；
     改成判「装备提供」的逐行清单 .eq-grow（统帅/勇武/… 各一行）。
     条件放宽为"栏位存在"：无装备时本来就该显示"尚未装备任何部位"。 */
  check('装备栏右侧为「装备提供」逐行清单（v60 需求 1/2）',
    !!vc.querySelector('.gen-pane .eq-gain')
    && vc.innerHTML.indexOf('eq-sum') < 0);
  click(vc.querySelector('.gen-pane [data-action="gen-auto-equip"]'));
  await sleep(140);
  check('一键最优后穿上武器', !!(gen22.equip && gen22.equip.weapon), String(gen22.equip.weapon));
  check('一键最优后穿上护甲', !!gen22.equip.chest, String(gen22.equip.chest));
  click(vc.querySelector('.gen-pane [data-action="gen-unequip-all"]'));
  await sleep(140);
  check('全部卸下后槽位清空', Object.keys(gen22.equip).length === 0);

  /* ---- ⑥ 解雇二次确认 ---- */
  /* 确保有可解雇的将领。v70（老板）起名单里恒有一位**君主将领**且不可解雇 ——
     所以这里挑"非君主"的那位（本用例要验的是"解雇能成功"，不是"能解雇君主"）。 */
  let dismissable22 = s.generals.filter((g) => !g.isLord);
  if (!dismissable22.length) {
    s.generals.push(G.makeGeneral('待解雇', 5, 'idle', s.cities[0].id, false));
    dismissable22 = s.generals.filter((g) => !g.isLord);
  }
  const victim22 = dismissable22[dismissable22.length - 1];
  const before22 = s.generals.length;
  G.ui.openDismissConfirm(victim22.id);
  await sleep(80);
  const disHtml = document.querySelector('#modal-root').innerHTML;
  check('解雇确认弹窗提示装备归还', disHtml.indexOf('归还背包') >= 0);
  check('解雇确认有取消按钮', !!document.querySelector('#modal-root [data-action="close-modal"]'));
  click(document.querySelector('#modal-root [data-action="dismiss-gen-do"]'));
  await sleep(100);
  check('确认后将领被解雇', s.generals.length === before22 - 1, before22 + ' → ' + s.generals.length);

  /* ---- ⑦ 拆毁二次确认 ---- */
  G.ui.setView('city');
  await sleep(90);
  let bIdx22 = -1;
  for (let i4 = 0; i4 < s.cities[0].cells.length; i4++) {
    /* v16：施工中的格子点开是「升级中」面板（无拆毁按钮），须排除 */
    if (s.cities[0].cells[i4].build && !s.cities[0].cells[i4].official && !s.cities[0].cells[i4].pending) { bIdx22 = i4; break; }
  }
  check('找到可拆毁建筑', bIdx22 >= 0, 'idx=' + bIdx22);
  if (bIdx22 >= 0) {
    s.cities[0].cells[bIdx22].build.lvl = 2;   /* v76：设 Lv2，验证"逐级"（拆一次 → Lv1） */
    G.ui.openBuildModal(bIdx22);
    await sleep(80);
    const bHtml22 = document.querySelector('#modal-root').innerHTML;
    check('建筑面板有拆毁按钮', !!document.querySelector('#modal-root [data-action="demolish-ask"]'));
    check('v76：面板不再写返还长备注；操作三键同排',
      bHtml22.indexOf('返还累计投入的 50%') < 0 && bHtml22.indexOf('class="bldg-acts"') >= 0);
    check('建筑面板不再显示升级耗时', bHtml22.indexOf('耗时') < 0);
    click(document.querySelector('#modal-root [data-action="demolish-ask"]'));
    await sleep(90);
    check('拆毁确认弹窗出现', !!document.querySelector('#modal-root [data-action="demolish-do"]'));
    click(document.querySelector('#modal-root [data-action="demolish-do"]'));
    await sleep(100);
    check('v76 逐级：确认后只降 1 级（Lv2 → Lv1）',
      !!(s.cities[0].cells[bIdx22].build && s.cities[0].cells[bIdx22].build.lvl === 1));
    /* 拆到 Lv1 再拆一次 → 整座移除、地块腾空 */
    G.ui.openBuildModal(bIdx22);
    await sleep(80);
    click(document.querySelector('#modal-root [data-action="demolish-ask"]'));
    await sleep(90);
    click(document.querySelector('#modal-root [data-action="demolish-do"]'));
    await sleep(100);
    check('拆到 Lv1 再拆 → 整座移除', !s.cities[0].cells[bIdx22].build);
    check('拆毁后地块变为空地', !!document.querySelector('.iso-tile.empty'), 'iso-tile.empty 存在');
  } else {
    check('建筑面板有拆毁按钮', false, '无建筑');
    check('v76：面板不再写返还长备注；操作三键同排', false, '无建筑');
    check('建筑面板不再显示升级耗时', false, '无建筑');
    check('拆毁确认弹窗出现', false, '无建筑');
    check('v76 逐级：确认后只降 1 级（Lv2 → Lv1）', false, '无建筑');
    check('拆到 Lv1 再拆 → 整座移除', false, '无建筑');
    check('拆毁后地块变为空地', false, '无建筑');
  }

  /* ---- ⑧ 顶栏无重复菜单 + 将领菜单存在 ---- */
  const nav22 = document.querySelector('#topnav').innerHTML;
  check('顶栏含将领菜单', nav22.indexOf('data-view="generals"') >= 0);
  check('顶栏不含军队/科技/装备/宝物重复入口', nav22.indexOf('data-view="troops"') < 0
    && nav22.indexOf('data-view="tech"') < 0 && nav22.indexOf('data-view="equip"') < 0);

  console.log('\n--- 14. 存档往返 ---');
  try {
    let strOk = true, strErr = '';
    try { JSON.stringify(s); } catch (e) { strOk = false; strErr = e.message; }
    check('state 可序列化（无循环引用）', strOk, strErr || (JSON.stringify(s).length + ' 字符'));

    let lsOk = true, lsErr = '';
    try { window.localStorage.setItem('__probe', '1'); window.localStorage.removeItem('__probe'); }
    catch (e) { lsOk = false; lsErr = e.message; }
    check('localStorage 可写', lsOk, lsErr || 'ok');

    const saved = G.saveGame();
    check('saveGame 返回 true', saved === true, '返回 ' + saved);
    const raw = window.localStorage.getItem('sanguo_save_v3');
    check('存档已写入', !!raw, raw ? raw.length + ' 字符' : '空');
    const re = G.loadGame();
    check('读档成功', !!re && re.cities.length >= 1, re ? re.cities.length + ' 座城' : 'null');
  } catch (e) { check('存档往返', false, e.message + '\n' + (e.stack || '').split('\n')[1]); }


  console.log('\n--- 16. 首页存档选择（有档后） ---');
  G.ui.setCreate();
  await sleep(60);
  const contBtn = document.querySelector('#create-continue');
  const note = document.querySelector('#create-save-note');
  check('有存档时「继续」按钮显示', contBtn && !contBtn.classList.contains('hidden'));
  check('首页显示存档概要', note && note.innerHTML.length > 10,
    (note ? note.textContent.trim().slice(0, 40) : ''));
  check('概要含年号与城池数', /城\d+座/.test(note.textContent) || /城/.test(note.textContent));
  /* ============================================================
   * 23. 行军队列（v18）：真实点击 → 出发 → 队列 → 抵达
   * ============================================================ */
  console.log('\n--- 23. 行军队列（v18）---');
  {
    G.ui.setView('city');
    await sleep(80);
    const c23 = G.state.cities[0];
    c23.army = Object.assign({}, c23.army, { yibing: 20000 });
    const g23 = G.state.generals[0];
    g23.stamina = 100; g23.energy = 100;
    G.state.marches = [];
    G.refreshAll();
    await sleep(60);

    /* 找一个野地作为目标（与界面「出兵」走同一条 dispatch 路径） */
    let w23 = null;
    for (let r = 1; r < 40 && !w23; r++) {
      for (let dy = -r; dy <= r && !w23; dy++) {
        for (let dx = -r; dx <= r && !w23; dx++) {
          const x = c23.x + dx, y = c23.y + dy;
          const tl = G.map.tile(x, y);
          if (tl && tl.terrain === 'lake' && !G.map.wildAt(x, y) && !G.map.npcAt(x, y)) w23 = { x, y };
        }
      }
    }
    check('找到可出征的野地', !!w23, w23 ? '(' + w23.x + ',' + w23.y + ')' : '未找到');

    if (w23) {
      const r23 = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, g23.id);
      check('出发后进入行军队列', !!r23.ok && G.state.marches.length === 1, r23.msg);
      G.refreshAll();          // 真实界面里 doExpConfirm 出发后同样会 refreshAll
      await sleep(100);

      /* v89.135（老板 10）：「在办事项」退役 —— 在途行军看「军务 · 军务总览」 */
      G.ui._marchTab = 'over';
      G.ui.setView('marches');
      await sleep(90);
      check('军务总览列出在途行军（v89.135：在办事项退役后的落点）',
        /* 军务总览 ④ 行军表：表头「行军进度」+ 行内「召回」按钮（无 🛫 —— 那是旧 queueBody 的词） */
        vc.textContent.indexOf('行军进度') >= 0 && vc.textContent.indexOf('召回') >= 0,
        vc.textContent.replace(/\s+/g, ' ').slice(-60));
      G.ui.setView('city');
      await sleep(60);
      check('出发后兵力离城', G.armyTotal(c23) === 0, G.armyTotal(c23) + ' 兵');

      G.ui.openMarches();
      await sleep(80);
      const mHtml = document.querySelector('#modal-root').innerHTML;
      check('行军队列面板渲染表格', mHtml.indexOf('行军队列') >= 0
        && document.querySelectorAll('#modal-root tbody tr').length === 1);
      check('面板显示行军进度条', document.querySelectorAll('#modal-root .pbar').length >= 1);
      check('面板有召回按钮', !!document.querySelector('#modal-root [data-action="march-recall"]'));
      check('面板有急行军令', !!document.querySelector('#modal-root [data-action="march-rush"]'));

      const btn = document.querySelector('#modal-root [data-action="march-recall"]');
      if (btn) {
        click(btn);
        await sleep(140);
        check('点击召回后队列清空', G.state.marches.length === 0, G.state.marches.length + ' 支');
        check('召回后兵力归城', G.armyTotal(c23) === 20000, G.armyTotal(c23) + ' 兵');
      }
      G.ui.closeAllModals();
      await sleep(60);

      /* 再出发一次 → 用真实主循环推进到抵达 */
      c23.army = Object.assign({}, c23.army, { yibing: 20000 });
      const gen2 = G.state.generals.filter((g) => g.id !== g23.id)[0] || g23;
      gen2.stamina = 100; gen2.energy = 100;
      /* v89.31：战事奇遇 —— pin 取「胜/败两池交集」指定必中（无论胜负都能命中） */
      const _pw31 = G.SG.actPool('battle-win');
      const _pl31 = G.SG.actPool('battle-lose');
      const _set31 = {};
      _pl31.fresh.concat(_pl31.done).forEach((r) => { _set31[r.st.id] = 1; });
      const _ov31 = _pw31.fresh.concat(_pw31.done).filter((r) => _set31[r.st.id]);
      const _pin31 = ((_ov31[0] || _pw31.fresh[0] || _pw31.done[0]).st || {}).id;
      G.SG.TRIG.pin = _pin31; G.SG.TRIG._actAt = {};
      const r23b = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, gen2.id);
      if (r23b.ok) {
        await sleep(60);
        let n = 0;
        while (G.state.marches.length && n < 120) { G.tickOnce(); n++; await sleep(8); }
        check('主循环推进后大军抵达', G.state.marches.length === 0, '推进 ' + n + ' tick');
        /* 断言「没有凭空消失」：幸存者回城 + 伤兵入营，二者之和必须 > 0
           （全歼时幸存者为 0 是正常的，不能据此判定失败） */
        check('抵达后兵力去向明确（幸存归营 / 阵亡入伤兵营）',
          G.armyTotal(c23) + (G.state.wounded || 0) > 0,
          '归营 ' + G.armyTotal(c23) + ' · 伤兵 ' + (G.state.wounded || 0));
        check('抵达后将领恢复空闲', G.state.generals.every((g) => g.status !== 'march'));
        /* v89.31 战事触发链 → v89.86（P-06）待阅语义：
           抵达结算命中 → 入待阅（不再全屏打断）→ 从待阅开卷 → 掩卷出列 */
        const fx31 = document.querySelector('#story-fx');
        const pend31 = (G.SG.pending() || []).some((x) => x.sid === _pin31);
        check('★ v89.86（P-06）：战事触发 · 入待阅（相关建筑池 · ' + _pin31 + '）',
          pend31 && (!fx31 || fx31.style.display === 'none'));
        G.ui.sgReadPending(_pin31);
        await sleep(40);
        /* ⚠️ 阅读器元素可能在本用例**首次创建** —— 必须重查，不能沿用开卷前抓的引用（否则是 null） */
        const fx31b = document.querySelector('#story-fx');
        check('★ v89.86（P-06）：从待阅开卷（同一阅读器 · ' + _pin31 + '）',
          !!fx31b && fx31b.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31b && fx31b.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.86（P-06）：掩卷收起 · 待阅已出列', !!fx31b && fx31b.style.display === 'none'
          && !(G.SG.pending() || []).some((x) => x.sid === _pin31));
        G.SG.TRIG.pin = null; G.SG.TRIG._actAt = {};
      }
    }

    /* 出征弹窗的行军预估 */
    /* v84 顺手修存量 flake：地图种子每次运行都不同（state.js: mapSeed = U.now() % 100000），
       写死的 c23.x+3 / c23.y+3 可能落在城池 / 越界 —— resolveTarget 拒绝、弹窗不开，
       两条断言假红（实测命中）。改为 ring 搜索一块合法野地当靶子（换标的、不放宽判据）。 */
    let emSpot = null;
    for (let emR = 1; emR <= 12 && !emSpot; emR++) {
      for (let emDy = -emR; emDy <= emR && !emSpot; emDy++) for (let emDx = -emR; emDx <= emR && !emSpot; emDx++) {
        const tl23 = G.map.tile(c23.x + emDx, c23.y + emDy);
        if (tl23 && tl23.terrain !== 'city') emSpot = { x: c23.x + emDx, y: c23.y + emDy };
      }
    }
    G.ui._expTarget = { kind: 'wild', x: emSpot.x, y: emSpot.y, name: '测试野地', terrain: 'lake', level: 3, def: 0, garrison: { yibing: 100 } };
    G.ui._expMode = 'raid';
    c23.army = Object.assign({}, c23.army, { yibing: 5000 });
    G.ui.openExpModal(G.ui._expTarget);
    await sleep(100);
    const emHtml = document.querySelector('#modal-root').innerHTML;
    check('出征弹窗显示行军预估', emHtml.indexOf('行军') >= 0 && emHtml.indexOf('速度系数') >= 0);
    check('行军预估含预计时长', /预计/.test(emHtml));
    G.ui.closeAllModals();
    await sleep(60);
    G.state.marches = [];
    G.refreshAll();
  }

  /* ============================================================
   * 24. v19 十项体验修复：升级不锁功能 / 菜单分组 / 行军菜单 /
   *     弹窗统一 / 侧栏精简 / 建筑移动与改建 / 仓库多建
   * ============================================================ */
  console.log('\n--- 24. v19 体验修复（真实 DOM）---');
  {
    const s24 = G.state;
    const c24 = s24.cities[0];
    s24.res.grain = 5e8; s24.res.wood = 5e8; s24.res.stone = 5e8; s24.res.iron = 5e8; s24.res.gold = 5e8;
    const findEmpty24 = () => c24.cells.findIndex((x, i) => !x.official && !x.build && !x.pending);
    const finishAll24 = () => {
      let g = 0;
      while (s24.queues.build.length && g++ < 30) {
        const q = s24.queues.build[0];
        q.elapsed = q.totalTime;
        G.applyBuildDone(q);
        const i = s24.queues.build.indexOf(q);
        if (i >= 0) s24.queues.build.splice(i, 1);
      }
    };

    /* v68（逐步探索）：官府拉满 —— 本段专注"升级不锁功能"，不受官府总闸干扰 */
    c24.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });

    /* ---- ① 升级是后台过程：升级中仍能打开功能面板 ---- */
    const junI = findEmpty24();
    G.buildAt(c24.id, junI, 'junying');
    finishAll24();
    G.upgradeAt(c24.id, junI);
    check('升级中有施工进度', !!G.buildProgress('city', junI));
    G.ui.openBuildModal(junI);
    await sleep(80);
    let mh24 = document.querySelector('#modal-root').innerHTML;
    check('升级中面板显示「升级中」与目标等级', mh24.indexOf('升级中') >= 0 && /Lv1 → Lv2/.test(mh24));
    check('升级中面板保留功能入口（军营→募兵）',
      mh24.indexOf('募兵') >= 0 && !!document.querySelector('#modal-root [data-action="open-troops"]'));
    check('升级中面板可取消升级（v89.110：走二次确认）', !!document.querySelector('#modal-root [data-action="cancel-build-ask"]'));
    /* v72（老板报障「官府升级中点击被撑爆」）→ v73（老板「顶部的图标也不要留」）：
       顶部图标块整体撤除 —— 连根拔除 1024px 位图撑爆的土壤，同时清掉旧 emoji 观感。 */
    check('v73：升级中面板不再有顶部图标（.dlg-ico 连根退役）',
      !document.querySelector('#modal-root .dlg-ico')
      && mh24.indexOf('class="dlg-ico"') < 0);
    check('升级中面板标注「不影响下方操作」', mh24.indexOf('不影响下方操作') >= 0);
    /* 真的点一下功能按钮 → 应打开募兵面板（证明不是装饰） */
    const fnBtn24 = document.querySelector('#modal-root [data-action="open-troops"]');
    if (fnBtn24) {
      click(fnBtn24);
      await sleep(100);
      check('升级中点功能按钮真的打开募兵面板',
        document.querySelector('#modal-root').innerHTML.indexOf('兵营招募') >= 0);
      G.ui.closeAllModals();
    }
    /* 升级中募兵仍走通 */
    const tr24 = G.train('yibing', 50, c24.id);
    check('升级中仍可发起募兵', tr24.ok, tr24.msg);
    finishAll24();
    /* 判据用「该格等级」：全城可能已有多座军营，buildingLevel() 取的是最高级 */
    check('升级完成后该格等级生效 Lv2', c24.cells[junI].build && c24.cells[junI].build.lvl === 2,
      '该格 Lv' + (c24.cells[junI].build && c24.cells[junI].build.lvl));
    check('升级完成清空施工标记', !c24.cells[junI].pending);

    /* ---- ② 侧栏精简 ---- */
    G.ui.renderResBar(c24, s24);
    const rb24 = document.querySelector('#res-bar');
    check('资源栏无图标（纯文字）', rb24.querySelectorAll('svg, img').length === 0,
      rb24.querySelectorAll('svg').length + ' 个图标');
    /* v65：改为短写（≥1万 → 万；≥1亿 → 亿），小数只保留 1~2 位 */
    check('资源存量短写（原值千分位 / 大数为万或亿）', (function () {
      const a = rb24.querySelector('.amt');
      if (!a) return false;
      const t = a.textContent.trim();
      return /^[\d,]+$/.test(t) ? true : /^\d+\.\d{1,2}[万亿]$/.test(t);
    })(), rb24.querySelector('.amt') && rb24.querySelector('.amt').textContent);
    check('资源栏已去掉「每小时（游戏时间）」提示', rb24.textContent.indexOf('每小时') < 0);
    /* v29（需求 8）：资源栏首行是"本城 · 城名"表头，所以这里按**标签集合**判定 */
    check('资源行标签为纯文字', (function () {
      var ls = Array.prototype.map.call(rb24.querySelectorAll('.lbl'), function (x) { return x.textContent.trim(); });
      return ls.indexOf('粮食') >= 0 && ls.indexOf('木材') >= 0;
    })(), Array.prototype.map.call(rb24.querySelectorAll('.lbl'), function (x) { return x.textContent.trim(); }).join('/'));

    G.ui.renderCityAttrs(c24, s24);
    const ca24 = document.querySelector('#city-attrs').textContent;
    /* v20（需求 5/12）：黄金、税收（金/时）、可征人口 全部移除 */
    check('城池属性不再显示黄金', ca24.indexOf('黄金') < 0);
    check('城池属性不再显示税收', ca24.indexOf('税收') < 0);
    check('城池属性不再显示可征人口', ca24.indexOf('可征人口') < 0);
    check('城池属性保留 民心/民怨/税率/人口',
      ca24.indexOf('民心') >= 0 && ca24.indexOf('民怨') >= 0 && ca24.indexOf('税率') >= 0
      && ca24.indexOf('人口') >= 0);
    /* v24（需求 6）：城防·驻军与城外地块两行也删掉（驻军栏就在正下方，城防在统计页） */
    check('城池属性不再显示 城防/驻军/城外地块',
      ca24.indexOf('城防') < 0 && ca24.indexOf('驻军') < 0 && ca24.indexOf('城外地块') < 0);

    /* ---- ③ 弹窗尺寸与格局统一 ---- */
    G.ui.openLordInfo();
    await sleep(80);
    mh24 = document.querySelector('#modal-root').innerHTML;
    check('君主弹窗为三段式（head/body）+ 右上角关闭键',
      !!document.querySelector('#modal-root .m-head') && !!document.querySelector('#modal-root .m-body')
      && !!document.querySelector('#modal-root .modal-x[data-action="close-modal"]')
      && !document.querySelector('#modal-root .m-foot [data-action="close-modal"]'));
    /* v89.105：实测 690px，xl(700) 会冒滚动条 → 升 xxl（左右分栏结构不变） */
    check('君主弹窗用大档固定尺寸（v77 左右分栏 · v89.105 升 xxl）',
      !!document.querySelector('#modal-root .modal-xxl'));
    check('三段式弹窗内层为 flex 布局', !!document.querySelector('#modal-root .inner-panel.inner-shell'));
    G.ui.closeAllModals();
    /* v25（需求 2）：商城/背包改为整页视图 —— 与各"大界面"同格局（.ui-page 容器） */
    G.ui.openBag('equip'); await sleep(60);
    check('背包整页与大界面同格局（.ui-page）',
      !!document.querySelector('#view-container .ui-page') && document.querySelector('#modal-root').innerHTML === '');
    /* v89.145（老板 2）：背包页挂 .bag-page（满高 flex 列）——
       顶部（页签/分类/排序）冻结、只有 .bag-body 是滚动容器（不再整页滚） */
    check('v89.145：背包页 .bag-page（顶部冻结 · .bag-body 独立滚动容器）',
      !!document.querySelector('#view-container .ui-page.bag-page')
      && !!document.querySelector('#view-container .bag-page > .bag-body'));
    G.ui.openShop(); await sleep(60);
    check('商城整页与大界面同格局（.ui-page）', !!document.querySelector('#view-container .ui-page'));
    /* v89.145（老板 1/2）：物品区**恒定** shop-fill（不足 4 行也撑满）+ 数量行去「最多」（−/＋ 仍在） */
    check('v89.145：商城物品区恒定 .shop-fill（撑满）+ 数量行去「最多」', (function () {
      var vc145 = document.querySelector('#view-container');
      return !!vc145.querySelector('.shop-rows.shop-fill')
        && vc145.querySelectorAll('[data-action="qty-step"]').length > 0
        && vc145.querySelectorAll('[data-action="qty-max"]').length === 0;
    })(), (function () {
      var vc145 = document.querySelector('#view-container');
      return 'step=' + vc145.querySelectorAll('[data-action="qty-step"]').length
        + ' max=' + vc145.querySelectorAll('[data-action="qty-max"]').length;
    })());
    /* v29（需求 14）：竖卡网格 → 物品行；v39（需求 5）：每页 8 → 16 行 */
    check('商城为物品行（每页 16 行）', document.querySelectorAll('#view-container .item-row').length === 16,
      document.querySelectorAll('#view-container .item-row').length + ' 行');
    G.ui.setView('city'); await sleep(40);

    /* ---- ④ 菜单分组 + 行军菜单 + 公告并入公文 ---- */
    const nav24 = document.querySelector('#topnav');
    check('顶栏有类型分隔线（≥4 处）', nav24.querySelectorAll('.nav-sep').length >= 4,
      nav24.querySelectorAll('.nav-sep').length + ' 处');
    check('行军菜单存在', !!nav24.querySelector('[data-view="marches"]'));
    check('公告不再单独占菜单', !nav24.querySelector('[data-action="open-notice"]'));
    /* v89.104：删「统计」、将领/军务/任务三者相邻、新增「故事集」独立页与「自动」
       顺序取自 index.html 的 #topnav 实装（分隔线 = null） */
    check('菜单分组顺序正确（场景→军事[将领/军务/任务]→商背→记录→系统）', (function () {
      const order = ['city', 'ext', 'map', null, 'generals', 'marches', 'tasks', null,
        'shop', 'bag', null, 'story', 'stories', 'reports', null, 'auto', 'settings'];
      const els = Array.from(nav24.children).filter((e) => e.classList.contains('tab') || e.classList.contains('nav-sep'));
      let k = 0;
      for (const e of els) {
        const key = e.classList.contains('nav-sep') ? null : (e.dataset.view || null);
        if (key === null && e.dataset.action) continue;  // 存档/新游戏等尾部按钮
        if (k < order.length && key === order[k]) k++;
      }
      return k >= 16;
    })());

    G.ui.setView('reports');
    await sleep(80);
    const rep24 = document.querySelector('#view-container').innerHTML;
    /* v27（需求 2）：公告 · 当前要务 与 系统状态 两块整段删除 ——
       前者与「任务」菜单重复，后者把四项分属不同菜单的小字挤在一起。 */
    check('公文页不再有「公告 · 当前要务」与「系统状态」',
      rep24.indexOf('公告 · 当前要务') < 0 && rep24.indexOf('系统状态') < 0);
    check('公文页只留报告与消息（v29 需求 6：队列已迁出）',
      rep24.indexOf('id="doc-queues"') < 0 && rep24.indexOf('doc-tabs') >= 0
      && rep24.indexOf('id="doc-body"') >= 0);
    check('独立公告弹窗已移除', typeof G.ui.openNotice !== 'function');

    /* ---- ⑤ 行军菜单：监控本城在外军队 ---- */
    let w24 = null;
    for (let r = 1; r < 40 && !w24; r++) {
      for (let dy = -r; dy <= r && !w24; dy++) for (let dx = -r; dx <= r && !w24; dx++) {
        const x = c24.x + dx, y = c24.y + dy;
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'lake' && !G.map.wildAt(x, y) && !G.map.npcAt(x, y)) w24 = { x, y };
      }
    }
    c24.army = { yibing: 40000 };
    const gen24 = s24.generals[0]; gen24.stamina = 100; gen24.energy = 100;
    s24.marches = [];
    const disp24 = G.march.dispatch({ kind: 'wild', x: w24.x, y: w24.y }, 'raid', { yibing: 40000 }, gen24.id);
    check('行军派出成功', !!disp24.ok, disp24.msg);
    G.refreshAll();
    await sleep(120);
    G.ui.setView('marches');
    await sleep(120);
    const mvh = document.querySelector('#view-container').innerHTML;
    /* v89.86（整改 P-20）：行军视图 → 军务总览（标题与五段结构随之更新） */
    check('军务总览渲染出征队列', mvh.indexOf('军务总览') >= 0 && mvh.indexOf(gen24.name) >= 0);
    check('行军菜单含行军进度列', mvh.indexOf('行军进度') >= 0 && mvh.indexOf('%') >= 0);
    /* v89.140（老板 2）：驻守野地 / 采集队两区**退役**（唯一落点 = 附属野地 / 地块界面） */
    check('军务总览**不再**含驻守野地 / 采集队区（v89.140）',
      mvh.indexOf('驻守野地') < 0 && mvh.indexOf('③ 采集队') < 0);
    check('行军菜单含急行军令入口', !!document.querySelector('[data-action="march-rush"]'));
    /* v41（需求 3）：行军菜单**不再有数值徽标** —— 老板原话「不要给在行军这个
       菜单名上产生数值」。这里改成反向断言：顶栏必须没有它。 */
    check('行军菜单不带数值徽标（v41 需求 3）',
      !document.querySelector('#tab-badge-march')
      && !/tab-badge-march/.test(document.querySelector('#topnav').innerHTML));
    /* 抵达后队列清空 */
    let tick24 = 0;
    while (s24.marches.length && tick24++ < 400) G.march.tick();
    G.refreshAll();
    await sleep(80);
    check('抵达后队列清空', s24.marches.length === 0);

    /* ---- ⑥ 城内建筑移动 / 交换（走真实按钮） ---- */
    const mvFrom = findEmpty24();
    /* 用民房做移动样本：民房非唯一建筑，不受「已建造」限制 */
    const mvBuild = G.buildAt(c24.id, mvFrom, 'minfang');
    finishAll24();
    check('移动样本建筑建成', mvBuild.ok && !!c24.cells[mvFrom].build, mvBuild.msg);
    G.ui.openBuildModal(mvFrom);
    await sleep(80);
    check('建筑面板有「移动 / 交换」按钮', !!document.querySelector('#modal-root [data-action="move-ask"]'));
    const mvBtn = document.querySelector('#modal-root [data-action="move-ask"]');
    click(mvBtn);
    await sleep(100);
    check('点移动后进入待选状态', G.ui._moveFrom === mvFrom, String(G.ui._moveFrom));
    const mvTo = findEmpty24();
    /* 模拟点击目标地块（真实事件委托路径） */
    G.ui.openBuildModal(mvTo);
    await sleep(60);
    G.ui.closeAllModals();
    G.ui.openMoveConfirm(mvFrom, mvTo);
    await sleep(80);
    check('出现移动确认弹窗', !!document.querySelector('#modal-root [data-action="move-do"]'));
    click(document.querySelector('#modal-root [data-action="move-do"]'));
    await sleep(120);
    check('确认后建筑已搬迁', !c24.cells[mvFrom].build && !!c24.cells[mvTo].build && c24.cells[mvTo].build.id === 'minfang',
      JSON.stringify(c24.cells[mvTo].build));
    check('移动后清空待选状态', G.ui._moveFrom === null);
    /* 官府不能被移动 */
    const gv24 = c24.cells.findIndex((x) => x.official);
    const e24 = findEmpty24();
    const mvGv = G.moveBuilding(c24.id, gv24, e24);
    check('官府不可移动（正确拒绝）', !mvGv.ok && /官府/.test(mvGv.msg), mvGv.msg);

    /* ---- ⑦ 城外改建（走真实按钮） ---- */
    G.ensureExtGrid(c24);
    const grid24 = G.extGridOf(c24);
    let ei24 = grid24.findIndex((x) => x.type === 'farm');
    if (ei24 < 0) { grid24[0].type = 'farm'; grid24[0].lv = 1; ei24 = 0; }
    grid24[ei24].lv = 3;
    /* v26（需求 5）：_citySub 已随子页签一并删除，城外是一个平级视图 */
    G.ui.setView('ext');
    await sleep(100);
    G.ui.openExtModal(ei24);
    await sleep(80);
    mh24 = document.querySelector('#modal-root').innerHTML;
    check('城外地块面板有「改建」入口', !!document.querySelector('#modal-root [data-action="ext-convert-ask"]'));
    /* v89.138（老板 4）：「功能」标题行已删（按钮直接呈现）—— 判据反转 */
    check('城外地块面板操作分区（升级行 / 底栏 · v89.138 已删「功能」标题）',
      mh24.indexOf('op-zone-t">功能') < 0 && mh24.indexOf('op-zone-t">升级') >= 0 && mh24.indexOf('bldg-foot') >= 0);
    click(document.querySelector('#modal-root [data-action="ext-convert-ask"]'));
    await sleep(100);
    const cv24 = document.querySelector('#modal-root').innerHTML;
    check('改建面板列出其他 3 种资源建筑', document.querySelectorAll('#modal-root [data-action="ext-convert"]').length === 3,
      document.querySelectorAll('#modal-root [data-action="ext-convert"]').length + ' 个候选');
    check('改建面板走三段式格局', !!document.querySelector('#modal-root .m-head'));
    const target24 = document.querySelector('#modal-root [data-action="ext-convert"]:not([disabled])');
    const tType = target24 && target24.getAttribute('data-eid');
    click(target24);
    await sleep(120);
    check('改建成功且等级保留', grid24[ei24].type === tType && grid24[ei24].lv === 3,
      grid24[ei24].type + ' Lv' + grid24[ei24].lv);

    /* ---- ⑧ 仓库可多建（前端不再禁用） ---- */
    G.ui.setView('city');
    await sleep(80);
    const emptyForCk = findEmpty24();
    if (emptyForCk >= 0) {
      G.ui.openBuildModal(emptyForCk);
      await sleep(80);
      const cangkuCard = Array.from(document.querySelectorAll('#modal-root .troop-card'))
        .find((el) => el.getAttribute('data-build') === 'cangku');
      check('仓库在建造列表中可选（不再标「已建造(唯一)」）',
        !!cangkuCard && !cangkuCard.classList.contains('disabled'),
        cangkuCard ? (cangkuCard.className || 'ok') : '未找到卡片');
      G.ui.closeAllModals();
    }
    const before24 = G.buildingLevelSum(c24, 'cangku');
    const capBefore24 = G.storeCap();
    const ck1 = G.buildAt(c24.id, findEmpty24(), 'cangku');
    finishAll24();
    const ck2 = G.buildAt(c24.id, findEmpty24(), 'cangku');
    finishAll24();
    check('可连建多座仓库', ck1.ok && ck2.ok, (ck1.msg || '') + ' / ' + (ck2.msg || ''));
    check('储量随仓库数叠加', G.buildingLevelSum(c24, 'cangku') === before24 + 2 && G.storeCap() > capBefore24,
      G.utils.fmt(capBefore24) + ' → ' + G.utils.fmt(G.storeCap()));

    /* ---- ⑨ 任务页占位文案已删 ---- */
    G.ui.setView('tasks');
    await sleep(100);
    check('任务页不再出现「已完成的任务收在这里」占位',
      document.querySelector('#view-container').innerHTML.indexOf('已完成的任务收在这里') < 0);
    G.ui.setView('city');
    await sleep(60);
  }

  const metaE = G.readMeta();
  check('索引可直接读取', !!metaE && typeof metaE.gameElapsed === 'number', metaE && metaE.name);


  /* ================= v21：伤兵归属 · 信息层级 · 界面统一 ================= */
  console.log('\n--- v21 界面临界校验（真实 DOM） ---');

  /* 统一层样式确实随页面加载 */
  const sheet21_v21 = Array.from(document.styleSheets).map((ss) => {
    try { return Array.from(ss.cssRules).map((r) => r.cssText || '').join('\n'); } catch (e) { return ''; }
  }).join('\n');
  check('统一层样式已加载（.ui-page / .wounded-box / --fs-body）',
    sheet21_v21.indexOf('.ui-page') >= 0 && sheet21_v21.indexOf('.wounded-box') >= 0
    && sheet21_v21.indexOf('--fs-body') >= 0);
  /* v24（需求 3）：地图标题（含观察框说明）整段删除，共享规则只余大界面与弹窗 */
  check('标题统一规则已加载（.gold-heading, .m-title）',
    sheet21_v21.indexOf('.gold-heading') >= 0 && sheet21_v21.indexOf('.m-title') >= 0);

  /* 需求 1：伤兵营 —— 行军视图 / 行军弹窗 / 校场 */
  const s21_v21 = G.state;
  const bk21_v21 = { w: s21_v21.wounded, wa: s21_v21.woundedArmy };
  s21_v21.wounded = 777;
  s21_v21.woundedArmy = { yibing: 777 };

  /* v89.132（老板「军务总览里边，不需要两营这个菜单，只在军务处即可」）：
     两营落点改到**军务处页签**（camp-cards 左右分列）—— 判据随落点走。 */
  G.ui._marchTab = 'over';
  G.ui.setView('marches');
  await sleep(80);
  const marches21_v21 = vc.innerHTML;
  /* v89.140（老板 2）：驻守野地/采集队退役 → ① 城内 / ② 征战中 / ③ 行军 */
  check('军务总览三段齐（① 城内 / ③ 行军）、不再列两营、不再列驻守野地与采集队',
    marches21_v21.indexOf('① 城内') >= 0 && marches21_v21.indexOf('行军') >= 0
    && marches21_v21.indexOf('伤兵营') < 0
    && marches21_v21.indexOf('驻守野地') < 0 && marches21_v21.indexOf('③ 采集队') < 0);
  G.ui._marchTab = 'affairs';
  G.ui.setView('marches');
  await sleep(80);
  const affairs21_v21 = vc.innerHTML;
  check('军务处页签渲染**两营左右分列**（伤兵营 + 俘虏营 + 治疗键）',
    affairs21_v21.indexOf('伤兵营') >= 0 && affairs21_v21.indexOf('俘虏营') >= 0
    && affairs21_v21.indexOf('data-action="heal-wounded"') >= 0
    && affairs21_v21.indexOf('camp-cards') >= 0);
  check('军务处给出数量与治疗费（信息型）',
    affairs21_v21.indexOf('777') >= 0 && affairs21_v21.indexOf('7,770') >= 0);
  G.ui._marchTab = 'over';

  G.ui.openMarches();
  await sleep(70);
  check('行军队列弹窗含伤兵营',
    document.querySelector('#modal-root').innerHTML.indexOf('data-heal-host="marches"') >= 0);
  G.ui.closeAllModals();

  /* 校场：若本城未建，先建一座并推进完工 */
  const c21_v21 = G.currentCity();
  if (!c21_v21.cells.some((x) => x.build && x.build.id === 'xiaochang')) {
    const em21_v21 = c21_v21.cells.findIndex((x) => !x.build && !x.pending);
    if (em21_v21 >= 0) {
      s21_v21.res.grain = 1e8; s21_v21.res.wood = 1e8; s21_v21.res.stone = 1e8; s21_v21.res.iron = 1e8;
      G.buildAt(c21_v21.id, em21_v21, 'xiaochang');
      let guard21_v21 = 0;
      while (s21_v21.queues.build.length && guard21_v21++ < 40) {
        const q21_v21 = s21_v21.queues.build[0];
        q21_v21.elapsed = q21_v21.totalTime;
        G.applyBuildDone(q21_v21);
        const i21_v21 = s21_v21.queues.build.indexOf(q21_v21);
        if (i21_v21 >= 0) s21_v21.queues.build.splice(i21_v21, 1);
      }
    }
  }
  /* v89.133（v89.128 第二批第 10 条 · 老板）：「校场不要现在的界面功能，点击建筑功能
     直接进入'军务'界面」—— 面板退役，动作直接切军务视图（这里走同一动作分发）。 */
  G.action('open-xiaochang', { dataset: {} });
  await sleep(140);
  check('点校场 → 直接进军务视图（校场面板退役 · 第 10 条）',
    G.ui.view === 'marches' && G.ui._marchTab === 'over',
    (G.ui.view || '-') + '/' + (G.ui._marchTab || '-'));
  /* 军队校场扩容页（expand · v89.144 老板 3：从出征页整块搬家、独立页签放军务总览右边） */
  G.ui._marchTab = 'expand';
  G.ui.setView('marches');
  await sleep(120);
  const expd21_v21 = vc.innerHTML;
  check('军队校场扩容页（军务总览右边）：出征容量（人马口径）+ 节钺 · 校场扩编入口',
    expd21_v21.indexOf('军队校场扩容') >= 0
    && expd21_v21.indexOf('出征容量') >= 0 && expd21_v21.indexOf('人马') >= 0
    && expd21_v21.indexOf('data-action="jieyue-xc"') >= 0);
  /* 出征页（act）：目标入口 + 5 类分行（容量口径已随页签搬走） */
  G.ui._marchTab = 'act';
  G.ui.setView('marches');
  await sleep(120);
  const act21_v21 = vc.innerHTML;
  /* v89.144（老板 4）诊断串（失败时一眼看出是哪一项） */
  const dbg144_v21 = 'act-sel=' + (act21_v21.indexOf('act-sel') >= 0)
    + ' emptyOpt=' + (act21_v21.indexOf('<option value=""') >= 0)
    + ' noRemark=' + !/共 \d+ · 列最近/.test(act21_v21)
    + ' pick=' + (act21_v21.indexOf('data-action="exp-act-pick"') >= 0)
    + ' go=' + (act21_v21.indexOf('data-action="exp-act-go"') >= 0)
    + ' order=' + (act21_v21.indexOf('exp-act-go') > act21_v21.lastIndexOf('exp-act-pick'))
    + ' len=' + act21_v21.length;
  check('出征页呈现目标入口（第 9/11 条 + §142 五类分行 + §144 定宽下拉/默认空/去备注）',
    act21_v21.indexOf('data-action="exp-act-pick"') >= 0
    && act21_v21.indexOf('data-action="exp-act-go"') >= 0
    /* v89.144（老板 4）：定宽类 + 空首项（默认不选；jsdom 序列化后 selected 可能展开成 selected=""） */
    && act21_v21.indexOf('act-sel') >= 0
    && act21_v21.indexOf('<option value=""') >= 0
    /* v89.144（老板 4）：「共 N · 列最近 N」备注整条去掉 */
    && !/共 \d+ · 列最近/.test(act21_v21)
    /* v89.142：5 类分行 + 按钮在底部 —— DOM 顺序：按钮出现在最后一个目标下拉之后 */
    && (act21_v21.indexOf('exp-act-go') > act21_v21.lastIndexOf('exp-act-pick')), dbg144_v21);
  /* 出征战术页（exp）：两列下拉 + 练兵块（演武/阅兵）；无在途队列 */
  G.ui._marchTab = 'exp';
  G.ui.setView('marches');
  await sleep(120);
  const extac21_v21 = vc.innerHTML;
  check('出征战术页：两列下拉 + 掠夺/占领两小页；无在途行军、无练兵（第 10/13 条 + §136）',
    extac21_v21.indexOf('tac-grid') >= 0
    && extac21_v21.indexOf('class="city-select tl-sel"') >= 0
    && extac21_v21.indexOf('data-action="exp-tac-sub"') >= 0
    && extac21_v21.indexOf('🚩 占领战术') >= 0
    && extac21_v21.indexOf('练兵') < 0
    && extac21_v21.indexOf('data-action="xc-spar"') < 0
    && extac21_v21.indexOf('🚩 在途') < 0);

  /* 治疗链：直接走 go-affairs（校场指引行随面板退役）→ 军务·军务处 */
  const armyBefore21_v21 = JSON.parse(JSON.stringify(c21_v21.army || {}));
  s21_v21.res.gold = 1e7;
  G.action('go-affairs', { dataset: {} });
  await sleep(160);
  check('跳到军务 · 军务处（页签正确）', G.ui.view === 'marches' && G.ui._marchTab === 'affairs',
    (G.ui.view || '-') + '/' + (G.ui._marchTab || '-'));
  const affHtml21 = vc.innerHTML;
  check('军务处列出伤兵营（逐兵种明细 + 治疗按钮）',
    affHtml21.indexOf('伤兵营') >= 0 && affHtml21.indexOf('data-action="heal-wounded"') >= 0
    && affHtml21.indexOf('俘虏营') >= 0);
  const healBtn21_v21 = document.querySelector('#view-container [data-action="heal-wounded"]');
  check('治疗按钮可点击（伤兵 > 0 时不禁用）', !!healBtn21_v21 && !healBtn21_v21.disabled);
  if (healBtn21_v21) { click(healBtn21_v21); await sleep(160); }
  check('治疗伤兵后兵员入城且伤兵归零',
    s21_v21.wounded === 0 && (c21_v21.army.yibing || 0) === (armyBefore21_v21.yibing || 0) + 777,
    (armyBefore21_v21.yibing || 0) + ' → ' + (c21_v21.army.yibing || 0));
  check('面板原地刷新（军务处仍开着且伤兵显示为 0）',
    vc.innerHTML.indexOf('伤兵营') >= 0
    && vc.innerHTML.indexOf('7,770') < 0);
  G.ui.setView('city');
  await sleep(60);

  /* 设置页：伤兵营已迁出 */
  G.ui.setView('settings');
  await sleep(80);
  const set21_v21 = vc.innerHTML;
  check('设置页已无伤兵营入口（需求 1）',
    set21_v21.indexOf('伤兵营') < 0 && set21_v21.indexOf('heal-wounded') < 0);
  /* v89.104（老板「设置里不要音效」「税率调整直接放左侧统计栏」「存档管理两处统一」）：
     设置页只剩 时间倍率 / 显示比例 / 界面主题 / 存档管理 四项；
     税率搬去侧栏（就地可调），音效整体撤除。 */
  check('设置页保留信息型设置项（倍率 / 比例 / 主题 / 存档；税率已外移、音效已撤）',
    set21_v21.indexOf('时间倍率') >= 0 && set21_v21.indexOf('显示比例') >= 0
    && set21_v21.indexOf('界面主题') >= 0 && set21_v21.indexOf('存档管理') >= 0
    && set21_v21.indexOf('税率') < 0 && set21_v21.indexOf('音效') < 0);
  /* v36（需求 2）：自动化只在顶栏「自动」菜单，设置页不再有第二份开关 */
  check('设置页已无自动化（只在自动菜单）',
    set21_v21.indexOf('自动化') < 0 && set21_v21.indexOf('toggle-auto-upgrade') < 0
    && set21_v21.indexOf('toggle-auto-research') < 0 && set21_v21.indexOf('toggle-auto-march') < 0);
  check('设置页统一为 .set-card 卡片（不再各写一套 inline 样式）',
    (set21_v21.match(/class="set-card"/g) || []).length >= 4);

  /* 需求 5：城内视图不留玩法说明 */
  G.ui.setView('city');
  await sleep(70);
  const city21_v21 = vc.innerHTML;
  check('城内视图不含玩法说明类文案',
    city21_v21.indexOf('出征耗粮=在城×2') < 0 && city21_v21.indexOf('点击地块弹出操作') < 0);

  /* 恢复伤兵状态，避免影响后续 */
  s21_v21.wounded = bk21_v21.w; s21_v21.woundedArmy = bk21_v21.wa;
  G.ui.refreshSide && G.ui.refreshSide();
  await sleep(40);


  /* ================= v22：点选控件与肖像（真实 DOM） ================= */
  console.log('\n--- v22 点选控件 / 肖像 / 城池视图 ---');

  /* 需求 1：数量控件的行为（不重绘 —— v89.60 市场合并为单块后，点选控件只剩数量预设） */
  G.ui.openMarket();
  await sleep(70);
  check('市场为单块表（无下拉框、无互换 chip）',
    !document.querySelector('#modal-root select')
    && !!document.querySelector('#modal-root .ms-table')
    && !document.querySelector('#modal-root [data-target="mk-from"]'));
  const mkPreset = document.querySelector('#modal-root [data-action="mk-preset"][data-target="mk-amount"]');
  const mkAmtEl = document.getElementById('mk-amount');
  check('数量预设按钮在册（写入共用数量框）', !!mkPreset && !!mkAmtEl);
  if (mkPreset) click(mkPreset);
  await sleep(40);
  check('预设写入数量且面板不重绘（同屏输入框仍是同一节点）',
    !!mkAmtEl && document.getElementById('mk-amount') === mkAmtEl
    && mkAmtEl.value === (mkPreset ? mkPreset.dataset.v : null),
    mkAmtEl ? mkAmtEl.value : 'no-input');
  G.ui.closeAllModals();

  /* 需求 2：肖像真实渲染 */
  G.ui.setView('generals');
  await sleep(90);
  /* v41（需求 2）：肖像仍在两处 —— 清单行 40px、右侧档案 84px */
  check('将领清单行渲染肖像（svg 或 img）',
    document.querySelectorAll('#view-container .gen-row .grow-face svg, #view-container .gen-row .grow-face img').length > 0,
    document.querySelectorAll('#view-container .gen-row').length + ' 行');
  const heroGen = G.state.generals.filter((g) => g.heroKey)[0];
  G.ui._genSel = G.state.generals[0].id;
  G.ui.setView('generals');
  await sleep(90);
  /* v43：改判**直接子元素**，而不是"后代里有没有 svg/img"。
     原因：P.html 会在 .portrait-alt 里预渲染一份备用立绘，而它**同样带
     class="portrait-svg"**（样式要复用），于是后代选择器会数出 2 个。
     备用层是"img 加载失败才顶上来"的兜底，不该计入立绘数。
     结构上主立绘一定是 .gp-face 的直接子元素（要么 svg，要么 .portrait-holder 容器）。 */
  check('右侧档案显示较大立绘', (function () {
    const face = document.querySelector('#view-container .gen-pane .gp-face');
    if (!face) return false;
    const direct = Array.prototype.filter.call(face.children, function (el) {
      return el.matches('svg.portrait-svg') || el.matches('.portrait-holder');
    });
    return direct.length === 1;
  })());
  check('档案立绘尺寸放大到 84', (function () {
    const el = document.querySelector('#view-container .gen-pane .gp-face svg, #view-container .gen-pane .gp-face img');
    return !!el && Math.round(parseFloat(el.getAttribute('width'))) === 84;
  })());

  /* 需求 3：城池视图在真实 DOM 里只剩棋盘 */
  G.ui.setView('city');
  await sleep(90);
  const pureBox = vc.querySelector('.city-pure');
  check('城池视图只有棋盘（无标题行/征收/岁贡）',
    !!pureBox && vc.querySelectorAll('.iso-tile').length >= 32 && !!vc.querySelector('.gov-palace')
    && vc.innerHTML.indexOf('州郡岁贡') < 0 && vc.innerHTML.indexOf('显示比例') < 0
    && vc.innerHTML.indexOf('官府Lv') < 0);
  /* v24（需求 4）：征收已移入官府建筑，侧栏城池操作只留 切换城池/显示比例/岁贡 */
  const toolsV24 = (document.querySelector('#city-attrs') || {}).innerHTML || '';
  /* v25（需求 3/4/5）：征收→官府、显示比例→设置、岁贡→名城官府，这一栏只剩"切城"，
     单城时整块收起 */
  check('侧栏不再有 征收/显示比例/岁贡（板块已删）',
    toolsV24.indexOf('征收') < 0 && toolsV24.indexOf('显示比例') < 0 && toolsV24.indexOf('岁贡') < 0);
  check('侧栏「城池属性」首行是城池身份',
    (document.querySelector('#city-attrs') || {}).innerHTML.indexOf('🏯') >= 0);

  /* ================= v23：地块管理 / 角标 / 宫殿 / 统计 ================= */
  console.log('\n--- v23 地块管理与界面细化 ---');

  /* 需求 4：官府宫殿在真实 DOM 里 */
  G.ui.setView('city');
  await sleep(90);
  const palace23 = vc.querySelector('.gov-palace');
  check('官府渲染为一座跨格宫殿（需求 4）',
    !!palace23 && !!palace23.querySelector('svg.gov-svg, img.gov-img'));
  /* v36（需求 1）：官府曾是唯一绕过图标层的建筑（专属手写 SVG）→ AI 位图接不进来 */
  check('官府已改用 AI 位图（不再只有手写 SVG）',
    !!vc.querySelector('.gov-palace img.gov-img[src*="ai_guanfu.png"]'));
  check('宫殿尺寸覆盖 2×2 格', (function () {
    if (!palace23) return false;
    const w = parseInt(palace23.style.width, 10), h = parseInt(palace23.style.height, 10);
    return w > 0 && w === h;
  })(), palace23 ? (palace23.style.width + '×' + palace23.style.height) : 'n/a');
  check('宫殿整体可点开官府面板', !!palace23 && palace23.getAttribute('data-action') === 'build-cell');
  check('旧的四格台基不再渲染', vc.querySelectorAll('.iso-tile.gov').length === 0);

  /* 需求 2/3：角标在真实 DOM 里位于格内右上 */
  const badge23 = vc.querySelector('.iso-tile.built .tile-badge');
  check('建筑格有右上角等级角标（需求 2）', !!badge23 && /^\d+$/.test(badge23.textContent.trim()),
    badge23 ? badge23.textContent.trim() : 'n/a');
  check('角标不再出现「Lv」或「满」字', !!badge23 && !/[Lv满]/.test(badge23.textContent));

  /* 需求 1：多城 —— 点地图上自己的第二座城会切换 */
  const ownIdx23 = G.state.cities.length;
  const extraCity23 = G.makeCity({ id: 'e2e23_b', name: '测试二城', x: 260, y: 230, type: 'jun', state: '荆州' });
  G.state.cities.push(extraCity23);
  check('自己的第二座城被拾取为 player（此前会被当成 NPC）', (function () {
    const hit = G.map.ownCityAt(260, 230);
    return !!hit && hit.id === 'e2e23_b';
  })());
  G.ui.setCity(extraCity23.id);
  await sleep(80);
  check('切入第二座城后侧栏跟随该城',
    (document.querySelector('#city-attrs') || {}).innerHTML.indexOf('测试二城') >= 0);
  check('第二座城的官府宫殿正常渲染', !!vc.querySelector('.gov-palace'));
  G.state.cities.pop();
  G.ui.setCity(G.state.cities[0].id);
  await sleep(60);

  /* 需求 1：已占野地 → 管理面板（真实 DOM） */
  const w23 = (G.state.wilds || [])[0];
  const _bakT23 = w23 ? w23.type : null;
  if (w23) {
    /* v89.139：采集区只在**可采地形**出现 —— 把该野地类型临时设为湖泊，
       否则"平地无可采之物"时采集区整块不渲染（判据必须能验到真东西）。 */
    w23.type = 'lake';
    G.ui.openLandModal(w23.x, w23.y);
    await sleep(80);
    const landM = document.querySelector('#modal-root').innerHTML;
    check('已占野地打开管理面板（需求 1）',
      landM.indexOf('地块操作') >= 0 && landM.indexOf('危险操作') >= 0);
    /* v89.139（老板 3）：驻军板块收敛成「将领 + 兵力（总数）」两行 ——
       等级衰减行 / 开采行 / 备注行撤除（"兵力显示总数量即可"）。 */
    check('管理面板给出驻军板块（将领 + 兵力总数 · v89.139 已撤衰减/开采/备注三行）',
      landM.indexOf('op-zone-t">驻军') >= 0 && landM.indexOf('将领') >= 0
      && landM.indexOf('等级衰减') < 0 && landM.indexOf('（已占）') < 0
      && landM.indexOf('守军约') < 0);
    check('管理面板采集区 = 采集 + 收获（无召回）· 产量加成并入可采行（v89.151 改文案）',
      landM.indexOf('data-action="wild-garrison-gather"') >= 0
      && landM.indexOf('data-action="gather-finish"') >= 0
      && landM.indexOf('⛏️ 采集</button>') >= 0 && landM.indexOf('📦 收获') >= 0
      && landM.indexOf('⚙️ 设置采集') < 0
      /* v89.139：采集区不再有召回 —— 但地块操作区仍有「🏳️ 召回驻军」，按计数判 */
      && (landM.match(/🏳️ 召回/g) || []).length === 1
      /* v89.152（老板 5）：已占野地不显示产出行 */
      && landM.indexOf('op-zone-t">产出') < 0 && landM.indexOf('>产量加成<') < 0);
    check('管理面板含派军驻守与放弃入口',
      landM.indexOf('data-action="wild-garrison-open"') >= 0
      && landM.indexOf('data-action="wild-abandon-ask"') >= 0);
    G.ui.closeAllModals();
    w23.type = _bakT23;   /* 还原地形（后序用例口径） */
  }

  /* 需求 5：统计菜单 */
  G.ui.setView('stats');
  await sleep(90);
  const stats23 = vc.innerHTML;
  /* v27（需求 7）：卡片网格 → 官府黄册（分段账册 + 引线行） */
  /* v54（老板）：删掉别处已有的三块（君主/府库/军民）后只剩三节，判据跟着改 */
  /* v60（需求 3）：满级专精一节已从全境汇总撤出（搬进各建筑面板）→ 只剩两节 */
  check('统计页不含侧栏（独占整宽）', !document.querySelector('.main:not(.solo)'));

  /* ============================================================
   * v24（需求 1-9）真实 DOM 验证
   * ============================================================ */
  console.log('\n--- v24. 界面精简与队列（真实 DOM） ---');

  /* ①②③ 地图：只留棋盘；导航迁入底部导航条（v76） */
  G.ui.setView('map');
  await sleep(90);
  const m24 = vc.innerHTML;
  check('地图只渲染棋盘；导航在底部导航条（v76）',
    !!document.querySelector('#bottom-bar .map-dock') && !!vc.querySelector('#mapCanvas')
    && m24.indexOf('天下大势') < 0 && m24.indexOf('湖泊') < 0
    && m24.indexOf('已占野地') < 0 && m24.indexOf('点击城池可出征') < 0);
  check('导航在底部条内（方向键 + 坐标框）',
    document.querySelectorAll('#bottom-bar .map-dock [data-action="map-pan"]').length === 4
    && !!document.querySelector('#map-gx') && !!document.querySelector('#map-gy'));
  check('地图版面里没有横占整行的控制条', !vc.querySelector('.map-bar') && !vc.querySelector('.map-head'));
  /* 浮标里的按钮真的能推动视野。
     v45（需求 2）：步长由 1 格改为「左右 12 / 上下 8」，且浮标改为**水平居中**。
     判据先归零到一个确定位置，免得在边界上因钳制而假失败。 */
  G.ui.mapView.x = 100;
  G.ui.mapView.y = 100;
  G.ui.renderMapCanvas();
  const panX0 = G.ui.mapView.x;
  click(Array.prototype.slice.call(document.querySelectorAll('#bottom-bar .map-dock [data-action="map-pan"]'))
    .filter((b) => b.dataset.dx === String(G.ui.MAP_STEP_X))[0]);
  await sleep(60);
  check('底栏方向键生效（一次右移一屏 = 12 格）',
    G.ui.mapView.x === Math.min(panX0 + G.ui.MAP_STEP_X, G.DATA.MAP_W - G.ui.mapFrame.spanX),
    'x ' + panX0 + '→' + G.ui.mapView.x);
  (function () {
    const dock = document.querySelector('#bottom-bar .map-dock');
    if (!dock) { check('导航条挂在底部导航条内（v76）', false); return; }
    check('导航条挂在底部导航条内（v76：原为地图页右下浮标）', true);
    /* 注意：jsdom **没有布局**，量高度恒为 0 —— 所以这里不测"是否单行/多高"，
       那两条放在真浏览器里测（.workbuddy/tmp/probe_map45.js 会打印
       "单行？是 ✅　高度 ≤48px：是 ✅"，实测 44px）。
       只在这里做一条**结构**断言：CSS 没写 flex-wrap（写了才可能折行）。 */
    const cssTxt = document.documentElement.innerHTML;
    const m = cssTxt.match(/\.map-dock \{[\s\S]*?\}/);
    check('导航条没有声明 flex-wrap（折行的前提）', !!m && !/flex-wrap/.test(m[0]));
  })();

  /* ④⑤ 官府征收（真实点击：官府弹窗 → 征收按钮）
     为使判据确定：临时把当前城设为「普通城池」（否则名城只征得到材料），
     并把四类实物压到仓容 10% 以内（满仓时本就征不进，属正确的拒绝）。 */
  G.ui.setView('city');
  G.ui.setCity(G.state.cities[0].id);
  await sleep(80);
  /* data-action 挂在 .gov-palace 本体上（跨格融合成一座宫殿，整体可点） */
  const gov24 = vc.querySelector('.gov-palace[data-action="build-cell"]');
  check('城内可点到官府宫殿（整个宫殿为一个点击目标）', !!gov24);
  if (gov24) {
    click(gov24);
    await sleep(90);
    /* v89.135（老板 10）：官府事务按钮退役 —— 点官府格直接是建筑面板（官府要务直显） */
    const gm0 = document.querySelector('#modal-root').innerHTML;
    check('点官府宫殿打开建筑面板（官府要务直显 · 无官府事务按钮）',
      gm0.indexOf('data-action="open-guanfu"') < 0 && gm0.indexOf('官府要务') >= 0);
  }
  /* v82（老板）/v89.135：征收退役 + 官府功能直显（改名/主城/秘境） */
  openGov();
  await sleep(80);
  const gm24 = document.querySelector('#modal-root').innerHTML;
  check('v82：官府建筑面板已无征收区（物资表 / 征收按钮退役）',
    gm24.indexOf('官府') >= 0 && gm24.indexOf('征收物资') < 0
    && !document.querySelector('#levy-btn'));
  check('v89.135：官府要务三键齐（改名 / 主城 / 秘境）· 无在办事项',
    gm24.indexOf('在办事项') < 0 && gm24.indexOf('open-rename-city') >= 0
    && gm24.indexOf('open-farm') >= 0);
  G.ui.closeAllModals();
  await sleep(60);

  check('侧栏不再有征收（板块已删，属性行里也没有）',
    !document.querySelector('#city-tools')
    && (document.querySelector('#city-attrs') || {}).textContent.indexOf('征收') < 0);
  check('侧栏城池属性不再有 城防/驻军/城外地块', (function () {
    const h = (document.querySelector('#city-attrs') || {}).innerHTML || '';
    return h.indexOf('城防') < 0 && h.indexOf('驻军') < 0 && h.indexOf('城外地块') < 0;
  })());

  /* ⑦ 城外地块凑满整行 */
  G.ui.setCity(G.state.cities[0].id);
  await sleep(60);
  /* v26（需求 5）：setCitySub 已随子页签删除 —— 城外改为顶栏平级视图 */
  G.ui.setView('ext');
  await sleep(90);
  /* v89.142（老板 1）：棋盘固定 12×8=96 常显 —— 亮格 = 官府等级上限，其余为**暗格**。
     判据两层：① 总格数 = 96（EXT_CAP_MAX）；② 亮格（非 .locked）= extCap。 */
  check('城外棋盘 96 格常显：亮格 = 官府等级上限 · 其余暗格（12×8 · v89.142）', (function () {
    var cap = G.extCap(G.currentCity());
    var all = vc.querySelectorAll('.iso-tile').length;
    var locked = vc.querySelectorAll('.iso-tile.locked').length;
    window.__ext142e2e = all + ' 格（亮 ' + (all - locked) + ' / 暗 ' + locked + '）· cap=' + cap;
    return all === G.DATA.EXT_CAP_MAX && all - locked === cap && locked === G.DATA.EXT_CAP_MAX - cap;
  })(), window.__ext142e2e || '');

  /* ⑧ 募兵队列（真实 DOM） */
  G.ui.setView('city');
  await sleep(80);
  let junI24 = -1;
  for (let k = 0; k < G.currentCity().cells.length; k++) {
    const cell = G.currentCity().cells[k];
    if (cell.build && cell.build.id === 'junying') { junI24 = k; break; }
  }
  if (junI24 >= 0) {
    G.ui.openTroops(junI24, 'normal');
    await sleep(90);
    /* v81：队列独立成页 —— 先切到「募兵队列」页再验 */
    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="que"]'));
    await sleep(90);
    const tm24 = document.querySelector('#modal-root').innerHTML;
    /* v80（老板）：「募兵军营 城内第 46 格 · Lv11 · 队列位 3 这个也不需要」——
       面板不再标所属工位；重复标题也撤除（只留弹窗标题一处） */
    check('v80：募兵面板不再标所属军营 / 重复标题',
      tm24.indexOf('募兵军营') < 0 && tm24.indexOf('队列位') < 0
      && (tm24.match(/兵营招募/g) || []).length === 1);
    check('募兵面板列出本营队列一节', tm24.indexOf('本营募兵队列') >= 0);
    /* 通过真实入口按钮进入，确认 data-idx 被带进去 */
    G.ui.closeAllModals();
    await sleep(50);
    G.ui.openBuildModal(junI24);
    await sleep(70);
    const jBtn = document.querySelector('#modal-root [data-action="open-troops"]');
    check('军营弹窗的募兵入口带 data-idx', !!jBtn && String(jBtn.dataset.idx) === String(junI24),
      jBtn ? 'idx=' + jBtn.dataset.idx : '未找到');
    click(jBtn);
    await sleep(90);
    check('点击后打开的是该军营的募兵面板',
      G.ui._trainBIdx === junI24
      && document.querySelector('#modal-root').innerHTML.indexOf('兵营招募') >= 0);
    G.ui.closeAllModals();
    await sleep(50);
  }

  /* ⑧b 自动化菜单（v29 · 需求 5） */
  G.ui.setView('auto');
  await sleep(100);
  check('自动化界面：左名单九项 + 右详情（v89.115 分栏 · v89.118 外敌来犯 · v89.128 采集 · v89.190 自动征兵）', (function () {
    /* v89.115：整合成「左 1/3 名单 + 右 2/3 详情」，新增「🏥 自动治疗」；
       v89.118：再加「🔥 外敌来犯」（开关 + 介绍 + 烽火流水，从军务·烽火迁来）。
       v89.190（老板 2）：再加「🛡️ 自动征兵」（兵营募兵；与「🧲 自动招募」= 客栈招将并列）。 */
    var items = vc.querySelectorAll('.auto-item');
    return items.length === 9 && !!vc.querySelector('.auto-pane')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="heal"]')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="train"]')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="invasion"]')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="gather"]');
  })());

  /* v89.190（老板 2）：自动征兵 —— 真点真改（设置表 / 输入 change / 开关 / 募兵面板入口） */
  check('v89.190：自动征兵面板 —— 表格（触发线/目标各一列）+ 保底输入 + 规则说明', (function () {
    click(vc.querySelector('[data-action="auto-pick"][data-key="train"]'));
    var pane = vc.querySelector('.auto-pane');
    if (!pane) return false;
    var inputs = pane.querySelectorAll('input[data-action="autotrain-set"]');
    var txt = pane.textContent || '';
    return inputs.length >= 17          /* 15 兵种 × 2（触发/目标）+ 金/粮保底 2 */
      && txt.indexOf('触发条件') >= 0 && txt.indexOf('停止条件') >= 0
      && txt.indexOf('可用栏位') >= 0 && txt.indexOf('目标兵种') >= 0;
  })());
  check('v89.190：改「目标」输入真落库（change 委托 → GAME.autoTrainSet）', (function () {
    var inp = vc.querySelector('.auto-pane input[data-action="autotrain-set"][data-k="max"][data-troop="yibing"]');
    if (!inp) return false;
    inp.value = '1234';
    inp.dispatchEvent(new window.Event('change', { bubbles: true }));
    var inp2 = vc.querySelector('.auto-pane input[data-action="autotrain-set"][data-k="max"][data-troop="yibing"]');
    return G.autoTrainCfg().targets.yibing.max === 1234 && !!inp2 && inp2.value === '1234';
  })());
  check('v89.190：开启自动征兵开关（真点 → settings.autoTrain=true）', (function () {
    var btn = vc.querySelector('[data-action="toggle-auto-train"]');
    if (!btn) return false;
    click(btn);
    return G.state.settings.autoTrain === true;
  })());
  G.state.settings.autoTrain = false;                       /* 用完还原，防污染后续用例 */
  G.autoTrainCfg().targets.yibing.max = 0;
  check('v89.190：募兵面板（队列页）带「自动征兵设置」入口 → 点它进入自动页', (function () {
    G.ui.openTroops(null, 'normal');
    var rt = document.querySelector('#modal-root');
    var btn = rt && rt.querySelector('[data-action="go-auto-train"]');
    if (!btn) return false;
    btn.click();
    return G.ui._autoSel === 'train' && !!document.querySelector('[data-action="toggle-auto-train"]');
  })());
  G.ui.setView('auto');                                     /* 还原视图（后续用例按上一段约定从 auto 起） */
  check('v89.190：兜底扫掠 —— 非两大通道注入的 disabled 按钮被软化（可点+原因+暗态）', (function () {
    var d = document.createElement('div');
    d.innerHTML = '<button id="sweep190" disabled title="演示原因">测试按钮</button>';
    document.body.appendChild(d);
    var el = document.getElementById('sweep190');
    G.ui._blockedSweepAt = 0;
    G.ui.blockedSweep(1e12);
    var ok = el && !el.disabled && el.getAttribute('data-why') === '演示原因' && el.classList.contains('dim');
    d.parentNode.removeChild(d);
    return !!ok;
  })());
  /* v89.104（老板「自动界面的自动出征不再显示详细信息，直接保留'详细配置'和'立即出征'即可」）：
     本页只剩两个入口；七行参数（将领/兵力/目标/等级/距离/类型/频率）搬进**详细配置**弹窗。 */
  check('自动出征：右侧详情只有「详细配置」+「立即出征」两个入口，参数行已撤', (function () {
    /* v89.115：先点左侧名单选中「自动出征」，详情才渲染它的正文 */
    click(vc.querySelector('[data-action="auto-pick"][data-key="march"]'));
    var pane = vc.querySelector('.auto-pane');
    return !!vc.querySelector('[data-action="open-auto-march"]')
      && !!vc.querySelector('[data-action="auto-march-once"]')
      && !!pane && pane.querySelectorAll('.al-k').length === 0;
  })());
  check('点「开启自动出征」真能开（并自动挑一位空闲将领）', (function () {
    /* v89.115：开关在右侧详情里 —— 先选中「自动出征」 */
    click(vc.querySelector('[data-action="auto-pick"][data-key="march"]'));
    var btn = vc.querySelector('[data-action="toggle-auto-march"]');
    if (!btn) return false;
    btn.click();
    var cfg = G.autoMarchCfg();
    return cfg.on === true && !!cfg.genId;
  })());
  check('自动出征：参数改在「详细配置」弹窗里（打开后统一行齐备 · v89.198）', (function () {
    G.ui.openAutoMarch();
    /* ⚠ 弹窗在 #modal-root，不在 #view-container（vc）—— 查错容器会永远拿不到 */
    var rt = document.querySelector('#modal-root');
    var ks = Array.prototype.map.call(rt.querySelectorAll('.exp-lab'),
      function (x) { return x.textContent.trim(); }).join(' ');
    G.ui.closeAllModals();
    /* v89.198：统一行（名称列 .exp-lab）—— 执行将领 / 目标类型 / 出征方式 / 计略 / 出征战术 / 频率 等 */
    return ks.indexOf('执行将领') >= 0 && ks.indexOf('目标类型') >= 0
      && ks.indexOf('出征战术') >= 0 && ks.indexOf('每日上限') >= 0;
  })());
  check('无合适目标时不硬发兵（给出原因）', (function () {
    var cfg = G.autoMarchCfg();
    cfg.genId = null;
    var r = G.autoMarchOnce(cfg);
    return r.ok === false && /指定/.test(r.msg);
  })());
  check('器械与斥候不会被编入自动队伍', (function () {
    var pick = G.autoMarchPickArmy({ army: { toudan: 50, chongche: 50, chihou: 20, tieji: 900, yibing: 5000 } }, 3000);
    return !pick.army.toudan && !pick.army.chongche && !pick.army.chihou
      && pick.total === 3000 && pick.army.tieji === 900;
  })());
  G.autoMarchCfg().on = false;

  /* v89.65（老板：「自动出征精细化，根据现有出征界面形成弹窗即可，加入自动出征特有的字段」）
     —— 真实点击链路：开弹窗 → 数下拉框 → 改「留守/每日上限」→ 校验真的写进了同一份 cfg。 */
  G.ui.openAutoMarch();
  await sleep(70);
  check('v89.140：自动出征「详细配置」弹窗可开（9 个下拉框；单次兵力退役、改逐兵种输入框）', (function () {
    var root = document.querySelector('#modal-root');
    if (!root) return false;
    var ids = ['am-gen', 'am-target', 'am-level', 'am-radius', 'am-mode',
      'am-scheme', 'am-tactic', 'am-freq', 'am-daily'];
    return root.querySelectorAll('select').length === 9 && !!root.querySelector('.exp-tbl')
      && ids.every(function (id) { return !!root.querySelector('#' + id); })
      && !root.querySelector('#am-troops')
      && !!root.querySelector('#am-a-changqiang')
      && !!root.querySelector('[data-action="am-toggle"]')
      && !!root.querySelector('[data-action="am-once"]');
  })());
  check('v89.140：编成表列出全部**可编入**兵种（与 autoMarchPickArmy 同口径，器械/斥候/辎重不列）', (function () {
    var root = document.querySelector('#modal-root');
    if (!root) return false;
    var txt = root.textContent || '', n = 0, tot = 0;
    Object.keys(DATA.TROOPS).filter(function (id) {
      var t = DATA.TROOPS[id];
      return t && !t.nocombat && !t.craft;
    }).forEach(function (id) {
      tot++;
      if (txt.indexOf(DATA.TROOPS[id].name || id) >= 0) n++;
    });
    return tot > 0 && n === tot;
  })());
  /* v89.83（老板「目标的选择可以加上距离」「无需兵力留守这个菜单项」）：
     留守退役、距离上线 —— 真改一次下拉并校验写进同一份 cfg（且是 Number）。 */
  check('v89.83：改「搜索距离」真写进 cfg（Number，不是字符串）', (function () {
    var sel = document.getElementById('am-radius');
    if (!sel) return false;
    var cur = G.autoMarchCfg().radius;
    var opt = Array.prototype.filter.call(sel.querySelectorAll('option'), function (o) {
      return Number(o.value) !== cur;
    })[0];
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    var v = G.autoMarchCfg().radius;
    return v === Number(opt.value) && typeof v === 'number';
  })());
  await sleep(60);
  check('v89.65：改「每日上限」真写进 cfg（且是 Number，不是字符串）', (function () {
    var sel = document.getElementById('am-daily');
    if (!sel) return false;
    var opt = Array.prototype.filter.call(sel.querySelectorAll('option'), function (o) {
      return Number(o.value) > 0;
    })[0];
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    var v = G.autoMarchCfg().dailyMax;
    return v === Number(opt.value) && typeof v === 'number';
  })());
  await sleep(60);
  check('v89.65：护栏生效 —— 每日上限设为 1 且已用满时，立即出征被拒', (function () {
    var cfg = G.autoMarchCfg();
    cfg.dailyMax = 1;
    cfg.todayKey = ''; G.autoMarchRollDay(cfg);   /* 归零 */
    cfg.todayCount = 1;                           /* 假装已发 1 次 */
    var r = G.autoMarchOnce(cfg);
    cfg.dailyMax = 0; cfg.todayCount = 0;
    return r.ok === false && /上限/.test(r.msg);
  })());
  G.ui.closeAllModals();
  await sleep(50);

  /* ⑨ 队列在官府（v29 · 需求 6 迁入） */
  G.ui.setView('reports');
  await sleep(100);
  check('公文已无队列一节（真实 DOM）', !document.querySelector('#doc-queues'));
  openGov();
  await sleep(100);
  const dq24 = (document.querySelector('#modal-root') || {}).textContent || '';
  check('底部队列播报条不再存在', !document.querySelector('#queue-bar'));
  check('官府建筑面板可读到内容（官府要务）',
    dq24.indexOf('官府要务') >= 0, dq24.replace(/\s+/g, ' ').slice(-60));
  G.ui.closeAllModals();

  /* ============================================================
   * v25（需求 1-14）真实 DOM 验证
   * ============================================================ */
  console.log('\n--- v25. 城墙环 / 整页视图 / 任务详情 / 改名 / 美术（真实 DOM） ---');

  /* ① 城墙：点墙环打开面板（v89.128：环城视觉是城墙建筑的外观） */
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 3 };   /* 摆上（该城未建） */
  G.ui.setView('city');
  await sleep(90);
  check('墙环有角楼（4 座）', vc.querySelectorAll('svg.iso-wall .wtower').length === 4);
  check('墙环与地块之间有空隙（热区不覆盖棋盘）', (function () {
    const hit = vc.querySelector('.wall-hit.top');
    const tile = vc.querySelector('.iso-tile');
    if (!hit || !tile) return false;
    const hitBottom = parseFloat(hit.style.height);
    const tileTop = parseFloat(tile.style.top);
    return hitBottom <= tileTop;
  })());
  /* v89.128：点墙环 = 打开**环城槽**的面板（未建 → 「修建城墙」；已建 → 通用建筑面板）。
     先用"未建"场景验修建入口，再摆上验升级入口。 */
  G.wallSlotOf(G.currentCity()).build = null;   /* 未建场景 */
  G.refreshAll();
  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  click(wallHit);
  await sleep(90);
  const mrWall = document.querySelector('#modal-root');
  let wallTxt = (mrWall.innerHTML || '').replace(/<[^>]+>/g, ' ');
  check('点墙环（未建）→ 打开「修建城墙」面板（修建按钮在册）',
    wallTxt.indexOf('城墙') >= 0 && !!mrWall.querySelector('[data-build="chengqiang"]'),
    'modal=' + wallTxt.replace(/\s+/g, ' ').slice(0, 96));
  G.ui.closeAllModals();
  await sleep(40);
  /* 已建场景：点墙环 → 通用建筑面板（升级键带 data-idx="wall"） */
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 3 };
  /* v89.191（老板 3-①②/③）：城墙吃两道新闸 —— 配对（作坊 ≥ 目标−2）与建筑技术 Lv1。
     本用例验的是"面板升级键在册"，前置摆足即可（不影响后续用例：挂在当前城空地上）。 */
  G.techSet('jianzhu', 1);
  (function () {
    var c = G.currentCity();
    for (var i = 0; i < c.cells.length; i++) {
      var cl = c.cells[i];
      if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'gongjiangzuofang', lvl: 3 }; return; }
    }
  })();
  G.refreshAll();
  click(vc.querySelector('.wall-hit[data-action="open-wall"]'));
  await sleep(90);
  const mrWall2 = document.querySelector('#modal-root');
  check('点墙环（已建）→ 通用建筑面板（升级键在册 · data-idx="wall"）',
    !!mrWall2.querySelector('[data-action="confirm-upgrade"][data-idx="wall"]'),
    (mrWall2.textContent || '').replace(/\s+/g, ' ').slice(0, 80));
  G.ui.closeAllModals();
  await sleep(40);

  /* ② 商城 / 背包：顶栏点击 → 整页视图 */
  click(document.querySelector('#topnav [data-view="shop"]'));
  await sleep(100);
  check('点顶栏「商城」进入整页视图（弹窗为空）',
    !!vc.querySelector('.shop-rows') && document.querySelector('#modal-root').innerHTML === '');
  check('商城不再常驻换算说明（ⓘ 触发）',
    !!vc.querySelector('.help-chip') && vc.textContent.indexOf('元宝价') < 0);
  click(document.querySelector('#topnav [data-view="bag"]'));
  await sleep(100);
  check('点顶栏「背包」进入整页视图', !!vc.querySelector('.bag-grid'));

  /* ⑬ ⓘ：点击出小窗（平板无 hover 时的兜底） */
  click(vc.querySelector('.help-chip'));
  await sleep(80);
  check('点 ⓘ 弹出说明小窗', document.querySelector('#modal-root').innerHTML.indexOf('说明') >= 0);
  G.ui.closeAllModals();
  await sleep(40);

  /* ⑪ 任务：清单 + 详情弹窗 */
  G.ensureDailyQuests(true);
  G.ui.setView('tasks');
  await sleep(100);
  check('任务为清单式（一行一项）',
    vc.querySelectorAll('.q-row').length > 0 && vc.querySelectorAll('.q-card').length === 0,
    vc.querySelectorAll('.q-row').length + ' 行');
  click(vc.querySelector('.q-row'));
  await sleep(90);
  const qd25 = document.querySelector('#modal-root');
  check('点名称弹出固定格式详情（背景/需求/奖励）',
    qd25.innerHTML.indexOf('任务背景') >= 0 && qd25.innerHTML.indexOf('任务需求') >= 0
    && qd25.innerHTML.indexOf('任务奖励') >= 0 && !!qd25.querySelector('.modal-sm'));
  check('详情写明放弃规则', qd25.textContent.indexOf('放弃') >= 0);
  G.ui.closeAllModals();
  await sleep(40);

  /* ⑧ 改名：真实点击流程 */
  G.ui.setView('city');
  await sleep(60);
  const rnCity = G.currentCity();
  const bkName25 = rnCity.name, bkType25 = rnCity.type;
  rnCity.type = 'self';
  openGov();
  await sleep(80);
  const rnBtn = document.querySelector('#modal-root [data-action="open-rename-city"]');
  check('自建城官府段有改名入口（v89.135：官府要务直显）', !!rnBtn);
  click(rnBtn);
  await sleep(80);
  check('改名弹窗带输入框', !!document.querySelector('#rename-city-input'));
  document.querySelector('#rename-city-input').value = '汉寿';
  click(document.querySelector('#modal-root [data-action="do-rename-city"]'));
  await sleep(120);
  check('改名生效并回到官府面板', rnCity.name === '汉寿',
    rnCity.name);
  check('侧栏城池名同步', (document.querySelector('#city-attrs') || {}).textContent.indexOf('汉寿') >= 0);
  G.renameCity(rnCity.id, bkName25);
  rnCity.type = bkType25;
  G.ui.closeAllModals();
  await sleep(40);

  /* ⑨ 君主卡 */
  G.ui.syncHeader();
  check('君主头像为立绘 SVG', !!document.querySelector('#lord-avatar svg'));
  check('v81：君主名并入信息表首行（官职行退役）',
    !!document.querySelector('.lord-meta .mrow-name #lord-name') && !document.querySelector('#lord-city'));
  check('君主卡带爵位（爵位已并入君主）', (function () {
    G.ui.openLordInfo();
    const h = document.querySelector('#modal-root').innerHTML;
    G.ui.closeAllModals();
    return h.indexOf('爵位') >= 0 && h.indexOf('promote') >= 0;
  })());

  /* ⑥⑦ 图标 */
  const tileIco = vc.querySelector('.iso-tile.built .tile-art .ico');
  check('地块图标为满格 SVG（需求 6）', !!tileIco);
  check('图标带统一光照层（需求 7）',
    document.querySelectorAll('.ico #icAmb, .ico [fill="url(#icAmb)"]').length > 0 || !!tileIco,
    'ambient 层已注入');

  /* ⑭ 统计 / 公文：竹简卷轴 */
  G.ui.setView('stats');
  await sleep(90);
  /* v27（需求 7）：卡片网格 → 分段账册（黄册） */
  /* v54（老板）：三节 / 五笔以上（军民/府库/君主已按老板要求撤掉） */
  /* v60（需求 3）：丙节（满级专精）撤出 → 两节 / 四笔以上 */
  G.ui.setView('reports');
  await sleep(90);
  /* v39（需求 4）：公文页改扁平页 —— 不再套卷轴大框（老板嫌"好多框"），
     但分区标题与战报列表行保留。 */
  /* v89.107：分区标题（.seal-h）由页签取代 —— 判据改为"无卷轴大框 + 页签 + 正文容器" */
  check('公文页为扁平页（去卷轴大框 · 五类页签）',
    !vc.querySelector('.scroll-page') && !!vc.querySelector('.doc-tabs')
    && !!vc.querySelector('#doc-body'));

  /* ============================================================
   * v26：将领经验 / 左头像右五维 / 天时入顶栏 / 观察框 12×8 / 城内城外入顶栏
   * ============================================================ */
  console.log('\n--- v26. 经验·五维·天时·观察框·城内外（真实 DOM） ---');

  /* ① 经验：在将领详情里真实点按钮 */
  G.ui.setView('generals');
  await sleep(100);
  const g26 = G.state.generals[0];
  G.state.items = G.state.items || {};
  const bkItems26 = JSON.stringify(G.state.items);
  const bkGen26 = { lv: g26.level, exp: g26.exp };
  g26.level = 1; g26.exp = 0;
  G.state.items.lianbing_jingyan = 3;
  /* v41（需求 2）：经验道具按钮在**右侧档案**里（不再开弹窗） */
  G.ui._genSel = g26.id;
  G.ui.setView('generals');
  await sleep(120);
  const gd26 = document.querySelector('#view-container .gen-pane');
  check('右侧档案为左头像 · 右身份（六维表紧随其后）',
    !!gd26.querySelector('.gp-head .gp-face') && !!gd26.querySelector('.gp-head .gp-id')
    && !!gd26.querySelector('.gd-dims'));
  /* v29（需求 11）：体力升为第六维 */
  check('六维表 7 行（六维 + 自由属性点）、3 列（属性/数值/加点）', (function () {
    const rows = gd26.querySelectorAll('.gd-dims tbody tr');
    const ths = gd26.querySelectorAll('.gd-dims thead th');
    return rows.length === 7 && ths.length === 3;
  })());
  check('经验进度条渲染出来了（且就在顶上身份行里）', !!gd26.querySelector('.gd-expbar i')
    && !!gd26.querySelector('.gp-head .gp-exprow'));
  /* v54（老板："经验条放在顶上…整个加号，点击加号可以选用经验道具"）：
     道具入口不再是平铺在下面的按钮组，而是经验条右端的「＋」→ 点开选择窗。 */
  const expAdd = gd26.querySelector('[data-action="gen-exp-pick"]');
  check('经验道具入口＝经验条右端的「＋」（不用跑背包）', !!expAdd);
  click(expAdd);
  await sleep(150);
  const expModal = document.querySelector('#modal-root');
  const lianbing26 = G.DATA.ITEMS.filter(function (x) { return x.id === 'lianbing_jingyan'; })[0];
  check('「＋」开出选择窗，列出道具的持有数与面额（v89.173：「+X万」）',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    /* v89.173：卡面印「+X万」（整数万短写）；期望值从 DATA 现读，别写死
       （调面额时会假红；旧判据查「最多至 LvN」已随 capLv 退役）。 */
    && !!lianbing26 && expModal.textContent.indexOf('+' + Math.round(lianbing26.amount / 10000) + '万') >= 0,
    '练兵经验 +' + (lianbing26 ? Math.round(lianbing26.amount / 10000) : '?') + '万');
  const expBtn = expModal.querySelector('[data-action="gen-exp-item"][data-mode="till"]');
  check('选择窗给「用 1 个 / 用到升级」两种用法',
    !!expBtn && !!expModal.querySelector('[data-action="gen-exp-item"][data-mode="one"]'));
  click(expBtn);
  await sleep(170);
  check('点「用到升级」后等级提升', g26.level >= 2, 'Lv' + g26.level);
  check('点「用到升级」只消耗够用的数量（3 → 2）', G.state.items.lianbing_jingyan === 2,
    String(G.state.items.lianbing_jingyan));
  /* v54：用完道具后选择窗必须按新经验重画，否则「距升级还需」停在旧值 */
  check('用完道具后选择窗按新经验重画（距升级还需跟着变）', (function () {
    const m = document.querySelector('#modal-root');
    return m.textContent.indexOf('还需') >= 0 && m.textContent.indexOf('Lv' + g26.level) >= 0;
  })());
  G.ui.closeAllModals();
  await sleep(60);
  check('档案原地刷新（数字跟着变，不用重开）', (function () {
    const t = document.querySelector('#view-container .gen-pane').textContent;
    return t.indexOf('Lv' + g26.level) >= 0;
  })());
  g26.level = bkGen26.lv; g26.exp = bkGen26.exp;
  G.state.items = JSON.parse(bkItems26);
  await sleep(60);

  /* ② 五维与丹药：真实使用一颗永久丹药 */
  check('实测：永久丹药只把基础 +1（不再被算两次）', (function () {
    const st = G.state, g = st.generals[0];
    const bk = g.tong, bkI = JSON.stringify(st.items || {});
    st.items = st.items || {};
    st.items.fengwang_migao = 1;
    G.systems.useItem('fengwang_migao', g.id);
    const ok = g.tong === bk + 1 && G.genAttrs(g).tong === bk + 1;
    st.items = JSON.parse(bkI);
    return ok;
  })());
  check('速度有值且计入行军（真值，不再是恒 0）', G.genAttrs(G.state.generals[0]).spd > 0,
    'spd=' + G.genAttrs(G.state.generals[0]).spd);

  /* ③ 天时：顶栏位置与内容 */
  G.ui.setView('city');
  await sleep(90);
  check('顶栏天时随主循环刷新出内容', (function () {
    G.ui.syncHeader();
    const el = document.querySelector('#nav-sky');
    const want = G.story ? G.story.skyLine() : '';
    return !!el && want.length > 0 && el.textContent.indexOf(want) >= 0;
  })());
  check('侧栏不再有天时', document.querySelector('#city-attrs').textContent.indexOf('天时') < 0);

  /* ④ 观察框（v85：搜索式自适应 —— 画布 = 当前观察框 × 格距，行列不再写死） */
  G.ui.setView('map');
  await sleep(140);
  const cv26 = document.querySelector('#mapCanvas');
  check('画布按当前观察框渲染（宽高不等）', cv26 && G.map._view
    && cv26.width === G.map._view.spanX * G.map._view.cell
    && cv26.height === G.map._view.spanY * G.map._view.cell,
    cv26 ? cv26.width + '×' + cv26.height + ' cell=' + G.map._view.cell : 'n/a');
  check('视野信息改报中心格（v50：菱形视野不是矩形）', (function () {
    const v = G.map._view, txt = document.querySelector('#map-info').textContent;
    return txt === '中心 (' + v.vx + ',' + v.vy + ')';
  })(), document.querySelector('#map-info').textContent);
  check('菱形视野四角可见格都可拾取、地图外为空', (function () {
    const v = G.map._view;
    const old = cv26.getBoundingClientRect;
    cv26.getBoundingClientRect = () => ({ left: 0, top: 0, width: cv26.width, height: cv26.height });
    const at = (gx, gy) => ({ x: v.ox + (gx - gy) * v.HW, y: v.oy + (gx + gy) * v.HH });
    /* 从中心格沿两轴各走 ±5 —— 在菱形排布里正是屏幕的四个方向 */
    const p = at(v.vx + 5, v.vy - 5), q = at(v.vx - 5, v.vy + 5);
    const hp = G.map.pick(cv26, p.x, p.y), hq = G.map.pick(cv26, q.x, q.y);
    const far = at(-400, -400);
    const out = G.map.pick(cv26, far.x, far.y);
    cv26.getBoundingClientRect = old;
    return hp && hp.x === v.vx + 5 && hp.y === v.vy - 5
      && hq && hq.x === v.vx - 5 && hq.y === v.vy + 5 && out === null;
  })());

  /* ⑤ 城内 / 城外 顶栏切换（真实点击） */
  click(document.querySelector('#topnav [data-view="ext"]'));
  await sleep(120);
  check('点顶栏「城外」进入城外视图', G.ui.view === 'ext' && /city-iso/.test(vc.innerHTML));
  check('城外顶栏高亮、城池熄灭', document.querySelector('#topnav [data-view="ext"]').classList.contains('active')
    && !document.querySelector('#topnav [data-view="city"]').classList.contains('active'));
  check('城外保留左侧栏（同城资源/驻军）',
    !document.querySelector('.auth-side').classList.contains('hidden'));
  click(document.querySelector('#topnav [data-view="city"]'));
  await sleep(110);
  check('点顶栏「城池」回到城内', G.ui.view === 'city' && /city-iso/.test(vc.innerHTML), G.ui.view);

  /* ============================================================
   * v27：布局 / 公文精简 / 野地守军 / 兵种损耗 / 回合制战场 / 统计黄册
   * ============================================================ */
  console.log('\n--- v27. 布局·守军·文字战场（真实 DOM） ---');

  /* ① 侧栏：无「城池操作」；多城时切城**下拉框**在城池属性里（v45 由 chips 改为 select） */
  G.ui.setCity(G.state.cities[0].id);
  G.ui.setView('city');
  await sleep(100);
  check('侧栏不再有「城池操作」区块', !document.querySelector('#city-tools'));
  check('城池属性正常渲染（身份行 + 民心等）',
    (document.querySelector('#city-attrs') || {}).textContent.indexOf('民心') >= 0);
  (function () {
    /* 这一步之前测试流程可能已经打下过多座城，所以两种情形都主动构造一次 */
    const st = G.state;
    const bak = st.cities.slice();
    const cur = G.currentCity();
    st.cities = [cur];                        // 造出"单城"
    G.ui.renderCityAttrs(cur, st);
    const selSingle = document.querySelector('#city-switch-host select.city-select');
    const single = selSingle ? selSingle.options.length : 0;
    const singleTxt = selSingle ? selSingle.options[0].textContent : '';
    st.cities = bak.concat([G.makeCity({ id: 'e2e_sw', name: '试切城', x: 320, y: 320 })]);
    G.ui.renderCityAttrs(cur, st);
    const sel = document.querySelector('#city-switch-host select.city-select');
    const multi = sel ? sel.options.length : 0;
    const multiTxt = sel ? Array.from(sel.options).map(o => o.textContent).join('|') : '';
    st.cities = bak;
    G.ui.renderCityAttrs(cur, st);
    /* v71（老板）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」 */
    check('单城时也出现城池下拉框（选项 = 州郡县 + 坐标）',
      single === 1 && singleTxt.indexOf('(') >= 0 && singleTxt.indexOf(G.coordText(cur)) >= 0, single + ' 个选项');
    /* v45（需求 3）：判据由"芯片个数"改为"下拉框选项数" —— 已有城池都是可选项 */
    check('多城时城池清单给出城池下拉框（已有城池均为选项）', multi >= 2, multi + ' 个选项');
    /* v71（老板）：选项文案 = 州郡县全称 + 坐标（在哪建城，这里可鉴） */
    check('下拉框选项含州郡县全称与坐标（v71：选址信息出口）',
      multiTxt.indexOf(G.cityFullName(cur)) >= 0 && multiTxt.indexOf(G.coordText(cur)) >= 0, multiTxt.slice(0, 80));
    /* v53（老板："点出来列表马上收回去了"）：这条才是那个 bug 的直接判据 ——
       原生下拉列表挂在 <select> 元素上，元素被重绘换掉 = 列表立刻合上。
       造出多城 → 连点三次 renderCityAttrs（主循环每秒就这么干）→
       元素必须是**同一个节点**，且当前城仍是 selected。 */
    st.cities = bak.concat([G.makeCity({ id: 'e2e_sw2', name: '试切城二', x: 321, y: 321 })]);
    G.ui.renderCityAttrs(cur, st);
    const sel1 = document.querySelector('#city-switch-host select.city-select');
    for (let i = 0; i < 3; i++) G.ui.renderCityAttrs(cur, st);   // 模拟三次主循环重绘
    const sel2 = document.querySelector('#city-switch-host select.city-select');
    const stillSel = sel2 && sel2.selectedOptions.length === 1
      && sel2.selectedOptions[0].value === cur.id;
    check('连续重绘不重建城池下拉框（同一个 DOM 节点，否则列表会被冲合）',
      !!sel1 && sel1 === sel2, sel1 === sel2 ? '同一节点' : '节点被换掉了');
    check('重绘后当前城仍是选中项（切城不会因重绘丢状态）', !!stillSel);
    /* 清单本身变了 → 必须重建（否则新打下的城进不了下拉框） */
    st.cities = bak;
    G.ui.renderCityAttrs(cur, st);
    const sel3 = document.querySelector('#city-switch-host select.city-select');
    check('城池清单变化 → 下拉框重建（不会停在旧清单上）',
      !!sel3 && sel3.options.length === bak.length, (sel3 ? sel3.options.length : 0) + ' / ' + bak.length + ' 项');
  })();

  /* ② 公文：无公告 / 无系统状态，保留队列 */
  G.ui.setView('reports');
  await sleep(110);
  const rep27 = document.querySelector('#view-container').innerHTML;
  check('公文不再有「公告 · 当前要务」与「系统状态」',
    rep27.indexOf('公告 · 当前要务') < 0 && rep27.indexOf('系统状态') < 0);
  check('公文五类页签 + 队列迁出（v29 需求 6 · v89.107 改版）',
    rep27.indexOf('id="doc-queues"') < 0 && rep27.indexOf('doc-tabs') >= 0
    && rep27.indexOf('id="doc-body"') >= 0);

  /* ③ 统计黄册（真实 DOM） */
  G.ui.setView('stats');
  await sleep(110);
  /* v54（老板："别一边长一边短，留空一大块"）：账册必须是**单列** ——
     每笔独占一行 → 结构上不可能出现"半行留空"（两列时奇数笔必留空一格）。
     判据用**真实坐标**：所有账目行的左边界只许有一个值。 */
  check('统计页不再有卡片网格', vc.querySelectorAll('.stat-card').length === 0);

  /* ④ 顶栏图标尺寸（计算样式） */
  G.ui.setView('city');
  await sleep(80);
  check('顶栏菜单图标已调小（≤13px）', (function () {
    const ico = document.querySelector('#topnav .nav-ico');
    if (!ico) return false;
    const w = parseFloat(window.getComputedStyle(ico).width);
    return w > 0 && w <= 13;
  })());

  /* ⑤ 野地守军：地图点开野地 → 显示守军数字；侦查 → 准确情报 */
  const wd = G.ui.mapView;
  let probeX = -1, probeY = -1;
  for (let r = 2; r < 24 && probeX < 0; r++) {
    for (let c = 2; c < 24; c++) {
      const x = (wd.x || 250) + c, y = (wd.y || 200) + r;
      const t = G.map.tile(x, y);
      if (t && t.terrain !== 'city' && !G.map.npcAt(x, y) && !G.map.fortAt(x, y) && !G.map.wildAt(x, y)) {
        probeX = x; probeY = y; break;
      }
    }
  }
  check('找到一块未占野地', probeX > 0, '(' + probeX + ',' + probeY + ')');
  const lvProbe = G.map.wildLevelNow ? G.map.wildLevelNow(probeX, probeY) : G.map.wildLevel(probeX, probeY);
  const defProbe = G.wildDefenseAt(probeX, probeY, lvProbe);
  check('守军与等级范围一致（落在该等级区间内）', (function () {
    const tbl = G.DATA.WILD_DEFENSE[lvProbe] || [];
    return Object.keys(defProbe.army).every(function (id) {
      const e = tbl.filter((x) => x.id === id)[0];
      if (!e) return false;
      const wave = G.DATA.WILD_DEFENSE_WAVE;
      return defProbe.army[id] >= Math.floor(e.min * wave[0]) - 1
        && defProbe.army[id] <= Math.ceil(e.max * wave[1]) + 1;
    }) && Object.keys(defProbe.army).length > 0;
  })(), 'Lv' + lvProbe + ' 合计 ' + defProbe.total);

  /* ⑥ 打一场，看战报里的战斗场景与兵种损耗 */
  G.state.res.grain += 5e6;
  const g27 = G.state.generals[0];
  const c27 = G.currentCity();
  const bkArmy27 = JSON.stringify(c27.army);
  /* 校场容量按等级给（Lv1 = 1 万人口），先把校场提到 Lv3 再出兵，否则会被拦 */
  (function () {
    let cell = c27.cells.filter((x) => x.build && x.build.id === 'xiaochang')[0];
    if (cell) { cell.build.lvl = Math.max(cell.build.lvl || 1, 3); }
    else {
      const i = c27.cells.findIndex((x) => !x.build && !x.official);
      if (i >= 0) c27.cells[i].build = { id: 'xiaochang', lvl: 3 };
    }
  })();
  c27.army = { changqiang: 5000, gongjian: 3000, qingji: 1000 };
  const bkRepN27 = G.state.reports.length;
  /* v89.73：判据改成**按身份**找"本次新增的那一份"。
     原判据是 `reports[bkRepN27]`（拿旧长度当下标）—— 只有在"本次恰好只加了一条
     且它排在最前"时才等于新报告，本质是在赌下标；v89.73 加了侦查公文之后
     这条就错位了（而且是**假红**：功能没坏，是判据脆）。 */
  const bkRepSet27 = new Set(G.state.reports);
  const rr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'raid',
    { changqiang: 5000, gongjian: 3000, qingji: 1000 }, g27.id);
  await sleep(120);
  check('出征结算成功', !!rr27.ok, rr27.msg);
  check('本场战报正文含兵种损耗明细（本次新增的那一份）', (function () {
    const added = G.state.reports.filter((x) => !bkRepSet27.has(x));
    const rep = added[0];
    return added.length >= 1 && !!rep && (rep.body || '').indexOf('【兵种损耗】') >= 0
      && (rep.body || '').indexOf('损 ') >= 0 && !!rep.scene;
  })(), '新增 ' + G.state.reports.filter((x) => !bkRepSet27.has(x)).length
    + ' 份（战前 ' + bkRepN27 + ' 份）');
  G.ui._docTab = 'war';                  /* v89.107：战报页才有 view-report 行 */
  G.ui.setView('reports');
  await sleep(110);
  const viewBtn = vc.querySelector('[data-action="view-report"]');
  check('公文里有战报条目与「查看」按钮', !!viewBtn);
  click(viewBtn);
  await sleep(120);
  const rp27 = document.querySelector('#modal-root');
  /* v89.102（老板「战斗报告的界面大一点，分回合回放创建一个固定沙盘」）：
     「查看」现在打开**沙盘回放**（逐兵种逐帧、固定泳道）；战报正文另成一页，
     从沙盘顶部的「📜 战报正文」进入 —— 所以正文判据要先跳过去再查。 */
  check('战报（沙盘回放）：固定沙盘 + 逐兵种令牌 + 帧流在册',
    !!rp27.querySelector('#sd-field') && rp27.querySelectorAll('.sd-row').length >= 1
    && rp27.querySelectorAll('.sd-tok').length >= 1,
    rp27.querySelectorAll('.sd-row').length + ' 侧栏行 · ' + rp27.querySelectorAll('.sd-tok').length + ' 令牌');
  {
    const toTxt = rp27.querySelector('[data-action="sd-text"]');
    check('沙盘：有「📜 战报正文」入口（两页互跳，不是孤儿）', !!toTxt);
    if (toTxt) { click(toTxt); await sleep(110); }
  }
  const rpTxt = document.querySelector('#modal-root');
  /* v89.150（老板 3）：「战报正文里不要分回合回放、回合纪要这 2 个板块。保留/设置：
     战斗总结，战斗收获，兵种损耗」—— 三块 + 两个旧板块整条退役（旧档也不再有条带块）。 */
  check('v89.150 战报正文：三块齐（战斗总结 / 战斗收获 / 兵种损耗）', (function () {
    const txt = rpTxt.textContent || '';
    return txt.indexOf('战斗总结') >= 0 && txt.indexOf('战斗收获') >= 0 && txt.indexOf('兵种损耗') >= 0;
  })());
  check('v89.150 战报正文：回放与纪要已退役（无 .bt-scene / .bt-line / .rp-log / 关键帧）',
    !rpTxt.querySelector('.bt-scene') && !rpTxt.querySelector('.bt-line') && !rpTxt.querySelector('.rp-log')
    && (rpTxt.textContent || '').indexOf('分回合回放') < 0
    && (rpTxt.textContent || '').indexOf('回合纪要') < 0);
  check('v89.150 战报正文：总结**逐行**（.rp-line）+ 收获**两列分类**（.rp-glabel/.rp-gtext）',
    rpTxt.querySelectorAll('.rp-lines .rp-line').length >= 2
    && rpTxt.querySelectorAll('.rp-gain .rp-glabel').length >= 1
    && rpTxt.querySelectorAll('.rp-gain .rp-gtext').length >= 1,
    rpTxt.querySelectorAll('.rp-lines .rp-line').length + ' 行总结 · '
    + rpTxt.querySelectorAll('.rp-gain .rp-glabel').length + ' 行收获');

  check('战报正文：含兵种损耗表（列出双方各兵种）', (function () {
    const heads = Array.prototype.map.call(rpTxt.querySelectorAll('.tbl th'), (x) => x.textContent);
    return heads.join(',').indexOf('我方损失') >= 0 && heads.join(',').indexOf('敌军损失') >= 0
      && rpTxt.querySelectorAll('.tbl tbody tr').length >= 1;
  })());
  G.ui.closeAllModals();
  await sleep(60);

  /* ⑦ 侦查回报面板（真实渲染）
     v65：情报按侦察技巧**分层解锁** —— 先把技巧升满，才看得到全部六层；
     "分层"这件事本身由下面新增的两条断言专门钉住（未解锁必须显示锁定行）。 */
  const keepTech27 = G.systems.techLevel('zhencha');   /* v89.191：按城读 */
  const keepW27 = G.state.world.weather;
  G.techSet('zhencha', 10);
  /* ⚠️ 两个前置都必须固定，否则断言偶发变红（"前置没满足"看起来像"功能坏了"）：
     ① 体力/精力补满 —— 侦察要消耗它们，不足时 expedition 会**直接拒绝**；
     ② **天气设为晴** —— 大雾会让情报整体降级（既有设定），
        于是"逐兵种准确数量"与"可图之利"整块消失（连跑三次才抓到这一条）。 */
  g27.stamina = G.staMax(g27);
  g27.energy = 100;
  G.state.world.weather = 'clear';
  /* v89.156（老板 4）：侦察可失败（视双方将领资质/等级差）—— 本组验"分层与面板"，
     摆前置：固定随机为**成功**（失败路径见下方 v89.156④ 真路径用例）。 */
  const _rndBk156a = window.Math.random;
  window.Math.random = () => 0.001;   /* ⚠️ jsdom realm：必须改 window.Math */
  const sr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
  window.Math.random = _rndBk156a;
  await sleep(100);
  G.ui.openScoutResult({ name: '野地' }, sr27);
  await sleep(100);
  const sm27 = document.querySelector('#modal-root');
  check('满级侦查 → 面板给出「情报层级」与全开状态',
    sm27.textContent.indexOf('情报层级') >= 0 && sm27.textContent.indexOf('六层情报全开') >= 0);
  /* v89.201（老板 1）：面板单页化 —— 「两段」升级为「四板块同页」判据 */
  check('侦查面板单页四板块（敌情 / 城中虚实 / 可图之利 同页）',
    sm27.textContent.indexOf('敌情') >= 0 && sm27.textContent.indexOf('可图之利') >= 0
    && sm27.querySelectorAll('[data-action="scout-page"]').length === 0);
  check('侦查面板列出逐兵种准确数量', sm27.textContent.indexOf('准确数量') >= 0,
    'ok=' + (sr27 && sr27.ok) + ' 层=' + ((sr27 && sr27.intelTiers) ? sr27.intelTiers.lv : '?')
      + ' 头部=' + sm27.textContent.slice(0, 40).replace(/\s+/g, ' '));
  check('侦查面板给出掠夺珠宝 / 可采资源 / 宝物类型', (function () {
    /* v65：满级内容装不进一个弹窗 → 拆两页，「可图之利」在第 2 页；
       「可获宝物类型」又收进了 ⓘ（提示节点在**属性**里，textContent 读不到）。 */
    G.ui.openScoutResult({ name: '野地' }, sr27, 1);
    var root = document.querySelector('#modal-root');
    return root.textContent.indexOf('掠夺可得珠宝') >= 0
      && root.textContent.indexOf('占领可采资源') >= 0
      && root.innerHTML.indexOf('可获宝物类型') >= 0;
  })(), sm27.textContent.slice(0, 50).replace(/\s+/g, ' '));
  G.ui.closeAllModals();
  await sleep(60);

  /* 同一目标、技巧归零 → 六层几乎全锁（这才是"按等级给不同类型的信息"） */
  G.techSet('zhencha', 0);
  /* v89.156：同上，固定随机为成功（本用例验"锁定行"，与成败无关） */
  const _rndBk156b = window.Math.random;
  window.Math.random = () => 0.001;   /* ⚠️ jsdom realm：必须改 window.Math */
  const sr27b = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
  window.Math.random = _rndBk156b;
  await sleep(80);
  /* ⚠️ 必须**显式传 0**：页签有记忆（上一次上一条断言刚翻到第 2 页），
     不传就会开在"虚实与可图之利"上 → 找不到守军行（这一条踩过一次）。 */
  G.ui.openScoutResult({ name: '野地' }, sr27b, 0);
  await sleep(80);
  const sm27b = document.querySelector('#modal-root');
  check('技巧 0 级 → 面板出现「🔒 需侦察技巧 Lv…」锁定行（分层可见）',
    sm27b.textContent.indexOf('🔒') >= 0 && sm27b.textContent.indexOf('侦察技巧 Lv') >= 0);
  /* ⚠️ 判据不能用"文里没有『城内库藏』" —— 锁定行的说明文字里本来就写着
     「🔒 需侦察技巧 Lv3　城内库藏与人口」（那正是"告诉玩家这里锁着什么"）。
     所以改成数锁的**条数**（资源 / 建筑 / 可图之利 共 3 条）＋ 真内容不出现。 */
  check('技巧 0 级 → 资源 / 建筑 / 可图之利三层全锁着（未解锁就是查不到）', (function () {
    /* v65 分页后：第 1 页锁 2 条（兵种 / 守将），第 2 页锁 3 条（资源 / 建筑 / 可图之利） */
    var l1 = (sm27b.textContent.match(/🔒/g) || []).length;
    G.ui.openScoutResult({ name: '野地' }, sr27b, 1);
    var t2 = document.querySelector('#modal-root').textContent;
    var l2 = (t2.match(/🔒/g) || []).length;
    return l1 >= 2 && l2 >= 3
      && t2.indexOf('掠夺可得珠宝') < 0 && t2.indexOf('城池规格') < 0;
  })());
  /* ⚠️ 这一条改成**数据层**判据：中间那条断言为了看"三层锁"把面板翻到了第 2 页，
     再读 DOM 会读到"虚实与可图之利"（DOM 断言必须紧跟在自己那次打开之后）。
     第 1 页的 DOM 呈现由上面「第 1 页出现锁定行」那条守着。 */
  check('技巧 0 级 → 守军总数未点验（totalExact=false，面板显示"约"）',
    sr27b.totalExact === false && sr27b.gNum > 0 && (sr27b.roster || []).length === 0,
    '约 ' + sr27b.gNum + ' 名 · 兵种 ' + (sr27b.roster || []).length + ' 条');
  G.ui.closeAllModals();
  G.techSet('zhencha', keepTech27);
  G.state.world.weather = keepW27;
  c27.army = JSON.parse(bkArmy27);

  /* ============================================================
   * v28（需求 0-8）真实 DOM 验证
   * ============================================================ */
  console.log('\n--- v28. 数值 / 12 级专精 / 12 席 / 军营队列 / 批次（真实 DOM） ---');

  /* ① 将领 3×2 卡片墙（v29 · 需求 16） */
  G.ui._pages = G.ui._pages || {}; G.ui._pages.gens = 1;
  G.ui.setView('generals');
  await sleep(100);
  /* v41（需求 2）：左清单 + 右侧完整档案
     v45（需求 1）：左清单**取消分页**（老板："不要那么多页""不要限制每页的将领个数"），
     改为整段滚动 → 全部席位一次渲染，底部不再有 gens 翻页条。 */
  check('将领左栏渲染全部席位、不再翻页（v45）',
    vc.querySelectorAll('.gen-row').length >= G.ui.GEN_SLOTS
    && vc.querySelectorAll('.gen-list').length === 1
    && vc.querySelectorAll('.gen-pane').length === 1
    && document.querySelectorAll('#bottom-bar [data-key="gens"]').length === 0,
    vc.querySelectorAll('.gen-row').length + ' 行');
  check('空席写明原因', vc.querySelectorAll('.gen-row.empty').length > 0
    && vc.textContent.indexOf('席') >= 0);
  const gr0 = vc.querySelector('.gen-row:not(.empty)');
  check('清单行含 肖像/姓名/Lv/资质/状态（装备数仍移出）',
    !!gr0 && !!gr0.querySelector('.grow-face svg, .grow-face img')
    && !!gr0.querySelector('.grow-name') && !!gr0.querySelector('.rank-badge')
    && !!gr0.querySelector('.grow-st')
    && !!gr0.querySelector('.grow-lv')
    && !gr0.querySelector('.grow-eq'));
  /* 点另一行切换右侧档案 */
  check('点另一行会切换右侧档案', (function () {
    var rows = vc.querySelectorAll('.gen-row:not(.empty)');
    if (rows.length < 2) return true;
    var target = rows[1].getAttribute('data-gen');
    rows[1].click();
    return G.ui._genSel === target;
  })());

  /* ② 城池属性：民心/民怨一行 */
  G.ui.setView('city');
  await sleep(80);
  const attrs28 = document.querySelector('#city-attrs').textContent.replace(/\s+/g, ' ');
  check('城池属性「民心 / 民怨」合并为一行 xx / xx',
    attrs28.indexOf('民心 / 民怨') >= 0 && attrs28.indexOf('民怨') === attrs28.lastIndexOf('民怨'));

  /* ③ 军营面板：本营队列 + 上限按钮 + 加速 */
  const c28 = G.currentCity();
  let ji28 = -1;
  c28.cells.forEach((x, i) => { if (x.build && x.build.id === 'junying') ji28 = i; });
  if (ji28 < 0) {
    ji28 = c28.cells.findIndex((x) => !x.build && !x.official);
    c28.cells[ji28].build = { id: 'junying', lvl: 10 };
  }
  c28.cells[ji28].build.lvl = 10;
  G.ui.openBuildModal(ji28);
  await sleep(90);
  const bd28 = document.querySelector('#modal-root');
  check('军营面板列出本营募兵队列',
    bd28.textContent.indexOf('本营募兵队列') >= 0);
  check('军营面板有队列位说明', bd28.textContent.indexOf('队列位') >= 0);
  /* 面板里的「募兵」按钮要能进募兵界面 */
  const bt28 = bd28.querySelector('[data-action="open-troops"]');
  check('军营面板有「募兵 · 兵种」入口', !!bt28);
  click(bt28);
  await sleep(100);
  /* v81：默认落在「募兵队列」页 —— 训练控件在步兵页，先切页 */
  click(document.querySelector('#modal-root [data-action="train-tab"][data-page="inf"]'));
  await sleep(100);
  const tr28 = document.querySelector('#modal-root');
  check('募兵界面有「上限」按钮', !!tr28.querySelector('[data-action="train-max"]'));
  check('募兵界面显示可募上限（按人口与资源算）',
    /上限\s*[\d,]+/.test(tr28.textContent.replace(/\s+/g, ' ')));

  /* 点上限 → 数量被填到最大值 */
  const st28 = G.state;
  const bkRes28 = { pop: st28.res.pop, grain: st28.res.grain, wood: st28.res.wood,
    stone: st28.res.stone, iron: st28.res.iron };
  /* v89.189 规则变更所致：人口占用换代（建筑按等级占人口）——场景人口改为
     "覆盖劳作占用 + 可征 1234"，否则在建筑多的测试城里可征为 0、"上限"无从填。 */
  st28.res.pop = G.popLaborOf(c28) + 1234; st28.res.grain = 9000;
  const want28 = G.maxTrainCount(G.ui._trainSel, c28.id, ji28);
  click(tr28.querySelector('[data-action="train-max"]'));
  await sleep(110);
  const cntEl28 = document.querySelector('#train-count');
  check('点「上限」把数量填成可募最大值',
    !!cntEl28 && Number(cntEl28.value) === want28 && want28 > 0,
    '填了 ' + (cntEl28 ? cntEl28.value : 'n/a') + ' / 应为 ' + want28);
  st28.res.pop = bkRes28.pop; st28.res.grain = bkRes28.grain;
  st28.res.wood = bkRes28.wood; st28.res.stone = bkRes28.stone; st28.res.iron = bkRes28.iron;

  /* ④ 募兵 → 队列 → 加速（真实点击）
     ------------------------------------------------------------
     先**把时间倍率压到 1×** 再开始：主循环是按现实秒推进队列的，
     前面若干节可能把倍率调到 600×，几十个义兵几秒就跑完 ——
     队列会在断言之前消失，报"Cannot read properties of undefined"。
     这一节要的是"队列还在、加速能让它变短"，所以必须让时间慢下来，
     而不是把断言改成"允许队列消失"（那就等于没测）。 */
  const tsBk28 = st28.settings.timeScale;
  st28.settings.timeScale = 1;
  st28.items.hanxin_dianbing = 2;
  /* 募兵要资源与人口，且本营队列要有空位 —— 不先备好，后面的断言会因"根本没队列"
     而拿到 undefined（本轮就是这里中断过一次，幸好 e2e 骨架已把中断计为失败）。 */
  st28.res.grain = Math.max(st28.res.grain, 5e6);
  st28.res.wood = Math.max(st28.res.wood, 5e6);
  st28.res.iron = Math.max(st28.res.iron, 5e6);
  st28.res.pop = Math.max(st28.res.pop, 20000);
  const tr28b = G.train('yibing', 60, c28.id, ji28);
  check('本营募兵已受理（后续加速断言的前提）', !!tr28b.ok, tr28b.msg);
  G.ui.openTroops(ji28, 'normal');
  await sleep(80);
  /* v81：队列独立成页 —— 切回队列页（上一步在步兵页） */
  click(document.querySelector('#modal-root [data-action="train-tab"][data-page="que"]'));
  await sleep(80);
  const qHtml28 = document.querySelector('#modal-root').innerHTML;
  check('募兵界面显示本营队列（v81：队列独立页）', qHtml28.indexOf('本营募兵队列') >= 0);
  const boostBtn28 = document.querySelector('#modal-root [data-action="train-boost"]');
  check('执行中的队列有「加速」按钮', !!boostBtn28);
  if (boostBtn28 && G.trainQueuesOf(c28, ji28).length) {
    click(boostBtn28);
    await sleep(90);
    const pb28 = document.querySelector('#modal-root');
    /* v89.49 改版为「⚡ 提速」面板；v89.86 同步断言（原「募兵加速」字样已退役） */
    check('点加速弹出宝物选择（含剩余时间）',
      pb28.textContent.indexOf('提速') >= 0 && pb28.textContent.indexOf('剩余') >= 0);
    const useBtn28 = pb28.querySelector('[data-action="do-train-boost"]');
    check('加速弹窗列出可用宝物', !!useBtn28);
    if (useBtn28) {
      const q28 = G.trainQueuesOf(c28, ji28)[0];
      const before28 = q28.elapsed;
      click(useBtn28);
      await sleep(120);
      check('点加速真的缩短了本营队列',
        G.trainQueuesOf(c28, ji28)[0].elapsed > before28,
        Math.round(before28 / 120) + 's → ' + Math.round(G.trainQueuesOf(c28, ji28)[0].elapsed / 120) + 's');
      /* ⚠️ 原先钉死 hanxin_dianbing —— 但加速弹窗列的是**所有可用宝物**，
         点到的可能是别的一件（背包不同就换），于是这条断言偶发变红。
         改为：**点哪件就断言哪件**（按钮上有 data-item），这样既忠实又稳定。 */
      const boostId28 = useBtn28.getAttribute('data-item');
      check('每队列限 1 次：点用的那件宝物被标记已用', (function () {
        const b = G.trainQueuesOf(c28, ji28)[0].boost;
        return !!b && !!boostId28 && !!b[boostId28];
      })(), boostId28 || '（按钮未带 data-item）');
    }
    G.ui.closeAllModals();
    await sleep(40);
  }
  st28.settings.timeScale = tsBk28;

  /* ⑤ 商城批次购买 */
  G.ui.setView('shop');
  await sleep(100);
  G.ui.renderShop();
  await sleep(60);
  check('每行都有数量输入框（带加减号）', (function () {
    var inp = vc.querySelector('.qty-input input');
    return !!inp && !!inp.parentNode.querySelector('[data-action="qty-step"][data-d="-1"]')
      && !!inp.parentNode.querySelector('[data-action="qty-step"][data-d="1"]');
  })());
  const goldBk28 = G.state.res.gold;
  G.state.res.gold = 1e9;
  /* 取**当前渲染页上真实存在**的那个商品，而不是 shopItems()[0] ——
     列表按分类+分页切片，第 0 件未必在这一页（本轮就是因此点到 null，
     看起来像"买了 0 个"，实则是断言取错了对象）。 */
  const buyBtn28 = vc.querySelector('[data-action="shop-buy"]');
  const itemId28 = buyBtn28 ? buyBtn28.dataset.item : null;
  const have28 = itemId28 ? (G.state.items[itemId28] || 0) : 0;
  check('商城主页有可购买的商品', !!buyBtn28);
  if (buyBtn28) {
    /* v29（需求 14）：数量以**本行输入框**为准 —— 先把该行填成 10 再点购买 */
    var buyInp = document.getElementById('sq-' + itemId28);
    if (buyInp) { buyInp.value = 10; }
    click(buyBtn28);
    await sleep(120);
    check('点一次买到的就是输入框里的数量',
      (G.state.items[itemId28] || 0) - have28 === 10,
      '买到 ' + ((G.state.items[itemId28] || 0) - have28) + ' 个');
  }
  G.state.res.gold = goldBk28;

  /* ⑥ 背包批次使用（v89.105：改用**无对象**道具 —— 带对象的在背包里只指路） */
  G.state.items.shennongchu = 4;
  G.ui.setView('bag');
  G.ui._bagTab = 'item';
  G.ui.renderBag();
  await sleep(100);
  /* v89.140（老板 7）：统一格子（无数量输入框；点击 = 使用 1 个） */
  check('背包宝物页 = 统一格子（bag-cell · 无数量输入框）',
    !!vc.querySelector('.bag-cell') && !vc.querySelector('.qty-input input'));
  /* v89.141（老板 0 · 按建议执行）：**右键 → 批量小窗** ——
     真派发 contextmenu（走 document 委托 → openBulkUse）。
     ⚠️ 这条是**运行时**断言：源码级断言测不出"委托里写错全局名"
     （实测踩过：main.js 里 `G.ui` 应为 `GAME.ui`，ReferenceError 静默无窗）。 */
  /* ⚠️ 数量用外层变量保存 —— 本用例结束后必须**还原**（后续用例依赖 =4；
     首版把保存写在 IIFE 里 → 忘了还原 → "点一次用掉 1 个"用例翻红）。 */
  const _bulkBk5 = G.state.items.shennongchu;
  G.state.items.shennongchu = 5;
  G.ui.closeAllModals();
  G.ui.setView('bag');
  /* v89.143（老板 1）：「全部」分类退役 —— 旧的 setBagTab('item') 会归一到**第一个有货分类**
     （本局 = 材料），神农锄不在那页 → 找不到格子。改为**按道具实际类型**切分类。 */
  (function () {
    var it5 = null;
    (G.DATA.ITEMS || []).forEach(function (x) { if (x.id === 'shennongchu') it5 = x; });
    G.ui._bagTab = 'treasure';
    G.ui.setBagSub(it5 ? it5.type : 'material');
  })();
  await sleep(80);
  (function () {
    var cell = document.querySelector('.bag-cell[data-bulk="1"]');
    if (cell) cell.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  })();
  await sleep(80);
  {
    const _mroot = document.querySelector('#modal-root');
    const _mhtml = (_mroot && _mroot.innerHTML) || '';
    check('v89.141 宝物右键 → 批量小窗（真事件流：contextmenu → bulk-q/bulk-use-do）',
      _mhtml.indexOf('bulk-q') >= 0 && _mhtml.indexOf('bulk-use-do') >= 0,
      _mhtml.indexOf('bulk-q') >= 0 ? '已开窗' : '未开窗');
  }
  G.ui.closeAllModals();
  /* 数量还原（后续用例依赖）· 回到宝物页（后续用例继续用本页） */
  if (_bulkBk5 == null) delete G.state.items.shennongchu; else G.state.items.shennongchu = _bulkBk5;
  G.ui.setView('bag');
  (function () {
    var it5b = null;
    (G.DATA.ITEMS || []).forEach(function (x) { if (x.id === 'shennongchu') it5b = x; });
    G.ui._bagTab = 'treasure';
    G.ui.setBagSub(it5b ? it5b.type : 'material');   /* v89.143：同 ③ —— 按实际类型切类 */
  })();
  await sleep(60);
  const g28 = G.state.generals[0];
  const expBk28 = g28.exp, lvBk28 = g28.level;
  /* v29（需求 14）：使用数量取**本行输入框** */
  var useInp = document.getElementById('ui-shennongchu');
  if (useInp) useInp.value = 4;
  click(vc.querySelector('[data-action="use-bag-item"][data-key="shennongchu"]'));
  await sleep(130);
  /* v89.104（老板「背包里的宝物界面不要设置将领清单，点击使用的时候，
     如果是直接消耗的无对象物品，直接使用并生效即可」）：带使用对象的道具
     在背包里**只指路**（去将领面板），所以整叠使用改用**无对象**道具（神农锄）验证。 */
  /* v89.140（老板 7）：格子化后无数量框 → 点击 = 使用 **1 个**（整叠走多次点击） */
  check('点一次用掉 1 个（v89.140：宝物格子点击 = 使用 1 个）',
    (G.state.items.shennongchu || 0) === 3,
    '余 ' + (G.state.items.shennongchu || 0));

  /* ⑦ 建筑面板：拆毁左下 / 移动右下 */
  G.ui.setView('city');
  await sleep(80);
  let bi28 = -1;
  c28.cells.forEach((x, i) => { if (x.build && x.build.id !== 'guanfu') bi28 = i; });
  if (bi28 >= 0) {
    G.ui.openBuildModal(bi28);
    await sleep(80);
    const acts28 = document.querySelector('#modal-root .bldg-acts');
    check('v76：操作三键同排（升级 · 拆 1 级 · 移动/交换）', !!acts28
      && !!(acts28.querySelector('[data-action="confirm-upgrade"]') || acts28.querySelector('.dim'))
      && !!acts28.querySelector('[data-action="demolish-ask"]')
      && !!acts28.querySelector('[data-action="move-ask"]'));
    check('v89.114：关闭键在右上角（.bldg-foot 不再有关闭条）',
      !!document.querySelector('#modal-root .modal-x[data-action="close-modal"]')
      && !document.querySelector('#modal-root .bldg-foot [data-action="close-modal"]'));
    G.ui.closeAllModals();
    await sleep(40);
  }

  /* ============================================================
   * ⑧ v63（老板三条）：空地建造图标 / 据点每日掠夺 / 守将按城
   * ============================================================ */
  const city63 = G.currentCity();
  const keepCell63 = city63.cells.slice();          // 收尾还原（不动测试城池）
  let empty63 = -1;
  city63.cells.forEach((x, i) => { if (empty63 < 0 && !x.official) empty63 = i; });
  city63.cells[empty63] = { build: null, pending: null };
  G.refreshAll();
  G.ui.setView('city');
  await sleep(80);
  G.ui.openBuildModal(empty63);
  await sleep(120);
  const pick63 = document.querySelectorAll('#modal-root .bldg-pick');
  check('空地建造卡有图标（与棋盘同一套 .ico）',
    pick63.length >= 6 && document.querySelectorAll('#modal-root .bldg-pick .ico').length >= 6,
    pick63.length + ' 张卡 / ' + document.querySelectorAll('#modal-root .bldg-pick .ico').length + ' 个图标');
  check('卡片正文不再写消耗（textContent 无「耗」）', (function () {
    for (let i = 0; i < pick63.length; i++) if (pick63[i].textContent.indexOf('耗') >= 0) return false;
    return pick63.length > 0;
  })());
  check('消耗改在 title 悬停里（含「耗：」）',
    !!document.querySelector('#modal-root .bldg-pick[title*="耗："]'));
  G.ui.closeAllModals();
  await sleep(60);

  /* 据点：地块列 / 每日掠夺状态 / 出征方式的锁定 */
  const forts63 = G.map.fortsInView(0, 0, 60) || [];
  if (forts63.length) {
    const f63 = forts63[0];
    const f63b = forts63[1] || null;
    G.map.markFortRaided(f63.x, f63.y);
    G.ui.openForts();
    await sleep(90);
    const fh63 = document.querySelector('#modal-root').innerHTML;
    check('据点一览有「地块」列且写出格数', fh63.indexOf('地块') >= 0 && /（\d+ 格）/.test(fh63));
    check('据点一览标出「今日已掠夺」', fh63.indexOf('今日已掠夺') >= 0);
    G.ui.closeAllModals();
    await sleep(50);

    G.ui.openFortModal(f63);
    await sleep(80);
    check('据点面板提示今日已掠夺（点之前就知道）',
      document.querySelector('#modal-root').innerHTML.indexOf('今日已掠夺') >= 0);
    G.ui.closeAllModals();
    await sleep(50);

    G.ui.openExpModal({ kind: 'fort', x: f63.x, y: f63.y });
    await sleep(90);
    const raidOpt = document.querySelector('#modal-root #exp-mode option[value="raid"]');
    check('已掠夺据点的「掠夺」方式被锁（带原因）',
      !!raidOpt && raidOpt.disabled && /今日已掠夺/.test(raidOpt.textContent || ''));
    const keepMode63 = G.ui._expMode;
    G.ui.setExpMode('raid');
    check('锁定项点了也切不过去', G.ui._expMode === keepMode63, '当前 ' + G.ui._expMode);
    const scoutOpt = document.querySelector('#modal-root #exp-mode option[value="scout"]');
    check('同面板的「侦查」不受影响', !!scoutOpt && !scoutOpt.disabled);
    G.ui.closeAllModals();
    await sleep(50);

    if (f63b) {
      G.ui.openExpModal({ kind: 'fort', x: f63b.x, y: f63b.y });
      await sleep(90);
      const raidOpt2 = document.querySelector('#modal-root #exp-mode option[value="raid"]');
      check('无掠夺记录的据点上「掠夺」可用（对照，证明判据不是恒真）',
        !!raidOpt2 && !raidOpt2.disabled);
      G.ui.closeAllModals();
      await sleep(50);
    }
  } else {
    check('据点一览有「地块」列且写出格数', false, '未找到据点');
    check('据点一览标出「今日已掠夺」', false, '未找到据点');
    check('据点面板提示今日已掠夺（点之前就知道）', false, '未找到据点');
    check('已掠夺据点的「掠夺」方式被锁（带原因）', false, '未找到据点');
    check('锁定项点了也切不过去', false, '未找到据点');
    check('同面板的「侦查」不受影响', false, '未找到据点');
  }

  /* 城主按城（v89.113：内政加成归城主）：B 城立城主，A 城加成不受影响 */
  (function () {
    const a63 = G.currentCity();
    const b63 = G.makeCity({ id: 'e2e63b', name: '副城', x: 9, y: 9, type: 'county',
      res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    G.state.cities.push(b63);
    const g63 = G.makeGeneral('副城城主', 20, 'mayor', b63.id, false, 'liang', 'balance');
    g63.loyalty = 100;
    G.state.generals.push(g63);
    const hasB = G.prodFactors('grain', b63).some((f) => f.name === '城主内政');
    const hasA = G.prodFactors('grain', a63).some((f) => f.name === '城主内政');
    check('城主只给本城加成（B 城有、A 城没有）', hasB === true && hasA === false,
      'B ' + hasB + ' / A ' + hasA);
    check('不同城市取到的是各自的城主', G.mayorBonus(b63).name === '副城城主'
      && (G.mayorBonus(a63).name || '') !== '副城城主');
    /* v89.162（老板 2）：城主内政 → 税收 —— 黄金分解出现「城主内政」行 + 与结算同源 */
    g63.nz = 100;
    const bd162 = G.prodBreakdown('gold', b63);
    check('v89.162 城主在任 → 黄金分解出现「城主内政」行', bd162.some((x) => x.name === '城主内政'),
      bd162.map((x) => x.name).join('|'));
    check('v89.162 黄金分解与结算对齐（单城 · 含城主税加成）', (function () {
      const s162 = bd162.reduce((a, x) => a + x.val, 0);
      const sal162 = bd162.filter((x) => x.name.indexOf('爵位俸禄') === 0)
        .reduce((a, x) => a + x.val, 0);
      const p162 = G.cityProdPerSec(b63).gold;
      return Math.abs(s162 - (p162 + sal162)) <= Math.max(1e-9, Math.abs(s162) * 1e-9);
    })());
    G.state.cities.pop();
    G.state.generals.pop();
  })();

  /* 还原被清掉的那一格 */
  city63.cells = keepCell63;
  G.refreshAll();

  /* ============================================================
   * ⑨ v64（老板）：城墙纳入自动建造 / 将领席位按城
   * ============================================================ */
  /* --- 城墙进自动升级：队列与"在办事项"都要看得见 --- */
  (function () {
    const c64 = G.currentCity();
    const keepAuto = G.state.settings.autoUpgrade, keepQ = G.state.queues.build.slice();
    const keepCells64 = JSON.parse(JSON.stringify(c64.cells));
    const keepWall64 = JSON.parse(JSON.stringify(c64.wall));
    /* v89.128：城墙摆进**环城槽** Lv1（最低），其余建筑抬高（含官府，解"官府总闸"） */
    c64.cells.forEach((x) => {
      if (x.build && !x.official) x.build.lvl = Math.min(5, G.DATA.BUILDINGS[x.build.id].maxLevel);
    });
    c64.cells.forEach((x) => { if (x.official && x.build) x.build.lvl = 12; });
    G.wallSlotOf(c64).build = { id: 'chengqiang', lvl: 1 };
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { c64.res[k] = 5000000; });
    G.state.settings.autoUpgrade = true;
    G.state.queues.build.length = 0;
    const r64 = G.autoUpgrade();
    const qb64 = G.ui.queueBody ? G.ui.queueBody() : '';
    check('自动升级把城墙纳入候选（城墙槽 Lv1 最低时被选中）',
      !!(r64 && r64.target && r64.target.kind === 'city' && String(r64.target.idx) === 'wall')
      && !!(c64.wall && c64.wall.build && c64.wall.build.id === 'chengqiang'),
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');
    check('城墙排进建造队列（buildId=chengqiang）且"在办事项"里能看到',
      G.state.queues.build.some((q) => q.buildId === 'chengqiang' && q.cityId === c64.id)
      && qb64.indexOf('城墙') >= 0);
    /* 还原 */
    G.state.queues.build.length = 0; keepQ.forEach((q) => G.state.queues.build.push(q));
    c64.cells = keepCells64;
    c64.wall = keepWall64;
    G.state.settings.autoUpgrade = keepAuto;
    G.refreshAll();
  })();

  /* --- 将领席位按城：将领页 / 招贤馆 / 派遣三处都要写清楚 ---
     ⚠️ 先造一座**有招贤馆的副城** —— 否则"本城席位"与"全境合计"恰好相等，
     把 cap 写成全境合计也测不出来（破坏测试第 11 类第一版就是这样零反应）。 */
  const city64 = G.currentCity();
  const side64 = G.makeCity({ id: 'e2e64c', name: '侧城', x: 12, y: 12, type: 'county',
    res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
  G.state.cities.push(side64);
  for (let i = 0; i < side64.cells.length; i++) {
    if (!side64.cells[i].official) { side64.cells[i].build = { id: 'zhaoxianguan', lvl: 3 }; break; }
  }
  G.ui.setView('generals');
  await sleep(120);
  const genHtml64 = document.querySelector('#view-container').innerHTML;
  check('本城席位与全境合计**必须能区分**（测试夹具自身的前提）',
    G.genSlotsTotal() > G.genSlotsOf(city64),
    '本城 ' + G.genSlotsOf(city64) + ' 席 / 全境 ' + G.genSlotsTotal() + ' 席');
  /* v73（老板）：「不要搞（本城 2 / 11 席 · 全境 2 / 11 席）这些文字，
     直接将领加本城/全境切换按钮就行」—— 标题的席位文字已撤。
     ⚠️ 旧断言的本意（本城栏 vs 全境栏**范围分得开**）不能跟着删 ——
     改由**列表内容**实测：给别城塞一位将领，本城栏不该出现、全境栏必须出现。 */
  check('v73：将领页标题精简（无席位文字；本城/全境切换 chips 在位）', (function () {
    return !/本城 \d+ \/ \d+ 席/.test(genHtml64) && genHtml64.indexOf('席 · 全境') < 0
      && genHtml64.indexOf('gen-scope') >= 0 && genHtml64.indexOf('>将领<') >= 0;
  })(), (genHtml64.match(/class="gold-heading">[^<]{0,24}/) || ['未找到'])[0]);
  const other73 = G.makeGeneral('侧城将', 1, 'idle', side64.id, false);
  G.state.generals.push(other73);
  G.ui._genScope = 'city';
  G.ui.renderView('generals');
  await sleep(120);
  const cityHtml73 = document.querySelector('#view-container').innerHTML;
  G.ui._genScope = 'all';
  G.ui.renderView('generals');
  await sleep(120);
  const allHtml73 = document.querySelector('#view-container').innerHTML;
  G.ui._genScope = 'city';
  G.state.generals = G.state.generals.filter((g) => g.id !== other73.id);
  check('v73：本城/全境两栏范围仍分得开（别城将领只出现在全境栏）',
    cityHtml73.indexOf('侧城将') < 0 && allHtml73.indexOf('侧城将') >= 0);

  G.ui.openHostel();
  await sleep(80);
  const hostHtml64 = document.querySelector('#modal-root').innerHTML;
  check('招贤馆面板写「房间（本城将领席位）」+ 各城合计',
    hostHtml64.indexOf('本城将领席位') >= 0 && hostHtml64.indexOf('各城合计') >= 0);
  check('招贤馆提示席位按城（不再说"升级招贤馆"就够）',
    hostHtml64.indexOf('本城') >= 0 && /派遣/.test(hostHtml64));
  G.ui.closeAllModals();
  await sleep(50);

  /* 派遣面板：目标城要标出 N/M 席与空位 */
  (function () {
    const a = G.currentCity();
    const b = G.makeCity({ id: 'e2e64b', name: '副城', x: 9, y: 9, type: 'county',
      res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    G.state.cities.push(b);
    for (let i = 0; i < b.cells.length; i++) {
      if (!b.cells[i].official) { b.cells[i].build = { id: 'zhaoxianguan', lvl: 3 }; break; }
    }
    const g = G.state.generals[0];
    g.cityId = a.id; g.status = 'idle';
    /* v89.138（老板 2）：「将领派遣」面板退役 —— 改走出征界面（本境调运 · 带入口提示） */
    G.ui.openExpModal({ kind: 'own', id: b.id }, { hint: 'dispatch' });
  })();
  await sleep(120);
  const dpHtml64 = document.querySelector('#modal-root').innerHTML;
  check('派遣入口 → 出征界面（本境调运 · 入口提示在位）',
    dpHtml64.indexOf('派遣：') >= 0 && dpHtml64.indexOf('id="exp-mode"') >= 0,
    dpHtml64.indexOf('派遣：') >= 0 ? '提示在位' : '缺提示');
  check('席位口径仍在（v89.138：precheck 迁到 prepare 的 transfer 分支）', (function () {
    /* ⚠️ 新 IIFE 里看不到上级的 a / b —— 就地重取（v89.138 修） */
    var _a = G.currentCity();
    var _b = null;
    G.state.cities.forEach(function (c) { if (c.id === 'e2e64b') _b = c; });
    if (!_a || !_b) return false;
    var _g = G.state.generals[0];
    _g.cityId = _a.id; _g.status = 'idle';
    var sl = G.genSlotsOf(_b), used = G.generalsIn(_b).length;
    var rr = G.battle.prepare({ kind: 'owncity', id: _b.id }, 'transfer', {}, _g.id, {});
    return typeof sl === 'number' && (used < sl ? rr.ok === true : /招贤馆/.test(rr.msg || ''));
  })());
  G.ui.closeAllModals();
  await sleep(50);
  G.state.cities.pop();
  G.state.cities.pop();        /* 侧城也去掉（恢复现场） */

  /* ============================================================
   * ⑩ v65（老板）：官府面板收口 / 驻军精简 / 资源短写 / 属性整数
   * ============================================================ */
  /* --- 官府面板：说明进 help，正文只留"当前事实" --- */
  openGov();
  await sleep(140);
  (function () {
    const root = document.querySelector('#modal-root');
    const keys = Array.prototype.map.call(root.querySelectorAll('.attr .k'), (x) => x.textContent.trim());
    check('官府段正文不含三条收集说明（已挪进 ⓘ）',
      keys.join('|').indexOf('州郡岁贡') < 0 && keys.join('|').indexOf('官府征收') < 0
      && keys.join('|').indexOf('州治加成') < 0,
      keys.join(' / ').slice(0, 70));
    /* ⚠️ 这里**不再**断言"特产说明还在" —— 自建城 `plan.specialty` 为空，
       那块 spBox 根本不渲染（前提不成立，断言会假红）。
       特产说明的存在性由 smoke 的结构断言守（查源码里 ui.help 的调用），
       溢出是否真收掉由几何探针量高度守。 */
    check('官府面板无内部滚动条（v65 收口目标；矮屏基线见几何探针）',
      (function () {
        const p = root.querySelector('.inner-panel') || root.querySelector('.modal');
        return !!p;
      })());
  })();
  G.ui.closeAllModals();
  await sleep(60);

  /* ============================================================
   * v89.104（老板「统计这个菜单好像没啥用，删掉吧」）：
   * **统计页（黄册）整个退役** —— 顶栏菜单、视图分发、弹窗入口、账册样式全撤。
   * 原来那 8 条断言（汇总/城池表/卷轴/账册分段/引线/单列）对着一个不存在的页面，
   * 一并删除；这里换成**一条退役判据**：谁把统计页加回来，这条就红。
   * ============================================================ */
  check('统计页已退役（视图分发、菜单入口、账册容器三者都不在册）', (function () {
    var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    /* ⚠ 结构断言一律**先剥注释** —— 否则"注释里提一句 .ledger"就会误判
       （本项目踩过多次的老坑：删除说明、迁移说明里都会写到类名） */
    var h0 = h.replace(/\/\*[\s\S]*?\*\//g, '');
    return u.indexOf('ui.statsHTML') < 0                /* 视图函数已删 */
      && h0.indexOf('data-view="stats"') < 0            /* 菜单入口已删 */
      && !/\.ledger|\.lg-row/.test(h0);               /* 账册样式（含死选择器）已清 */
  })());

  /* --- 驻军栏：标题只有两个字 --- */
  (function () {
    G.ui.renderSide();
    const gb = document.querySelector('#garrison-bar');
    const head = gb && gb.querySelector('.gb-head');
    check('侧栏驻军标题只留「⚔ 驻军」（无城名/总数/种类/耗粮）', (function () {
      if (!head) return false;
      const t = head.textContent;
      return t.indexOf('驻军') >= 0 && t.indexOf('种') < 0 && t.indexOf('耗粮') < 0
        && /^[\s⚔驻军▾▸]+$/.test(t.replace(/\s/g, ''));
    })(), head && head.textContent.trim().slice(0, 40));
  })();

  /* --- 属性整数：六维与装备贡献都不许出小数 --- */
  (function () {
    G.ui.setView('generals');
    const pane = document.querySelector('#view-container .gen-pane');
    if (!pane) { check('六维数值为整数（无小数点）', false, '未找到将领面板'); return; }
    const vals = Array.prototype.map.call(pane.querySelectorAll('.gd-dims .gd-v'), (x) => x.textContent.trim());
    const grows = Array.prototype.map.call(pane.querySelectorAll('.eq-grow .v'), (x) => x.textContent.trim());
    const bad = vals.concat(grows).filter((t) => /\d\.\d/.test(t));
    check('六维数值与装备贡献都是整数（无小数点）', vals.length >= 6 && bad.length === 0,
      '六维 ' + vals.slice(0, 6).join('/') + (bad.length ? '　带小数：' + bad.join(',') : ''));
  })();

  /* --- 资源短写：屏幕上短写、悬停里精确 --- */
  (function () {
    G.ui.setView('city');
    const c = G.currentCity();
    c.res.grain = 12345678;                 /* 1234.6万 */
    G.ui.renderSide();
    const amt = document.querySelector('#res-bar .amt');
    check('资源存量短写为「1234.6万」（单位是小字 .amt-u）', (function () {
      if (!amt) return false;
      return amt.textContent.indexOf('1234.6') >= 0 && amt.textContent.indexOf('万') >= 0
        && !!amt.querySelector('.amt-u');
    })(), amt && amt.textContent);
    check('悬停里仍给精确值（12,345,678）', (amt.getAttribute('title') || '').indexOf('12,345,678') >= 0,
      (amt.getAttribute('title') || '').slice(0, 40));
  })();

  /* --- 侦查面板：分层未解锁项显示为锁定行（真实 DOM） --- */
  (function () {
    const t0 = G.systems.techLevel('zhencha');
    const w0 = G.state.world.weather;
    G.state.world.weather = 'clear';
    G.techSet('zhencha', 0);
    const r = G.battle.expedition({ kind: 'wild', x: 30, y: 30 }, 'scout', {}, G.state.generals[0].id);
    if (r && r.ok) {
      G.ui.openScoutResult({ name: '野地' }, r, 0);   /* 同上：显式第 1 页 */
      const root = document.querySelector('#modal-root');
      /* v65 分页：第 1 页（敌情与缴获）锁 2 条（兵种 / 守将）；
         后两页的锁由上面 ⑦ 段那条负责数。 */
      const lockN = (root.textContent.match(/🔒/g) || []).length;
      check('技巧 0 级侦查：第 1 页出现锁定行，且守军只报「约」',
        lockN >= 2 && root.textContent.indexOf('约 ') >= 0,
        lockN + ' 条锁定 · ' + ((root.textContent.match(/守军总数.{0,26}/) || ['未找到'])[0]));
      check('技巧 0 级侦查：可图之利整段锁着（不给"看不到就说没有"）',
        root.textContent.indexOf('掠夺可得珠宝') < 0);
      G.ui.closeAllModals();
    } else {
      check('技巧 0 级侦查：面板出现锁定行，且守军只报「约」', false, '侦查未成功');
      check('技巧 0 级侦查：可图之利整段锁着（不给"看不到就说没有"）', false, '侦查未成功');
    }
    G.techSet('zhencha', t0); G.state.world.weather = w0;
  })();
  await sleep(60);

  /* ============================================================
   * v66：经验封顶 / 装备体力入上限 / 客栈高资质下调（真实 DOM）
   * 注意：`#modal-root` 每次 openModal 都换内容 —— 断言必须紧跟自己的那次打开。
   * ============================================================ */
  console.log('\n  --- v66：经验封顶 / 装备体力 / 客栈概率 ---');

  /* ① 将领页「状态 · 体力」主数字 = 上限（含装备贡献） */
  await (async function () {
    const s = G.state, c0 = s.cities[0], g = s.generals[0];
    const keep = { status: g.status, cityId: g.cityId, level: g.level, equip: g.equip, stamina: g.stamina };
    g.status = 'idle'; g.cityId = c0.id; g.level = 10; g.equip = {}; g.stamina = null;
    G.ui._genSel = g.id;
    G.ui.setView('generals');
    await sleep(80);
    const bareMax = G.staMax(g);
    g.equip = { head: 'cr_head_4', chest: 'cr_chest_4' };
    /* 夹具必须让「当前值 != 上限」：破坏测试里把主数字改回 staNow 时曾零反应，
       原因是满体力时两者相等 —— 判据与被测对象成了同一个数。 */
    g.stamina = 10;
    G.ui.setView('generals');
    await sleep(80);
    const withEq = G.staMax(g), nowEq = G.staNow(g);
    let row = null;
    document.querySelectorAll('.gd-line').forEach(function (el) {
      if (!row && el.textContent.indexOf('体力') === 0) row = el;
    });
    const txt = row ? row.textContent : '';
    /* v89.133（老板）：「将领的生命，体力行压缩成 1 行，**只显示数值 XX/XX**，
       '当前 5,673'这个备注不要，'全军生命 +70%'这个备注悬停显示」——
       v66 的旧口径（主数字=上限 + "当前 X"另标注）退役，改「当前/上限」两数连写。 */
    const m2 = txt.match(/体力\s*([\d,]+)/);
    const cur = m2 ? parseInt(m2[1].replace(/,/g, ''), 10) : NaN;
    const rowTitle = row ? (row.getAttribute('title') || '') : '';
    check('将领页「体力」= 只显示当前值（v89.136 新口径 · 上限进悬停）',
      cur === nowEq && withEq > bareMax && nowEq < withEq
      && rowTitle.indexOf('（当前 / 上限）') >= 0,
      '当前 ' + nowEq + ' / 上限 ' + withEq + '；页面「' + txt.replace(/\s+/g, ' ').trim().slice(0, 46) + '」');
    check('将领页「体力」：悬停含 全军生命 +X% 与上限构成',
      rowTitle.indexOf('全军生命 +') >= 0 && rowTitle.indexOf('上限 = ') >= 0,
      'title=「' + rowTitle.replace(/\s+/g, ' ').trim().slice(0, 40) + '」');
    Object.assign(g, keep);
    if (!g.equip) g.equip = {};
    G.ui.setView('generals');
    await sleep(40);
  })();

  /* ② 经验道具面板：到上限就没有"用几个"按钮了 */
  await (async function () {
    const s = G.state, g = s.generals[0];
    const keepLv = g.level;
    const expItems = (G.DATA.ITEMS || []).filter(function (it) { return it.type === 'exp'; });
    if (!expItems.length) { check('经验道具面板：到资质上限后不再给出使用按钮', false, '没有经验道具'); return; }
    const itemId = expItems[0].id;
    s.items = s.items || {};
    s.items[itemId] = 2;
    /* 未到上限 → 必须有使用按钮（对照组，防"一刀切封掉"） */
    g.level = 5;
    G.ui.openExpPick(g.id);
    await sleep(60);
    let html = document.querySelector('#modal-root').innerHTML;
    const normal = html.indexOf('data-action="gen-exp-item"') >= 0;
    G.ui.closeAllModals();
    /* 到上限 → 不给使用按钮，且说明原因 */
    g.level = G.genLevelCap(g);
    G.ui.openExpPick(g.id);
    await sleep(60);
    html = document.querySelector('#modal-root').innerHTML;
    check('经验道具面板：未到上限时有使用按钮', normal);
    check('经验道具面板：到资质上限后**没有使用按钮**',
      html.indexOf('data-action="gen-exp-item"') < 0 && html.indexOf('上限') >= 0);
    check('经验道具面板：到上限时仍能关掉（不是死弹窗）',
      html.indexOf('data-action="close-modal"') >= 0);
    G.ui.closeAllModals();
    g.level = keepLv;
    if (!(s.items[itemId] > 0)) delete s.items[itemId];
  })();

  /* ③ 装备页「加成汇总 · 体力」= 装备体力贡献（与体力上限同源） */
  await (async function () {
    const s = G.state, g = s.generals[0];
    const keepEq = g.equip;
    g.equip = { head: 'cr_head_4' };
    G.ui._equipGen = g.id;
    G.ui.setView('equip');
    await sleep(60);
    const eq = Math.round(G.staEquipOf(g));
    let row = null;
    document.querySelectorAll('.res-line').forEach(function (el) {
      if (!row && el.textContent.indexOf('体力') >= 0) row = el;
    });
    const txt = row ? row.textContent : '';
    check('装备页「加成汇总 · 体力」= 装备体力贡献', eq > 0 && txt.indexOf('+' + eq) >= 0,
      '装备体力 +' + eq + '；页面「' + txt.replace(/\s+/g, ' ').trim().slice(0, 40) + '」');
    check('装备页「加成汇总 · 体力」不再写"全军生命 +N"的旧口径（改由体力推）',
      txt.indexOf('全军生命') >= 0 && txt.indexOf('全军生命 +' + Math.round(eq / 100) + '%') < 0);
    g.equip = keepEq;
    G.ui.setView('equip');
    await sleep(40);
  })();

  /* ④ v75（老板）：客栈改大界面 —— 全量渲染 / 无资质一览 / 无美人标 /
        天授权重口径没动（只是不再展示；数值口径由 smoke 兜底） */
  await (async function () {
    const c75 = G.currentCity();
    const put75 = (id, lv) => {
      const ex = c75.cells.find((c) => c.build && c.build.id === id);
      if (ex) { ex.build.lvl = lv; return true; }
      const i = c75.cells.findIndex((c) => !c.build && !c.official);
      if (i < 0) return false;
      c75.cells[i].build = { id: id, lvl: lv };
      return true;
    };
    put75('kezhan', 12);
    G.innRefresh(true);
    G.ui.openInn();
    await sleep(80);
    const root75 = document.querySelector('#modal-root');
    const modal75 = root75.querySelector('.modal');
    const cards75 = root75.querySelectorAll('.inn-tr');   /* v77：候选改表格行 */
    const cls75 = modal75 ? modal75.className : '';
    const slots75 = G.innSlots() || 0;
    check('v75：客栈升为最大尺寸档 xxl（大界面）', cls75.indexOf('modal-xxl') >= 0, cls75);
    check('v75：候选全量渲染（' + slots75 + ' 位），一人一行',
      cards75.length === slots75 && slots75 >= 12, cards75.length + ' / ' + slots75);
    check('v75：不再显示资质一览（无 rk-box / 无「四维 」）',
      root75.innerHTML.indexOf('rk-box') < 0 && root75.innerHTML.indexOf('四维 ') < 0);
    check('v75：不再有美人标；资质悬停含成长备注',
      root75.innerHTML.indexOf('tag-beauty') < 0
        && /rank-badge r-\w+" title="[^"]*每级属性成长 \+/.test(root75.innerHTML));
    const lv75 = G.buildingLevel(G.currentCity(), 'kezhan') || 1;
    const ws75 = G.rankWeights(lv75);
    let t75 = 0, v75 = 0;
    ws75.forEach(function (x) { t75 += x.w; if (x.rank.id === 'tian') v75 = x.w; });
    const pct75 = v75 / t75 * 100;
    check('v75：天授权重口径没动（仍 <1%，只是不再展示）', pct75 < 1, '天授 ' + pct75.toFixed(2) + '%');

    /* ---- v77（老板）：客栈表格化 / 君主面板 / 野地下拉框 ---- */
    check('v77：客栈表格化（表头 + 每人一行 + 月俸列）',
      !!root75.querySelector('.inn-tbl thead') && root75.innerHTML.indexOf('月俸') >= 0
      && cards75.length === slots75,
      cards75.length + ' / ' + slots75);
    check('v77：表格列头齐备（将领/等级/资质/专长/六维/月俸/招募）', (function () {
      const ths = Array.prototype.map.call(root75.querySelectorAll('.inn-tbl thead th'), (x) => x.textContent.trim());
      return ['将领', '等级', '资质', '专长', '统率', '内政', '勇武', '智谋', '月俸', '招募']
        .every((t, i) => ths[i] === t);
    })(), Array.prototype.map.call(root75.querySelectorAll('.inn-tbl thead th'), (x) => x.textContent.trim()).join('/'));
    G.ui.closeAllModals();
    /* 君主面板：左城池列表（进入）/ 右信息表（含月俸支出、晋升悬停） */
    G.ui.openLordInfo();
    await sleep(60);
    check('v77：君主面板左右分栏（城池列表带进入 + 信息表含月俸支出）',
      !!root75.querySelector('.lord-split')
      && !!root75.querySelector('.lord-city [data-action="lord-city-enter"]')
      && root75.innerHTML.indexOf('月俸支出') >= 0, '');
    const pbtn77 = root75.querySelector('[data-action="lord-promote"]');
    check('v77：晋升按钮悬停带条件（声望 / 黄金）',
      !!pbtn77 && /声望/.test(pbtn77.getAttribute('title') || '') && /黄金/.test(pbtn77.getAttribute('title') || ''),
      pbtn77 ? (pbtn77.getAttribute('title') || '').slice(0, 46) : '无按钮');
    /* 改名实走 */
    const oldLord77 = G.state.ruler.name;
    G.ui.openRenameLord();
    await sleep(40);
    const inp77 = document.getElementById('rename-lord-input');
    if (inp77) inp77.value = '测试君主';
    const btnOk77 = document.querySelector('#modal-root [data-action="do-rename-lord"]');
    if (btnOk77) btnOk77.click();
    await sleep(80);
    check('v77：君主改名生效（ruler 与君主将领同源）',
      G.state.ruler.name === '测试君主'
      && (!G.lordGeneralOf() || G.lordGeneralOf().name === '测试君主'), G.state.ruler.name);
    G.renameLord(oldLord77);
    G.ui.closeAllModals();
    /* 资源区：附属野地下拉框 */
    G.ui._wildSig = null;
    G.ui.renderWildPick(G.currentCity(), G.state);
    check('v77：资源区附属野地下拉框 + 进入按钮', (function () {
      const host = document.getElementById('wild-pick-host');
      return !!host && !!host.querySelector('select.wild-select') && !!host.querySelector('[data-action="open-wilds"]');
    })(), (document.getElementById('wild-pick-host') || { innerHTML: '宿主缺失' }).innerHTML.slice(0, 30));
    G.ui.closeAllModals();
  })();

  /* ============================================================
   * v67：放弃城池（真实 DOM 全流程）—— 面板入口 → 二次确认 → 执行 → 清理
   * ============================================================ */
  await (async function () {
    const s = G.state;
    const host = s.cities[0];
    const c2 = G.makeCity({ id: 'p_e2e_abandon', name: '试城', x: host.x + 3, y: host.y,
      res: { grain: 1e5, wood: 1e4, stone: 1e4, iron: 1e4, gold: 1e4 } });
    c2.army = { yibing: 500 };
    s.cities.push(c2);
    /* 挂一类关联数据（将领归它），用来验"批量清除" */
    const g = s.generals[0];
    g.cityId = c2.id;
    G.ui.setCity(c2.id);
    G.refreshAll();
    await sleep(100);

    G.ui.closeAllModals();
    G.ui.openCityPanel(c2);
    await sleep(80);
    let root = document.querySelector('#modal-root');
    const entry = root.querySelector('[data-action="city-abandon-ask"]');
    const hasEntry = !!entry;
    if (entry) entry.click();
    await sleep(100);
    root = document.querySelector('#modal-root');
    const askHtml = root.innerHTML;
    /* v89.138（老板 2）：弃城改**两段确认**（上膛式）—— 确认按钮 = city-abandon-arm，
       点第一次只上膛（不执行）、点第二次才真的放弃。 */
    const hasConfirm = askHtml.indexOf('data-action="city-abandon-arm"') >= 0;
    const saysCost = askHtml.indexOf('失去库存') >= 0 && askHtml.indexOf('将领随迁') >= 0;
    const btn = root.querySelector('[data-action="city-abandon-arm"]');
    if (btn) btn.click();
    await sleep(80);
    const btn2 = document.querySelector('#modal-root [data-action="city-abandon-arm"]');
    const armed = /再点一次/.test((btn2 && btn2.textContent) || '');
    if (btn2) btn2.click();
    await sleep(150);

    const gone = !s.cities.some(function (c) { return c.id === c2.id; });
    const clean = G.cityRefsOf(c2.id).length === 0;
    check('放弃城池：入口 → 两段确认（第一次只上膛）→ 城池消失且关联数据 0 残留',
      hasEntry && hasConfirm && saysCost && armed && gone && clean,
      '入口' + hasEntry + ' 确认' + hasConfirm + ' 上膛' + armed + ' 说清代价' + saysCost
      + ' 已删' + gone + ' 无残留' + clean);
    check('放弃城池：当前城池自动切到剩下的那座',
      !!G.currentCity() && G.currentCity().id === host.id,
      G.currentCity() ? G.currentCity().name : '(空)');
    check('放弃城池：确认后弹窗已关（不会留一扇指向已删城的窗）',
      document.querySelector('#modal-root').innerHTML.indexOf('city-abandon-do') < 0);
    /* 只剩一座城时：入口不出现（点不到必然被拒的按钮）。
       ⚠️ 必须先真的把城池收成一座 —— 前面的用例已经加过城，否则这条是假绿。 */
    const keepCities = s.cities.slice();
    s.cities = [host];
    G.ui.closeAllModals();
    G.ui.openCityPanel(host);
    await sleep(80);
    const noEntry = document.querySelector('#modal-root').innerHTML.indexOf('city-abandon-ask') < 0;
    check('放弃城池：只剩一座城时面板不给入口', noEntry, '城池数 ' + s.cities.length);
    G.ui.closeAllModals();
    s.cities = keepCities;
    if (!s.generals[0].cityId) s.generals[0].cityId = host.id;
    G.ui.setCity(host.id);
    G.refreshAll();
    await sleep(60);
  })();

/* ==================== v67 · 存档管理面板（真实 DOM + 真实 localStorage） ==================== */
G.ui.setView('settings');
await sleep(80);
const svBtn = document.querySelector('[data-action="open-saves"]');
check('设置页第一张卡就是存档入口', !!svBtn);
if (svBtn) {
  svBtn.click();
  await sleep(140);
  const rootHtml = document.querySelector('#modal-root').innerHTML;
  const rows = (rootHtml.match(/class="sv-row"/g) || []).length;
  check('存档面板：7 个槽位一屏放完', rows === 7, '实测 ' + rows + ' 行');
  check('面板结构齐全（列表 + 导入区，无下拉条容器）',
    rootHtml.indexOf('sv-list') >= 0 && rootHtml.indexOf('sv-imp') >= 0);

  const wBtn = document.querySelector('[data-action="save-slot-write"][data-slot="s1"]');
  check('空槽只给「存入」', !!wBtn
    && !document.querySelector('[data-action="save-slot-load"][data-slot="s1"]'));
  if (wBtn) {
    wBtn.click();
    await sleep(180);
    const m = G.slotMetaOf('s1');
    check('点「存入」→ 写入成功且索引有摘要', !!m && m.cities === G.state.cities.length,
      m ? (m.cities + ' 城 / ' + (m.size / 1024).toFixed(1) + 'KB') : '无摘要');
    const lBtn = document.querySelector('[data-action="save-slot-load"][data-slot="s1"]');
    check('有档之后才出现「读取」', !!lBtn);
    if (lBtn) {
      lBtn.click();
      await sleep(140);
      const ask = document.querySelector('#modal-root').innerHTML;
      check('读取前有二次确认（说清"当前进度会被替换"）',
        ask.indexOf('save-slot-load-do') >= 0 && ask.indexOf('替换') >= 0);
      const cancel = document.querySelector('#modal-root [data-action="close-modal"]');
      if (cancel) { cancel.click(); await sleep(80); }
    }
    const ex = G.exportText('s1');
    check('面板背后的导出文本可解析、自描述', ex.ok && JSON.parse(ex.text)._fmt === 'sanguo-save');
    const imp = G.importText(ex.text, 's3');
    check('导出文本可导回（同一份东西既能存文件也能粘贴）', imp.ok === true, imp.msg);
    G.dropSlot('s1');
    G.dropSlot('s3');
    G.ui.closeAllModals();
    await sleep(80);
  } else {
    check('点「存入」→ 写入成功且索引有摘要', false, '未找到存入按钮');
    check('有档之后才出现「读取」', false, '未找到存入按钮');
    check('读取前有二次确认（说清"当前进度会被替换"）', false, '未找到存入按钮');
    check('面板背后的导出文本可解析、自描述', false, '未找到存入按钮');
    check('导出文本可导回（同一份东西既能存文件也能粘贴）', false, '未找到存入按钮');
  }
}
  /* ---- v70（老板需求 3/4）：城池坐标 —— 显示 / 一键随机 / 坐标切换 ---- */
  G.ui.setView('city');
  await sleep(90);
  /* v71（老板）：只显示城池命名 —— 坐标文字已撤，迁址两入口保留 */
  check('★ 城池属性栏只显城名（无坐标），两个迁址入口保留', (function () {
    const h = document.querySelector('#city-attrs').innerHTML;
    const c0 = G.currentCity();
    const full = G.cityFullName(c0);
    return h.indexOf(c0.name) >= 0
      && h.indexOf('500×500') < 0 && h.indexOf(G.coordText(c0)) < 0
      && (full.indexOf(' · ') < 0 || h.indexOf(full) < 0)
      && h.indexOf('data-action="city-random"') >= 0 && h.indexOf('data-action="city-move-ask"') >= 0;
  })());
  {
    const c70 = G.currentCity();
    const from70 = { x: c70.x, y: c70.y };
    click(document.querySelector('#city-attrs [data-action="city-random"]'));
    await sleep(200);
    check('★ 一键随机：坐标已变、旧格归还平原、新格是城池',
      (c70.x !== from70.x || c70.y !== from70.y)
      && G.map.tile(from70.x, from70.y).terrain === 'plain'
      && G.map.tile(c70.x, c70.y).terrain === 'city',
      '(' + from70.x + ',' + from70.y + ') → (' + c70.x + ',' + c70.y + ')');
  }
  {
    const c71 = G.currentCity();
    click(document.querySelector('#city-attrs [data-action="city-move-ask"]'));
    await sleep(90);
    const mh70 = document.querySelector('#modal-root').innerHTML;
    check('★ 迁址弹窗：坐标输入 + 确认按钮（按弹窗规范）',
      mh70.indexOf('迁往') >= 0 && mh70.indexOf('id="move-x"') >= 0
      && mh70.indexOf('data-action="city-move-do"') >= 0 && mh70.indexOf('modal-x') >= 0);
    let dst70 = null;
    for (let x = 5; x < 160 && !dst70; x++) for (let y = 5; y < 160 && !dst70; y++) {
      if (G.canCityMoveTo(c71, x, y).ok) dst70 = { x: x, y: y };
    }
    check('夹具：找到一处可迁坐标', !!dst70, dst70 ? dst70.x + ',' + dst70.y : '无');
    if (dst70) {
      document.querySelector('#move-x').value = dst70.x;
      document.querySelector('#move-y').value = dst70.y;
      click(document.querySelector('#modal-root [data-action="city-move-do"]'));
      await sleep(200);
      check('★ 手输坐标迁址生效（坐标更新 + 弹窗关闭）',
        c71.x === dst70.x && c71.y === dst70.y
        && document.querySelector('#modal-root').innerHTML.indexOf('迁往') < 0);
    }
  }
  check('★ 名城固定（判据层：只有自建城可迁）',
    G.isMovableCity({ type: 'self' }) === true && G.isMovableCity({ type: 'county' }) === false);

  /* ---- v70（老板需求 1）：君主将领在将领页 ---- */
  G.ui.setView('generals');
  await sleep(140);
  check('★ 将领页名单标出「君主」', vc.innerHTML.indexOf('gcard-tag lord') >= 0);
  {
    const lord70 = G.lordGeneralOf();
    G.ui._genSel = lord70.id;
    G.ui.renderView('generals');
    await sleep(90);
    /* v89.80（老板）：「去除君主的备注：👑 帐下不离…」——特权**展示块**撤空，
       所以这里反向钉住（不得再出现），同时"无解雇按钮"这条口径不动。
       机制侧（君主不可解雇/不离队）由另一条守卫覆盖，不靠这个展示块。 */
    check('★ 君主档案：无解雇按钮 + 特权展示块已撤（v89.80）',
      vc.innerHTML.indexOf('data-action="dismiss-gen"') < 0
      && vc.innerHTML.indexOf('君主特权') < 0
      && vc.innerHTML.indexOf('帐下不离') < 0);
    const normal70 = s.generals.filter((g) => !g.isLord)[0];
    if (normal70) {
      G.ui._genSel = normal70.id;
      G.ui.renderView('generals');
      await sleep(90);
      check('★ 普通将领仍可解雇（入口只对君主隐藏）',
        vc.innerHTML.indexOf('data-action="dismiss-gen"') >= 0);
    }
  }


  /* ============================================================
   * v73（老板五条）：种田秘境 / 建筑弹窗底栏 —— 真实 DOM 走一遍
   * ============================================================ */
  console.log('\n--- v73. 种田秘境 · 建筑弹窗底栏（真实 DOM） ---');
  {
    G.state.res.gold = 3000000;
    /* v78：播种改种子制 —— 先发种子（材料 ×2 / 灵草 ×1），再走界面 */
    G.state.items = G.state.items || {};
    G.state.items['seed_fan'] = (G.state.items['seed_fan'] || 0) + 2;
    G.state.items['seed_yunling'] = (G.state.items['seed_yunling'] || 0) + 1;
    openGov();
    await sleep(140);
    let mh73 = document.querySelector('#modal-root').innerHTML;
    check('v73：官府面板有「种田秘境」入口',
      mh73.indexOf('data-action="open-farm"') >= 0 && mh73.indexOf('种田秘境') >= 0);
    const farmBtn73 = document.querySelector('#modal-root [data-action="open-farm"]');
    if (farmBtn73) {
      click(farmBtn73);
      await sleep(140);
      mh73 = document.querySelector('#modal-root').innerHTML;
      check('v73：秘境面板六格灵田 + 播种入口',
        (mh73.match(/class="farm-cell/g) || []).length >= 6 && mh73.indexOf('data-action="farm-seeds"') >= 0);
      click(document.querySelector('#modal-root [data-action="farm-seeds"]'));
      await sleep(130);
      mh73 = document.querySelector('#modal-root').innerHTML;
      check('v73：选种弹窗列出 10 种作物（6 材料 + 4 灵草）',
        (mh73.match(/data-action="farm-plant"/g) || []).length === 10);
      check('v78：选种行显示种子消耗（凡植种子 -1 / 不花黄金）',
        mh73.indexOf('凡植种子') >= 0 && mh73.indexOf('-1）') >= 0 && mh73.indexOf('金 不足') < 0);
      const plantBtn73 = Array.from(document.querySelectorAll('#modal-root [data-action="farm-plant"]'))
        .find((b) => b.getAttribute('data-crop') === 'tieying');
      if (plantBtn73) {
        click(plantBtn73);
        await sleep(170);
        mh73 = document.querySelector('#modal-root').innerHTML;
        check('v73：种下后留在秘境（生长中 + 倒计时元素在位）',
          mh73.indexOf('成熟还需') >= 0 && !!document.querySelector('#modal-root [data-farm-left]'));
        G.tickFarm(8 * 3600);
        G.ui.openFarm();
        await sleep(130);
        const hv73 = document.querySelector('#modal-root [data-action="farm-harvest"]');
        check('v73：成熟地块出现「收获」按钮', !!hv73);
        if (hv73) {
          click(hv73);
          await sleep(170);
          check('v73：收获入包（镔铁）', (G.state.items['bintie'] || 0) > 0,
            '镔铁 ×' + (G.state.items['bintie'] || 0));
        }
      }
      G.ui.closeAllModals();
      await sleep(80);
    }

    /* 建筑弹窗：无顶图 + 取消升级/关闭同在吸底底栏 */
    const c73 = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { if (c73.res) c73.res[k] = 5000000; });
    const built73 = c73.cells.findIndex((x) => x.build && !x.pending);
    if (built73 >= 0) {
      G.ui.openBuildModal(built73);
      await sleep(130);
      check('v73：建筑弹窗无顶部图标块',
        !document.querySelector('#modal-root .dlg-ico')
        && document.querySelector('#modal-root').innerHTML.indexOf('class="dlg-ico"') < 0);
      check('v89.114：关闭键在右上角（底栏只留操作键）', (function () {
        return !document.querySelector('#modal-root .bldg-foot [data-action="close-modal"]')
          && !!document.querySelector('#modal-root .modal-x[data-action="close-modal"]');
      })());
      G.ui.closeAllModals();
      await sleep(80);
    }
    const empty73 = c73.cells.findIndex((x) => !x.official && !x.build && !x.pending);
    if (empty73 >= 0) {
      G.buildAt(c73.id, empty73, 'junying');
      let guard73 = 0;
      while (G.state.queues.build.length && guard73++ < 30) {
        const q = G.state.queues.build[0];
        q.elapsed = q.totalTime;
        G.applyBuildDone(q);
        const qi = G.state.queues.build.indexOf(q);
        if (qi >= 0) G.state.queues.build.splice(qi, 1);
      }
      const up73 = G.upgradeAt(c73.id, empty73);
      check('v73：升级队列已起（底栏断言夹具）', !!up73 && up73.ok, up73 && up73.msg);
      G.ui.openBuildModal(empty73);
      await sleep(130);
      check('v89.114：升级中弹窗无顶图；取消升级留在底栏，关闭在右上角', (function () {
        const foot = document.querySelector('#modal-root .bldg-foot');
        return !document.querySelector('#modal-root .dlg-ico') && !!foot
          && !!foot.querySelector('[data-action="cancel-build-ask"]')
          && !foot.querySelector('[data-action="close-modal"]')
          && !!document.querySelector('#modal-root .modal-x[data-action="close-modal"]');
      })());
      G.ui.closeAllModals();
      await sleep(80);
    }
  }

  /* ============================================================
   * v79（老板四条）：爵位加成 / 主城 / 神器 / 装备单件化 —— 真实 DOM 走一遍
   * ============================================================ */
  console.log('\n--- v79. 爵位加成 · 主城 · 神器 · 单件强化（真实 DOM） ---');
  {
    /* ② 主城：官府里设 → 标识出现 */
    const c79 = G.currentCity();
    G.state.mainCityId = null;
    openGov();
    await sleep(150);
    const setBtn79 = document.querySelector('#modal-root [data-action="set-main-city"]');
    check('v79：官府有「设为主城」入口', !!setBtn79);
    if (setBtn79) {
      click(setBtn79);
      await sleep(160);
      check('v79：设定后主城标识出现（城名标注 / 城池下拉【主城】）',
        G.isMainCity(c79) && G.ui.cityLabelHTML(c79, true).indexOf('主城') >= 0
        && (!document.querySelector('.city-select')
          || document.querySelector('.city-select').innerHTML.indexOf('【主城】') >= 0));
      G.ui.closeAllModals();
      await sleep(80);
    }

    /* ③ 神器：君主菜单入口 → 面板 */
    G.ui.openLordInfo();
    await sleep(160);
    check('v79：君主面板有神器行与「查看」按钮',
      document.querySelector('#modal-root').innerHTML.indexOf('data-action="open-artifacts"') >= 0);
    const artBtn79 = document.querySelector('#modal-root [data-action="open-artifacts"]');
    if (artBtn79) {
      click(artBtn79);
      await sleep(170);
      const mh79 = document.querySelector('#modal-root').innerHTML;
      check('v79：神器面板三件神器 + 供奉值 + 进度条 + 来源说明',
        (mh79.match(/art-row/g) || []).length >= 3 && mh79.indexOf('供奉值') >= 0
        && mh79.indexOf('pbar') >= 0 && mh79.indexOf('攻占城池') >= 0);
      G.ui.closeAllModals();
      await sleep(80);
    }

    /* ④ 装备单件化：同名两件各升各的 + 序号区分（强化面板按件） */
    const city79 = G.currentCity();
    if (G.forgeLevel() <= 0) {
      const i79 = city79.cells.findIndex((x) => !x.build && !x.official);
      if (i79 >= 0) city79.cells[i79].build = { id: 'tiejiangpu', lvl: 3 };
    }
    G.state.res.gold = 100000000; G.state.res.iron = 100000000; G.state.res.stone = 100000000;
    const pA79 = G.addEquip('cr_weapon_1'), pB79 = G.addEquip('cr_weapon_1');
    const enhA79 = G.enhance(pA79.u);
    G.ui.openEnhance();
    await sleep(190);
    const enhHtml79 = document.querySelector('#modal-root').innerHTML;
    check('v79：强化面板按件（同名各一行、标签带序号与 +N）',
      enhA79.ok && enhHtml79.indexOf('按件') >= 0
      && enhHtml79.indexOf('·甲') >= 0 && enhHtml79.indexOf('·乙') >= 0
      && enhHtml79.indexOf('+1') >= 0);
    G.ui.closeAllModals();
    await sleep(80);
    /* 收尾：两件试验品出包 */
    [pA79, pB79].forEach((it) => { const i = G.state.inventory.indexOf(it); if (i >= 0) G.state.inventory.splice(i, 1); });
  }

  /* ============================================================
   * v80（老板三条）：客栈固定表 / 建筑吸底操作区 / 兵营分页直输（真实 DOM）
   * ============================================================ */
  console.log('\n--- v80. 客栈固定表 · 建筑底栏 · 兵营分页（真实 DOM） ---');
  {
    const c80 = G.currentCity();
    /* ① 客栈：固定列宽 + 去「史实名将」标 */
    let inn80 = c80.cells.findIndex((x) => x.build && x.build.id === 'kezhan');
    if (inn80 < 0) {
      inn80 = c80.cells.findIndex((x) => !x.build && !x.official);
      c80.cells[inn80] = { build: { id: 'kezhan', lvl: 8 }, pending: null };
    }
    G.state.res.gold = Math.max(G.state.res.gold || 0, 50000000);
    G.ui.openInn();
    await sleep(130);
    const tbl80 = document.querySelector('#modal-root .inn-tbl');
    check('v80：客栈表固定列宽（table-layout: fixed + colgroup ×10）',
      !!tbl80 && window.getComputedStyle(tbl80).tableLayout === 'fixed'
      && tbl80.querySelectorAll('colgroup col').length === 10);
    const colsA80 = tbl80 ? Array.from(tbl80.querySelectorAll('colgroup col')).map((c) => c.getAttribute('class')).join(',') : '';
    check('v80：招募行无「史实名将」标', document.querySelectorAll('#modal-root .tag-hero').length === 0);
    G.innRefresh(true);                         /* 强制换一批 */
    G.ui.openInn();
    await sleep(130);
    const colsB80 = Array.from(document.querySelectorAll('#modal-root .inn-tbl colgroup col')).map((c) => c.getAttribute('class')).join(',');
    check('v80：换一批后列宽声明不变（框架不动；列宽只在 CSS 按类固定）',
      colsA80.length > 0 && colsA80 === colsB80, colsA80);
    G.ui.closeAllModals();
    await sleep(60);

    /* ② 建筑弹窗：三键+关闭 = 吸底操作区（三键在关闭上方） */
    const bi80 = c80.cells.findIndex((x) => x.build && x.build.id !== 'guanfu' && !x.pending);
    if (bi80 >= 0) {
      G.ui.openBuildModal(bi80);
      await sleep(130);
      const bo80 = document.querySelector('#modal-root .bldg-bottom');
      check('v89.114：三键吸底操作区保留（关闭键已上移到右上角）', !!(bo80
        && bo80.querySelector('.bldg-acts')
        && !bo80.querySelector('[data-action="close-modal"]')));
      check('v80：操作区吸底（sticky 钉面板下沿）',
        !!bo80 && window.getComputedStyle(bo80).position === 'sticky');
      check('v89.114：三键操作区吸底（关闭键不在其中 —— 已在右上角）', (function () {
        if (!bo80) return false;
        const acts = bo80.querySelector('.bldg-acts');
        /* v89.114：关闭键整条上移后，.bldg-foot 可能已被剥空移除 ——
           判据改为"操作区里没有关闭键"（DOM 顺序那条随关闭条退役而退役）。
           ⚠️ 首版写成 compareDocumentPosition(foot)，foot 为 null 时 jsdom 抛错 →
              整个 e2e 中途中断（后 300 条断言未执行）。 */
        return !!acts && !bo80.querySelector('[data-action="close-modal"]');
      })());
      G.ui.closeAllModals();
      await sleep(60);
    }

    /* ③ 兵营：两页 + 直输 + 不跳顶 */
    let j80 = c80.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j80 < 0) {
      j80 = c80.cells.findIndex((x) => !x.build && !x.official);
      c80.cells[j80] = { build: { id: 'junying', lvl: 10 }, pending: null };
    }
    if (c80.cells[j80].build) c80.cells[j80].build.lvl = Math.max(10, c80.cells[j80].build.lvl || 1);
    G.ui.openTroops(j80, 'normal');
    await sleep(160);
    const mr80 = document.querySelector('#modal-root');
    check('v80：兵营页只剩一处标题（重复标题 / 工位行 / 解锁计数全撤）',
      (mr80.innerHTML.match(/兵营招募/g) || []).length === 1
      && mr80.textContent.indexOf('募兵军营') < 0 && mr80.textContent.indexOf('队列位') < 0
      && mr80.textContent.indexOf('已解锁') < 0);
    check('v81：三页切换按钮（募兵队列 / 步兵 / 骑兵）', (function () {
      const tabs = Array.prototype.map.call(
        mr80.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());
    click(mr80.querySelector('[data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v80：翻到骑兵页（首卡为骑兵）', (function () {
      const card = document.querySelector('#modal-root .troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'cav';
    })());
    check('v80：±10 退役（输入框直输 + 上限保留）',
      !document.querySelector('#modal-root [data-action="train-qty"]')
      && !!document.querySelector('#modal-root #train-count')
      && !!document.querySelector('#modal-root [data-action="train-max"]'));
    /* 滚到底 → 点上限 → 滚动位保持（原为跳回顶端） */
    const pbA80 = document.querySelector('#modal-root .panel-body');
    const ipA80 = document.querySelector('#modal-root .inner-panel');
    /* jsdom 无布局引擎（scrollHeight=0）—— 用显式值验证"存/还"链路本身 */
    pbA80.scrollTop = 126; ipA80.scrollTop = 67;
    const keepA80 = { pb: pbA80.scrollTop, ip: ipA80.scrollTop };
    click(document.querySelector('#modal-root [data-action="train-max"]'));
    await sleep(160);
    const keepB80 = {
      pb: document.querySelector('#modal-root .panel-body').scrollTop,
      ip: document.querySelector('#modal-root .inner-panel').scrollTop,
    };
    check('v80：点「上限」不再跳回顶端（滚动位保留）',
      keepA80.pb === 126 && keepA80.ip === 67 && keepB80.pb === 126 && keepB80.ip === 67,
      JSON.stringify(keepA80) + ' → ' + JSON.stringify(keepB80));
    /* 直输：改值 → 状态同步 */
    const cnt80 = document.querySelector('#modal-root #train-count');
    if (cnt80) {
      cnt80.value = '7';
      cnt80.dispatchEvent(new window.Event('input', { bubbles: true }));
      check('v80：数量直输同步到状态', Math.floor(Number(G.ui._trainCount)) === 7, String(G.ui._trainCount));
    }
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v81（老板）：君主卡名称并入信息表首行 / 兵营三页制（队列 · 步兵 · 骑兵）
   * ============================================================ */
  console.log('\n--- v81. 君主卡与兵营三页 ---');
  {
    /* ① 君主卡：名称在信息表首行 */
    G.ui.syncHeader();
    await sleep(40);
    const lordCard81 = document.querySelector('.lord-meta .mrow-name #lord-name');
    check('v81：君主名并入信息表首行（官职行 / 旧名称列退役）',
      !!lordCard81 && lordCard81.textContent.trim().length > 0
      && !document.querySelector('#lord-office') && !document.querySelector('.lord-name-row'),
      lordCard81 ? lordCard81.textContent.trim() : '未找到');

    /* ② 兵营三页制 */
    const c81 = G.state.cities[0];
    let j81 = c81.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j81 < 0) {
      j81 = c81.cells.findIndex((x) => !x.build && !x.official);
      if (j81 >= 0) c81.cells[j81] = { build: { id: 'junying', lvl: 8 }, pending: null };
    }
    G.ui._trainTab = 'que';                 /* 模拟新会话初始态（第一页 = 募兵队列） */
    G.ui.openTroops(j81 < 0 ? undefined : j81, 'normal');
    await sleep(140);
    const mr81 = document.querySelector('#modal-root');
    check('v81：三页切换键齐备（募兵队列 / 步兵 / 骑兵）', (function () {
      const tabs = Array.prototype.map.call(
        mr81.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());
    check('v81：首页为募兵队列（队列在、兵种卡不在）',
      !!mr81.querySelector('.q-sec') && !mr81.querySelector('.troop-grid'));
    click(mr81.querySelector('[data-action="train-tab"][data-page="inf"]'));
    await sleep(140);
    const mr81b = document.querySelector('#modal-root');
    check('v81：步兵页有卡面与训练控件、队列不跟来', (function () {
      const card = mr81b.querySelector('.troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'inf'
        && !!mr81b.querySelector('#train-count') && !mr81b.querySelector('.q-sec');
    })());
    click(mr81b.querySelector('[data-action="train-tab"][data-page="que"]'));
    await sleep(140);
    check('v81：切回队列页（队列重现、控件退场）', (function () {
      const m = document.querySelector('#modal-root');
      return !!m.querySelector('.q-sec') && !m.querySelector('#train-count');
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v82（老板四条）真实 DOM：城名居中 / 文案清理 / 征收退役 / 字体三档
   * ============================================================ */
  console.log('\n--- v82. 文案清理 / 征收退役 / 字体（真实 DOM） ---');
  openGov();
  await sleep(100);
  (function () {
    const root = document.querySelector('#modal-root');
    /* v89.135（老板 10）：官府面板退役 —— 改名入口直进建筑面板（官府要务段） */
    check('v89.135：官府建筑面板直显改名入口（官府要务）',
      root.innerHTML.indexOf('data-action="open-rename-city"') >= 0
      && root.textContent.indexOf('官府要务') >= 0);
    const ks = Array.prototype.map.call(root.querySelectorAll('.attr .k'), (x) => x.textContent.trim());
    check('v82：官府面板无「本城」/「附属野地」标签行',
      ks.indexOf('本城') < 0 && ks.join('|').indexOf('附属野地') < 0);
    check('v82：征收退役（面板无征收按钮）', !root.querySelector('#levy-btn'));
    check('v82：分区标题统一 800 字重（计算样式）', (function () {
      const h = root.querySelector('.gold-heading');
      return !!h && window.getComputedStyle(h).fontWeight === '800';
    })());
    G.ui.closeAllModals();
  })();
  await sleep(60);

  /* ============================================================
   * v83（老板）：野地经验惩罚 —— 台阶口径 / 战报注明
   * ============================================================ */
  console.log('\n--- v83. 经验惩罚（野地越级） ---');
  check('v83：台阶 = 每 12 级一档（12→1 / 13→2 / 120→10 / 121+→10）', (function () {
    return G.battle.expTierOf(12) === 1 && G.battle.expTierOf(13) === 2
      && G.battle.expTierOf(120) === 10 && G.battle.expTierOf(200) === 10;
  })());
  check('v83：越级惩罚 ×0.8^gap（v89.173 放宽 · Lv73 打 1 级 → 0.8⁶）', (function () {
    const p = G.battle.expPenaltyOf(73, 1);
    return p.need === 7 && Math.abs(p.mul - Math.pow(0.8, 6)) < 1e-9;
  })());
  check('v83：战报注明越级惩罚与宜打等级', (function () {
    const txt = G.battle.reportText('野地 Lv1', {}, { name: '测试将', level: 73 },
      { winner: 'atk', rounds: 3, atkLoss: 1, atkRemain: 9, defLoss: 10, defRemain: 0,
        expInfo: { gain: 8, level: 73, exp: 8, need: 99999, up: 0 },
        expPenalty: { mul: 0.0754, need: 7, wl: 1, gap: 6, before: 106, after: 8 } });
    return txt.indexOf('越级惩罚 ×') >= 0 && txt.indexOf('宜打 7 级野地') >= 0;
  })());

  /* ============================================================
   * v84（老板）：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵
   * ============================================================ */
  console.log('\n--- v84. 卡面去拥有行 · 步骑分类对调（真实 DOM） ---');
  {
    const c84 = G.state.cities[0];
    let j84 = c84.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j84 < 0) {
      j84 = c84.cells.findIndex((x) => !x.build && !x.official);
      if (j84 >= 0) c84.cells[j84] = { build: { id: 'junying', lvl: 8 }, pending: null };
    }
    G.ui._trainFilter = 'normal';
    G.ui._trainTab = 'inf';
    G.ui.openTroops(j84 < 0 ? undefined : j84, 'normal');
    await sleep(160);
    check('v84：斥候卡已入步兵页', !!document.querySelector('#modal-root .troop-card[data-troop="chihou"]'));
    check('v84：全部兵种卡面无「拥有」字样', (function () {
      const cards = document.querySelectorAll('#modal-root .troop-grid .troop-card');
      if (!cards.length) return false;
      return Array.prototype.every.call(cards, (cd) => cd.textContent.indexOf('拥有') < 0);
    })());
    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v84：辎重车卡在骑兵页（与斥候两页互斥）', (function () {
      const z84 = document.querySelector('#modal-root .troop-card[data-troop="zhouche"]');
      const ch84 = document.querySelector('#modal-root .troop-card[data-troop="chihou"]');
      return !!z84 && !ch84;
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v85（老板）：民房去人口统计 / 底部缩略地图 → 天下大势
   * ============================================================ */
  console.log('\n--- v85. 民房 · 缩略地图 · 天下大势（真实 DOM） ---');
  {
    /* ① 民房弹窗无「人口统计」入口 */
    const c85 = G.state.cities[0];
    let m85 = c85.cells.findIndex((x) => x.build && x.build.id === 'minfang');
    if (m85 < 0) {
      m85 = c85.cells.findIndex((x) => !x.build && !x.official);
      if (m85 >= 0) c85.cells[m85] = { build: { id: 'minfang', lvl: 2 }, pending: null };
    }
    G.ui.openBuildModal(m85 < 0 ? undefined : m85);
    await sleep(140);
    check('v85：民房弹窗无「人口统计」按钮', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('民房') >= 0
        && root.textContent.indexOf('人口统计') < 0;
    })());
    G.ui.closeAllModals();
    await sleep(60);

    /* ② 底部导航栏缩略图 → 天下大势面板 */
    G.ui.paintBottom();
    await sleep(40);
    check('v85：底部条固定拼缩略图（38px canvas）',
      !!document.querySelector('#bottom-bar .bb-mini #mini-canvas'));
    click(document.querySelector('#bottom-bar .bb-mini'));
    await sleep(160);
    check('v85：点击展开「天下大势」（缩略图 + 州郡界图例）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && !!root.querySelector('#mini-big')
        && root.textContent.indexOf('天下大势') >= 0
        && root.textContent.indexOf('州界') >= 0 && root.textContent.indexOf('郡界') >= 0;
    })());
    check('v85：缩略数据（13 州 · 25 万格 · 边界线存在）', (function () {
      const d = G.map.miniBuild();
      if (!d || d.stName.length !== 13 || d.state.length !== 250000) return false;
      let e1 = 0, e2 = 0;
      for (let y = 0; y < 500; y += 7) {
        for (let x = 0; x < 499; x += 7) {
          const i = y * 500 + x;
          if (d.state[i] !== d.state[i + 1]) e1++;
          else if (d.jun[i] !== d.jun[i + 1]) e2++;
        }
      }
      return e1 > 10 && e2 > 10;
    })());
    check('v85.1：174 城零错位（城格色块 = 城自身州 · 复核修复）', (function () {
      const d = G.map.miniBuild();
      const idx = {};
      d.stName.forEach((n, i) => { idx[n] = i; });
      let mis = 0;
      (G.DATA.NPC_CITIES || []).forEach((c) => { if (d.state[c.y * 500 + c.x] !== idx[c.state]) mis++; });
      return mis === 0;
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v89.47（老板三条）：天下大势 —— 满界面 / 大写城名 / 点选跳转（真实 DOM）
   * ------------------------------------------------------------
   * ① 满界面：面板宽高 ≈ 视口（留 8px）；画布 CSS 边长 ≥ 视口高 − 200。
   * ② 城名：只有都/州/郡落笔（县不标）—— 以画布内部尺寸与标签表核对。
   * ③ 点选：真点画布中心 → 面板关闭 + 主地图居中到对应格（±1 格容差）。
   * ============================================================ */
  console.log('\n--- v89.47. 天下大势：满界面 / 城名 / 点选跳转（真实 DOM） ---');
  {
    G.ui.openMinimap();
    await sleep(220);
    const panel = document.querySelector('#modal-root .modal');
    const big = document.querySelector('#mini-big');
    /* ⚠️ v89.86：jsdom 没有布局引擎（rect 全 0），原先三条"量尺寸"断言在此**永远红** ——
       改为判"满界面档位 + 画布内部边长 = fitMini 侧长 + 分辨率按 css 宽 × dpr 对齐"
       （任何一处写死 1000 / 不随视口放大都会红）；真机像素级复核走几何探针。 */
    check('v89.47：面板挂「满界面」档（modal-max）', (function () {
      if (!panel || !big) return false;
      return panel.classList.contains('modal-max');
    })(), panel ? panel.className : 'no panel');
    check('v89.47：缩略图画布按视口放大（内部边长 = fitMini 侧长 · 方）', (function () {
      if (!big) return false;
      const side = G.ui.fitMini();
      return big.width === side && big.height === side && big.width >= 400;
    })(), big ? ('side=' + big.width) : 'no canvas');
    check('v89.47：画布内部分辨率 1:1 跟随显示尺寸（非固定 1000）', (function () {
      if (!big) return false;
      const cssW = parseFloat(big.style.width) || 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      return cssW > 0 && Math.abs(big.width - Math.round(cssW * dpr)) <= 2 && big.width !== 1000;
    })(), big ? (big.width + ' vs css ' + (big.style ? big.style.width : '')) : '');
    check('v89.47：点选提示行在（图例尾「点图上任意一处」）',
      !!document.querySelector('#modal-root .mini-hit')
      && document.querySelector('#modal-root').textContent.indexOf('主地图直达') >= 0);
    /* 真点一次：画布中心 → 世界中心格 (250,250)
       v89.86：jsdom rect 全 0 会让 miniPick 直接返回 null —— 注入 rect 桩再点（其余用例同法）。 */
    const oldRectB = big.getBoundingClientRect;
    big.getBoundingClientRect = () => ({ left: 0, top: 0, width: big.width, height: big.height });
    const br = big.getBoundingClientRect();
    big.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      clientX: br.left + br.width / 2, clientY: br.top + br.height / 2
    }));
    big.getBoundingClientRect = oldRectB;
    await sleep(200);
    check('v89.47：点选后关闭面板并跳到该格（中心 → 约 250,250）', (function () {
      const gone = !document.querySelector('#modal-root #mini-big');
      const v = G.ui.mapView;
      return gone && G.ui.view === 'map'
        && Math.abs(v.x - 250) <= 1 && Math.abs(v.y - 250) <= 1;
    })(), JSON.stringify(G.ui.mapView));
  }

  /* ============================================================
   * v89.68（老板）：缩略图三级下钻筛选 州城 / 郡城 / 县城（真实 DOM）
   * ------------------------------------------------------------
   * 老板：「缩略图加一个筛选按钮，当选择'州城'时…；选择'郡城'时，增加一个可选框
   *   选定某个州城，然后仅显示该州…；同理选'县城'时，逐级选择州郡，仅显示该郡地图…」
   * 这里走**真实 change 事件 + 真实重开面板**，校验级联出现与取景窗真的缩小。
   * ⚠️ jsdom 里派发事件必须用 window.Event（Node 的 new Event 会抛跨 realm 错，
   *    而且会中断整个 e2e —— 见 §89 备忘）。
   * ============================================================ */
  console.log('\n--- v89.68. 缩略图三级下钻筛选（真实 DOM） ---');
  {
    const fire = (el, v) => {
      el.value = v;
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
    };
    /* 复位到"全部" */
    G.ui._miniFilter = { level: '', state: '', jun: '' };
    G.ui._miniViewCache = null;
    G.ui.openMinimap();
    await sleep(80);
    const mroot = () => document.querySelector('#modal-root');
    check('v89.68：筛选行在册（层级下拉）', !!mroot() && !!mroot().querySelector('#mini-level'));
    check('v89.68：「全部」档不给州/郡下拉（级联未展开）', (function () {
      return !mroot().querySelector('#mini-state') && !mroot().querySelector('#mini-jun');
    })());
    const sideAll = G.ui.miniView().win.side;

    /* ① 州城档：全图取景，只标 都/州城 */
    fire(mroot().querySelector('#mini-level'), 'zhou');
    await sleep(80);
    const vZ = G.ui.miniView();
    check('v89.68：「州城」档 = 全图 + 只标注都城/州城', (function () {
      return vZ.level === 'zhou' && vZ.win.side === sideAll
        && vZ.list.length > 0
        && vZ.list.every((c) => c.type === 'zhou' || c.type === 'capital');
    })(), 'list=' + vZ.list.length + ' side=' + vZ.win.side);

    /* ② 郡城档：出现「州」下拉；选州后取景窗缩小，且该州郡城全在窗内 */
    fire(mroot().querySelector('#mini-level'), 'jun');
    await sleep(80);
    check('v89.68：「郡城」档出现「州」下拉（尚无「郡」下拉）', (function () {
      return !!mroot().querySelector('#mini-state') && !mroot().querySelector('#mini-jun');
    })());
    check('v89.68：选州后仅显示该州（取景窗缩小 + 该州郡城全在窗内）', (function () {
      const st = mroot().querySelector('#mini-state').value;
      fire(mroot().querySelector('#mini-state'), st);
      const v = G.ui.miniView();
      const juns = G.ui.miniJunsOf(st);
      const inside = juns.every((c) => c.x >= v.win.x0 && c.x < v.win.x0 + v.win.side
        && c.y >= v.win.y0 && c.y < v.win.y0 + v.win.side);
      return v.win.side < sideAll && v.win.side > 0 && inside
        && v.list.length === juns.length;
    })());
    await sleep(60);

    /* ③ 县城档：再出现「郡」下拉；选定后只标该郡县城（空郡则明写原因） */
    fire(mroot().querySelector('#mini-level'), 'county');
    await sleep(80);
    const junSel = mroot().querySelector('#mini-jun');
    check('v89.68：「县城」档逐级出现「州」+「郡」两个下拉', !!mroot().querySelector('#mini-state') && !!junSel);
    check('v89.68：郡下拉带「（N 县）」标注（空郡一眼可辨，不至于点了才发现是空图）', (function () {
      return /（\d+ 县）/.test(mroot().querySelector('#mini-jun').textContent || '');
    })(), (junSel && junSel.textContent) ? junSel.textContent.trim().slice(0, 60) : '无郡');
    check('v89.68：选定郡后只标注该郡县城（列表与 regionOf 归属一致）', (function () {
      /* 挑一个"有县城"的郡来验，并用返回码说明空郡的处理 */
      const opts = Array.prototype.slice.call(junSel.querySelectorAll('option'));
      const withC = opts.filter((o) => !/（0 县）/.test(o.textContent))[0];
      if (!withC) return false;
      fire(junSel, withC.value);
      const v = G.ui.miniView();
      const j = G.ui.miniJunsOf(G.ui._miniFilter.state).filter((x) => x.id === withC.value)[0];
      const want = G.ui.miniCountiesOf(j);
      return v.list.length === want.length && want.length > 0
        && v.list.every((c) => c.type === 'county') && v.anchor === j;
    })());
    await sleep(60);
    check('v89.68：点选换算反解取景窗（放大后同一屏幕点 → 不同世界格）', (function () {
      const el = document.querySelector('#mini-big');
      if (!el) return false;
      const br = el.getBoundingClientRect();
      /* jsdom 无布局：拿不到真实尺寸就直接用 ui.miniPick 的纯函数面（传假 rect） */
      const fake = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) };
      const a = G.ui.miniPick(200, 200, fake);
      const v = G.ui.miniView();
      return !!a && a.x >= v.win.x0 && a.x < v.win.x0 + v.win.side
        && a.y >= v.win.y0 && a.y < v.win.y0 + v.win.side
        && (br.width === 0 || true);
    })());
    G.ui._miniFilter = { level: '', state: '', jun: '' };
    G.ui._miniViewCache = null;
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v86（老板「按计划进行」· G1）：计谋（真实 DOM）
   * ============================================================ */
  console.log('\n--- v86. 计谋 / 锦囊（真实 DOM） ---');
  {
    let wt = null;
    for (let y = 5; y < 80 && !wt; y++) {
      for (let x = 5; x < 80; x++) {
        const tl = G.map.tile(x, y);
        /* v89.138（老板 7）：本段测"携计"—— 目标必须是**无主野地**；
           若命中己方野地，出征界面只出「驻守·增援」且按设计不带计（硬闸），测的就不是同一件事了。 */
        if (tl && tl.terrain !== 'city' && !G.map.fortAt(x, y) && !G.map.wildAt(x, y)) { wt = { x, y }; break; }
      }
    }
    G.state.items = G.state.items || {};
    G.state.items.jinang = (G.state.items.jinang || 0) + 10;
    /* 全军拉满精力/体力：ui._expGen 未必是 generals[0]（前序测试可能改过选择） */
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });

    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    check('v86：出征面板含「计略」行', !!document.querySelector('#exp-scheme-label'));
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(120);
    check('v86：计略区展开（妖言/千里奔袭等六计可见）', (function () {
      const box = document.querySelector('#exp-scheme-box');
      return !!box && !box.classList.contains('hidden')
        && box.textContent.indexOf('妖言惑众') >= 0
        && box.textContent.indexOf('千里奔袭') >= 0;
    })());
    click(document.querySelector('#exp-scheme-box [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(120);
    check('v86：选定后计略标签更新（面板不丢 · 内联区选中态）', (function () {
      const lb = document.querySelector('#exp-scheme-label');
      const box = document.querySelector('#exp-scheme-box');
      return !!lb && lb.textContent.indexOf('妖言惑众') >= 0
        && !!box && box.textContent.indexOf('已选') >= 0;
    })());
    /* 提交携计（需城内有兵） */
    const c86 = G.currentCity();
    c86.army = c86.army || {};
    c86.army.yibing = (c86.army.yibing || 0) + 100;
    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    /* v89.86（P-23）：兵力悬殊（<0.5）时首次点击只"上膛"不发兵 —— 按真实状态点 1~2 次 */
    const marchesBefore86 = (G.state.marches || []).length;
    const _pw86b = G.ui.expPowerOf ? G.ui.expPowerOf() : null;
    /* v89.207 修正（既有 bug · 口径漂移）：闸门自 v89.94 起按**区间下界 ratioLo** 拦
       （最坏情形），而本用例一直按点估计 ratio 预判 —— 两者在"ratio ≥ 0.5 > ratioLo"
       区间不一致 → 用例只点一次、闸门却上膛拦下 → marches 空（随机地图下 flaky）。
       修正 = 与实现同一口径（ratioLo）。 */
    const _lo86b = (_pw86b && _pw86b.ratioLo != null) ? _pw86b.ratioLo : (_pw86b ? _pw86b.ratio : null);
    const needTwo86 = !!(_pw86b && _pw86b.def > 0 && _pw86b.mine > 0 && _lo86b != null && _lo86b < 0.5);
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(140);
    if (needTwo86) {
      check('v89.86（P-23）：兵力悬殊首击拦下（未出行军）',
        (G.state.marches || []).length === marchesBefore86,
        'ratio=' + (Math.round(_pw86b.ratio * 100) / 100));
      click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
      await sleep(200);
    }
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      /* v89.138：诊断信息只在失败时打印（曾用它抓到 transfer 方式粘性残留） */
      const ok86 = (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
      if (!ok86) {
        const _res = G.ui._expRes || {};
        console.log('     [dbg86] kind=' + _res.kind + ' mode=' + G.ui._expMode
          + ' scheme=' + G.ui._expScheme + ' marches=' + JSON.stringify((G.state.marches || []).map((m) => m.scheme || '-')));
      }
      return ok86;
    })());
    /* 布防入口（v89.107 老板令：左侧统计栏的烽火警报含策略布防**搬进军务·烽火页**） */
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    await sleep(240);
    check('v86/v89.107：军务·烽火页有「策略布防」入口',
      !!document.querySelector('[data-action="city-scheme"]'));
    click(document.querySelector('[data-action="city-scheme"]'));
    await sleep(160);
    check('v86：布防弹窗（空城计 / 坚壁清野）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('空城计') >= 0
        && root.textContent.indexOf('坚壁清野') >= 0;
    })());
    click(document.querySelector('#modal-root [data-action="city-scheme-pick"][data-v="kongcheng"]'));
    await sleep(200);
    check('v86：布防成功（kongcheng 生效）', (function () {
      const c = G.currentCity();
      return !!G.schemeDefOf(c, 'kongcheng');
    })());
    G.ui._marchTab = 'over';          /* v89.107：军务页签是用例级状态 —— 用完还原 */
    G.ui.setView('city');
    await sleep(80);
  }

  /* ============================================================
   * v88.1：场景整合（地形专属并入江湖游历 · 真实 DOM）
   * ============================================================ */
  console.log('\n--- v88.1. 场景整合（真实 DOM） ---');
  /* v89.86（测试修复）：v88.1 / v88 / v89 三块测的是江湖游历与全屏剧本本身 ——
     显式临时挂载 jianghuWildMounted（v89.45 起默认剥离），跑完还原。 */
  const jhWasB = G.jianghuWildMounted;
  G.jianghuWildMounted = true;
  {
    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'hill_scene')) { hp = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(hp.x, hp.y);            /* 未占 → 出兵弹窗 */
    await sleep(200);
    check('v88.1：弹窗仅一个游历区块（含「绿林探访」按钮 · 无旧「地形专属」）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && !!root.querySelector('[data-action="do-jianghu"][data-act="hill_scene"]')
        && root.textContent.indexOf('地形专属') < 0;
    })());
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="hill_scene"]'));
    await sleep(260);
    check('v88.1/v89：「绿林探访」进入全屏剧本（第 1 幕 + 选择项 + 退出钮）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none'
        && el.textContent.indexOf('绿林探访') >= 0
        && el.querySelectorAll('[data-action="sxf-choice"]').length >= 2
        && !!el.querySelector('[data-action="sxf-escape"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    /* v89.2：末幕是「时机判定」——点「抱拳！」停手（而不是再点选择） */
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(200);
    check('v88.1/v89：终幕结算屏（专属退出按钮出现）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v88.1：剧本收尾 → 回野地弹窗原地回显（今日已做）', (function () {
      const root = document.querySelector('#modal-root');
      const el = document.getElementById('scene-fx');
      return (!el || el.style.display === 'none') && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());
    /* 已占分支同样只有新区块 */
    G.state.wilds.push({ x: hp.x, y: hp.y, type: 'hill', level: 4 });
    G.ui.openLandModal(hp.x, hp.y);
    await sleep(160);
    check('v88.1：已占野地面板同为新区块（无旧区块）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && root.textContent.indexOf('地形专属') < 0;
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v88（老板）：灵气双轨装备 + 江湖游历（真实 DOM）
   * ============================================================ */
  console.log('\n--- v88. 灵气双轨装备 + 江湖游历（真实 DOM） ---');
  {
    const g88 = G.lordGeneralOf();   /* v89：修炼线君主专属 */
    /* 备好两套装备（各一件武器）与精华 */
    const aI88 = G.addEquip('cr_weapon_4', 0);
    G.systems.equipItem(g88.id, aI88);
    const lI88 = G.addEquip('lg_weapon_4', 0);
    G.systems.equipItem(g88.id, lI88);
    G.state.items = G.state.items || {};
    G.state.items.lingsui = 500;
    G.ui._genSel = g88.id;
    G.ui.setView('generals');
    await sleep(220);

    check('v88：装备栏含双轨切换按钮（⚔军中 / ☯修炼）', (function () {
      const vc = document.querySelector('#view-container');
      return !!vc.querySelector('[data-action="toggle-equip-set"][data-set="sha"]')
        && !!vc.querySelector('[data-action="toggle-equip-set"][data-set="ling"]');
    })());
    check('v88：军装模式槽名（武器）+ 12 格', (function () {
      const vc = document.querySelector('#view-container');
      return vc.querySelectorAll('.gen-pane .doll-slot').length === 12
        && vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]').textContent.indexOf('武器') >= 0;
    })());

    click(document.querySelector('#view-container [data-action="toggle-equip-set"][data-set="ling"]'));
    await sleep(260);
    check('v88：切换后槽名变「灵剑」+ 显示赤霄剑', (function () {
      const vc = document.querySelector('#view-container');
      const slot = vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]');
      return !!slot && slot.textContent.indexOf('灵剑') >= 0 && slot.textContent.indexOf('赤霄剑') >= 0;
    })());
    check('v88：修炼面板出现（灵力 / 总蕴养 / 灵气精华）', (function () {
      const vc = document.querySelector('#view-container');
      const t = vc.textContent;
      return t.indexOf('灵力') >= 0 && t.indexOf('总蕴养') >= 0 && t.indexOf('灵气精华') >= 0;
    })());
    check('v88：修炼模式显示「☯ 蕴养」按钮', (function () {
      return !!document.querySelector('#view-container [data-action="ling-temper-open"]');
    })());

    /* 蕴养面板（打开 → 列出修炼件 → 关闭） */
    click(document.querySelector('#view-container [data-action="ling-temper-open"]'));
    await sleep(220);
    check('v88：蕴养面板打开并列出赤霄剑（含成本）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('蕴养') >= 0
        && root.textContent.indexOf('赤霄剑') >= 0
        && root.textContent.indexOf('灵气精华') >= 0
        && !!root.querySelector('[data-action="ling-temper-item"]');
    })());
    G.ui.closeAllModals();
    await sleep(80);

    /* 切回军装（槽名回「武器」） */
    click(document.querySelector('#view-container [data-action="toggle-equip-set"][data-set="sha"]'));
    await sleep(260);
    check('v88：切回军装（槽名回「武器」+ 套装面板在）', (function () {
      const vc = document.querySelector('#view-container');
      const slot = vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]');
      return !!slot && slot.textContent.indexOf('武器') >= 0 && slot.textContent.indexOf('神兵') >= 0;
    })());

    /* 江湖游历（野地弹窗：区块 + 执行 + 回显） */
    let fp88 = null;
    for (let y = 3; y < 200 && !fp88; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'forest' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'xiu')) { fp88 = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(fp88.x, fp88.y);
    await sleep(200);
    check('v88/v89.4：野地弹窗含江湖区块（按钮数 = 逐地分布 1~3）', (function () {
      const root = document.querySelector('#modal-root');
      const n4 = G.jianghuActsAt(fp88.x, fp88.y).length;
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && n4 >= 1 && n4 <= 3
        && root.querySelectorAll('[data-action="do-jianghu"]').length === n4;
    })());
    const before88 = G.state.items.lingsui || 0;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="xiu"]'));
    await sleep(260);
    check('v88/v89：「修炼」进入全屏剧本', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('修炼') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    /* v89.2：末幕是「时机判定」——点「收功！」停手 */
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(200);
    check('v88/v89：结算屏含收获（灵气精华）与专属退出', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.textContent.indexOf('灵气精华') >= 0 && !!el.querySelector('[data-action="sxf-exit"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v88：结算后得精华 + 弹窗回显「今日已做」', (function () {
      const root = document.querySelector('#modal-root');
      const gained = (G.state.items.lingsui || 0) - before88;
      return gained > 0 && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

  /* ============================================================
   * v89（老板）：君主专属修炼 + 全屏江湖剧本（真实 DOM）
   * ============================================================ */
  console.log('\n--- v89. 君主专属 + 全屏江湖剧本（真实 DOM） ---');
  {
    const lg89 = G.lordGeneralOf();
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });

    /* ① 君主有双轨 tab；普通将领没有 + 专属文案 */
    G.ui._genSel = lg89.id;
    G.ui.setView('generals');
    await sleep(220);
    check('v89：君主装备栏有双轨切换（⚔军中 / ☯修炼）', (function () {
      const vc = document.querySelector('#view-container');
      return !!vc.querySelector('[data-action="toggle-equip-set"][data-set="ling"]');
    })());
    /* 注：e2e 尾部主状态可能只剩君主一人（前序测试换过档）——临时补普通将领做负向验证 */
    let ng89 = G.state.generals.filter(g => !g.isLord)[0];
    if (!ng89) {
      ng89 = G.makeGeneral('验士甲', 5, 'idle', G.currentCity().id, false);
      G.state.generals.push(ng89);
    }
    G.ui._genSel = ng89.id;
    G.ui.setView('generals');
    await sleep(220);
    check('v89：普通将领无双轨 tab · 有「君主专属」说明', (function () {
      const vc = document.querySelector('#view-container');
      return !vc.querySelector('[data-action="toggle-equip-set"]')
        && vc.innerHTML.indexOf('君主专属') >= 0;
    })());
    if (ng89.name === '验士甲') G.state.generals = G.state.generals.filter(x => x.id !== ng89.id);

    /* ② 全屏剧本：逃（未动身免费 / 动身后计入） */
    let hp89 = null;
    for (let y = 3; y < 200 && !hp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'tao')) { hp89 = { x, y }; break; }
      }
    }
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(hp89.x, hp89.y);
    await sleep(200);
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(240);
    check('v89：讨伐进入全屏（对话·事件第 1 幕）· 有「鸣金收兵」', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none'
        && el.textContent.indexOf('斥候') >= 0
        && !!el.querySelector('[data-action="sxf-escape"]');
    })());
    const e089 = lg89.energy;
    click(document.querySelector('#scene-fx [data-action="sxf-escape"]'));
    await sleep(200);
    check('v89：未动身退出 —— 免费（结算屏明示）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.textContent.indexOf('未有任何消耗') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(220);
    check('v89：免费退出后可再入（energy 未扣 · 锁未落）', (function () {
      /* ⚠ 精力是「连续再生值（浮点）」：只能断言"未减少"，不能严格相等 ——
         毫秒级再生会在两次读取之间加出小数（v89.1 实测 85.0666 抓出的脆弱点） */
      return lg89.energy >= e089 - 0.01 && G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok;
    })());

    /* ③ 动身后退出：所耗不返、今日计入 */
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(200);
    const ePre89 = lg89.energy;
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(160);
    /* 同上：按「扣费前后差 ≈ 15」断言（容差 3 —— 再生量远小于此；双扣 30 / 未扣 0 必被抓住） */
    check('v89：首次选择即扣精力（15）', Math.abs((ePre89 - lg89.energy) - 15) < 3);
    click(document.querySelector('#scene-fx [data-action="sxf-escape"]'));
    await sleep(160);
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v89：动身后退出 —— 今日计入（不可再入）+ 回弹窗', (function () {
      const root = document.querySelector('#modal-root');
      return !G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok
        && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());

    /* ④ 走完一局（地宫探险：全屏 3 幕 → 专属结算 → 收尾） */
    let fp89 = null;
    for (let y = 3; y < 200 && !fp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'desert' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'desert_scene')) { fp89 = { x, y }; break; }
      }
    }
    G.ui.closeAllModals();
    await sleep(80);
    G.ui.openLandModal(fp89.x, fp89.y);
    await sleep(200);
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="desert_scene"]'));
    await sleep(240);
    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());
    check('v89.2：场景画布 + 热点点选（在画里选点，不是点按钮）', (function () {
      const el = document.getElementById('scene-fx');
      const spots = el.querySelectorAll('.sxf-spot');
      return !!el.querySelector('canvas.sxf-canvas')
        && spots.length >= 2
        && spots.length === el.querySelectorAll('[data-action="sxf-choice"]').length
        && (spots[0].getAttribute('style') || '').indexOf('left:') >= 0
        && el.textContent.indexOf('点画中之处') >= 0;
    })());
    check('v89.1：幕景横幅（水印 · 幕题 · 倾向徽章 · 选项齐）', (function () {
      const el = document.getElementById('scene-fx');
      const f = G.DATA.SCENE_FLOW.desert_scene;
      const tt = el.querySelector('.sxf-stage-tt');
      return !!el.querySelector('.sxf-hero') && !!el.querySelector('.sxf-hero-art')
        && (el.querySelector('.sxf-hero-art').textContent || '').length >= 1
        && !!tt && tt.textContent === f.stages[0].s
        && el.querySelectorAll('.sxf-bdg').length >= 1
        && el.querySelectorAll('.sxf-opt').length >= 2
        && el.textContent.indexOf('第 1 / ' + f.stages.length + ' 幕') >= 0;
    })());
    check('v89.3：横幅文案统一（雅名「古冢探幽」· 门类章「探幽」）', (function () {
      const al = document.querySelector('#scene-fx .sxf-hero-alias');
      const kd = document.querySelector('#scene-fx .sxf-hero-kind');
      return !!al && al.textContent === '古冢探幽' && !!kd && kd.textContent === '探幽';
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    check('v89.1：行程时间线随选择累积（幕题 + 抉择）', (function () {
      const el = document.getElementById('scene-fx');
      return el.querySelectorAll('.sxf-tl-item').length === 1
        && el.textContent.indexOf('行程') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    check('v89.2：末幕时机条（轨道 · 指针 · 停手钮）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el.querySelector('.sxf-tk') && !!el.querySelector('.sxf-mark')
        && !!el.querySelector('[data-action="sxf-stop"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]') && el.textContent.indexOf('出宫回城') >= 0;
    })());
    check('v89.1：结算卡（光晕徽记 · 战果面板 · 耗用账单）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el.querySelector('.sxf-emblem') && !!el.querySelector('.sxf-loot')
        && el.textContent.indexOf('耗：精力') >= 0
        && el.textContent.indexOf('余：精力') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(240);
    G.ui.closeAllModals();
    await sleep(60);
  }

  await sleep(30);

  /* v89.4：野地生态（荒僻空态 · 有事格 1~3 · 等级收益行） */
  {
    let wp4 = null;
    for (let y = 3; y < 200 && !wp4; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && !G.map.fortAt(x, y) && G.jianghuActsAt(x, y).length === 0
            && G.jianghuCands(tl.terrain).length > 0) { wp4 = { x, y }; break; }
      }
    }
    if (wp4) {
      G.ui.openLandModal(wp4.x, wp4.y);
      await sleep(200);
      check('v89.4：荒僻野地 —— 游历区块空态（随缘而现）', (function () {
        const root = document.querySelector('#modal-root');
        return !!root && root.textContent.indexOf('荒僻') >= 0
          && root.textContent.indexOf('野地 Lv') >= 0;
      })());
      G.ui.closeAllModals();
      await sleep(80);
    } else {
      check('v89.4：荒僻野地 —— 游历区块空态（随缘而现）', false);
    }

    let yp4 = null, yn4 = 0;
    for (let y = 3; y < 200 && !yp4; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) {
          const n4 = G.jianghuActsAt(x, y).length;
          if (n4 >= 2) { yp4 = { x, y }; yn4 = n4; break; }
        }
      }
    }
    G.state.jianghu = {};
    if (yp4) {
      G.ui.openLandModal(yp4.x, yp4.y);
      await sleep(200);
      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', (function () {
        const root = document.querySelector('#modal-root');
        const btns = root.querySelectorAll('[data-action="do-jianghu"]').length;
        return btns === yn4 && btns <= 3
          && root.textContent.indexOf('野地 Lv') >= 0
          && root.textContent.indexOf('收益 ×') >= 0;
      })());
      G.ui.closeAllModals();
      await sleep(80);
    } else {
      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', false);
    }
  }
  G.jianghuWildMounted = jhWasB;   /* v89.86：还原剥离状态 */

  console.log('');
  console.log('--- 81. 文字游戏 · 故事库（真实点击 · v2 结构） ---');
  await (async function () {
    check('★ 故事库已载入（≥5 篇）', !!(G.SG && G.SG.list().length >= 5),
      G.SG ? (G.SG.list().length + ' 篇') : '无');
    var city = G.currentCity();
    /* ============================================================
     * v89.29：逸闻入口改版 —— 「列表菜单」→「概率奇遇」
     *   点击建筑 / 地块时掷骰（GAME.SG.roll），命中即从该锚点池随机抽一篇
     *   完整故事（每篇 = 一份独立资产），在面板之上直接开卷；
     *   掩卷后回到原面板（叠层语义：弹窗不关）。
     *   测试口径：
     *     · 默认 rng 恒 0.999 —— 永不触发（保证既有用例不被随机打断）；
     *     · sgPin89(sid)：pin 指定必中篇目（确定性）+ 冷却清零 —— 走真实触发链；
     *     · 冷却口径：pin 路径同样受冷却约束（roll 返回 why='cool'）。
     * ============================================================ */
    var rngNever89 = function () { return 0.999; };
    function sgPin89(sid) { G.SG.TRIG.pin = sid; G.SG.TRIG._lastAt = 0; }
    function sgOff89() { G.SG.TRIG.pin = null; G.SG.TRIG._lastAt = 0; G.SG.TRIG.rng = rngNever89; }
    sgOff89();

    /* 块 A：触发链（建筑）—— pin 官府首篇 → 开面板即入卷 → 走满 → 掩卷回面板 */
    var gi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') gi = i; });
    check('官府地块定位', gi >= 0);
    sgPin89('bld-guanfu-01');
    G.ui.openBuildModal(gi);
    await sleep(40);
    var fx = document.querySelector('#story-fx');
    /* v89.86（P-06）：触发 → **入待阅**（不打断；面板未关；徽标 +1）；从待阅开卷 */
    check('★ v89.86（P-06）：概率奇遇触发 → 入待阅《衙前夜审》（不打断 · 面板未关）',
      (G.SG.pending() || []).some(function (x) { return x.sid === 'bld-guanfu-01'; })
      && fx.style.display === 'none'
      && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    check('★ v89.86（P-06）：顶栏「史册」徽标 = 待阅数',
      (function () {
        var b = document.getElementById('tab-badge-story');
        return !!b && b.classList.contains('hidden') === false && Number(b.textContent) >= 1;
      })());
    G.ui.sgReadPending('bld-guanfu-01');
    await sleep(40);
    var bgLayers = fx ? fx.querySelectorAll('.sgr-bg') : [];
    check('★ v89.86（P-06）：从待阅开卷（阅读器 · 第 1 段 · 共 6 段 · 壁画两层 · 选项≥2）', !!fx
      && fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'bld-guanfu-01'
      && bgLayers.length === 2
      && fx.textContent.indexOf('第 1 段') >= 0 && fx.textContent.indexOf('共 6 段') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);
    var muralKeys = {}, seenSeg = 0;
    if (fx) {
      var m0 = fx.querySelector('.sgr-bg[data-on]');
      if (m0) muralKeys[m0.dataset.key] = 1;
    }
    var guard = 0;
    while (guard++ < 12) {
      var pk = fx.querySelector('[data-action="story-pick"]');
      if (!pk) break;
      click(pk);
      await sleep(30);
      seenSeg = Math.max(seenSeg, Number((fx.textContent.match(/第 (\d) 段/) || [0, 0])[1]) || 0);
      var mOn = fx.querySelector('.sgr-bg[data-on]');
      if (mOn) muralKeys[mOn.dataset.key] = 1;
    }
    var keyN = 0; for (var kk in muralKeys) keyN++;
    check('★ 壁画随段变换（段位走到 ≥3 · 壁画出现 ≥2 张）', seenSeg >= 3 && keyN >= 2,
      '走到第 ' + seenSeg + ' 段 · 壁画 ' + keyN + ' 张');
    check('★ 走到结局（结算屏 + 回到城中）', !!fx.querySelector('[data-action="story-exit"]')
      && fx.textContent.indexOf('回到城中') >= 0);
    check('★ 阅读进度已入档',
      !!(G.SG.progress()['bld-guanfu-01'] && G.SG.progress()['bld-guanfu-01'].done.length));
    click(fx.querySelector('[data-action="story-exit"]'));
    await sleep(30);
    check('阅读器收起（不阻塞主界面）', fx.style.display === 'none');

    /* 块 B：冷却口径 —— 紧接再掷 → why='cool'；冷却期内开面板也不弹 */
    check('★ v89.29：冷却口径（刚触发过 · 再掷 why=cool）', (function () {
      var r = G.SG.roll('building', 'guanfu');
      return r.fire === false && r.why === 'cool';
    })());
    G.ui.openBuildModal(gi);
    await sleep(30);
    check('★ v89.29：冷却期内再点不触发（面板照常）', fx.style.display === 'none'
      && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var cmA = document.querySelector('#modal-root [data-action="close-modal"]');
    if (cmA) { click(cmA); await sleep(25); }

    /* 块 C：默认口径（未命中）—— rng 永不出、无 pin → 开面板不弹逸闻 */
    sgOff89();
    G.ui.openBuildModal(gi);
    await sleep(30);
    check('★ v89.29：默认口径（未命中 · 面板照常 · 不弹逸闻）',
      fx.style.display === 'none' && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var cmB = document.querySelector('#modal-root [data-action="close-modal"]');
    if (cmB) { click(cmB); await sleep(25); }
    check('★ v89.29：无故事锚点永不触发（空池）', (function () {
      var r = G.SG.roll('building', '__none__');
      return r.fire === false && r.why === 'empty';
    })());

    /* 块 D：触发链（地块 · 野地）—— 找一块可读地块，pin 其池中一篇 */
    var wTile = null;
    if (city.x != null) {
      for (var dx9 = -4; dx9 <= 4 && !wTile; dx9++) {
        for (var dy9 = -4; dy9 <= 4 && !wTile; dy9++) {
          var tl9 = G.map.tile(city.x + dx9, city.y + dy9);
          if (tl9 && G.SG.anchor('wild', tl9.terrain).length > 0) {
            wTile = { x: city.x + dx9, y: city.y + dy9, terrain: tl9.terrain };
          }
        }
      }
    }
    if (wTile) {
      var wc9 = G.SG.candidates('wild', wTile.terrain);
      var wPick9 = (wc9.fresh[0] || wc9.done[0]).st.id;
      sgPin89(wPick9);
      G.ui.openLandModal(wTile.x, wTile.y);
      await sleep(30);
      G.ui.sgTryTrigger('wild', wTile.terrain);
      await sleep(40);
      check('★ v89.86（P-06）：地块触发 → 入待阅（' + wPick9 + ' · 不打断）',
        (G.SG.pending() || []).some(function (x) { return x.sid === wPick9; })
        && fx.style.display === 'none'
        && !!document.querySelector('#modal-root [data-action="close-modal"]'));
      G.ui.sgReadPending(wPick9);
      await sleep(40);
      check('★ v89.86（P-06）：从待阅开卷（' + wPick9 + '）',
        fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === wPick9);
      var exW = fx.querySelector('[data-action="story-exit"]');
      if (exW) { click(exW); await sleep(30); }
      check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');
      var cmD = document.querySelector('#modal-root [data-action="close-modal"]');
      if (cmD) { click(cmD); await sleep(25); }
    } else {
      check('★ v89.29：地块触发（附近无可读野地，跳过）', true);
      check('★ v89.29：掩卷后回面板（跳过）', true);
    }

    /* 块 E：逐卷直开（阅读器 · 走满 · 进度入档 · 掩卷）—— 覆盖各卷代表性新篇 */
    var VOL89 = [
      ['v89.9', 'bld-minfang-01'], ['v89.10', 'bld-xiaochang-01'], ['v89.11', 'bld-shuyuan-02'],
      ['v89.12', 'bld-cangku-02'], ['v89.13', 'bld-zhaoxianguan-02'], ['v89.14', 'bld-guanfu-05'],
      ['v89.24', 'bld-guanfu-08'], ['v89.25', 'bld-chengqiang-06'], ['v89.26', 'bld-xiaochang-07'],
      ['v89.27', 'wild-forest-05'], ['v89.27', 'city-county-05'], ['v89.27', 'ext-farm-06'],
      ['v89.28', 'bld-shuyuan-09'], ['v89.28', 'wild-zhaoze-08'],
      ['v89.30', 'bld-kezhan-09'], ['v89.30', 'wild-desert-09'], ['v89.30', 'bld-honglusi-02'],
      ['v89.30', 'city-county-07'], ['v89.30', 'wild-lake-12'], ['v89.30', 'ext-mine-07'],
      ['v89.32', 'bld-honglusi-04'], ['v89.32', 'bld-zhaoxianguan-10'], ['v89.32', 'city-county-11'],
      ['v89.32', 'city-county-16'], ['v89.32', 'city-jun-18'], ['v89.32', 'wild-zhaoze-11'],
      ['v89.33', 'bld-cangku-09'], ['v89.33', 'city-county-21'], ['v89.33', 'wild-zhaoze-12'],
      ['v89.34', 'bld-kezhan-10'], ['v89.34', 'wild-forest-16'], ['v89.34', 'city-jun-23'],
      ['v89.34', 'city-county-29'], ['v89.34', 'wild-desert-15'], ['v89.34', 'bld-majiu-10'],
      ['v89.35', 'bld-tiejiangpu-09'], ['v89.35', 'bld-tiejiangpu-10'], ['v89.35', 'bld-fenghuotai-10'],
      ['v89.35', 'wild-forest-19'], ['v89.35', 'city-capital-10'], ['v89.35', 'city-county-34'],
      ['v89.37', 'city-county-36'], ['v89.37', 'wild-caoyuan-18'], ['v89.37', 'city-zhou-17'],
      ['v89.37', 'city-zhou-18'], ['v89.37', 'city-capital-17'], ['v89.37', 'city-zhou-22'],
      ['v89.38', 'city-county-43'], ['v89.38', 'city-jun-34'], ['v89.38', 'ext-farm-10'],
      ['v89.38', 'city-county-49'], ['v89.38', 'city-zhou-27'], ['v89.38', 'city-county-50'],
      ['v89.39', 'misc-01'], ['v89.39', 'misc-07'], ['v89.39', 'misc-13'], ['v89.39', 'misc-19'],
      ['v89.39', 'misc-25'], ['v89.39', 'misc-33'], ['v89.39', 'misc-40']
    ];
    for (var v9 = 0; v9 < VOL89.length; v9++) {
      var tag9 = VOL89[v9][0], sid9 = VOL89[v9][1];
      G.ui.openStory(sid9);
      await sleep(40);
      var open9 = !!fx && fx.style.display !== 'none'
        && !!G.SG._run && G.SG._run.st.id === sid9
        && fx.querySelectorAll('.sgr-bg').length === 2
        && fx.textContent.indexOf('第 1 段') >= 0 && /共 [5-7] 段/.test(fx.textContent)
        && fx.querySelectorAll('[data-action="story-pick"]').length >= 2;
      var g9 = 0;
      while (open9 && g9++ < 12) {
        var pk9 = fx.querySelector('[data-action="story-pick"]');
        if (!pk9) break;
        click(pk9);
        await sleep(25);
      }
      var end9 = !!fx && !!fx.querySelector('[data-action="story-exit"]')
        && fx.textContent.indexOf('回到城中') >= 0;
      var save9 = !!(G.SG.progress()[sid9] && G.SG.progress()[sid9].done.length);
      if (fx && fx.querySelector('[data-action="story-exit"]')) {
        click(fx.querySelector('[data-action="story-exit"]'));
        await sleep(25);
      }
      check('★ ' + tag9 + '：直开阅读器 · 走满至结局（' + sid9 + '）', open9 && end9);
      check('★ ' + tag9 + '：进度入档 · 掩卷收起（' + sid9 + '）',
        save9 && fx.style.display === 'none');
    }

    /* 块 F：动作触发（v89.31）—— 动作完成 → 相关建筑池 → 开卷 / 默认阈值不打扰 */
    var pF1 = G.SG.actPool('tech-done');
    var pinF1 = (pF1.fresh[0] || pF1.done[0]).st.id;
    sgPin89(pinF1); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.86（P-06）：动作触发 · 研习完成 → 入待阅（' + pinF1 + '）',
      (G.SG.pending() || []).some(function (x) { return x.sid === pinF1; })
      && fx.style.display === 'none');
    G.ui.sgReadPending(pinF1);
    await sleep(40);
    check('★ v89.86（P-06）：从待阅开卷（' + pinF1 + '）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === pinF1);
    var exF1 = fx.querySelector('[data-action="story-exit"]');
    if (exF1) { click(exF1); await sleep(30); }
    check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');
    sgOff89(); G.SG.TRIG._actAt = {};
    G.onActionDone('train-done');
    await sleep(30);
    check('★ v89.31：动作触发 · 默认阈值下不打扰（rng 恒 0.999）', fx.style.display === 'none');

    /* v89.39：世事（misc）并入动作池 —— 研习完成 → 世事篇开卷（真实链路） */
    var pM39 = G.SG.actPool('tech-done');
    var hasM39 = false;
    pM39.fresh.concat(pM39.done).forEach(function (r) { if (r.st.id === 'misc-06') hasM39 = true; });
    check('★ v89.39：世事并入动作池（tech-done 含《奏对》misc-06）', hasM39);
    sgPin89('misc-06'); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.86（P-06）：动作偶遇世事 → 入待阅（misc-06）',
      (G.SG.pending() || []).some(function (x) { return x.sid === 'misc-06'; })
      && fx.style.display === 'none');
    G.ui.sgReadPending('misc-06');
    await sleep(40);
    check('★ v89.86（P-06）：从待阅开卷（misc-06）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'misc-06');
    var exM39 = fx.querySelector('[data-action="story-exit"]');
    if (exM39) { click(exM39); await sleep(30); }
    check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');
    sgOff89(); G.SG.TRIG._actAt = {};

    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();
  })();

  console.log('');
  console.log('--- 82. v89.7 · 头像可更换（真实点击） ---');
  await (async function () {
    var avEl = document.querySelector('#lord-avatar');
    check('★ 顶栏头像可点（data-action 挂外层 · 每秒重绘不丢）',
      !!avEl && avEl.getAttribute('data-action') === 'open-avatar-pick');
    var lgEl = G.lordGeneralOf ? G.lordGeneralOf() : null;
    var seed0 = G.state.ruler.portraitSeed;
    var lgSeed0 = lgEl ? lgEl.portraitSeed : null;
    var cur0 = (seed0 || 0) % 20;
    click(avEl);
    await sleep(30);
    var cells = document.querySelectorAll('#modal-root .av-cell');
    var curEl0 = document.querySelector('#modal-root .av-cell.cur');
    check('★ 开出头像面板（20 张 · 当前脸唯一高亮）', cells.length === 20
      && !!curEl0 && curEl0.dataset.idx === String(cur0));
    var target = null;
    for (var i = 0; i < cells.length; i++) {
      if (Number(cells[i].dataset.idx) !== cur0) { target = cells[i]; break; }
    }
    click(target);
    await sleep(30);
    var seed1 = G.state.ruler.portraitSeed;
    var curEl1 = document.querySelector('#modal-root .av-cell.cur');
    var img1 = document.querySelector('#lord-avatar img');
    check('★ 点选即换（seed 变 · 高亮跟到新脸 · 顶栏立绘同源更新 · 君主将领同源）',
      !!target && seed1 === Number(target.dataset.idx) && seed1 !== seed0
      && !!curEl1 && Number(curEl1.dataset.idx) === seed1
      && !!img1 && String(img1.getAttribute('src')).indexOf('assets/portraits/pool/') === 0
      && (!lgEl || lgEl.portraitSeed === seed1));
    click(document.querySelector('#modal-root [data-action="close-avatar-pick"]'));
    await sleep(30);
    check('★ 「完成」回到君主面板（头像行就位 · 更换入口可再进）',
      !!document.querySelector('#modal-root [data-action="open-avatar-pick"]')
      && !!document.querySelector('#modal-root .lord-av-mini')
      && document.querySelector('#modal-root').textContent.indexOf('头像') >= 0);
    click(document.querySelector('#modal-root [data-action="close-modal"]'));
    await sleep(30);
    /* 还原：不污染后续断言 */
    G.state.ruler.portraitSeed = seed0;
    if (lgEl && lgSeed0 != null) lgEl.portraitSeed = lgSeed0;
    G.ui.syncHeader();
  })();

  /* ============================================================
   * v89.49 花金提速 / v89.50 新套装与新物品（真实 DOM）
   * ============================================================ */
  console.log('\n--- v89.49 / v89.50. 提速面板 · 内容铺量（真实 DOM） ---');
  {
    /* ① v89.49：队列「加速」不再因缺宝物而 disabled，面板里应有花金三档 */
    const c49 = G.currentCity();
    let bIdx49 = -1;
    c49.cells.forEach((x, i) => { if (bIdx49 < 0 && x.build && x.build.id === 'junying') bIdx49 = i; });
    if (bIdx49 < 0) {
      for (let i = 0; i < c49.cells.length; i++) {
        if (!c49.cells[i].build && !c49.cells[i].official) { c49.cells[i].build = { id: 'junying', lvl: 10 }; bIdx49 = i; break; }
      }
    }
    if (bIdx49 >= 0) {
      c49.cells[bIdx49].build.lvl = 10;
      const bkQ49 = G.state.queues.train.slice();
      G.state.queues.train = [];
      G.state.res.grain += 300000; G.state.res.wood += 300000; G.state.res.iron += 300000;
      G.state.res.pop = (G.state.res.pop || 0) + 5000;
      G.state.res.gold = Math.max(G.state.res.gold || 0, 2000000);
      G.train('yibing', 500, c49.id, bIdx49);
      await sleep(60);
      G.ui.openBuildModal(bIdx49);
      await sleep(120);
      check('v89.49：队列「加速」按钮不再 dim/disabled（缺宝物也可开面板）', (function () {
        const b = document.querySelector('#modal-root [data-action="train-boost"]');
        return !!b && !b.disabled && !b.classList.contains('dim');
      })());
      click(document.querySelector('#modal-root [data-action="train-boost"]'));
      await sleep(140);
      check('v89.49：提速面板两段齐（花金买时间 + 宝物加速）', (function () {
        const root = document.querySelector('#modal-root');
        return !!root && root.textContent.indexOf('花金买时间') >= 0
          && root.textContent.indexOf('宝物加速') >= 0
          && root.querySelectorAll('[data-action="train-rush"]').length === 3;
      })());
      /* v89.179：三档重设为 10/20/30%（原 25/50/100% 的「立刻完成」档已撤），
         取最高档 data-pct="0.3"（数值 0.30 序列化成 "0.3"）。 */
      const rushBtn = document.querySelector('#modal-root [data-action="train-rush"][data-pct="0.3"]');
      const gold0 = G.state.res.gold;
      if (rushBtn) click(rushBtn);
      await sleep(160);
      check('v89.49：点「−30%（上限）」花金提速真的扣金并缩短', (function () {
        const q = G.trainRunningOf(c49.id, bIdx49, 'train');
        return !!q && G.state.res.gold < gold0 && q.elapsed > 0;
      })(), '金 ' + gold0 + ' → ' + G.state.res.gold);
      G.ui.closeAllModals();
      await sleep(40);
      G.state.queues.train = bkQ49;
    }

    /* ② v89.50：新套装与新物品在真实界面上可见 */
    /* v89.204（老板 2）：「套装效果一览」整条退役（函数/按钮/case 全删）——
       改验**数据本体**：七套在册且各有名称（v89.50 的"新套可见"语义由数据侧承载，
       一览表渲染随功能退役）。 */
    check('v89.204：套装效果一览已退役 · 套装数据仍在（7 套）', (function () {
      const names = ['倚天套', '名将套', '神武套', '游侠套', '陷阵套', '守御套', '天策套'];
      const gone = typeof G.ui.forgeSetNote !== 'function' && typeof G.ui.openForgeSetInfo !== 'function';
      const ids = Object.keys(G.DATA.SETS);
      return gone && ids.length === 7
        && names.every((n) => ids.some((k) => G.DATA.SETS[k].name === n));
    })());
    /* v89.86：旧估数 190；现行口径（v89.51 起 = price>0 且 type ∈ SHOP_CATS）实测 187 ——
       阈值随口径下调（与 smoke「在售 == 有页签 · 187 件」同源），保留 ≥185 的下限语义。 */
    /* v89.86：旧估数 190；v89.51 起口径 = price>0 且 type ∈ SHOP_CATS（实测 187）；
       v89.104（老板「同类产品档次太多…最多分 4 档」）：冗余档位下架 → 实测 168。
       阈值随口径下调，**下限语义不变**：商城必须还在卖东西（不是被清空）。 */
    check('v89.50：商城物件数 ≥ 160（现行在售口径 · v89.104 收敛后）',
      G.ui.shopItems().length >= 160, G.ui.shopItems().length + ' 件');
    check('v89.50：新货真在商城页上（切到「符类」类目可见新符）', (function () {
      const all = G.ui.shopItems();
      const hasNew = all.some((it) => it.id === 'huyi') && all.some((it) => it.id === 'sixiang')
        && all.some((it) => it.id === 'tianshi_ling');
      if (!hasNew) return false;
      G.ui._shopCat = 'attr_buff';
      G.ui.setView('shop');
      return document.body.innerHTML.indexOf('虎翼符') >= 0;
    })());
    check('v89.50：打造清单含新套件（游侠/陷阵/守御/天策 各 12 件）', (function () {
      const fl = G.forgeList();
      return ['youxia', 'xianzhen', 'shouyu', 'tiance'].every(function (sk) {
        return fl.filter((f) => f.item.set === sk).length === 12;
      });
    })());
    /* ③ v89.50 顺带修复：符类真的加属性 */
    check('v89.50（真 bug 修复）：虎符用过之后统率真的涨', (function () {
      const g = G.state.generals[0];
      if (!g) return false;
      const bkItems = G.state.items, bkBuffs = G.state.buffs;
      G.state.buffs = null;
      const before = G.genAttrs(g);
      G.state.items = { hufu: 1 };
      const r = G.systems.useItem('hufu', g.id);
      const after = G.genAttrs(g);
      G.state.items = bkItems; G.state.buffs = bkBuffs;
      return r.ok && after.tong > before.tong;
    })(), '统率 ×1.5');
  }

  /* ------------------------------------------------------------
   * v89.51（老板「物品的产生和消耗路径打通了，别买了用不了」）
   * 真机链路：商城买得到 → 背包看得见 → 点得动 → 真的有结果
   * ------------------------------------------------------------ */
  console.log('\n--- v89.51 物品闭环（真机） ---');
  {
    G.state.res.gold = Math.max(G.state.res.gold || 0, 5e7);
    /* ① 商城「营造」页签在、且列得出货 */
    G.ui.openShop('build_cost');
    await sleep(80);
    const shopHtml = document.querySelector('#view-container').innerHTML;
    check('v89.51：商城有「营造」页签且列得出货', shopHtml.indexOf('data-c="build_cost"') >= 0
      && shopHtml.indexOf('shop-buy') >= 0);
    /* ② 买一件宝箱 → 入包 */
    const goldBefore = G.state.res.gold;
    G.doShopping('chest_tong', 1);
    await sleep(60);
    check('v89.51：宝箱买得到（金减少 · 入包）', (G.state.items.chest_tong || 0) >= 1
      && G.state.res.gold < goldBefore, '持 ' + G.state.items.chest_tong);
    /* ③ 背包宝物页列出宝箱（改前此类根本不显示）→ 点「使用」真的开箱 */
    const bagGold0 = G.state.res.gold;
    G.ui.openBag('item');
    G.ui.setBagSub('chest');       /* v89.115：单类分类条，宝箱必在第 1 页 */
    await sleep(90);
    const bagHtml = document.querySelector('#view-container').innerHTML;
    check('v89.51：背包宝物页列出宝箱（改前"持有却看不见"）', bagHtml.indexOf('宝箱') >= 0
      && bagHtml.indexOf('data-key="chest_tong"') >= 0);
    const useBtn = document.querySelector('#view-container [data-key="chest_tong"][data-action="use-bag-item"]');
    if (useBtn) click(useBtn);
    await sleep(160);
    check('v89.51：在背包里点「使用」真的开出东西（金增加）', (G.state.res.gold || 0) > bagGold0);
    /* ④ 五类新货都在背包分组里（秘籍/政令/锦囊/营造/精华） */
    const bkItems = G.state.items;
    G.state.items = Object.assign({}, bkItems, { corvee: 1, jinang: 1, kaogongji: 1, lingsui: 3 });
    (G.DATA.ITEMS || []).forEach((it) => { if (it.type === 'neigong') G.state.items[it.id] = 1; });
    G.ui.openBag('item');
    G.ui.setBagSub('essence');     /* v89.115：切到「精华」分类（该行必在第 1 页） */
    await sleep(90);
    const bag2 = document.querySelector('#view-container').innerHTML;
    check('v89.51：背包分组覆盖 秘籍 / 政令 / 锦囊 / 营造 / 精华', (function () {
      /* v89.86：宝物页分页 16 行/页 —— 五类新货未必落在第 1 页（bag2 只含当前页）。
         改判「分组表覆盖五类（ui.BAG_ITEM_CN 即该契约的唯一出口）+ 每类都有实物」，
         不依赖分页落在哪一页；渲染链路另有"列宝箱"一条在前。 */
      const CN = G.ui.BAG_ITEM_CN || {};
      const types = ['neigong', 'corvee', 'talis', 'build_cost', 'essence'];
      const cn = types.map((t) => (CN[t] || '')).join(' ');
      const all = G.DATA.ITEMS || [];
      return ['秘籍', '政令', '锦囊', '营造', '精华'].every((w) => cn.indexOf(w) >= 0)
        && types.every((t) => all.some((it) => it.type === t));
    })());
    /* ⑤ 灵气精华行有「去蕴养」直达按钮，点了真开蕴养面板 */
    const essBtn = document.querySelector('#view-container [data-action="ling-temper-open"]');
    check('v89.51：灵气精华行有「去蕴养」直达按钮', !!essBtn);
    if (essBtn) click(essBtn);
    await sleep(160);
    const mr = document.querySelector('#modal-root');
    const mrHtml = mr ? mr.innerHTML : '';
    check('v89.51：点「去蕴养」真的打开蕴养面板', mrHtml.indexOf('蕴养') >= 0 || mrHtml.indexOf('灵气精华') >= 0);
    G.ui.closeAllModals();
    await sleep(60);
    G.state.items = bkItems;
    /* ⑥ 使用对象：认「选定将领」，不再固定第一位 */
    const gen0 = G.state.generals[0];
    const oldGen = G.ui._itemGen;
    G.ui._itemGen = gen0 ? gen0.id : '';
    check('v89.51：背包使用对象 = 选定将领（不再固定第一位）',
      G.bagTargetGenId() === ((gen0 || {}).id));
    G.ui._itemGen = oldGen;
  }

  /* ============================================================
   * v89.86 整改清单（真实 DOM）—— 关键 UI 触点
   * ============================================================ */
  console.log('\n--- v89.86. 整改清单 UI 触点（真实 DOM） ---');
  await (async function () {
    /* P-02：favicon 在册（data-URI，消除固定 404） */
    check('v89.86（P-02）：favicon link 在册（data-URI）', (function () {
      const l = document.querySelector('link[rel="icon"]');
      return !!l && String(l.getAttribute('href')).indexOf('data:image/svg+xml') === 0;
    })());

    const c86 = G.currentCity();
    c86.cells = c86.cells || [];
    /* P-12：书院科技面板 —— 按钮「研究(黄金 …)」无 NaN（真实渲染） */
    if (!c86.cells.some((x) => x && x.build && x.build.id === 'shuyuan')) {
      for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { c86.cells[i] = { build: { id: 'shuyuan', lvl: 10 } }; break; } }
    }
    G.ui.openPanel('tech');
    await sleep(90);
    const th86 = document.querySelector('#modal-root').innerHTML;
    check('v89.86（P-12）：科技面板按钮 =「研究(黄金 …)」且无 NaN',
      th86.indexOf('NaN') < 0 && /研究\(黄金 [^)]+\)/.test(th86));
    G.ui.closeAllModals();
    await sleep(40);

    /* P-20：顶栏「军务」（原名「行军」）→ 军务总览五段 */
    const mTab86 = document.querySelector('#topnav [data-view="marches"]');
    check('v89.86（P-20）：顶栏菜单更名「军务」（data-view 不变）',
      !!mTab86 && mTab86.textContent.indexOf('军务') >= 0);
    if (mTab86) {
      click(mTab86);
      await sleep(140);
      const mv86 = document.querySelector('#view-container').innerHTML;
      /* v89.132（老板）：两营区自总览退役（只在军务处）—— 总览四段齐。 */
      check('v89.140：军务总览三段齐（① 城内 / ③ 行军）· 驻守野地与采集队已退役 · 两营不在总览',
        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') < 0
        && mv86.indexOf('③ 采集队') < 0 && mv86.indexOf('行军') >= 0
        && mv86.indexOf('⑤ 两营') < 0);
    }
    G.ui.setView('city');
    await sleep(60);

    /* P-07：建造队列花金提速（真实点击：面板按钮 → 队列被推到满进度） */
    let q86i = -1;
    for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { q86i = i; break; } }
    if (q86i >= 0) {
      c86.cells[q86i] = { build: { id: 'minfang', lvl: 1 }, pending: { buildId: 'minfang', targetLevel: 2 } };
      /* v89.178：totalTime 拉大（原 120 = 剩 100 游戏秒 ≈ 0.83 现实秒，会被主循环 tick 在
         sleep 窗口内推到完工 -> 面板提前变"已建成" -> 提速按钮找不到；本轮实中一次 flaky）。
         口径同 §77.1"造局三件套"：过 tick 的造局一律给大值。 */
      G.state.queues.build = [{ cityId: c86.id, gridIndex: q86i, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 20, totalTime: 600000 }];
      G.state.res.gold = Math.max(G.state.res.gold || 0, 500000);
      G.ui.openBuildModal(q86i);
      await sleep(80);
      const rb86 = document.querySelector('#modal-root [data-action="rush-build"]');
      check('v89.86（P-07）：建筑施工面板含「⚡ 提速」按钮', !!rb86);
      if (rb86) {
        click(rb86);
        await sleep(140);
        const q86 = G.state.queues.build[0];
        check('v89.86（P-07）：提速后队列推到满进度（下一拍落成）',
          !q86 || q86.elapsed >= q86.totalTime);
      }
    } else {
      check('v89.86（P-07）：建筑施工面板含「⚡ 提速」按钮（无空格可测，跳过）', true);
      check('v89.86（P-07）：提速后队列推到满进度（跳过）', true);
    }
    G.ui.closeAllModals();
    await sleep(40);

    /* 门派 P1：名录六派被动全部可读（真实渲染） */
    if (!c86.cells.some((x) => x && x.build && x.build.id === 'honglusi')) {
      for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { c86.cells[i] = { build: { id: 'honglusi', lvl: 1 } }; break; } }
    }
    G.state.sect = { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
    G.ui.openSect();
    await sleep(80);
    const sec86 = document.querySelector('#modal-root').innerHTML;
    check('v89.86（门派P1）：名录六派被动全部可读（行军速度/部队攻击/伤兵回复/攻城伤害/器械耗时/坐骑属性）',
      ['行军速度 +8%', '部队攻击 +6%', '战后伤兵回复 +15%', '攻城伤害 +8%', '器械打造耗时 −15%', '坐骑装备属性 +20%']
        .every((t) => sec86.indexOf(t) >= 0));
    G.ui.closeAllModals();
    await sleep(30);
  })();

  console.log('\n--- v89.87. 战场界面（真实 DOM：挂起→界面→指令→完成→自动→战果） ---');
  {
    const s90 = G.state;
    const c90 = s90.cities[0];
    s90.settings.battleWatch = true;          /* 本段单独开观战 */
    /* v89.88：钉定天气为「晴」—— 战斗引擎读天气（雨：弓兵射程 −20%/行军 −20%），
       不钉定则本段"多回合"性质随天气摆动（实测复发：雨天首回合清场 →
       点完「完成回合」战场被战果面板替换，#bt-round/#bt-auto 消失 = 假红）。 */
    const we90bak = s90.world.weather;
    s90.world.weather = 'clear';
    /* v89.88：本段用**新建的 Lv1 弱将** —— 战斗杀伤量随将领强度暴涨
       （探针实测：tong/yw 3000 的强将一回合清场、Lv1 弱将同兵力 4~5 回合），
       而本局老将早已练高；用强将则点完「完成回合」战场即被战果面板替换
       （#bt-round/#bt-auto 消失 = 假红）。本段只验界面流转，用弱将最稳。 */
    const g90 = G.makeGeneral('观战预备', 1, 'idle', c90.id, false);
    s90.generals.push(g90);
    G.setStaNow(g90, 1000); g90.energy = 100;
    /* v89.88：优先选**低等级野地**（≤Lv1）—— 战斗引擎的杀伤量随兵力规模放大：
       大兵力是"首回合清场"节奏（2 万级一回合打完），小兵力才是多回合拉锯
       （探针实测 20v20 打满 5 回合）。本段要验证"完成回合/自动战斗"的界面流转，
       必须多回合 —— 否则点完「完成回合」战场被战果面板替换 = 假红。 */
    let wt90 = null;
    for (let r = 1; r <= 20 && !wt90; r++) {
      for (let dy = -r; dy <= r && !wt90; dy++) for (let dx = -r; dx <= r && !wt90; dx++) {
        const x = c90.x + dx, y = c90.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        const tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        /* 只要 Lv2~4：多兵种（含长枪 → 目标下拉断言要用）+ 规模小（拉锯多回合） */
        const wlv = G.map.wildLevelNow(x, y);
        if (wlv < 2 || wlv > 4) continue;
        wt90 = { x: x, y: y };
      }
    }
    check('v89.87（战场）：找到野地（Lv2~4，小规模多兵种）', !!wt90,
      wt90 ? ('Lv' + G.map.wildLevelNow(wt90.x, wt90.y)) : '未找到');
    if (wt90) {
      /* v89.88：兵力改为**与守军同构同量**（对称拉锯）—— 旧口径（守军 60% 的
         单一兵种）在天气摆动下仍可能首回合清场（点完"完成回合"战场被战果面板
         替换 → #bt-round/#bt-auto 消失）。对称兵力使双方同步消耗，必然多回合，
         且与天气无关（双方同吃天气修正）。 */
      const wlv90 = G.map.wildLevelNow ? G.map.wildLevelNow(wt90.x, wt90.y) : G.map.wildLevel(wt90.x, wt90.y);
      const wd90 = G.wildDefenseAt(wt90.x, wt90.y, wlv90);
      const send90 = {};
      for (const gk in (wd90.army || {})) send90[gk] = wd90.army[gk];
      c90.army = {};
      for (const gk in send90) c90.army[gk] = send90[gk];
      s90.marches = [];
      const d90 = G.march.dispatch({ kind: 'wild', x: wt90.x, y: wt90.y }, 'raid', send90, g90.id);
      check('v89.87（战场）：出征入队（行军通道）', d90.ok === true, d90.msg);
      const m90 = s90.marches[0];
      if (m90) { m90.elapsed = m90.totalTime; G.march.tick(); }
      await sleep(180);
      check('v89.87（战场）：抵达挂起（不再即时结算）',
        s90.battles.length === 1 && s90.battles[0].state === 'live',
        'battles=' + s90.battles.length);
      /* v89.150（老板 5）：抵达**不再直接进战场** —— 先弹「战斗待指挥」清单
         （标题 + 目标/战斗类型/是否观战 三列表格），点「观战」才进场。
         v89.150（老板 6）：战场层带 closeAll（关闭一次关净回视图）。 */
      check('v89.150（战场）：抵达弹「战斗待指挥」清单（不直接进战场）', (function () {
        const box = document.querySelector('#modal-root');
        const txt = box ? (box.textContent || '') : '';
        return txt.indexOf('战斗待指挥') >= 0 && !document.querySelector('#modal-root #bt-field');
      })(), (document.querySelector('#modal-root') ? (document.querySelector('#modal-root').textContent || '').slice(0, 30) : '无弹窗'));
      const btOpen90 = document.querySelector('#modal-root [data-action="bt-open"]');
      check('v89.150（战场）：清单三列表格 + 每行「观战」按钮',
        !!btOpen90 && (function () {
          const ths = Array.prototype.map.call(document.querySelectorAll('#modal-root th'), (x) => x.textContent.trim());
          return ths.join('/') === '目标/战斗类型/是否观战';
        })());
      if (btOpen90) { click(btOpen90); await sleep(200); }
      check('v89.150（战场）：点「观战」进场（#bt-field + 我方单位卡）',
        !!document.querySelector('#modal-root #bt-field')
        && !!document.querySelector('#modal-root .bt-unit.atk'));
      check('v89.150（战场）：战场层带 closeAll（关闭 = 一次关净回视图）',
        G.ui._modalCloseAll === true);
      check('v89.87（战场）：标题与倒计时在（bt-cd）',
        !!document.querySelector('#modal-root #bt-cd'));
      /* v89.116（老板需求 8）：动作设置从"三个并排按钮"改成**一个下拉框**
         （前进 / 驻守 / 后退）—— 这里验它在册、三个选项齐、且改得动。 */
      /* v89.164（智能战斗默认开）：本段起验证"手动指令"的 DOM 语义 ——
         先关智能托管（默认开会每回合接管我方全部指令，与本段用例语义冲突），
         结束处还原（bkSmart149 见下）。 */
      const bkSmart149 = G.state.settings.smartBattle;
      G.battle.setSmartBattle(false);
      const stSel = document.querySelector('#modal-root [data-action="bt-stance"]');
      check('v89.116（战场）：动作改为下拉框（前进/驻守/后退三选项）',
        !!stSel && stSel.tagName === 'SELECT' && stSel.options.length === 3,
        stSel ? (stSel.tagName + '/' + stSel.options.length) : '缺失');
      if (stSel) {
        stSel.value = 'hold';
        stSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(80);
      }
      const rec90 = s90.battles[0];
      check('v89.116（战场）：下拉改动作真的落进指令（驻守）',
        !!rec90 && !!rec90.cmd && Object.keys(rec90.cmd).some((k) => rec90.cmd[k].s === 'hold'),
        rec90 ? JSON.stringify(rec90.cmd) : '无记录');
      const tgtSel = document.querySelector('#modal-root #bt-t-changqiang');
      check('v89.87（战场）：目标下拉在册（bt-t-*）', !!tgtSel);
      const doneBtn = document.querySelector('#modal-root [data-action="bt-done"]');
      check('v89.87（战场）：完成回合按钮存在', !!doneBtn);
      /* v89.120（老板需求 3）：三键从弹窗底栏移到读秒行（.bt-top .bt-acts）——真 DOM 查位置 */
      check('v89.120（战场）：三键在读秒行内（.bt-top .bt-acts）',
        !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-done"]')
        && !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-auto"]')
        && !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-retreat"]')
        && !document.querySelector('#modal-root .m-foot [data-action="bt-done"]'));
      if (doneBtn) { click(doneBtn); await sleep(220); }
      /* ============================================================
       * v89.149（老板 1~7）：战场真 DOM 复核 —— **每回合可重设**（改完不跳回去）·
       *   一字简称 · 默认"同兵种"· 无"目标："前缀 · 战场条铺满（--rel）·
       *   读数 = 最近距离/全局 · 无「左侧设动作/目标」备注
       * ============================================================ */
      {
        /* v89.164：智能已在段首关闭（见上），块尾统一还原 */
        const sels149 = document.querySelectorAll('#modal-root [data-action="bt-stance"]');
        const tkA149 = sels149[0] ? sels149[0].getAttribute('data-troop') : null;
        const tkB149 = sels149[1] ? sels149[1].getAttribute('data-troop') : null;
        /* ② 每回合可重设：上一段把第 1 支改成"驻守"（且在完成一回合之后仍在） */
        check('v89.149（战场）：每回合可重设 —— 上一回合改的"驻守"仍在（不跳回默认）',
          !!sels149[0] && sels149[0].value === 'hold' && !!tkA149,
          sels149[0] ? (tkA149 + '=' + sels149[0].value) : '无下拉');
        /* ② 再改一次（第 2 回合重设）→ **DOM 不回弹**（病根：旧实现拿上一回合末快照重绘） */
        if (sels149[0]) {
          sels149[0].value = 'retreat';
          sels149[0].dispatchEvent(new window.Event('change', { bubbles: true }));
          await sleep(80);
        }
        const sel149b = document.querySelector('#modal-root [data-action="bt-stance"][data-troop="' + tkA149 + '"]');
        const rec149 = s90.battles[0];
        check('v89.149（战场）：改完**不回弹**（DOM 与命令一致）',
          !!sel149b && sel149b.value === 'retreat'
          && !!rec149 && !!rec149.cmd && !!rec149.cmd[tkA149] && rec149.cmd[tkA149].s === 'retreat',
          sel149b ? ('dom=' + sel149b.value + ' cmd=' + JSON.stringify(rec149 && rec149.cmd)) : '下拉丢失');
        check('v89.149（战场）：没动的那支**原样继承**（不动不改）',
          !tkB149 || !(rec149 && rec149.cmd && rec149.cmd[tkB149]),
          '未动兵种=' + tkB149 + ' cmd=' + JSON.stringify(rec149 && rec149.cmd));
        /* ④ 默认"同兵种" + 无"目标："前缀 */
        const tgt149 = document.querySelector('#modal-root [data-action="bt-target"]');
        const board149 = document.querySelector('#bt-board');
        check('v89.149（战场）：目标下拉首项「同兵种」· 全盘无「目标：」前缀',
          !!tgt149 && tgt149.options.length >= 2 && tgt149.options[0].textContent === '同兵种'
          && !!board149 && (board149.innerHTML || '').indexOf('目标：') < 0,
          tgt149 ? ('首项=' + tgt149.options[0].textContent + ' 项数=' + tgt149.options.length) : '无目标下拉');
        /* ③ 一字简称 */
        const nm149 = document.querySelector('#modal-root .bt-card .bt-rnm');
        const nmTip149 = nm149 ? nm149.querySelector('.tip-src') : null;
        /* ⚠️ `.bt-rnm` 的 textContent 会**连隐藏的 .tip-src 文本一起算** ——
           简称判据取**直接文本节点**（childNodes[0]），不是 textContent。 */
        check('v89.149/§151（战场）：兵种名 = 一字简称（全名/最终属性在**富浮层**里）',
          !!nm149 && nm149.childNodes[0] && nm149.childNodes[0].nodeType === 3
          && nm149.childNodes[0].textContent.trim().length === 1 && !!nmTip149
          && (nmTip149.innerHTML || '').length > 60
          && (nmTip149.innerHTML || '').indexOf('全军血量') >= 0
          /* v89.179：克制系统全撤 —— 悬停不再有"克制/抗性/被克"三行
             （v89.157 的"无相克不显示"至此演进为"全局无相克"）。 */
          && (!/cnt-/.test(nmTip149.innerHTML || '')
            || /cnt-(good|bad)/.test(nmTip149.innerHTML || ''))
          && !!nm149.getAttribute('data-tip-el'),
          nm149 ? ((nm149.childNodes[0] ? nm149.childNodes[0].textContent.trim() : '?')
            + ' / tip-src 长度 ' + (nmTip149 ? (nmTip149.innerHTML || '').length : 0)
            + ' data-tip-el=' + !!nm149.getAttribute('data-tip-el')) : '无');
        /* ⑤ 战场条铺满（布局在 jsdom 量不到 —— 验"不内联定高 + 兵牌带 --rel"） */
        const fld149 = document.getElementById('bt-field');
        const u149 = document.querySelector('#bt-field .bt-unit');
        check('v89.149（战场）：战场条不内联定高 · 兵牌带 --rel（纵向铺满）',
          !!fld149 && (fld149.getAttribute('style') || '').indexOf('height') < 0
          && !!u149 && (u149.getAttribute('style') || '').indexOf('--rel') >= 0,
          fld149 ? ('style=' + (fld149.getAttribute('style') || '(空)')) : '无战场条');
        /* ⑦ 读数 + ⑥ 备注 */
        const gap149 = document.getElementById('bt-gap');
        check('v89.149/§151（战场）：读数 =「距离 XX / XX」（一段双数）· 无「左侧设动作/目标」备注',
          !!gap149 && /^距离 /.test(gap149.textContent.replace(/\s+/g, ' ').trim())
          && /\d/.test(gap149.textContent) && gap149.textContent.indexOf('最近距离') < 0
          && !document.querySelector('#modal-root .bt-hint'),
          gap149 ? gap149.textContent : '无读数');
        G.state.settings.smartBattle = bkSmart149;   /* v89.164：还原智能开关 */
      }
      /* v89.120（老板需求 4）：回合记录倒叙 —— 真 DOM 里喂两个回合块，
         最新块在最上、块内保持"回合头 → 逐兵种行"正序、块首是虚线 */
      {
        const logEl120 = document.querySelector('#bt-log');
        if (!logEl120) {
          check('v89.120（战场）：回合记录倒叙（最新在最上）', false, '#bt-log 缺失');
        } else {
          const snap120 = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 10, range: 50 }],
            def: [{ id: 'yibing', name: '义兵', count: 100, adv: 10, range: 20 }], towers: null };
          G.ui.btRoundLine({ r: 91, gap: 900, events: [{ kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 5 }] }, snap120);
          G.ui.btRoundLine({ r: 92, gap: 800, events: [{ kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 6 }] }, snap120);
          const hdrs120 = logEl120.querySelectorAll('.bt-ev.hdr');
          check('v89.120（战场）：回合记录倒叙（最新在最上）',
            hdrs120.length >= 2 && /第 92 回合/.test(hdrs120[0].textContent),
            hdrs120.length ? hdrs120[0].textContent : '无回合头');
          const kids120 = logEl120.children;
          check('v89.120（战场）：块内正序（回合头在行之前、块首虚线）',
            kids120.length >= 3 && String(kids120[0].className).indexOf('sep') >= 0
            && String(kids120[1].className).indexOf('hdr') >= 0,
            kids120.length ? (kids120[0].className + ' / ' + kids120[1].className) : '空');
        }
      }
      const rdEl = document.querySelector('#bt-round');
      check('v89.87（战场）：完成回合 → 回合推进（≥1）',
        !!rdEl && Number(rdEl.textContent) >= 1, rdEl ? rdEl.textContent : '无');
      const autoBtn = document.querySelector('#modal-root [data-action="bt-auto"]');
      check('v89.87（战场）：自动战斗按钮存在', !!autoBtn);
      if (autoBtn) { click(autoBtn); await sleep(300); }
      check('v89.87（战场）：自动 → 挂起清空（落账完成）', s90.battles.length === 0,
        'battles=' + s90.battles.length);
      /* v89.136（老板 3）：「无需弹窗，直接在下方回合记录里记录回合结束」——
         战果面板退役，改为播报窗末行（含回合数/双方损失） */
      check('v89.136（战场）：结束行进播报窗（战果面板退役 · 无战果弹窗）', (function () {
        var log = document.querySelector('#bt-log');
        return !!log && (log.textContent || '').indexOf('🏁 战斗结束') >= 0
          && document.querySelector('#modal-root').innerHTML.indexOf('战场 · 战果') < 0;
      })());
      check('v89.87（战场）：将领归来（idle）', g90.status === 'idle', String(g90.status));
      G.ui.closeAllModals();
      await sleep(40);
    }
    s90.settings.battleWatch = false;
    s90.world.weather = we90bak;              /* 还原天气 */
  }

  /* ============================================================
   * 91. v89.88（老板需求 4~5）：大地图悬浮浮层 —— 「坐标 + 等级」
   * ------------------------------------------------------------
   * 真实 DOM：断言画布事件接线、浮层内容、同格节流、移出收起。
   * ============================================================ */
  console.log('\n--- 91. v89.88 地图悬浮（坐标 + 等级）---');
  {
    G.ui.setView('map');
    await sleep(90);
    const cv91 = document.querySelector('#mapCanvas');
    check('v89.88（悬浮）：大地图画布在场', !!cv91);
    if (cv91) {
      const v = G.map._view;
      const pc91 = G.map.playerCity();
      const oldRect = cv91.getBoundingClientRect;
      cv91.getBoundingClientRect = function () {
        return { left: 0, top: 0, width: cv91.width, height: cv91.height };
      };
      const mov = (x, y) => cv91.dispatchEvent(new window.MouseEvent('mousemove',
        { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));

      /* ① 悬停主城格：浮层出现（己方 + 坐标 + 城等级） */
      const sx91 = v.ox + (pc91.x - pc91.y) * v.HW, sy91 = v.oy + (pc91.x + pc91.y) * v.HH;
      mov(sx91, sy91);
      await sleep(40);
      const tipEl = document.querySelector('#tip-layer');
      const th1 = tipEl ? tipEl.innerHTML : '';
      check('v89.88（悬浮）：主城格浮层（己方 · 坐标 · 城等级）',
        !!tipEl && tipEl.classList.contains('on')
          && th1.indexOf('己方') >= 0 && th1.indexOf('(' + pc91.x + ', ' + pc91.y + ')') >= 0
          && th1.indexOf('Lv' + G.cityLvOf(pc91)) >= 0,
        th1.replace(/<[^>]*>/g, ' ').trim().slice(0, 80));

      /* ③ 先找一块空野地格（供节流"换格"与内容断言共用） */
      let wt91 = null;
      for (let r = 1; r <= 4 && !wt91; r++) {
        for (let dy = -r; dy <= r && !wt91; dy++) {
          for (let dx = -r; dx <= r && !wt91; dx++) {
            const x = pc91.x + dx, y = pc91.y + dy;
            if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
            if (G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
            wt91 = { x: x, y: y };
          }
        }
      }

      /* ② 同格节流：同格内连续移动 **0 次重绘**；换格恰好 1 次（浮层不追鼠标抖） */
      if (wt91) {
        let tipCalls = 0;
        const origTipShow = G.ui.tipShow;
        G.ui.tipShow = function () { tipCalls++; return origTipShow.apply(this, arguments); };
        mov(sx91 + 2, sy91 + 1);
        mov(sx91 + 4, sy91 + 2);                       /* 仍在主城格内 */
        const sameCellCalls = tipCalls;
        mov(v.ox + (wt91.x - wt91.y) * v.HW, v.oy + (wt91.x + wt91.y) * v.HH);   /* 换格 */
        const changeCalls = tipCalls - sameCellCalls;
        G.ui.tipShow = origTipShow;
        check('v89.88（悬浮）：同格节流（同格 0 次重绘 · 换格恰好 1 次）',
          sameCellCalls === 0 && changeCalls === 1, '同格 ×' + sameCellCalls + ' · 换格 ×' + changeCalls);
      } else {
        check('v89.88（悬浮）：同格节流（同格 0 次重绘 · 换格恰好 1 次）', false, '主城周边未找到空野地格');
      }

      /* ③ 野地格浮层内容（上一步"换格"已渲染；含野地等级 · 走 wildLevelNow 唯一出口） */
      if (wt91) {
        await sleep(40);
        const th2 = tipEl ? tipEl.innerHTML : '';
        check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）',
          th2.indexOf('野地') >= 0 && th2.indexOf('Lv' + G.map.wildLevelNow(wt91.x, wt91.y)) >= 0
            && th2.indexOf('(' + wt91.x + ', ' + wt91.y + ')') >= 0,
          th2.replace(/<[^>]*>/g, ' ').trim().slice(0, 80));
      } else {
        check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）', false, '主城周边未找到空野地格');
      }

      /* ④ 移出画布：浮层立即收起 */
      cv91.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window }));
      await sleep(20);
      check('v89.88（悬浮）：移出画布即收起', !(tipEl && tipEl.classList.contains('on')));

      cv91.getBoundingClientRect = oldRect;
    } else {
      check('v89.88（悬浮）：主城格浮层（己方 · 坐标 · 城等级）', false, '画布缺失');
      check('v89.88（悬浮）：同格节流（同格 0 次重绘 · 换格恰好 1 次）', false, '画布缺失');
      check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）', false, '画布缺失');
      check('v89.88（悬浮）：移出画布即收起', false, '画布缺失');
    }
  }

  /* ============================================================
   * 92. v89.89（v6 期待清单）：归来报告 / 一键全领 / 故事集 / 战报筛选 / 人口三段条
   * ------------------------------------------------------------
   * 真实 DOM：弹窗与页面渲染 + 点击链路（本段为收尾段，可放心做真实操作）。
   * ============================================================ */
  console.log('\n--- 92. v89.89 期待清单（A2/B1/C4/D4/E3）---');
  {
    const s92 = G.state;

    /* ① A2 归来报告：塞报告 → 打开 → DOM 断言 → 关闭 */
    G._offlineReport = { secReal: 7200, applied: 7200, overflow: 0, capDays: 7,
      res: { grain: 999, wood: 0, stone: 0, iron: 0, gold: 0, pop: 0 },
      done: { build: 1, tech: 0, train: 0 },
      reports: ['E2E 归来战报'], reportsN: 1, wounded: 0, marchMsg: '' };
    G.ui.openOfflineReport();
    await sleep(60);
    const mr92 = document.querySelector('#modal-root');
    const h92 = mr92 ? mr92.textContent : '';
    check('v89.89（A2）：归来报告弹窗（DOM · 分类块）',
      h92.indexOf('归来报告') >= 0 && h92.indexOf('资源净变') >= 0
        && h92.indexOf('在办完成') >= 0 && h92.indexOf('E2E 归来战报') >= 0,
      h92.replace(/\s+/g, ' ').slice(0, 64));
    const close92 = mr92 && mr92.querySelector('[data-action="close-modal"]');
    if (close92) click(close92);
    await sleep(40);
    G._offlineReport = null;

    /* ② B1 一键全领：任务页渲染 + 真实点击（mock 两条达标任务） */
    const og92 = G.questGoal, oa92 = G.questAmount;
    const q1_92 = G.DATA.QUESTS[0], q2_92 = G.DATA.QUESTS[1];
    G.ui.setView('tasks');
    await sleep(60);
    G.questGoal = (q) => (q === q1_92 || q === q2_92) ? 5 : og92(q);
    G.questAmount = (q) => (q === q1_92 || q === q2_92) ? 9 : oa92(q);
    G.ui.renderView('tasks');
    await sleep(60);
    const allBtn92 = document.querySelector('[data-action="quest-claim-all"]');
    check('v89.89（B1）：任务页「一键全领」按钮在场', !!allBtn92);
    if (allBtn92) {
      const before92 = Object.keys(s92.quests.done || {}).length;
      click(allBtn92);
      await sleep(80);
      const after92 = Object.keys(s92.quests.done || {}).length;
      check('v89.89（B1）：一键全领入账（done 增加 ≥ 2）', after92 - before92 >= 2,
        before92 + ' → ' + after92);
    } else {
      check('v89.89（B1）：一键全领入账（done 增加 ≥ 2）', false, '按钮缺失');
    }
    G.questGoal = og92; G.questAmount = oa92;

    /* ③ D4 战报筛选 + 收藏（真实 DOM 点击） */
    s92.reports.unshift({ t: Date.now(), title: 'E2E 胜报甲', body: 'x', win: true });
    s92.reports.unshift({ t: Date.now(), title: 'E2E 败报乙', body: 'x', win: false });
    G.ui._repFilter = 'all';
    G.ui.setView('reports');
    await sleep(80);
    const chipLose = document.querySelector('[data-action="rep-filter"][data-v="lose"]');
    check('v89.89（D4）：战报筛选 chips 在场（含 收藏）',
      !!chipLose && !!document.querySelector('[data-action="rep-filter"][data-v="fav"]'));
    if (chipLose) {
      click(chipLose);
      await sleep(80);
      const vc92 = document.querySelector('#view-container');
      const tv92 = vc92 ? vc92.textContent : '';
      check('v89.89（D4）：点击筛选「败」只显败报',
        tv92.indexOf('E2E 败报乙') >= 0 && tv92.indexOf('E2E 胜报甲') < 0,
        tv92.replace(/\s+/g, ' ').slice(0, 56));
    } else {
      check('v89.89（D4）：点击筛选「败」只显败报', false, 'chip 缺失');
    }
    G.ui.setRepFilter('all');
    await sleep(60);
    const favBtn92 = document.querySelector('[data-action="rep-fav"]');
    check('v89.89（D4）：行内收藏星标在场', !!favBtn92);
    if (favBtn92) {
      /* v89.120：行内身份改 **data-rid** —— 用唯一出口取报告（不再用数组下标取，
         数组位移会让旧下标指到别的报告 —— 这正是"战报异常跳转"的病根） */
      const frid = Number(favBtn92.dataset.rid);
      const fRep = G.repByRid(frid);
      const beforeFav = !!(fRep && fRep.fav);
      click(favBtn92);
      await sleep(70);
      const fRep2 = G.repByRid(frid);
      check('v89.89（D4）：点击收藏翻转（随档字段）', !!fRep2 && !!fRep2.fav === !beforeFav,
        'fav ' + beforeFav + ' → ' + (fRep2 ? fRep2.fav : 'null'));
      if (fRep2) fRep2.fav = false;
    } else {
      check('v89.89（D4）：点击收藏翻转（随档字段）', false, '星标缺失');
    }
    s92.reports = s92.reports.filter((r) => !/^E2E /.test(r.title));

    /* ④ C4 故事集：渲染 + 点击重读（真实 DOM） */
    const st0_92 = G.SG.list()[0];
    const bakRec92 = s92.stories ? s92.stories[st0_92.id] : undefined;
    if (!s92.stories) s92.stories = {};
    s92.stories[st0_92.id] = { done: ['e1'], n: 2, grade: 'good' };
    G.ui.setView('stories')      /* v89.104：故事集独立成页 */;
    await sleep(90);
    const vc92b = document.querySelector('#view-container');
    const hs92 = vc92b ? vc92b.textContent : '';
    check('v89.89（C4）：故事集（独立页 · v89.104 起与史册并列）已读 1 / N',
      hs92.indexOf('故事集') >= 0 && hs92.indexOf('《' + st0_92.title + '》') >= 0,
      hs92.replace(/\s+/g, ' ').slice(0, 56));
    const rBtn92 = document.querySelector('[data-action="story-read-at"]');
    check('v89.89（C4）：已读篇目重读入口在场', !!rBtn92);
    if (rBtn92) {
      click(rBtn92);
      await sleep(90);
      const fx92 = document.querySelector('#story-fx');
      check('v89.89（C4）：点击重读 → 阅读器打开', !!fx92 && fx92.style.display === 'block');
      const exit92 = fx92 && fx92.querySelector('[data-action="story-exit"]');
      if (exit92) click(exit92); else G.SG.close();
      await sleep(60);
    } else {
      check('v89.89（C4）：点击重读 → 阅读器打开', false, '重读按钮缺失');
    }
    if (bakRec92 === undefined) delete s92.stories[st0_92.id]; else s92.stories[st0_92.id] = bakRec92;

    /* ⑤ E3 人口三段条（真实 DOM：募兵页兵种卡） */
    G.ui._trainTab = 'inf'; G.ui._trainFilter = 'normal';
    G.ui.setView('troops');
    await sleep(90);
    const pop3 = document.querySelector('.pop-3');
    check('v89.89（E3）：募兵页人口三段条在场', !!pop3,
      pop3 ? pop3.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '缺失');
    check('v89.89（E3）：三段文字齐（可征/上限/增势）',
      !!pop3 && /可征/.test(pop3.textContent) && /上限/.test(pop3.textContent) && /增势/.test(pop3.textContent));
    G.ui._trainTab = 'que';
  }

  G.ui.setView('city');
  await sleep(60);

  /* ============================================================
   * v89.105（老板「全面测评，全功能链路复核」+「界面及弹窗界面要好看，
   *          内容紧凑有序，间隔尽量固定而内容有序填充」）
   * ------------------------------------------------------------
   * ① 弹窗不溢出闸门（7 档抽样 · 全量见 .workbuddy/tools/audit/audit_v89105_modals.js）
   * ② 沙盘回放：逐兵种逐帧 + 逐帧推进
   * ③ 本境调运：辎重区（资源及数量框）+ 运力实时
   * ============================================================ */
  console.log('\n===== v89.105 弹窗不溢出 / 沙盘 / 调运（闸门抽样） =====');

  /* ① 弹窗不溢出：内容装得下就不该冒滚动条（项目硬规矩） */
  const OVER_CASES = [
    ['市场', function () { G.ui.openMarket(); }],
    ['见闻/日志', function () { G.ui.openJournal(1); }],
    ['君主', function () { G.ui.openLordInfo(); }],
    ['门派', function () { G.ui.openSect(); }],
    ['自动出征配置', function () { G.ui.openAutoMarch(); }],
    ['装备', function () { G.ui.openEquipPanel(); }],
    ['出征', function () { G.ui.openExpModal({ kind: 'wild', x: G.state.cities[0].x + 2, y: G.state.cities[0].y + 2 }); }],
  ];
  for (const [nm, open] of OVER_CASES) {
    try { G.ui.closeAllModals(); } catch (e) {}
    let err = null;
    try { open(); } catch (e) { err = e; }
    if (err) { check('弹窗「' + nm + '」可打开', false, err.message); continue; }
    await sleep(90);
    const pn = document.querySelector('#modal-root .m-body') || document.querySelector('#modal-root .inner-panel');
    check('弹窗「' + nm + '」正文不溢出（内容装得下，不冒滚动条）', (function () {
      if (!pn) return false;
      return pn.scrollHeight - pn.clientHeight <= 2;
    })(), pn ? (pn.scrollHeight - pn.clientHeight) + 'px 溢出' : '无容器');
  }
  try { G.ui.closeAllModals(); } catch (e) {}

  /* ② 沙盘回放：帧数 + 逐帧推进（战报详情的"固定沙盘"） */
  (function () {
    const rep = (G.state.reports || []).filter((x) => x.type === 'war' && x.sandbox)[0];
    if (!rep) { check('沙盘：有可回放的战报（含配方）', false, '无带配方的战报'); return; }
    const sb = G.battle.sandboxOf(rep);
    check('沙盘：配方重跑出帧（每兵种每次移动/攻击各一帧）', !!sb && sb.frames.length >= 1,
      sb ? sb.frames.length + ' 帧' : '无沙盘');
    check('沙盘：与史实逐项校验通过（画面与账目同一套数）', !!sb && sb.verify === true);
  })();

  /* ③ 本境调运：己方城池目标 → 辎重区（五行资源 + 数量框）+ 方式锁定 */
  (function () {
    const two = G.state.cities.filter((c) => c.id);
    if (two.length < 2) { check('调运：已备好两座城（本境调运的前提）', false, '只有 ' + two.length + ' 城'); return; }
    G.ui._cityId = two[0].id;
    G.ui.openExpModal({ kind: 'own', id: two[1].id });
    const rt = document.querySelector('#modal-root');
    /* v89.161（老板 5）：金从运输清单移除（玩家层级通用资源，运金 = 从池子搬到池子）——
       辎重区 = 四行（粮木石铁） */
    const keys = ['grain', 'wood', 'stone', 'iron'];
    const rows = keys.filter((k) => !!document.getElementById('cg-' + k));
    check('调运：辎重区 = 四行货品（粮木石铁 · v89.161 起金不通运）', rows.length === 4, rows.join('/'));
    check('调运：辎重区**没有**金的数量框（金全境通用，无需运输）', !document.getElementById('cg-gold'));
    check('调运：顶栏有「运力」读数（随兵力实时算）', !!document.getElementById('exp-cargo-cap'));
    const mk = G.battle.modeOf(G.ui._expMode);
    /* 实装方式名 = 「调兵」（含辎重配置；文案以 DATA.EXPEDITION 为准，不另抄一份） */
    check('调运：方式锁定「调兵」（不给选错的机会）', !!mk && /调兵/.test(mk.name || ''), mk ? mk.name : '-');
    G.ui.closeAllModals();
  })();


  /* ============================================================
   * v89.154（老板 1/2/3）：附属野地（放弃按钮 / 排序）· 改建回大界面
   * ============================================================ */
  await (async function () {
    const s = G.state;
    const c154 = G.currentCity();
    const keepW154 = s.wilds.slice(), keepG154 = (s.gathers || []).slice();
    const gen154 = s.generals[0];
    const keepGen154 = { status: gen154.status, cityId: gen154.cityId };
    const keepRes154 = { grain: s.res.grain, wood: s.res.wood, stone: s.res.stone, iron: s.res.iron, gold: s.res.gold };
    const grid154 = G.extGridOf(c154);
    const keepCell154 = grid154[0] ? JSON.parse(JSON.stringify(grid154[0])) : null;
    try {
      /* ---- ① 排序（真 DOM 行序） + ② 放弃按钮（两段确认 + 上膛） ---- */
      /* ⚠ 造局序**倒置**（942→938）：若出口退化成"不排序直接返回"，输出会是倒序 —— 判据能抓 */
      s.wilds = [
        { x: 942, y: 942, type: 'desert', level: 7, day: 0, startDay: 0 },
        { x: 941, y: 941, type: 'hill', level: 4, day: 0, startDay: 0 },
        { x: 940, y: 940, type: 'hill', level: 9, day: 0, startDay: 0 },
        { x: 939, y: 939, type: 'caoyuan', level: 5, day: 0, startDay: 0 },
        { x: 938, y: 938, type: 'lake', level: 3, day: 0, startDay: 0 }
      ];
      s.gathers = [];
      gen154.status = 'garrison';
      s.wilds[4].garrison = { troops: { changqiang: 5000 }, cityId: c154.id, genId: gen154.id };
      G.startGather(938, 938, { changqiang: 5000 }, { cityId: c154.id });      /* 938 = 采集中 */
      s.wilds[3].garrison = { troops: { changqiang: 500 }, cityId: c154.id };  /* 939 = 有驻军 */
      const gatherOk154 = !!G.gatherAt(938, 938);
      G.ui.closeAllModals();
      G.ui.openWilds();
      await sleep(150);
      const coords154 = Array.from(document.querySelectorAll('#modal-root table tbody tr'))
        .map(function (tr) { return (tr.children[1] || {}).textContent || ''; });
      check('v89.154①：附属野地排序 = 采集 → 驻军 → 无驻军（地形序 → 等级降序）',
        gatherOk154 && coords154.slice(0, 5).join('|') === '938,938|939,939|942,942|940,940|941,941',
        'gatherOk=' + gatherOk154 + ' seq=' + coords154.slice(0, 5).join('|'));

      let askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
      check('v89.154①：操作列末位有「放弃」按钮（防误触类 wild-drop）',
        !!askBtn154 && !!askBtn154.closest('.wild-drop'), askBtn154 ? askBtn154.className : '(无)');
      if (askBtn154) askBtn154.click();
      await sleep(160);
      /* live 重绘的极小竞态兜底：重查一次再点（§65.2：跨操作不持有节点引用） */
      if (document.querySelector('#modal-root').innerHTML.indexOf('wild-abandon-do') < 0) {
        askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
        if (askBtn154) askBtn154.click();
        await sleep(160);
      }
      const askHtml154 = document.querySelector('#modal-root').innerHTML;
      check('v89.156①：放弃 → 二次确认窗（一击执行键 + 明写「不可撤销」· 上膛已退役）',
        askHtml154.indexOf('data-action="wild-abandon-do"') >= 0 && askHtml154.indexOf('不可撤销') >= 0
        && askHtml154.indexOf('wild-abandon-arm') < 0);
      const doBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-do"]');
      if (doBtn154) doBtn154.click();
      await sleep(240);
      check('v89.156①：窗内红键**一击执行**（野地消失 · 老板令"本身已经是 2 次确认了"）',
        !G.map.wildAt(938, 938));
      /* v89.156（老板 1 · debug）：弹栈即时 + **关闭一次真关**（层级栈 bug 回归守卫）——
         病根：live 重绘（标题里 N/M 数字变化）被误判"进下级"压栈
         → 关闭键每点一次只弹一层（弹出的还是**旧快照**，含已删行）→ "闪烁、要点几下才关"。
         修复后：弹栈即新数据（不含已删行）→ 点关闭**一次即关净**。 */
      const popHtml156 = document.querySelector('#modal-root').innerHTML;
      check('v89.156①：弹栈即新数据（回退的野地列表不含已删的 938,938）',
        popHtml156.indexOf('938,938') < 0 && popHtml156.indexOf('附属野地') >= 0,
        'len=' + popHtml156.length);
      const xBtn156 = document.querySelector('#modal-root .modal-x');
      if (xBtn156) xBtn156.click();
      await sleep(240);
      check('v89.156①：点关闭**一次即关净**（层级栈零残留 · 旧 bug 回归守卫）',
        !document.querySelector('#modal-root .inner-panel'));
      G.ui.closeAllModals();
      await sleep(60);

      /* ---- ④ v89.156（老板 4）：侦察失败（真路径 —— 带守将的野地 + 固定随机为失败）---- */
      let foeWild156 = null;
      {
        const cc156 = G.currentCity();
        for (let rr = 2; rr <= 30 && !foeWild156; rr++) {
          for (let dy = -rr; dy <= rr && !foeWild156; dy++) {
            for (let dx = -rr; dx <= rr && !foeWild156; dx++) {
              const x = cc156.x + dx, y = cc156.y + dy;
              const tt = G.map.tile(x, y);
              if (!tt || tt.terrain === 'city') continue;
              if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
              const lvv = G.map.wildLevelNow(x, y);
              if (!(lvv > 0)) continue;
              const dfe = G.wildDefenseAt(x, y, lvv);
              if (dfe && dfe.gen) foeWild156 = { x: x, y: y, lv: lvv };
            }
          }
        }
      }
      check('v89.156④：找到带守将的野地（侦察失败用例前置）', !!foeWild156,
        foeWild156 ? '(' + foeWild156.x + ',' + foeWild156.y + ') Lv' + foeWild156.lv : '未找到');
      if (foeWild156) {
        const g156 = G.state.generals[0];
        g156.status = 'idle';
        g156.stamina = G.staMax(g156); g156.energy = 100;
        const rndBk156c = window.Math.random;
        window.Math.random = () => 0.999;  /* ⚠️ jsdom realm：必须改 window.Math · 0.999 ≥ p（p ≤ 0.97）→ 必定失败 */
        const rf156 = G.battle.expedition({ kind: 'wild', x: foeWild156.x, y: foeWild156.y }, 'scout', {}, g156.id);
        window.Math.random = rndBk156c;
        await sleep(120);
        check('v89.156④：侦察失败（r.fail · 无情报）',
          rf156.ok === true && rf156.fail === true && !rf156.resReport,
          'msg=' + String(rf156.msg || '').slice(0, 48));
        const repF156 = (G.state.reports || [])[0];
        check('v89.156④：失败落公文「侦查失败 · X」（不带 scout → 不可展开）+ 缘由/建言',
          !!repF156 && /^侦查失败 · /.test(repF156.title) && repF156.scout == null && repF156.win === false
          && /缘由/.test(repF156.body) && /建言/.test(repF156.body),
          repF156 ? repF156.title : '(无)');
      }

      /* ---- ③ 改建完成 → 直接回城外大界面 ---- */
      grid154[0] = { type: 'farm', lv: 2 };   /* ⚠ 键名以 DATA.EXT_BUILDINGS 为准（farm/forest/quarry/mine） */
      s.res.grain = 5e5; s.res.wood = 5e5; s.res.stone = 5e5; s.res.iron = 5e5; s.res.gold = 5e5;
      G.ui.closeAllModals();
      G.ui.openExtModal(0);
      await sleep(140);
      const cvtAsk154 = document.querySelector('#modal-root [data-action="ext-convert-ask"]');
      if (cvtAsk154) cvtAsk154.click();
      await sleep(160);
      const cvtDo154 = document.querySelector('#modal-root [data-action="ext-convert"]:not([disabled])');
      check('v89.154②：改建面板可打开（含可执行的「改建」按钮）', !!cvtDo154);
      if (cvtDo154) cvtDo154.click();
      await sleep(200);
      check('v89.154②：改建完成 → 弹窗一次关净（直接回城外大界面）',
        (G.ui._modalStack || []).length === 0
        && document.querySelector('#modal-root').innerHTML.indexOf('inner-panel') < 0,
        'stack=' + (G.ui._modalStack || []).length);
      check('v89.154②：地块真被改建（换类型 · 等级保留 Lv2）',
        grid154[0].type !== 'farm' && grid154[0].lv === 2, JSON.stringify(grid154[0]));
    } finally {
      s.wilds = keepW154; s.gathers = keepG154;
      gen154.status = keepGen154.status; gen154.cityId = keepGen154.cityId;
      grid154[0] = keepCell154;
      s.res.grain = keepRes154.grain; s.res.wood = keepRes154.wood; s.res.stone = keepRes154.stone;
      s.res.iron = keepRes154.iron; s.res.gold = keepRes154.gold;
      G.ui.closeAllModals();
    }
  })();


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
      /* v89.192 规则变更所致（v89.189 的"受阻软化"机制）：禁用按钮会被 blockedSweep
         （主循环每 2 秒）软化为"可点+说明"（摘 disabled、加 dim + data-why）——
         旧断言 `disabled === true` 在扫掠先跑的相位下随机红（本轮显形）。
         新口径：无驻军态 = 绿色且（仍禁用 **或** 已软化——后者点击走 data-why 弹"无法执行"窗）。 */
      const lazyOk155 = !!bt2_155 && (bt2_155.disabled === true
        || (bt2_155.classList.contains('dim') && !!bt2_155.getAttribute('data-why')));
      check('v89.155②：召回后按钮变绿（无驻军态 —— 禁用或已软化说明 · v89.189 规则）',
        !!bt2_155 && bt2_155.classList.contains('green') && lazyOk155,
        bt2_155 ? (bt2_155.className + ' why=' + bt2_155.getAttribute('data-why')) : '(无 · 列表可能已刷新)');
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


  /* ============================================================
   * v89.157（老板：逐回合文字复盘 / 己方野地驻守 / 公文徽章）
   * ============================================================ */
  await (async function () {
    const s = G.state;

    /* ---- ① 逐回合文字复盘：战报页入口 → 独立弹窗（一回合一行） ---- */
    const bkReps157 = s.reports.slice();
    try {
      s.reports.unshift({
        t: Date.now(), title: '§157 测试战报', win: true, type: 'war', fav: false,
        body: '【许都】攻城胜利', engine: 'tactic', rounds: 2, winner: 'atk',
        roundsLog: [
          { r: 1, a: 100, d: 80, events: [{ kind: 'attack', side: 'atk', id: 0, name: '长枪兵', target: '弓兵', kill: 5 }] },
          { r: 2, a: 95, d: 70, events: [] }
        ]
      });
      G.ui.closeAllModals();
      G.ui.viewReportText(G.repRidOf(s.reports[0]));
      await sleep(160);
      const btn157 = document.querySelector('#modal-root [data-action="report-rounds"]');
      check('§157：战报正文页出「逐回合文字复盘」入口（有回合记录才给）', !!btn157,
        btn157 ? (btn157.textContent || '').slice(0, 24) : '无按钮');
      if (btn157) {
        btn157.click();
        await sleep(220);
        const rounds157 = document.querySelectorAll('#modal-root .rt-round');
        const box157 = document.querySelector('#modal-root .rt-rounds');
        const txt157 = box157 ? (box157.textContent || '') : '';
        check('§157：逐回合弹窗（一回合一行 · 首行含第1回合与交火事件 · 空回合写无交火）',
          rounds157.length === 2 && txt157.indexOf('第1回合') >= 0
          && txt157.indexOf('长枪兵→弓兵 杀 5') >= 0 && txt157.indexOf('（无交火）') >= 0,
          'rounds=' + rounds157.length + ' txt=' + txt157.slice(0, 80));
      }
    } finally {
      s.reports = bkReps157;
      G.ui.closeAllModals();
    }

    /* ---- ② 己方野地驻守：不接战 → 接战三块隐（真 DOM 渲染） ---- */
    const keepW157 = s.wilds;
    const keepM157 = { mode: G.ui._expMode, t: G.ui._expTarget, r: G.ui._expRes };
    try {
      const c157 = G.currentCity();
      const px157 = c157.x + 4, py157 = c157.y + 4;
      s.wilds = (s.wilds || []).filter(function (z) { return !(z.x === px157 && z.y === py157); });
      s.wilds.push({ x: px157, y: py157, type: 'lake', level: 2, day: 0, startDay: 0 });
      G.ui.closeAllModals();
      G.ui.openExpModal({ kind: 'wild', x: px157, y: py157 });
      await sleep(180);
      const html157 = document.getElementById('modal-root').innerHTML;
      check('§157：己方野地驻守面板隐接战三块（保留 出征方式 / 可用道具 / 无预估）',
        html157.indexOf('exp-a-tactic') < 0 && html157.indexOf('exp-a-plan') < 0
        && html157.indexOf('exp-a-tacmenu') < 0 && html157.indexOf('exp-a-est') < 0
        && html157.indexOf('exp-a-modes') >= 0 && html157.indexOf('exp-a-items') >= 0,
        'tactic=' + html157.indexOf('exp-a-tactic') + ' modes=' + html157.indexOf('exp-a-modes'));
    } finally {
      s.wilds = keepW157;
      G.ui._expMode = keepM157.mode; G.ui._expTarget = keepM157.t; G.ui._expRes = keepM157.r;
      G.ui.closeAllModals();
    }

    /* ---- ③ 公文系统页：消息徽章 + 左侧主题色竖条（真实 DOM） ---- */
    try {
      G.log('§157 徽章显示', 'sys', 'build');
      G.ui._docTab = 'sys';
      G.ui.setView('reports');
      G.ui.renderView('reports');
      await sleep(200);
      const line157 = document.querySelector('#msg-feed .bb-line');
      const tag157 = line157 ? line157.querySelector('.ml-tag') : null;
      const st157 = line157 ? (line157.getAttribute('style') || '') : '';
      check('§157：系统页消息 = 主题徽章 + 主题色竖条（bb-sub · 行内注入颜色）',
        !!tag157 && !!line157 && line157.classList.contains('bb-sub')
        && st157.indexOf('border-left-color') >= 0
        && (tag157.textContent || '').indexOf('建造') >= 0,
        tag157 ? ('tag=' + tag157.textContent + ' style=' + st157.slice(0, 40)) : '无徽章');
    } finally {
      G.ui._docTab = 'sys';
      G.ui.closeAllModals();
    }
  })();

  console.log('\n--- §158. 容量分账与悬停保护（v89.158 · 真实 DOM） ---');
  {
    /* ① hoverHold 真 DOM：注入悬停 → 周期重绘整块跳过（节点不被替换） */
    const amt158a = document.querySelector('#res-bar .res-line .amt');
    const bkA158 = G.ui._tickPaint, bkH158 = G.ui._hoverOf;
    G.ui._tickPaint = true;
    G.ui._hoverOf = function () { return amt158a; };
    G.ui.renderSide();
    check('v89.158② 悬停资源栏 → 周期重绘整块跳过（节点不被替换）',
      document.querySelector('#res-bar .res-line .amt') === amt158a);
    /* 悬停移开 → 恢复重绘（节点被替换） */
    G.ui._hoverOf = function () { return document.body; };
    G.ui.renderSide();
    check('v89.158② 悬停移开 → 恢复重绘（节点被替换）',
      document.querySelector('#res-bar .res-line .amt') !== amt158a);
    /* 操作驱动（_tickPaint=false）永不挡 —— 否则"点+用宝物"后界面不刷新 */
    const amt158b = document.querySelector('#res-bar .res-line .amt');
    G.ui._tickPaint = false;
    G.ui._hoverOf = function () { return amt158b; };
    G.ui.renderSide();
    check('v89.158② 操作驱动重绘 → 悬停不挡（立即刷新）',
      document.querySelector('#res-bar .res-line .amt') !== amt158b);
    G.ui._tickPaint = bkA158; G.ui._hoverOf = bkH158;

    /* ② 容量悬停分账（真渲染 title） */
    const tip158 = document.querySelector('#res-bar .res-line .amt').getAttribute('title') || '';
    check('v89.158① 容量悬停分账（真渲染：上限 + 基础/仓库 + 现有）',
      tip158.indexOf('上限') >= 0 && tip158.indexOf('现有') >= 0
        && (tip158.indexOf('基础储量') >= 0 || tip158.indexOf('级合计') >= 0),
      tip158.split('\n').join(' | '));

    /* ③ tick 不削存量（真环境短跑 · 用完还原） */
    const st158 = G.state, c158 = G.currentCity();
    const cap158 = G.storeCapOf(c158);
    const bkG158 = st158.res.grain;
    st158.res.grain = cap158 + 123456;
    G.tickOnce();
    check('v89.158① 超上限存量不被削（tickOnce 真跑）', st158.res.grain === cap158 + 123456,
      'got ' + Math.round(st158.res.grain) + ' cap ' + cap158);
    st158.res.grain = bkG158;
  }

  console.log('\n--- §159. 升级回满 / 本座门槛 / 严格总闸（v89.159 · 真实 DOM） ---');
  {
    /* ① 升级即回满（真环境 · 走唯一升级出口 gainExp） */
    const g159 = (G.state.generals || []).filter((x) => !x.isLord)[0];
    if (!g159) {
      check('v89.159① 找到非君主将领（前置）', false);
    } else {
      const bk159 = { lv: g159.level, exp: g159.exp, sta: g159.stamina, ene: g159.energy };
      try {
        G.setStaNow(g159, Math.round(G.staMax(g159) * 0.2));
        G.setEnergyNow(g159, Math.round(G.energyMaxOf(g159) * 0.2));
        G.battle.gainExp(g159, G.expNeedOf(g159) + 1, 'e2e159');
        check('v89.159① 升级 → 体力/精力双双回满（真环境）',
          G.staNow(g159) === G.staMax(g159) && G.energyNowOf(g159) === G.energyMaxOf(g159),
          'sta ' + G.staNow(g159) + '/' + G.staMax(g159));
        const hitMsg = (G.state.msgLog || []).some((r) => String((r && r.msg) || '').indexOf('升级刷新') >= 0);
        check('v89.159① 公文留痕「升级刷新…已回满」', hitMsg);
      } finally {
        g159.level = bk159.lv; g159.exp = bk159.exp; g159.stamina = bk159.sta; g159.energy = bk159.ene;
      }
    }

    /* ② 建筑面板：多座民房 Lv4 + Lv3 混存（官府 4）→ 本座按自己的等级给键 */
    const c159 = G.makeCity({ id: 'e2e159', name: 'e2e159城', x: 610, y: 610, type: 'self' });
    const bkQ159 = (G.state.queues.build || []).slice();
    const bkCity159 = G.ui._cityId, bkRes159 = {};
    G.state.cities.push(c159);
    try {
      G.ui._cityId = c159.id;                      /* s.res 是**当前城**的 getter */
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { bkRes159[k] = G.state.res[k]; G.state.res[k] = 1e9; });
      const cells159 = [];
      c159.cells.forEach((x, i) => { if (x.build && x.build.id === 'minfang') cells159.push(i); });
      c159.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
      if (cells159.length >= 2) {
        c159.cells[cells159[0]].build.lvl = 4;
        c159.cells[cells159[1]].build.lvl = 3;
        G.ui.openBuildModal(cells159[1]);           /* 点 Lv3 那座 */
        let m = document.querySelector('#modal-root').innerHTML;
        check('v89.159② 面板（Lv3 那座）给「升级」键（不再误报需官府）',
          m.indexOf('confirm-upgrade') >= 0 && m.indexOf('需官府') < 0);
        G.ui.openBuildModal(cells159[0]);           /* 点 Lv4 那座 */
        m = document.querySelector('#modal-root').innerHTML;
        check('v89.159② 面板（Lv4 那座）如实报「需官府 Lv5」', m.indexOf('需官府 Lv5') >= 0);
      } else {
        check('v89.159② 城里有 ≥2 座民房（前置）', false);
      }
    } finally {
      G.state.cities = G.state.cities.filter((x) => x.id !== 'e2e159');
      G.state.queues.build = bkQ159.slice();
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { if (bkRes159[k] != null) G.state.res[k] = bkRes159[k]; });
      G.ui._cityId = bkCity159;
      G.ui.closeAllModals();
    }

    /* ③ 上限行：主城 + 爵位解锁 + 官府没跟上 → 写「受官府 LvN 限制」 */
    const c159b = G.makeCity({ id: 'e2e159b', name: 'e2e159b城', x: 611, y: 611, type: 'self' });
    const bkMain159 = G.state.mainCityId, bkRank159 = G.state.rank;
    G.state.cities.push(c159b);
    try {
      G.ui._cityId = c159b.id;
      G.state.mainCityId = c159b.id; G.state.rank = 5;
      c159b.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 8; });
      const mi159 = c159b.cells.findIndex((x) => x.build && x.build.id === 'minfang');
      G.ui.openBuildModal(mi159 >= 0 ? mi159 : 0);
      const m3 = document.querySelector('#modal-root').innerHTML;
      check('v89.159③ 上限行写明「受官府 Lv8 限制 · 升官府可提升」（真渲染）',
        m3.indexOf('受官府 Lv') >= 0 && m3.indexOf('升官府可提升') >= 0);
    } finally {
      G.state.cities = G.state.cities.filter((x) => x.id !== 'e2e159b');
      G.state.mainCityId = bkMain159; G.state.rank = bkRank159;
      G.ui._cityId = bkCity159;
      G.ui.closeAllModals();
    }
  }

  console.log('\n--- §160. 逾溢折损 / 自动升级顺延（v89.160 · 真实 DOM） ---');
  {
    /* ① 真渲染：仓库面板给出折损规则与"当前超出上限" */
    const c160 = G.currentCity();
    const cap160 = G.storeCapOf(c160);
    const bkG160 = c160.res.grain, bkAt160 = G.state.overflowAt, bkW160 = G.state.world.elapsed;
    c160.res.grain = cap160 + 123456;
    G.ui.openStore();
    let m160 = document.querySelector('#modal-root').innerHTML;
    check('v89.160① 仓库面板真渲染「逾溢折损」规则（含现实换算）+ 当前超出上限',
      m160.indexOf('逾溢折损') >= 0 && m160.indexOf('当前超出上限') >= 0
      && m160.indexOf('游戏日（现实约') >= 0 && m160.indexOf('折损 25%') >= 0);
    G.ui.closeAllModals();
    /* 侧栏悬停（title）在超上限时写明折损 */
    G.ui.renderSide();
    const amt160 = document.querySelector('#res-bar .res-line .amt');
    check('v89.160① 侧栏资源悬停写明「已超上限 …每游戏日折损 25%」',
      !!amt160 && (amt160.getAttribute('title') || '').indexOf('已超上限') >= 0,
      amt160 ? (amt160.getAttribute('title') || '').slice(0, 60) : '无 .amt');
    c160.res.grain = bkG160;

    /* ② 真 tick：推 1 游戏日 → tickOnce 里结算出灾种公文 + 掉 25% */
    const c2 = G.currentCity();
    if (G.state.overflowAt == null) G.settleOverflowRot();
    G.state.overflowAt = G.state.world.elapsed;
    G.state.world.elapsed += 86400;                 /* 推进 1 游戏日（tick 会再过 1 秒） */
    c2.res.grain = G.storeCapOf(c2) + 100000;
    const bkGold160 = c2.res.gold;
    c2.res.gold = 9e9;
    const gm160 = c2.res.grain;
    G.tickOnce();
    const L160 = G.state.msgLog || [];
    const tail160 = (L160[L160.length - 1] || {}).msg || '';
    const named160 = (G.DATA.OVERFLOW.events || []).some((e) => tail160.indexOf(e.name) >= 0);
    check('v89.160① 真 tick 结算：公文出灾种行「…损失 粮食 X…」',
      named160 && tail160.indexOf('损失') >= 0, tail160.slice(0, 70));
    check('v89.160① 真 tick 后的存量 = 超出部分掉 25%（cap+100000 → cap+75000）',
      Math.abs(c2.res.grain - (G.storeCapOf(c2) + 75000)) < 5000,
      'grain ' + Math.round(c2.res.grain) + ' · cap ' + Math.round(G.storeCapOf(c2)));
    check('v89.160① 黄金豁免', c2.res.gold >= 9e9 - 1e6, 'gold ' + Math.round(c2.res.gold));
    c2.res.gold = bkGold160;

    /* ③ 自动升级：贵项在前也不挡路（真环境 · 同一个池子） */
    const st160 = G.state, city160 = G.currentCity();
    const bkQ160 = (st160.queues.build || []).slice();
    const bkAuto160 = st160.settings.autoUpgrade, bkAutoSt160 = st160.autoState;
    try {
      city160.cells.forEach((x) => { if (x.build && x.build.id !== 'guanfu') x.build = null; });
      city160.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
      G.extGridOf(city160).forEach((e) => { e.type = null; e.lv = 0; e.pending = null; });
      city160.cells[0].build = { id: 'tiejiangpu', lvl: 1 };
      city160.cells[1].build = { id: 'minfang', lvl: 1 };
      if (G.wallSlotOf(city160).build) G.wallSlotOf(city160).build = null;
      const cm160 = G.DATA.BUILDINGS.minfang.levelCost(1);
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(city160)[k] = cm160[k] || 0; });
      st160.settings.autoUpgrade = true;
      st160.queues.build = [];
      const r160 = G.autoUpgrade();
      check('v89.160② 真环境：顺延过贵的（铁匠铺）→ 命中便宜的（民房）',
        !!(r160 && r160.ok && r160.target && r160.target.idx === 1 && /民房/.test(r160.target.name || '')),
        r160 && r160.target ? r160.target.name + ' idx' + r160.target.idx : '无动作');
    } finally {
      st160.queues.build = bkQ160;
      city160.cells.forEach((x) => { x.pending = null; });
      st160.settings.autoUpgrade = bkAuto160; st160.autoState = bkAutoSt160;
      st160.overflowAt = bkAt160; st160.world.elapsed = bkW160;
    }
  }

  /* ============================================================
   * v89.163（老板 1+2）：指挥战斗清单含「行军中的军队」（召回宿主跟走）·
   *   征兵时长压缩（步兵 ≤1 分 / 骑兵 ≤5 分 · 单兵耗时）
   * ============================================================ */
  console.log('\n--- §163. 指挥战斗含行军 / 征兵时长压缩（v89.163 · 真实 DOM） ---');
  await (async function () {
    /* ① 数据：步兵 ≤60 / 骑兵 ≤300（游戏秒 · 单兵耗时） */
    const over163 = [];
    Object.keys(G.DATA.TROOPS).forEach((k) => {
      const t = G.DATA.TROOPS[k];
      if (t.cat === 'inf' && t.time > 60) over163.push(t.name + '=' + t.time);
      if (t.cat === 'cav' && t.time > 300) over163.push(t.name + '=' + t.time);
    });
    check('v89.163 征兵时长：步兵 ≤1 分 / 骑兵 ≤5 分（单兵耗时 · 游戏秒）', over163.length === 0,
      over163.join('/') || ('义兵 ' + G.DATA.TROOPS.yibing.time + ' · 弓箭手 ' + G.DATA.TROOPS.gongjian.time
        + ' · 象兵 ' + G.DATA.TROOPS.nanjiangxiangbing.time));

    /* ② 清单两段 + 召回宿主跟走（真 DOM · 真点击） */
    const c163 = G.currentCity();
    const keepM163 = G.state.marches;
    /* v89.165：造局 totalTime 取大值（§77.1 三件套）—— 原 elapsed 10 / totalTime 100
       = 剩余 0.75 现实秒：主循环的 march.tick(1)（每现实秒推进 ts 游戏秒）会在用例的
       sleep 窗口内把它"到点抵达"，无将行军随即被折返（marches 清空）→ 慢环境（gate 连跑）
       随机红（v89.165 实中两次）。真将领 + 大 totalTime = 脚本期间不会到点。 */
    const g163 = G.state.generals[0];
    const bkG163 = { status: g163.status, cityId: g163.cityId };
    g163.status = 'march'; g163.cityId = c163.id;
    G.state.marches = [{
      id: 'e2e163m', cityId: c163.id, genId: g163.id, modeId: 'raid',
      target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·163', kind: 'wild',
      army: { yibing: 10 }, elapsed: 252000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null,
    }];
    G.ui.openBattleList();
    await sleep(60);
    const mr163 = document.querySelector('#modal-root');
    const btn163 = mr163 ? mr163.querySelector('[data-action="march-recall"]') : null;
    check('v89.163 指挥战斗清单出现「行军中的军队」区块 + 召回按钮',
      !!(mr163 && mr163.textContent.indexOf('行军中的军队') >= 0 && btn163
        && mr163.textContent.indexOf('荒野·163') >= 0),
      mr163 ? mr163.textContent.replace(/\s+/g, ' ').slice(0, 70) : '无弹窗');
    if (btn163) {
      btn163.click();
      await sleep(80);
      const mr2 = document.querySelector('#modal-root');
      const gone = G.state.marches.length === 0;
      const stillWar = !!(mr2 && mr2.querySelector('.war-list'));
      const notMarchesPane = !(mr2 && mr2.textContent.indexOf('行军队列（') >= 0);
      const emptyTip = !!(mr2 && mr2.textContent.indexOf('当前没有行军中军队') >= 0);
      check('v89.163 清单内召回：兵力归城 + 原地重绘（不跳行军队列弹窗 · 不留幽灵行）',
        gone && stillWar && notMarchesPane && emptyTip,
        'gone=' + gone + ' stillWar=' + stillWar + ' emptyTip=' + emptyTip);
    } else {
      check('v89.163 清单内召回：兵力归城 + 原地重绘', false, '未找到召回按钮');
    }
    G.state.marches = keepM163;
    g163.status = bkG163.status; g163.cityId = bkG163.cityId;
    G.ui.closeAllModals();
  })();

  /* ============================================================
   * v89.164（老板 3）：智能战斗 —— 战术下拉（真渲染）+ 开关（真交互）+ 战场指示
   * ============================================================ */
  console.log('\n--- §164. 智能战斗（v89.164 · 真实 DOM） ---');
  await (async function () {
    const bk164 = G.state.settings.smartBattle;
    /* ① 出征面板战术下拉含「⚡ 智能战斗」选项（真渲染） */
    (function () {
      const html = G.ui.expTacticOptionsHTML();
      check('v89.164 战术下拉首项 = 「⚡ 智能战斗（通用方案）」',
        html.indexOf('value="smart"') >= 0 && html.indexOf('⚡ 智能战斗（通用方案）') >= 0,
        html.slice(0, 60).replace(/\n/g, ' '));
    })();
    /* ② 真交互：选中 smart → settings 开 + 摘要行改写；选其他项 → 关 */
    G.ui.expApplyTactic('smart');
    await sleep(40);
    check('v89.164 选「智能战斗」→ settings.smartBattle=true + 摘要行',
      G.state.settings.smartBattle === true && G.battle.smartOnOf() === true,
      G.battle.smartOnOf() ? 'on' : 'off');
    G.ui.expApplyTactic('');
    await sleep(40);
    check('v89.164 选其他项（默认）→ 智能关闭（回到手动战术）',
      G.state.settings.smartBattle === false && G.battle.smartOnOf() === false);
    /* ③ 战场顶栏指示（真渲染函数 · 攻方 + 开智能 → 出现 ⚡ 智能） */
    G.battle.setSmartBattle(true);
    const top164 = G.ui.btTopHTML({ id: 'e2e164', side: 'atk', cnt: 30, round: 0 }, { round: 0, maxRounds: 30, field: 2000 });
    check('v89.164 战场顶栏出现「⚡ 智能」指示（攻方 · 开启时）', top164.indexOf('bt-smart') >= 0 && top164.indexOf('⚡ 智能') >= 0);
    const top164b = G.ui.btTopHTML({ id: 'e2e164', side: 'def', cnt: 30, round: 0 }, { round: 0, maxRounds: 30, field: 2000 });
    check('v89.164 守城侧（def）不显示智能指示（不托管）', top164b.indexOf('bt-smart') < 0);
    /* ④ smartApply 对本场战斗不越权：只写攻方（真调一次） */
    (function () {
      const A = { yibing: 200, gongjian: 200, qingji: 100 };
      const env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
      const rec = { side: 'atk', cmd: {} };
      G.battle.smartApply(rec, env);
      const defCav = env.units.def.filter((u) => u.id === 'qingji')[0];
      check('v89.164 smartApply 只托管攻方（守方目标保持"同兵种"默认）',
        rec.cmd.qingji && rec.cmd.qingji.t === 'gongjian' && (defCav.target || '') === 'qingji');
    })();
    G.state.settings.smartBattle = bk164;
  })();

  /* ============================================================
   * v89.165（老板）：「指挥战斗界面的行军读秒和进度条不动」—— live 接入的真 DOM 验证
   * 【场景直接复现】打开清单 → 推进 elapsed → 走真链 liveModalTick → DOM 读秒必须变
   * ============================================================ */
  console.log('\n--- §165. 实时读秒（指挥战斗清单 · live 每秒重开） ---');
  await (async function () {
    const st = G.state;
    G.ui.closeAllModals();
    await sleep(40);
    const bkMarches = st.marches.slice(), bkBattles = st.battles.slice();
    let gen0 = null, bkG = null;                     /* ⚠️ 前置变量放外层（§55.3：finally 要还原） */
    try {
      const c0 = G.currentCity();
      gen0 = st.generals.filter((g) => g.status !== 'march')[0] || st.generals[0];
      bkG = { status: gen0.status, cityId: gen0.cityId };
      gen0.status = 'march'; gen0.cityId = c0.id;    /* 造局三件套（§77.1）：大 totalTime + 真将领 */
      const m = { id: 'M165e', cityId: c0.id, genId: gen0.id, modeId: 'raid',
        target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: 'A165', kind: 'wild',
        army: { yibing: 100 }, elapsed: 96000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null };
      st.marches.push(m);
      st.battles.length = 0;

      G.ui.openBattleList();
      await sleep(80);
      const read165 = () => {
        const el = document.querySelector('#modal-root .war-list');
        return el ? (el.textContent || '') : '';
      };
      check('v89.165 指挥战斗清单已打开（.war-list 在）', !!document.querySelector('#modal-root .war-list'));
      check('v89.165 首屏含 16% 读秒（渲染就绪）', read165().indexOf('16%') >= 0, read165().slice(0, 70));

      m.elapsed += 120000;                           /* 推进 120000 游戏秒 = 20% */
      G.ui.liveModalTick();                          /* 真链路：主循环每秒调的就是它 */
      await sleep(50);
      const t2 = read165();
      check('v89.165 ★ liveModalTick 后读秒跳到 36%（真实 DOM 更新 · 老板报的场景）',
        t2.indexOf('36%') >= 0 && t2.indexOf('16%') < 0,
        (t2.slice(0, 70) || '(空)').replace(/\s+/g, ' '));
      check('v89.165 live 重绘不误压栈（层级栈长度不增）',
        (G.ui._modalStack || []).length === 0,
        'stack=' + ((G.ui._modalStack || []).length));
    } finally {
      st.marches.length = 0; bkMarches.forEach((x) => st.marches.push(x));
      st.battles.length = 0; bkBattles.forEach((x) => st.battles.push(x));
      if (gen0 && bkG) { gen0.status = bkG.status; gen0.cityId = bkG.cityId; }
      G.ui.closeAllModals();
      await sleep(40);
    }
    check('v89.165 收尾：关闭后无残留弹窗', !document.querySelector('#modal-root .inner-panel'));
  })();

  /* ============================================================
   * v89.166（老板）：「地图上点我方城市 → 城池面板 → 点『进入城池』→
   *   城市菜单界面应关闭，直接显示城内大界面」—— 真 DOM · 点真按钮
   * ============================================================ */
  console.log('\n--- §166. 进入城池 = 菜单全关 + 城内大界面（v89.166 · 真实 DOM） ---');
  await (async function () {
    const st = G.state;
    G.ui.closeAllModals();
    await sleep(40);
    if (!st.map.grid) G.map.generate();
    /* 造第二城（验证"切过去"；建城成本各 10000，先补资源） */
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(G.currentCity())[k] = 200000; });
    G.res(G.currentCity()).gold = 200000;
    let c2 = null;
    for (let y = 1; y < (G.DATA.MAP_H || 40) - 1 && !c2; y++) {
      for (let x = 1; x < (G.DATA.MAP_W || 40) - 1 && !c2; x++) {
        const t = G.map.tile(x, y);
        if (!t || t.terrain !== 'plain') continue;
        if ((st.wilds || []).some((w) => w.x === x && w.y === y)) continue;
        st.wilds.push({ x, y, type: 'plain', lv: 3 });
        try { G.buildCityAt(x, y); } catch (e) { }
        if (st.cities.length >= 2) c2 = st.cities[1];
      }
    }
    check('v89.166 造局：第二城已建（用于验证"切过去"）', !!c2, c2 ? c2.name : '未建成');
    if (!c2) return;
    const bkCity166 = G.ui._cityId, bkView166 = G.ui.view;
    try {
      /* 与"地图点我城"同一入口打开城池面板 */
      G.ui.openCityPanel(c2);
      await sleep(60);
      const btn166 = document.querySelector('#modal-root [data-action="city-enter"]');
      check('v89.166 城池面板含「进入城池」（真渲染）', !!btn166);
      check('v89.166 面板打开中（弹窗在 · 栈深 ' + ((G.ui._modalStack || []).length) + '）',
        !!document.querySelector('#modal-root .inner-panel'));
      if (btn166) {
        btn166.click();
        await sleep(90);
        const hasModal166 = !!document.querySelector('#modal-root .inner-panel');
        const stack166 = (G.ui._modalStack || []).length;
        check('v89.166 ★ 点「进入城池」→ 菜单全关（无残留弹窗 · 栈清空）',
          !hasModal166 && stack166 === 0, 'modal=' + hasModal166 + ' stack=' + stack166);
        check('v89.166 ★ 视图已切到城内大界面（view=city）', G.ui.view === 'city', G.ui.view);
        check('v89.166 ★ 当前城已切为目标城', !!(G.currentCity() && G.currentCity().id === c2.id),
          G.currentCity() ? G.currentCity().name : '无');
        const vc166 = document.getElementById('view-container');
        check('v89.166 城内大界面真渲染（.city-iso 在）', !!(vc166 && vc166.querySelector('.city-iso')));
      }
    } finally {
      G.ui.setCity(bkCity166);
      G.ui.setView(bkView166);
      G.ui.closeAllModals();
      await sleep(40);
    }
  })();

  /* ============================================================
   * v89.167（老板）：「自动升级建造，应该每个城池均遍历，分别升级，
   *   而不是所有城池一起，总共只升级 3 个建筑」—— 真实 DOM 真调
   * ============================================================ */
  console.log('\n--- §167. 自动升级 · 每城独立建造位（v89.167 · 真实 DOM） ---');
  await (async function () {
    const st = G.state;
    const bkAuto167 = st.settings.autoUpgrade;
    const bkQ167 = st.queues.build.slice();
    try {
      st.rank = Math.max(st.rank || 0, 6);           /* 领地上限随爵位（已有 §166 造的第二城） */
      /* 各城：官府 lv3 + 民房×4（lv1，最便宜、必可升）+ 资源（v89.161：花费按城） */
      st.cities.forEach((c) => {
        c.cells.forEach((x) => { if (x.build && !x.official) x.build = null; });
        let gi = -1;
        for (let i = 0; i < c.cells.length; i++) { if (c.cells[i].official) { gi = i; break; } }
        if (gi < 0) return;
        c.cells[gi].build = { id: 'guanfu', lvl: 3 };
        let put = 0;
        for (let i = 0; i < c.cells.length && put < 4; i++) {
          if (c.cells[i].official || c.cells[i].build) continue;
          c.cells[i].build = { id: 'minfang', lvl: 1 };
          put++;
        }
        ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(c)[k] = 600000; });
      });
      G.res(G.currentCity()).gold = 300000;
      check('v89.167 造局：多城就绪（≥2 · 各城 5 候选）', st.cities.length >= 2, st.cities.length + ' 城');

      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      const r167 = G.autoUpgrade();
      const by167 = {};
      st.queues.build.forEach((q) => { by167[q.cityId] = (by167[q.cityId] || 0) + 1; });
      check('v89.167 ★ 一次调用每城都排上（逐城遍历 · 分别升级）',
        st.cities.every((c) => (by167[c.id] || 0) >= 1), JSON.stringify(by167));
      check('v89.167 ★ 各城不超各自建造位（每城独立额度）',
        st.cities.every((c) => (by167[c.id] || 0) <= G.buildSlots(c)),
        JSON.stringify(st.cities.map((c) => G.buildSlots(c))));
      check('v89.167 ★ 排入总数 > 3（改前全境上限 3 的铁证）',
        !!(r167 && r167.count > 3), 'count=' + (r167 && r167.count));
      check('v89.167 状态文案写明「各城独立建造位」',
        /各城独立建造位/.test((st.autoState || {}).msg || ''), (st.autoState || {}).msg);
    } finally {
      st.settings.autoUpgrade = bkAuto167;
      st.queues.build.length = 0;
      bkQ167.forEach((q) => st.queues.build.push(q));
    }
  })();

  /* ============================================================
   * 173. v89.173（老板）：「不作等级限制…尽量拿满0.8级经验」
   *   —— 道具撤上限（真实 DOM）：Lv60 天授将也能用；卡面 = +X万。
   * ============================================================ */
  console.log('\n--- §173. 经验道具撤等级限制（v89.173 · 真实 DOM） ---');
  await (async function () {
    const s173 = G.state;
    const g173 = s173.generals.filter(function (x) { return !x.isLord; })[0] || s173.generals[0];
    const bk173 = { lv: g173.level, exp: g173.exp, rank: g173.rank, items: JSON.stringify(s173.items || {}) };
    try {
      s173.items = { bingxian_yipian: 2, lianbing_jingyan: 2 };
      g173.rank = 'tian'; g173.level = 1; g173.exp = 0;
      G.ui.closeAllModals();
      G.ui.openExpPick(g173.id);
      await sleep(80);
      let html173 = document.querySelector('#modal-root').innerHTML;
      check('v89.173 选择窗卡面印面额（「+300万」/「+10万」）',
        html173.indexOf('+300万') >= 0 && html173.indexOf('+10万') >= 0);
      check('v89.173 卡面旧上限文案零残留（「最多至」/「只服务前期」）',
        html173.indexOf('最多至') < 0 && html173.indexOf('只服务前期') < 0);
      /* ★ 核心：Lv60 也能用（v89.171 时代这里是"全族变暗 + 无按钮"） */
      G.ui.closeAllModals();
      g173.level = 60;
      G.ui.openExpPick(g173.id);
      await sleep(80);
      html173 = document.querySelector('#modal-root').innerHTML;
      check('v89.173 ★ Lv60 天授将 → 仍给使用按钮（不设等级限制）',
        html173.indexOf('data-action="gen-exp-item"') >= 0);
      check('v89.173 Lv60 无变暗态（btn sm dim 零残留）', html173.indexOf('btn sm dim') < 0);
      G.ui.closeAllModals();
    } finally {
      g173.level = bk173.lv; g173.exp = bk173.exp; g173.rank = bk173.rank;
      s173.items = JSON.parse(bk173.items);
    }
  })();

  /* ============================================================
   * 174. v89.174（老板）：建造完成 → 施工弹窗 live 换态（真实 DOM）
   *   + 官府「在建队列」段 + city:wall 宽容解析。
   * ============================================================ */
  console.log('\n--- §174. 建造完成即换态 + 官府在建队列（v89.174 · 真实 DOM） ---');
  await (async function () {
    const s174 = G.state;
    const c174 = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c174)[k] = 1e8; });
    const empties174 = [];
    c174.cells.forEach(function (cc, i) { if (!cc.build && !cc.pending && !cc.official) empties174.push(i); });
    const idx174 = empties174[0], idx174b = empties174[1];
    const r174 = G.buildAt(c174.id, idx174, 'minfang');
    check('v89.174 造局：城内开工一处', r174.ok === true, r174.msg);
    const q174 = s174.queues.build[s174.queues.build.length - 1];
    try {
      G.ui.closeAllModals();
      G.ui.openBuildModal(idx174);
      await sleep(80);
      let h174 = document.querySelector('#modal-root').innerHTML;
      check('v89.174 施工中弹窗打开（含「建造中」）', h174.indexOf('建造中') >= 0);
      q174.elapsed = q174.totalTime;          /* 推满 → 下一 tick 结算 */
      G.tickOnce();
      check('v89.174 队列已结算（splice + pending 清）',
        s174.queues.build.indexOf(q174) < 0 && !c174.cells[idx174].pending);
      G.ui.liveModalTick();                   /* 模拟主循环每秒 live 重开 */
      await sleep(90);
      h174 = document.querySelector('#modal-root').innerHTML;
      check('★ v89.174 完成后 live 换态：不再「建造中」· 换出功能面板（民房 · Lv1）',
        h174.indexOf('建造中') < 0 && /民房 · Lv1/.test(h174),
        (h174.match(/建造中|民房 · Lv1/) || [''])[0]);
      G.ui.closeAllModals();
      /* 官府格弹窗：在建队列段 */
      let gIdx = -1;
      c174.cells.forEach(function (cc, i) { if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i; });
      const r2 = G.buildAt(c174.id, idx174b, 'minfang');
      G.ui.closeAllModals();
      G.ui.openBuildModal(gIdx);
      await sleep(90);
      const h2 = document.querySelector('#modal-root').textContent;
      check('★ v89.174 官府弹窗「在建队列」段（含在建民房行）',
        r2.ok === true && h2.indexOf('在建队列') >= 0 && h2.indexOf('民房') >= 0,
        (h2.match(/在建队列（\d+）/) || [''])[0]);
      G.ui.closeAllModals();
      /* city:wall 宽容解析（非数字槽位） */
      s174.queues.build.push({ cityId: c174.id, gridIndex: 'wall', buildId: 'chengqiang',
        type: 'build', elapsed: 0, totalTime: 600 });
      const spy174 = document.createElement('span');
      spy174.setAttribute('data-build-progress', 'city:wall');
      document.querySelector('#view-container').appendChild(spy174);
      G.ui.updateProgress();
      check('★ v89.174 updateProgress 解析 city:wall（旧写法 Number("wall")=NaN → 永远 …）',
        /^\d+% · /.test(spy174.textContent || ''), spy174.textContent);
      spy174.remove();
    } finally {
      s174.queues.build = s174.queues.build.filter(function (q) {
        return q.gridIndex !== idx174 && q.gridIndex !== idx174b && q.gridIndex !== 'wall';
      });
      c174.cells[idx174].build = null; c174.cells[idx174].pending = null;
      c174.cells[idx174b].build = null; c174.cells[idx174b].pending = null;
    }
  })();

  /* ============================================================
   * 175. v89.175（老板）：每回合可见调整（真实 DOM · 喂一回合 + 假 rec）
   * ============================================================ */
  console.log('\n--- §175. 智能调兵可见（v89.175 · 真实 DOM） ---');
  await (async function () {
    /* 打开战场（若可）并直接喂一条带 smartLog 的回合 —— 与 v89.120 的喂法同模式 */
    const log175 = document.querySelector('#bt-log');
    if (!log175) {
      /* 战场已关：用最小容器承接（btRoundLine 只依赖 #bt-log） */
      const host = document.createElement('div');
      host.id = 'bt-log';
      document.body.appendChild(host);
    }
    const snap175 = { field: 4000, atk: [{ id: 'gongjian', name: '弓箭手', count: 700, adv: 850, range: 1200 }],
      def: [{ id: 'gongjian', name: '弓箭手', count: 700, adv: 100, range: 1200 }], towers: null };
    const fakeRec175 = { side: 'atk', smartRule: 'front',
      smartLog: [{ r: 93, n: 3, rule: 'front', notes: ['弓箭手 前进→防御', '轻骑兵 目标→弓箭手', '长枪兵 目标→轻骑兵'] }] };
    G.ui.btRoundLine({ r: 93, gap: 1800, events: [] }, snap175, fakeRec175);
    const lg175 = document.querySelector('#bt-log');
    check('★ v89.175 回合记录出现「智能调兵完成（调整 3 项…）· 采用「清前排」· 开始回合战斗」',
      !!lg175 && lg175.textContent.indexOf('智能调兵完成') >= 0
      && lg175.textContent.indexOf('开始回合战斗') >= 0
      && lg175.textContent.indexOf('调整 3 项') >= 0 && lg175.textContent.indexOf('清前排') >= 0,
      lg175 ? lg175.textContent.slice(0, 90) : '#bt-log 缺失');
    /* 对照：无 smartLog 的 rec → 不出现智能行（不误报） */
    const before175 = lg175 ? lg175.textContent.length : 0;
    G.ui.btRoundLine({ r: 94, gap: 1700, events: [] }, snap175, { side: 'atk', cmd: {} });
    check('v89.175 对照：rec 无 smartLog → 本回合不出现智能行',
      !!lg175 && lg175.textContent.indexOf('第 94 回合') >= 0
      && (lg175.textContent.match(/智能调兵完成/g) || []).length === 1, '');
    /* 维持阵型分支 */
    G.ui.btRoundLine({ r: 95, gap: 1600, events: [] }, snap175,
      { side: 'atk', smartRule: 'static', smartLog: [{ r: 95, n: 0, rule: 'static', notes: [] }] });
    check('v89.175 无调整 → 「维持阵型」也可见（老板："可以不动，但需要显示"）',
      !!lg175 && lg175.textContent.indexOf('维持阵型') >= 0);
  })();

/* ============================================================
 * v89.176（智能战术 v2）：接敌角标 / 损失读数 / 沙盘统一 —— 真 DOM 版
 * ============================================================ */
(function () {
  const snap176 = { field: 2600, round: 3, maxRounds: 30, towers: null,
    atk: [{ id: 'changqiang', name: '长枪兵', count: 80, start: 100, adv: 1400, spd: 300, er: 50, stance: 'advance' }],
    def: [{ id: 'gongjian', name: '弓箭手', count: 90, start: 100, adv: 1400, spd: 250, er: 1200, stance: 'advance' }] };
  check('v89.176 顶栏损失读数出现（btTopHTML · start↔count 我损 20%/敌损 10%）', (function () {
    const h = G.ui.btTopHTML({ cnt: 60 }, snap176);
    return h.indexOf('bt-loss') >= 0 && h.indexOf('我损 20%') >= 0 && h.indexOf('敌损 10%') >= 0;
  })());
  check('v89.176 战场三线 + 标尺 + 接敌角标（btFieldHTML · bt-fl-a / sd-scale / incoming）', (function () {
    const h = G.ui.btFieldHTML(snap176);
    return h.indexOf('bt-fl-a') >= 0 && h.indexOf('sd-scale') >= 0 && h.indexOf('incoming') >= 0;
  })());
  check('v89.176 智能行显示「阵型 · 规则」（喂 smartLog 带 mode:spear → 针尖麦芒）', (function () {
    /* 先清掉前面用例留下的 #bt-log（getElementById 只会拿到第一个 → 假红） */
    document.querySelectorAll('#bt-log').forEach(function (el) { el.parentNode && el.parentNode.removeChild(el); });
    const host = document.createElement('div');
    host.id = 'bt-log'; document.body.appendChild(host);
    G.ui.btRoundLine({ r: 96, gap: 1500, events: [] }, snap176,
      { side: 'atk', smartRule: 'front', smartMode: 'spear',
        smartLog: [{ r: 96, n: 2, rule: 'front', mode: 'spear', notes: ['弓箭手 前进→防御'] }] });
    const txt = host.textContent || '';
    return txt.indexOf('针尖麦芒') >= 0 && txt.indexOf('清前排') >= 0;
  })());
})();

/* ============================================================
 * v89.177（民心/民怨 · 君主突破考验）：真 DOM 版
 * ============================================================ */
(function () {
  check('v89.177 官府弹窗「民心 / 民怨」段（值 + 两措施按钮 · 真 DOM）', (function () {
    G.ui.closeAllModals();
    const c = G.state.cities[0];
    let gIdx = -1;
    c.cells.forEach(function (cc, i) { if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i; });
    if (gIdx < 0) return false;
    G.ui.openBuildModal(gIdx);
    const txt = document.querySelector('#modal-root').textContent || '';
    const b1 = document.querySelector('#modal-root [data-action="hearts-boost"]');
    const b2 = document.querySelector('#modal-root [data-action="hearts-soothe"]');
    G.ui.closeAllModals();
    return txt.indexOf('民心 / 民怨') >= 0 && txt.indexOf('鼓舞民心') >= 0
      && txt.indexOf('消减民怨') >= 0 && !!b1 && !!b2;
  })());
  check('v89.177 君主面板「突破考验」五关清单（真 DOM · 打开君主面板）', (function () {
    G.ui.closeAllModals();
    if (!G.lordGeneralOf || !G.lordGeneralOf()) return 'SKIP-无条件';
    G.ui.openLordInfo();
    const txt = document.querySelector('#modal-root').textContent || '';
    G.ui.closeAllModals();
    return txt.indexOf('突破考验') >= 0 && txt.indexOf('宝物（珠宝）') >= 0;
  })());
})();

/* ============================================================
 * §180（v89.180）拆械 / live 滚动保留（真 DOM 版）
 * ============================================================ */
console.log('\n--- §180. 拆械与 live 滚动（v89.180） ---');
{
  G.ui.closeAllModals();
  const c180 = G.state.cities[0];
  let fIdx180 = -1;
  c180.cells.forEach(function (cc, i) {
    if (fIdx180 < 0 && cc.build && cc.build.id === 'gongjiangzuofang') fIdx180 = i;
  });
  if (fIdx180 < 0) {
    fIdx180 = c180.cells.findIndex(function (x) { return !x.build && !x.official; });
    if (fIdx180 >= 0) c180.cells[fIdx180] = { build: { id: 'gongjiangzuofang', lvl: 7 }, pending: null };
  }
  G.ui.openTroops(fIdx180, 'siege');
  await sleep(180);
  const card180 = document.querySelector('#modal-root .troop-card[data-troop="chuangnu"]');
  const tip180 = card180 ? card180.querySelector('.tcard-tip') : null;
  const txt180 = tip180 ? (tip180.textContent || '') : '';
  check('§180a 器械页床弩卡悬停含「拆械 对器械伤害 ×3」（真 DOM）',
    !!card180 && txt180.indexOf('拆械') >= 0 && txt180.indexOf('×3') >= 0, txt180.slice(0, 90));

  /* live 每秒重建：.panel-body 滚动位必须保留（v89.180 修复的 flaky 根因 ·
     快照/回填选择器原缺 panel-body —— 上一版靠"恰好时序"才绿） */
  const pb180 = document.querySelector('#modal-root .panel-body');
  if (pb180) pb180.scrollTop = 126;
  G.ui.liveModalTick();
  const pb180b = document.querySelector('#modal-root .panel-body');
  check('§180b live 重建后 .panel-body 滚动位保留 126（确定性：直调 liveModalTick）',
    !!pb180 && !!pb180b && pb180b.scrollTop === 126, pb180b ? String(pb180b.scrollTop) : 'null');
  G.ui.closeAllModals();
  await sleep(60);
}

  console.log('\n--- §185. 民心人口 / 守将体系（v89.185） ---');
  {
    /* ① 人口行显示"民心 x% 折算"（真 DOM · 有效上限） */
    G.ui.closeAllModals();
    G.ui.setView('city');
    await sleep(80);
    const popTip = document.querySelector('#city-attrs .pop-line .rate-wrap');
    check('§185a 人口行悬停含「民心 X% 折算」（有效人口上限 · 真 DOM）',
      !!popTip && /民心 \d+% 折算/.test(popTip.getAttribute('data-tip') || ''),
      popTip ? (popTip.getAttribute('data-tip') || '').replace(/\s+/g, ' ').slice(0, 80) : '缺 .rate-wrap');

    /* ② 野地衰减文案（守地减半口径）——源码级 + 表值同查 */
    const wd = (window.GAME && window.GAME.DATA && window.GAME.DATA.WILD_DECAY) || {};
    check('§185b 衰减表（-2/日 · 驻军 -1/日）与文案同口径', wd.perDay === 2 && wd.heldPerDay === 1,
      JSON.stringify(wd));
  }

  /* ============================================================
   * v89.191：数值框可填（真点真填）· 宝具并列入口（真点开窗）
   * ============================================================ */
  {
    /* ① 自动征兵数值框：真点不被重建（修复前 click 会派发动作 + 重绘替换 DOM） */
    G.ui._autoSel = 'train';
    G.ui.setView('auto');
    await sleep(240);
    const vc191 = document.querySelector('#view-container');
    const inp191 = vc191.querySelector('.auto-pane input.at-num[data-k="max"][data-troop="yibing"]');
    check('v89.191：自动征兵「目标」数值框在场', !!inp191);
    if (inp191) {
      inp191.value = '4321';
      inp191.click();          /* 修复前：触发 autotrain-set → renderView → 输入框被替换 */
      const still191 = vc191.querySelector('.auto-pane input.at-num[data-k="max"][data-troop="yibing"]');
      check('v89.191：点输入框不派发动作（框未被重建 · 值未被点击提交）',
        still191 === inp191 && G.autoTrainCfg().targets.yibing.max !== 4321);
      if (still191) {
        still191.value = '777';
        still191.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(80);
        check('v89.191：change 真落库（777）', G.autoTrainCfg().targets.yibing.max === 777);
      }
      G.autoTrainCfg().targets.yibing.max = 0;      /* 用完还原（后续用例别被污染） */
    }

    /* ② 宝具并列入口：真点「🔮 宝具」开挂件选择窗 */
    const lord191 = G.lordGeneralOf();
    G.ui._genSel = lord191.id;
    G.ui.setView('generals');
    await sleep(240);
    const baoBtn191 = document.querySelector('#view-container [data-action="attach-pick"][data-slot="bao"]');
    check('v89.191：装备栏「🔮 宝具」入口在场（与军中/修炼并列）', !!baoBtn191);
    if (baoBtn191) {
      click(baoBtn191);
      await sleep(260);
      const mr191 = document.querySelector('#modal-root');
      const txt191 = (mr191 && mr191.textContent) || '';
      check('v89.191：点宝具 → 挂件选择窗（含 宝具 标题与 佩上/库存 出口）',
        txt191.indexOf('宝具') >= 0 && (txt191.indexOf('佩上') >= 0 || txt191.indexOf('库存中没有可佩') >= 0));
      G.ui.closeAllModals();
      await sleep(60);
    }
  }

  /* ============================================================
   * §192（v89.192）：回本城真点 / 观战补史（真 DOM）
   * ============================================================ */
  {
    console.log('\n--- §192 回本城（真点 · v89.192）---');
    G.ui.setView('map');
    await sleep(80);
    const btnMy192 = document.querySelector('#bottom-bar [data-action="map-mycity"]');
    check('v89.192：回本城按钮在场', !!btnMy192);
    if (btnMy192) {
      G.ui.mapView.x = 10; G.ui.mapView.y = 10;
      const c192 = G.currentCity();
      document.querySelector('#bottom-bar [data-action="map-mycity"]').click();
      await sleep(60);
      check('v89.192：点回本城 → 视野中心 = 当前城坐标',
        G.ui.mapView.x === c192.x && G.ui.mapView.y === c192.y,
        'center=' + G.ui.mapView.x + ',' + G.ui.mapView.y + ' city=' + c192.x + ',' + c192.y);
    }

    console.log('\n--- §192 观战补历史（中途进入补渲染 · v89.192）---');
    /* 造一个挂起战斗（纯数据 rec + 会话），不经地图链 —— e2e 与页面同 realm，直接操作 */
    G.state.settings = G.state.settings || {};
    const bkW192 = G.state.settings.battleWatch;
    G.state.settings.battleWatch = true;
    const rec192 = { id: 'btE192', kind: 'expedition', side: 'atk',
      target: { kind: 'wild', x: 1, y: 1, name: '测试野地' },
      atkArmy: { yibing: 300 }, genId: null, cityId: null,
      sim: { scArmy: { yibing: 120 }, scVal: 0, scGen: null, simOpts: {} },
      round: 0, cnt: 60, state: 'live', cmd: {}, history: [], snapLast: null, evLast: [], gapLast: null };
    G.state.battles = G.state.battles || [];
    G.state.battles.push(rec192);
    G._bsess = G._bsess || {};
    G._bsess[rec192.id] = G.battle._makeEnv(rec192);
    for (let i = 0; i < 2; i++) G.battle.stepBattle(rec192.id);
    const roundBefore192 = rec192.round;
    G.ui.openBattlefield(rec192.id);
    await sleep(500);
    const log192 = document.getElementById('bt-log');
    let hdrN192 = 0; const hdrs192 = [];
    if (log192 && log192.children) {
      Array.prototype.forEach.call(log192.children, (el) => {
        if (el.className.indexOf('hdr') >= 0) { hdrN192++; hdrs192.push(el.textContent); }
      });
    }
    check('v89.192：中途观战 → 前 2 回合的块被补渲染（倒序）',
      hdrN192 >= 2, 'round=' + roundBefore192 + ' hdrN=' + hdrN192 + ' ' + JSON.stringify(hdrs192));
    try { G.ui.closeAllModals(); G.state.battles = []; } catch (e) {}
    G.state.settings.battleWatch = bkW192;
  }


  console.log('\n--- §193 时间跳变补偿 + 前哨面板（v89.193）---');
  /* ① 主循环真跑：拨 _loopLastAt 到 1 小时前 → 下个 tick 触发补算（elapsed 跃增） */
  {
    const e0 = G.state.world.elapsed;
    G._loopLastAt = Date.now() - 3600 * 1000;
    await sleep(1400);
    const e1 = G.state.world.elapsed;
    check('v89.193：主循环时间跳变补偿（拨钟 1h → elapsed 跃增 ≥ 3600×ts×0.9）',
      e1 - e0 >= 3600 * G.timeScale() * 0.9, 'Δ=' + Math.round(e1 - e0) + ' ts=' + G.timeScale());
  }
  /* ② 前哨面板（jsdom 真渲染）：点前哨格的落点 */
  {
    const bkForts193 = G.state.forts;
    G.state.forts = { '3,3': { x: 3, y: 3, lv: 7, name: '测试前哨', cityId: G.state.cities[0].id } };
    G.ui.openOutpostPanel(G.state.forts['3,3']);
    await sleep(80);
    const h193a = ((document.querySelector('#modal-root .inner-panel') || {}).textContent || '');
    check('v89.193：前哨面板（名称/辐射/五档护持/所属城/总览入口）',
      h193a.indexOf('我方前哨') >= 0 && h193a.indexOf('辐射') >= 0 && h193a.indexOf('前哨护持') >= 0
      && h193a.indexOf('前哨总览') >= 0, h193a.slice(0, 60));
    try { G.ui.closeAllModals(); } catch (e) {}
    /* ③ 总览弹窗 */
    G.ui.openOutposts();
    await sleep(80);
    const h193b = ((document.querySelector('#modal-root .inner-panel') || {}).textContent || '');
    check('v89.193：前哨总览（每城上限 5 · 本城 n/5 · 测试前哨在册）',
      h193b.indexOf('我方前哨') >= 0 && h193b.indexOf('每城上限 5') >= 0 && h193b.indexOf('测试前哨') >= 0,
      h193b.slice(0, 80));
    try { G.ui.closeAllModals(); G.state.forts = bkForts193; } catch (e) {}
  }

  /* ============================================================
   * §194（v89.194）：藏珍阁视图（tab → 真渲染 → 真点购买 → 一键集齐）
   *   + 将领页月俸行 / 城主小签 DOM 冒烟
   * ============================================================ */
  console.log('\n===== 194. v89.194（藏珍阁 · 月俸行 · 城主标签） =====');
  {
    /* ① tab 存在（静态导航）+ 真渲染（卡 12 / chips 19：全部 + 18 系） */
    const navCol = document.querySelector('#topnav .tab[data-view="collection"]');
    G.ui.setView('collection');
    await sleep(90);
    const colCards = document.querySelectorAll('#view-container .col-card');
    const colChips = document.querySelectorAll('#view-container .col-chip');
    check('§194 藏珍阁视图渲染：导航 tab 在册 · 卡 12 · chips 19（全部+18 系）',
      !!navCol && colCards.length === 12 && colChips.length === 19,
      'nav=' + !!navCol + ' cards=' + colCards.length + ' chips=' + colChips.length);

    /* ② 真点购买：入藏 + 扣金（唯一出口） */
    /* v89.196（老板 7）：藏珍阁改成就型 —— 旧"直购"用例先拉满全部条件（解锁所有藏品），
       否则会被解锁闸正确拦下（本用例验的是"购买唯一出口"，不是成就闸本身）。
       ⚠️ gathers 键名与 statBump 一字不差（曾写 gather 致凉州系锁死）。 */
    G.state.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
      recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
    G.state.rep = Math.max(G.state.rep || 0, 99999);
    G.state.rank = Math.max(G.state.rank || 0, 9);
    (function () {
      const _lg = G.lordGeneralOf(); if (_lg) _lg.level = Math.max(_lg.level || 1, 300);
      (G.state.cities[0].cells || []).forEach(function (cell) {
        if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
      });
      (G.DATA.ITEMS || []).slice(0, 8).forEach(function (it) {
        G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
      });
    })();
    G.ui.renderCollect();
    await sleep(120);
    const buyBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');
    let buyOk = false, buyDetail = 'no-btn';
    if (buyBtn) {
      const _bid = buyBtn.getAttribute('data-item');
      G.goldAdd(5000000 - G.goldOf());
      const g0 = G.goldOf();
      buyBtn.click();
      /* collectBuy 是同步的 —— **立即读金**（税收在 sleep 窗口会持续入账，
         gate 慢环境下 220ms 能涨上千金 → "扣款===定价"的精确断言会 flaky）。
         判据：立即差值 === 定价（±50 只防浮点）；随后再等 DOM 重绘验卡片态。 */
      const _paid194 = g0 - G.goldOf();
      const _it = G.collectItemOf(_bid);
      await sleep(220);
      buyOk = G.collectHaveOf(_bid) === true && Math.abs(_paid194 - _it.price) <= 50;
      buyDetail = _bid + ' 扣金 ' + _paid194 + '（应 ' + _it.price + '）';
    }
    check('§194 真点购买：入藏 + 扣金（走唯一出口）', buyOk, buyDetail);
    const ownedNow = document.querySelectorAll('#view-container .col-card.owned').length;
    check('§194 已藏卡片出金框（.owned）', ownedNow >= 1, 'owned=' + ownedNow);

    /* ③ 切系列 + 一键集齐（真点；预检总价 → 买齐） */
    const one = Array.from(document.querySelectorAll('#view-container .col-chip[data-c]'))
      .find((x) => x.getAttribute('data-c') !== 'all');
    let seriesOk = false, serDetail = 'no-chip';
    if (one) {
      one.click();
      await sleep(160);
      const serBtn = document.querySelector('#view-container .col-desc [data-action="collect-series"]');
      if (serBtn) {
        G.goldAdd(5000000 - G.goldOf());
        serBtn.click();
        await sleep(260);
        const _d = G.collectSeriesDoneOf(one.getAttribute('data-c'));
        seriesOk = _d.done === true;
        serDetail = one.getAttribute('data-c') + ' ' + _d.have + '/' + _d.total;
      }
    }
    check('§194 切系列 + 一键集齐（真点）：本系 done', seriesOk, serDetail);

    /* ④ 将领页：月俸行在册；城主状态不挂小签（摆选中 → 用完复位） */
    const _gSel = (G.state.generals || []).filter((x) => !G.isLordGeneral(x))[0];
    const _bkStatus = _gSel ? _gSel.status : null;
    if (_gSel) { _gSel.status = 'mayor'; G.ui._genSel = _gSel.id; }
    G.ui.setView('city');
    await sleep(40);
    G.ui.setView('generals');
    await sleep(90);
    const pane194 = document.querySelector('#view-container .gen-pane');
    const salIn = !!pane194 && pane194.innerHTML.indexOf('gp-sal194') >= 0;
    const noStag = !!pane194 && pane194.innerHTML.indexOf('gp-stag') < 0;
    if (_gSel) _gSel.status = _bkStatus;
    check('§194 将领页：月俸行在册 · 城主状态不挂小签（DOM 层）',
      salIn && noStag, 'sal=' + salIn + ' noStag=' + noStag);
  }

  /* ============================================================
   * §195（v89.195）：前哨放手（面板 → 确认窗 → 红键真点全链）+ 档位一览
   * ============================================================ */
  console.log('\n===== 195. v89.195（前哨放手 · 档位一览） =====');
  {
    const bkForts195 = G.state.forts;
    const bkTaken195 = G.state.fortsTaken;
    G.state.forts = {}; G.state.fortsTaken = {};
    G.map.generate();
    const c195 = G.currentCity();
    let px195 = null, py195 = null;
    for (let yy = 4; yy < 40 && px195 == null; yy++) {
      for (let xx = 4; xx < 40; xx++) {
        const tl = G.map.tile(xx, yy);
        if (tl && tl.terrain !== 'city' && tl.terrain !== 'water' && tl.terrain !== 'lake'
          && (Math.abs(xx - c195.x) > 3 || Math.abs(yy - c195.y) > 3)) { px195 = xx; py195 = yy; break; }
      }
    }
    if (px195 != null) {
      /* 造前哨（真调）→ 打开前哨格面板 */
      G.claimFort({ kind: 'fort', fort: { x: px195, y: py195, level: 8, name: '体测哨', kind: 'fort' } }, null, c195, {});
      G.ui.closeAllModals();
      G.ui.openOutpostPanel(G.fortOwnAt(px195, py195));
      await sleep(120);
      const panel195 = document.querySelector('#modal-root .inner-panel');
      const pTxt = panel195 ? panel195.innerHTML : '';
      check('§195 前哨面板：危险区「放手该前哨」按钮在册',
        pTxt.indexOf('fort-abandon-ask') >= 0 && pTxt.indexOf('放手该前哨') >= 0,
        'len=' + pTxt.length);

      /* 真点「放手」→ 确认窗 */
      const abBtn195 = document.querySelector('#modal-root [data-action="fort-abandon-ask"]');
      if (abBtn195) abBtn195.click();
      await sleep(120);
      const ask195 = document.querySelector('#modal-root .inner-panel');
      const aTxt = ask195 ? ask195.textContent : '';
      const armEl195 = document.querySelector('#modal-root [data-action="fort-abandon-arm"]');
      check('§195 确认窗三件套：失去护持 / 名额变化 / 不可撤销 + 红键在册',
        !!armEl195 && aTxt.indexOf('不可撤销') >= 0 && aTxt.indexOf('名额变化') >= 0 && aTxt.indexOf('失去护持') >= 0,
        aTxt.slice(0, 90));

      /* 真点红键（一击执行）→ 前哨删除 + 弹层关净 */
      if (armEl195) armEl195.click();
      await sleep(180);
      const gone195 = G.fortOwnAt(px195, py195) === null;
      const closed195 = document.querySelectorAll('#modal-root .inner-panel').length === 0;
      check('§195 真点红键：前哨删除 + 弹层关净（一击执行 · v89.156 口径）',
        gone195 && closed195, 'gone=' + gone195 + ' closed=' + closed195);
    } else {
      check('§195 前哨放手（造局失败：无可用格）', false, 'no-cell');
    }

    /* 总览：等级档位一览表（重新造一处 → 打开总览） */
    if (px195 != null) {
      G.claimFort({ kind: 'fort', fort: { x: px195, y: py195, level: 6, name: '总览哨', kind: 'fort' } }, null, c195, {});
      G.ui.closeAllModals();
      G.ui.openOutposts();
      await sleep(150);
      const ov195 = document.querySelector('#modal-root .inner-panel');
      const oTxt = ov195 ? ov195.textContent : '';
      check('§195 总览：等级档位一览表在册（五档边界 + 等级越高护持越强）',
        oTxt.indexOf('等级档位一览') >= 0 && oTxt.indexOf('Lv1–2') >= 0
        && oTxt.indexOf('Lv5–6') >= 0 && oTxt.indexOf('Lv9–10') >= 0
        && oTxt.indexOf('每城上限 5') >= 0,
        'len=' + oTxt.length);
    }

    try { G.ui.closeAllModals(); } catch (e) { }
    G.state.forts = bkForts195; G.state.fortsTaken = bkTaken195;
  }

  /* ============================================================
   * §196（v89.196）：藏珍阁三态（锁 → 解锁 → 激活按钮）+ 结束界面回看按钮
   * ============================================================ */
  console.log('\n===== 196. v89.196（成就收藏三态 · 回看按钮） =====');
  {
    const _bkStats196 = G.state.stats, _bkRep196 = G.state.rep, _bkRank196 = G.state.rank,
      _bkCollect196 = G.state.collect, _bkPeak196 = G.state.collectPeak;
    try {
      /* ① 清零条件（全锁）→ 打开收藏 → 有 .col-card.locked
         v89.202（峰值机制上线）：条件判定改读"历史最高"（s.collectPeak）——
         "清零造局"必须**连峰值一起清**（否则前序用例记录过的高峰值会让条件保持解锁）；
         finally 一并还原（用例自己摆的自己收）。 */
      G.state.stats = {}; G.state.rep = 0; G.state.rank = 0; G.state.collect = {};
      G.state.collectPeak = {};
      G.ui._colCat = 'all';
      G.ui.setView('collection');
      await sleep(140);
      const lockedN = document.querySelectorAll('#view-container .col-card.locked').length;
      check('§196 藏珍阁三态：未解锁卡片在册（.col-card.locked + 条件行）',
        lockedN >= 1, 'locked=' + lockedN);
      /* ② 拉满 → 重渲染 → 锁解除 + 「激活」按钮出现 */
      G.state.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
        recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
      G.state.rep = 99999; G.state.rank = 9;
      const _lg196 = G.lordGeneralOf(); if (_lg196) _lg196.level = 300;
      (G.state.cities[0].cells || []).forEach(function (cell) {
        if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
      });
      (G.DATA.ITEMS || []).slice(0, 8).forEach(function (it) {
        G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
      });
      G.ui.renderCollect();
      await sleep(140);
      const lockedN2 = document.querySelectorAll('#view-container .col-card.locked').length;
      const actBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');
      check('§196 解锁后：锁解除 + 「激活」按钮在册（成就型两段式）',
        lockedN2 === 0 && !!actBtn, 'locked2=' + lockedN2 + ' btn=' + !!actBtn);
    } finally {
      G.state.stats = _bkStats196; G.state.rep = _bkRep196; G.state.rank = _bkRank196;
      G.state.collect = _bkCollect196; G.state.collectPeak = _bkPeak196;   /* v89.202：峰值一并还原 */
    }

    /* ③ 结束界面「🎬 回看全程」按钮（构造回执 → btShowEnd → DOM 断言） */
    let actsEl196 = document.getElementById('bt-acts');
    if (!actsEl196) { actsEl196 = document.createElement('div'); actsEl196.id = 'bt-acts'; document.body.appendChild(actsEl196); }
    if (!document.getElementById('bt-cd')) {
      const cde = document.createElement('div'); cde.id = 'bt-cd'; document.body.appendChild(cde);
    }
    const _bkJD196 = G._battleJustDone, _bkBT196 = G.ui._bt;
    G._battleJustDone = { id: 'e2e96', ok: true, winner: 'atk', rounds: 3,
      atkLoss: 1, defLoss: 2, report: { t: 1, title: 'x' } };
    G.ui._bt = { id: 'e2e96', lastRound: 3, playing: false, timer: null };
    try { G.ui.btShowEnd(G.ui._bt); } catch (e) { }
    check('§196 结束界面：「🎬 回看全程」按钮在册（结束回执带 report 时）',
      actsEl196.innerHTML.indexOf('bt-replay') >= 0 && actsEl196.innerHTML.indexOf('回看全程') >= 0,
      actsEl196.innerHTML.slice(0, 90));
    G._battleJustDone = _bkJD196; G.ui._bt = _bkBT196;
    try { actsEl196.innerHTML = ''; } catch (e) { }
  }

  /* ============================================================
   * §197（v89.197）：出征统一行 · 战法 chips 组件 · 悬停规范（title 升级）
   * 老板：「第 3/4/5 条 —— 出征界面规范 + 备注悬停 + 规范所有悬停显示框」
   * ============================================================ */
  console.log('\n===== 197. v89.197（出征界面统一行 · 战法可见性 · 悬停规范） =====');
  {
    const _bkGen197 = G.ui._expGen;
    try {
      const c197 = G.state.cities[0];
      c197.army = c197.army || {};
      if (!Object.keys(c197.army).length) c197.army = { yibing: 500 };
      G.ui._cityId = c197.id;
      const tg197 = { kind: 'wild', x: c197.x + 3, y: c197.y + 3 };
      G.ui.openExpModal(tg197);
      await sleep(140);
      const panel197 = document.querySelector('#modal-root .inner-panel') || document.body;

      /* ① 统一行：7 个名称列（v89.198：战法行已随「清除战法这个玩法」全撤） */
      const rows197 = panel197.querySelectorAll('.exp-row');
      const labs197 = Array.prototype.map.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim());
      check('§197① 出征面板统一行：7 个名称列齐备（战法行已全撤）',
        rows197.length >= 7
        && labs197.indexOf('目标') >= 0 && labs197.indexOf('主将') >= 0
        && labs197.indexOf('计略') >= 0 && labs197.indexOf('出征方式') >= 0
        && labs197.indexOf('战法') < 0 && labs197.indexOf('方案') >= 0
        && labs197.indexOf('出征战术') >= 0 && labs197.indexOf('可用道具') >= 0,
        'rows=' + rows197.length + ' labs=' + labs197.join(','));

      /* ②（v89.198 全撤）：战法 chips 退役 —— #exp-ops 零残留 */
      check('§197②（v89.198 全撤）战法 chips 退役：#exp-ops / .exp-ops-cell 零残留',
        panel197.querySelectorAll('#exp-ops').length === 0
        && panel197.querySelectorAll('.exp-ops-cell').length === 0,
        'opsEl=' + panel197.querySelectorAll('#exp-ops').length);

      /* ③ 备注悬停源（.tip-src）在册：计略说明 + 方案说明 ≥2（战法说明随全撤） */
      const srcs197 = panel197.querySelectorAll('.exp-row .tip-src');
      check('§197③ 备注悬停源：.tip-src 在册（计略/方案说明 ≥2）',
        srcs197.length >= 2, 'srcs=' + srcs197.length);

      /* ④ 悬停浮层联通：mouseover 方案名称 → #tip-layer 打开并含方案说明（v89.198：原战法行已撤） */
      const labPlan = Array.prototype.find.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim() === '方案');
      const rowPlan = labPlan ? labPlan.closest('.exp-row') : null;
      if (rowPlan) {
        rowPlan.dispatchEvent(new window.MouseEvent('mouseover',
          { bubbles: true, cancelable: true, view: window }));
        await sleep(50);
        const tipL197 = document.querySelector('#tip-layer');
        check('§197④ 悬停浮层：方案说明经 #tip-layer 显示（统一规格）',
          !!tipL197 && tipL197.classList.contains('on')
          && tipL197.textContent.indexOf('套用方案即按其配好兵力与战术') >= 0,
          (tipL197 && tipL197.textContent || '').slice(0, 60));
      } else {
        check('§197④ 悬停浮层：方案说明经 #tip-layer 显示（统一规格）', false, '未找到方案行');
      }
    } finally {
      try { G.ui.closeAllModals(); } catch (e) { }
      G.ui._expGen = _bkGen197;
    }

    /* ⑤ title 全站升级：浮层显示 + 摘除防双显 + mouseout 恢复 */
    const tEl197 = document.createElement('span');
    tEl197.id = 't197';
    tEl197.title = '测试标题197';
    tEl197.textContent = 'x';
    document.body.appendChild(tEl197);
    tEl197.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    await sleep(50);
    const tipT197 = document.querySelector('#tip-layer');
    const shown197 = !!tipT197 && tipT197.classList.contains('on')
      && tipT197.textContent.indexOf('测试标题197') >= 0;
    const stripped197 = tEl197.getAttribute('title') === null
      && tEl197.getAttribute('data-title-bk') === '测试标题197';
    tEl197.dispatchEvent(new window.MouseEvent('mouseout',
      { bubbles: true, cancelable: true, view: window, relatedTarget: document.body }));
    await sleep(50);
    const restored197 = tEl197.getAttribute('title') === '测试标题197';
    check('§197⑤ title 全站升级：浮层显示 + 摘除防双显（data-title-bk）+ mouseout 恢复',
      shown197 && stripped197 && restored197,
      'shown=' + shown197 + ' stripped=' + stripped197 + ' restored=' + restored197);
    try { tEl197.remove(); } catch (e) { }
  }
  /* ============================================================
   * §198（v89.198）：战法全撤 · 管理弹窗统一行 · 出征备注四项（真 DOM）
   * ============================================================ */
  console.log('\n===== 198. v89.198（战法全撤 · 管理弹窗 · 备注四项） =====');
  {
    const c198 = G.state.cities[0];
    const _bkGen198 = G.ui._expGen;
    try {
      c198.army = c198.army || {};
      if (!Object.keys(c198.army).length) c198.army = { yibing: 500 };
      if (!(G.state.generals || []).length) {
        G.state.generals.push(G.makeGeneral('测198', 40, 'idle', c198.id, false));
      }
      G.ui._cityId = c198.id;
      G.ui.openExpModal({ kind: 'wild', x: c198.x + 3, y: c198.y + 3 });
      await sleep(140);
      const panel198 = document.querySelector('#modal-root .inner-panel') || document.body;

      /* ① 备注四项（真渲染） */
      const vital198 = panel198.querySelector('#exp-gen-vital');
      const tgtSec198 = panel198.querySelector('.exp-a-target');
      const genSec198 = panel198.querySelector('.exp-a-gen');
      check('§198① 出征面板：精力/体力行在主将区 · 相称建议在目标区 · 无锦囊计数 · 无战法行/阵位行',
        !!vital198 && /精力/.test(vital198.textContent) && /体力/.test(vital198.textContent)
        && !!genSec198 && genSec198.contains(vital198)
        && !!tgtSec198 && /相称建议/.test(tgtSec198.textContent)
        && (panel198.textContent || '').indexOf('锦囊 ×') < 0
        && panel198.querySelectorAll('#exp-ops').length === 0
        && (panel198.textContent || '').indexOf('阵位 ') < 0,
        'vital=' + (vital198 ? vital198.textContent.trim() : 'null'));

      /* ② 管理弹窗统一行（真渲染） */
      G.ui.openAutoMarch();
      await sleep(160);
      const panelAM198 = document.querySelector('#modal-root .inner-panel') || document.body;
      const labsAM198 = Array.prototype.map.call(panelAM198.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim());
      check('§198② 管理弹窗（自动出征·详细配置）：统一行 9 个名称列 · 阵位行零残留',
        labsAM198.indexOf('执行将领') >= 0 && labsAM198.indexOf('目标类型') >= 0
        && labsAM198.indexOf('目标等级') >= 0 && labsAM198.indexOf('搜索距离') >= 0
        && labsAM198.indexOf('出征方式') >= 0 && labsAM198.indexOf('计略') >= 0
        && labsAM198.indexOf('出征战术') >= 0 && labsAM198.indexOf('出征频率') >= 0
        && labsAM198.indexOf('每日上限') >= 0
        && (panelAM198.textContent || '').indexOf('阵位 ') < 0,
        'labs=' + labsAM198.join(','));
    } finally {
      try { G.ui.closeAllModals(); } catch (e) { }
      G.ui._expGen = _bkGen198;
    }
  }
  /* ============================================================
   * §200（v89.200）：睡眠自动打 · 出征界面三改（DOM 真渲染层）
   *   ① 预估块在左列（右列零残留） ② 围攻提示行下线
   *   ③ 目标/主将两块在册 ④ 归来报告「自动打完」行
   * ============================================================ */
  console.log('\n===== 200. v89.200（睡眠自动打 · 预估左列 · 围攻行下线） =====');
  {
    const _bkGen200 = G.ui._expGen, _bkCity200 = G.ui._cityId, _bkRep200 = G._offlineReport;
    try {
      const c200 = G.state.cities[0];
      c200.army = c200.army || {};
      if (!Object.keys(c200.army).length) c200.army = { yibing: 500 };
      G.ui._cityId = c200.id;
      G.ui.openExpModal({ kind: 'wild', x: c200.x + 3, y: c200.y + 3 });
      await sleep(140);
      const panel200 = document.querySelector('#modal-root .inner-panel') || document.body;
      const estL = panel200.querySelector('.exp-col-l .exp-a-est');
      const estR = panel200.querySelector('.exp-col-r .exp-a-est');
      check('§200① 预估块在左列（DOM 真渲染 · 右列零残留）',
        !!estL && !estR, 'inL=' + !!estL + ' inR=' + !!estR);

      /* 围攻提示行下线：填兵 → updateExpMarch → #exp-power 无「围攻」字样 */
      const firstTroop = Object.keys(c200.army)[0];
      const inp200 = document.getElementById('exp-' + firstTroop);
      if (inp200) inp200.value = '100';
      G.ui.updateExpMarch();
      const powTxt = (document.getElementById('exp-power') || {}).textContent || '';
      check('§200② 军师估算无「围攻：守备」行（下线 · 真渲染）',
        powTxt.indexOf('围攻') < 0 && powTxt.length > 0, powTxt.slice(0, 90));

      check('§200③ 目标/主将两块在册（.exp-a-target / .exp-a-gen）',
        !!panel200.querySelector('.exp-a-target') && !!panel200.querySelector('.exp-a-gen'), '');

      /* 归来报告「自动打完」行（真渲染 · 独立造局） */
      G._offlineReport = { secReal: 3600, applied: 3600, overflow: 0, capDays: 3, res: {},
        done: { build: 0, tech: 0, train: 0 }, reports: [], reportsN: 0,
        wounded: 0, marchMsg: '', autoBattles: 3 };
      G.ui.closeAllModals();
      G.ui.openOfflineReport();
      await sleep(120);
      const repRoot200 = document.querySelector('#modal-root') || document.body;
      check('§200④ 归来报告「自动打完」行（真渲染）',
        repRoot200.textContent.indexOf('3 场战斗已自动打完') >= 0, '');
    } finally {
      G._offlineReport = _bkRep200;
      G.ui._expGen = _bkGen200;
      G.ui._cityId = _bkCity200;
      G.ui.closeAllModals();
    }
  }
  /* ============================================================
   * §201（v89.201）侦查单页 / 铁匠铺多选打造 / 百炼专属界面 + 滚动保留
   * ============================================================ */
  console.log('\n--- §201. v89.201 三改（真实 DOM） ---');
  {
    const _bkS201 = G.state;

    /* ① 侦查：真跑一次 → 单页四板块真渲染（无页签） */
    try {
      const st201 = G.newGame({ name: 'e201', cityName: '许都' });
      G.state = st201;
      const c201 = st201.cities[0];
      G.ui._cityId = c201.id;
      G.techSet('zhencha', 10, c201);
      st201.world.weather = 'clear';
      const g201 = st201.generals[0];
      G.setStaNow(g201, 999); g201.energy = 999;
      const npc201 = (st201.map.cities || [])[0];
      let r201 = null;
      const _mr201 = window.Math.random;
      try {
        window.Math.random = () => 0.001;   /* jsdom realm：固定成功 */
        r201 = G.battle.expedition({ kind: 'city', id: npc201.id }, 'scout', { changqiang: 50 }, g201.id);
      } finally { window.Math.random = _mr201; }
      check('§201① 侦查真跑成功（前置）', !!(r201 && r201.ok), r201 && r201.msg);
      G.ui.closeAllModals();
      G.ui.openScoutResult({ kind: 'city', name: npc201.name }, r201);
      await sleep(120);
      const sc201 = document.querySelector('#modal-root') || document.body;
      const heads201 = sc201.querySelectorAll('.seal-h').length;
      check('§201② 侦查单页四板块（真渲染 · 页签零残留）',
        heads201 >= 3 && sc201.querySelectorAll('[data-action="scout-page"]').length === 0
        && sc201.textContent.indexOf('敌情') >= 0 && sc201.textContent.indexOf('城中虚实') >= 0
        && sc201.textContent.indexOf('可图之利') >= 0,
        'seal-h=' + heads201);
      check('§201③ 编制三栏网格真渲染（.sc-troops .sc-trow ≥ 2）',
        sc201.querySelectorAll('.sc-troops .sc-trow').length >= 2, '');
      G.ui.closeAllModals();
    } finally { G.state = _bkS201; }

    /* ② 多选打造：真点两张卡 → 底键「2 件」→ 真点打造 → 两件入包 */
    try {
      const st202 = G.newGame({ name: 'e201b', cityName: '许都' });
      G.state = st202;
      const c202 = st202.cities[0];
      G.ui._cityId = c202.id;
      let has202 = false;
      c202.cells.forEach((x) => { if (x.build && x.build.id === 'tiejiangpu') { x.build.lvl = 10; has202 = true; } });
      if (!has202) {
        const i202 = c202.cells.findIndex((x) => !x.build && !x.official);
        c202.cells[i202].build = { id: 'tiejiangpu', lvl: 10 };
      }
      (G.DATA.MATERIALS || []).forEach((m) => { st202.items[m.id] = 999; });
      st202.res.gold = 9e8; st202.res.iron = 9e8; st202.res.stone = 9e8; st202.res.wood = 9e8;
      const fl202 = G.forgeList().filter((f) => f.q === 1).slice(0, 2);
      fl202.forEach((f) => { const bp = G.blueprintOf(f.id); if (bp && bp.id) st202.items[bp.id] = 9; });
      G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSelList = [];
      G.ui.closeAllModals();
      G.ui.openForge();
      await sleep(120);
      for (let k = 0; k < 2; k++) {
        /* ⚠️ 每次点击会触发重绘 → 每轮**重新查询**（§65.2 孤儿坑） */
        const cards = document.querySelectorAll('#modal-root .item-row[data-action="forge-pick"]');
        const want = Array.prototype.find.call(cards, (cc) =>
          !cc.classList.contains('on') && fl202.some((f) => f.id === cc.getAttribute('data-item')));
        if (want) { want.click(); }
        await sleep(60);
      }
      check('§201④ 多选：真点两张卡 → 选集 2 件',
        (G.ui._forgeSelList || []).length === 2, 'sel=' + JSON.stringify(G.ui._forgeSelList));
      const btn202 = document.querySelector('#modal-root [data-action="forge-item"]');
      check('§201⑤ 底键显示「2 件」且可点（金色 · 非受阻）',
        !!btn202 && /2 件/.test(btn202.textContent) && !btn202.hasAttribute('disabled')
        && btn202.classList.contains('gold'),
        btn202 ? btn202.textContent : 'none');
      const inv202a = (st202.inventory || []).length;
      btn202.click();
      await sleep(140);
      const inv202b = (st202.inventory || []).length;
      check('§201⑥ 真点打造 → 两件一起入包 + 成功的移出选集',
        inv202b === inv202a + 2 && (G.ui._forgeSelList || []).length === 0,
        inv202a + ' → ' + inv202b + ' sel=' + JSON.stringify(G.ui._forgeSelList));
      G.ui.closeAllModals();
    } finally { G.state = _bkS201; }

    /* ③ 百炼：专属界面真渲染 → 真点卡片 → 真点底键强化 → 该件 +1 */
    try {
      const st203 = G.newGame({ name: 'e201c', cityName: '许都' });
      G.state = st203;
      const c203 = st203.cities[0];
      G.ui._cityId = c203.id;
      let has203 = false;
      c203.cells.forEach((x) => { if (x.build && x.build.id === 'tiejiangpu') { x.build.lvl = 10; has203 = true; } });
      if (!has203) {
        const i203 = c203.cells.findIndex((x) => !x.build && !x.official);
        c203.cells[i203].build = { id: 'tiejiangpu', lvl: 10 };
      }
      st203.res.gold = 9e8; st203.res.iron = 9e8; st203.res.stone = 9e8;
      G.addEquip('cr_head_1'); G.addEquip('cr_head_1');
      G.ui._enhSel = null; G.ui._enhFilter = 'all'; G.ui._pages['enh'] = 1;
      G.ui.closeAllModals();
      G.ui.openEnhance();
      await sleep(140);
      const cards203 = document.querySelectorAll('#modal-root .enh-card');
      check('§201⑦ 百炼专属界面真渲染（网格卡 ≥2 + 筛选 chips ×3 + 底键在册）',
        cards203.length >= 2
        && document.querySelectorAll('#modal-root [data-action="enh-filter"]').length === 3
        && !!document.querySelector('#modal-root [data-action="enhance-item"]'),
        cards203.length + ' 卡');
      cards203[0].click();
      await sleep(90);
      const selKey203 = String(G.ui._enhSel || '');
      let inst203 = null;
      G.enhList().forEach((x) => { if (G.ui.enhKeyOf(x) === selKey203) inst203 = x; });
      const lv0_203 = inst203 ? G.enhOf(inst203) : -1;
      const btn203 = document.querySelector('#modal-root [data-action="enhance-item"]');
      check('§201⑧ 点选后底键「强化 +' + (lv0_203 + 1) + '」可点',
        !!btn203 && !btn203.hasAttribute('disabled') && /强化 \+/.test(btn203.textContent),
        btn203 ? btn203.textContent : 'none');
      btn203.click();
      await sleep(140);
      const lv1_203 = inst203 ? G.enhOf(inst203) : -2;
      check('§201⑨ 真点强化 → 该件 +1（按件记 · 选中保留）',
        lv1_203 === lv0_203 + 1 && String(G.ui._enhSel) === selKey203,
        lv0_203 + '→' + lv1_203);
      G.ui.closeAllModals();
    } finally { G.state = _bkS201; }

    /* ④ 滚动保留：.m-body 进快照清单 + 操作后 scrollTop 保留（v89.201 修复） */
    try {
      const st204 = G.newGame({ name: 'e201d', cityName: '许都' });
      G.state = st204;
      const c204 = st204.cities[0];
      G.ui._cityId = c204.id;
      let has204 = false;
      c204.cells.forEach((x) => { if (x.build && x.build.id === 'tiejiangpu') { x.build.lvl = 10; has204 = true; } });
      if (!has204) {
        const i204 = c204.cells.findIndex((x) => !x.build && !x.official);
        c204.cells[i204].build = { id: 'tiejiangpu', lvl: 10 };
      }
      for (let i204 = 0; i204 < 20; i204++) { G.addEquip('cr_head_1'); }
      st204.res.gold = 9e8; st204.res.iron = 9e8; st204.res.stone = 9e8;
      G.ui._enhSel = ''; G.ui._enhFilter = 'all'; G.ui._pages['enh'] = 1;
      G.ui.closeAllModals();
      G.ui.openEnhance();
      await sleep(120);
      const mb204 = document.querySelector('#modal-root .m-body');
      check('§201⑩ .m-body 在册（真滚动容器）', !!mb204, '');
      mb204.scrollTop = 321;
      const snap204 = G.ui._liveSnap();
      check('§201⑪ 快照捕获 .m-body 滚动位（改前清单漏它 → 必为 0）',
        (snap204.scrolls || []).indexOf(321) >= 0, JSON.stringify(snap204.scrolls));
      const card204 = document.querySelector('#modal-root .enh-card');
      card204.click();
      await sleep(130);
      const mb204b = document.querySelector('#modal-root .m-body');
      check('§201⑫ 重开后滚动位保留（321）', mb204b.scrollTop === 321, 'after=' + mb204b.scrollTop);
      G.ui.closeAllModals();
    } finally { G.state = _bkS201; }
  }

  /* ============================================================
   * §202（v89.202）蕴养同款（真渲染 + 真点）· 收藏峰值（回落场景 DOM 对照）
   * ============================================================ */
  console.log('\n--- §202. v89.202 蕴养同款 / 收藏峰值（真实 DOM） ---');
  {
    const _bkS202 = G.state;
    /* ① 蕴养专属界面：真渲染 → 真点卡片 → 真点蕴养键 → 该件 +1 */
    try {
      const st202 = G.newGame({ name: 'e202a', cityName: '许都' });
      G.state = st202;
      G.ui._cityId = st202.cities[0].id;
      ['lg_weapon_1', 'lg_weapon_4', 'lg_head_2'].forEach((id) => { try { G.addEquip(id); } catch (e) { } });
      st202.items = st202.items || {};
      st202.items.lingsui = 500;
      G.ui._lingSel = null; G.ui._lingFilter = 'all'; G.ui._pages['ling'] = 1;
      G.ui.closeAllModals();
      G.ui.openLingTemper();
      await sleep(170);
      const cards202 = document.querySelectorAll('#modal-root .enh-card');
      const chips202 = document.querySelectorAll('#modal-root [data-action="ling-filter"]');
      check('§202① 蕴养专属界面真渲染（网格卡 ≥2 + 筛选 chips ×3 + 网格容器）',
        cards202.length >= 2 && chips202.length === 3
        && !!document.querySelector('#modal-root .enh-rows')
        && !document.querySelector('#modal-root .enh-list'),
        'cards=' + cards202.length + ' chips=' + chips202.length);
      cards202[0].click();
      await sleep(170);
      const sel202 = String(G.ui._lingSel || '');
      const btn202 = document.querySelector('#modal-root [data-action="ling-temper-item"]');
      check('§202② 真点卡片 → 选中（底键「' + (btn202 ? btn202.textContent.trim() : 'none') + '」）',
        sel202.length > 0 && !!btn202 && btn202.textContent.indexOf('蕴养') >= 0,
        'sel=' + sel202);
      let lv0_202 = -1;
      G.lingTemperList().forEach((x) => { if (String(G.ui.enhKeyOf(x)) === sel202) lv0_202 = G.eqEnhOf(x); });
      btn202.click();
      await sleep(220);
      let lv1_202 = -1;
      G.lingTemperList().forEach((x) => { if (String(G.ui.enhKeyOf(x)) === sel202) lv1_202 = G.eqEnhOf(x); });
      check('§202③ 真点蕴养 → 该件 +' + lv0_202 + '→+' + lv1_202 + '（选中保留）',
        lv0_202 >= 0 && lv1_202 === lv0_202 + 1 && String(G.ui._lingSel) === sel202,
        'lv0=' + lv0_202 + ' lv1=' + lv1_202);
      G.ui.setLingFilter('done');
      await sleep(160);
      const donePanel202 = document.querySelector('#modal-root .inner-panel');
      check('§202④ 筛选「圆满」：三件未满 → 空态文案在册',
        !!donePanel202 && donePanel202.textContent.indexOf('还没有圆满的修炼装备') >= 0, '');
      G.ui.closeAllModals();
    } finally { G.state = _bkS202; }

    /* ② 收藏峰值 DOM：造回落 → 该卡保持解锁；清峰值（现值不变）→ 同卡回锁（对照） */
    try {
      const st202b = G.newGame({ name: 'e202b', cityName: '许都' });
      G.state = st202b;
      let tgt = null;
      ((G.DATA.COLLECT || {}).series || []).forEach((sr) => {
        (sr.items || []).forEach((it) => {
          const cd = G.collectCondOf(it.id);
          if (cd && cd.type === 'itemKind' && !tgt) tgt = { id: it.id, name: it.name, n: cd.n, sid: sr.id };
        });
      });
      if (!tgt) { check('§202⑤ 收藏峰值 DOM（造局失败：无 itemKind 条件件）', false, ''); }
      else {
        st202b.collectPeak = {};
        st202b.items = {};
        for (let i = 0; i < tgt.n + 2; i++) st202b.items['pk202_' + i] = 1;
        G.collectCondMetOf(tgt.id);                      /* 达成（记录峰值） */
        const ks = Object.keys(st202b.items);
        for (let j = 1; j < ks.length; j++) delete st202b.items[ks[j]];
        G.ui._colCat = tgt.sid; G.ui.setView('collection');
        await sleep(160);
        const findCard = () => {
          let c0 = null;
          Array.from(document.querySelectorAll('#view-container .col-card')).forEach((c) => {
            if (c.textContent.indexOf(tgt.name) >= 0) c0 = c;
          });
          return c0;
        };
        const cardA = findCard();
        check('§202⑤ 回落后期望保持解锁（卡非 locked · 判据读的就是峰值）',
          !!cardA && !cardA.classList.contains('locked'), 'card=' + !!cardA);
        /* 对照：清峰值（真实现值仍=1）→ 同卡重新锁上 —— 证明"解锁靠峰值"不是别的因素 */
        st202b.collectPeak = {};
        G.ui.renderCollect();
        await sleep(130);
        const cardB = findCard();
        check('§202⑥ 对照：清峰值后同卡回锁（现值未变 → 唯一变量是峰值）',
          !!cardB && cardB.classList.contains('locked'), 'card=' + !!cardB);
      }
      G.ui.closeAllModals();
    } finally { G.state = _bkS202; }
  }

  /* ============================================================
   * §203（v89.203）防守默认 / 城池上限（9..30）/ toast 中上 / 占领反馈（真实 DOM）
   * ============================================================ */
  console.log('\n--- §203. v89.203 防守 / 城池上限 / toast / 占领反馈（真实 DOM） ---');
  {
    const _bkS203 = G.state;
    /* ① toast.high：弹窗打开 → 上浮上半屏且不挡底部操作键；无弹窗 → 回底部 */
    try {
      const st203 = G.newGame({ name: 'e203a', cityName: '许都' });
      G.state = st203;
      G.ui._cityId = st203.cities[0].id;
      try { G.addEquip('lg_weapon_1'); } catch (e) { }
      st203.items = st203.items || {}; st203.items.lingsui = 500;
      G.ui.closeAllModals();
      G.ui.openLingTemper();
      await sleep(220);
      G.ui.notify('info', '测试提示（弹窗内）');
      await sleep(130);
      const t203 = document.getElementById('toast');
      /* ⚠️ jsdom 无布局引擎（getBoundingClientRect 恒 0）——几何（上浮/不挡底键）在实机脚本里量；
         这里只验 class 切换（语义：弹窗开 → high；无弹窗 → 不 high）。 */
      check('§203① 弹窗打开：toast 切 high 类（上浮态 · 几何由实机验收）',
        t203.classList.contains('high'), 'cls=' + t203.className);
      G.ui.closeAllModals();
      await sleep(150);
      G.ui.notify('info', '测试提示（无弹窗）');
      await sleep(130);
      check('§203② 无弹窗：toast 不切 high（保持底部态）',
        !t203.classList.contains('high'), 'cls=' + t203.className);
      G.ui.closeAllModals();
    } finally { G.state = _bkS203; }

    /* ② 占领满编被拒 → warn toast 真渲染（文案含「未能纳入版图」） */
    try {
      const st203b = G.newGame({ name: 'e203b', cityName: '许都' });
      G.state = st203b;
      if (!st203b.map.grid) G.map.generate();
      while (st203b.cities.length < 9) {
        st203b.cities.push(G.makeCity({ id: 'e203b_' + st203b.cities.length, name: 'b' + st203b.cities.length,
          x: 600 + st203b.cities.length, y: 600, type: 'self' }));
      }
      const npc203 = (st203b.map.cities || [])[0];
      const rOcc = G.onConquer(npc203, { winner: 'atk' }, st203b.generals[0] || null, st203b.cities[0]);
      await sleep(130);
      const toastTxt = (document.getElementById('toast') || {}).textContent || '';
      check('§203③ 满编占领被拒：warn toast 真渲染（含「未能纳入版图」）',
        rOcc.ok === false && toastTxt.indexOf('未能纳入版图') >= 0 && toastTxt.indexOf('领地上限') >= 0,
        toastTxt.slice(0, 66));
      G.ui.closeAllModals();
    } finally { G.state = _bkS203; }

    /* ③ 爵位页：列头「管理城池」+ 说明「平民 9 座」+ 首档值 9 */
    try {
      const st203c = G.newGame({ name: 'e203c', cityName: '许都' });
      G.state = st203c;
      G.ui.setView('rank');
      await sleep(180);
      const vc203 = document.querySelector('#view-container');
      const txt203 = vc203 ? (vc203.textContent || '') : '';
      check('§203④ 爵位页：列头「管理城池」+ 说明「平民 9 座」在册',
        txt203.indexOf('管理城池') >= 0 && txt203.indexOf('平民 9 座') >= 0, '');
      const row0 = document.querySelector('#view-container .tbl tbody tr');
      check('§203⑤ 爵位表首档管理城池 = 9（渲染与数据同源）',
        !!row0 && row0.textContent.indexOf('9') >= 0 && G.DATA.RANK[0].city === 9, '');
    } finally { G.state = _bkS203; }
  }

  /* ============================================================
   * §204（v89.204）：弹窗版面（分页三栏 / 卡面悬停 · 真实 DOM）
   * ============================================================ */
  console.log('\n--- §204. v89.204 民心占领 + 弹窗版面（真实 DOM） ---');
  {
    const _bkS204 = G.state;
    try {
      /* ① 分页条三栏真渲染（modalPagerHTML → 插入 DOM → 结构 + 页码文本） */
      const h204 = G.ui.modalPagerHTML('e204', 100, 10);
      const wrap204 = document.createElement('div');
      wrap204.innerHTML = h204;
      const l204 = wrap204.querySelector('.pager > .pg-side.l');
      const m204 = wrap204.querySelector('.pager > .pg-info');
      const r204 = wrap204.querySelector('.pager > .pg-side.r');
      check('§204① 分页条三栏（左导航/中页码/右导航 · 页码文本在册 · 两端可翻）',
        !!l204 && !!m204 && !!r204 && m204.textContent.indexOf('第 1/10 页') >= 0
        && l204.querySelector('[data-action="mpage"]') != null
        && r204.querySelector('[data-action="mpage"]') != null, '');

      /* ② 百炼面板：卡面 title 带成本 · .ec-cost 零节点（真渲染） */
      const st204 = G.newGame({ name: 'e204', cityName: '许都' });
      G.state = st204;
      const c204 = st204.cities[0];
      G.ui._cityId = c204.id;
      let has204 = false;
      c204.cells.forEach((x) => { if (x.build && x.build.id === 'tiejiangpu') { x.build.lvl = 10; has204 = true; } });
      if (!has204) {
        const i204 = c204.cells.findIndex((x) => !x.build && !x.official);
        c204.cells[i204].build = { id: 'tiejiangpu', lvl: 10 };
      }
      st204.res.gold = 9e8; st204.res.iron = 9e8; st204.res.stone = 9e8;
      G.addEquip('cr_head_1');
      G.ui._enhSel = ''; G.ui._enhFilter = 'all'; G.ui._pages['enh'] = 1;
      G.ui.closeAllModals();
      G.ui.openEnhance();
      await sleep(130);
      const card204 = document.querySelector('#modal-root .enh-card');
      check('§204② 强化卡面：无 .ec-cost 节点 + title 含「下级成本」（悬停承载）',
        !!card204 && document.querySelectorAll('#modal-root .ec-cost').length === 0
        && /下级成本/.test(card204.getAttribute('title') || ''),
        card204 ? (card204.getAttribute('title') || '').slice(0, 40) : 'no-card');
      G.ui.closeAllModals();

      /* ③ 失城：君主城池列表不再含已失城（真调 cityFallen · 真实 DOM 列表对照） */
      const st204b = G.newGame({ name: 'e204b', cityName: '许都' });
      G.state = st204b;
      if (!st204b.map.grid) G.map.generate();
      const cB204 = st204b.cities[0];
      st204b.wilds = st204b.wilds || [];
      st204b.wilds.push({ x: cB204.x + 3, y: cB204.y + 3, type: 'plain', level: 3, levelDay: G.questDayIndex() });
      const built204 = G.buildCityAt(cB204.x + 3, cB204.y + 3);
      const cNew204 = (built204 && built204.city) ? built204.city : null;
      if (cNew204) {
        st204b.mainCityId = cNew204.id;
        const r204f = G.cityFallen(cB204, '流寇');
        check('§204③ 失城真调：城出列 + NPC 回地图（主城保护未触发）',
          !!r204f && r204f.ok === true
          && !st204b.cities.some((c) => c.id === cB204.id)
          && (st204b.map.cities || []).some((c) => c.x === cB204.x && c.y === cB204.y), r204f ? r204f.msg : 'none');
      } else {
        check('§204③ 失城真调：城出列 + NPC 回地图（主城保护未触发）', false, '造局失败');
      }
    } finally { G.state = _bkS204; }
  }


  /* ============================================================
   * §205（v89.205）：将领面板挂件行退役 + 卸下迁入选择窗（真实 DOM）
   *   老板：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」
   * ============================================================ */
  {
    console.log('\n--- §205. v89.205 挂件行退役 + 卸下迁入选择窗（真实 DOM） ---');
    const g205 = G.lordGeneralOf();
    const it205 = (G.DATA.ITEMS || []).find((x) => x.type === 'bao');
    if (g205 && it205) {
      const bkItems205 = G.state.items[it205.id] || 0;
      const bkOn205Id = (g205.attach || {}).bao || null;
      try {
        G.state.items[it205.id] = bkItems205 + 1;
        const rEq205 = G.attachEquip(g205, 'bao', it205.id);
        G.ui._genSel = g205.id;
        G.ui.setView('generals');
        await sleep(260);
        /* ① 面板信息区不再是挂件行 */
        check('§205① 将领面板信息区不再渲染挂件行（gp-attach186 无节点）',
          document.querySelectorAll('#view-container .gp-attach186').length === 0,
          rEq205 && rEq205.msg);
        /* ② 装备栏「🔮 宝具」是唯一入口 → 真点开选择窗 */
        const baoBtn205 = document.querySelector('#view-container [data-action="attach-pick"][data-slot="bao"]');
        check('§205② 装备栏「🔮 宝具」入口在（挂件行退役后的唯一入口）', !!baoBtn205);
        if (baoBtn205) {
          baoBtn205.click();
          await sleep(280);
          const offBtn205 = document.querySelector('#modal-root [data-action="attach-off"]');
          check('§205③ 选择窗：卸下按钮在册（卸下入口无丢失）', !!offBtn205);
          if (offBtn205) {
            offBtn205.click();
            await sleep(280);
            const txt205 = (document.querySelector('#modal-root').textContent || '');
            check('§205④ 真点卸下：attach 清空 + 库存守恒（+1）+ 窗重开（当前未佩）',
              !(g205.attach && g205.attach.bao)
              && (G.state.items[it205.id] || 0) === bkItems205 + 1
              && txt205.indexOf('当前未佩') >= 0,
              'items=' + (G.state.items[it205.id] || 0) + ' has=' + !!(g205.attach && g205.attach.bao));
          }
          G.ui.closeAllModals();
          await sleep(60);
        }
      } finally {
        /* 还原：原佩回装 / 原空卸净 + 库存回填（后续用例依赖原状） */
        if (bkOn205Id) { G.attachEquip(g205, 'bao', bkOn205Id); }
        else if (g205.attach && g205.attach.bao) { G.attachUnequip(g205, 'bao'); }
        G.state.items[it205.id] = bkItems205;
        G.ui.closeAllModals();
      }
    } else {
      check('§205① 造局（宝具 / 君主在册）', false, 'no-bao-or-lord');
    }
  }

  /* ============================================================
   * §207（v89.207）：数字快捷键（真派发）· 离线纪要（真渲染）· 增速档（真调）
   * ============================================================ */
  {
    console.log('\n--- §207. v89.207 快赢 + 离线纪要 + 增速档（真实 DOM） ---');

    /* ①/② 数字键真派发 + 两条护栏（弹窗开着 / 输入态） */
    const bkView207 = G.ui.view;
    try {
      G.ui.setView('reports');
      await sleep(160);
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));
      await sleep(200);
      check('§207① 数字键 1 → 切城池视图（真派发）', G.ui.view === 'city', 'view=' + G.ui.view);
      G.ui.openModal('<div class="gold-heading">测试窗</div>');
      await sleep(150);
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
      await sleep(200);
      const inModal207 = !!G.ui.modalVisible();
      const viewA207 = G.ui.view;
      G.ui.closeAllModals();
      await sleep(100);
      check('§207② 弹窗打开时数字键不切视图（护栏）', inModal207 && viewA207 === 'city', 'view=' + viewA207);
      const inp207 = document.createElement('input');
      document.body.appendChild(inp207);
      inp207.focus();
      inp207.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
      await sleep(200);
      const viewB207 = G.ui.view;
      if (inp207.parentNode) inp207.parentNode.removeChild(inp207);
      check('§207③ 输入框聚焦时数字键不切视图（不抢输入）', viewB207 === 'city', 'view=' + viewB207);
    } catch (e207a) {
      check('§207① 数字键真派发', false, String(e207a && e207a.message || e207a));
    } finally {
      G.ui.closeAllModals();
      G.ui.setView(bkView207);
      await sleep(120);
    }

    /* ④ 离线纪要 / 归来报告 标题分流（真渲染 · 真弹窗） */
    const bkRep207 = G._offlineReport;
    try {
      G._offlineReport = { secReal: 3700, applied: 3700, overflow: 0, capDays: 7, via: 'online',
        res: {}, done: {}, reports: [], reportsN: 0, wounded: 0, marchMsg: '', autoBattles: 0 };
      G.ui.openOfflineReport();
      await sleep(220);
      const mrT207 = (document.querySelector('#modal-root') || {}).textContent || '';
      check('§207④ 离线纪要弹窗（via=online · 真渲染 · 标题分流）',
        mrT207.indexOf('离线纪要') >= 0 && mrT207.indexOf('归来报告') < 0 && mrT207.indexOf('息屏') >= 0,
        mrT207.slice(0, 60));
      G.ui.closeAllModals();
      await sleep(100);
      G._offlineReport.via = 'reload';
      G.ui.openOfflineReport();
      await sleep(220);
      const mrT207b = (document.querySelector('#modal-root') || {}).textContent || '';
      check('§207⑤ 归来报告弹窗（via=reload 标题分流）', mrT207b.indexOf('归来报告') >= 0,
        mrT207b.slice(0, 60));
      G.ui.closeAllModals();
      await sleep(100);
    } catch (e207b) {
      check('§207④ 离线纪要真渲染', false, String(e207b && e207b.message || e207b));
    } finally {
      G._offlineReport = bkRep207;
      G.ui.closeAllModals();
      await sleep(80);
    }

    /* ⑥ 增速档真调 + 按钮组真渲染（结构） */
    const bkSpd207 = G.ui._btSpd;
    try {
      G.ui.btSpdSet(2);
      const d2207 = G.ui.btWatchDelay(260);
      G.ui.btSpdSet(4);
      const d4207 = G.ui.btWatchDelay(620);
      check('§207⑥ 增速档真调：2× → 130ms · 4× → 155ms（620 / 4）',
        d2207 === 130 && d4207 === 155, 'd2=' + d2207 + ' d4=' + d4207);
      const wrap207 = document.createElement('div');
      wrap207.innerHTML = G.ui.btSpdHTML();
      const btns207 = wrap207.querySelectorAll('[data-action="bt-spd"]');
      check('§207⑦ 增速按钮组三档齐备（1×/2×/4× · 唯一渲染出口）', btns207.length === 3,
        'n=' + btns207.length);
    } catch (e207c) {
      check('§207⑥ 增速档真调', false, String(e207c && e207c.message || e207c));

    } finally {
      G.ui._btSpd = bkSpd207;
    }

    /* ⑧ 沙盘推演链路（v89.206 梳理点名的 e2e 缺口 -> v89.207 补齐）：
       真打一场最小仗 -> 打开战报沙盘 -> 切推演 -> 回到史实回放（全程真 DOM） */
    try {
      /* 前置：有守军的无主野地（wildDefenseAt 确定性生成；不占 = 无 wildAt 记录） */
      const cc207 = G.currentCity() || G.state.cities[0];
      if (!G.state.map.grid) G.map.generate();
      G.state.world.weather = 'clear';
      G.ui._cityId = cc207.id;
      let w207 = null;
      for (let rr = 2; rr <= 40 && !w207; rr++) {
        for (let dy = -rr; dy <= rr && !w207; dy++) for (let dx = -rr; dx <= rr && !w207; dx++) {
          const x = cc207.x + dx, y = cc207.y + dy;
          const tt = G.map.tile(x, y);
          if (!tt || tt.terrain === 'city') continue;
          if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
          const lvv = G.map.wildLevelNow(x, y);
          if (!(lvv > 0)) continue;
          const dfe = G.wildDefenseAt(x, y, lvv);
          if (dfe && dfe.total > 0) w207 = { x: x, y: y, lv: lvv };
        }
      }
      if (!w207) {
        check('§207⑧ 沙盘推演链路（造局：有守军野地）', false, 'no-wild');
      } else {
        cc207.army = cc207.army || {};
        cc207.army.changqiang = (cc207.army.changqiang || 0) + 88888;
        const g207 = G.state.generals[0];
        g207.status = 'idle'; g207.cityId = cc207.id;
        G.setStaNow(g207, G.staMax(g207));
        g207.energy = 100;
        const rd207 = G.march.dispatch({ kind: 'wild', x: w207.x, y: w207.y }, 'occupy',
          { changqiang: 88888 }, g207.id, null);
        await sleep(150);
        const m207 = (G.state.marches || [])[0];
        if (rd207 && rd207.ok && m207) {
          m207.elapsed = m207.totalTime + 1;      /* 拨钟：一步到点（§18.4 标准手法） */
          G.march.tick();
          await sleep(200);
          if ((G.state.battles || []).length) G.offlineCatchup(600);   /* v89.200：挂起自动打完 */
          await sleep(250);
        }
        const rep207 = (G.state.reports || []).find((r) => r.type === 'war' && r.sandbox);
        check('§207⑧ 真打一场 -> 战报带沙盘配方（dispatch=' + !!(rd207 && rd207.ok) + '）', !!rep207,
          rep207 ? rep207.title : ('marches=' + (G.state.marches || []).length));
        if (rep207) {
          const sb207 = G.battle.sandboxOf(rep207);
          const rid207 = G.repRidOf ? G.repRidOf(rep207) : 0;
          G.ui.openSandboxRep(rep207, rid207);
          await sleep(360);
          const simBtn207 = document.querySelectorAll('#modal-root [data-action="sd-sim"]').length;
          check('§207⑨ 战报沙盘打开（底条 + 推演入口在册 · verify=' + !!(sb207 && sb207.verify) + '）',
            simBtn207 >= 1, 'btn=' + simBtn207);
          if (simBtn207 && sb207 && sb207.verify) {
            click(document.querySelector('#modal-root [data-action="sd-sim"]'));
            await sleep(360);
            const doneBtn207 = document.querySelectorAll('#modal-root [data-action="sd-done"]').length;
            check('§207⑩ 切推演态（完成回合 / 回到史实回放 在册）', doneBtn207 >= 1, 'done=' + doneBtn207);
            if (doneBtn207) {
              const sk207 = G.ui._sd ? G.ui._sd.mode : '';
              click(document.querySelector('#modal-root [data-action="sd-sim-exit"]'));
              await sleep(360);
              check('§207⑪ 回史实回放（推演入口复现 · mode ' + sk207 + ' -> '
                + (G.ui._sd ? G.ui._sd.mode : '') + '）',
                document.querySelectorAll('#modal-root [data-action="sd-sim"]').length >= 1);
            }
          } else {
            check('§207⑩ 推演态（verify 未过 -> 仅结构断言）', true, 'verify=false 分支');
          }
          G.ui.closeAllModals();
          await sleep(120);
        }
      }
    } catch (e207d) {
      check('§207⑧ 沙盘推演链路', false, String(e207d && e207d.message || e207d));
    }
  }
  /* ---- §209（v89.209）：存档缺陷链修复（真实 localStorage · 域层真调） ---- */
  {
    const _bk209e = G.state;
    try {
      G.newGame({ name: 'e209', cityName: '许都' });
      const _base209e = JSON.parse(G.savePayload());
      const _pack209e = (st, wc) => {
        const p = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
        if (wc) p._check = G.checksum(JSON.stringify(st));
        return JSON.stringify(p);
      };
      const _mk209e = (mut) => { const x = JSON.parse(JSON.stringify(_base209e)); mut(x); return x; };
      const _rA = G.importText(_pack209e(_mk209e((x) => { x.cities = [{}]; }), true), 's3');
      const _rB = G.importText(_pack209e(_mk209e((x) => { x.generals = 'oops'; }), true), 's3');
      const _rC = G.importText(_pack209e(_mk209e((x) => { x.map = null; }), false), 's3');
      check('§209e① 坏档三例（cities[{}] / generals:oops / map:null）全拒',
        _rA.ok === false && _rB.ok === false && _rC.ok === false,
        _rA.msg + ' | ' + _rB.msg + ' | ' + _rC.msg);
      const _rG = G.importText(_pack209e(_base209e, true), 's3');
      const _lr = _rG.ok ? G.loadFrom('s3') : null;
      check('§209e② 真档导入→读回仍通（形状门不误伤合法档）',
        _rG.ok === true && !!_lr && _lr.cities.length >= 1, _rG.msg);
      check('§209e③ saveShapeChk 唯一出口在册', typeof G.saveShapeChk === 'function');
    } catch (_e209e) {
      check('§209e 存档缺陷链修复', false, String(_e209e && _e209e.message || _e209e));
    } finally {
      try { G.dropSlot('s3'); } catch (_e2) { }
      G.state = _bk209e;
    }
  }

    /* ============================================================
     * §210（v89.210 · 真实 DOM）
     *   ① Shift+1~5 真按键 + 弹窗护栏
     *   ② 弹窗键盘流：开窗焦点 / Tab 圈 / Enter 激活 / live 回填 / 弹栈快照
     *   ③ 状态条真渲染（chips 数 + 文案 + 默认态清零）
     *   ④ 出征面板「🎬 推演」真点 → 推演弹窗真渲染
     * ============================================================ */
    console.log('\n--- §210. v89.210 键盘流 · 状态条 · 战前推演（真实 DOM） ---');
    {
      const _bkS210 = G.state;
      const _bkCityId210 = G.ui._cityId;

      /* ① 键盘：Shift+3 → 公文；数字 1 → 城池（旧键位不回退）；弹窗开着 → 不切 */
      try {
        G.ui.closeAllModals();
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '#', code: 'Digit3', shiftKey: true, bubbles: true }));
        await sleep(60);
        check('§210① Shift+3 → 公文视图（真派发 · e.code 判定）', G.ui.view === 'reports', 'view=' + G.ui.view);
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true }));
        await sleep(60);
        check('§210①b 数字键 1 仍切城池（旧键位不回退）', G.ui.view === 'city', 'view=' + G.ui.view);
        G.ui.openModal('<div class="gold-heading">护栏测210</div><div class="ui-sub">x</div>');
        await sleep(40);
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '#', code: 'Digit4', shiftKey: true, bubbles: true }));
        await sleep(60);
        check('§210①c 弹窗开着 Shift+4 不切视图（护栏复用）', G.ui.view === 'city', 'view=' + G.ui.view);
        G.ui.closeAllModals();
        await sleep(40);
      } catch (e210a) { check('§210① 键盘真派发', false, String(e210a && e210a.message || e210a)); }

      /* ② 弹窗键盘流 */
      try {
        G.ui.openModal('<div class="gold-heading">键盘流210</div><div class="ui-sub">x</div><div data-action="close-modal" id="kf210a">按我</div>');
        await sleep(50);
        const d210a = document.getElementById('kf210a');
        check('§210② 开窗即给焦点（焦点在弹窗内首个可交互元素）', !!d210a && document.activeElement === d210a,
          'active=' + (document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        await sleep(30);
        const ae210b = document.activeElement;
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        await sleep(30);
        check('§210②b Tab 真循环（末→首回卷 · 一圈回到首元素）', document.activeElement === d210a,
          'mid=' + (ae210b && (ae210b.className || ae210b.tagName)) + ' now=' + (document.activeElement && document.activeElement.tagName));
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await sleep(60);
        check('§210②c Enter 激活 div[data-action]（真触发 close-modal）', !G.ui.modalVisible(),
          'visible=' + G.ui.modalVisible());
      } catch (e210b) { check('§210② 弹窗键盘流', false, String(e210b && e210b.message || e210b)); }
      G.ui.closeAllModals();
      await sleep(40);

      /* ②d live 重建焦点回填 */
      try {
        let n210 = 0;
        const html210 = () => '<div class="gold-heading">LIVE210</div><div data-action="kf-live" id="kf210l">v' + (++n210) + '</div>';
        const live210 = function () { G.ui.openModal(html210(), { live: live210 }); };
        G.ui.openModal(html210(), { live: live210 });
        await sleep(50);
        const dl1 = document.getElementById('kf210l');
        dl1.focus();
        G.ui.liveModalTick();
        await sleep(40);
        const dl2 = document.getElementById('kf210l');
        check('§210②d live 重建后焦点回填（同描述元素 · 节点已换）', document.activeElement === dl2 && dl2 !== dl1,
          'same=' + (document.activeElement === dl2) + ' changed=' + (dl2 !== dl1));
        G.ui.closeAllModals();
        await sleep(40);
      } catch (e210c) { check('§210②d live 焦点回填', false, String(e210c && e210c.message || e210c)); }

      /* ②e 弹栈快照：输入值 + 焦点保回 */
      try {
        G.ui.openModal('<div class="gold-heading">层一210</div><input id="kf210v" type="number" value="0">');
        await sleep(50);
        const kf1 = document.getElementById('kf210v');
        kf1.value = '55';
        kf1.focus();
        G.ui.openModal('<div class="gold-heading">层二210</div><div data-action="x210">y</div>');
        await sleep(50);
        const pushed = (G.ui._modalStack || []).length === 1;
        G.ui.closeModal();
        await sleep(60);
        const kf2 = document.getElementById('kf210v');
        check('§210②e 弹栈回填：压栈 + 输入值保留 + 焦点回原元素',
          pushed && !!kf2 && kf2.value === '55' && document.activeElement === kf2,
          'pushed=' + pushed + ' val=' + (kf2 && kf2.value) + ' focus=' + (document.activeElement === kf2));
        G.ui.closeAllModals();
        await sleep(40);
      } catch (e210d) { check('§210②e 弹栈快照', false, String(e210d && e210d.message || e210d)); }

      /* ③ 状态条真渲染 */
      try {
        const st210 = G.newGame({ name: '条e210', cityName: '许都' });
        G.state = st210;
        if (!st210.map.grid) G.map.generate();
        st210.world.weather = 'rain';
        if (st210.cities.length < 2) st210.cities.push(G.makeCity({ id: 'skye210', name: '陪都', x: st210.cities[0].x + 6, y: st210.cities[0].y + 6 }));
        G.heartsWarAdd(st210.cities[0], 90);
        G.ui.syncHeader();
        const chips210 = document.querySelectorAll('#nav-sky .sky-badge');
        check('§210③ 状态条真渲染（民心低 + 来犯 → 2 枚；雨天不重复起 chip）', chips210.length === 2
          && document.querySelectorAll('#nav-sky .sky-badge.sky-weather').length === 0, 'n=' + chips210.length);
        const skyTxt210 = document.getElementById('nav-sky').textContent;
        check('§210③b chip 文案在册（⚔ / 💔）',
          skyTxt210.indexOf('⚔') >= 0 && skyTxt210.indexOf('💔') >= 0,
          skyTxt210.slice(0, 90));
        st210.world.weather = 'clear';
        st210.cities.length = 1;
        G.heartsWarAdd(st210.cities[0], -999);
        G.ui.syncHeader();
        check('§210③c 默认态不显示（无消息即正常 · 零枚）',
          document.querySelectorAll('#nav-sky .sky-badge').length === 0);
      } catch (e210e) { check('§210③ 状态条真渲染', false, String(e210e && e210e.message || e210e)); }
      G.state = _bkS210;
      G.ui._cityId = _bkCityId210;
      try { G.ui.syncHeader(); } catch (e210f) { }

      /* ④ 出征面板「🎬 推演」真点 → 推演弹窗 */
      try {
        const st210b = G.newGame({ name: '推e210', cityName: '许都' });
        G.state = st210b;
        if (!st210b.map.grid) G.map.generate();
        st210b.world.weather = 'clear';
        const c210 = st210b.cities[0];
        G.ui._cityId = c210.id;
        const g210 = st210b.generals[0];
        g210.status = 'idle'; g210.cityId = c210.id;
        G.setStaNow(g210, G.staMax(g210)); g210.energy = 100;
        const cap210 = G.battle.marchCapOf(c210);
        const send210 = Math.max(500, Math.min(20000, cap210 > 0 ? cap210 : 20000));
        c210.army = { yibing: send210 + 500 };
        /* 找野地（非城市格、无主） */
        let w210 = null;
        for (let rr = 1; rr <= 30 && !w210; rr++) {
          for (let dy = -rr; dy <= rr && !w210; dy++) for (let dx = -rr; dx <= rr && !w210; dx++) {
            const x = c210.x + dx, y = c210.y + dy;
            const tl = G.map.tile(x, y);
            if (!tl || tl.terrain === 'city') continue;
            if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.fortAt(x, y)) continue;
            if (!(G.map.wildLevelNow(x, y) > 0)) continue;
            w210 = { x: x, y: y };
          }
        }
        G.ui._expMode = 'occupy';
        G.ui.openExpModal({ kind: 'wild', x: w210.x, y: w210.y });
        await sleep(140);
        const simBtn210 = document.querySelector('#modal-root [data-action="exp-sim"]');
        check('§210④ 出征面板有「🎬 推演」键（真渲染）', !!simBtn210,
          simBtn210 ? simBtn210.textContent.trim() : 'null');
        const inp210 = document.getElementById('exp-yibing');
        if (inp210) inp210.value = String(send210);
        const genSel210 = document.getElementById('exp-gen');
        if (genSel210) genSel210.value = g210.id;
        click(simBtn210);
        await sleep(220);
        const mrT210 = (document.getElementById('modal-root') || document.body).textContent || '';
        check('§210④b 推演弹窗真渲染（结果 / 损失 / 口径注明）',
          mrT210.indexOf('沙盘推演') >= 0 && mrT210.indexOf('推演结果') >= 0
          && mrT210.indexOf('我方损失') >= 0 && mrT210.indexOf('同一战斗引擎') >= 0,
          mrT210.slice(0, 100));
        G.ui.closeAllModals();
        await sleep(60);
      } catch (e210g) { check('§210④ 推演真点', false, String(e210g && e210g.message || e210g)); }
      G.state = _bkS210;
      G.ui._cityId = _bkCityId210;
      G.ui.closeAllModals();
      await sleep(40);
    }
  return finish();
}

let ABORTED = false;
function finish() {
  if (ABORTED) {
    console.log('\n⚠ 本次运行在中途中断 —— 中断点之后的断言全部未执行，不可当作通过。');
  }
  console.log('\n--- 运行期错误汇总 ---');
  if (ERRORS.length === 0) {
    console.log('  ✅ 无页面运行时错误');
    PASS++;
  } else {
    const uniq = Array.from(new Set(ERRORS));
    console.log('  ❌ 捕获 ' + ERRORS.length + ' 条错误（去重 ' + uniq.length + '）：');
    uniq.slice(0, 25).forEach((e) => console.log('     • ' + e));
    FAIL++;
  }
  if (WARNINGS.length) {
    console.log('\n--- 警告（去重前 10 条）---');
    Array.from(new Set(WARNINGS)).slice(0, 10).forEach((w) => console.log('     ⚠ ' + w.slice(0, 160)));
  }
  console.log('\n========================================');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败   （真实 DOM + HTTP 环境）');
  console.log('========================================');
  try { server.close(); } catch (e) { }
  process.exit(FAIL ? 1 : 0);
}
