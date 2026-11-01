/* v156.24c：§590 追加一条 —— 已占行政城不再画成紫色敌方城（源码级防回归）
 * 用法：node .workbuddy/tools/patch/add_smoke_590c.js
 */
'use strict';
var fs = require('fs');
var p = 'smoke-test.js';
var s = fs.readFileSync(p, 'utf8');
if (s.indexOf('§590⑤') >= 0) { console.log('SKIP'); process.exit(0); }

var anchor = `      check('§590④ revealOwned 里有 admLevel 补点亮（decay/读档后能回来）',
        /F\\.revealOwned = function[\\s\\S]{0,2600}revealAdmin/.test(fg));`;
if (s.indexOf(anchor) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var add = anchor + `
      /* ⑤ 视觉归属：打下来的行政中心不能还画成紫色敌方城（同一格会叠两座模型）。
         实测（probe_adm_marker.js）：修之前 \`_settles.adm\` 仍留着它、
         修之后 admInSettles 1→0 / ownInSettles 0→1。 */
      var md = fs9.readFileSync(p9.join(__dirname, 'js', 'map3d.js'), 'utf8');
      check('§590⑤ 已占的行政中心不再进紫色敌方城（避免与己方城叠两座模型）',
        /_ownAdmKey/.test(md)
          && /if \\(_ownAdmKey\\[c\\.admLevel \\+ '\\|' \\+ c\\.admIndex\\]\\) return;/.test(md),
        'map3d.js 里找不到"已占则跳过"的守卫');`;

s = s.replace(anchor, add);
fs.writeFileSync(p, s, 'utf8');
console.log('patched: §590⑤');
