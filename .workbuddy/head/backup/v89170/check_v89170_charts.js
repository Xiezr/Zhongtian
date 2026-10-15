/* v89.170 图表的程序化体检（本机模型读不了图 → 用 bbox 当眼睛）
   检查：① 文字两两重叠 ② 越界/贴边 ③ 折线穿字（顶点 + 段中点插值）
   运行：NODE_PATH=".../node_modules" node .workbuddy/tools/asset/check_v89170_charts.js */
var fs = require('fs'), path = require('path');
var { chromium } = require(path.join('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules', 'playwright-core'));
var R = 'E:/Deepseekdb/.workbuddy/tmp/';

(async function () {
  var wrap = '<html><body style="margin:0;padding:20px;background:#fff;width:700px">'
    + '<div id="box1">' + fs.readFileSync(R + 'w170_curve.svg', 'utf8') + '</div>'
    + '<div id="box2" style="margin-top:20px">' + fs.readFileSync(R + 'w170_items.svg', 'utf8') + '</div>'
    + '</body></html>';
  fs.writeFileSync(R + 'w170_render.html', wrap, 'utf8');

  var b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 760, height: 1200 } });
  await p.goto('file:///' + R + 'w170_render.html');
  await p.waitForTimeout(300);

  var out = await p.evaluate(function () {
    function hit(a, c, m) {
      m = m || 0;
      return a.x + a.width + m > c.x && c.x + c.width + m > a.x
        && a.y + a.height + m > c.y && c.y + c.height + m > a.y;
    }
    var rep = [], fail = 0;
    Array.prototype.slice.call(document.querySelectorAll('svg')).forEach(function (sv, si) {
      var vb = sv.viewBox.baseVal;
      var texts = Array.prototype.slice.call(sv.querySelectorAll('text'));
      var boxes = texts.map(function (t) {
        try { var bb = t.getBBox(); return { x: bb.x, y: bb.y, w: bb.width, h: bb.height, txt: (t.textContent || '').slice(0, 26) }; }
        catch (e) { return null; }
      }).filter(Boolean);
      /* ① 两两重叠（含 0.5px 容差，避免抗锯齿误报） */
      var ov = [];
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        if (hit({ x: boxes[i].x, y: boxes[i].y, width: boxes[i].w, height: boxes[i].h },
                { x: boxes[j].x, y: boxes[j].y, width: boxes[j].w, height: boxes[j].h }, -0.5)) {
          ov.push(boxes[i].txt + ' ⇄ ' + boxes[j].txt);
        }
      }
      /* ② 越界 / 贴边（<2px） */
      var oob = [];
      boxes.forEach(function (x) {
        if (x.x < 2 || x.y < 2 || x.x + x.w > vb.width - 2 || x.y + x.h > vb.height - 2) {
          oob.push(x.txt + ' @[' + x.x.toFixed(0) + ',' + x.y.toFixed(0) + ']');
        }
      });
      /* ③ 折线穿字（顶点 + 段中点；矩形条不查） */
      var cross = [];
      Array.prototype.slice.call(sv.querySelectorAll('polyline')).forEach(function (pl) {
        var raw = (pl.getAttribute('points') || '').trim().split(/\s+/).map(function (s2) {
          var q = s2.split(','); return { x: +q[0], y: +q[1] };
        });
        var pts = [];
        raw.forEach(function (q, k) {
          pts.push(q);
          if (k + 1 < raw.length) pts.push({ x: (q.x + raw[k + 1].x) / 2, y: (q.y + raw[k + 1].y) / 2 });
        });
        pts.forEach(function (pt) {
          boxes.forEach(function (x) {
            if (pt.x > x.x + 1 && pt.x < x.x + x.w - 1 && pt.y > x.y + 1 && pt.y < x.y + x.h - 1) {
              cross.push('(' + pt.x.toFixed(0) + ',' + pt.y.toFixed(0) + ') in 「' + x.txt + '」');
            }
          });
        });
      });
      var bad = ov.length + oob.length + cross.length;
      fail += bad;
      rep.push('SVG#' + si + '  ' + vb.width + 'x' + vb.height + ' · 文字 ' + boxes.length
        + ' · 两两重叠 ' + ov.length + ' · 越界/贴边 ' + oob.length + ' · 曲线穿字 ' + cross.length
        + (bad ? '  ❌' : '  ✅'));
      ov.slice(0, 8).forEach(function (x) { rep.push('   ⚠ 重叠: ' + x); });
      oob.slice(0, 8).forEach(function (x) { rep.push('   ⚠ 越界: ' + x); });
      cross.slice(0, 10).forEach(function (x) { rep.push('   ⚠ 穿字: ' + x); });
    });
    return { txt: rep.join('\n'), fail: fail };
  });
  console.log(out.txt);
  console.log(out.fail ? ('\n结论：' + out.fail + ' 处问题 ❌') : '\n结论：两图体检全绿 ✅');
  await b.close();
  process.exit(out.fail ? 1 : 0);
})();
