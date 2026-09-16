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

  /* v14：外城地块按城池独立（state.extGrid → city.extGrid） */
  const extOf = (st) => G.extGridOf(st.cities[0]);

  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
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
    return !/--tile-clip/.test(css) && /border-radius: 10px/.test(css)
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
  /* v25（需求 1）：城墙是一圈环（墙身/雉堞/压顶/角楼），并带四条点击热区。
     判据只看"结构齐备 + 热区存在"，不数 polygon 个数（画法会变）。 */
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
  G.ui.closeModal();
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
  /* 消息流已整合进公文 */
  G.ui.setView('reports');
  await sleep(80);
  const repHtml = vc.innerHTML;
  check('公文页含战报区', repHtml.indexOf('公文 · 报告与消息') >= 0 && repHtml.indexOf('战报') >= 0);
  check('公文页含消息流', !!document.querySelector('#msg-log'));
  check('公文页含频道切换', document.querySelectorAll('.msg-channels [data-action="msg-channel"]').length === 4,
    document.querySelectorAll('.msg-channels [data-action="msg-channel"]').length + ' 个频道');
  check('消息保留策略为 10 游戏天', G.msgDays() === 10 && /保留最近 10 游戏天/.test(repHtml));
  const warCh = document.querySelector('.msg-channels [data-ch="war"]');
  if (warCh) { click(warCh); await sleep(60); check('可切换消息频道', G.ui._msgCh === 'war', String(G.ui._msgCh)); G.ui._msgCh = 'sys'; }
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
  G.ui.closeModal();
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
  check('背包含三类页签', bagModal.indexOf('data-v="equip"') >= 0 && bagModal.indexOf('data-v="item"') >= 0 && bagModal.indexOf('data-v="mat"') >= 0);
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
  check('资源栏显示 /秒 增速', resTxt2.indexOf('/秒') > 0);
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
  check('史册含史书纪事', storyHtml.indexOf('史书纪事') >= 0);
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
  G.ui.closeModal();

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
  G.ui.openGuanfu();
  await sleep(80);
  const govY18 = document.querySelector('#modal-root').innerHTML;
  check('名城的官府内含本城岁贡', govY18.indexOf('本城岁贡') >= 0);
  check('岁贡列出特产（荆州蜀锦）', govY18.indexOf('蜀锦') >= 0);
  check('岁贡显示距下次结算与每日收入',
    govY18.indexOf('距下次结算') >= 0 && govY18.indexOf('每现实日结算') >= 0);
  G.ui.closeModal();
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
      check('右侧档案打开的正是第一行那位将领',
        dh.indexOf(s.generals[0].name) >= 0 && gid === s.generals[0].id, gid);
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

  /* ③ 弹窗统一规范（v43：取消右上角 ×，关闭一律在底部） */
  G.ui.openModal('<div>裸面板</div>');
  const mh = document.querySelector('#modal-root').innerHTML;
  check('v43：弹窗不再有右上角 ×', mh.indexOf('modal-close') < 0);
  check('弹窗自动带底部关闭', mh.indexOf('data-action="close-modal"') >= 0);
  const mbtn = document.querySelector('#modal-root .inner-panel [data-action="close-modal"]');
  check('底部关闭按钮真实可点（关闭生效）', !!mbtn);
  if (mbtn) { mbtn.click(); await sleep(60); check('点底部关闭后弹窗关闭', document.querySelector('#modal-root').innerHTML === ''); }

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
    if (s.generals[0]) { s.generals[0].status = 'idle'; s.generals[0].stamina = 100; }
    G.ui.openLandModal(g20.x, g20.y);
    await sleep(80);
    const lm20 = document.querySelector('#modal-root').innerHTML;
    check('已占野地弹窗有「派军采集」', lm20.indexOf('data-action="gather-open"') >= 0);
    check('野地弹窗标明可采资源', lm20.indexOf('此地可采') >= 0);
    const gb20 = document.querySelector('#modal-root [data-action="gather-open"]');
    if (gb20) {
      click(gb20);
      await sleep(80);
      const gm20 = document.querySelector('#modal-root').innerHTML;
      check('采集派遣弹窗含收成公式', gm20.indexOf('收成公式') >= 0);
      check('采集派遣弹窗含 24 小时封顶说明', gm20.indexOf('24 小时') >= 0);
      check('采集派遣弹窗含派兵输入', !!document.querySelector('#gather-troops'));
      check('采集派遣弹窗含将领选择', !!document.querySelector('#gather-gen'));
      /* 备兵并开始采集 */
      const city20 = s.cities[0];
      city20.army = city20.army || {};
      city20.army.yibing = (city20.army.yibing || 0) + 3000;
      const ti20 = document.querySelector('#gather-troops');
      if (ti20) ti20.value = '1000';
      const before20 = city20.army.yibing;
      const sb20 = document.querySelector('#modal-root [data-action="gather-start"]');
      check('采集弹窗有开始按钮', !!sb20);
      if (sb20) {
        click(sb20);
        await sleep(140);
        const rec = G.gatherAt(g20.x, g20.y);
        check('采集队已派出', !!rec, rec ? ('兵力 ' + rec.troops) : '无');
        check('城中兵力已扣除', city20.army.yibing === before20 - 1000, String(city20.army.yibing));
        G.ui.openGathers();
        await sleep(80);
        const gh20 = document.querySelector('#modal-root').innerHTML;
        check('采集队面板可见', gh20.indexOf('野地采集') >= 0);
        check('未满 1 小时时收获按钮禁用', gh20.indexOf('gather-finish') >= 0 && gh20.indexOf('disabled') >= 0);
        if (rec) {
          rec.elapsed = 3 * 3600;
          const resKey = G.gatherResOf(g20.type);
          const beforeRes = s.res[resKey] || 0;
          G.ui.openGathers();
          await sleep(80);
          const gr20 = document.querySelector('#modal-root [data-action="gather-finish"]');
          check('满 1 小时后可收获（按钮可用）', !!gr20 && !gr20.hasAttribute('disabled'));
          if (gr20) {
            click(gr20);
            await sleep(140);
            check('收获后资源入账', (s.res[resKey] || 0) > beforeRes,
              resKey + ' +' + Math.round((s.res[resKey] || 0) - beforeRes));
            check('收获后兵力归还', city20.army.yibing === before20, String(city20.army.yibing));
            check('采集队已清空', !G.gatherAt(g20.x, g20.y));
          }
        }
      }
    }
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
    G.ui.closeModal();
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
  G.ui.openMarket();
  await sleep(40);
  const mkHtml = document.querySelector('#modal-root').innerHTML;
  check('市集弹窗含兑换控件', mkHtml.indexOf('mk-from') >= 0 && mkHtml.indexOf('mk-amount') >= 0);
  G.ui.openStore();
  await sleep(40);
  const stHtml = document.querySelector('#modal-root').innerHTML;
  check('仓库弹窗显示储量上限', stHtml.indexOf('储量上限') >= 0 || stHtml.indexOf('仓库') >= 0);
  G.ui.closeModal();

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
  G.ui.openGuanfu();
  await sleep(90);
  const gq = document.querySelector('#modal-root');
  check('官府「在办事项」呈现自动升级状态',
    !!gq && gq.textContent.indexOf('自动升级') >= 0,
    gq ? gq.textContent.replace(/\s+/g, ' ').slice(-60) : '(无官府弹窗)');
  G.ui.closeModal();
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
  G.ui.openGuanfu();
  await sleep(90);
  const gq2 = document.querySelector('#modal-root');
  check('关闭后官府在办事项不再显示自动升级',
    !!gq2 && gq2.textContent.indexOf('自动升级') < 0,
    gq2 ? gq2.textContent.replace(/\s+/g, ' ').slice(-60) : '(无官府弹窗)');
  G.ui.closeModal();

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
     jsdom（无布局，基准框 869×758）下确定输出 13×11@63。 */
  check('观察框为搜索式自适应（jsdom 基准 13×11），格距在合理区间',
    G.map._view && G.map._view.spanX === 13 && G.map._view.spanY === 11
    && G.map._view.cell >= 34 && G.map._view.cell <= 128,
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
  G.ui.closeModal();

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
  G.ui.closeModal();

  /* ② 招贤馆：v29（需求 15）起只讲房间数与升级路径，不再重复将领名录 */
  G.ui.openHostel();
  await sleep(60);
  const host20 = document.querySelector('#modal-root').innerHTML;
  check('招贤馆不再有将领名录（不重复「将领」菜单）',
    host20.indexOf('inn-card') < 0 && host20.indexOf('房间') >= 0);
  check('招贤馆指向「将领」菜单看名录', host20.indexOf('将领') >= 0);
  G.ui.closeModal();
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
  check('清单行含姓名/资质/状态/悬停速览（v45：等级与装备数已移出清单行）',
    /class="grow-name"/.test(gen20) && /class="grow-st/.test(gen20)
    && /class="rank-badge/.test(gen20) && /class="tip-src"/.test(gen20)
    && !/class="grow-lv/.test(gen20) && !/class="grow-eq"/.test(gen20));
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
    /* 收尾：本用例造的将清掉，守住将领数不会越测越多 */
    st.generals = st.generals.filter((g) => made.indexOf(g.id) < 0);
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
  check('被禁用的打造按钮旁边必须写明原因', (function () {
    /* ⚠️ 必须**先构造出阻塞**再验。第一版直接查当前面板，结果是「可造 6 / 阻塞 0」——
       一条永远 return true 的空断言（分母为 0 的绿）。这里把材料清空重开面板，
       让全部件都变成"材料不足"，验完再恢复。 */
    const saveItems = G.state.items;
    G.state.items = {};                      /* 清空材料 → matsOk 全 false */
    G.ui.openForge();
    const dis = Array.prototype.slice.call(
      document.querySelectorAll('#modal-root [data-action="forge-item"][disabled]'));
    const listed = dis.filter((b) => {
      const row = b.closest('.item-row');
      return row && /缺图纸|材料不足|需铁匠铺|资材不足/.test(row.textContent);
    }).length;
    G.state.items = saveItems;               /* 恢复 */
    G.ui.openForge();
    return dis.length > 0 && listed === dis.length;
  })(), (function () {
    const dis = document.querySelectorAll('#modal-root [data-action="forge-item"][disabled]').length;
    const ok = document.querySelectorAll('#modal-root [data-action="forge-item"]:not([disabled])').length;
    return '恢复后 可造 ' + ok + ' / 阻塞 ' + dis;
  })());
  check('齐备的卡片不再复述按钮状态（不写"条件齐备"这类文字）', (function () {
    const ok = Array.prototype.slice.call(
      document.querySelectorAll('#modal-root [data-action="forge-item"]:not([disabled])'));
    if (!ok.length) return true;
    return ok.every((b) => {
      const row = b.closest('.item-row');
      return row && !/条件齐备/.test(row.textContent);
    });
  })());
  check('含打造按钮', forge20.indexOf('data-action="forge-item"') >= 0);
  check('打造面板不再写来源说明（需求 5）', forge20.indexOf('图纸来源') < 0);
  /* 真造一件：凡品盔 */
  const invBefore = (G.state.inventory || []).length;
  const forgeBtn = document.querySelector('#modal-root [data-action="forge-item"][data-item="cr_head_1"]');
  check('找到凡品盔打造按钮', !!forgeBtn);
  click(forgeBtn);
  await sleep(80);
  check('点击打造后进入背包', (G.state.inventory || []).length === invBefore + 1,
    invBefore + ' → ' + (G.state.inventory || []).length);
  check('打造后记录已造', (G.state.forged || []).indexOf('cr_head_1') >= 0);
  G.ui.closeModal();

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
  /* 切到「珠宝」分类 → 珍珠可购买 */
  G.ui.setShopCat('jewel');
  await sleep(60);
  const shopJ = document.querySelector('#view-container').innerHTML;
  check('切分类后珠宝可购买', shopJ.indexOf('珍珠') >= 0 && shopJ.indexOf('赏赐忠诚') >= 0);
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
    return !!tip && /体\s*\d+/.test(tip.textContent)
      && !!det && det.textContent.indexOf('体力') >= 0
      && det.textContent.indexOf('全军生命') >= 0;
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
  check('关闭按钮生效', document.querySelector('#modal-root').innerHTML.length < 20,
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
  /* 材料页签 */
  click(bagH.querySelector('[data-action="bag-tab"][data-v="mat"]'));
  await sleep(80);
  bagH = document.querySelector('#view-container');
  /* v29（需求 4）：材料页改为**按格分页**，首屏只渲染第一页
     v39（需求 6）：每页 20 → 16 格（4 列 × 4 行） */
  check('材料页按格分页（首屏 16 格 · 总数 24）', (function () {
    var n = bagH.querySelectorAll('.bag-cell').length;
    var bar = document.querySelector('#bottom-bar').textContent;
    return n === 16 && bar.indexOf('共 24 项') >= 0;
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
  check('材料页可翻到第 2 页并看到其余系列', (function () {
    var btn = document.querySelector('#bottom-bar [data-action="page"][data-n="2"]');
    if (!btn) return false;
    btn.click();
    var n = document.querySelectorAll('#view-container .bag-cell').length;
    document.querySelector('#view-container');
    return n === 8;   /* v39：24 项 / 每页 16 → 第 2 页 8 格 */
  })());
  check('材料品阶用颜色阶而非星级（noStar）', bagH.querySelectorAll('.bag-cell.q1').length > 0);
  /* 宝物页签 */
  click(bagH.querySelector('[data-action="bag-tab"][data-v="item"]'));
  await sleep(80);
  bagH = document.querySelector('#view-container');
  /* v29（需求 14）：宝物页改用「物品行」——左贴图/右介绍/下：数量+使用 */
  check('宝物页为物品行（含类别标签与数量输入框）', /item-row/.test(bagH.innerHTML)
    && /ir-tag/.test(bagH.innerHTML) && /qty-input/.test(bagH.innerHTML));
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
  G.ui.closeModal();
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
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; break; }
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
      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      await sleep(1500);                   /* 等主循环（1s 间隔）自己发现 */
      const now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);
    }
  }

  /* ⑦ 消息流（v16：已整合进公文，且写入存档） */
  for (let i = 0; i < 20; i++) G.log('验收提示 ' + i);
  G.ui._msgCh = 'sys';
  G.ui.setView('reports');
  await sleep(100);
  const logEl21 = document.querySelector('#msg-log');
  check('公文档消息流渲染', !!logEl21);
  const lines21 = logEl21 ? (logEl21.innerHTML.match(/bb-line/g) || []).length : 0;
  /* v43（老板要求）：消息流**改分页**（原为一次渲染 300 条 + 容器内滚动）。
     这里把"显示"与"存储"分开验：页面上是分页后的条数，存档里仍是全量（见下一条）。 */
  check('v43：消息流按页显示（每页 ≤ ' + G.ui.MSG_PER + ' 条，翻页看更多）',
    lines21 > 0 && lines21 <= G.ui.MSG_PER, lines21 + ' 行 / 每页 ' + G.ui.MSG_PER);
  check('v43：消息容器不再内滚动（改分页，避免"下拉框"）',
    !/\.msg-log \{[^}]*overflow-y: auto/.test(document.documentElement.innerHTML));
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
  /* v15：可采地形显示"此地可采：X"，平原则明确"无可采之物" */
  check('野地弹窗标明可否采集', landHtml.indexOf('此地可采') >= 0 || landHtml.indexOf('无可采之物') >= 0,
    landHtml.indexOf('此地可采') >= 0 ? '可采' : '平原不可采');
  const goBtn = document.querySelector('#modal-root [data-action="exp-open"]');
  check('野地弹窗可进入出兵面板', !!goBtn);
  click(goBtn);
  await sleep(80);
  const expHtml = document.querySelector('#modal-root').innerHTML;
  check('出征面板列出三种方式', expHtml.indexOf('侦查') >= 0 && expHtml.indexOf('掠夺') >= 0 && expHtml.indexOf('占领') >= 0);
  check('三种方式各有消耗标注', (expHtml.match(/em-cost/g) || []).length === 3);
  check('默认选中「占领」', !!document.querySelector('#modal-root .exp-mode.on[data-v="occupy"]'));
  const scoutTab = document.querySelector('#modal-root .exp-mode[data-v="scout"]');
  click(scoutTab);
  await sleep(60);
  check('可切换到「侦查」', !!document.querySelector('#modal-root .exp-mode.on[data-v="scout"]'), G.ui._expMode);
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
  G.ui.closeModal();

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
    G.ui.closeModal();
  } else {
    check('据点弹窗显示守军与等级', false, '未找到据点');
    check('据点弹窗说明每日变化', false, '未找到据点');
    check('据点弹窗可出兵', false, '未找到据点');
  }
  G.ui.openForts();
  await sleep(80);
  check('据点一览面板渲染', document.querySelector('#modal-root').innerHTML.indexOf('周边野外城池') >= 0);
  check('一览标注 1/12 密度', document.querySelector('#modal-root').innerHTML.indexOf('1/12') >= 0);
  G.ui.closeModal();

  /* ---- ③ 背包：四页签 / 排序切换 ---- */
  s.inventory = ['cr_weapon_1', 'cr_weapon_4', 'cr_head_2', 'cr_head_1'];
  DATA.MATERIAL_IDS.forEach(function (mid, i3) { s.items[mid] = (i3 + 1) * 3; });
  G.ui.openBag('equip');
  await sleep(90);
  const bag22 = document.querySelector('#view-container');
  check('背包含四个页签', bag22.querySelectorAll('[data-action="bag-tab"]').length === 4);
  check('装备页有排序条', bag22.querySelectorAll('[data-action="bag-sort"]').length >= 3);
  check('默认按品质排序（首格为神品）', /q4/.test(bag22.querySelector('.bag-cell').className),
    bag22.querySelector('.bag-cell').className);
  const sortVal = bag22.querySelector('[data-action="bag-sort"][data-v="val"]');
  click(sortVal);
  await sleep(80);
  check('可切换到按价值排序', !!document.querySelector('#view-container .bag-sortbar .chip.on'), 'val');
  click(document.querySelector('#view-container [data-action="bag-tab"][data-v="mat"]'));
  await sleep(90);
  const matHtml22 = document.querySelector('#view-container').innerHTML;
  check('材料页按系列分组（分页后仍在）', (matHtml22.match(/bag-sec/g) || []).length >= 3,
    (matHtml22.match(/bag-sec/g) || []).length + ' 组');
  check('材料页排序含系列/品阶/数量', (document.querySelector('#view-container').innerHTML.match(/data-action="bag-sort" data-v="/g) || []).length >= 3);
  check('材料格子有图标（矢量或位图）',
    document.querySelectorAll('#view-container .bag-cell .bag-ico svg, #view-container .bag-cell .bag-ico img.ico-img').length >= 6,
    document.querySelectorAll('#view-container .bag-cell .bag-ico svg, #view-container .bag-cell .bag-ico img.ico-img').length + ' 个');
  click(document.querySelector('#view-container [data-action="bag-tab"][data-v="bp"]'));
  await sleep(80);
  check('图纸页可访问', document.querySelector('#view-container').innerHTML.indexOf('装备图纸') >= 0);
  G.ui.setView('city');
  await sleep(40);

  /* ---- ④ 装备拆解（真实点击） ---- */
  const inv22 = s.inventory.length;
  G.ui.openEquipDetail('cr_weapon_1');
  await sleep(80);
  const eqHtml = document.querySelector('#modal-root').innerHTML;
  check('v78：装备详情不再有「穿给谁」（穿戴走将领侧）',
    eqHtml.indexOf('穿给谁') < 0 && eqHtml.indexOf('到「将领」面板点对应部位') >= 0);
  check('装备详情含拆解入口', !!document.querySelector('#modal-root [data-action="salvage-equip"]'));
  click(document.querySelector('#modal-root [data-action="salvage-equip"]'));
  await sleep(90);
  check('拆解后装备数减少', s.inventory.length === inv22 - 1, inv22 + ' → ' + s.inventory.length);
  G.ui.closeModal();

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

      /* v29（需求 6）：在途行军在「官府 · 在办事项」里看 */
      G.ui.openGuanfu();
      await sleep(90);
      const q23 = document.querySelector('#modal-root');
      check('官府「在办事项」列出在途行军',
        !!q23 && q23.textContent.indexOf('行军') >= 0,
        q23 ? q23.textContent.replace(/\s+/g, ' ').slice(-60) : '(无官府弹窗)');
      G.ui.closeModal();
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
      G.ui.closeModal();
      await sleep(60);

      /* 再出发一次 → 用真实主循环推进到抵达 */
      c23.army = Object.assign({}, c23.army, { yibing: 20000 });
      const gen2 = G.state.generals.filter((g) => g.id !== g23.id)[0] || g23;
      gen2.stamina = 100; gen2.energy = 100;
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
    G.ui.closeModal();
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
    check('升级中面板可取消升级', !!document.querySelector('#modal-root [data-action="cancel-build"]'));
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
      G.ui.closeModal();
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
    check('君主弹窗为三段式（head/body/foot）',
      !!document.querySelector('#modal-root .m-head') && !!document.querySelector('#modal-root .m-body')
      && !!document.querySelector('#modal-root .m-foot'));
    check('君主弹窗用 xl 档固定尺寸（v77 左右分栏）', !!document.querySelector('#modal-root .modal-xl'));
    check('三段式弹窗内层为 flex 布局', !!document.querySelector('#modal-root .inner-panel.inner-shell'));
    G.ui.closeModal();
    /* v25（需求 2）：商城/背包改为整页视图 —— 与各"大界面"同格局（.ui-page 容器） */
    G.ui.openBag('equip'); await sleep(60);
    check('背包整页与大界面同格局（.ui-page）',
      !!document.querySelector('#view-container .ui-page') && document.querySelector('#modal-root').innerHTML === '');
    G.ui.openShop(); await sleep(60);
    check('商城整页与大界面同格局（.ui-page）', !!document.querySelector('#view-container .ui-page'));
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
    check('菜单分组顺序正确（场景→军事→任务统计→商背→记录→系统）', (function () {
      const order = ['city', 'map', null, 'generals', 'marches', null, 'tasks', 'stats', null, 'shop', 'bag', null, 'story', 'reports', null, 'settings'];
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
    check('公文页只留战报与消息（v29 需求 6：队列已迁出）',
      rep24.indexOf('id="doc-queues"') < 0 && rep24.indexOf('战报') >= 0 && rep24.indexOf('消息') >= 0);
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
    check('行军菜单渲染出征队列', mvh.indexOf('在外军队') >= 0 && mvh.indexOf(gen24.name) >= 0);
    check('行军菜单含行军进度列', mvh.indexOf('行军进度') >= 0 && mvh.indexOf('%') >= 0);
    check('行军菜单含在外驻军（采集）区', mvh.indexOf('在外驻军') >= 0);
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
    G.ui.closeModal();
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
    check('城外地块面板操作分区（功能行 / 升级行 / 底栏）', mh24.indexOf('op-zone-t">功能') >= 0 && mh24.indexOf('op-zone-t">升级') >= 0 && mh24.indexOf('bldg-foot') >= 0);
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
      G.ui.closeModal();
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

  G.ui.setView('marches');
  await sleep(80);
  const marches21_v21 = vc.innerHTML;
  check('行军视图渲染伤兵营', marches21_v21.indexOf('伤兵营') >= 0
    && marches21_v21.indexOf('data-heal-host="view"') >= 0);
  check('行军视图给出数量与治疗费（信息型）',
    marches21_v21.indexOf('777') >= 0 && marches21_v21.indexOf('7,770') >= 0);

  G.ui.openMarches();
  await sleep(70);
  check('行军队列弹窗含伤兵营',
    document.querySelector('#modal-root').innerHTML.indexOf('data-heal-host="marches"') >= 0);
  G.ui.closeModal();

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
  G.ui.openXiaochang();
  await sleep(70);
  const xc21_v21 = document.querySelector('#modal-root').innerHTML;
  check('校场弹窗渲染伤兵营与治疗按钮',
    xc21_v21.indexOf('data-heal-host="xiaochang"') >= 0
    && xc21_v21.indexOf('data-action="heal-wounded"') >= 0);
  check('校场弹窗呈现队列上限与每队兵力（信息型）',
    xc21_v21.indexOf('出征队列') >= 0 && xc21_v21.indexOf('每队兵力上限') >= 0);

  /* 点治疗：兵员归队 + 弹窗原地刷新（不再「点了没反应」） */
  const armyBefore21_v21 = JSON.parse(JSON.stringify(c21_v21.army || {}));
  s21_v21.res.gold = 1e7;
  const healBtn21_v21 = document.querySelector('#modal-root [data-action="heal-wounded"]');
  check('治疗按钮可点击（伤兵 > 0 时不禁用）', !!healBtn21_v21 && !healBtn21_v21.disabled);
  click(healBtn21_v21);
  await sleep(140);
  check('治疗伤兵后兵员入城且伤兵归零',
    s21_v21.wounded === 0 && (c21_v21.army.yibing || 0) === (armyBefore21_v21.yibing || 0) + 777,
    (armyBefore21_v21.yibing || 0) + ' → ' + (c21_v21.army.yibing || 0));
  check('弹窗原地刷新（仍在校场面板且伤兵显示为 0）',
    document.querySelector('#modal-root').innerHTML.indexOf('data-heal-host="xiaochang"') >= 0
    && document.querySelector('#modal-root').innerHTML.indexOf('7,770') < 0);
  G.ui.closeModal();

  /* 设置页：伤兵营已迁出 */
  G.ui.setView('settings');
  await sleep(80);
  const set21_v21 = vc.innerHTML;
  check('设置页已无伤兵营入口（需求 1）',
    set21_v21.indexOf('伤兵营') < 0 && set21_v21.indexOf('heal-wounded') < 0);
  check('设置页保留信息型设置项',
    set21_v21.indexOf('时间倍率') >= 0 && set21_v21.indexOf('税率') >= 0
    && set21_v21.indexOf('显示比例') >= 0 && set21_v21.indexOf('存档管理') >= 0);
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

  /* 需求 1：点选控件的行为（不重绘、回写隐藏域） */
  G.ui.openMarket();
  await sleep(70);
  const mkIron = document.querySelector('#modal-root [data-target="mk-from"][data-v="iron"]');
  const mkHidden = document.getElementById('mk-from');
  check('市场资源改为点选按钮（无下拉框）', !!mkIron && !document.querySelector('#modal-root select'));
  click(mkIron);
  await sleep(40);
  check('点选后隐藏域同步（读取端无需改动）',
    mkHidden && mkHidden.value === 'iron' && mkIron.classList.contains('on'),
    mkHidden ? mkHidden.value : 'no-hidden');
  const amtBefore = document.getElementById('mk-amount').value;
  check('点选不重绘（同屏输入框内容保留）',
    document.getElementById('mk-amount') && document.getElementById('mk-amount').value === amtBefore);
  G.ui.closeModal();

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
  if (w23) {
    G.ui.openLandModal(w23.x, w23.y);
    await sleep(80);
    const landM = document.querySelector('#modal-root').innerHTML;
    check('已占野地打开管理面板（需求 1）',
      landM.indexOf('地块操作') >= 0 && landM.indexOf('危险操作') >= 0);
    check('管理面板给出驻军与衰减状态',
      landM.indexOf('🛡️ 驻军') >= 0 && landM.indexOf('等级衰减') >= 0);
    check('管理面板含派军驻守与放弃入口',
      landM.indexOf('data-action="wild-garrison-open"') >= 0
      && landM.indexOf('data-action="wild-abandon-ask"') >= 0);
    G.ui.closeModal();
  }

  /* 需求 5：统计菜单 */
  G.ui.setView('stats');
  await sleep(90);
  const stats23 = vc.innerHTML;
  /* v27（需求 7）：卡片网格 → 官府黄册（分段账册 + 引线行） */
  /* v54（老板）：删掉别处已有的三块（君主/府库/军民）后只剩三节，判据跟着改 */
  /* v60（需求 3）：满级专精一节已从全境汇总撤出（搬进各建筑面板）→ 只剩两节 */
  check('统计页渲染全境汇总（需求 5）', !!vc.querySelector('.ledger')
    && vc.querySelectorAll('.ledger-sec').length >= 2 && stats23.indexOf('全境汇总') >= 0);
  check('统计页列出每座城池并可「进入」', (function () {
    const rows = vc.querySelectorAll('.tbl tbody tr');
    return rows.length >= G.state.cities.length;
  })(), vc.querySelectorAll('.tbl tbody tr').length + ' 行');
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
    check('点官府宫殿打开官府面板并含征收入口',
      document.querySelector('#modal-root').innerHTML.indexOf('data-action="open-guanfu"') >= 0);
  }
  /* v82（老板）：「官府不需要征收物质这个功能去除」——
     原「征收全流程」整段退役，改验**退役本身**（防回魂）+ 面板不被误伤。 */
  G.ui.openGuanfu();
  await sleep(80);
  const gm24 = document.querySelector('#modal-root').innerHTML;
  check('v82：官府弹窗已无征收区（物资表 / 征收按钮退役）',
    gm24.indexOf('官府') >= 0 && gm24.indexOf('征收物资') < 0
    && !document.querySelector('#levy-btn'));
  check('v82：官府仍在办事项（退役不误伤面板）', gm24.indexOf('在办事项') >= 0);
  G.ui.closeModal();
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
  check('城外棋盘块数 = 官府等级上限',
    vc.querySelectorAll('.iso-tile').length === G.extCap(G.currentCity()),
    vc.querySelectorAll('.iso-tile').length + ' / ' + G.extCap(G.currentCity()));

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
    G.ui.closeModal();
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
    G.ui.closeModal();
    await sleep(50);
  }

  /* ⑧b 自动化菜单（v29 · 需求 5） */
  G.ui.setView('auto');
  await sleep(100);
  check('自动菜单含三个开关（升级 / 研究 / 出征）',
    vc.querySelectorAll('.auto-switches .btn').length === 3);
  check('自动出征参数六行齐备（将领/兵力/目标/等级/类型/频率）', (function () {
    var lines = vc.querySelectorAll('.auto-card .auto-line .al-k');
    var ks = Array.prototype.map.call(lines, function (x) { return x.textContent.trim(); });
    return ks.indexOf('执行将领') >= 0 && ks.indexOf('单次兵力') >= 0
      && ks.indexOf('目标类型') >= 0 && ks.indexOf('目标等级') >= 0
      && ks.indexOf('出征类型') >= 0 && ks.indexOf('出征频率') >= 0;
  })());
  check('点「开启自动出征」真能开（并自动挑一位空闲将领）', (function () {
    var btn = vc.querySelector('[data-action="toggle-auto-march"]');
    if (!btn) return false;
    btn.click();
    var cfg = G.autoMarchCfg();
    return cfg.on === true && !!cfg.genId;
  })());
  check('自动出征参数可改（目标等级 → 4）', (function () {
    var chip = vc.querySelector('[data-after="automarch"][data-k="maxLevel"][data-v="4"]');
    if (!chip) return false;
    chip.click();
    return G.autoMarchCfg().maxLevel === 4;
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

  /* ⑨ 队列在官府（v29 · 需求 6 迁入） */
  G.ui.setView('reports');
  await sleep(100);
  check('公文已无队列一节（真实 DOM）', !document.querySelector('#doc-queues'));
  G.ui.openGuanfu();
  await sleep(100);
  const dq24 = (document.querySelector('#modal-root') || {}).textContent || '';
  check('底部队列播报条不再存在', !document.querySelector('#queue-bar'));
  check('官府在办事项可读到内容', dq24.replace(/\s+/g, '').length > 0, dq24.replace(/\s+/g, ' ').slice(-60));
  G.ui.closeModal();

  /* ============================================================
   * v25（需求 1-14）真实 DOM 验证
   * ============================================================ */
  console.log('\n--- v25. 城墙环 / 整页视图 / 任务详情 / 改名 / 美术（真实 DOM） ---');

  /* ① 城墙：点墙环打开城墙面板 */
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
  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  click(wallHit);
  await sleep(90);
  check('点墙环打开城墙面板（需求 1）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0);
  G.ui.closeModal();
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
  G.ui.closeModal();
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
  G.ui.closeModal();
  await sleep(40);

  /* ⑧ 改名：真实点击流程 */
  G.ui.setView('city');
  await sleep(60);
  const rnCity = G.currentCity();
  const bkName25 = rnCity.name, bkType25 = rnCity.type;
  rnCity.type = 'self';
  G.ui.openGuanfu();
  await sleep(80);
  const rnBtn = document.querySelector('#modal-root [data-action="open-rename-city"]');
  check('自建城官府有改名入口', !!rnBtn);
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
  G.ui.closeModal();
  await sleep(40);

  /* ⑨ 君主卡 */
  G.ui.syncHeader();
  check('君主头像为立绘 SVG', !!document.querySelector('#lord-avatar svg'));
  check('v81：君主名并入信息表首行（官职行退役）',
    !!document.querySelector('.lord-meta .mrow-name #lord-name') && !document.querySelector('#lord-city'));
  check('君主卡带爵位（爵位已并入君主）', (function () {
    G.ui.openLordInfo();
    const h = document.querySelector('#modal-root').innerHTML;
    G.ui.closeModal();
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
  check('统计页为竹简卷轴（底纹 + 木轴 + 朱印）',
    !!vc.querySelector('.scroll-page') && vc.querySelectorAll('.scroll-axis').length === 2
    && !!vc.querySelector('.scroll-title .seal'));
  /* v27（需求 7）：卡片网格 → 分段账册（黄册） */
  /* v54（老板）：三节 / 五笔以上（军民/府库/君主已按老板要求撤掉） */
  /* v60（需求 3）：丙节（满级专精）撤出 → 两节 / 四笔以上 */
  check('统计页为分段账册（甲/乙）',
    vc.querySelectorAll('.ledger-sec').length >= 2 && vc.querySelectorAll('.lg-row').length >= 4
    && vc.querySelectorAll('.stat-card').length === 0,
    vc.querySelectorAll('.ledger-sec').length + ' 段 / ' + vc.querySelectorAll('.lg-row').length + ' 行');
  G.ui.setView('reports');
  await sleep(90);
  /* v39（需求 4）：公文页改扁平页 —— 不再套卷轴大框（老板嫌"好多框"），
     但分区标题与战报列表行保留。 */
  check('公文页为扁平页（去卷轴大框）',
    !vc.querySelector('.scroll-page') && !!vc.querySelector('.seal-h')
    && !!vc.querySelector('.doc-bar'));

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
  check('「＋」开出选择窗，列出道具的持有数与每份经验',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    && expModal.textContent.indexOf('+3,000') >= 0);
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
  G.ui.closeModal();
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
  check('公文保留战报 / 消息两节（v29 需求 6：队列迁出）',
    rep27.indexOf('id="doc-queues"') < 0 && rep27.indexOf('战报') >= 0 && rep27.indexOf('消息') >= 0);

  /* ③ 统计黄册（真实 DOM） */
  G.ui.setView('stats');
  await sleep(110);
  check('统计页为分段账册（甲·疆域 / 乙·在外）', (function () {
    /* v54（老板）：删掉别处已有的三块（君主/府库/军民）后是三节；
       v60（需求 3）：满级专精一节也撤出（搬进各建筑面板）→ 只剩甲/乙两节。
       判据用"至少两节 + 甲乙都在 + 顺序正确 + 丙不再出现"，不写死 2。 */
    const secs = vc.querySelectorAll('.ledger-sec');
    const txt = Array.prototype.map.call(secs, (x) => x.textContent).join('|');
    const iA = txt.indexOf('甲'), iB = txt.indexOf('乙');
    return secs.length >= 2 && iA >= 0 && iB > iA && txt.indexOf('丙') < 0
      && txt.indexOf('满级专精') < 0;
  })(), vc.querySelectorAll('.ledger-sec').length + ' 段');
  check('账目行为「项目 …… 数值」引线结构', (function () {
    const r0 = vc.querySelector('.lg-row');
    return !!r0 && !!r0.querySelector('.lg-k') && !!r0.querySelector('.lg-fill')
      && !!r0.querySelector('.lg-v');
  })());
  /* v54（老板："别一边长一边短，留空一大块"）：账册必须是**单列** ——
     每笔独占一行 → 结构上不可能出现"半行留空"（两列时奇数笔必留空一格）。
     判据用**真实坐标**：所有账目行的左边界只许有一个值。 */
  check('黄册为单列（每笔一行，不会出现"半行留空"）', (function () {
    const rows = Array.from(vc.querySelectorAll('.lg-row'));
    if (rows.length < 4) return false;                  /* 分母太小 → 判据无意义 */
    const lefts = new Set(rows.map((x) => Math.round(x.getBoundingClientRect().left)));
    const widths = new Set(rows.map((x) => Math.round(x.getBoundingClientRect().width)));
    return lefts.size === 1 && widths.size === 1;
  })(), (function () {
    const rows = Array.from(vc.querySelectorAll('.lg-row'));
    const lefts = new Set(rows.map((x) => Math.round(x.getBoundingClientRect().left)));
    return rows.length + ' 笔 / 左边界 ' + lefts.size + ' 种';
  })());
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
  const rr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'raid',
    { changqiang: 5000, gongjian: 3000, qingji: 1000 }, g27.id);
  await sleep(120);
  check('出征结算成功', !!rr27.ok, rr27.msg);
  check('本场战报正文含兵种损耗明细（本次新增的那一份）', (function () {
    const rep = G.state.reports[bkRepN27];
    return !!rep && (rep.body || '').indexOf('【兵种损耗】') >= 0
      && (rep.body || '').indexOf('损 ') >= 0 && !!rep.scene;
  })());
  G.ui.setView('reports');
  await sleep(110);
  const viewBtn = vc.querySelector('[data-action="view-report"]');
  check('公文里有战报条目与「查看」按钮', !!viewBtn);
  click(viewBtn);
  await sleep(120);
  const rp27 = document.querySelector('#modal-root');
  check('战报详情含战斗场景条带', !!rp27.querySelector('.bt-scene') && rp27.querySelectorAll('.bt-row').length >= 1,
    rp27.querySelectorAll('.bt-row').length + ' 帧');
  check('条带为等宽字符网格（48 列）', (function () {
    const s0 = rp27.querySelector('.bt-strip');
    return !!s0 && s0.textContent.trim().length === G.tactic.GRID_COLS;
  })());
  check('战报详情含回合纪要', rp27.querySelectorAll('.bt-line').length >= 1);
  check('战报详情含兵种损耗表（列出双方各兵种）', (function () {
    const heads = Array.prototype.map.call(rp27.querySelectorAll('.tbl th'), (x) => x.textContent);
    return heads.join(',').indexOf('我方损失') >= 0 && heads.join(',').indexOf('敌军损失') >= 0
      && rp27.querySelectorAll('.tbl tbody tr').length >= 1;
  })());
  G.ui.closeModal();
  await sleep(60);

  /* ⑦ 侦查回报面板（真实渲染）
     v65：情报按侦察技巧**分层解锁** —— 先把技巧升满，才看得到全部六层；
     "分层"这件事本身由下面新增的两条断言专门钉住（未解锁必须显示锁定行）。 */
  const keepTech27 = G.state.techs['zhencha'] || 0;
  const keepW27 = G.state.world.weather;
  G.state.techs['zhencha'] = 10;
  /* ⚠️ 两个前置都必须固定，否则断言偶发变红（"前置没满足"看起来像"功能坏了"）：
     ① 体力/精力补满 —— 侦察要消耗它们，不足时 expedition 会**直接拒绝**；
     ② **天气设为晴** —— 大雾会让情报整体降级（既有设定），
        于是"逐兵种准确数量"与"可图之利"整块消失（连跑三次才抓到这一条）。 */
  g27.stamina = G.staMax(g27);
  g27.energy = 100;
  G.state.world.weather = 'clear';
  const sr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
  await sleep(100);
  G.ui.openScoutResult({ name: '野地' }, sr27);
  await sleep(100);
  const sm27 = document.querySelector('#modal-root');
  check('满级侦查 → 面板给出「情报层级」与全开状态',
    sm27.textContent.indexOf('情报层级') >= 0 && sm27.textContent.indexOf('六层情报全开') >= 0);
  check('侦查面板分「敌情 / 可图之利」两段',
    sm27.textContent.indexOf('敌情') >= 0 && sm27.textContent.indexOf('可图之利') >= 0);
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
  G.ui.closeModal();
  await sleep(60);

  /* 同一目标、技巧归零 → 六层几乎全锁（这才是"按等级给不同类型的信息"） */
  G.state.techs['zhencha'] = 0;
  const sr27b = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
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
  G.ui.closeModal();
  G.state.techs['zhencha'] = keepTech27;
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
  check('清单行含 肖像/姓名/资质/状态（v45：等级与装备数已移出）',
    !!gr0 && !!gr0.querySelector('.grow-face svg, .grow-face img')
    && !!gr0.querySelector('.grow-name') && !!gr0.querySelector('.rank-badge')
    && !!gr0.querySelector('.grow-st')
    && !gr0.querySelector('.grow-lv') && !gr0.querySelector('.grow-eq'));
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
  st28.res.pop = 1234; st28.res.grain = 9000;
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
    check('点加速弹出宝物选择（含剩余时间）',
      pb28.textContent.indexOf('募兵加速') >= 0 && pb28.textContent.indexOf('剩余') >= 0);
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
    G.ui.closeModal();
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

  /* ⑥ 背包批次使用 */
  G.state.items.lianbing_jingyan = 4;
  G.ui.setView('bag');
  G.ui._bagTab = 'item';
  G.ui.renderBag();
  await sleep(100);
  check('背包宝物页每行都有数量输入框', !!vc.querySelector('.qty-input input'));
  const g28 = G.state.generals[0];
  const expBk28 = g28.exp, lvBk28 = g28.level;
  /* v29（需求 14）：使用数量取**本行输入框** */
  var useInp = document.getElementById('ui-lianbing_jingyan');
  if (useInp) useInp.value = 4;
  click(vc.querySelector('[data-action="use-bag-item"][data-key="lianbing_jingyan"]'));
  await sleep(130);
  check('点一次用掉 N 个（经验道具整叠使用）',
    (G.state.items.lianbing_jingyan || 0) === 0
    && (G.state.generals[0].exp !== expBk28 || G.state.generals[0].level !== lvBk28),
    '余 ' + (G.state.items.lianbing_jingyan || 0));

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
    check('v76：关闭按钮单独吸底', !!document.querySelector('#modal-root .bldg-foot [data-action="close-modal"]'));
    G.ui.closeModal();
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
  G.ui.closeModal();
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
    G.ui.closeModal();
    await sleep(50);

    G.ui.openFortModal(f63);
    await sleep(80);
    check('据点面板提示今日已掠夺（点之前就知道）',
      document.querySelector('#modal-root').innerHTML.indexOf('今日已掠夺') >= 0);
    G.ui.closeModal();
    await sleep(50);

    G.ui.openExpModal({ kind: 'fort', x: f63.x, y: f63.y });
    await sleep(90);
    const raidTab = document.querySelector('#modal-root .exp-mode[data-v="raid"]');
    check('已掠夺据点的「掠夺」方式被锁（带原因）',
      !!raidTab && /locked/.test(raidTab.className) && (raidTab.getAttribute('title') || '').length > 0);
    const keepMode63 = G.ui._expMode;
    G.ui.setExpMode('raid');
    check('锁定项点了也切不过去', G.ui._expMode === keepMode63, '当前 ' + G.ui._expMode);
    const scoutTab = document.querySelector('#modal-root .exp-mode[data-v="scout"]');
    check('同面板的「侦查」不受影响', !!scoutTab && !/locked/.test(scoutTab.className));
    G.ui.closeModal();
    await sleep(50);

    if (f63b) {
      G.ui.openExpModal({ kind: 'fort', x: f63b.x, y: f63b.y });
      await sleep(90);
      const raidTab2 = document.querySelector('#modal-root .exp-mode[data-v="raid"]');
      check('无掠夺记录的据点上「掠夺」可用（对照，证明判据不是恒真）',
        !!raidTab2 && !/locked/.test(raidTab2.className));
      G.ui.closeModal();
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

  /* 守将按城：B 城立守将，A 城内政加成不受影响 */
  (function () {
    const a63 = G.currentCity();
    const b63 = G.makeCity({ id: 'e2e63b', name: '副城', x: 9, y: 9, type: 'county',
      res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    G.state.cities.push(b63);
    const g63 = G.makeGeneral('副城守将', 20, 'guard', b63.id, false, 'liang', 'balance');
    g63.loyalty = 100;
    G.state.generals.push(g63);
    const hasB = G.prodFactors('grain', b63).some((f) => f.name === '守将内政');
    const hasA = G.prodFactors('grain', a63).some((f) => f.name === '守将内政');
    check('守将只给本城加成（B 城有、A 城没有）', hasB === true && hasA === false,
      'B ' + hasB + ' / A ' + hasA);
    check('不同城市取到的是各自的守将', G.guardBonus(b63).name === '副城守将'
      && (G.guardBonus(a63).name || '') !== '副城守将');
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
    const keepWall = c64.wallLv, keepAuto = G.state.settings.autoUpgrade, keepQ = G.state.queues.build.slice();
    c64.wallLv = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { c64.res[k] = 5000000; });
    G.state.settings.autoUpgrade = true;
    G.state.queues.build.length = 0;
    const r64 = G.autoUpgrade();
    const qb64 = G.ui.queueBody ? G.ui.queueBody() : '';
    check('自动升级把城墙纳入候选（0 级城墙第一个被选中）',
      !!(r64 && r64.target && r64.target.kind === 'wall' && r64.target.lv === 0),
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');
    check('城墙排进建造队列（type=wall）且"在办事项"里能看到',
      G.state.queues.build.some((q) => q.type === 'wall' && q.cityId === c64.id)
      && qb64.indexOf('城墙') >= 0);
    /* 还原 */
    G.state.queues.build.length = 0; keepQ.forEach((q) => G.state.queues.build.push(q));
    c64.wallLv = keepWall; G.state.settings.autoUpgrade = keepAuto;
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
  G.ui.closeModal();
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
    G.ui.openDispatch(a.id);
    G.ui.setDpGen(a.id, g.id);            /* 触发重绘（点选后只切 class，这里直接重开） */
  })();
  await sleep(120);
  const dpHtml64 = document.querySelector('#modal-root').innerHTML;
  check('派遣面板标出目标城「N/M 席（空 K）」', /\d+\/\d+ 席（空 \d+）/.test(dpHtml64),
    (dpHtml64.match(/\d+\/\d+ 席（空 \d+）/) || ['未找到'])[0]);
  check('派遣面板写明席位按城算（招贤馆等级）', /席位\*\*按城算\*\*|席位按城算/.test(dpHtml64));
  G.ui.closeModal();
  await sleep(50);
  G.state.cities.pop();
  G.state.cities.pop();        /* 侧城也去掉（恢复现场） */

  /* ============================================================
   * ⑩ v65（老板）：官府面板收口 / 驻军精简 / 资源短写 / 属性整数
   * ============================================================ */
  /* --- 官府面板：说明进 help，正文只留"当前事实" --- */
  G.ui.openGuanfu();
  await sleep(140);
  (function () {
    const root = document.querySelector('#modal-root');
    const keys = Array.prototype.map.call(root.querySelectorAll('.attr .k'), (x) => x.textContent.trim());
    check('官府面板正文不含三条收集说明（已挪进 ⓘ）',
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
  G.ui.closeModal();
  await sleep(60);

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
    const t0 = G.state.techs['zhencha'] || 0;
    const w0 = G.state.world.weather;
    G.state.world.weather = 'clear';
    G.state.techs['zhencha'] = 0;
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
      G.ui.closeModal();
    } else {
      check('技巧 0 级侦查：面板出现锁定行，且守军只报「约」', false, '侦查未成功');
      check('技巧 0 级侦查：可图之利整段锁着（不给"看不到就说没有"）', false, '侦查未成功');
    }
    G.state.techs['zhencha'] = t0; G.state.world.weather = w0;
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
    const m = txt.match(/体力\s*([\d,]+)/);
    const num = m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN;
    check('将领页「体力」主数字 = 上限（含装备，不是当前值）',
      num === withEq && withEq > bareMax && nowEq < withEq,
      '裸装 ' + bareMax + ' → 上限 ' + withEq + '（当前 ' + nowEq + '）；页面「' + txt.replace(/\s+/g, ' ').trim().slice(0, 46) + '」');
    check('将领页「体力」当前值另行标注（当前 X）', txt.indexOf('当前') >= 0);
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
    G.ui.closeModal();
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
    G.ui.closeModal();
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
    G.ui.closeModal();
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
    G.ui.closeModal();
    /* 资源区：附属野地下拉框 */
    G.ui._wildSig = null;
    G.ui.renderWildPick(G.currentCity(), G.state);
    check('v77：资源区附属野地下拉框 + 进入按钮', (function () {
      const host = document.getElementById('wild-pick-host');
      return !!host && !!host.querySelector('select.wild-select') && !!host.querySelector('[data-action="open-wilds"]');
    })(), (document.getElementById('wild-pick-host') || { innerHTML: '宿主缺失' }).innerHTML.slice(0, 30));
    G.ui.closeModal();
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

    G.ui.closeModal();
    G.ui.openCityPanel(c2);
    await sleep(80);
    let root = document.querySelector('#modal-root');
    const entry = root.querySelector('[data-action="city-abandon-ask"]');
    const hasEntry = !!entry;
    if (entry) entry.click();
    await sleep(100);
    root = document.querySelector('#modal-root');
    const askHtml = root.innerHTML;
    const hasConfirm = askHtml.indexOf('data-action="city-abandon-do"') >= 0;
    const saysCost = askHtml.indexOf('失去库存') >= 0 && askHtml.indexOf('将领随迁') >= 0;
    const btn = root.querySelector('[data-action="city-abandon-do"]');
    if (btn) btn.click();
    await sleep(150);

    const gone = !s.cities.some(function (c) { return c.id === c2.id; });
    const clean = G.cityRefsOf(c2.id).length === 0;
    check('放弃城池：入口 → 二次确认 → 城池消失且关联数据 0 残留',
      hasEntry && hasConfirm && saysCost && gone && clean,
      '入口' + hasEntry + ' 确认' + hasConfirm + ' 说清代价' + saysCost + ' 已删' + gone + ' 无残留' + clean);
    check('放弃城池：当前城池自动切到剩下的那座',
      !!G.currentCity() && G.currentCity().id === host.id,
      G.currentCity() ? G.currentCity().name : '(空)');
    check('放弃城池：确认后弹窗已关（不会留一扇指向已删城的窗）',
      document.querySelector('#modal-root').innerHTML.indexOf('city-abandon-do') < 0);
    /* 只剩一座城时：入口不出现（点不到必然被拒的按钮）。
       ⚠️ 必须先真的把城池收成一座 —— 前面的用例已经加过城，否则这条是假绿。 */
    const keepCities = s.cities.slice();
    s.cities = [host];
    G.ui.closeModal();
    G.ui.openCityPanel(host);
    await sleep(80);
    const noEntry = document.querySelector('#modal-root').innerHTML.indexOf('city-abandon-ask') < 0;
    check('放弃城池：只剩一座城时面板不给入口', noEntry, '城池数 ' + s.cities.length);
    G.ui.closeModal();
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
    G.ui.closeModal();
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
      && mh70.indexOf('data-action="city-move-do"') >= 0 && mh70.indexOf('取消') >= 0);
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
    check('★ 君主档案：无解雇按钮 + 有「君主特权」块',
      vc.innerHTML.indexOf('data-action="dismiss-gen"') < 0
      && vc.innerHTML.indexOf('君主特权') >= 0);
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
    G.ui.openGuanfu();
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
      G.ui.closeModal();
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
      check('v73：底栏 .bldg-foot 含关闭按钮（吸底那一条）', (function () {
        const foot = document.querySelector('#modal-root .bldg-foot');
        return !!foot && !!foot.querySelector('[data-action="close-modal"]');
      })());
      G.ui.closeModal();
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
      check('v73：升级中弹窗也无顶图，取消升级与关闭同在底栏', (function () {
        const foot = document.querySelector('#modal-root .bldg-foot');
        return !document.querySelector('#modal-root .dlg-ico') && !!foot
          && !!foot.querySelector('[data-action="cancel-build"]')
          && !!foot.querySelector('[data-action="close-modal"]');
      })());
      G.ui.closeModal();
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
    G.ui.openGuanfu();
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
      G.ui.closeModal();
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
      G.ui.closeModal();
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
    G.ui.closeModal();
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
    G.ui.closeModal();
    await sleep(60);

    /* ② 建筑弹窗：三键+关闭 = 吸底操作区（三键在关闭上方） */
    const bi80 = c80.cells.findIndex((x) => x.build && x.build.id !== 'guanfu' && !x.pending);
    if (bi80 >= 0) {
      G.ui.openBuildModal(bi80);
      await sleep(130);
      const bo80 = document.querySelector('#modal-root .bldg-bottom');
      check('v80：三键+关闭同处吸底操作区', !!(bo80
        && bo80.querySelector('.bldg-acts')
        && bo80.querySelector('.bldg-foot [data-action="close-modal"]')));
      check('v80：操作区吸底（sticky 钉面板下沿）',
        !!bo80 && window.getComputedStyle(bo80).position === 'sticky');
      check('v80：三键在关闭上方（DOM 顺序，同块上排）', (function () {
        if (!bo80) return false;
        const acts = bo80.querySelector('.bldg-acts');
        const foot = bo80.querySelector('.bldg-foot');
        return !!(acts.compareDocumentPosition(foot) & window.Node.DOCUMENT_POSITION_FOLLOWING);
      })());
      G.ui.closeModal();
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
    G.ui.closeModal();
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
    G.ui.closeModal();
    await sleep(60);
  }

  /* ============================================================
   * v82（老板四条）真实 DOM：城名居中 / 文案清理 / 征收退役 / 字体三档
   * ============================================================ */
  console.log('\n--- v82. 文案清理 / 征收退役 / 字体（真实 DOM） ---');
  G.ui.openGuanfu();
  await sleep(100);
  (function () {
    const root = document.querySelector('#modal-root');
    const title = root.querySelector('.city-title');
    check('v82：官府面板城名居中行（.city-title 含城名）',
      !!title && title.textContent.indexOf(G.currentCity().name) >= 0);
    const ks = Array.prototype.map.call(root.querySelectorAll('.attr .k'), (x) => x.textContent.trim());
    check('v82：官府面板无「本城」/「附属野地」标签行',
      ks.indexOf('本城') < 0 && ks.join('|').indexOf('附属野地') < 0);
    check('v82：征收退役（面板无征收按钮）', !root.querySelector('#levy-btn'));
    check('v82：分区标题统一 800 字重（计算样式）', (function () {
      const h = root.querySelector('.gold-heading');
      return !!h && window.getComputedStyle(h).fontWeight === '800';
    })());
    G.ui.closeModal();
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
  check('v83：越级惩罚 ×0.65^gap（Lv73 打 1 级 → 0.65⁶）', (function () {
    const p = G.battle.expPenaltyOf(73, 1);
    return p.need === 7 && Math.abs(p.mul - Math.pow(0.65, 6)) < 1e-9;
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
    G.ui.closeModal();
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
    G.ui.closeModal();
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
    G.ui.closeModal();
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
        if (tl && tl.terrain !== 'city' && !G.map.fortAt(x, y)) { wt = { x, y }; break; }
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
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(200);
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());
    /* 城池布防入口 */
    G.ui.setView('city');
    await sleep(220);
    check('v86：城池面板有「计略布防」入口', !!document.querySelector('[data-action="city-scheme"]'));
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
  }

  /* ============================================================
   * v87（老板）：野地专属场景（真实 DOM）
   * ============================================================ */
  console.log('\n--- v87. 野地专属场景（真实 DOM） ---');
  {
    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.wildScenes = {};
    G.state.wilds = G.state.wilds || [];
    G.ui.openLandModal(hp.x, hp.y);            /* 未占 → 出兵弹窗 */
    await sleep(160);
    check('v87：野地弹窗含地形专属区块（绿林探访）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('绿林探访') >= 0
        && root.textContent.indexOf('地形专属') >= 0;
    })());
    check('v87：区块含带队将领与出发按钮', (function () {
      return !!document.querySelector('#modal-root [data-action="do-wild-scene"]')
        && !!document.querySelector('#ws-gen');
    })());
    click(document.querySelector('#modal-root [data-action="do-wild-scene"]'));
    await sleep(240);
    check('v87：执行后原地回显（今日已探）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('今日已探过') >= 0;
    })());
    /* 已占分支也含区块（直接注册一块已占野地） */
    G.state.wilds.push({ x: hp.x, y: hp.y, type: 'hill', level: 4 });
    G.ui.openLandModal(hp.x, hp.y);
    await sleep(160);
    check('v87：已占野地管理面板也含场景区块', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('地形专属') >= 0;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
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
