/* v156.23：在 fog.js 加 `revealState`，并让「已占首府」在 revealOwned 里幂等重刷。
 * 用法：node .workbuddy/tools/patch/patch_fog_state.js
 */
'use strict';
var fs = require('fs');
var p = 'js/fog.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('F.revealState = function') >= 0) {
  console.log('SKIP: revealState already present');
  process.exit(0);
}

/* ---- 1) revealState：插在 revealCity 之前 ---- */
var anchor1 = `  F.revealCity = function (city, r) {`;
if (s.indexOf(anchor1) < 0) { console.error('ANCHOR1 NOT FOUND'); process.exit(1); }

var block1 = `  /* ============================================================
   * v156.23（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
   * ------------------------------------------------------------
   * 占领一州**首府** → 该州下辖地全境在望（全明）。
   *
   * 为什么"首府 = 整州视野"讲得通：
   *   首府是建制的神经中枢 —— 驿传、户籍、田册、山川图志都在那里。
   *   打下它，你看得见的不只是城墙，还有**它管辖的那片地**。
   * 与既有规则的接缝：
   *   · 普通城仍只按 \`radiusOf()\` 点亮身边几格（探索度换视野）；
   *   · 首府给的是**辖地**，不随探索度缩放 —— 它不是"探得更远"，是"接手了一张图"。
   * 幂等：与 \`revealOwned\` 同款（只升不降，重复调用只会返回 0）。
   * 州名不存在（拼错/旧档区名）→ 返回 0，绝不静默点亮半张图。
   * ============================================================ */
  F.revealState = function (stateName) {
    F.ensure();
    if (!stateName || !_n) return 0;
    var M = GAME.map;
    if (!M || !M.stateCiList) return 0;
    var list = M.stateCiList(stateName);      /* 唯一出口：格→州 的归属表在 map.js */
    if (!list || !list.length) return 0;
    var hit = 0;
    for (var i = 0; i < list.length; i++) if (F.bump(list[i], ALL)) hit++;
    return hit;
  };

`;
s = s.replace(anchor1, block1 + anchor1);

/* ---- 2) revealOwned：已占首府每轮幂等重刷（读档 / decay 之后也要回来） ---- */
var anchor2 = `    /* 我方前哨（据点被拔除后占据） */`;
if (s.indexOf(anchor2) < 0) { console.error('ANCHOR2 NOT FOUND'); process.exit(1); }

var block2 = `    /* v156.23：**已占首府 → 该州辖地全明**
       ⚠️ 必须放在 revealOwned 里（而不是只在占领那一下点一次）：
         ① 读档后 fog 包是重建的，只在占领时点亮 = 一出游戏就丢；
         ② \`decay()\` 会把全明褪成半明，然后调 revealOwned "把家门口点回来" ——
            首府带来的辖地视野属于"建制内"，理应和城周围一样不被淡忘。
       幂等：已全明的格 \`bump\` 直接返回 false，不产生写入。 */
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      if (c.type !== 'zhou' && c.type !== 'capital') return;
      hit += F.revealState(c.state);
    });
`;
s = s.replace(anchor2, block2 + anchor2);

fs.writeFileSync(p, s, 'utf8');
console.log('patched fog.js: revealState + revealOwned 幂等重刷');
