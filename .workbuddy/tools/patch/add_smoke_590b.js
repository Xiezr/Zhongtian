/* v156.23：§590 追加两条 —— ⑥真实占领链路 ⑦挂钩在册（源码级）
 * 用法：node .workbuddy/tools/patch/add_smoke_590b.js
 */
'use strict';
var fs = require('fs');
var p = 'smoke-test.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('§590⑥') >= 0) { console.log('SKIP: already patched'); process.exit(0); }

var anchor = `      check('§590⑤ 读档/月回访路径：已占首府经 revealOwned 仍能补点亮全州',
        ofull5b === ol5.length,
        other5 + ' 全明 ' + ofull5b + '/' + ol5.length);
    } else {
      check('§590⑤ 读档路径样本存在（该州有首府城）', false, other5 + ' 找不到 zhou 城');
    }
  })();`;
if (s.indexOf(anchor) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var block = `      check('§590⑤ 读档/月回访路径：已占首府经 revealOwned 仍能补点亮全州',
        ofull5b === ol5.length,
        other5 + ' 全明 ' + ofull5b + '/' + ol5.length);
    } else {
      check('§590⑤ 读档路径样本存在（该州有首府城）', false, other5 + ' 找不到 zhou 城');
    }

    /* ⑥ 真实链路：走 GAME.onConquer（真占领）而不是手动调 revealState。
       为什么必须测：revealState 单独绿，只能证明"点亮函数好用"；
       挂钩被删/条件写错时，玩家什么也看不到，而上面各条依然全绿。 */
    var zhou6 = (G2.DATA.NPC_CITIES || []).filter(function (c) {
      return c.type === 'zhou' && c.state !== pick5 && c.state !== other5;
    })[0];
    if (zhou6) {
      var list6 = G2.map.stateCiList(zhou6.state) || [];
      var before6 = 0;
      for (var q6 = 0; q6 < list6.length; q6++) if (G2.fog.get(list6[q6]) >= G2.fog.ALL) before6++;
      var okChain6 = false, err6 = '';
      try { G2.onConquer(zhou6, {}, null, null); okChain6 = true; }
      catch (e6) { err6 = String(e6 && (e6.message || e6)); }
      var full6 = 0;
      for (var t6 = 0; t6 < list6.length; t6++) if (G2.fog.get(list6[t6]) >= G2.fog.ALL) full6++;
      var city6 = (G2.state.cities || []).filter(function (c) { return c.name === zhou6.name; })[0];
      check('§590⑥ 真实链路：GAME.onConquer 打下一座首府 → 该州辖地全明',
        okChain6 && before6 === 0 && full6 === list6.length && list6.length > 0,
        (err6 ? ('抛异常: ' + err6) : '')
          + zhou6.name + '/' + zhou6.state + ' 全明 ' + full6 + '/' + list6.length + '（占领前 ' + before6 + '）');
      check('§590⑥ 真实链路：该城确实进版图且档位保留（zhou）',
        !!city6 && city6.type === 'zhou', city6 ? ('type=' + city6.type) : '城未入库');
    } else {
      check('§590⑥ 真实链路样本存在', false, '找不到可测的第三座州首府');
    }

    /* ⑦ 挂钩在册（源码级）：battle.js 的 onConquer 里必须有 revealState，
       且**只对 zhou / capital** 生效 —— 不能变成"占任何城都点亮全州"。 */
    try {
      var fs7 = require('fs'), p7 = require('path');
      var bt = fs7.readFileSync(p7.join(__dirname, 'js', 'battle.js'), 'utf8');
      var iOn = bt.indexOf('GAME.onConquer = function');
      var seg = iOn >= 0 ? bt.slice(iOn, iOn + 12000) : '';
      check('§590⑦ 占领挂钩在册：onConquer 里有 revealState，且限定 zhou/capital',
        seg.indexOf('revealState') >= 0
          && /npcCity\\.type === 'zhou'/.test(seg)
          && /npcCity\\.type === 'capital'/.test(seg),
        seg ? '已检查 onConquer 段' : '找不到 GAME.onConquer');
    } catch (e7) {
      check('§590⑦ 占领挂钩在册', false, String(e7 && (e7.message || e7)));
    }
  })();`;

s = s.replace(anchor, block);
fs.writeFileSync(p, s, 'utf8');
console.log('patched smoke-test.js: §590⑥⑦');
