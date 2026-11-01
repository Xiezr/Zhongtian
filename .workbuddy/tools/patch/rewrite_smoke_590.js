/* v156.24：重写 §590 —— 口径从「13 州(state)」换成「地图省/市/区(_settle)」
 * 用法：node .workbuddy/tools/patch/rewrite_smoke_590.js
 */
'use strict';
var fs = require('fs');
var p = 'smoke-test.js';
var s = fs.readFileSync(p, 'utf8');

var head = '  /* ===================== §590 占领首府 → 该州辖地全境在望 =====================';
var tail = `console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');`;
var a = s.indexOf(head);
if (a < 0) {
  /* 可能已被换成新口径 */
  if (s.indexOf('§590 省/市/区首府') >= 0) { console.log('SKIP: 已是新口径'); process.exit(0); }
  console.error('ANCHOR NOT FOUND'); process.exit(1);
}
var b = s.indexOf(tail, a);
if (b < 0) { console.error('TAIL NOT FOUND'); process.exit(1); }

var block = `  /* ===================== §590 省/市/区首府 → 下辖地视野 =====================
   * 老板：「占领省市区首府，可以看到该省市区下辖地的视野」（v156.24）。
   * 口径：地图上真正的**省/市/区**（\`map3d._settle\` 的 provOf/marketOf/districtOf，
   *   UI 检索栏那三个下拉就是它），不是 DATA.NPC_CITIES 的 13 州出生区。
   *   行政中心城 \`M.admCities\` 带 admLevel，且 map3d 本来就允许出征它
   *   （\`kind==='adm' → ui.openAttackModal\`）。
   *
   * ⚠️ 这一节在 node 里只能验到**逻辑层**：\`_settle\` 要 three + genSettlements 才有，
   *   门禁环境没有。所以：
   *     ① 出口在册；② \`adminCisOf\` 纯函数过滤正确（构造假场验，含越界/串级/反平凡解）；
   *     ③ 无数据时 \`revealAdmin\` 安全返回 0；④ 挂钩与存档字段在册（源码级）。
   *   真实数据端到端（占省府 → 4478 格全明、邻省 0）由浏览器探针
   *   \`.workbuddy/tools/show/probe_admin_reveal.js\` 覆盖，结论记在交付文档里。
   * ===================================================================== */
  (function () {
    var G2 = GAME;
    check('§590① 出口在册（adminFields / adminCisOf / adminCiList / adminOf / fog.revealAdmin）',
      !!(G2.map && typeof G2.map.adminFields === 'function'
        && typeof G2.map.adminCisOf === 'function'
        && typeof G2.map.adminCiList === 'function'
        && typeof G2.map.adminOf === 'function')
      && !!(G2.fog && typeof G2.fog.revealAdmin === 'function'));

    if (!G2.map || typeof G2.map.adminCisOf !== 'function') return;

    /* ---- ② 纯函数过滤：构一份 12 格的假行政场 ----
       prov:    [0,0,0,0, 1,1,1,1, -1,-1,-1,-1]
       market:  [0,0,1,1, 2,2,2,3, -1,-1,-1,-1]
       district:[0,1,2,3, 4,5,6,7, -1,-1,-1,-1]
       —— 特意让"两省恰好各有 4 格、市场跨省错开"，这样串级/串省都会被抓到。 */
    var fk = {
      prov: [0, 0, 0, 0, 1, 1, 1, 1, -1, -1, -1, -1],
      market: [0, 0, 1, 1, 2, 2, 2, 3, -1, -1, -1, -1],
      district: [0, 1, 2, 3, 4, 5, 6, 7, -1, -1, -1, -1]
    };
    var eq = function (a, b) { return a && b && a.length === b.length && a.every(function (v, i) { return v === b[i]; }); };

    var p0 = G2.map.adminCisOf(fk, 'prov', 0);
    var p1 = G2.map.adminCisOf(fk, 'prov', 1);
    check('§590② 省级过滤正确（各自 4 格、互不串省）',
      eq(p0, [0, 1, 2, 3]) && eq(p1, [4, 5, 6, 7]),
      'prov0=' + JSON.stringify(p0) + ' prov1=' + JSON.stringify(p1));

    var m2 = G2.map.adminCisOf(fk, 'market', 2);
    check('§590② 市级过滤正确（market=2 → 4,5,6，与省界无关但格位精确）',
      eq(m2, [4, 5, 6]), 'market2=' + JSON.stringify(m2));

    var d3 = G2.map.adminCisOf(fk, 'district', 3);
    check('§590② 区级过滤正确（district=3 → 只有 3）',
      eq(d3, [3]), 'district3=' + JSON.stringify(d3));

    /* 反平凡解：不同 index 必须给出不同答案（"永远返回全表"会被这条抓住） */
    var distinct = !eq(G2.map.adminCisOf(fk, 'prov', 0), G2.map.adminCisOf(fk, 'prov', 1))
      && (G2.map.adminCisOf(fk, 'prov', 0) || []).length < 12;
    check('§590② 反平凡解：不同 index 结果不同，且都短于全表', distinct);

    /* 无归属格（-1）不得出现在任何清单里 */
    var anyNeg = false;
    ['prov', 'market', 'district'].forEach(function (lv) {
      for (var ix = 0; ix < 4; ix++) {
        (G2.map.adminCisOf(fk, lv, ix) || []).forEach(function (ci) { if (ci >= 8) anyNeg = true; });
      }
    });
    check('§590② 无归属格(-1)不进任何清单（不会被当成 index=-1 的行政区）', !anyNeg);

    /* 边界：越界 index → 空数组（"这一级存在、只是没有格"）；乱 level / 负 index / 空 fields → null */
    var oob = G2.map.adminCisOf(fk, 'prov', 99);
    check('§590② 越界 index 返回**空数组**（区别于 null：级别合法但没有格）',
      Array.isArray(oob) && oob.length === 0, 'got=' + JSON.stringify(oob));
    check('§590② 乱 level → null（不会把省当成市返回）',
      G2.map.adminCisOf(fk, 'city', 0) === null);
    check('§590② 负 index → null', G2.map.adminCisOf(fk, 'prov', -1) === null);
    check('§590② 空 fields → null（无 three 环境的正常降级）',
      G2.map.adminCisOf(null, 'prov', 0) === null);

    /* ---- ③ 无行政数据时：revealAdmin 安全返回 0，不抛、不点亮全图 ---- */
    var seen0 = G2.fog.stats().seen;
    var r0 = -999;
    try { r0 = G2.fog.revealAdmin('prov', 0); } catch (e0) { r0 = 'throw'; }
    var noData = (G2.map.adminFields() === null);
    check('§590③ 无行政数据（node 环境）时安全返回 0，不抛异常',
      r0 === 0 || (!noData && typeof r0 === 'number'),
      'got=' + r0 + ' noData=' + noData);
    check('§590③ 更关键：**没有把整张图点亮**（防"降级就全亮"）',
      G2.fog.stats().seen - seen0 < 200,
      'Δseen=' + (G2.fog.stats().seen - seen0));

    /* ---- ④ 挂钩与存档字段在册（源码级） ---- */
    try {
      var fs9 = require('fs'), p9 = require('path');
      var bt = fs9.readFileSync(p9.join(__dirname, 'js', 'battle.js'), 'utf8');
      var fg = fs9.readFileSync(p9.join(__dirname, 'js', 'fog.js'), 'utf8');
      var iOn = bt.indexOf('GAME.onConquer = function');
      var seg = iOn >= 0 ? bt.slice(iOn, iOn + 12000) : '';
      check('§590④ 占领挂钩在册：onConquer 调 revealAdmin，且门槛是 admLevel（不是 type）',
        seg.indexOf('revealAdmin') >= 0
          && /npcCity\\.admLevel/.test(seg)
          && seg.indexOf("npcCity.type === 'zhou'") < 0,
        seg ? '已检查 onConquer 段' : '找不到 GAME.onConquer');
      check('§590④ 新城保留 admLevel/admIndex（否则读档后视野退回占领前）',
        /newCity\\.admLevel\\s*=\\s*npcCity\\.admLevel/.test(seg),
        seg ? '已检查' : '');
      check('§590④ revealOwned 里有 admLevel 补点亮（decay/读档后能回来）',
        /F\\.revealOwned = function[\\s\\S]{0,2600}revealAdmin/.test(fg));
    } catch (e9) {
      check('§590④ 挂钩在册', false, String(e9 && (e9.message || e9)));
    }
  })();

`;

s = s.slice(0, a) + block + s.slice(b);
fs.writeFileSync(p, s, 'utf8');
console.log('rewrote §590 (adm 口径)');
