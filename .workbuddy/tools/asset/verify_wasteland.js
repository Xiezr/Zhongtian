/* verify_wasteland.js —— 废土换皮 · 素材层校验（穷举业务 id 的 layerOf + 登记表 vs 磁盘）
 * ============================================================
 * 为什么需要它：smoke-test.js 只对 minfang / 材料做了**抽样** layerOf 断言。
 * 本器**穷举**业务侧所有 id，回答两个问题：
 *   ① 每个 id 现在由哪一层提供？（应为 bitmap —— 零 vector）
 *      —— 直接回答"有没有图标悄悄退回汉代矢量层"。
 *   ② 登记在册的位图**磁盘上真的存在**吗？（防"登记了没落盘"）
 *
 * 用法：
 *   node .workbuddy/tools/asset/verify_wasteland.js          # 只报缺失
 *   node .workbuddy/tools/asset/verify_wasteland.js --strict # 有缺失即非零退出（门禁用）
 * ============================================================ */
(function () {
  var fs = require('fs'), path = require('path');
  var ROOT = path.join(__dirname, '..', '..', '..');

  /* ---- 最小浏览器 stub（与 smoke-test.js 同款，够 require 模块即可） ---- */
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  function makeEl() {
    return {
      tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, width: 760, height: 540, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {},
      setAttribute: function (k, v) { this._attrs[k] = v; }, getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function () { return makeEl(); }, querySelectorAll: function () { return []; },
      getContext: function () { return new Proxy({}, { get: function () { return function () { return { addColorStop: function () {} }; }; } }); },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width, height: this.height }; },
    };
  }
  global.document = {
    createElement: function () { return makeEl(); },
    querySelector: function () { return makeEl(); }, querySelectorAll: function () { return []; },
    getElementById: function () { return makeEl(); }, addEventListener: function () {}, readyState: 'complete',
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  /* ---- 同 index.html 顺序加载（绝对路径 —— 本文件在 .workbuddy/tools/ 下）---- */
  [ 'data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
    'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main' ]
    .forEach(function (m) {
      var p = path.join(ROOT, 'js', m + '.js');
      if (!fs.existsSync(p)) return;      /* v89.218 起 story.js 可能已退役 */
      try { require(p); }
      catch (e) { console.log('  ⚠ 加载 js/' + m + '.js 失败: ' + e.message); }
    });

  var G = global.GAME, DATA = G.DATA, ICO = G.icons;
  var AIDIR = path.join(ROOT, 'assets', 'icons', 'ui');

  /* ---- 穷举业务侧 id ---- */
  var groups = [];
  groups.push(['building', Object.keys(DATA.BUILDINGS || {}), 'get']);
  groups.push(['ext', Object.keys(DATA.EXT_BUILDINGS || {}), 'get']);
  groups.push(['res', (G.RES_KEYS || ['grain', 'wood', 'stone', 'iron', 'gold', 'pop']), 'get']);
  groups.push(['troop', Object.keys(DATA.TROOPS || {}), 'get']);
  /* 地形：DATA.TERRAIN 含 'city' 伪地形（非贴图），贴图 id 见 map.js ART_KEYS */
  groups.push(['terrain', ['plain', 'caoyuan', 'forest', 'zhaoze', 'lake', 'desert', 'hill'], 'get']);
  groups.push(['city', ['capital', 'zhou', 'jun', 'county'], 'art']);
  groups.push(['mat_*', (DATA.MATERIALS || []).map(function (m) { return m.id; }), 'mat']);
  groups.push(['slot', Object.keys(DATA.EQUIP_SLOT_NAMES || {}), 'slot']);
  /* 物品：位图按 type 提供（bmOf('item', type)），唯 11 类有位图 */
  var itemTypes = {};
  (DATA.ITEMS || []).forEach(function (it) { if (it && it.type) itemTypes[it.type] = 1; });
  groups.push(['item(type)', Object.keys(itemTypes), 'item']);

  /* 三种取层方式（对齐 ICON 的真实 API —— 见 icons.js bmOfType）：
       get  = ICON.layerOf(group, id)      building/ext/terrain/res/troop
       mat  = ICON.layerOf('mat_'+id, '')  复合 key（smoke 同款）
       slot = ICON.layerOf('slot_'+id, '')
       item = ICON.layerOf('item_'+type, '')
       art  = 贴图走 map.js ART_KEYS 硬编码路径，非 ICON.get —— 直接查磁盘 */
  var ART_KEYS = ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake',
    'terrain_forest', 'terrain_desert', 'terrain_hill',
    'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital'];
  function layerOf(mode, group, id) {
    if (mode === 'mat') return ICO.layerOf('mat_' + id, '');
    if (mode === 'slot') return ICO.layerOf('slot_' + id, '');
    if (mode === 'item') return ICO.layerOf('item_' + id, '');
    if (mode === 'art') {
      var k = group === 'city' ? 'city_' + id : group + '_' + id;
      return (ART_KEYS.indexOf(k) >= 0 && fs.existsSync(path.join(AIDIR, 'ai_' + k + '.png'))) ? 'bitmap' : 'vector';
    }
    return ICO.layerOf(group, id);
  }

  console.log('\n══ 素材层校验（废土换皮 · V4/V5）══\n');
  var total = 0, bitmap = 0, vector = 0;
  var byGroup = {};
  groups.forEach(function (g) {
    var label = g[0], ids = g[1], mode = g[2];
    var vb = [], bm = 0;
    ids.forEach(function (id) {
      total++;
      if (layerOf(mode, label, id) === 'bitmap') { bm++; bitmap++; } else { vb.push(id); vector++; }
    });
    byGroup[label] = { n: ids.length, bm: bm, vb: vb };
    var mark = vb.length === 0 ? '✅' : '⛔';
    console.log('  ' + mark + ' ' + (label + '            ').slice(0, 14) +
      ' ' + bm + '/' + ids.length + ' 位图' + (vb.length ? '  退回矢量: ' + vb.join(', ') : ''));
  });

  /* ---- 登记在册的位图，磁盘是否真存在 ---- */
  var F = global.BITMAPS ? global.BITMAPS.F : {};
  var files = Object.keys(F || {});
  var miss = files.filter(function (f) { return !fs.existsSync(path.join(AIDIR, f)); });
  console.log('\n  位图登记表: ' + files.length + ' 条 · 磁盘缺失: ' + miss.length +
    (miss.length ? ' → ' + miss.slice(0, 10).join(', ') : ' ✅'));
  /* ai_fort.png 已随 v89.222 登记（修掉历史漂移）；不再设白名单 */
  var diskExtra = fs.readdirSync(AIDIR).filter(function (f) {
    return /\.png$/.test(f) && !(F || {})[f];
  });
  if (diskExtra.length) console.log('  磁盘多出未登记: ' + diskExtra.join(', ') + '  ⛔');
  else console.log('  磁盘无未登记 PNG ✅');

  /* ---- 汇总 ---- */
  console.log('\n── 汇总 ──');
  console.log('  业务 id 合计 ' + total + ' · 位图 ' + bitmap + ' · 退回矢量 ' + vector);
  var bad = vector || miss.length || diskExtra.length;
  if (vector) {
    console.log('  ⛔ 退回矢量的（这些是"没换到位"的位置，逐条看是不是有意）:');
    Object.keys(byGroup).forEach(function (k) {
      if (byGroup[k].vb.length) console.log('     ' + k + ': ' + byGroup[k].vb.join(', '));
    });
  } else {
    console.log('  ✅ 全部业务 id 均由位图层提供（零退回矢量）');
  }

  if (process.argv.indexOf('--strict') >= 0 && bad) {
    console.log('\n  --strict：有缺失，非零退出');
    process.exit(1);
  }
  process.exit(0);      /* main.js 的 setInterval 会吊住进程，显式退出 */
})();
