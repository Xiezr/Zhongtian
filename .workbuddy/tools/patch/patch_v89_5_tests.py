# -*- coding: utf-8 -*-
"""v89.5 测试补丁：smoke §79（灵机语义/阈值/记录式渲染/点选）+ e2e 19b（悬旗接线）"""
import io

# ============ smoke-test.js ============
PS = r'E:\Deepseekdb\smoke-test.js'
s = io.open(PS, encoding='utf-8', newline='').read()

SMOKE_SEC = r'''
/* ============================================================
 * 79. v89.5 灵机之地（灵机旗：事数 × 等级 达阈 → 大地图悬青旗）
 * ============================================================ */
(function () {
  console.log('\n===== 79. v89.5 灵机之地（地图悬旗 + 点选信息） =====');

  check('v89.5：JH_MARK 阈值表存在（minScore 为数字）',
    !!(DATA.JH_MARK && typeof DATA.JH_MARK.minScore === 'number'));

  /* 扫三类样本：灵机格 / 普通有事格 / 荒僻格（+ 一块平地） */
  var q5 = null, ord5 = null, emp5 = null, pl5 = null;
  for (var yy5 = 3; yy5 < 240 && !(q5 && ord5 && emp5 && pl5); yy5++) {
    for (var xx5 = 3; xx5 < 240; xx5++) {
      var tl5 = GAME.map.tile(xx5, yy5);
      if (!tl5) continue;
      if (GAME.jianghuCands(tl5.terrain).length === 0) {
        if (!pl5 && tl5.terrain === 'plain') pl5 = { x: xx5, y: yy5 };
        continue;
      }
      if (GAME.map.fortAt(xx5, yy5)) continue;
      var si5 = GAME.jianghuSpotInfo(xx5, yy5);
      if (si5 && si5.mark && !q5) q5 = { x: xx5, y: yy5 };
      else if (si5 && !si5.mark && !ord5) ord5 = { x: xx5, y: yy5 };
      else if (!si5 && !emp5) emp5 = { x: xx5, y: yy5 };
    }
  }
  check('v89.5：三类样本齐全（灵机 / 普通有事 / 荒僻 / 平地）', !!(q5 && ord5 && emp5 && pl5),
    JSON.stringify({ q: q5, ord: ord5, emp: emp5, pl: pl5 }));

  check('v89.5：灵机 = 事数 × 等级（与 actsAt / wildLevelNow 逐位一致）', (function () {
    if (!q5) return false;
    var s5 = GAME.jianghuSpotInfo(q5.x, q5.y);
    return s5.n === GAME.jianghuActsAt(q5.x, q5.y).length
      && s5.lv === GAME.map.wildLevelNow(q5.x, q5.y)
      && s5.score === s5.n * s5.lv
      && s5.mark === (s5.score >= DATA.JH_MARK.minScore);
  })());

  check('v89.5：确定性（同格两次调用逐位一致）', (function () {
    if (!q5) return false;
    var a5 = GAME.jianghuSpotInfo(q5.x, q5.y), b5 = GAME.jianghuSpotInfo(q5.x, q5.y);
    return a5.n === b5.n && a5.lv === b5.lv && a5.score === b5.score && a5.mark === b5.mark;
  })());

  check('v89.5：荒僻 / 平地返回 null（无旗可悬）', (function () {
    return (!emp5 || GAME.jianghuSpotInfo(emp5.x, emp5.y) === null)
      && (!pl5 || GAME.jianghuSpotInfo(pl5.x, pl5.y) === null);
  })());

  check('v89.5：阈值联动（拉满 → 全不标；归零 → 有事必标；复原）', (function () {
    if (!q5 || !ord5) return false;
    var old5 = DATA.JH_MARK.minScore;
    DATA.JH_MARK.minScore = 9999;
    var off5 = GAME.jianghuSpotInfo(q5.x, q5.y).mark === false;
    DATA.JH_MARK.minScore = 0;
    var on5 = GAME.jianghuSpotInfo(q5.x, q5.y).mark === true
      && GAME.jianghuSpotInfo(ord5.x, ord5.y).mark === true;
    DATA.JH_MARK.minScore = old5;
    return off5 && on5 && GAME.jianghuSpotInfo(q5.x, q5.y).mark === true;
  })());

  /* 记录式 ctx：把 render 真跑一遍，数「青旗」旗面色的 fill 次数 */
  var JADE5 = 'rgba(126,226,198,.96)';
  check('v89.5：记录式渲染 —— 有灵机则悬旗（≥1）且阈值拉满归零（=0）', (function () {
    if (!q5) return false;
    var rec5 = { fills: [] };
    var c5 = {
      canvas: { width: 0, height: 0 },
      beginPath: function () {}, closePath: function () {}, moveTo: function () {}, lineTo: function () {},
      quadraticCurveTo: function () {}, bezierCurveTo: function () {}, arc: function () {}, ellipse: function () {},
      rect: function () {}, roundRect: function () {}, fill: function () {}, stroke: function () {},
      fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
      save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}, rotate: function () {},
      clip: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {},
      measureText: function () { return { width: 10 }; },
      drawImage: function () {}, createPattern: function () { return null; },
      createLinearGradient: function () { return { addColorStop: function () {} }; },
      createRadialGradient: function () { return { addColorStop: function () {} }; },
      createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      getImageData: function (x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData: function () {},
      font: '', textAlign: '', textBaseline: '', lineWidth: 1, globalAlpha: 1
    };
    Object.defineProperty(c5, 'fillStyle', { get: function () { return ''; }, set: function (v) { rec5.fills.push(String(v)); } });
    Object.defineProperty(c5, 'strokeStyle', { get: function () { return ''; }, set: function () {} });
    var fake5 = { width: 0, height: 0, getContext: function () { return c5; } };
    var jade5 = function () { return rec5.fills.filter(function (v) { return v === JADE5; }).length; };
    GAME.map.render(fake5, { vx: q5.x, vy: q5.y, spanX: 13, spanY: 11, cell: 63 });
    var n1_5 = jade5();
    var old5b = DATA.JH_MARK.minScore;
    DATA.JH_MARK.minScore = 9999;
    rec5.fills.length = 0;
    GAME.map.render(fake5, { vx: q5.x, vy: q5.y, spanX: 13, spanY: 11, cell: 63 });
    var n2_5 = jade5();
    DATA.JH_MARK.minScore = old5b;
    return n1_5 >= 1 && n2_5 === 0;
  })());

  check('v89.5：点选信息（灵机 → ×n·灵机 / 荒僻 → 荒僻 / 平地 → 无后缀）', (function () {
    if (!q5 || !emp5 || !pl5) return false;
    var oldPick5 = GAME.ui.mapPick;
    GAME.ui.mapPick = { kind: 'wild', x: q5.x, y: q5.y };
    var t1_5 = GAME.ui.mapPickText();
    GAME.ui.mapPick = { kind: 'land', x: emp5.x, y: emp5.y };
    var t2_5 = GAME.ui.mapPickText();
    GAME.ui.mapPick = { kind: 'land', x: pl5.x, y: pl5.y };
    var t3_5 = GAME.ui.mapPickText();
    GAME.ui.mapPick = oldPick5;
    return t1_5.indexOf('江湖事 ×' + GAME.jianghuSpotInfo(q5.x, q5.y).n) >= 0 && t1_5.indexOf('灵机') >= 0
      && t2_5.indexOf('荒僻') >= 0 && t2_5.indexOf('江湖事') < 0
      && t3_5.indexOf('荒僻') < 0 && t3_5.indexOf('江湖事') < 0;
  })());

  check('v89.5：接线（render 调 drawJhPennant；地图与 UI 点选同走 jianghuSpotInfo）', (function () {
    var mr5 = GAME.map.render.toString();
    return /drawJhPennant\(/.test(mr5)
      && /GAME\.jianghuSpotInfo\(/.test(mr5)
      && /GAME\.jianghuSpotInfo\(/.test(GAME.ui.mapPickText.toString());
  })());
})();

'''

ANCHOR_S = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(ANCHOR_S) == 1, ('smoke 锚点', s.count(ANCHOR_S))
s = s.replace(ANCHOR_S, SMOKE_SEC + ANCHOR_S, 1)
io.open(PS, 'w', encoding='utf-8', newline='').write(s)
print('OK smoke-test.js: §79 已写入')

# ============ e2e-test.js ============
PE = r'E:\Deepseekdb\e2e-test.js'
e = io.open(PE, encoding='utf-8', newline='').read()

OLD_E = """  check('点击地图格子有响应', true, document.querySelector('#modal-root').innerHTML.length > 0 ? '弹出面板' : '选中格子');
  G.ui.closeModal();

  console.log('\\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');"""

NEW_E = """  check('点击地图格子有响应', true, document.querySelector('#modal-root').innerHTML.length > 0 ? '弹出面板' : '选中格子');
  G.ui.closeModal();

  /* v89.5：灵机之地 —— 地图悬青旗（渲染接线 + 点选提示 + 真实点击） */
  console.log('\\n--- 19b. v89.5 灵机之地（地图悬旗） ---');
  check('v89.5：渲染接线含青旗（render 调 drawJhPennant）', /drawJhPennant\\(/.test(G.map.render.toString()));
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
    const v = G.map._view;
    const sx = v.ox + (q19b.x - q19b.y) * v.HW, sy = v.oy + (q19b.x + q19b.y) * v.HH;
    if (!(sx > 0 && sy > 0 && sx < cv19.width && sy < cv19.height)) return false;
    const oldRect = cv19.getBoundingClientRect;
    cv19.getBoundingClientRect = function () { return { left: 0, top: 0, width: cv19.width, height: cv19.height }; };
    cv19.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: sx, clientY: sy }));
    cv19.getBoundingClientRect = oldRect;
    return (document.querySelector('#map-pick-info') || {}).textContent.indexOf('灵机') >= 0;
  })());

  console.log('\\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');"""

assert e.count(OLD_E) == 1, ('e2e 锚点', e.count(OLD_E))
e = e.replace(OLD_E, NEW_E, 1)
io.open(PE, 'w', encoding='utf-8', newline='').write(e)
print('OK e2e-test.js: 19b 已写入')
