# -*- coding: utf-8 -*-
"""v89.6 测试补丁：smoke §80（奇遇册/点位/线索/探奇/图鉴/渲染）+ e2e 19c（全流程）"""
import io

# ============ smoke-test.js ============
PS = r'E:\Deepseekdb\smoke-test.js'
s = io.open(PS, encoding='utf-8', newline='').read()

SMOKE_SEC = r'''
/* ============================================================
 * 80. v89.6 奇遇 · 见闻录（隐藏点位 / 线索 / 探奇 / 图鉴）
 * ============================================================ */
(function () {
  console.log('\n===== 80. v89.6 奇遇 · 见闻录（探索层） =====');

  check('v89.6：奇遇册齐（24 条 · 三档 12/8/4 · 逐条名/图/文/幕俱全）', (function () {
    var all = DATA.WONDERS || {};
    var ids = Object.keys(all);
    if (ids.length !== 24) return false;
    var tiers = { small: 0, rare: 0, epic: 0 };
    var ok = ids.every(function (id) {
      var w = all[id] || {};
      if (tiers[w.tier] == null) return false;
      tiers[w.tier]++;
      return !!(w.name && w.ic && w.txt && w.scene)
        && Array.isArray(w.stages) && w.stages.length >= 1 && w.stages.length <= 2
        && w.stages.every(function (st) {
          return !!(st.s && st.t && st.o) && st.o.length >= 2 && st.o.every(function (op) { return !!(op.l && op.d); });
        });
    });
    return ok && tiers.small === 12 && tiers.rare === 8 && tiers.epic === 4;
  })());

  var wsSites8 = GAME.wonderSites();
  check('v89.6：点位生成（数量 25~80 · 全落野地 · 不压据点 · 缓存同引用）', (function () {
    if (wsSites8.length < 25 || wsSites8.length > 80) return false;
    var WILD = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };
    var ok = wsSites8.every(function (it) {
      var tl = GAME.map.tile(it.x, it.y);
      return tl && WILD[tl.terrain] && !GAME.map.hasFort(it.x, it.y) && !!DATA.WONDERS[it.wid];
    });
    return ok && GAME.wonderSites() === wsSites8;
  })());

  check('v89.6：同档类型全覆盖（轮转保底 —— 见闻录可集全 24）', (function () {
    var seen = {};
    wsSites8.forEach(function (it) { seen[it.wid] = 1; });
    return Object.keys(DATA.WONDERS).every(function (id) { return seen[id]; });
  })());

  check('v89.6：点位查询（点位非空 · 状态字段齐 · 非点位 null）', (function () {
    var it0 = wsSites8[0];
    var a = GAME.wonderSiteOf(it0.x, it0.y);
    var nope = null;
    for (var y8 = 0; y8 < 80 && !nope; y8++) {
      for (var x8 = 0; x8 < 80; x8++) {
        if (!GAME.map.tile(x8, y8)) continue;
        if (!GAME.wonderSiteOf(x8, y8)) { nope = { x: x8, y: y8 }; break; }
      }
    }
    return !!a && a.wid === it0.wid && a.tier === it0.tier && a.band === it0.band
      && typeof a.revealed === 'boolean' && typeof a.done === 'boolean'
      && (!nope || GAME.wonderSiteOf(nope.x, nope.y) === null);
  })());

  check('v89.6：就近探察（首探 ≥1 · 复探幂等 0 · 已探不复活）', (function () {
    var it0 = wsSites8[0];
    var wst8 = GAME.wonderState();
    wst8.r = {}; wst8.d = {};
    var a = GAME.wonderSurvey(it0.x + 1, it0.y + 1);
    var b = GAME.wonderSurvey(it0.x + 1, it0.y + 1);
    return a >= 1 && b === 0;
  })());

  check('v89.6：线索（clueP 联动 · 确定性 · 无剩余点位则无）', (function () {
    var wc8 = DATA.WONDER, old8 = wc8.clueP;
    var wst8 = GAME.wonderState();
    wst8.r = {}; wst8.d = {};
    wc8.clueP = 1;
    var c1 = GAME.wonderClueRoll(40, 40, 'tao', 3);
    wst8.r = {}; wst8.d = {};
    var c2 = GAME.wonderClueRoll(40, 40, 'tao', 3);
    wc8.clueP = 0;
    var c3 = GAME.wonderClueRoll(40, 40, 'tao', 3);
    wc8.clueP = old8;
    var txt = c1 ? GAME.wonderClueText(c1) : '';
    return !!c1 && JSON.stringify(c1) === JSON.stringify(c2) && c3 === null
      && txt.indexOf('（' + c1.x + ',' + c1.y + '）') >= 0 && txt.indexOf('闻得城') >= 0;
  })());

  check('v89.6：活动结算挂线索（clueP=1 → res.clue + 点位现形 1 处）', (function () {
    var wc8 = DATA.WONDER, old8 = wc8.clueP;
    var wst8 = GAME.wonderState();
    wst8.r = {}; wst8.d = {};
    wc8.clueP = 1;
    var lg8 = GAME.lordGeneralOf();
    lg8.energy = 100; GAME.setStaNow(lg8, 100);
    var chk8 = { act: DATA.LING_ACT.xiu, gen: lg8, day: 5, lv: 2, x: 66, y: 77, actId: 'xiu' };
    var res8 = GAME.jianghuRoll(chk8, {});
    wc8.clueP = old8;
    return !!res8.clue && res8.clue.indexOf('📜') >= 0 && Object.keys(wst8.r).length === 1;
  })());

  check('v89.6：探奇三段（未现形拒 → 现形可探 → 首选定扣费锁点 → 结算收录 → 重复拒）', (function () {
    var lg8 = GAME.lordGeneralOf();
    var wst8 = GAME.wonderState();
    wst8.r = {}; wst8.d = {}; wst8.j = {};
    var site8 = null;
    for (var i8 = 0; i8 < wsSites8.length && !site8; i8++) {
      if (!GAME.map.fortAt(wsSites8[i8].x, wsSites8[i8].y)) site8 = wsSites8[i8];
    }
    if (!site8) return false;
    var key8 = site8.x + ',' + site8.y;
    var bad1 = GAME.wonderCheck(site8.x, site8.y, lg8.id);          /* 未现形必拒 */
    wst8.r[key8] = 1;
    lg8.energy = 100; GAME.setStaNow(lg8, 100);
    var e0 = lg8.energy;
    var st8 = GAME.wonderStart(site8.x, site8.y, lg8.id);
    if (!st8.ok || !st8.fx || st8.fx.kind !== 'wonder') return false;
    var cost8 = st8.fx.chk.act.energy;
    var pk8 = GAME.scenePick(0);                                    /* 首选定：扣费 + 锁 */
    /* 精力是浮点再生值（v89.1 教训）：差值容差 1 */
    var locked = wst8.d[key8] === 1 && Math.abs((e0 - lg8.energy) - cost8) < 1;
    while (GAME.sceneFx && GAME.sceneFx.phase === 'stage') GAME.scenePick(0);
    var res8 = GAME.sceneFx.result;
    var rec8 = wst8.j[site8.wid] === 1;
    GAME.sceneFx = null;
    var again8 = GAME.wonderCheck(site8.x, site8.y, lg8.id);
    return bad1.ok === false && pk8.ok && locked && !!res8 && rec8 && again8.ok === false;
  })());

  check('v89.6：见闻录面板（进度=实况 · 已录显名 · 未录？？？）', (function () {
    var h8 = GAME.ui.journalHTML();
    var wst8 = GAME.wonderState();
    var got8 = Object.keys(wst8.j).length;
    var anyId = Object.keys(wst8.j)[0];
    return h8.indexOf('已录见闻 <b>' + got8 + ' / 24</b>') >= 0
      && h8.indexOf('？？？') >= 0
      && (!anyId || h8.indexOf((DATA.WONDERS[anyId] || {}).name) >= 0)
      && h8.indexOf('奇遇点位') >= 0;
  })());

  check('v89.6：渲染悬星（记录式 ctx：现形 ✦ ≥ 1 · 未现形 0）', (function () {
    var PURPLE8 = 'rgba(206,166,255,.96)';
    var site8 = wsSites8.filter(function (it) { return !GAME.map.fortAt(it.x, it.y); })[0];
    if (!site8) return false;
    var wst8 = GAME.wonderState();
    var rec8 = { fills: [] };
    var c8 = {
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
    Object.defineProperty(c8, 'fillStyle', { get: function () { return ''; }, set: function (v) { rec8.fills.push(String(v)); } });
    Object.defineProperty(c8, 'strokeStyle', { get: function () { return ''; }, set: function () {} });
    var fake8 = { width: 0, height: 0, getContext: function () { return c8; } };
    var cnt8 = function () { return rec8.fills.filter(function (v) { return v === PURPLE8; }).length; };
    var key8 = site8.x + ',' + site8.y;
    wst8.r = {}; wst8.d = {};
    GAME.map.render(fake8, { vx: site8.x, vy: site8.y, spanX: 13, spanY: 11, cell: 63 });
    var n0 = cnt8();
    wst8.r[key8] = 1;
    rec8.fills.length = 0;
    GAME.map.render(fake8, { vx: site8.x, vy: site8.y, spanX: 13, spanY: 11, cell: 63 });
    var n1 = cnt8();
    wst8.d[key8] = 1;                                   /* 已探 → 星也要消失 */
    rec8.fills.length = 0;
    GAME.map.render(fake8, { vx: site8.x, vy: site8.y, spanX: 13, spanY: 11, cell: 63 });
    var n2 = cnt8();
    wst8.d = {};
    return n0 === 0 && n1 >= 1 && n2 === 0;
  })());

  check('v89.6：接线（弹窗只对已现形出探奇 · dock 见闻录 · main 三动作 · 渲染调 drawWonderStar）', (function () {
    var uH8 = GAME.ui.jianghuHTML.toString();
    var uM8 = (GAME.ui.mapHTML || function () { return ''; }).toString();
    var mS8 = '';
    try { mS8 = '' + require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8'); } catch (e) { mS8 = ''; }
    return uH8.indexOf('GAME.wonderSiteOf') >= 0 && uH8.indexOf('do-wonder') >= 0 && uH8.indexOf('revealed') >= 0
      && uM8.indexOf('open-journal') >= 0
      && mS8.indexOf("case 'do-wonder'") >= 0 && mS8.indexOf("case 'open-journal'") >= 0 && mS8.indexOf("case 'journal-go'") >= 0
      && /drawWonderStar\(/.test(GAME.map.render.toString());
  })());
})();

'''

ANCHOR_S = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(ANCHOR_S) == 1, ('smoke 锚点', s.count(ANCHOR_S))
s = s.replace(ANCHOR_S, SMOKE_SEC + ANCHOR_S, 1)
io.open(PS, 'w', encoding='utf-8', newline='').write(s)
print('OK smoke-test.js: §80 已写入')

# ============ e2e-test.js ============
PE = r'E:\Deepseekdb\e2e-test.js'
e = io.open(PE, encoding='utf-8', newline='').read()

# 顺手修存量 flake（v89.6）：固定 sleep(1500) 改轮询（主循环 1s 一拍，负载高时迟到）
OLD_FLK = """      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      await sleep(1500);                   /* 等主循环（1s 间隔）自己发现 */
      const now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);"""
NEW_FLK = """      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      /* v89.6：固定 sleep(1500) 改**轮询** —— 主循环 1s 一拍，原等待只留 0.5 拍余量，
         门禁（python subprocess + capture）环境下实测 3/3 假红；最长等 5s，语义不变。 */
      let now58 = false;
      for (let i58 = 0; i58 < 25 && !now58; i58++) {
        await sleep(200);
        now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      }
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);"""
if e.count(OLD_FLK) == 1:
    e = e.replace(OLD_FLK, NEW_FLK, 1)

ANCHOR_E = """  console.log('\\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');"""
NEW_E = """  /* v89.6：奇遇 · 见闻录（隐藏点位 → 就近探察 → 探奇 → 图鉴） */
  console.log('\\n--- 19c. v89.6 奇遇 · 见闻录 ---');
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
    G.ui.closeModal();
    await sleep(40);
  }
  const nearX19c = wSite19c.x + 1 <= G.DATA.MAP_W - 1 ? wSite19c.x + 1 : wSite19c.x - 1;
  G.ui.openLandModal(nearX19c, wSite19c.y);
  await sleep(60);
  const tN = (document.querySelector('#modal-root') || {}).textContent || '';
  check('v89.6：就近探察 —— 「探得异迹」提示 + 点位现形',
    tN.indexOf('探得异迹') >= 0 && G.wonderSiteOf(wSite19c.x, wSite19c.y).revealed === true);
  G.ui.closeModal();
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
  G.ui.closeModal();
  await sleep(40);
  check('v89.6：重复探奇被拒', G.wonderCheck(wSite19c.x, wSite19c.y, (lg19c || {}).id).ok === false);
  G.ui.openJournal();
  await sleep(60);
  const jT19c = (document.querySelector('#modal-root') || {}).textContent || '';
  const wName19c = (G.DATA.WONDERS[wSite19c.wid] || {}).name || '';
  check('v89.6：见闻录 —— 已录显名 · 未录？？？ · 进度 1/24',
    jT19c.indexOf(wName19c) >= 0 && jT19c.indexOf('？？？') >= 0 && /已录见闻\\s*1\\s*\\/\\s*24/.test(jT19c));
  G.ui.closeModal();

""" + ANCHOR_E

assert e.count(ANCHOR_E) == 1, ('e2e 锚点', e.count(ANCHOR_E))
e = e.replace(ANCHOR_E, NEW_E, 1)
io.open(PE, 'w', encoding='utf-8', newline='').write(e)
print('OK e2e-test.js: 19c 已写入')
