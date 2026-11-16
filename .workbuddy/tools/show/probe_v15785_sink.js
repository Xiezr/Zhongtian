/* 沉岛一致性：sphere 里被沉的格，2D 地图层（map.tile）还认为是什么？
   若两套不一致 → 野地/村社/据点会落在"海上"，这是 §195/§331 翻红的嫌疑。 */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  const out = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    var SP = G.sphere, cells = SP.cells;
    /* 找"类型是 lake 但高程仍 >= 0"的格（= 被沉岛压过的迹象） */
    var sunk = [];
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].type === 'lake' && cells[i].e > -0.005 && cells[i].e < 0.5) sunk.push(i);
    }
    /* 抽 12 个看 map.tile 怎么说 */
    var rows = [];
    for (var k = 0; k < Math.min(12, sunk.length); k++) {
      var ci = sunk[k], c = cells[ci];
      var t = (c.lon != null && (G.map.xyOfLonLat || SP.xyOfLonLat)) ? SP.xyOfLonLat(c.lon, c.lat) : null;
      var tile = t ? G.map.tile(t.x, t.y) : null;
      rows.push({ ci: ci, e: +c.e.toFixed(3), type: c.type,
        xy: t ? [t.x, t.y] : null, tileTerrain: tile ? tile.terrain : null });
    }
    /* 统计：野地/村社/据点是否落在 lake 格上 */
    var onSea = function (arr, key) {
      var n = 0, tot = 0;
      (arr || []).forEach(function (o) {
        var ci = (key === 'xy' && o.x != null) ? (SP.ciOfXY ? SP.ciOfXY(o.x, o.y) : -1) : o.ci;
        if (ci == null || ci < 0 || !cells[ci]) return;
        tot++;
        if (cells[ci].type === 'lake') n++;
      });
      return { onSea: n, total: tot };
    };
    return {
      cells: cells.length, sunk: sunk.length,
      wilds: onSea(st.wilds, 'ci'), forts: onSea(st.forts, 'ci'),
      villages: (G.village && G.village.listAll) ? onSea(G.village.listAll().map(function (id) { return { ci: id }; }), 'ci') : null,
      rows: rows, ver: G.VERSION
    };
  });
  console.log('格数 ' + out.cells + ' · 疑似被沉 ' + out.sunk + ' · 版本 ' + out.ver);
  console.log('野地落在海格的 = ' + JSON.stringify(out.wilds));
  console.log('据点落在海格的 = ' + JSON.stringify(out.forts));
  console.log('村社 = ' + JSON.stringify(out.villages));
  out.rows.forEach(function (r) {
    console.log('  ci=' + r.ci + ' e=' + r.e + ' type=' + r.type + ' xy=' + JSON.stringify(r.xy) + ' tileTerrain=' + r.tileTerrain);
  });
  console.log('页面异常 ' + errs.length);
  await browser.close();
})();
