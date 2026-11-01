/* v156.23：新增门禁 §590「占领首府 → 该州辖地全境在望」
 * 插在 §589 之后、汇总行之前。
 * 用法：node .workbuddy/tools/patch/add_smoke_590.js
 */
'use strict';
var fs = require('fs');
var p = 'smoke-test.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('§590') >= 0) { console.log('SKIP: §590 already present'); process.exit(0); }

var anchor = `  })();

console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');`;
if (s.indexOf(anchor) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var block = `  })();

  /* ===================== §590 占领首府 → 该州辖地全境在望 =====================
   * 老板：「占领省市区首府，可以看到该省市区下辖地的视野」（v156.23）。
   * 机制：\`GAME.map._stateField()\` 建「格 → 州」归属（复用多源 BFS 的聚落场，
   *   聚落自带 state），\`GAME.fog.revealState(州名)\` 把该州辖地整片点亮。
   * 这一节盯四件事，其中两条是**反平凡解**（否则"点亮全图"也能过）：
   *   ① 出口在册；② 全图每格都有州属、且州数对得上（不能是 0/1 个州）；
   *   ③ 点亮某州 → **该州 100% 全明**且命中数 === 该州格数；
   *   ④ 邻州**不受影响**（防"顺手点亮全图"）、重复调用幂等、错州名返回 0；
   *   ⑤ 旧档路径：已占首府经 \`revealOwned\` 也能补点亮（否则一读档就丢）。
   * ===================================================================== */
  (function () {
    var G2 = GAME;
    check('§590① 出口在册（map._stateField / stateCiList / stateAt / fog.revealState）',
      !!(G2.map && typeof G2.map._stateField === 'function'
        && typeof G2.map.stateCiList === 'function'
        && typeof G2.map.stateAt === 'function')
      && !!(G2.fog && typeof G2.fog.revealState === 'function'));

    if (!G2.fog || typeof G2.fog.revealState !== 'function') return;

    /* 建一颗确定的星球（与其它段同款；球面/距离都有缓存，很快） */
    try {
      var st5 = G2.newGame({ name: 'st590', cityName: '灰岗', mapSeed: 590001 });
      if (!st5.map.grid) G2.map.generate();
    } catch (e0) { /* 建世界失败 → 下面各条自然红，能看到原因 */ }

    var SP5 = G2.sphere, sf5 = G2.map._stateField();
    check('§590② 全图每格都有州属（无孤儿格）且州数 ≥ 12',
      !!sf5 && sf5.names.length >= 12,
      sf5 ? ('州数=' + sf5.names.length) : 'stateField 为空');
    if (!sf5) return;

    var none5 = 0;
    for (var i5 = 0; i5 < SP5.nv; i5++) if (G2.map.stateAt(i5) === '') none5++;
    check('§590② 无孤儿格（每格都能回答"归哪个州"）', none5 === 0, '孤儿格=' + none5);

    /* 每州都要有实际格数（防"名义上有 13 个州、实际全挤在 1 个州"） */
    var empty5 = sf5.names.filter(function (n) { return sf5.cells[sf5.idxOf[n]].length === 0; });
    check('§590② 每州辖地都非空', empty5.length === 0, '空州=' + empty5.join(','));

    /* 选辖地最大的州（保证样本够大，不会因"3 格小州"偶然通过） */
    var pick5 = sf5.names[0], best5 = -1;
    sf5.names.forEach(function (n) {
      var c = sf5.cells[sf5.idxOf[n]].length;
      if (c > best5) { best5 = c; pick5 = n; }
    });
    check('§590② 抽样州辖地足够大（≥200 格，否则断言无意义）', best5 >= 200,
      pick5 + '=' + best5 + ' 格');

    var list5 = G2.map.stateCiList(pick5);
    var before5 = G2.fog.stats().seen;
    var bad5 = G2.fog.revealState('这个州不存在');
    var hit5 = G2.fog.revealState(pick5);
    var full5 = 0;
    for (var j5 = 0; j5 < list5.length; j5++) if (G2.fog.get(list5[j5]) >= G2.fog.ALL) full5++;

    check('§590③ 点亮某州 → 该州辖地 100% 全明',
      full5 === list5.length && list5.length > 0,
      pick5 + ' 全明 ' + full5 + '/' + list5.length);
    check('§590③ 命中数 === 该州格数（不是"点亮一点意思意思"）',
      hit5 === list5.length, 'hit=' + hit5 + ' size=' + list5.length);
    check('§590③ 探明格数确实涨了（且 ≤ 该州格数）',
      G2.fog.stats().seen - before5 === list5.length,
      'Δ=' + (G2.fog.stats().seen - before5));

    /* 反平凡解：邻州一格都不该被点亮 */
    var other5 = sf5.names.filter(function (n) { return n !== pick5; })[0];
    var ol5 = G2.map.stateCiList(other5), ofull5 = 0;
    for (var k5 = 0; k5 < ol5.length; k5++) if (G2.fog.get(ol5[k5]) >= G2.fog.ALL) ofull5++;
    check('§590④ 反平凡解：邻州未被顺手点亮（旧写法"点亮全图"会在这里被抓住）',
      ofull5 === 0, other5 + ' 全明 ' + ofull5 + '/' + ol5.length);

    check('§590④ 幂等：重复点亮同一州返回 0（只升不降）',
      G2.fog.revealState(pick5) === 0);
    check('§590④ 错州名返回 0（绝不静默点亮半张图）', bad5 === 0, 'got=' + bad5);

    /* 旧档路径：已占首府 → revealOwned 补点亮（读档/decay 之后仍要回来） */
    var zc5 = (G2.DATA.NPC_CITIES || []).filter(function (c) {
      return c.type === 'zhou' && c.state === other5;
    })[0];
    if (zc5) {
      var fake5 = { id: 'st590_' + zc5.id, name: zc5.name, x: zc5.x, y: zc5.y,
        type: 'zhou', state: zc5.state, npc: false };
      G2.state.cities.push(fake5);
      G2.fog.revealOwned();
      var ofull5b = 0;
      for (var m5 = 0; m5 < ol5.length; m5++) if (G2.fog.get(ol5[m5]) >= G2.fog.ALL) ofull5b++;
      G2.state.cities = G2.state.cities.filter(function (c) { return c.id !== fake5.id; });
      check('§590⑤ 读档/月回访路径：已占首府经 revealOwned 仍能补点亮全州',
        ofull5b === ol5.length,
        other5 + ' 全明 ' + ofull5b + '/' + ol5.length);
    } else {
      check('§590⑤ 读档路径样本存在（该州有首府城）', false, other5 + ' 找不到 zhou 城');
    }
  })();

console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');`;

s = s.replace(anchor, block);
fs.writeFileSync(p, s, 'utf8');
console.log('patched smoke-test.js: §590');
