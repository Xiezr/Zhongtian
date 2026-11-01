/* v156.23：占领首府 → 该州辖地全境在望（挂到 GAME.onConquer，唯一占领出口）
 * 用法：node .workbuddy/tools/patch/patch_conquer_state.js
 */
'use strict';
var fs = require('fs');
var p = 'js/battle.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('v156.23') >= 0 && s.indexOf('revealState') >= 0) {
  console.log('SKIP: already patched');
  process.exit(0);
}

var anchor = `    GAME.log.war('占领新城市：' + npcCity.name + '！（威望 +' + repGain + '）');`;
if (s.indexOf(anchor) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var block = anchor + `

    /* ============================================================
     * v156.23（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
     * ------------------------------------------------------------
     * 打下**首府**（zhou）或旧都（capital，烬环无首府，以旧都为该区核心）
     * → 该州**下辖地全境在望**。
     *   · 为什么不是"首府周围几格"：那和普通城没区别，老板要的是"接手一张图"；
     *   · 为什么旧都也算：烬环是唯一没有首府的区，若只认 zhou，
     *     则在烬环打下灰烬城也看不见辖地 —— 同一句需求会出现一个区永远不生效。
     * 点亮逻辑只有一处（GAME.fog.revealState），这里只负责"什么时候点"和"怎么说"。
     * ============================================================ */
    if (GAME.fog && GAME.fog.revealState && (npcCity.type === 'zhou' || npcCity.type === 'capital')) {
      var _stName = npcCity.state || '';
      var _stHit = 0;
      try { _stHit = GAME.fog.revealState(_stName); } catch (eSt) { _stHit = 0; }
      if (_stHit > 0) {
        GAME.log.war('🏛 ' + npcCity.name + '既下 —— ' + _stName + '下辖 ' + _stHit + ' 格视野尽开');
        /* 这是"看得见"级别的收获，值得一条独立提示（别混进占领那行长文案里） */
        if (GAME.ui && GAME.ui.notify) {
          GAME.ui.notify('success', _stName + ' 全境在望：视野 +' + _stHit + ' 格');
        }
      }
    }`;

s = s.replace(anchor, block);
fs.writeFileSync(p, s, 'utf8');
console.log('patched battle.js: onConquer → revealState');
