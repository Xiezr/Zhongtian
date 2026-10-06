/* v89.208 · 全面评价体系 · 维度③④⑤「输入健壮性 / 不变量 / 极端值」（实证层）
   为什么需要它：前三轮全是**静态读码**——静态读码看不出"喂进去会怎样"。
   本探针起真 jsdom（与 e2e 同款引导），把**畸形/极端输入**真喂进产品函数，
   看它接不接受、接受之后会不会留下半迁移的坏状态。

   产出：
     ① 存档导入校验阶梯（11 种畸形包逐条打靶：接受 / 拒绝 / 报什么）
     ② "接受之后会怎样"——坏档进 game 后是否留下部分迁移状态（原子性）
     ③ 存档往返保真（真存档 → export → import → load → 深比较）
     ④ 数值不变量模糊（随机驱动 N 步后检查：非负 / 非 NaN / 区间）
     ⑤ 极端值灌注（MAX_SAFE_INTEGER / 负数 / NaN 喂进生产函数）

   运行：
     NODE_PATH=<...>/node_modules node .workbuddy/tools/probe/probe_v89208_robust.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM } = require('jsdom');

const DIR = 'E:/Deepseekdb/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const OUT = [];
function say(s) { OUT.push(s); console.log(s); }
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
    quadraticCurveTo: noop, bezierCurveTo: noop, roundRect: noop, createPattern: () => null,
    fillText: noop, strokeText: noop, setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, imageSmoothingEnabled: true,
  };
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(DIR, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

/* 本地复刻 FNV-1a（与 GAME.checksum 同式）——用来伪造"校验和正确但内容畸形"的包 */
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}

server.listen(0, '127.0.0.1', () => {
  const URL = 'http://127.0.0.1:' + server.address().port + '/index.html';
  JSDOM.fromURL(URL, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    },
  }).then((dom) => {
    dom.window.addEventListener('load', () => setTimeout(() => run(dom).then(finish), 400));
    setTimeout(() => { }, 500);
  }).catch((e) => { console.error('boot fail:', e.message); process.exit(1); });
});

async function run(dom) {
  const { window } = dom;
  const G = window.GAME;
  const D = G.DATA;
  if (!G || !D) { say('✗ 游戏未加载'); return; }

  say('══════ 引导 ══════');
  say('  GAME.VERSION = ' + G.VERSION + ' · SAVE_FMT = ' + G.SAVE_FMT);
  /* 造一个干净真档当底本 */
  G.newGame({ name: 'probe', cityName: '许都' });
  const st0 = G.state;
  say('  底本：' + st0.cities.length + ' 城 · ' + (st0.generals || []).length + ' 将 · 金 ' + (st0.gold || 0));

  /* ---------- ① 导入校验阶梯 ---------- */
  say('\n══════ ① 存档导入校验阶梯（逐条打靶：接不接受 → 接受之后能不能用）══════');
  const goodState = JSON.parse(G.savePayload());
  function pack(state, opt) {
    const o = opt || {};
    const p = { _fmt: G.SAVE_FMT, _ver: o.ver == null ? 3 : o.ver, _exportedAt: Date.now(), state: state };
    if (o.check === 'correct') p._check = fnv(JSON.stringify(state));
    else if (typeof o.check === 'string') p._check = o.check;
    return JSON.stringify(p);
  }
  /* 每个用例前清空三个手动槽 —— 否则"槽位已满"会掩盖真实判定（首跑就踩了这坑） */
  function clearSlots() { ['s1', 's2', 's3'].forEach(function (id) { G.dropSlot(id); }); }
  /* 干净底本快照 + 复位。**不要用 newGame() 复位** —— 坏档污染 GAME.state 之后
     newGame 自己会崩（见 ⑥），那样会把探针打断在半路。 */
  const PRISTINE = JSON.parse(G.savePayload());
  function resetGame() {
    try { G.adoptState(JSON.parse(JSON.stringify(PRISTINE))); }
    catch (e) { G.state = JSON.parse(JSON.stringify(PRISTINE)); }
  }
  const cases = [
    ['空文本', ''],
    ['非 JSON 乱码', 'hello world 这不是存档'],
    ['JSON 但非对象', '12345'],
    ['JSON 对象但无 _fmt', JSON.stringify({ state: goodState })],
    ['_fmt 对 · _ver 错', pack(goodState, { ver: 2 })],
    ['_fmt/_ver 对 · 无 state', JSON.stringify({ _fmt: G.SAVE_FMT, _ver: 3 })],
    ['state 无 cities', pack({ ruler: { name: 'x' } })],
    ['cities 为空数组', pack(Object.assign({}, goodState, { cities: [] }))],
    ['cities: [{}]（畸形）+ 正确校验和', pack(Object.assign({}, goodState, { cities: [{}] }), { check: 'correct' })],
    ['cities: [null] + 正确校验和', pack(Object.assign({}, goodState, { cities: [null] }), { check: 'correct' })],
    ['正确内容 · **省略 _check**', pack(goodState)],
    ['正确内容 · _check 填假值', pack(goodState, { check: 'deadbeef' })],
    ['state 带 __proto__ 键 + 正确校验和', pack(Object.assign(JSON.parse('{"__proto__":{"pwned":1}}'), goodState), { check: 'correct' })],
    ['cities × 5000 个 {} 巨包', pack(Object.assign({}, goodState, { cities: Array(5000).fill({}) }), { check: 'correct' })],
    ['generals 为字符串', pack(Object.assign({}, goodState, { generals: 'oops' }), { check: 'correct' })],
    ['map 为 null', pack(Object.assign({}, goodState, { map: null }), { check: 'correct' })],
  ];
  G.newGame({ name: 'probe', cityName: '许都' });
  cases.forEach(function (c) {
    clearSlots();
    let r;
    try { r = G.importText(c[1], null); }
    catch (e) { r = { threw: true, msg: String(e && e.message || e) }; }
    let verdict = r.threw ? '💥 抛异常' : (r.ok ? '✅ 接受' : '⛔ 拒绝');
    let after = '';
    if (r.ok) {
      /* 接受了就真载一次，看"接受"是不是等于"能用" */
      const sid = (r.slot || G.slotEmpty() || 's1');
      resetGame();
      let lr, lt = null;
      try { lr = G.loadFrom(sid); } catch (e) { lt = String(e && e.message || e); }
      const broken = !lt && (!lr || !G.state || !G.state.cities || !G.state.cities[0] || G.state.cities[0].col == null);
      after = lt ? ('  → 载入 💥 ' + lt) : (broken ? '  → 载入 **静默失败/半迁移**' : '  → 载入 ok');
    }
    say('  ' + verdict + '  ' + c[0] + '   → ' + (r.threw ? r.msg : r.msg) + after);
    resetGame();
  });

  /* ---------- ② 坏档载入的原子性 ---------- */
  say('\n══════ ② 坏档载入：adoptState 的原子性（会不会留下半迁移状态）══════');
  clearSlots();
  resetGame();
  const before = { cities: G.state.cities.length, gold: G.state.gold, ver: G.state.version };
  say('  载入前：cities=' + before.cities + ' gold=' + before.gold + ' ver=' + before.ver);
  const bad = JSON.parse(pack(Object.assign({}, goodState, { cities: [{}] }), { check: 'correct' }));
  bad.state.version = 3;
  let loadResult, loadThrew = null;
  try {
    G.saveTo('main');
    window.localStorage.setItem(G.slotOf('main').key, JSON.stringify(bad.state));
    loadResult = G.loadFrom('main');
  } catch (e) { loadThrew = String(e && e.message || e); }
  say('  loadFrom 返回：' + (loadThrew ? ('💥 ' + loadThrew) : (loadResult ? '对象' : '**null（静默失败，调用方看不出已经出事）**')));
  const sem = G.state && G.state.cities && G.state.cities[0];
  say('  载入后 GAME.state：cities=' + (G.state && G.state.cities ? G.state.cities.length : 'n/a')
    + ' · 首城 col=' + (sem ? sem.col : 'n/a') + ' · 首城 res=' + (sem && sem.res ? JSON.stringify(sem.res).slice(0, 40) : 'n/a'));
  const leaked = !!sem && sem.col == null;
  say('  ' + (leaked
    ? '⚠ **半迁移实证**：adoptState 第一行就是 `GAME.state = st`，迁移中途抛错时**内存已被换掉**，\n'
      + '     而 loadFrom 把异常吞了并返回 null —— 调用方以为"没有存档"，实际手上已经是一个结构不全的状态。'
    : '✅ 未观察到半迁移'));

  /* ---------- ③ 存档往返保真 ---------- */
  say('\n══════ ③ 存档往返保真（真档 → 导出 → 导入 → 载入 → 深比较）══════');
  clearSlots();
  resetGame();
  G.state.gold = 123456; G.state.cities[0].res.grain = 4242;
  G.saveTo('main');
  const ex = G.exportText('main');
  const snapshot = JSON.parse(G.savePayload());
  const imp = G.importText(ex.text, 's2');
  say('  导出 ' + (ex.ok ? 'ok（' + ex.text.length + ' 字符）' : '✗ ' + ex.msg) + ' · 导入到 s2 ' + (imp.ok ? 'ok' : '✗ ' + imp.msg));
  const slot2 = G.slotOf('s2');
  if (imp.ok && slot2) {
    const back = JSON.parse(window.localStorage.getItem(slot2.key));
    let diffs = [];
    (function walk(a, b, p) {
      if (typeof a !== typeof b) { diffs.push(p + ' 类型 ' + typeof a + '→' + typeof b); return; }
      if (a && typeof a === 'object') {
        const ks = new Set(Object.keys(a).concat(Object.keys(b)));
        ks.forEach((k) => walk(a[k], b[k], p + '.' + k));
        return;
      }
      if (a !== b) diffs.push(p + ' ' + a + ' → ' + b);
    })(snapshot, back, '');
    say('  往返差异 ' + diffs.length + ' 处' + (diffs.length ? '：' : ' ✅'));
    diffs.slice(0, 8).forEach((d) => say('     ' + d));
  }

  /* ---------- ④ 数值不变量模糊 ---------- */
  say('\n══════ ④ 数值不变量模糊（随机驱动 300 步 · 检查非负/非 NaN）══════');
  resetGame();
  const RES = ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'];
  function checkInv(tag) {
    const bad = [];
    const s = G.state;
    (s.cities || []).forEach(function (c, i) {
      (c.res ? Object.keys(c.res) : []).forEach(function (k) {
        const v = c.res[k];
        if (typeof v !== 'number' || !isFinite(v)) bad.push('city' + i + '.res.' + k + '=' + v);
        else if (v < 0) bad.push('city' + i + '.res.' + k + ' 负 =' + v);
      });
      const hp = c.hearts;
      if (hp != null && (typeof hp !== 'number' || !isFinite(hp) || hp < 0 || hp > 100)) bad.push('city' + i + '.hearts=' + hp);
    });
    if (typeof s.gold === 'number' && (!isFinite(s.gold) || s.gold < 0)) bad.push('gold=' + s.gold);
    (s.generals || []).forEach(function (g, i) {
      ['lv', 'exp', 'sta', 'energy'].forEach(function (k) {
        const v = g[k];
        if (v != null && (typeof v !== 'number' || !isFinite(v) || v < 0)) bad.push('gen' + i + '.' + k + '=' + v);
      });
    });
    if (bad.length) say('     [' + tag + '] ⚠ ' + bad.slice(0, 6).join(' · ') + (bad.length > 6 ? ' …共' + bad.length : ''));
    return bad.length;
  }
  let invBad = 0;
  const ticks = ['GAME.tickOnce', 'GAME.loopPulse'];
  for (let i = 0; i < 300; i++) {
    try {
      G.tickOnce();
      if (i % 60 === 0) invBad += checkInv('step' + i);
    } catch (e) { say('     [step' + i + '] 💥 tickOnce 抛异常: ' + (e && e.message)); break; }
  }
  say('  300 步空转 tick 后不变量违例累计 ' + invBad + (invBad ? ' ⚠' : ' ✅')
    + '（注：空转 = 只推进时间，不触发玩家动作——下面 ④b 才是真模糊）');

  /* ---------- ④b 随机"合法但极端"存档模糊 ---------- */
  say('\n══════ ④b 随机极端存档模糊（{ 随机合法极值 → 跑 200 tick → 查不变量 } × 200 轮）══════');
  (function () {
    let seed = 20261006;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function ri(a, b) { return Math.floor(a + rnd() * (b - a + 1)); }
    const viol = [];
    let threw = 0;
    for (let it = 0; it < 200; it++) {
      resetGame();
      const s = G.state;
      /* 随机把状态推到"合法范围内的极值" —— 不是乱塞类型，而是塞真值的两端 */
      s.cities.forEach(function (c) {
        c.res.grain = ri(0, 1e9); c.res.wood = ri(0, 1e9); c.res.stone = ri(0, 1e9);
        c.res.iron = ri(0, 1e9); c.res.pop = ri(0, 5e6);
        if (c.hearts != null) c.hearts = ri(0, 100);
        if (c.lv != null) c.lv = ri(1, 12);
      });
      s.gold = ri(0, 1e9);
      (s.generals || []).forEach(function (g) {
        if (g.lv != null) g.lv = ri(1, 240);
        if (g.sta != null) g.sta = ri(0, 999);
        if (g.energy != null) g.energy = ri(0, 999);
        if (g.hp != null) g.hp = ri(0, 999);
      });
      let step = 0;
      try {
        for (step = 0; step < 200; step++) G.tickOnce();
      } catch (e) { threw++; viol.push('it' + it + ' step' + step + ' 💥 ' + (e && e.message)); continue; }
      const b = checkInv('it' + it);
      if (b) viol.push('it' + it + ' 违例 ' + b + ' 处');
    }
    say('  200 轮 × 200 tick：tick 抛异常 ' + threw + ' 轮 · 不变量违例 ' + (viol.length - threw) + ' 轮');
    if (viol.length) { say('  前 6 条：'); viol.slice(0, 6).forEach(function (v) { say('     ' + v); }); }
    else say('  ✅ 随机极端存档下，200 tick 内数值不变量全部守住（无负数 / 无 NaN / 民心在 0~100）');
  })();

  /* ---------- ⑤ 极端值灌注 ---------- */
  say('\n══════ ⑤ 极端值灌注（把极端数喂进生产函数）══════');
  resetGame();
  const probes = [
    ['资源 = MAX_SAFE_INTEGER', function () { G.state.cities[0].res.gold = Number.MAX_SAFE_INTEGER; return G.tickOnce(); }],
    ['资源 = 负数', function () { G.state.cities[0].res.grain = -99999; return G.tickOnce(); }],
    ['资源 = NaN', function () { G.state.cities[0].res.wood = NaN; return G.tickOnce(); }],
    ['民心 = 150（越界）', function () { G.state.cities[0].hearts = 150; return G.tickOnce(); }],
    ['民心 = -5', function () { G.state.cities[0].hearts = -5; return G.tickOnce(); }],
    ['城池数 = 0', function () { const k = G.state.cities; G.state.cities = []; const r = G.tickOnce(); G.state.cities = k; return r; }],
    ['将领 lv = 1e9', function () { if (G.state.generals[0]) G.state.generals[0].lv = 1e9; return G.tickOnce(); }],
    ['将领 lv = -1', function () { if (G.state.generals[0]) G.state.generals[0].lv = -1; return G.tickOnce(); }],
    ['时间戳 = 未来 100 年', function () { G.state.time = (G.state.time || 0) + 100 * 365 * 24 * 3600; return G.tickOnce(); }],
  ];
  probes.forEach(function (p) {
    resetGame();                       /* ← 每条用例独立复位：否则前一条灌注的坏值会带进后一条，
                                          把"单点灌注的后果"读成"累积后果"（首跑就误读成 9 条全红） */
    let err = null, r;
    try { r = p[1](); } catch (e) { err = String(e && e.message || e); }
    const bad = checkInv(p[0]);
    say('  ' + (err ? '💥 抛异常' : (bad ? '⚠ 产出异常值' : '✅ 无异常')) + '  ' + p[0]
      + (err ? '  → ' + err : ''));
  });

  /* ---------- ⑥ 坏档的连锁后果：开新档都开不了 ---------- */
  say('\n══════ ⑥ 坏档的连锁后果（隔离复现 · 玩家会遇到的那条路）══════');
  say('  生产路径：导入坏档（save-import-text）→ 玩不了 → 点「新游戏」（case \'new-game\' → GAME.doNewGame）');
  clearSlots();
  const badGen = pack(Object.assign({}, goodState, { generals: 'oops' }), { check: 'correct' });
  const impG = G.importText(badGen, 's1');
  say('  导入 generals:"oops" 的档 → ' + (impG.ok ? '✅ 接受（校验放行）' : '⛔ 拒绝 ' + impG.msg));
  if (impG.ok) {
    try { G.loadFrom('s1'); } catch (e) { say('  loadFrom 抛异常：' + e.message); }
    let ngErr = null;
    try { G.newGame({ name: 'oops', cityName: '许都' }); } catch (e) { ngErr = String(e && e.message || e); }
    say('  随后调 GAME.newGame(...) → ' + (ngErr ? '💥 **抛异常：' + ngErr + '**' : '✅ 正常'));
    if (ngErr) say('     → 玩家手上：旧档坏了、新档开不了，只能手动清 localStorage。'
      + '\n     → 根因：nextGenId / makeGeneral 假设 `state.generals` 是数组，用了 `((s && s.generals) || [])` ——'
      + '\n       `|| []` 只兜住了 null/undefined，兜不住"非数组的真值"（字符串/数字/对象）。');
  }
  resetGame();

  /* ---------- ⑦ 后期规模下的性能 ---------- */
  say('\n══════ ⑦ 性能观测（合法但在真实玩法里很大的存档）══════');
  (function () {
    function timeIt(tag, setup, n) {
      resetGame();
      setup(G.state);
      const t0 = Date.now();
      let err = null;
      for (let i = 0; i < n; i++) { try { G.tickOnce(); } catch (e) { err = String(e && e.message || e); break; } }
      const ms = Date.now() - t0;
      say('  ' + tag.padEnd(28) + (ms + 'ms').padStart(8) + ' / ' + n + ' tick = '
        + (ms / n).toFixed(3) + ' ms/tick' + (err ? '  💥 ' + err : ''));
      return ms / n;
    }
    resetGame();
    const base = timeIt('基准：1 城 · 2 将', function () { }, 2000);
    const mid = timeIt('中期：5 城 · 30 将', function (s) {
      const c0 = s.cities[0];
      for (let i = 1; i < 5; i++) s.cities.push(JSON.parse(JSON.stringify(c0)));
      const g0 = s.generals[0] || G.makeGeneral ? null : null;
      for (let i = (s.generals || []).length; i < 30 && s.generals[0]; i++) s.generals.push(JSON.parse(JSON.stringify(s.generals[0])));
    }, 2000);
    const late = timeIt('后期：50 城 · 500 将', function (s) {
      const c0 = s.cities[0];
      for (let i = 1; i < 50; i++) s.cities.push(JSON.parse(JSON.stringify(c0)));
      if (s.generals && s.generals[0]) for (let i = s.generals.length; i < 500; i++) s.generals.push(JSON.parse(JSON.stringify(s.generals[0])));
    }, 500);
    say('  放大倍数：后期/基准 = ' + (late / base).toFixed(1) + '×（线性放大属正常；超线性要查热点）');
    say('  参照：主循环 1 tick ≈ 1 游戏秒 · 真实帧预算 16ms');
  })();

  say('\n══════ 小结（本探针自身的边界）══════');
  say('  · 本探针不写仓库任何文件，jsdom 的 localStorage 是进程内内存。');
  say('  · "接受"只代表 importText 放行，不等于该档一定能正常玩——①栏每条接受都追加了真载验证。');
  say('  · 探针首跑曾因"槽位被占"与"用 newGame 复位"两次自伤，修法已写进注释（复位改用 adoptState）。');
}

function finish() {
  const txt = OUT.join('\n');
  fs.writeFileSync('E:/Deepseekdb/.workbuddy/tmp/v89208_robust.txt', txt, 'utf8');
  server.close();
  process.exit(0);
}
