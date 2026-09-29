var fs = require('fs'), path = require('path');
var { chromium } = require(path.join('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules', 'playwright-core'));
var R = 'E:/Deepseekdb/.workbuddy/tmp/';
(async function () {
  var browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await browser.newPage({ viewport: { width: 720, height: 900 } });
  var res = await p.evaluate(function () { return 'need file'; }); /* 占位：真实检查在页面加载后 */
  await p.goto('file:///' + R + 'render_light.html');
  await p.waitForTimeout(300);
  var out = await p.evaluate(function () {
    function hit(a, b, m) {
      m = m || 0;
      return a.x + a.width + m > b.x && b.x + b.width + m > a.x
        && a.y + a.height + m > b.y && b.y + b.height + m > a.y;
    }
    var rep = [];
    ["svg"].forEach(function () {});
    var svgs = Array.prototype.slice.call(document.querySelectorAll('svg'));
    svgs.forEach(function (sv, si) {
      var vb = sv.viewBox.baseVal;
      var texts = Array.prototype.slice.call(sv.querySelectorAll('text'));
      var boxes = texts.map(function (t, i) {
        try { var b = t.getBBox(); return { i: i, x: b.x, y: b.y, w: b.width, h: b.height, txt: t.textContent }; }
        catch (e) { return null; }
      }).filter(Boolean);
      /* ① 文字两两重叠 */
      var ov = [];
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        if (hit(boxes[i], boxes[j], -1)) ov.push(boxes[i].txt + ' ⇄ ' + boxes[j].txt);
      }
      /* ② 越界（超出 viewBox 或贴边 <4px） */
      var oob = [];
      boxes.forEach(function (b) {
        if (b.x < 2 || b.y < 2 || b.x + b.w > vb.width - 2 || b.y + b.h > vb.height - 2) {
          oob.push(b.txt + ' @[' + b.x.toFixed(0) + ',' + b.y.toFixed(0) + ']');
        }
      });
      /* ③ 折线点落进文字框（曲线穿字） */
      var cross = [];
      var pls = Array.prototype.slice.call(sv.querySelectorAll('polyline'));
      pls.forEach(function (pl) {
        var raw = (pl.getAttribute('points') || '').trim().split(/\s+/).map(function (s2) {
          var q = s2.split(','); return { x: +q[0], y: +q[1] };
        });
        var pts = [];
        raw.forEach(function (q, k) {
          pts.push(q);
          if (k + 1 < raw.length) {                       /* 段中点插值（防线段穿字而顶点全在外） */
            pts.push({ x: (q.x + raw[k + 1].x) / 2, y: (q.y + raw[k + 1].y) / 2 });
          }
        });
        pts.forEach(function (pt, pi) {
          boxes.forEach(function (b) {
            if (pt.x > b.x + 1 && pt.x < b.x + b.w - 1 && pt.y > b.y + 1 && pt.y < b.y + b.h - 1) {
              cross.push('point#' + pi + ' (' + pt.x.toFixed(0) + ',' + pt.y.toFixed(0) + ') in 「' + b.txt + '」');
            }
          });
        });
      });
      rep.push('SVG#' + si + '  ' + vb.width + 'x' + vb.height + ' · 文字 ' + boxes.length
        + ' · 两两重叠 ' + ov.length + ' · 越界/贴边 ' + oob.length + ' · 曲线穿字 ' + cross.length);
      ov.slice(0, 8).forEach(function (s2) { rep.push('   ⚠ 重叠: ' + s2); });
      oob.slice(0, 8).forEach(function (s2) { rep.push('   ⚠ 越界: ' + s2); });
      cross.slice(0, 12).forEach(function (s2) { rep.push('   ⚠ 穿字: ' + s2); });
    });
    return rep.join('\n');
  });
  console.log(out);
  await browser.close();
  process.exit(0);
})();
