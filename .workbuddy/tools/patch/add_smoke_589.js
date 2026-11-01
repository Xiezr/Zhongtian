/* 一次性补丁：在 §588 之后插入 §589（海面波形"必须非周期"的源码级守卫）。
 * 用法：node .workbuddy/tools/patch/add_smoke_589.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var P = path.join(ROOT, 'smoke-test.js');
var s = fs.readFileSync(P, 'utf8');

if (s.indexOf('§589') >= 0) { console.log('§589 已存在，跳过'); process.exit(0); }

var anchor = "console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');";
if (s.indexOf(anchor) < 0) { console.error('找不到汇总行锚点'); process.exit(1); }

var block = [
  "  /* ===================== §589 海面波形必须「非周期」 =====================",
  "   * 老板：「海波还是有点太规整太明显了」（v156.22）。",
  "   * 病根：5 条固定方向的正弦叠加 —— 相位线性 → 等相位线是平行直线，",
  "   *   怎么加域扭曲都只是把直条纹弯成弯条纹（扭曲本身也是正弦）。",
  "   * 改法：值噪声 fbm + 噪声域扭曲；细浪从顶点位移搬到**像素级法线扰动**",
  "   *   （水面网格每格只有 7 个顶点，比一格细的浪在几何上根本表达不出来）。",
  "   * 这条守卫盯的就是「别退回去」：波形里不许再出现固定方向的 sin(dot(…))。",
  "   * ===================================================================== */",
  "  (function () {",
  "    var fs589 = require('fs'), p589 = require('path');",
  "    var md = fs589.readFileSync(p589.join(__dirname, 'js', 'map3d.js'), 'utf8');",
  "    check('§589① 海面波形用哈希噪声（hash13 / vn / fbm2 都在）',",
  "      md.indexOf('float hash13(vec3 p)') >= 0 && md.indexOf('float vn(vec3 x)') >= 0",
  "      && md.indexOf('float fbm2(vec3 p)') >= 0);",
  "    check('§589② 波形里不再有「固定方向正弦叠加」（sin(dot(W,…)) 已退役）',",
  "      md.indexOf('sin(dot(W') < 0,",
  "      '发现 sin(dot(W…) —— 那是平行条纹的老写法');",
  "    check('§589③ 细浪在片元级（rip + 法线扰动），不是只靠顶点位移',",
  "      /float rip\\(vec3 p\\)/.test(md) && /N = normalize\\(N - \\(hT - h0\\)/.test(md));",
  "    check('§589④ 振幅随距离衰减（uFar 有 uniform 且由 render 每帧写）',",
  "      /uFar: \\{ value: 1 \\}/.test(md) && /uniforms\\.uFar\\.value\\s*=/.test(md));",
  "  })();",
  "",
  anchor
].join('\n');

s = s.replace(anchor, block);
fs.writeFileSync(P, s, 'utf8');
console.log('§589 已插入');
