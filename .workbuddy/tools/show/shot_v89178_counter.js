/* v89.178 实机验证（真浏览器）：
   ① 出征面板预估区——「共派遣」/「区间」/「情报 Lv」/「⚑ 此战凶险」全部退役；
      「兵力偏少，此战凶险」合并标签在册（构造"兵力偏少"档）
   ② 克制降档的出口级复核（troopCounterOf 新值：×2 / ×1.5）
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/show/shot_v89178_counter.js */
var path = require('path');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var fails = 0, n = 0;
function chk(name, ok, extra) {
  n++;
  if (!ok) fails++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name + (extra != null ? '  [' + extra + ']' : ''));
}

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验178', cityName: '许都', region: '碎垣', mapSeed: 20260978 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
  });
  await p.waitForTimeout(450);

  /* ---- 新局城无兵（city.army 空）→ 先发兵，否则 expPowerOf.mine 恒 0（"填入兵力后显示对比"） ---- */
  await p.evaluate(function () {
    var G = window.GAME;
    G.currentCity().army = { gongjian: 60000, daodun: 20000 };
  });

  /* ---- 打开出征面板（找最小等级的野地，守军弱好构造） ---- */
  var setup = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var best = null;
    for (var r = 1; r <= 14; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        var wlv = G.map.wildLevelNow(x, y);
        if (wlv < 1) continue;
        if (!best || wlv < best.lv) best = { x: x, y: y, lv: wlv };
      }
      if (best && r >= 6) break;
    }
    if (!best) return { ok: false };
    G.ui.openExpModal({ kind: 'wild', x: best.x, y: best.y });
    return { ok: true, lv: best.lv, x: best.x, y: best.y };
  });
  chk('出征面板打开（野地 Lv' + setup.lv + '）', setup.ok, JSON.stringify(setup));
  if (!setup.ok) { await b.close(); console.log('结果: ' + (n - fails) + '/' + n); process.exit(1); }
  await p.waitForTimeout(400);

  /* ---- 构造「兵力偏少」：循环调兵力逼近 ratioLo<1 && ratioHi>=0.6 ---- */
  var tune = await p.evaluate(function () {
    var G = window.GAME;
    var id0 = 'gongjian';
    function setV(v) {
      var el = document.getElementById('exp-' + id0);
      if (!el) return false;
      el.value = String(v);
      G.ui.updateExpMarch();
      return true;
    }
    var hit = null, trail = [];
    var v = 1;
    for (var i = 0; i < 26; i++) {
      if (!setV(v)) { trail.push('no-input'); break; }
      var q = G.ui.expPowerOf();
      if (!q) { trail.push('q=null'); break; }
      trail.push('v=' + v + ' lo=' + q.ratioLo + ' hi=' + q.ratioHi);
      if (q.ratioLo != null && q.ratioLo < 1 && q.ratioHi != null && q.ratioHi >= 0.6) { hit = q; break; }
      if (q.ratioLo != null && q.ratioLo >= 1) break;   /* 越过窗口（err 带 ~2.2x 宽，正常不会跳） */
      v = Math.max(v + 1, Math.round(v * 1.4));
    }
    return { ok: !!hit, id0: id0, trail: trail.slice(-6).join(' | ') };
  });
  chk('构造「兵力偏少」档（ratioLo<1 ≤ ratioHi·0.6~1）', tune.ok, tune.trail);
  await p.waitForTimeout(250);

  /* ---- 读面板文案 ---- */
  var s2 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var pow = document.getElementById('exp-power');
    return {
      rootText: root ? root.textContent : '',
      powText: pow ? pow.textContent : '',
      hasSum: !!(root && root.querySelector('#exp-sum')),
      powHTML: pow ? pow.innerHTML : '',
    };
  });
  chk('无「共派遣」', s2.rootText.indexOf('共派遣') < 0, '');
  chk('无「区间：我 1 :」', s2.rootText.indexOf('区间') < 0, '');
  chk('无「情报 Lv」', s2.rootText.indexOf('情报 Lv') < 0, '');
  chk('无独立「⚑ 此战凶险」行', s2.rootText.indexOf('⚑') < 0, '');
  chk('「兵力偏少，此战凶险」在册', s2.powText.indexOf('兵力偏少，此战凶险') >= 0,
    s2.powText.replace(/\s+/g, ' ').slice(0, 150));
  chk('#exp-sum 元素不存在', !s2.hasSum, '');

  /* ---- 克制出口复核（新值） ---- */
  var cnt = await p.evaluate(function () {
    var G = window.GAME;
    function pick(id) {
      var c = G.ui.troopCounterOf(id);
      var s = '';
      if (c) {
        s += '克[' + c.beats.map(function (x) { return x.name + '×' + x.mul; }).join(',') + ']';
        s += ' 抗[' + c.resists.map(function (x) { return x.name + '×' + x.mul; }).join(',') + ']';
      }
      return s;
    }
    return { qingji: pick('qingji'), daodun: pick('daodun'), chuangnu: pick('chuangnu'),
      gongjian: pick('gongjian') };
  });
  chk('伏击车 抗[弓箭手×2]（改前 ×4）', cnt.qingji.indexOf('弓箭手×2') >= 0, cnt.qingji);
  chk('刀盾 抗[弓箭手×2]（改前 ×3）', cnt.daodun.indexOf('弓箭手×2') >= 0, cnt.daodun);
  chk('无人轰炸机 克[自行火炮×3]（专项保留）', cnt.chuangnu.indexOf('自行火炮×3') >= 0, cnt.chuangnu);

  /* ---- 截图（出征面板元素） ---- */
  try {
    var box = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
    });
    if (box) await p.screenshot({ path: OUT + 'v89178-exp.png', fullPage: true, clip: box });
    console.log('  截图: ' + OUT + 'v89178-exp.png');
  } catch (e) { console.log('  截图失败: ' + e.message); }

  await b.close();
  console.log('结果: ' + (n - fails) + '/' + n + (fails ? ' 有失败!' : ' 全过'));
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error('崩: ' + e.stack); process.exit(2); });
